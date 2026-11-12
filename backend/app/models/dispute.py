from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.core.timeutils import utcnow

if TYPE_CHECKING:
    from app.models.activity import ActivityEvent
    from app.models.ai_result import AIResult
    from app.models.evidence import EvidenceFile
    from app.models.response import ResponseDraft, ResponseSubmission
    from app.models.transaction import Transaction
    from app.models.user import User


class Dispute(Base):
    __tablename__ = "disputes"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    merchant_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    transaction_id: Mapped[str] = mapped_column(
        ForeignKey("transactions.id"), index=True
    )
    order_id: Mapped[str] = mapped_column(String(32), index=True)
    buyer_name: Mapped[str] = mapped_column(String(120))
    buyer_email: Mapped[str] = mapped_column(String(320))
    reason: Mapped[str] = mapped_column(String(80), index=True)
    amount: Mapped[float] = mapped_column(Numeric(12, 2))
    currency: Mapped[str] = mapped_column(String(3), default="USD")
    status: Mapped[str] = mapped_column(String(16), index=True, default="open")
    priority: Mapped[str] = mapped_column(String(16), default="medium")
    required_evidence: Mapped[int] = mapped_column(default=4)
    opened_at: Mapped[datetime] = mapped_column(DateTime)
    due_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=utcnow, onupdate=utcnow
    )

    merchant: Mapped["User"] = relationship(back_populates="disputes")
    transaction: Mapped["Transaction"] = relationship(back_populates="dispute")
    evidence_files: Mapped[list["EvidenceFile"]] = relationship(
        back_populates="dispute", cascade="all, delete-orphan"
    )
    ai_results: Mapped[list["AIResult"]] = relationship(
        back_populates="dispute",
        cascade="all, delete-orphan",
        order_by="AIResult.generated_at.desc()",
    )
    response_draft: Mapped["ResponseDraft | None"] = relationship(
        back_populates="dispute", cascade="all, delete-orphan", uselist=False
    )
    submissions: Mapped[list["ResponseSubmission"]] = relationship(
        back_populates="dispute", cascade="all, delete-orphan"
    )
    activities: Mapped[list["ActivityEvent"]] = relationship(
        back_populates="dispute", cascade="all, delete-orphan"
    )
