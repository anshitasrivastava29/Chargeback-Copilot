from app.models.dispute import Dispute
from app.services.ai.constants import DEFAULT_PLAYBOOK, RECOMMENDATION_PLAYBOOK
from app.services.case_context import human_date


def recommendation_panel(dispute: Dispute, missing: list[str]) -> dict:
    if dispute.status == "won":
        return {
            "tone": "emerald",
            "title": "Closed in your favor",
            "body": (
                f"PayPal resolved this case on {human_date(dispute.resolved_at)} "
                "after reviewing the submitted evidence."
            ),
        }

    if dispute.status == "lost":
        return {
            "tone": "rose",
            "title": "Case closed against you",
            "body": (
                f"This dispute was decided on {human_date(dispute.resolved_at)}. "
                "Review the evidence you submitted to strengthen future responses."
            ),
        }

    if missing:
        suggestions = " or ".join(item.lower() for item in missing[:2])
        return {
            "tone": "amber",
            "title": "Evidence gap detected",
            "body": (
                f"{len(missing)} required evidence item"
                f"{'' if len(missing) == 1 else 's'} still missing. "
                f"Add {suggestions} before submitting your response."
            ),
        }

    return {
        "tone": "sky",
        "title": "Strong defense available",
        "body": (
            "Order and delivery records are complete. Submit a concise response "
            "before the deadline to keep the strongest position."
        ),
    }


def build_recommendations(
    dispute: Dispute,
    missing: list[str],
    signals: list[dict],
) -> list[dict]:
    if dispute.status == "won":
        return [
            {
                "title": "Archive the winning evidence set",
                "detail": (
                    "Reuse the order, delivery, and communication records as a "
                    "template for similar cases."
                ),
                "priority": "recommended",
            }
        ]

    if dispute.status == "lost":
        return [
            {
                "title": "Review the decision notes",
                "detail": (
                    f"Document why this {dispute.reason.lower()} case was lost and "
                    "which records were unavailable."
                ),
                "priority": "do-first",
            },
            {
                "title": "Update the evidence checklist",
                "detail": (
                    f"Add the missing {dispute.reason.lower()} records to the "
                    "standard response packet."
                ),
                "priority": "recommended",
            },
        ]

    recommendations: list[dict] = []

    if missing:
        shown = ", ".join(item.lower() for item in missing[:2])
        extra = f" and {len(missing) - 2} more" if len(missing) > 2 else ""
        recommendations.append(
            {
                "title": (
                    f"Close {len(missing)} evidence gap"
                    f"{'' if len(missing) == 1 else 's'}"
                ),
                "detail": f"Upload {shown}{extra}.",
                "priority": "do-first",
            }
        )

    critical = [signal for signal in signals if signal["severity"] == "critical"]
    if critical:
        recommendations.append(
            {
                "title": "Resolve a document inconsistency",
                "detail": (
                    f"{critical[0]['message']} Align the record with the disputed "
                    "case before submission."
                ),
                "priority": "do-first",
            }
        )

    playbook = RECOMMENDATION_PLAYBOOK.get(dispute.reason, DEFAULT_PLAYBOOK)
    recommendations.append(
        {
            "title": playbook["title"],
            "detail": playbook["detail"],
            "priority": "recommended" if missing else "do-first",
        }
    )

    recommendations.append(
        {
            "title": "Respond before the deadline",
            "detail": f"Submit the response by {human_date(dispute.due_at)}.",
            "priority": "deadline",
        }
    )

    return recommendations[:3]
