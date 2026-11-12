import logging
from contextlib import suppress
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_app_settings, get_current_user, get_paypal_client
from app.core.config import Settings
from app.core.database import get_db
from app.core.timeutils import to_ms
from app.models.paypal import PayPalConnection
from app.models.user import User
from app.schemas.paypal import (
    PayPalConnectionOut,
    PayPalConnectOut,
    PayPalPermissionsOut,
    PayPalSyncOut,
)
from app.services.paypal import PayPalClient
from app.services.paypal import service as paypal_service
from app.services.paypal import sync as paypal_sync
from app.services.paypal.permissions import PermissionCheck, probe_permissions

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/paypal", tags=["paypal"])

_NOT_CONFIGURED = (
    "PayPal sandbox credentials are not configured. Set PAYPAL_CLIENT_ID and "
    "PAYPAL_CLIENT_SECRET on the backend."
)

_ERROR_STATUS = {
    "reconnect_required": status.HTTP_409_CONFLICT,
    "authorization_rejected": status.HTTP_409_CONFLICT,
    "configuration_error": status.HTTP_503_SERVICE_UNAVAILABLE,
    "network_error": status.HTTP_502_BAD_GATEWAY,
}


def _connection_for(db: Session, merchant_id: int) -> PayPalConnection | None:
    return db.scalar(
        select(PayPalConnection).where(
            PayPalConnection.merchant_id == merchant_id
        )
    )


def _redirect(
    settings: Settings, result: str, reason: str | None = None
) -> RedirectResponse:
    parts = urlsplit(settings.paypal_return_url)
    query = dict(parse_qsl(parts.query))
    query["paypal"] = result
    if reason:
        query["reason"] = reason
    return RedirectResponse(
        urlunsplit(parts._replace(query=urlencode(query))),
        status_code=status.HTTP_303_SEE_OTHER,
    )


@router.get("/connection", response_model=PayPalConnectionOut)
def get_connection(
    settings: Settings = Depends(get_app_settings),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return paypal_service.build_payload(settings, _connection_for(db, user.id))


@router.post("/connect", response_model=PayPalConnectOut)
def connect(
    settings: Settings = Depends(get_app_settings),
    client: PayPalClient = Depends(get_paypal_client),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if not settings.paypal_configured:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=_NOT_CONFIGURED,
        )

    authorization_url, expires_at = paypal_service.create_authorization(
        db, client, user.id
    )
    return {
        "authorization_url": authorization_url,
        "expires_at": to_ms(expires_at),
    }


@router.get("/oauth/callback")
def oauth_callback(
    request: Request,
    code: str | None = Query(None),
    state: str | None = Query(None),
    error: str | None = Query(None),
    db: Session = Depends(get_db),
):
    settings: Settings = request.app.state.settings
    client: PayPalClient = request.app.state.paypal_client

    if error:
        if state:
            with suppress(paypal_service.PayPalFlowError):
                paypal_service.consume_state(db, state)
        return _redirect(settings, "error", "access_denied")

    if not state:
        return _redirect(settings, "error", "invalid_state")
    if not code:
        return _redirect(settings, "error", "missing_code")

    try:
        paypal_service.complete_authorization(db, client, state, code)
    except paypal_service.PayPalFlowError as exc:
        logger.info("PayPal OAuth callback failed (%s).", exc.reason)
        return _redirect(settings, "error", exc.reason)

    logger.info("PayPal sandbox account connected.")
    return _redirect(settings, "connected")


@router.post("/connection/refresh", response_model=PayPalConnectionOut)
def refresh_connection(
    settings: Settings = Depends(get_app_settings),
    client: PayPalClient = Depends(get_paypal_client),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    connection = _connection_for(db, user.id)
    if connection is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No PayPal account is connected.",
        )

    try:
        refreshed = paypal_service.refresh_connection(db, client, connection)
    except paypal_service.PayPalConnectionError as exc:
        raise HTTPException(
            status_code=_ERROR_STATUS.get(
                exc.reason, status.HTTP_502_BAD_GATEWAY
            ),
            detail=exc.detail,
        ) from exc

    return paypal_service.build_payload(settings, refreshed)


@router.post("/connection/disconnect", response_model=PayPalConnectionOut)
def disconnect(
    settings: Settings = Depends(get_app_settings),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    paypal_service.disconnect(db, user.id)
    return paypal_service.build_payload(settings, None)


_SYNC_ERROR_STATUS = {
    "not_configured": status.HTTP_503_SERVICE_UNAVAILABLE,
    "configuration_error": status.HTTP_503_SERVICE_UNAVAILABLE,
    "forbidden": status.HTTP_409_CONFLICT,
    "network_error": status.HTTP_502_BAD_GATEWAY,
    "paypal_error": status.HTTP_502_BAD_GATEWAY,
}


@router.post("/sync", response_model=PayPalSyncOut)
def sync_paypal_data(
    settings: Settings = Depends(get_app_settings),
    client: PayPalClient = Depends(get_paypal_client),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    try:
        result = paypal_sync.run_sync(db, client, user.id, _connection_for(db, user.id))
    except paypal_sync.PayPalSyncError as exc:
        raise HTTPException(
            status_code=_SYNC_ERROR_STATUS.get(
                exc.code, status.HTTP_502_BAD_GATEWAY
            ),
            detail=str(exc),
        ) from exc

    payload = result.as_payload()
    payload["ran_at"] = to_ms(payload["ran_at"])
    return payload


@router.get("/permissions", response_model=PayPalPermissionsOut)
def permissions(
    settings: Settings = Depends(get_app_settings),
    client: PayPalClient = Depends(get_paypal_client),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    connection = _connection_for(db, user.id)
    try:
        checks: list[PermissionCheck] = probe_permissions(
            db, client, settings, connection
        )
    except paypal_sync.PayPalSyncError as exc:
        raise HTTPException(
            status_code=_SYNC_ERROR_STATUS.get(
                exc.code, status.HTTP_502_BAD_GATEWAY
            ),
            detail=str(exc),
        ) from exc

    uses_merchant_token = bool(
        connection is not None
        and connection.status == "connected"
        and "disputes" in (connection.scopes or "")
    )
    return {
        "token_source": "merchant" if uses_merchant_token else "application",
        "checks": [check.as_payload() for check in checks],
    }
