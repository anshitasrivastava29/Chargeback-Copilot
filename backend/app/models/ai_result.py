from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.core.timeutils import utcnow

if TYPE_CHECKING:
    from app.models.dispute import Dispute


class AIResult(Base):
    __tablename__ = "ai_results"

    id: Mapped[int] = mapped_column(primary_key=True)
    dispute_id: Mapped[str] = mapped_column(
        ForeignKey("disputes.id", ondelete="CASCADE"), index=True
    )
    classification: Mapped[dict] = mapped_column(JSON)
    risk: Mapped[dict] = mapped_column(JSON)
    win_likelihood: Mapped[int | None] = mapped_column(Integer, nullable=True)
    evidence_gaps: Mapped[list] = mapped_column(JSON)
    recommendations: Mapped[list] = mapped_column(JSON)
    next_step: Mapped[str] = mapped_column(Text)
    recommendation: Mapped[dict] = mapped_column(JSON)
    response_draft: Mapped[str] = mapped_column(Text)
    citations: Mapped[list] = mapped_column(JSON, default=list)
    factors: Mapped[list] = mapped_column(JSON, default=list)
    signals: Mapped[list] = mapped_column(JSON, default=list)
    model: Mapped[str] = mapped_column(String(80))
    evidence_fingerprint: Mapped[str] = mapped_column(String(80))
    generated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    dispute: Mapped["Dispute"] = relationship(back_populates="ai_results")
