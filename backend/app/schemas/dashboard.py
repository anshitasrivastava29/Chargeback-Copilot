from app.schemas.dispute import CamelModel, DisputeSummary


class DashboardStats(CamelModel):
    total: int
    open: int
    won: int
    lost: int
    win_rate: int
    open_value: float
    won_value: float
    lost_value: float
    reasons: int
    pending_actions: int
    overdue_actions: int


class DueInfo(CamelModel):
    days: int
    label: str
    tone: str


class PendingAction(CamelModel):
    id: str
    dispute_id: str
    type: str
    title: str
    dispute: DisputeSummary
    due: DueInfo | None = None
