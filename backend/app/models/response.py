from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import JSON, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.core.timeutils import utcnow

if TYPE_CHECKING:
    from app.models.dispute import Dispute


class ResponseDraft(Base):
    __tablename__ = "response_drafts"

    id: Mapped[int] = mapped_column(primary_key=True)
    dispute_id: Mapped[str] = mapped_column(
        ForeignKey("disputes.id", ondelete="CASCADE"), unique=True, index=True
    )
    draft: Mapped[str] = mapped_column(Text)
    edited_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"), nullable=True
    )
    saved_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    dispute: Mapped["Dispute"] = relationship(back_populates="response_draft")


class ResponseSubmission(Base):
    __tablename__ = "response_submissions"

    id: Mapped[int] = mapped_column(primary_key=True)
    dispute_id: Mapped[str] = mapped_column(
        ForeignKey("disputes.id", ondelete="CASCADE"), unique=True, index=True
    )
    body: Mapped[str] = mapped_column(Text)
    evidence_ids: Mapped[list] = mapped_column(JSON, default=list)
    status: Mapped[str] = mapped_column(String(24), default="recorded")
    paypal_reference: Mapped[str | None] = mapped_column(String(120), nullable=True)
    submitted_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"), nullable=True
    )
    submitted_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    dispute: Mapped["Dispute"] = relationship(back_populates="submissions")
