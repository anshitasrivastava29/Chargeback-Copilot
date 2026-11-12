from pydantic import Field

from app.schemas.dispute import CamelModel


class SettingsUser(CamelModel):
    id: int
    email: str
    name: str
    business_name: str
    created_at: int


class NotificationSettings(CamelModel):
    deadline_reminders: bool
    weekly_digest: bool
    case_updates: bool


class WorkspaceSummary(CamelModel):
    disputes: int
    open: int
    evidence_files: int
    storage_bytes: int


class PayPalSummary(CamelModel):
    configured: bool
    connected: bool
    status: str
    environment: str
    account_email: str | None = None


class AISummary(CamelModel):
    mode: str
    llm_configured: bool
    model: str


class IntegrationsSummary(CamelModel):
    paypal: PayPalSummary
    ai: AISummary


class AppSummary(CamelModel):
    name: str
    environment: str
    require_auth: bool


class SettingsOut(CamelModel):
    user: SettingsUser
    notifications: NotificationSettings
    workspace: WorkspaceSummary
    integrations: IntegrationsSummary
    app: AppSummary


class ProfileUpdateRequest(CamelModel):
    name: str = Field(min_length=2, max_length=120)
    business_name: str = Field(min_length=1, max_length=160)


class ProfileUpdateResponse(CamelModel):
    user: SettingsUser


class NotificationUpdateRequest(CamelModel):
    deadline_reminders: bool
    weekly_digest: bool
    case_updates: bool


class PasswordChangeRequest(CamelModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)


class MessageResponse(CamelModel):
    message: str
