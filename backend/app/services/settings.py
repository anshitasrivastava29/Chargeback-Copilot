"""Merchant profile, notification, and integration settings."""

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.security import hash_password, verify_password
from app.core.timeutils import to_ms
from app.models.dispute import Dispute
from app.models.evidence import EvidenceFile
from app.models.paypal import PayPalConnection
from app.models.user import User


class InvalidPasswordError(ValueError):
    pass


def _user_payload(user: User) -> dict:
    return {
        "id": user.id,
        "email": user.email,
        "name": user.name,
        "business_name": user.business_name,
        "created_at": to_ms(user.created_at),
    }


def _notifications(user: User) -> dict:
    return {
        "deadline_reminders": bool(
            True
            if user.notify_deadline_reminders is None
            else user.notify_deadline_reminders
        ),
        "weekly_digest": bool(
            True if user.notify_weekly_digest is None else user.notify_weekly_digest
        ),
        "case_updates": bool(
            True if user.notify_case_updates is None else user.notify_case_updates
        ),
    }


def settings_summary(db: Session, user: User, settings: Settings) -> dict:
    disputes = db.scalar(
        select(func.count(Dispute.id)).where(Dispute.merchant_id == user.id)
    ) or 0
    open_disputes = db.scalar(
        select(func.count(Dispute.id)).where(
            Dispute.merchant_id == user.id, Dispute.status == "open"
        )
    ) or 0
    evidence_files, storage_bytes = db.execute(
        select(
            func.count(EvidenceFile.id),
            func.coalesce(func.sum(EvidenceFile.size_bytes), 0),
        )
        .select_from(EvidenceFile)
        .join(Dispute, EvidenceFile.dispute_id == Dispute.id)
        .where(Dispute.merchant_id == user.id)
    ).one()

    connection = db.scalar(
        select(PayPalConnection).where(PayPalConnection.merchant_id == user.id)
    )
    connected = bool(connection and connection.status == "connected")
    if connected:
        paypal_status = "connected"
    elif connection is not None:
        paypal_status = connection.status
    elif settings.paypal_configured:
        paypal_status = "app_credentials"
    else:
        paypal_status = "not_configured"

    llm_configured = bool(settings.llm_api_key.strip()) and (
        settings.ai_mode.strip().lower() != "heuristic"
    )

    return {
        "user": _user_payload(user),
        "notifications": _notifications(user),
        "workspace": {
            "disputes": int(disputes),
            "open": int(open_disputes),
            "evidence_files": int(evidence_files),
            "storage_bytes": int(storage_bytes or 0),
        },
        "integrations": {
            "paypal": {
                "configured": settings.paypal_configured,
                "connected": connected,
                "status": paypal_status,
                "environment": settings.paypal_mode,
                "account_email": (
                    connection.account_email if connected and connection else None
                ),
            },
            "ai": {
                "mode": settings.ai_mode,
                "llm_configured": llm_configured,
                "model": settings.llm_model,
            },
        },
        "app": {
            "name": settings.app_name,
            "environment": settings.environment,
            "require_auth": settings.require_auth,
        },
    }


def update_profile(
    db: Session, user: User, name: str, business_name: str
) -> dict:
    clean_name = name.strip()
    clean_business = business_name.strip()
    if not clean_name or not clean_business:
        raise ValueError("Name and business name cannot be blank.")

    user.name = clean_name
    user.business_name = clean_business
    db.commit()
    db.refresh(user)
    return _user_payload(user)


def update_notifications(
    db: Session,
    user: User,
    *,
    deadline_reminders: bool,
    weekly_digest: bool,
    case_updates: bool,
) -> dict:
    user.notify_deadline_reminders = deadline_reminders
    user.notify_weekly_digest = weekly_digest
    user.notify_case_updates = case_updates
    db.commit()
    db.refresh(user)
    return _notifications(user)


def change_password(
    db: Session, user: User, current_password: str, new_password: str
) -> None:
    if not verify_password(current_password, user.password_hash):
        raise InvalidPasswordError("The current password is incorrect.")
    user.password_hash = hash_password(new_password)
    db.commit()
