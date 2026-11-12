"""Aggregate reporting for the Reports workspace.

Everything is computed from the same dispute/evidence rows that power the
inbox and dashboard, so the numbers always reconcile with the case pages.
"""

from collections import Counter
from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.timeutils import to_ms, utcnow
from app.models.dispute import Dispute
from app.services.ai.evidence_analyzer import (
    completed_types_for,
    required_types_for,
)


def _merchant_disputes(
    db: Session, merchant_id: int, days: int | None
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


def _average(values: list[float]) -> float | None:
    if not values:
        return None
    return round(sum(values) / len(values), 1)


def _resolution_days(dispute: Dispute) -> float | None:
    if dispute.resolved_at is None:
        return None
    return (dispute.resolved_at - dispute.opened_at).total_seconds() / 86400


def _response_days(dispute: Dispute) -> float | None:
    if dispute.submitted_at is None:
        return None
    return (dispute.submitted_at - dispute.opened_at).total_seconds() / 86400


def reports_summary(
    db: Session, merchant_id: int, days: int | None = None
) -> dict:
    disputes = _merchant_disputes(db, merchant_id, days)
    now = utcnow()

    open_disputes = [item for item in disputes if item.status == "open"]
    won_disputes = [item for item in disputes if item.status == "won"]
    lost_disputes = [item for item in disputes if item.status == "lost"]
    resolved = len(won_disputes) + len(lost_disputes)

    total_value = sum(float(item.amount) for item in disputes)
    open_value = sum(float(item.amount) for item in open_disputes)
    won_value = sum(float(item.amount) for item in won_disputes)
    lost_value = sum(float(item.amount) for item in lost_disputes)

    reason_rows: dict[str, dict] = {}
    month_rows: dict[str, dict] = {}
    missing_counter: Counter[str] = Counter()

    documents = 0
    required_total = 0
    completed_total = 0
    needs_attention = 0
    disputes_with_gaps = 0

    for dispute in disputes:
        amount = float(dispute.amount)
        reason = reason_rows.setdefault(
            dispute.reason,
            {
                "reason": dispute.reason,
                "total": 0,
                "open": 0,
                "won": 0,
                "lost": 0,
                "amount": 0.0,
                "openAmount": 0.0,
                "lostAmount": 0.0,
                "durations": [],
            },
        )
        reason["total"] += 1
        reason["amount"] += amount
        if dispute.status in {"open", "won", "lost"}:
            reason[dispute.status] += 1
        if dispute.status == "open":
            reason["openAmount"] += amount
        if dispute.status == "lost":
            reason["lostAmount"] += amount
        duration = _resolution_days(dispute)
        if duration is not None:
            reason["durations"].append(duration)

        month_key = dispute.opened_at.strftime("%Y-%m")
        month = month_rows.setdefault(
            month_key,
            {
                "month": month_key,
                "label": dispute.opened_at.strftime("%b"),
                "total": 0,
                "open": 0,
                "won": 0,
                "lost": 0,
                "amount": 0.0,
                "wonValue": 0.0,
                "lostValue": 0.0,
            },
        )
        month["total"] += 1
        month["amount"] += amount
        if dispute.status in {"open", "won", "lost"}:
            month[dispute.status] += 1
        if dispute.status == "won":
            month["wonValue"] += amount
        if dispute.status == "lost":
            month["lostValue"] += amount

        files = list(dispute.evidence_files)
        documents += len(files)
        needs_attention += sum(
            1
            for file in files
            if file.status != "ready" or file.extraction_status == "failed"
        )

        required = required_types_for(dispute)
        completed = completed_types_for(files, required)
        missing = [item for item in required if item not in completed]
        required_total += len(required)
        completed_total += len(completed)
        if missing:
            disputes_with_gaps += 1
            missing_counter.update(missing)

    reason_list = []
    for row in reason_rows.values():
        resolved_for_reason = row["won"] + row["lost"]
        reason_list.append(
            {
                "reason": row["reason"],
                "total": row["total"],
                "open": row["open"],
                "won": row["won"],
                "lost": row["lost"],
                "winRate": (
                    round((row["won"] / resolved_for_reason) * 100)
                    if resolved_for_reason
                    else 0
                ),
                "amount": round(row["amount"], 2),
                "openAmount": round(row["openAmount"], 2),
                "lostAmount": round(row["lostAmount"], 2),
                "averageResolutionDays": _average(row["durations"]),
            }
        )
    reason_list.sort(key=lambda row: (-row["total"], row["reason"]))

    monthly = [month_rows[key] for key in sorted(month_rows)]
    for row in monthly:
        row["amount"] = round(row["amount"], 2)
        row["wonValue"] = round(row["wonValue"], 2)
        row["lostValue"] = round(row["lostValue"], 2)

    overdue = 0
    due_soon = 0
    due_soon_value = 0.0
    for dispute in open_disputes:
        if dispute.due_at is None:
            continue
        remaining = (dispute.due_at.date() - now.date()).days
        if remaining < 0:
            overdue += 1
        elif remaining <= 7:
            due_soon += 1
            due_soon_value += float(dispute.amount)

    resolved_durations = [
        value
        for value in (_resolution_days(item) for item in won_disputes + lost_disputes)
        if value is not None
    ]
    response_durations = [
        value
        for value in (_response_days(item) for item in disputes)
        if value is not None
    ]
    coverage = (
        round((completed_total / required_total) * 100) if required_total else 0
    )

    return {
        "range_days": days,
        "generated_at": to_ms(now),
        "totals": {
            "total": len(disputes),
            "open": len(open_disputes),
            "won": len(won_disputes),
            "lost": len(lost_disputes),
            "resolved": resolved,
            "win_rate": round((len(won_disputes) / resolved) * 100) if resolved else 0,
            "open_value": round(open_value, 2),
            "won_value": round(won_value, 2),
            "lost_value": round(lost_value, 2),
            "average_dispute_value": (
                round(total_value / len(disputes), 2) if disputes else 0.0
            ),
        },
        "resolution": {
            "average_days": _average(resolved_durations),
            "resolved_count": resolved,
            "submitted_count": len(response_durations),
            "average_response_days": _average(response_durations),
        },
        "reasons": reason_list,
        "monthly": monthly,
        "evidence": {
            "documents": documents,
            "required": required_total,
            "completed": completed_total,
            "gaps": required_total - completed_total,
            "coverage_percent": coverage,
            "needs_attention": needs_attention,
            "disputes_with_gaps": disputes_with_gaps,
        },
        "top_gaps": [
            {"evidence_type": evidence_type, "count": count}
            for evidence_type, count in missing_counter.most_common(5)
        ],
        "deadlines": {
            "overdue": overdue,
            "due_soon": due_soon,
            "due_soon_value": round(due_soon_value, 2),
            "open_value": round(open_value, 2),
        },
    }
