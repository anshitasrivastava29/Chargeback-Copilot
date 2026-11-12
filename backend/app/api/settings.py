from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_app_settings, get_current_user
from app.core.config import Settings
from app.core.database import get_db
from app.models.user import User
from app.schemas.settings import (
    MessageResponse,
    NotificationSettings,
    NotificationUpdateRequest,
    PasswordChangeRequest,
    ProfileUpdateRequest,
    ProfileUpdateResponse,
    SettingsOut,
)
from app.services import settings as settings_service

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("", response_model=SettingsOut)
def get_settings_summary(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    app_settings: Settings = Depends(get_app_settings),
):
    return settings_service.settings_summary(db, user, app_settings)


@router.patch("/profile", response_model=ProfileUpdateResponse)
def update_profile(
    payload: ProfileUpdateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    try:
        updated = settings_service.update_profile(
            db, user, payload.name, payload.business_name
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
        ) from None
    return {"user": updated}


@router.patch("/notifications", response_model=NotificationSettings)
def update_notifications(
    payload: NotificationUpdateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return settings_service.update_notifications(
        db,
        user,
        deadline_reminders=payload.deadline_reminders,
        weekly_digest=payload.weekly_digest,
        case_updates=payload.case_updates,
    )


@router.post("/password", response_model=MessageResponse)
def change_password(
    payload: PasswordChangeRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    try:
        settings_service.change_password(
            db, user, payload.current_password, payload.new_password
        )
    except settings_service.InvalidPasswordError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
        ) from None
    return {"message": "Password updated. Use it the next time you sign in."}
