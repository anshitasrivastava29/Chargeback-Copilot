from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.core.timeutils import utcnow

if TYPE_CHECKING:
    from app.models.dispute import Dispute
    from app.models.paypal import PayPalConnection


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(120))
    business_name: Mapped[str] = mapped_column(String(160), default="Acme Commerce")
    password_hash: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    # Workspace notification preferences, editable from Settings. They are
    # descriptive for this demo (no mail transport is wired) but persisted so
    # the choice survives reloads and is visible to future notification jobs.
    notify_deadline_reminders: Mapped[bool] = mapped_column(Boolean, default=True)
    notify_weekly_digest: Mapped[bool] = mapped_column(Boolean, default=True)
    notify_case_updates: Mapped[bool] = mapped_column(Boolean, default=True)

    disputes: Mapped[list["Dispute"]] = relationship(back_populates="merchant")
    paypal_connection: Mapped["PayPalConnection | None"] = relationship(
        back_populates="merchant", cascade="all, delete-orphan", uselist=False
    )
