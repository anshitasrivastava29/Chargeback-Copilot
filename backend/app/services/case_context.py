"""Deterministic case-context builders.

The frontend demo derives customer, order, tracking, and refund context from the
dispute record. These ports keep the API payload identical in shape and intent
so the UI can move off its local mocks without rendering changes.
"""

from datetime import datetime, timedelta

from app.core.timeutils import format_date, to_ms
from app.models.dispute import Dispute

DAY = timedelta(days=1)

LOCATIONS = [
    {"city": "San Francisco", "state": "CA", "zip": "94107", "area": "415"},
    {"city": "Austin", "state": "TX", "zip": "78704", "area": "512"},
    {"city": "Seattle", "state": "WA", "zip": "98109", "area": "206"},
    {"city": "Chicago", "state": "IL", "zip": "60614", "area": "312"},
    {"city": "Denver", "state": "CO", "zip": "80205", "area": "303"},
    {"city": "Boston", "state": "MA", "zip": "02118", "area": "617"},
    {"city": "Portland", "state": "OR", "zip": "97209", "area": "503"},
    {"city": "Nashville", "state": "TN", "zip": "37203", "area": "615"},
]

STREETS = [
    "Market Street",
    "Cedar Avenue",
    "Maple Drive",
    "Sunset Boulevard",
    "Oak Lane",
    "Harbor Way",
    "Willow Court",
    "Lakeview Terrace",
]

PAYMENT_METHODS = [
    "PayPal · Visa ending 4242",
    "PayPal · Mastercard ending 8812",
    "PayPal · Amex ending 1005",
    "PayPal balance",
]

CARRIERS = ["UPS", "USPS", "FedEx", "DHL Express"]

PRODUCTS = {
    "Item not received": [
        "AeroFit Wireless Headphones",
        "Trail Runner GTX Shoes",
        "Portable Espresso Maker",
        "Mechanical Keyboard K2",
        "Smart Home Hub Mini",
    ],
    "Item not as described": [
        "Linen Blend Overshirt",
        "Ceramic Pour-Over Set",
        "Studio Desk Lamp",
        "Merino Crew Sweater",
        "Everyday Tote Bag",
    ],
    "Unauthorized transaction": [
        "Noise-Canceling Earbuds",
        "Smart Home Hub Mini",
        "Classic Leather Wallet",
        "AeroFit Wireless Headphones",
    ],
    "Duplicate charge": [
        "Merino Crew Sweater",
        "Everyday Tote Bag",
        "Ceramic Pour-Over Set",
    ],
    "Subscription canceled": ["Commerce Pro — Monthly plan"],
    "Credit not processed": ["Classic Leather Wallet"],
}


def hash_value(value: str) -> int:
    result = 0
    for char in value:
        result = (result * 31 + ord(char)) % 99991
    return result


def _code(seed: int, length: int) -> str:
    alphabet = "0123456789ABCDEFGHJKLMNPQRSTUVWXYZ"
    value = seed + 104729
    result = ""
    for _ in range(length):
        value = (value * 48271 + 11) % 2147483647
        result += alphabet[value % len(alphabet)]
    return result


def _numeric(seed: int, length: int) -> str:
    return str((seed + 7919) * 104729 + 100_000_000_000)[-length:]


def _pick(values: list, seed: int, offset: int = 0) -> str:
    return values[(seed + offset) % len(values)]


def _round_currency(value: float) -> float:
    return round(value + 1e-9, 2)


def _get_location(dispute: Dispute) -> dict:
    return LOCATIONS[hash_value(dispute.id) % len(LOCATIONS)]


def shipping_address(dispute: Dispute) -> dict:
    seed = hash_value(dispute.id)
    location = _get_location(dispute)
    return {
        "name": dispute.buyer_name,
        "line1": f"{101 + ((seed * 13) % 890)} {_pick(STREETS, seed, 3)}",
        "line2": f"{location['city']}, {location['state']} {location['zip']}",
        "country": "United States",
    }


def _build_items(dispute: Dispute, subtotal: float, seed: int) -> list[dict]:
    options = PRODUCTS.get(dispute.reason, PRODUCTS["Item not received"])
    single_item = dispute.reason in {"Subscription canceled", "Credit not processed"}
    two_items = not single_item and subtotal >= 120 and seed % 3 == 1
    name = _pick(options, seed, 3)

    if not two_items:
        return [
            {
                "name": name,
                "sku": f"SKU-{_code(seed, 5)}",
                "quantity": 1,
                "total": subtotal,
            }
        ]

    second = _pick(options, seed, 5)
    if second == name:
        second = _pick(options, seed, 6)
    first_total = _round_currency(subtotal * 0.62)
    second_total = _round_currency(subtotal - first_total)
    return [
        {
            "name": name,
            "sku": f"SKU-{_code(seed, 5)}",
            "quantity": 1,
            "total": first_total,
        },
        {
            "name": second,
            "sku": f"SKU-{_code(seed + 41, 5)}",
            "quantity": 1,
            "total": second_total,
        },
    ]


def customer_profile(dispute: Dispute) -> dict:
    seed = hash_value(dispute.id)
    location = _get_location(dispute)
    member_since = dispute.opened_at - timedelta(days=240 + (seed % 720))
    return {
        "id": f"CUS-{70000 + (seed % 29999)}",
        "phone": f"+1 ({location['area']}) 555-01{str(10 + (seed % 90))[:2]}",
        "member_since": member_since.strftime("%b %Y"),
        "lifetime_orders": 3 + (seed % 24),
        "email_verified": True,
        "address": shipping_address(dispute),
    }


def order_details(dispute: Dispute) -> dict:
    seed = hash_value(dispute.id)
    amount = float(dispute.amount)
    placed_at = dispute.opened_at - timedelta(days=7 + (seed % 8))
    digital = dispute.reason == "Subscription canceled"
    shipping = 0.0 if digital or amount >= 250 else 9.99
    tax = 0.0 if digital else _round_currency((amount - shipping) * 0.0825)
    subtotal = _round_currency(amount - shipping - tax)

    return {
        "id": dispute.order_id,
        "placed_at": to_ms(placed_at),
        "transaction_id": dispute.transaction_id,
        "payment_method": _pick(PAYMENT_METHODS, seed, 1),
        "items": _build_items(dispute, subtotal, seed),
        "subtotal": subtotal,
        "shipping": shipping,
        "tax": tax,
        "tax_included": digital,
        "total": amount,
        "shipping_address": shipping_address(dispute),
    }


def _tracking_number(carrier: str, seed: int) -> str:
    if carrier == "UPS":
        return f"1Z{_code(seed, 14)}"
    if carrier == "USPS":
        return (
            f"9400 1000 0000 {_numeric(seed, 4)} "
            f"{_numeric(seed + 7, 4)} {_numeric(seed + 13, 2)}"
        )
    if carrier == "FedEx":
        return _numeric(seed, 12)
    return f"JD{_numeric(seed, 9)}"


def tracking_info(dispute: Dispute, uploaded: int) -> dict:
    seed = hash_value(dispute.id)
    has_shipment = dispute.reason in {
        "Item not received",
        "Item not as described",
        "Unauthorized transaction",
    }

    if not has_shipment:
        notes = {
            "Duplicate charge": (
                f"This charge duplicates order {dispute.order_id}. The original "
                "shipment was delivered; no second shipment exists."
            ),
            "Subscription canceled": (
                "Recurring subscription charge — there is no physical shipment to track."
            ),
            "Credit not processed": (
                "This dispute concerns a refund credit. There is no outbound shipment attached to it."
            ),
        }
        return {
            "available": False,
            "note": notes.get(dispute.reason, "No shipment is attached to this charge."),
        }

    placed_at = dispute.opened_at - timedelta(days=7 + (seed % 8))
    delivered = uploaded >= 2 if dispute.reason == "Item not received" else True
    carrier = _pick(CARRIERS, seed)
    shipped_at = placed_at + DAY
    delivered_at = placed_at + timedelta(days=5) if delivered else None
    estimated_at = None if delivered else placed_at + timedelta(days=6)

    events = [
        {"label": "Shipping label created", "date": to_ms(shipped_at), "tone": "done"},
        {"label": "Picked up by carrier", "date": to_ms(placed_at + timedelta(days=2)), "tone": "done"},
        {"label": "In transit", "date": to_ms(placed_at + timedelta(days=3)), "tone": "done"},
    ]
    if delivered:
        events.append({"label": "Delivered", "date": to_ms(delivered_at), "tone": "done"})
    else:
        events.append(
            {"label": "Estimated delivery (delayed)", "date": to_ms(estimated_at), "tone": "pending"}
        )

    note = "The carrier confirmed delivery to the buyer shipping address."
    if dispute.reason == "Item not received":
        note = (
            "Carrier tracking shows delivery, but the buyer reports the package was not received."
            if delivered
            else "The carrier has not confirmed delivery and the shipment is past its estimated delivery date."
        )
    elif dispute.reason == "Unauthorized transaction":
        note = "The order shipped to the address on file. Signature confirmation is available in the carrier record."

    return {
        "available": True,
        "carrier": carrier,
        "number": _tracking_number(carrier, seed),
        "status_label": "Delivered" if delivered else "In transit — delayed",
        "tone": "emerald" if delivered else "amber",
        "shipped_at": to_ms(shipped_at),
        "delivered_at": to_ms(delivered_at),
        "estimated_at": to_ms(estimated_at),
        "events": events,
        "signed_by": (
            "Signature on file"
            if delivered and dispute.reason == "Unauthorized transaction"
            else "Left at front door" if delivered else None
        ),
        "note": note,
    }


def refund_info(dispute: Dispute) -> dict:
    amount = float(dispute.amount)

    if dispute.status == "won":
        return {
            "key": "not-required",
            "label": "No refund required",
            "tone": "slate",
            "amount": None,
            "method": None,
            "date": None,
            "note": "This case was resolved in your favor. No refund is due.",
        }

    if dispute.status == "lost":
        return {
            "key": "refunded",
            "label": "Refunded",
            "tone": "emerald",
            "amount": amount,
            "method": "Original payment method",
            "date": to_ms(dispute.resolved_at + timedelta(days=2)) if dispute.resolved_at else None,
            "note": "A full refund was issued after the case closed. Funds typically settle within 3–5 business days.",
        }

    if dispute.reason == "Duplicate charge":
        return {
            "key": "pending",
            "label": "Refund pending",
            "tone": "amber",
            "amount": amount,
            "method": "Original payment method",
            "requested_at": to_ms(dispute.opened_at + DAY),
            "note": (
                "Payment records confirm a duplicate capture. The refund is queued "
                "and typically settles in 3–5 business days."
            ),
        }
    if dispute.reason == "Subscription canceled":
        return {
            "key": "pending",
            "label": "Refund pending",
            "tone": "amber",
            "amount": amount,
            "method": "Original payment method",
            "requested_at": to_ms(dispute.opened_at + DAY),
            "note": (
                "The cancellation is recorded in the account history. A full refund "
                "for the disputed billing period is queued."
            ),
        }
    if dispute.reason == "Credit not processed":
        return {
            "key": "issued",
            "label": "Refund issued",
            "tone": "emerald",
            "amount": amount,
            "method": "Original payment method",
            "date": to_ms(dispute.opened_at + timedelta(days=2)),
            "note": (
                "A full refund was issued, but the buyer reports it has not reached "
                "their account. Share the trace ID and processing window."
            ),
        }
    if dispute.reason == "Item not as described":
        return {
            "key": "offered",
            "label": "Partial refund offered",
            "tone": "amber",
            "amount": _round_currency(amount * 0.3),
            "method": "Original payment method",
            "requested_at": to_ms(dispute.opened_at + DAY),
            "note": "A 30% partial refund was offered for the condition issue. The buyer has not accepted.",
        }
    if dispute.reason == "Unauthorized transaction":
        return {
            "key": "not-issued",
            "label": "No refund issued",
            "tone": "slate",
            "amount": None,
            "method": None,
            "note": "No refund is issued while the unauthorized transaction review is open.",
        }

    return {
        "key": "not-issued",
        "label": "No refund issued",
        "tone": "slate",
        "amount": None,
        "method": None,
        "note": "No refund has been issued. Issuing a full refund now would close this case in the buyer's favor.",
    }


def activity_items(dispute: Dispute, extra: list[dict] | None = None) -> list[dict]:
    items = [
        {
            "label": "Dispute opened",
            "date": to_ms(dispute.opened_at),
            "dot": "bg-slate-300",
        }
    ]
    if dispute.status == "open":
        items.append(
            {
                "label": "Response due",
                "date": to_ms(dispute.due_at),
                "dot": "bg-amber-500",
            }
        )
    else:
        items.append(
            {
                "label": "Dispute won" if dispute.status == "won" else "Dispute lost",
                "date": to_ms(dispute.resolved_at),
                "dot": "bg-emerald-500" if dispute.status == "won" else "bg-rose-500",
            }
        )

    for event in extra or []:
        items.append(
            {
                "label": event["label"],
                "date": to_ms(event["occurred_at"]),
                "dot": event.get("dot", "bg-sky-400"),
            }
        )

    return sorted(items, key=lambda item: item["date"] or 0)


def due_info(due_at_ms: int | None, now: datetime | None = None) -> dict | None:
    if due_at_ms is None:
        return None
    now = now or datetime.now()
    due = datetime.fromtimestamp(due_at_ms / 1000)
    days = (due.date() - now.date()).days
    if days < 0:
        return {"days": days, "label": f"{abs(days)}d overdue", "tone": "danger"}
    if days == 0:
        return {"days": days, "label": "Due today", "tone": "warning"}
    if days == 1:
        return {"days": days, "label": "Due tomorrow", "tone": "warning"}
    return {
        "days": days,
        "label": f"Due in {days}d",
        "tone": "warning" if days <= 3 else "neutral",
    }


def human_date(value: datetime | None) -> str:
    return format_date(value)
