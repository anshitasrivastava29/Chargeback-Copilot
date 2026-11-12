from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.reports import ReportsSummary
from app.services.reports import reports_summary

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/summary", response_model=ReportsSummary)
def get_reports_summary(
    days: int | None = Query(None, ge=1, le=3650),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Portfolio analytics for the selected window (omitted = all time)."""
    return reports_summary(db, user.id, days=days)
