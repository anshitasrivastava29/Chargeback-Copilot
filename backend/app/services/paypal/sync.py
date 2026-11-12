"""Pull real sandbox data from PayPal and upsert it into the local workspace.

Read path: Disputes API (list + detail) -> Payments captures -> optional
Orders/Refunds enrichment. Everything is written into the existing disputes and
transactions tables, so frontend contracts stay unchanged.
"""

import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import token_cipher
from app.core.timeutils import utcnow
from app.models.activity import ActivityEvent
from app.models.dispute import Dispute
from app.models.paypal import PayPalConnection
from app.models.transaction import Transaction
from app.services.paypal import PayPalAPIError, PayPalClient
from app.services.paypal import normalize as nz
from app.services.paypal import service as paypal_service
from app.services.paypal.service import PayPalConnectionError

logger = logging.getLogger(__name__)

# Verified against the live sandbox: page_size above 50 returns INVALID_REQUEST
# even though older docs mention 100.
PAGE_SIZE = 50
MAX_DISPUTE_DETAILS = 50
MAX_LIST_PAGES = 20


class PayPalSyncError(Exception):
    def __init__(self, code: str, message: str):
        self.code = code
        super().__init__(message)


@dataclass
class SyncResult:
    ran_at: datetime = field(default_factory=utcnow)
    token_source: str = "application"
    fetched: int = 0
    created: int = 0
    updated: int = 0
    skipped: int = 0
    transactions_created: int = 0
    transactions_updated: int = 0
    orders_enriched: int = 0
    refunds_observed: int = 0

    def as_payload(self) -> dict:
        return {
            "ran_at": self.ran_at,
            "token_source": self.token_source,
            "fetched": self.fetched,
            "created": self.created,
            "updated": self.updated,
            "skipped": self.skipped,
            "transactions_created": self.transactions_created,
            "transactions_updated": self.transactions_updated,
            "orders_enriched": self.orders_enriched,
            "refunds_observed": self.refunds_observed,
        }


def resolve_token(
    db: Session,
    client: PayPalClient,
    connection: PayPalConnection | None,
) -> tuple[str, str]:
    """Prefer the merchant's stored token when it can read disputes."""
    if (
        connection is not None
        and connection.status == "connected"
        and "disputes" in (connection.scopes or "")
    ):
        try:
            return _merchant_token(db, client, connection), "merchant"
        except (PayPalConnectionError, token_cipher.TokenDecryptionError):
            logger.warning(
                "Stored PayPal token unusable for sync; using app credentials."
            )
    return client.get_app_access_token(), "application"


def _merchant_token(db: Session, client: PayPalClient, connection: PayPalConnection) -> str:
    token = token_cipher.decrypt_token(
        connection.access_token_encrypted, client.settings
    )
    expires_at = connection.access_token_expires_at
    if expires_at is None or expires_at <= utcnow() + timedelta(seconds=60):
        refreshed = paypal_service.refresh_connection(db, client, connection)
        token = token_cipher.decrypt_token(
            refreshed.access_token_encrypted, client.settings
        )
    return token


def _list_all_disputes(client: PayPalClient, token: str) -> list:
    """Fetch every dispute-list page by following the API's next-page links."""
    summaries: list = []
    for page in range(1, MAX_LIST_PAGES + 1):
        listing = client.list_disputes(token, page_size=PAGE_SIZE, page=page)
        items = listing.get("items") if isinstance(listing, dict) else None
        if isinstance(items, list):
            summaries.extend(items)
        links = listing.get("links") if isinstance(listing, dict) else None
        has_next = any(
            isinstance(link, dict)
            and link.get("rel") == "next"
            and link.get("href")
            for link in (links or [])
        )
        if not has_next:
            break
    return summaries


def run_sync(
    db: Session,
    client: PayPalClient,
    merchant_id: int,
    connection: PayPalConnection | None,
) -> SyncResult:
    if not client.configured:
        raise PayPalSyncError(
            "not_configured",
            "PayPal sandbox credentials are not configured. Set PAYPAL_CLIENT_ID "
            "and PAYPAL_CLIENT_SECRET on the backend.",
        )

    token, token_source = resolve_token(db, client, connection)
    result = SyncResult(token_source=token_source)

    try:
        summaries = _list_all_disputes(client, token)
    except PayPalAPIError as exc:
        raise _sync_error(exc) from exc

    # Disputes not yet in the workspace are processed before updates, so a run
    # capped at MAX_DISPUTE_DETAILS still converges across repeated syncs.
    known_ids = set(
        db.scalars(select(Dispute.id).where(Dispute.merchant_id == merchant_id))
    )
    summaries.sort(
        key=lambda item: isinstance(item, dict)
        and item.get("dispute_id") in known_ids
    )

    for summary in summaries[:MAX_DISPUTE_DETAILS]:
        result.fetched += 1
        dispute_id = (
            summary.get("dispute_id") if isinstance(summary, dict) else None
        )
        if not isinstance(dispute_id, str) or not dispute_id.strip():
            result.skipped += 1
            continue

        detail = _fetch_detail(client, token, dispute_id)
        payload = detail if detail is not None else summary
        fields = nz.normalize_dispute(payload)

        transaction_ref = fields["transaction_ref"]
        if not isinstance(transaction_ref, str) or not transaction_ref.strip():
            logger.info(
                "Skipping PayPal dispute %s: no linked transaction reference.",
                dispute_id,
            )
            result.skipped += 1
            continue

        capture = _fetch_capture(client, token, transaction_ref)
        capture_fields = nz.normalize_capture(capture) if capture else None

        order_fields = None
        order_ref = fields["order_ref"]
        if isinstance(order_ref, str) and order_ref.strip():
            order = _fetch_order(client, token, order_ref)
            if order is not None:
                order_fields = nz.normalize_order(order)
                result.orders_enriched += 1

        transaction = _upsert_transaction(
            db,
            merchant_id,
            transaction_ref,
            capture_fields,
            order_fields,
            fields,
            result,
        )
        _upsert_dispute(db, merchant_id, transaction, fields, order_fields, result)
        if fields["refund_id"]:
            result.refunds_observed += 1
            _record_refund_event(db, fields)

    db.commit()
    return result


def _sync_error(exc: PayPalAPIError) -> PayPalSyncError:
    if exc.code == "network_error":
        return PayPalSyncError(
            "network_error", "Could not reach PayPal. Please try again."
        )
    if exc.code in {"invalid_client", "unauthorized_for_this_api"}:
        return PayPalSyncError(
            "configuration_error",
            "PayPal rejected the configured credentials. Check PAYPAL_CLIENT_ID "
            "and PAYPAL_CLIENT_SECRET.",
        )
    if exc.status_code in {401, 403}:
        return PayPalSyncError(
            "forbidden",
            "The PayPal app is not permitted to read this data. Enable the "
            "Disputes/Payments APIs for the app in the developer dashboard.",
        )
    return PayPalSyncError(
        "paypal_error",
        "PayPal rejected the data sync. Check the developer dashboard for the "
        "app's enabled APIs.",
    )


def _fetch_detail(client: PayPalClient, token: str, dispute_id: str) -> dict | None:
    try:
        return client.get_dispute(token, dispute_id)
    except PayPalAPIError as exc:
        logger.warning(
            "Dispute detail fetch failed for %s (%s); using summary.", dispute_id, exc.code
        )
        return None


def _fetch_capture(client: PayPalClient, token: str, capture_id: str) -> dict | None:
    try:
        return client.get_capture(token, capture_id)
    except PayPalAPIError as exc:
        logger.info(
            "Capture fetch failed for %s (%s); falling back to dispute amounts.",
            capture_id,
            exc.code,
        )
        return None


def _fetch_order(client: PayPalClient, token: str, order_id: str) -> dict | None:
    try:
        return client.get_order(token, order_id)
    except PayPalAPIError as exc:
        logger.info("Order fetch failed for %s (%s).", order_id, exc.code)
        return None


def _upsert_transaction(
    db: Session,
    merchant_id: int,
    transaction_ref: str,
    capture_fields: dict | None,
    order_fields: dict | None,
    dispute_fields: dict,
    result: SyncResult,
) -> Transaction:
    transaction = db.get(Transaction, transaction_ref)
    created = transaction is None
    if created:
        transaction = Transaction(
            id=transaction_ref,
            merchant_id=merchant_id,
            order_id=transaction_ref,
            buyer_name="PayPal customer",
            buyer_email="",
            amount=0.0,
            currency="USD",
            status="completed",
            payment_method="PayPal",
            items=[],
            shipping_address={},
        )
        db.add(transaction)
        result.transactions_created += 1
    else:
        result.transactions_updated += 1

    if capture_fields is not None:
        if capture_fields["amount"] is not None:
            transaction.amount = capture_fields["amount"]
        transaction.currency = capture_fields["currency"]
        if transaction.status == "completed" or created:
            transaction.status = capture_fields["status"]
        if capture_fields["created_at"] is not None:
            transaction.created_at = capture_fields["created_at"]
    elif created and dispute_fields["amount"] is not None:
        transaction.amount = dispute_fields["amount"]
        transaction.currency = dispute_fields["currency"]

    if capture_fields is not None and capture_fields["order_ref"]:
        transaction.order_id = str(capture_fields["order_ref"])[:32]
    if order_fields is not None:
        if order_fields["buyer_name"]:
            transaction.buyer_name = order_fields["buyer_name"][:120]
        if order_fields["buyer_email"]:
            transaction.buyer_email = order_fields["buyer_email"][:320]
        if order_fields["items"]:
            transaction.items = order_fields["items"]
        if order_fields["shipping_address"]:
            transaction.shipping_address = order_fields["shipping_address"]
    if not transaction.shipping_address:
        transaction.shipping_address = {
            "name": transaction.buyer_name,
            "line1": "",
            "line2": "",
            "country": "",
        }
    return transaction


def _upsert_dispute(
    db: Session,
    merchant_id: int,
    transaction: Transaction,
    fields: dict,
    order_fields: dict | None,
    result: SyncResult,
) -> None:
    dispute = db.get(Dispute, fields["dispute_id"])
    buyer_name = (
        (order_fields or {}).get("buyer_name") or transaction.buyer_name
    )
    buyer_email = (
        (order_fields or {}).get("buyer_email") or transaction.buyer_email
    )

    if dispute is None:
        dispute = Dispute(
            id=fields["dispute_id"],
            merchant_id=merchant_id,
            transaction_id=transaction.id,
            order_id=transaction.order_id,
            buyer_name=buyer_name,
            buyer_email=buyer_email,
            reason=fields["reason"],
            amount=fields["amount"] if fields["amount"] is not None else transaction.amount,
            currency=fields["currency"],
            status=fields["status"],
            priority=nz.derive_priority(fields["status"], fields["amount"], fields["due_at"]),
            required_evidence=4,
            opened_at=fields["opened_at"],
            due_at=fields["due_at"],
            resolved_at=fields["resolved_at"],
        )
        db.add(dispute)
        db.flush()
        db.add(
            ActivityEvent(
                dispute_id=dispute.id,
                type="import",
                label="Imported from PayPal",
                detail=f"{fields['reason']} · {dispute.amount:.2f} {fields['currency']}",
                occurred_at=fields["opened_at"],
            )
        )
        result.created += 1
        return

    result.updated += 1
    dispute.reason = fields["reason"]
    dispute.status = fields["status"]
    dispute.priority = nz.derive_priority(
        fields["status"], fields["amount"], fields["due_at"]
    )
    if fields["amount"] is not None:
        dispute.amount = fields["amount"]
    dispute.currency = fields["currency"]
    dispute.due_at = fields["due_at"]
    dispute.resolved_at = fields["resolved_at"]
    if dispute.buyer_name in {"", "PayPal customer"} and buyer_name:
        dispute.buyer_name = buyer_name
    if not dispute.buyer_email and buyer_email:
        dispute.buyer_email = buyer_email


def _record_refund_event(db: Session, fields: dict) -> None:
    existing = db.scalar(
        select(ActivityEvent.id).where(
            ActivityEvent.dispute_id == fields["dispute_id"],
            ActivityEvent.type == "paypal_refund",
        )
    )
    if existing is not None:
        return
    db.add(
        ActivityEvent(
            dispute_id=fields["dispute_id"],
            type="paypal_refund",
            label="Refund issued via PayPal",
            detail=f"Refund {fields['refund_id']} recorded by the PayPal sync.",
            occurred_at=fields["refund_time"] or utcnow(),
        )
    )
