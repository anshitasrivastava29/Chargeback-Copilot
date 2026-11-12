from pydantic import Field

from app.schemas.dispute import CamelModel


class EvidenceTypeOut(CamelModel):
    key: str
    label: str
    description: str


class EvidenceTypeList(CamelModel):
    items: list[EvidenceTypeOut]
    max_file_mb: int
    allowed_mime_types: list[str]


class DraftSaveRequest(CamelModel):
    draft: str = Field(min_length=1, max_length=20_000)


class DraftResponse(CamelModel):
    dispute_id: str
    draft: str
    saved_at: int


class SubmissionRequest(CamelModel):
    body: str = Field(min_length=1, max_length=20_000)
    evidence_ids: list[str] = Field(default_factory=list)


class SubmissionResponse(CamelModel):
    dispute_id: str
    status: str
    submitted_at: int
    paypal_reference: str | None = None


class VaultDispute(CamelModel):
    id: str
    reason: str
    status: str
    buyer_name: str
    amount: float
    currency: str
    order_id: str


class VaultItem(CamelModel):
    id: str
    name: str
    size: int
    mime: str
    evidence_type: str
    status: str
    extraction_status: str
    quality_score: int | None = None
    uploaded_at: int
    source: str
    preview_url: str | None = None
    has_file: bool
    dispute: VaultDispute


class VaultStats(CamelModel):
    files: int
    bytes: int
    ready: int
    needs_attention: int
    disputes: int
    types: int


class VaultType(CamelModel):
    evidence_type: str
    count: int


class EvidenceVaultResponse(CamelModel):
    items: list[VaultItem]
    page: int
    page_size: int
    total: int
    total_pages: int
    stats: VaultStats
    types: list[VaultType]
