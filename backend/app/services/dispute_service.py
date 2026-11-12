from datetime import timedelta

from sqlalchemy import case, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.core.timeutils import to_ms, utcnow
from app.models.activity import ActivityEvent
from app.models.dispute import Dispute
from app.models.evidence import EvidenceFile
from app.models.response import ResponseDraft, ResponseSubmission
from app.services import case_context
from app.services.ai.evidence_analyzer import (
    completed_types_for,
    required_types_for,
)


class DisputeNotFoundError(LookupError):
    pass


class CaseClosedError(ValueError):
    pass


class AlreadySubmittedError(ValueError):
    pass


def load_dispute(db: Session, dispute_id: str, merchant_id: int) -> Dispute:
    dispute = db.scalars(
        select(Dispute)
        .where(Dispute.id == dispute_id, Dispute.merchant_id == merchant_id)
        .options(
            selectinload(Dispute.evidence_files),
            selectinload(Dispute.response_draft),
            selectinload(Dispute.activities),
        )
    ).first()
    if dispute is None:
        raise DisputeNotFoundError(dispute_id)
    return dispute


def evidence_summary(dispute: Dispute) -> dict:
    required = required_types_for(dispute)
    completed = completed_types_for(list(dispute.evidence_files), required)
    return {
        "uploaded": len(completed),
        "required": len(required),
        "missing": [item for item in required if item not in completed],
        "completed": completed,
    }


def serialize_summary(dispute: Dispute) -> dict:
    return {
        "id": dispute.id,
        "buyer": {"name": dispute.buyer_name, "email": dispute.buyer_email},
        "reason": dispute.reason,
        "amount": float(dispute.amount),
        "currency": dispute.currency,
        "status": dispute.status,
        "priority": dispute.priority,
        "opened_at": to_ms(dispute.opened_at),
        "due_at": to_ms(dispute.due_at),
        "resolved_at": to_ms(dispute.resolved_at),
        "evidence": evidence_summary(dispute),
        "transaction_id": dispute.transaction_id,
        "order_id": dispute.order_id,
    }


def serialize_file(file: EvidenceFile, base_url: str | None = None) -> dict:
    # Stored uploads are served by an authenticated, ownership-checked endpoint.
    # ``<img>``/``<iframe>`` cannot attach a Bearer token, so the frontend
    # fetches uploads as blobs through its API client; only seeded demo records
    # (which point at public frontend assets) carry a preview URL.
    preview_url = file.preview_url

    return {
        "id": file.id,
        "name": file.file_name,
        "size": file.size_bytes,
        "mime": file.mime_type,
        "preview_url": preview_url,
        "evidence_type": file.evidence_type,
        "status": file.status,
        "uploaded_at": to_ms(file.uploaded_at),
        "source": file.source,
        "error": file.error,
        "extraction_status": file.extraction_status,
        "quality_score": file.quality_score,
        "extracted_fields": file.extracted_fields or {},
    }


def serialize_detail(
    dispute: Dispute, base_url: str | None = None
) -> dict:
    summary = serialize_summary(dispute)
    evidence = summary["evidence"]
    tracking = case_context.tracking_info(dispute, evidence["uploaded"])
    extra_activity = [
        {
            "label": event.label,
            "occurred_at": event.occurred_at,
            "dot": _dot_for(event.type),
        }
        for event in dispute.activities
    ]

    detail = {
        **summary,
        "customer": case_context.customer_profile(dispute),
        "order": case_context.order_details(dispute),
        "tracking": tracking,
        "refund": case_context.refund_info(dispute),
        "activity": case_context.activity_items(dispute, extra_activity),
        "evidence_files": [
            serialize_file(file, base_url)
            for file in sorted(dispute.evidence_files, key=lambda item: item.uploaded_at)
        ],
        "submitted_at": to_ms(dispute.submitted_at),
    }
    return detail


def _dot_for(event_type: str) -> str:
    return {
        "evidence": "bg-sky-400",
        "draft": "bg-violet-400",
        "submission": "bg-emerald-500",
    }.get(event_type, "bg-slate-300")


def _base_filters(
    merchant_id: int,
    reason: str | None,
    priority: str | None,
    query: str | None,
    days: int | None,
) -> list:
    filters = [Dispute.merchant_id == merchant_id]

    if reason and reason != "all":
        filters.append(Dispute.reason == reason)
    if priority and priority != "all":
        filters.append(Dispute.priority == priority)
    if days is not None:
        filters.append(Dispute.opened_at >= utcnow() - timedelta(days=days))
    if query:
        needle = f"%{query.strip().lower()}%"
        filters.append(
            or_(
                func.lower(Dispute.id).like(needle),
                func.lower(Dispute.buyer_name).like(needle),
                func.lower(Dispute.buyer_email).like(needle),
                func.lower(Dispute.reason).like(needle),
                func.lower(Dispute.order_id).like(needle),
                func.lower(Dispute.transaction_id).like(needle),
            )
        )
    return filters


def _order_by(sort: str):
    if sort == "oldest":
        return (Dispute.opened_at.asc(),)
    if sort in {"amount", "amount-desc"}:
        return (Dispute.amount.desc(),)
    if sort == "amount-asc":
        return (Dispute.amount.asc(),)
    if sort == "deadline":
        return (
            case((Dispute.due_at.is_(None), 1), else_=0),
            Dispute.due_at.asc(),
        )
    if sort == "customer":
        return (Dispute.buyer_name.asc(),)
    return (Dispute.opened_at.desc(),)


def list_disputes(
    db: Session,
    merchant_id: int,
    *,
    status: str = "all",
    reason: str | None = None,
    priority: str | None = None,
    query: str | None = None,
    days: int | None = None,
    sort: str = "newest",
    page: int = 1,
    page_size: int = 20,
) -> dict:
    filters = _base_filters(merchant_id, reason, priority, query, days)

    count_rows = db.execute(
        select(Dispute.status, func.count()).where(*filters).group_by(Dispute.status)
    ).all()
    counts = {"all": 0, "open": 0, "won": 0, "lost": 0}
    for dispute_status, count in count_rows:
        counts["all"] += count
        if dispute_status in counts:
            counts[dispute_status] = count

    item_filters = list(filters)
    if status and status != "all":
        item_filters.append(Dispute.status == status)

    total = counts["all"] if status in (None, "all") else counts.get(status, 0)
    offset = (page - 1) * page_size

    items = list(
        db.scalars(
            select(Dispute)
            .where(*item_filters)
            .options(selectinload(Dispute.evidence_files))
            .order_by(*_order_by(sort), Dispute.id)
            .offset(offset)
            .limit(page_size)
        ).all()
    )

    return {
        "items": [serialize_summary(dispute) for dispute in items],
        "page": page,
        "page_size": page_size,
        "total": total,
        "total_pages": max(1, -(-total // page_size)),
        "counts": counts,
    }


def add_activity(
    db: Session,
    dispute_id: str,
    event_type: str,
    label: str,
    detail: str | None = None,
) -> None:
    db.add(
        ActivityEvent(
            dispute_id=dispute_id,
            type=event_type,
            label=label,
            detail=detail,
            occurred_at=utcnow(),
        )
    )


def save_draft(
    db: Session,
    dispute: Dispute,
    draft: str,
    user_id: int | None,
) -> dict:
    dispute_id = dispute.id
    if dispute.status != "open":
        raise CaseClosedError(dispute_id)
    if dispute.submitted_at is not None:
        raise AlreadySubmittedError(dispute_id)

    record = dispute.response_draft
    now = utcnow()
    if record is None:
        record = ResponseDraft(
            dispute_id=dispute_id,
            draft=draft,
            edited_by_user_id=user_id,
            saved_at=now,
            created_at=now,
        )
        db.add(record)
    else:
        record.draft = draft
        record.edited_by_user_id = user_id
        record.saved_at = now

    add_activity(db, dispute_id, "draft", "Response draft saved")
    try:
        db.commit()
    except IntegrityError:
        # Two tabs saved a first draft at the same time. The loser of the
        # unique-constraint race retries as an update instead of failing.
        db.rollback()
        record = db.scalars(
            select(ResponseDraft).where(ResponseDraft.dispute_id == dispute_id)
        ).first()
        if record is None:
            raise
        record.draft = draft
        record.edited_by_user_id = user_id
        record.saved_at = now
        add_activity(db, dispute_id, "draft", "Response draft saved")
        db.commit()

    return {
        "dispute_id": dispute_id,
        "draft": draft,
        "saved_at": to_ms(now),
    }


def submit_response(
    db: Session,
    dispute: Dispute,
    body: str,
    evidence_ids: list[str],
    user_id: int | None,
) -> dict:
    dispute_id = dispute.id
    if dispute.status != "open":
        raise CaseClosedError(dispute_id)
    if dispute.submitted_at is not None:
        raise AlreadySubmittedError(dispute_id)

    ready_ids = {
        file.id for file in dispute.evidence_files if file.status == "ready"
    }
    unknown = [evidence_id for evidence_id in evidence_ids if evidence_id not in ready_ids]
    if unknown:
        raise ValueError(f"Unknown evidence ids: {', '.join(unknown)}")

    submission = ResponseSubmission(
        dispute_id=dispute_id,
        body=body,
        evidence_ids=evidence_ids,
        status="recorded",
        submitted_by_user_id=user_id,
        submitted_at=utcnow(),
    )
    dispute.submitted_at = submission.submitted_at
    db.add(submission)
    add_activity(
        db,
        dispute_id,
        "submission",
        "Response approved by merchant",
        "Queued for PayPal submission",
    )
    try:
        db.commit()
    except IntegrityError as exc:
        # Two concurrent submits both passed the ``submitted_at`` check; the
        # unique index on response_submissions.dispute_id lets exactly one win.
        db.rollback()
        raise AlreadySubmittedError(dispute_id) from exc

    return {
        "dispute_id": dispute_id,
        "status": submission.status,
        "submitted_at": to_ms(submission.submitted_at),
        "paypal_reference": submission.paypal_reference,
    }
