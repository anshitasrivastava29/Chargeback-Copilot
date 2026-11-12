from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.dashboard import DashboardStats, PendingAction
from app.services.dashboard import dashboard_stats, pending_actions

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/stats", response_model=DashboardStats)
def get_stats(
    days: int | None = Query(None, ge=1, le=3650),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return dashboard_stats(db, user.id, days=days)


@router.get("/pending-actions", response_model=list[PendingAction])
def get_pending_actions(
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return pending_actions(db, user.id, limit=limit)
