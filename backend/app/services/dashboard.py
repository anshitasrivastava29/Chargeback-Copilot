from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.timeutils import to_ms, utcnow
from app.models.dispute import Dispute
from app.services import case_context
from app.services.dispute_service import evidence_summary, serialize_summary


def _merchant_disputes(
    db: Session, merchant_id: int, days: int | None = None
) -> list[Dispute]:
    statement = (
        select(Dispute)
        .where(Dispute.merchant_id == merchant_id)
        .options(selectinload(Dispute.evidence_files))
    )
    if days is not None:
        statement = statement.where(
            Dispute.opened_at >= utcnow() - timedelta(days=days)
        )
    return list(db.scalars(statement).all())


def build_pending_actions(disputes: list[Dispute], limit: int = 20) -> list[dict]:
    actions = []

    for dispute in disputes:
        if dispute.status != "open":
            continue

        evidence = evidence_summary(dispute)
        missing = evidence["missing"]

        if missing:
            action_type = "evidence"
            title = f"Upload {missing[0].lower()}"
        elif dispute.reason == "Duplicate charge":
            action_type = "decision"
            title = "Decide on duplicate charge claim"
        else:
            action_type = "response"
            title = f"Respond to {dispute.reason.lower()} claim"

        actions.append(
            {
                "id": f"PA-{dispute.id.rsplit('-', 1)[-1]}-{action_type}",
                "dispute_id": dispute.id,
                "type": action_type,
                "title": title,
                "dispute": serialize_summary(dispute),
                "due": case_context.due_info(to_ms(dispute.due_at)),
            }
        )

    actions.sort(
        key=lambda action: (
            action["due"]["days"] if action["due"] else 999,
            action["id"],
        )
    )
    return actions[:limit]


def pending_actions(db: Session, merchant_id: int, limit: int = 20) -> list[dict]:
    return build_pending_actions(_merchant_disputes(db, merchant_id), limit=limit)


def dashboard_stats(db: Session, merchant_id: int, days: int | None = None) -> dict:
    disputes = _merchant_disputes(db, merchant_id, days=days)

    open_disputes = [item for item in disputes if item.status == "open"]
    won_disputes = [item for item in disputes if item.status == "won"]
    lost_disputes = [item for item in disputes if item.status == "lost"]
    resolved = len(won_disputes) + len(lost_disputes)

    actions = build_pending_actions(disputes, limit=100)
    overdue = [
        action
        for action in actions
        if action["due"] and action["due"]["days"] < 0
    ]

    return {
        "total": len(disputes),
        "open": len(open_disputes),
        "won": len(won_disputes),
        "lost": len(lost_disputes),
        "win_rate": round((len(won_disputes) / resolved) * 100) if resolved else 0,
        "open_value": round(sum(float(item.amount) for item in open_disputes), 2),
        "won_value": round(sum(float(item.amount) for item in won_disputes), 2),
        "lost_value": round(sum(float(item.amount) for item in lost_disputes), 2),
        "reasons": len({item.reason for item in disputes}),
        "pending_actions": len(actions),
        "overdue_actions": len(overdue),
    }
