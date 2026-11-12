"""Verify which PayPal APIs the configured app/merchant token can actually read."""

from contextlib import suppress
from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.core.config import Settings
from app.models.paypal import PayPalConnection
from app.services.paypal import PayPalAPIError, PayPalClient
from app.services.paypal.normalize import normalize_dispute
from app.services.paypal.sync import PayPalSyncError, resolve_token

STATUS_AUTHORIZED = "authorized"
STATUS_UNAUTHORIZED = "unauthorized"
STATUS_FORBIDDEN = "forbidden"
STATUS_ERROR = "error"
STATUS_UNVERIFIED = "unverified"


@dataclass
class PermissionCheck:
    api: str
    endpoint: str
    status: str
    detail: str | None = None

    def as_payload(self) -> dict:
        return {
            "api": self.api,
            "endpoint": self.endpoint,
            "status": self.status,
            "detail": self.detail,
        }


def _classify(exc: PayPalAPIError) -> tuple[str, str]:
    if exc.status_code == 401:
        return STATUS_UNAUTHORIZED, "PayPal rejected the access token."
    if exc.status_code == 403:
        return (
            STATUS_FORBIDDEN,
            "The app is not enabled for this API in the developer dashboard.",
        )
    return STATUS_ERROR, f"PayPal returned {exc.status_code or 'an error'} ({exc.code})."


def probe_permissions(
    db: Session,
    client: PayPalClient,
    settings: Settings,
    connection: PayPalConnection | None,
) -> list[PermissionCheck]:
    if not client.configured:
        raise PayPalSyncError(
            "not_configured",
            "PayPal sandbox credentials are not configured. Set PAYPAL_CLIENT_ID "
            "and PAYPAL_CLIENT_SECRET on the backend.",
        )

    token = resolve_token(db, client, connection)[0]
    checks: list[PermissionCheck] = []

    first_dispute: dict | None = None
    sample_capture_id: str | None = None
    sample_refund_id: str | None = None

    try:
        listing = client.list_disputes(token, page_size=1)
    except PayPalAPIError as exc:
        status, detail = _classify(exc)
        checks.append(
            PermissionCheck(
                api="Disputes",
                endpoint="GET /v1/customer/disputes",
                status=status,
                detail=detail,
            )
        )
    else:
        checks.append(
            PermissionCheck(
                api="Disputes",
                endpoint="GET /v1/customer/disputes",
                status=STATUS_AUTHORIZED,
                detail="Token accepted and dispute list returned.",
            )
        )
        items = listing.get("items") if isinstance(listing, dict) else None
        if isinstance(items, list) and items and isinstance(items[0], dict):
            first_dispute = items[0]
            candidate = normalize_dispute(first_dispute)["transaction_ref"]
            if isinstance(candidate, str) and candidate.strip():
                sample_capture_id = candidate

    if sample_capture_id:
        try:
            client.get_capture(token, sample_capture_id)
            checks.append(
                PermissionCheck(
                    api="Payments",
                    endpoint="GET /v2/payments/captures/{id}",
                    status=STATUS_AUTHORIZED,
                    detail=f"Verified with capture {sample_capture_id}.",
                )
            )
        except PayPalAPIError as exc:
            status, detail = _classify(exc)
            if exc.status_code == 404:
                status = STATUS_AUTHORIZED
                detail = "Endpoint reachable; capture not found but permission granted."
            checks.append(
                PermissionCheck(
                    api="Payments",
                    endpoint="GET /v2/payments/captures/{id}",
                    status=status,
                    detail=detail,
                )
            )
    else:
        checks.append(
            PermissionCheck(
                api="Payments",
                endpoint="GET /v2/payments/captures/{id}",
                status=STATUS_UNVERIFIED,
                detail="No sandbox dispute available to sample a capture id from.",
            )
        )

    if first_dispute is not None and isinstance(first_dispute.get("dispute_id"), str):
        with suppress(PayPalAPIError):
            detail_payload = client.get_dispute(token, first_dispute["dispute_id"])
            refund_details = (
                detail_payload.get("refund_details")
                if isinstance(detail_payload, dict)
                else None
            )
            if isinstance(refund_details, dict):
                candidate = (
                    refund_details.get("refund_id")
                    or refund_details.get("transaction_id")
                )
                if isinstance(candidate, str) and candidate.strip():
                    sample_refund_id = candidate

    if sample_refund_id:
        try:
            client.get_refund(token, sample_refund_id)
            checks.append(
                PermissionCheck(
                    api="Refunds",
                    endpoint="GET /v2/payments/refunds/{id}",
                    status=STATUS_AUTHORIZED,
                    detail=f"Verified with refund {sample_refund_id}.",
                )
            )
        except PayPalAPIError as exc:
            status, detail = _classify(exc)
            if exc.status_code == 404:
                status = STATUS_AUTHORIZED
                detail = "Endpoint reachable; refund not found but permission granted."
            checks.append(
                PermissionCheck(
                    api="Refunds",
                    endpoint="GET /v2/payments/refunds/{id}",
                    status=status,
                    detail=detail,
                )
            )
    else:
        checks.append(
            PermissionCheck(
                api="Refunds",
                endpoint="GET /v2/payments/refunds/{id}",
                status=STATUS_UNVERIFIED,
                detail="No refunded dispute available to sample a refund id from.",
            )
        )

    sample_order_id = settings.paypal_sample_order_id.strip()
    if sample_order_id:
        try:
            client.get_order(token, sample_order_id)
            checks.append(
                PermissionCheck(
                    api="Orders",
                    endpoint="GET /v2/checkout/orders/{id}",
                    status=STATUS_AUTHORIZED,
                    detail=f"Verified with order {sample_order_id}.",
                )
            )
        except PayPalAPIError as exc:
            status, detail = _classify(exc)
            if exc.status_code == 404:
                status = STATUS_AUTHORIZED
                detail = "Endpoint reachable; order not found but permission granted."
            checks.append(
                PermissionCheck(
                    api="Orders",
                    endpoint="GET /v2/checkout/orders/{id}",
                    status=status,
                    detail=detail,
                )
            )
    else:
        checks.append(
            PermissionCheck(
                api="Orders",
                endpoint="GET /v2/checkout/orders/{id}",
                status=STATUS_UNVERIFIED,
                detail="Set PAYPAL_SAMPLE_ORDER_ID to verify Orders access.",
            )
        )

    return checks
