from app.schemas.dispute import CamelModel


class Classification(CamelModel):
    category: str
    type: str
    confidence: int


class Risk(CamelModel):
    level: str
    summary: str


class EvidenceGap(CamelModel):
    type: str
    severity: str
    note: str


class RecommendationItem(CamelModel):
    title: str
    detail: str
    priority: str


class RecommendationPanel(CamelModel):
    tone: str
    title: str
    body: str


class Citation(CamelModel):
    evidence_type: str
    file_name: str
    excerpt: str | None = None


class Factor(CamelModel):
    tone: str
    text: str


class Signal(CamelModel):
    code: str
    severity: str
    message: str
    evidence_type: str | None = None


class AIAnalysisResponse(CamelModel):
    classification: Classification
    risk: Risk
    win_likelihood: int | None = None
    evidence_gaps: list[EvidenceGap]
    recommendations: list[RecommendationItem]
    next_step: str
    recommendation: RecommendationPanel
    response_draft: str
    citations: list[Citation]
    factors: list[Factor]
    signals: list[Signal]
    model: str
    generated_at: int
