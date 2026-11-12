from typing import Literal

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile, status
from fastapi.responses import FileResponse, Response
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.dispute import EvidenceFileOut
from app.schemas.evidence import EvidenceVaultResponse
from app.services.dispute_service import DisputeNotFoundError, load_dispute, serialize_file
from app.services.evidence_service import (
    UploadValidationError,
    delete_upload,
    file_path,
    store_upload,
)
from app.services.evidence_vault import evidence_vault

dispute_router = APIRouter(prefix="/disputes", tags=["evidence"])
router = APIRouter(prefix="/evidence", tags=["evidence"])


@router.get("", response_model=EvidenceVaultResponse)
def list_vault_evidence(
    q: str | None = Query(None, max_length=200),
    evidence_type: str | None = Query(None, alias="type", max_length=80),
    status_filter: Literal["all", "ready", "attention"] = Query(
        "all", alias="status"
    ),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100, alias="pageSize"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Every evidence file the merchant owns, with its case context."""
    return evidence_vault(
        db,
        user.id,
        query=q,
        evidence_type=evidence_type,
        status_filter=status_filter,
        page=page,
        page_size=page_size,
    )


@dispute_router.get("/{dispute_id}/evidence", response_model=list[EvidenceFileOut])
def list_evidence(
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

    base_url = str(request.base_url)
    return [
        serialize_file(file, base_url)
        for file in sorted(dispute.evidence_files, key=lambda item: item.uploaded_at)
    ]


@dispute_router.post(
    "/{dispute_id}/evidence",
    response_model=EvidenceFileOut,
    status_code=status.HTTP_201_CREATED,
)
def upload_evidence(
    dispute_id: str,
    request: Request,
    file: UploadFile = File(...),
    evidence_type: str = Form(..., alias="evidenceType"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    try:
        dispute = load_dispute(db, dispute_id, user.id)
        return store_upload(
            db,
            request.app.state.settings,
            dispute,
            file,
            evidence_type,
            str(request.base_url),
        )
    except DisputeNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Dispute not found."
        ) from None
    except UploadValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
        ) from None


@dispute_router.delete(
    "/{dispute_id}/evidence/{evidence_id}", status_code=status.HTTP_204_NO_CONTENT
)
def remove_evidence(
    dispute_id: str,
    evidence_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    try:
        dispute = load_dispute(db, dispute_id, user.id)
        delete_upload(db, dispute, evidence_id)
    except DisputeNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Dispute not found."
        ) from None
    except LookupError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Evidence file not found."
        ) from None
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{evidence_id}/file")
def download_evidence(
    evidence_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    from app.models.dispute import Dispute
    from app.models.evidence import EvidenceFile

    file = db.get(EvidenceFile, evidence_id)
    if file is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Evidence file not found."
        )

    # Tenant scoping matches every other case-owned resource: another
    # merchant's evidence id is indistinguishable from a missing one.
    dispute = db.get(Dispute, file.dispute_id)
    if dispute is None or dispute.merchant_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Evidence file not found."
        )

    path = file_path(file)
    if path is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="This demo evidence record has no stored file.",
        )

    return FileResponse(path, media_type=file.mime_type, filename=file.file_name)
