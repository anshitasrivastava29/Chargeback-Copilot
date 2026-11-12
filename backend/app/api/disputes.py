from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_intelligence
from app.core.database import get_db
from app.models.user import User
from app.schemas.ai import AIAnalysisResponse
from app.schemas.dispute import DisputeDetail, DisputeListResponse
from app.schemas.evidence import (
    DraftResponse,
    DraftSaveRequest,
    SubmissionRequest,
    SubmissionResponse,
)
from app.services.ai.engine import DisputeIntelligenceEngine
from app.services.dispute_service import (
    AlreadySubmittedError,
    CaseClosedError,
    DisputeNotFoundError,
    list_disputes,
    load_dispute,
    save_draft,
    serialize_detail,
    submit_response,
)

router = APIRouter(prefix="/disputes", tags=["disputes"])


@router.get("", response_model=DisputeListResponse)
def get_disputes(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    status_filter: Literal["all", "open", "won", "lost"] = Query("all", alias="status"),
    reason: str | None = None,
    priority: Literal["high", "medium", "low"] | None = None,
    q: str | None = Query(None, max_length=200),
    days: int | None = Query(None, ge=1, le=3650),
    sort: Literal[
        "newest", "oldest", "amount", "amount-desc", "amount-asc", "deadline", "customer"
    ] = "newest",
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100, alias="pageSize"),
):
    return list_disputes(
        db,
        user.id,
        status=status_filter,
        reason=reason,
        priority=priority,
        query=q,
        days=days,
        sort=sort,
        page=page,
        page_size=page_size,
    )


@router.get("/{dispute_id}", response_model=DisputeDetail)
def get_dispute(
    dispute_id: str,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    try:
        dispute = load_dispute(db, dispute_id, user.id)
    except DisputeNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Dispute not found."
        ) from None
    return serialize_detail(dispute, str(request.base_url))


@router.get("/{dispute_id}/ai-analysis", response_model=AIAnalysisResponse)
def get_ai_analysis(
    dispute_id: str,
    refresh: bool = False,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    engine: DisputeIntelligenceEngine = Depends(get_intelligence),
):
    try:
        dispute = load_dispute(db, dispute_id, user.id)
    except DisputeNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Dispute not found."
        ) from None

    return engine.analyze(db, dispute, user.business_name, force=refresh)


@router.post("/{dispute_id}/ai-analysis/refresh", response_model=AIAnalysisResponse)
def refresh_ai_analysis(
    dispute_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    engine: DisputeIntelligenceEngine = Depends(get_intelligence),
):
    try:
        dispute = load_dispute(db, dispute_id, user.id)
    except DisputeNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Dispute not found."
        ) from None

    return engine.analyze(db, dispute, user.business_name, force=True)


@router.post("/{dispute_id}/response-draft", response_model=DraftResponse)
def save_response_draft(
    dispute_id: str,
    payload: DraftSaveRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    try:
        dispute = load_dispute(db, dispute_id, user.id)
        return save_draft(db, dispute, payload.draft, user.id)
    except DisputeNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Dispute not found."
        ) from None
    except CaseClosedError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This case is closed and the draft is read-only.",
        ) from None
    except AlreadySubmittedError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The response has already been submitted for this dispute.",
        ) from None


@router.post("/{dispute_id}/submit", response_model=SubmissionResponse)
def submit_dispute_response(
    dispute_id: str,
    payload: SubmissionRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    try:
        dispute = load_dispute(db, dispute_id, user.id)
        return submit_response(
            db, dispute, payload.body, payload.evidence_ids, user.id
        )
    except DisputeNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Dispute not found."
        ) from None
    except CaseClosedError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This case is already closed.",
        ) from None
    except AlreadySubmittedError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The response has already been submitted for this dispute.",
        ) from None
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
        ) from None
