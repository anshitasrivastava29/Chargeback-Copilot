EVIDENCE_CATALOG: list[dict[str, str]] = [
    {
        "key": "Order confirmation",
        "label": "Order confirmation",
        "description": "Shows the items, price, and terms the buyer agreed to at checkout.",
    },
    {
        "key": "Proof of delivery",
        "label": "Proof of delivery",
        "description": "Carrier-confirmed delivery is the strongest rebuttal to a missing-item claim.",
    },
    {
        "key": "Customer communication",
        "label": "Customer communication",
        "description": "Shows the buyer was informed and had a chance to resolve the issue.",
    },
    {
        "key": "Refund & cancellation policy",
        "label": "Refund & cancellation policy",
        "description": "Documents the published terms and any refund already issued.",
    },
    {
        "key": "Transaction verification",
        "label": "Transaction verification",
        "description": "Links the payment to the buyer account, device, and authentication checks.",
    },
]

ADDITIONAL_EVIDENCE = "Additional supporting file"
ALLOWED_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png"]
ALLOWED_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png"}

CLASSIFICATION_BY_REASON: dict[str, dict] = {
    "Unauthorized transaction": {
        "category": "Fraud",
        "type": "Unauthorized payment",
        "confidence": 94,
    },
    "Item not received": {
        "category": "Consumer dispute",
        "type": "Merchandise not received",
        "confidence": 91,
    },
    "Item not as described": {
        "category": "Consumer dispute",
        "type": "Significantly not as described",
        "confidence": 89,
    },
    "Duplicate charge": {
        "category": "Processing error",
        "type": "Duplicate transaction",
        "confidence": 96,
    },
    "Subscription canceled": {
        "category": "Billing",
        "type": "Canceled recurring billing",
        "confidence": 92,
    },
    "Credit not processed": {
        "category": "Processing error",
        "type": "Credit not processed",
        "confidence": 90,
    },
}

CRITICAL_EVIDENCE: dict[str, list[str]] = {
    "Unauthorized transaction": ["Transaction verification", "Proof of delivery"],
    "Item not received": ["Proof of delivery"],
    "Item not as described": ["Order confirmation", "Customer communication"],
    "Duplicate charge": ["Transaction verification"],
    "Subscription canceled": ["Customer communication", "Refund & cancellation policy"],
    "Credit not processed": ["Transaction verification", "Refund & cancellation policy"],
}

BASE_WIN_LIKELIHOOD: dict[str, int] = {
    "Item not received": 58,
    "Unauthorized transaction": 46,
    "Item not as described": 64,
    "Duplicate charge": 80,
    "Subscription canceled": 72,
    "Credit not processed": 55,
}

RECOMMENDATION_PLAYBOOK: dict[str, dict] = {
    "Unauthorized transaction": {
        "title": "Reinforce payment authorization",
        "detail": "Attach AVS/CVV results, device fingerprint, and the delivery signature to show the buyer authorized the payment.",
    },
    "Item not received": {
        "title": "Lead with delivery proof",
        "detail": "Point to the carrier scan and signature, then restate the shipping address on file.",
    },
    "Item not as described": {
        "title": "Anchor the response in the listing",
        "detail": "Reference the original description, photos, and any buyer conversation about the item condition.",
    },
    "Duplicate charge": {
        "title": "Resolve the duplicate capture",
        "detail": "Confirm the second capture and approve the refund or attach the correction record.",
    },
    "Subscription canceled": {
        "title": "Show the cancellation timeline",
        "detail": "Attach the cancellation request and billing dates to show the charge predates it.",
    },
    "Credit not processed": {
        "title": "Provide the refund trace",
        "detail": "Share the refund reference, processor status, and expected settlement date.",
    },
}

DEFAULT_PLAYBOOK = {
    "title": "Respond with the case record",
    "detail": "Summarize the transaction and attach the strongest available evidence.",
}

REQUIRED_TYPES_BY_REASON: dict[str, list[str]] = {
    "Unauthorized transaction": [
        "Transaction verification",
        "Proof of delivery",
        "Order confirmation",
        "Customer communication",
        "Refund & cancellation policy",
    ],
    "Item not received": [
        "Order confirmation",
        "Proof of delivery",
        "Customer communication",
        "Transaction verification",
    ],
    "Item not as described": [
        "Order confirmation",
        "Customer communication",
        "Proof of delivery",
        "Refund & cancellation policy",
    ],
    "Duplicate charge": [
        "Transaction verification",
        "Order confirmation",
        "Customer communication",
        "Refund & cancellation policy",
    ],
    "Subscription canceled": [
        "Customer communication",
        "Refund & cancellation policy",
        "Transaction verification",
    ],
    "Credit not processed": [
        "Transaction verification",
        "Refund & cancellation policy",
        "Customer communication",
        "Order confirmation",
    ],
}

DOCUMENT_KEYWORDS: dict[str, tuple[str, ...]] = {
    "Proof of delivery": ("delivered", "delivery", "signature", "signed", "carrier", "tracking"),
    "Order confirmation": ("order", "invoice", "receipt", "sku", "total", "subtotal"),
    "Customer communication": ("message", "email", "reply", "conversation", "support", "buyer"),
    "Refund & cancellation policy": ("refund", "cancel", "cancellation", "policy", "return"),
    "Transaction verification": ("transaction", "capture", "authorization", "avs", "cvv", "payment"),
}

EVIDENCE_GAP_NOTES: dict[str, str] = {
    "Order confirmation": (
        "Shows the items, price, and terms the buyer agreed to at checkout."
    ),
    "Proof of delivery": (
        "Carrier-confirmed delivery is the strongest rebuttal to a missing-item claim."
    ),
    "Customer communication": (
        "Shows the buyer was informed and had a chance to resolve the issue."
    ),
    "Refund & cancellation policy": (
        "Documents the published terms and any refund already issued."
    ),
    "Transaction verification": (
        "Links the payment to the buyer account, device, and authentication checks."
    ),
}
