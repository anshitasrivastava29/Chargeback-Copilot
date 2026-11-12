"""Normalize PayPal Disputes/Orders/Payments payloads into local field values.

All functions tolerate missing or unexpected fields: PayPal payload shapes vary
by dispute channel, lifecycle stage, and API version, and sandbox responses
frequently omit optional blocks.
"""

from datetime import UTC, datetime, timedelta

from app.core.timeutils import utcnow

# PayPal reason enum -> the six canonical reasons the classifier understands.
REASON_MAP = {
    "ITEM_NOT_RECEIVED": "Item not received",
    "MERCHANDISE_OR_SERVICE_NOT_RECEIVED": "Item not received",
    "GOODS_SERVICES_NOT_RECEIVED": "Item not received",
    "UNAUTHORIZED_TRANSACTION": "Unauthorized transaction",
    "UNAUTHORISED_TRANSACTION": "Unauthorized transaction",
    "PAYMENT_BY_OTHER_MEANS": "Unauthorized transaction",
    "ITEM_NOT_AS_DESCRIBED": "Item not as described",
    "MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED": "Item not as described",
    "SIGNIFICANTLY_NOT_AS_DESCRIBED": "Item not as described",
    "NOT_AS_DESCRIBED": "Item not as described",
    "DUPLICATE_TRANSACTION": "Duplicate charge",
    "DUPLICATE_CHARGE": "Duplicate charge",
    "CREDIT_NOT_PROCESSED": "Credit not processed",
    "REFUND_NOT_PROCESSED": "Credit not processed",
    "SUBSCRIPTION_CANCELED": "Subscription canceled",
    "SUBSCRIPTION_CANCELLED": "Subscription canceled",
    "SUBSCRIPTION_CANCELED_UNSUSPENDED": "Subscription canceled",
    "CANCELLED_RECURRING_PAYMENT": "Subscription canceled",
    "RECURRING_TRANSACTION_DISPUTED": "Subscription canceled",
}
DEFAULT_REASON = "Item not as described"

CAPTURE_STATUS_MAP = {
    "COMPLETED": "completed",
    "PENDING": "pending",
    "DECLINED": "declined",
    "PARTIALLY_REFUNDED": "refunded",
    "REFUNDED": "refunded",
}

RESPONSE_WINDOW_DAYS = 10


def normalize_reason(raw: object) -> str:
    key = raw.strip().upper() if isinstance(raw, str) else ""
    return REASON_MAP.get(key, DEFAULT_REASON)


def normalize_status(raw: object) -> str:
    """Map PayPal dispute_state to open/won/lost (merchant point of view)."""
    state = raw.strip().upper() if isinstance(raw, str) else ""
    if state in {"RESOLVED_SELLER_FAVOR", "RESOLVED_WITH_SELLER_PROTECTION"}:
        return "won"
    if state == "RESOLVED_BUYER_FAVOR":
        return "lost"
    # RESOLVED without a known outcome and any unknown state stay open so the
    # merchant reviews them instead of a wrong won/lost count.
    return "open"


def parse_paypal_time(raw: object) -> datetime | None:
    if not isinstance(raw, str) or not raw.strip():
        return None
    try:
        parsed = datetime.fromisoformat(raw.strip().replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is not None:
        parsed = parsed.astimezone(UTC).replace(tzinfo=None)
    return parsed


def _money(payload: object) -> tuple[float | None, str]:
    if not isinstance(payload, dict):
        return None, "USD"
    try:
        value = float(payload.get("value"))  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return None, "USD"
    currency = payload.get("currency_code") or payload.get("currency")
    return value, currency if isinstance(currency, str) and currency else "USD"


def _first(*values: object) -> object | None:
    for value in values:
        if isinstance(value, str) and value.strip():
            return value
        if value not in (None, "", [], {}):
            return value
    return None


def derive_priority(status: str, amount: float | None, due_at: datetime | None) -> str:
    if status in {"won", "lost"}:
        return "low"
    if due_at is not None:
        days = (due_at.date() - utcnow().date()).days
        if days <= 3:
            return "high"
        if days <= 7:
            return "medium"
    if amount is not None and amount >= 1000:
        return "high"
    if amount is not None and amount >= 250:
        return "medium"
    return "low"


def normalize_dispute(payload: dict) -> dict:
    """Map a dispute object (summary or detail) into local Dispute fields."""
    extensions = payload.get("extensions") or {}
    refund_details = payload.get("refund_details") or {}
    amount, currency = _money(payload.get("disputed_amount") or payload.get("dispute_amount"))
    opened_at = parse_paypal_time(payload.get("create_time")) or utcnow()
    due_at = parse_paypal_time(
        _first(
            extensions.get("response_required_by"),
            payload.get("seller_response_due_date"),
        )
    ) or opened_at + timedelta(days=RESPONSE_WINDOW_DAYS)
    status = normalize_status(_first(payload.get("dispute_state"), payload.get("status")))
    resolved_at = (
        parse_paypal_time(payload.get("update_time"))
        if status in {"won", "lost"}
        else None
    )
    disputed_transactions = payload.get("disputed_transactions")
    first_disputed_tx = None
    if isinstance(disputed_transactions, list) and disputed_transactions:
        candidate = disputed_transactions[0]
        if isinstance(candidate, dict):
            first_disputed_tx = candidate
    transaction_ref = _first(
        payload.get("seller_transaction_id"),
        payload.get("buyer_transaction_id"),
        payload.get("transaction_id"),
        first_disputed_tx.get("seller_transaction_id")
        if first_disputed_tx
        else None,
        first_disputed_tx.get("buyer_transaction_id")
        if first_disputed_tx
        else None,
    )
    refund_id = _first(
        refund_details.get("refund_id"),
        refund_details.get("transaction_id"),
        refund_details.get("id"),
    ) if isinstance(refund_details, dict) else None

    return {
        "dispute_id": payload.get("dispute_id"),
        "reason": normalize_reason(payload.get("reason")),
        "status": status,
        "amount": amount,
        "currency": currency,
        "opened_at": opened_at,
        "due_at": due_at,
        "resolved_at": resolved_at,
        "transaction_ref": transaction_ref,
        "order_ref": _first(
            payload.get("checkout_order_id"),
            extensions.get("checkout_order_id") if isinstance(extensions, dict) else None,
        ),
        "refund_id": refund_id,
        "refund_time": parse_paypal_time(refund_details.get("create_time"))
        if isinstance(refund_details, dict)
        else None,
    }


def normalize_capture(payload: dict) -> dict:
    """Map a v2 payments capture into local Transaction fields."""
    amount, currency = _money(payload.get("amount"))
    status = CAPTURE_STATUS_MAP.get(payload.get("status") or "", "completed")
    order_ref = _first(payload.get("custom_id"), payload.get("invoice_id"), payload.get("id"))
    return {
        "transaction_id": payload.get("id"),
        "amount": amount,
        "currency": currency,
        "status": status,
        "order_ref": order_ref,
        "created_at": parse_paypal_time(payload.get("create_time")),
    }


def normalize_order(payload: dict) -> dict:
    """Map a v2 checkout order into buyer/items/shipping enrichment fields."""
    payer = payload.get("payer") or {}
    units = payload.get("purchase_units") or []
    first_unit = units[0] if units and isinstance(units[0], dict) else {}

    buyer_name = None
    payer_name = payer.get("name") or {}
    if isinstance(payer_name, dict):
        buyer_name = _first(
            " ".join(
                part
                for part in [payer_name.get("given_name"), payer_name.get("surname")]
                if isinstance(part, str) and part
            )
            or None
        )
    buyer_email = _first(payer.get("email_address"))

    items = []
    raw_items = first_unit.get("items") or []
    for raw_item in raw_items:
        if not isinstance(raw_item, dict):
            continue
        unit_amount, _ = _money(raw_item.get("unit_amount"))
        try:
            quantity = int(raw_item.get("quantity", 1))  # type: ignore[arg-type]
        except (TypeError, ValueError):
            quantity = 1
        total = round(unit_amount * quantity, 2) if unit_amount is not None else None
        name = _first(raw_item.get("name"))
        items.append(
            {
                "name": name or "Item",
                "sku": _first(raw_item.get("sku")) or "",
                "quantity": quantity,
                "total": total,
            }
        )

    shipping = {}
    raw_shipping = first_unit.get("shipping") or {}
    shipping_name = (raw_shipping.get("name") or {}).get("full_name")
    address = raw_shipping.get("address") or {}
    if isinstance(address, dict) and address:
        line2 = ", ".join(
            part
            for part in [
                address.get("admin_area_2"),
                address.get("admin_area_1"),
                address.get("postal_code"),
            ]
            if isinstance(part, str) and part
        )
        shipping = {
            "name": shipping_name or buyer_name or "",
            "line1": address.get("address_line_1") or "",
            "line2": line2,
            "country": address.get("country_code") or "",
        }

    return {
        "buyer_name": buyer_name,
        "buyer_email": buyer_email,
        "items": items,
        "shipping_address": shipping,
    }


def normalize_refund(payload: dict) -> dict:
    """Map a v2 payments refund into refund context fields."""
    amount, currency = _money(payload.get("amount"))
    return {
        "refund_id": payload.get("id"),
        "status": (payload.get("status") or "COMPLETED").lower(),
        "amount": amount,
        "currency": currency,
        "created_at": parse_paypal_time(payload.get("create_time")),
    }
