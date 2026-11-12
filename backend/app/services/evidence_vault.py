"""Cross-case evidence catalogue for the Evidence vault page."""

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.core.timeutils import to_ms
from app.models.dispute import Dispute
from app.models.evidence import EvidenceFile


def _filters(
    merchant_id: int,
    query: str | None,
    evidence_type: str | None,
    status_filter: str | None,
) -> list:
    conditions = [Dispute.merchant_id == merchant_id]

    if evidence_type and evidence_type != "all":
        conditions.append(EvidenceFile.evidence_type == evidence_type)

    if status_filter == "ready":
        conditions.extend(
            [
                EvidenceFile.status == "ready",
                EvidenceFile.extraction_status != "failed",
            ]
        )
    elif status_filter == "attention":
        conditions.append(
            or_(
                EvidenceFile.status != "ready",
                EvidenceFile.extraction_status == "failed",
            )
        )

    if query:
        needle = f"%{query.strip().lower()}%"
        conditions.append(
            or_(
                func.lower(EvidenceFile.file_name).like(needle),
                func.lower(EvidenceFile.evidence_type).like(needle),
                func.lower(Dispute.id).like(needle),
                func.lower(Dispute.buyer_name).like(needle),
                func.lower(Dispute.order_id).like(needle),
            )
        )

    return conditions


def _serialize(file: EvidenceFile) -> dict:
    dispute = file.dispute
    return {
        "id": file.id,
        "name": file.file_name,
        "size": file.size_bytes,
        "mime": file.mime_type,
        "evidence_type": file.evidence_type,
        "status": file.status,
        "extraction_status": file.extraction_status,
        "quality_score": file.quality_score,
        "uploaded_at": to_ms(file.uploaded_at),
        "source": file.source,
        "preview_url": file.preview_url,
        "has_file": bool(file.storage_path),
        "dispute": {
            "id": dispute.id,
            "reason": dispute.reason,
            "status": dispute.status,
            "buyer_name": dispute.buyer_name,
            "amount": float(dispute.amount),
            "currency": dispute.currency,
            "order_id": dispute.order_id,
        },
    }


def evidence_vault(
    db: Session,
    merchant_id: int,
    *,
    query: str | None = None,
    evidence_type: str | None = None,
    status_filter: str | None = None,
    page: int = 1,
    page_size: int = 20,
) -> dict:
    base_join = (Dispute, EvidenceFile.dispute_id == Dispute.id)
    conditions = _filters(merchant_id, query, evidence_type, status_filter)

    total = db.scalar(
        select(func.count(EvidenceFile.id))
        .select_from(EvidenceFile)
        .join(*base_join)
        .where(*conditions)
    ) or 0

    items = list(
        db.scalars(
            select(EvidenceFile)
            .join(*base_join)
            .where(*conditions)
            .options(selectinload(EvidenceFile.dispute))
            .order_by(EvidenceFile.uploaded_at.desc(), EvidenceFile.id)
            .offset((page - 1) * page_size)
            .limit(page_size)
        ).all()
    )

    merchant_scope = Dispute.merchant_id == merchant_id
    files, total_bytes, dispute_count, type_count = db.execute(
        select(
            func.count(EvidenceFile.id),
            func.coalesce(func.sum(EvidenceFile.size_bytes), 0),
            func.count(func.distinct(EvidenceFile.dispute_id)),
            func.count(func.distinct(EvidenceFile.evidence_type)),
        )
        .select_from(EvidenceFile)
        .join(*base_join)
        .where(merchant_scope)
    ).one()

    ready_count = db.scalar(
        select(func.count(EvidenceFile.id))
        .select_from(EvidenceFile)
        .join(*base_join)
        .where(
            merchant_scope,
            EvidenceFile.status == "ready",
            EvidenceFile.extraction_status != "failed",
        )
    ) or 0
    attention_count = db.scalar(
        select(func.count(EvidenceFile.id))
        .select_from(EvidenceFile)
        .join(*base_join)
        .where(
            merchant_scope,
            or_(
                EvidenceFile.status != "ready",
                EvidenceFile.extraction_status == "failed",
            ),
        )
    ) or 0

    type_rows = db.execute(
        select(EvidenceFile.evidence_type, func.count(EvidenceFile.id))
        .select_from(EvidenceFile)
        .join(*base_join)
        .where(merchant_scope)
        .group_by(EvidenceFile.evidence_type)
        .order_by(func.count(EvidenceFile.id).desc(), EvidenceFile.evidence_type)
    ).all()

    return {
        "items": [_serialize(file) for file in items],
        "page": page,
        "page_size": page_size,
        "total": total,
        "total_pages": max(1, -(-total // page_size)),
        "stats": {
            "files": int(files),
            "bytes": int(total_bytes or 0),
            "ready": int(ready_count),
            "needs_attention": int(attention_count),
            "disputes": int(dispute_count),
            "types": int(type_count),
        },
        "types": [
            {"evidence_type": evidence_type, "count": count}
            for evidence_type, count in type_rows
        ],
    }
