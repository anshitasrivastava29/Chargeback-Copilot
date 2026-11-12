import re

from app.core.timeutils import format_date
from app.models.dispute import Dispute
from app.services.ai.evidence_analyzer import EvidenceAnalysis

_ORDER_ID = re.compile(r"\bAC-\d{4,6}\b")
_TRANSACTION_ID = re.compile(r"\b[0-9A-Z]{17}\b")


def next_step(
    dispute: Dispute,
    analysis: EvidenceAnalysis,
    tracking: dict,
) -> str:
    if dispute.status != "open":
        return "No action required. Keep this case record for future evidence reviews."

    deadline = format_date(dispute.due_at)

    if analysis.missing_types:
        return (
            f"Upload {analysis.missing_types[0].lower()} before {deadline} "
            "to close the evidence gap."
        )

    if analysis.critical_signal_count:
        signal = next(
            item for item in analysis.signals if item["severity"] == "critical"
        )
        return (
            f"Resolve the document issue ({signal['message'].rstrip('.')}) "
            f"before {deadline}."
        )

    reason = dispute.reason
    if reason == "Duplicate charge":
        return f"Approve the queued refund before {deadline} to resolve the duplicate charge."
    if reason == "Subscription canceled":
        return f"Share the cancellation record and refund timeline before {deadline}."
    if reason == "Credit not processed":
        return f"Send the buyer the refund trace ID and processing window before {deadline}."
    if reason == "Unauthorized transaction":
        return (
            "Submit transaction verification and the delivery signature "
            f"before {deadline}."
        )
    if reason == "Item not as described":
        return f"Request item photos or offer a partial refund before {deadline}."

    if tracking.get("available") and tracking.get("tone") == "emerald":
        return (
            f"Submit proof of delivery with the signature record before {deadline}."
        )
    return f"Provide a carrier update or issue a refund before {deadline}."


def build_heuristic_draft(
    dispute: Dispute,
    analysis: EvidenceAnalysis,
    tracking: dict,
    refund: dict,
    merchant_name: str,
) -> str:
    first_name = dispute.buyer_name.split(" ")[0]
    evidence_names = [citation["file_name"] for citation in analysis.citations]
    evidence_line = (
        "We have attached the following records for PayPal's review: "
        f"{', '.join(evidence_names)}."
        if evidence_names
        else "We are gathering the supporting order records for this case."
    )

    facts: list[str] = []
    if tracking.get("available"):
        if tracking.get("tone") == "emerald":
            facts.append(
                f"Carrier tracking shows the shipment was delivered on "
                f"{format_date(_from_ms(tracking.get('delivered_at')))}"
                + (
                    f" and signed for ({tracking['signed_by']})"
                    if tracking.get("signed_by")
                    else ""
                )
                + "."
            )
        else:
            facts.append(
                "The shipment is still in transit and we have requested a carrier trace."
            )

    if refund.get("key") == "pending":
        facts.append(
            "A refund for this charge is already queued and will settle within 3–5 business days."
        )
    elif refund.get("key") == "issued":
        facts.append(
            f"A refund was issued on {format_date(_from_ms(refund.get('date')))}; "
            "we are sharing the trace details so the buyer can locate it."
        )

    fact_block = f"\n\n{' '.join(facts)}" if facts else ""

    return (
        f"Hi {first_name},\n\n"
        f"Thank you for contacting us about order {dispute.order_id}. We have reviewed "
        f"transaction {dispute.transaction_id} and your concern regarding "
        f"{dispute.reason.lower()}.\n\n"
        f"Our records show that this order was processed and fulfilled as described "
        f"at checkout. {evidence_line}{fact_block}\n\n"
        "We are happy to help resolve any remaining concern directly. Please reply "
        "with any additional details and we will review them promptly.\n\n"
        "Best regards,\n"
        f"{merchant_name} Support"
    )


def build_llm_prompt(
    dispute: Dispute,
    analysis: EvidenceAnalysis,
    tracking: dict,
    refund: dict,
    merchant_name: str,
) -> tuple[str, str]:
    system = (
        "You are a PayPal chargeback response assistant for a merchant. Write a "
        "professional, concise dispute response. Use ONLY the supplied case facts "
        "and evidence. Never invent order numbers, transaction IDs, dates, tracking "
        "numbers, or policies. Cite attached evidence by filename. Do not promise "
        "refunds unless the facts say a refund was issued or queued. Plain text, no "
        "markdown, no emojis, maximum 2200 characters. Sign with the merchant name."
    )
    evidence = [
        {
            "type": citation["evidence_type"],
            "file": citation["file_name"],
            "excerpt": citation.get("excerpt"),
        }
        for citation in analysis.citations
    ]
    user = (
        f"Merchant: {merchant_name}\n"
        f"Dispute ID: {dispute.id}\n"
        f"Buyer first name: {dispute.buyer_name.split(' ')[0]}\n"
        f"Order ID: {dispute.order_id}\n"
        f"Transaction ID: {dispute.transaction_id}\n"
        f"Reason: {dispute.reason}\n"
        f"Amount: {dispute.amount} {dispute.currency}\n"
        f"Response deadline: {format_date(dispute.due_at)}\n"
        f"Evidence attached: {evidence}\n"
        f"Tracking facts: {tracking}\n"
        f"Refund facts: {refund}\n"
        f"Evidence gaps: {analysis.missing_types}\n"
        "Write the response body only."
    )
    return system, user


def validate_llm_draft(draft: str, dispute: Dispute) -> bool:
    text = draft.strip()
    if not (120 <= len(text) <= 4000):
        return False

    known_order_ids = {dispute.order_id}
    known_transaction_ids = {dispute.transaction_id}

    for match in _ORDER_ID.findall(text):
        if match not in known_order_ids:
            return False

    return all(
        match in known_transaction_ids for match in _TRANSACTION_ID.findall(text)
    )


def _from_ms(value: int | None):
    if value is None:
        return None
    from datetime import datetime

    return datetime.fromtimestamp(value / 1000)
