from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.core.timeutils import utcnow

if TYPE_CHECKING:
    from app.models.user import User


class PayPalConnection(Base):
    __tablename__ = "paypal_connections"

    id: Mapped[int] = mapped_column(primary_key=True)
    merchant_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), unique=True, index=True
    )
    environment: Mapped[str] = mapped_column(String(16), default="sandbox")
    status: Mapped[str] = mapped_column(String(16), default="connected")
    payer_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    account_email: Mapped[str | None] = mapped_column(String(320), nullable=True)
    account_name: Mapped[str | None] = mapped_column(String(160), nullable=True)
    scopes: Mapped[str] = mapped_column(String(500), default="")
    access_token_encrypted: Mapped[str | None] = mapped_column(Text, nullable=True)
    refresh_token_encrypted: Mapped[str | None] = mapped_column(Text, nullable=True)
    access_token_expires_at: Mapped[datetime | None] = mapped_column(
        DateTime, nullable=True
    )
    refresh_token_expires_at: Mapped[datetime | None] = mapped_column(
        DateTime, nullable=True
    )
    connected_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    verified_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    last_error: Mapped[str | None] = mapped_column(String(255), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=utcnow, onupdate=utcnow
    )

    merchant: Mapped["User"] = relationship(back_populates="paypal_connection")


class PayPalOAuthState(Base):
    __tablename__ = "paypal_oauth_states"

    id: Mapped[int] = mapped_column(primary_key=True)
    state: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    merchant_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    expires_at: Mapped[datetime] = mapped_column(DateTime)
    used_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
