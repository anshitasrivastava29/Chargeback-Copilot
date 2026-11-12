import re
import uuid
from io import BytesIO
from pathlib import Path

from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.timeutils import utcnow
from app.models.dispute import Dispute
from app.models.evidence import EvidenceFile
from app.services.ai.constants import ADDITIONAL_EVIDENCE, EVIDENCE_CATALOG
from app.services.ai.evidence_analyzer import extract_fields, score_document
from app.services.dispute_service import add_activity, serialize_file

ALLOWED_TYPES = {item["key"] for item in EVIDENCE_CATALOG} | {ADDITIONAL_EVIDENCE}
SAFE_NAME = re.compile(r"[^A-Za-z0-9._-]+")


class UploadValidationError(ValueError):
    pass


def detect_mime(data: bytes) -> str | None:
    if data.startswith(b"%PDF"):
        return "application/pdf"
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    return None


def validate_evidence_type(evidence_type: str) -> str:
    if evidence_type not in ALLOWED_TYPES:
        raise UploadValidationError(
            f"Unknown evidence type '{evidence_type}'. Choose one of the checklist items."
        )
    return evidence_type


def read_upload(upload, settings: Settings) -> tuple[bytes, str]:
    data = upload.file.read(settings.max_upload_bytes + 1)
    if not data:
        raise UploadValidationError("The uploaded file is empty.")
    if len(data) > settings.max_upload_bytes:
        raise UploadValidationError(
            f"File exceeds the {settings.max_upload_mb} MB limit."
        )

    mime = detect_mime(data)
    if mime is None:
        raise UploadValidationError("Unsupported file type. Use PDF, JPG, or PNG.")

    return data, mime


def extract_document(data: bytes, mime: str, evidence_type: str) -> dict:
    if mime != "application/pdf":
        return {
            "extraction_status": "not_supported",
            "extracted_text": None,
            "extracted_fields": {},
            "quality_score": 60,
        }

    try:
        from pypdf import PdfReader

        reader = PdfReader(BytesIO(data))
        if reader.is_encrypted:
            raise ValueError("Encrypted PDF")

        chunks = []
        for page in reader.pages[:25]:
            chunks.append(page.extract_text() or "")
        text = "\n".join(chunks).strip()
    except Exception:
        return {
            "extraction_status": "failed",
            "extracted_text": None,
            "extracted_fields": {},
            "quality_score": 40,
        }

    fields = extract_fields(text)
    return {
        "extraction_status": "parsed" if text else "empty",
        "extracted_text": text or None,
        "extracted_fields": fields,
        "quality_score": score_document(text, fields, evidence_type),
    }


def store_upload(
    db: Session,
    settings: Settings,
    dispute: Dispute,
    upload,
    evidence_type: str,
    base_url: str | None = None,
) -> dict:
    evidence_type = validate_evidence_type(evidence_type)
    data, mime = read_upload(upload, settings)

    file_id = str(uuid.uuid4())
    original_name = Path(upload.filename or "evidence").name
    safe_name = SAFE_NAME.sub("_", original_name)[:120] or "evidence"
    directory = Path(settings.storage_dir) / "evidence" / dispute.id
    directory.mkdir(parents=True, exist_ok=True)
    target = directory / f"{file_id}_{safe_name}"
    target.write_bytes(data)

    extraction = extract_document(data, mime, evidence_type)

    file = EvidenceFile(
        id=file_id,
        dispute_id=dispute.id,
        evidence_type=evidence_type,
        file_name=original_name[:255],
        mime_type=mime,
        size_bytes=len(data),
        storage_path=str(target),
        preview_url=None,
        source="upload",
        status="ready",
        extraction_status=extraction["extraction_status"],
        extracted_text=extraction["extracted_text"],
        extracted_fields=extraction["extracted_fields"],
        quality_score=extraction["quality_score"],
        uploaded_at=utcnow(),
    )
    dispute.updated_at = utcnow()
    db.add(file)
    add_activity(
        db,
        dispute.id,
        "evidence",
        "Evidence uploaded",
        f"{evidence_type}: {original_name}",
    )
    db.commit()
    db.refresh(file)

    return serialize_file(file, base_url)


def delete_upload(db: Session, dispute: Dispute, evidence_id: str) -> None:
    file = next(
        (item for item in dispute.evidence_files if item.id == evidence_id), None
    )
    if file is None:
        raise LookupError(evidence_id)

    if file.storage_path:
        Path(file.storage_path).unlink(missing_ok=True)

    db.delete(file)
    dispute.updated_at = utcnow()
    add_activity(
        db,
        dispute.id,
        "evidence",
        "Evidence removed",
        f"{file.evidence_type}: {file.file_name}",
    )
    db.commit()


def file_path(file: EvidenceFile) -> Path | None:
    if not file.storage_path:
        return None
    path = Path(file.storage_path)
    return path if path.is_file() else None
