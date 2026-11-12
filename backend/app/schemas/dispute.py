from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )


class Buyer(CamelModel):
    name: str
    email: str


class Address(CamelModel):
    name: str
    line1: str
    line2: str
    country: str


class EvidenceSummary(CamelModel):
    uploaded: int
    required: int
    missing: list[str] | None = None
    completed: list[str] | None = None


class DisputeSummary(CamelModel):
    id: str
    buyer: Buyer
    reason: str
    amount: float
    currency: str = "USD"
    status: str
    priority: str
    opened_at: int
    due_at: int | None = None
    resolved_at: int | None = None
    evidence: EvidenceSummary
    transaction_id: str
    order_id: str


class DisputeListResponse(CamelModel):
    items: list[DisputeSummary]
    page: int
    page_size: int
    total: int
    total_pages: int
    counts: dict[str, int]


class OrderItem(CamelModel):
    name: str
    sku: str
    quantity: int
    total: float


class CustomerProfile(CamelModel):
    id: str
    phone: str
    member_since: str
    lifetime_orders: int
    email_verified: bool
    address: Address


class OrderDetails(CamelModel):
    id: str
    placed_at: int
    transaction_id: str
    payment_method: str
    items: list[OrderItem]
    subtotal: float
    shipping: float
    tax: float
    tax_included: bool
    total: float
    shipping_address: Address


class TrackingEvent(CamelModel):
    label: str
    date: int
    tone: str


class TrackingInfo(CamelModel):
    available: bool
    carrier: str | None = None
    number: str | None = None
    status_label: str | None = None
    tone: str | None = None
    shipped_at: int | None = None
    delivered_at: int | None = None
    estimated_at: int | None = None
    events: list[TrackingEvent] | None = None
    signed_by: str | None = None
    note: str | None = None


class RefundInfo(CamelModel):
    key: str
    label: str
    tone: str
    amount: float | None = None
    method: str | None = None
    date: int | None = None
    requested_at: int | None = None
    note: str


class ActivityItem(CamelModel):
    label: str
    date: int
    dot: str


class EvidenceFileOut(CamelModel):
    id: str
    name: str
    size: int
    mime: str
    preview_url: str | None = None
    evidence_type: str
    status: str
    uploaded_at: int
    source: str
    error: str | None = None
    extraction_status: str = "pending"
    quality_score: int | None = None
    extracted_fields: dict = Field(default_factory=dict)


class DisputeDetail(DisputeSummary):
    customer: CustomerProfile
    order: OrderDetails
    tracking: TrackingInfo
    refund: RefundInfo
    activity: list[ActivityItem]
    evidence_files: list[EvidenceFileOut]
    submitted_at: int | None = None
