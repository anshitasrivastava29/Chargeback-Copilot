from app.core.timeutils import format_date
from app.models.dispute import Dispute
from app.services.ai.constants import BASE_WIN_LIKELIHOOD
from app.services.ai.evidence_analyzer import EvidenceAnalysis


def build_risk(
    dispute: Dispute,
    missing_count: int,
    due_days: int | None,
    critical_signals: int = 0,
) -> dict:
    if dispute.status == "won":
        return {
            "level": "low",
            "summary": (
                f"Resolved in your favor on {format_date(dispute.resolved_at)}. "
                "No further action is required."
            ),
        }

    if dispute.status == "lost":
        return {
            "level": "high",
            "summary": (
                f"Closed against you on {format_date(dispute.resolved_at)}. "
                "Use the record to improve future responses."
            ),
        }

    evidence_clause = (
        f"{missing_count} required evidence item"
        f"{'' if missing_count == 1 else 's'} still missing."
        if missing_count
        else "All required evidence is attached."
    )
    deadline_clause = (
        f" The response is {_due_label(due_days)}." if due_days is not None else ""
    )
    signal_clause = (
        f" {critical_signals} document consistency issue"
        f"{'' if critical_signals == 1 else 's'} needs review."
        if critical_signals
        else ""
    )

    if (
        dispute.priority == "high"
        or missing_count >= 2
        or (due_days is not None and due_days <= 1)
        or critical_signals > 0
    ):
        level = "high"
    elif (
        dispute.priority == "medium"
        or missing_count == 1
        or (due_days is not None and due_days <= 3)
    ):
        level = "medium"
    else:
        level = "low"

    if level == "low":
        return {
            "level": "low",
            "summary": f"{evidence_clause}{signal_clause} The case is defensible as submitted.",
        }

    return {
        "level": level,
        "summary": f"{evidence_clause}{deadline_clause}{signal_clause}",
    }


def _due_label(due_days: int | None) -> str:
    if due_days is None:
        return "not scheduled"
    if due_days < 0:
        return f"{abs(due_days)}d overdue"
    if due_days == 0:
        return "due today"
    if due_days == 1:
        return "due tomorrow"
    return f"due in {due_days}d"


def calculate_win_likelihood(
    dispute: Dispute,
    analysis: EvidenceAnalysis,
    tracking: dict,
    refund: dict,
) -> int | None:
    if dispute.status != "open":
        return None

    base = BASE_WIN_LIKELIHOOD.get(dispute.reason, 55)
    required = max(1, len(analysis.required_types))
    ratio = len(analysis.completed_types) / required
    score = base + round((ratio - 0.5) * 26)

    if tracking.get("available") and tracking.get("tone") == "emerald":
        score += 7
    if refund.get("key") == "pending":
        score += 4
    if refund.get("key") == "issued":
        score -= 6

    average_quality = analysis.average_quality
    if average_quality is not None:
        score += round((average_quality - 60) * 0.15)

    score -= analysis.critical_signal_count * 4

    return max(19, min(93, score))


def build_factors(
    dispute: Dispute,
    analysis: EvidenceAnalysis,
    tracking: dict,
    refund: dict,
) -> list[dict]:
    required = len(analysis.required_types)
    uploaded = len(analysis.completed_types)
    missing = len(analysis.missing_types)

    factors = [
        {
            "tone": "negative" if missing else "positive",
            "text": (
                f"{uploaded} of {required} required evidence items collected — "
                f"{missing} still missing"
                if missing
                else "All required evidence items collected"
            ),
        }
    ]

    if tracking.get("available"):
        factors.append(
            {
                "tone": "positive" if tracking.get("tone") == "emerald" else "negative",
                "text": (
                    f"Carrier tracking shows delivered on "
                    f"{_date_from_ms(tracking.get('delivered_at'))}"
                    if tracking.get("tone") == "emerald"
                    else "Carrier has not confirmed delivery for this shipment"
                ),
            }
        )
    elif dispute.reason == "Duplicate charge":
        factors.append(
            {
                "tone": "positive",
                "text": "Payment records confirm two captures for the same order",
            }
        )
    elif dispute.reason == "Subscription canceled":
        factors.append(
            {
                "tone": "positive",
                "text": "Cancellation request is logged in the account history",
            }
        )
    elif dispute.reason == "Credit not processed":
        factors.append(
            {
                "tone": "negative",
                "text": "Buyer reports the issued refund was never received",
            }
        )

    if dispute.reason == "Unauthorized transaction":
        factors.append(
            {"tone": "positive", "text": "AVS and CVV checks passed at checkout"}
        )
    elif dispute.reason == "Item not as described":
        factors.append(
            {"tone": "neutral", "text": "Buyer has not supplied photos of the item"}
        )
    elif dispute.reason == "Item not received" and tracking.get("available"):
        factors.append(
            {
                "tone": "positive" if tracking.get("tone") == "emerald" else "neutral",
                "text": (
                    "Delivery signature is available in the carrier record"
                    if tracking.get("tone") == "emerald"
                    else "Buyer confirms the shipping address on file is correct"
                ),
            }
        )
    elif refund.get("key") == "pending":
        factors.append(
            {"tone": "positive", "text": "Refund is queued and can close the case"}
        )

    for signal in analysis.signals:
        factors.append(
            {
                "tone": "negative" if signal["severity"] == "critical" else "neutral",
                "text": signal["message"],
            }
        )

    return factors[:4]


def _date_from_ms(value: int | None) -> str:
    if value is None:
        return "an unknown date"
    from datetime import datetime

    return format_date(datetime.fromtimestamp(value / 1000))
