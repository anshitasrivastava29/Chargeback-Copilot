from app.schemas.dispute import Address, CamelModel, OrderItem, TrackingInfo


class TransactionOut(CamelModel):
    id: str
    order_id: str
    dispute_id: str | None = None
    buyer_name: str
    buyer_email: str
    amount: float
    currency: str
    status: str
    payment_method: str
    items: list[OrderItem]
    shipping_address: Address
    created_at: int
    tracking: TrackingInfo | None = None


class TransactionListResponse(CamelModel):
    items: list[TransactionOut]
    total: int
