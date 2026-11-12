from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import JSON, BigInteger, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.core.timeutils import utcnow

if TYPE_CHECKING:
    from app.models.dispute import Dispute


class EvidenceFile(Base):
    __tablename__ = "evidence_files"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    dispute_id: Mapped[str] = mapped_column(
        ForeignKey("disputes.id", ondelete="CASCADE"), index=True
    )
    evidence_type: Mapped[str] = mapped_column(String(80))
    file_name: Mapped[str] = mapped_column(String(255))
    mime_type: Mapped[str] = mapped_column(String(80))
    size_bytes: Mapped[int] = mapped_column(BigInteger)
    storage_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    preview_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    source: Mapped[str] = mapped_column(String(16), default="upload")
    status: Mapped[str] = mapped_column(String(16), default="ready")
    error: Mapped[str | None] = mapped_column(String(255), nullable=True)
    extraction_status: Mapped[str] = mapped_column(String(24), default="pending")
    extracted_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    extracted_fields: Mapped[dict] = mapped_column(JSON, default=dict)
    quality_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    dispute: Mapped["Dispute"] = relationship(back_populates="evidence_files")
