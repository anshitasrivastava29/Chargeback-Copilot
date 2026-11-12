from app.schemas.dispute import CamelModel


class PayPalConnectionOut(CamelModel):
    configured: bool
    environment: str
    sandbox: bool
    connected: bool
    status: str
    account_email: str | None = None
    account_name: str | None = None
    payer_id: str | None = None
    scopes: list[str]
    connected_at: int | None = None
    token_expires_at: int | None = None
    refresh_token_expires_at: int | None = None
    last_verified_at: int | None = None
    last_error: str | None = None
    redirect_uri: str
    requested_scopes: list[str]


class PayPalConnectOut(CamelModel):
    authorization_url: str
    expires_at: int


class PayPalSyncOut(CamelModel):
    ran_at: int
    token_source: str
    fetched: int
    created: int
    updated: int
    skipped: int
    transactions_created: int
    transactions_updated: int
    orders_enriched: int
    refunds_observed: int


class PayPalPermissionCheckOut(CamelModel):
    api: str
    endpoint: str
    status: str
    detail: str | None = None


class PayPalPermissionsOut(CamelModel):
    token_source: str
    checks: list[PayPalPermissionCheckOut]
