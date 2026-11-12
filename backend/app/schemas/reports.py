from app.schemas.dispute import CamelModel


class ReportTotals(CamelModel):
    total: int
    open: int
    won: int
    lost: int
    resolved: int
    win_rate: int
    open_value: float
    won_value: float
    lost_value: float
    average_dispute_value: float


class ReportResolution(CamelModel):
    average_days: float | None = None
    resolved_count: int
    submitted_count: int
    average_response_days: float | None = None


class ReasonReport(CamelModel):
    reason: str
    total: int
    open: int
    won: int
    lost: int
    win_rate: int
    amount: float
    open_amount: float
    lost_amount: float
    average_resolution_days: float | None = None


class MonthlyPoint(CamelModel):
    month: str
    label: str
    total: int
    open: int
    won: int
    lost: int
    amount: float
    won_value: float
    lost_value: float


class EvidenceCoverage(CamelModel):
    documents: int
    required: int
    completed: int
    gaps: int
    coverage_percent: int
    needs_attention: int
    disputes_with_gaps: int


class GapReport(CamelModel):
    evidence_type: str
    count: int


class DeadlineReport(CamelModel):
    overdue: int
    due_soon: int
    due_soon_value: float
    open_value: float


class ReportsSummary(CamelModel):
    range_days: int | None = None
    generated_at: int
    totals: ReportTotals
    resolution: ReportResolution
    reasons: list[ReasonReport]
    monthly: list[MonthlyPoint]
    evidence: EvidenceCoverage
    top_gaps: list[GapReport]
    deadlines: DeadlineReport
