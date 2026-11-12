import logging
import secrets
from datetime import datetime, timedelta

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.timeutils import to_ms, utcnow
from app.core.token_cipher import TokenDecryptionError, decrypt_token, encrypt_token
from app.models.paypal import PayPalConnection, PayPalOAuthState
from app.services.paypal.client import PayPalAPIError, PayPalClient, PayPalTokens

logger = logging.getLogger(__name__)

STATE_TTL = timedelta(minutes=10)

_ERROR_REASONS = {
    "invalid_client": "configuration_error",
    "invalid_grant": "authorization_rejected",
    "network_error": "network_error",
}

_ERROR_DETAILS = {
    "configuration_error": (
        "PayPal rejected the configured sandbox credentials. Check "
        "PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET."
    ),
    "authorization_rejected": (
        "PayPal rejected this authorization. Start the connection again."
    ),
    "token_exchange_failed": (
        "PayPal did not complete the authorization. Start the connection again."
    ),
    "network_error": "Could not reach PayPal. Check your network and try again.",
}


class PayPalFlowError(Exception):
    def __init__(self, reason: str):
        self.reason = reason
        super().__init__(reason)


class PayPalConnectionError(Exception):
    def __init__(self, reason: str, detail: str):
        self.reason = reason
        self.detail = detail
        super().__init__(detail)


def create_authorization(
    db: Session, client: PayPalClient, merchant_id: int
) -> tuple[str, datetime]:
    now = utcnow()
    db.execute(delete(PayPalOAuthState).where(PayPalOAuthState.expires_at < now))
    raw_state = secrets.token_urlsafe(32)
    record = PayPalOAuthState(
        state=raw_state,
        merchant_id=merchant_id,
        created_at=now,
        expires_at=now + STATE_TTL,
    )
    db.add(record)
    db.commit()
    return client.build_authorization_url(raw_state), record.expires_at


def consume_state(db: Session, state: str) -> PayPalOAuthState:
    record = db.scalar(
        select(PayPalOAuthState).where(PayPalOAuthState.state == state)
    )
    now = utcnow()
    if (
        record is None
        or record.used_at is not None
        or record.expires_at <= now
    ):
        raise PayPalFlowError("invalid_state")
    record.used_at = now
    db.commit()
    return record


def complete_authorization(
    db: Session, client: PayPalClient, state: str, code: str
) -> PayPalConnection:
    if not code.strip():
        raise PayPalFlowError("missing_code")
    record = consume_state(db, state)
    if not client.configured:
        raise PayPalFlowError("configuration_error")

    try:
        tokens = client.exchange_code(code)
    except PayPalAPIError as exc:
        logger.warning("PayPal token exchange failed (%s).", exc.code)
        raise PayPalFlowError(_reason_for(exc)) from exc

    now = utcnow()
    connection = db.scalar(
        select(PayPalConnection).where(
            PayPalConnection.merchant_id == record.merchant_id
        )
    )
    if connection is None:
        connection = PayPalConnection(merchant_id=record.merchant_id)
        db.add(connection)

    connection.environment = client.settings.paypal_mode
    connection.connected_at = now
    connection.verified_at = now
    _apply_tokens(connection, tokens, client.settings, now)

    try:
        userinfo = client.fetch_userinfo(tokens.access_token)
    except PayPalAPIError as exc:
        logger.warning("PayPal userinfo lookup failed (%s).", exc.code)
    else:
        connection.payer_id = _truncate(userinfo.payer_id, 64)
        connection.account_email = _truncate(userinfo.email, 320)
        connection.account_name = _truncate(userinfo.name, 160)

    db.commit()
    db.refresh(connection)
    return connection


def refresh_connection(
    db: Session, client: PayPalClient, connection: PayPalConnection
) -> PayPalConnection:
    if not connection.refresh_token_encrypted:
        raise PayPalConnectionError(
            "reconnect_required",
            "This connection has no refresh token. Reconnect your PayPal account.",
        )

    try:
        stored_token = decrypt_token(
            connection.refresh_token_encrypted, client.settings
        )
    except TokenDecryptionError as exc:
        raise PayPalConnectionError("reconnect_required", str(exc)) from exc

    try:
        tokens = client.refresh_access_token(stored_token)
    except PayPalAPIError as exc:
        reason = _reason_for(exc)
        detail = _ERROR_DETAILS.get(
            reason, _ERROR_DETAILS["token_exchange_failed"]
        )
        connection.last_error = detail[:255]
        if reason == "authorization_rejected":
            connection.status = "error"
        db.commit()
        logger.warning("PayPal token refresh failed (%s).", exc.code)
        raise PayPalConnectionError(reason, detail) from exc

    now = utcnow()
    _apply_tokens(connection, tokens, client.settings, now)
    connection.verified_at = now
    db.commit()
    db.refresh(connection)
    return connection


def disconnect(db: Session, merchant_id: int) -> None:
    connection = db.scalar(
        select(PayPalConnection).where(
            PayPalConnection.merchant_id == merchant_id
        )
    )
    if connection is not None:
        db.delete(connection)
    db.execute(
        delete(PayPalOAuthState).where(
            PayPalOAuthState.merchant_id == merchant_id
        )
    )
    db.commit()


def build_payload(
    settings: Settings, connection: PayPalConnection | None
) -> dict:
    connected = connection is not None
    return {
        "configured": settings.paypal_configured,
        "environment": settings.paypal_mode,
        "sandbox": settings.paypal_sandbox,
        "connected": connected,
        "status": connection.status if connection else "disconnected",
        "account_email": connection.account_email if connection else None,
        "account_name": connection.account_name if connection else None,
        "payer_id": connection.payer_id if connection else None,
        "scopes": connection.scopes.split() if connection and connection.scopes else [],
        "connected_at": to_ms(connection.connected_at) if connection else None,
        "token_expires_at": (
            to_ms(connection.access_token_expires_at) if connection else None
        ),
        "refresh_token_expires_at": (
            to_ms(connection.refresh_token_expires_at) if connection else None
        ),
        "last_verified_at": (
            to_ms(connection.verified_at) if connection else None
        ),
        "last_error": connection.last_error if connection else None,
        "redirect_uri": settings.paypal_effective_redirect_uri,
        "requested_scopes": settings.paypal_scope_list,
    }


def _apply_tokens(
    connection: PayPalConnection,
    tokens: PayPalTokens,
    settings: Settings,
    now: datetime,
) -> None:
    connection.access_token_encrypted = encrypt_token(
        tokens.access_token, settings
    )
    if tokens.refresh_token:
        connection.refresh_token_encrypted = encrypt_token(
            tokens.refresh_token, settings
        )
    if tokens.expires_in:
        connection.access_token_expires_at = now + timedelta(
            seconds=tokens.expires_in
        )
    if tokens.refresh_token_expires_in:
        connection.refresh_token_expires_at = now + timedelta(
            seconds=tokens.refresh_token_expires_in
        )
    granted = tokens.scope or " ".join(settings.paypal_scope_list)
    connection.scopes = granted[:500]
    connection.status = "connected"
    connection.last_error = None


def _reason_for(exc: PayPalAPIError) -> str:
    return _ERROR_REASONS.get(exc.code, "token_exchange_failed")


def _truncate(value: str | None, limit: int) -> str | None:
    return value[:limit] if value else None
