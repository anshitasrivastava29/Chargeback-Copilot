from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    app_name: str = "Chargeback Copilot API"
    environment: str = "development"
    api_prefix: str = "/api"

    database_url: str = "sqlite:///./chargeback.db"
    seed_demo_data: bool = True
    storage_dir: str = "./storage"
    max_upload_mb: int = 10
    # Whole-request ceiling enforced before the body is parsed. Kept above
    # MAX_UPLOAD_MB so multipart framing overhead never rejects a legal upload.
    max_request_mb: int = 12

    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    jwt_secret: str = "dev-only-secret-change-me-in-production-32bytes-min"
    jwt_algorithm: str = "HS256"
    jwt_expires_minutes: int = 24 * 60
    require_auth: bool = False

    ai_mode: str = "auto"
    llm_api_key: str = ""
    llm_base_url: str = "https://api.openai.com/v1"
    llm_model: str = "gpt-4o-mini"
    llm_timeout_seconds: float = 25.0

    # PayPal sandbox OAuth. Credentials stay on the server and are never
    # serialized into API responses.
    paypal_client_id: str = ""
    paypal_client_secret: str = ""
    paypal_environment: str = "sandbox"
    paypal_redirect_uri: str = ""
    paypal_return_url: str = "http://localhost:5173/paypal"
    paypal_scopes: str = "openid email"
    paypal_api_base: str = ""
    paypal_authorize_base: str = ""
    paypal_timeout_seconds: float = 20.0
    paypal_token_encryption_key: str = ""
    paypal_sample_order_id: str = ""

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def max_upload_bytes(self) -> int:
        return self.max_upload_mb * 1024 * 1024

    @property
    def max_request_bytes(self) -> int:
        return self.max_request_mb * 1024 * 1024

    @property
    def paypal_sandbox(self) -> bool:
        return self.paypal_environment.strip().lower() != "live"

    @property
    def paypal_mode(self) -> str:
        return "sandbox" if self.paypal_sandbox else "live"

    @property
    def paypal_configured(self) -> bool:
        return bool(
            self.paypal_client_id.strip() and self.paypal_client_secret.strip()
        )

    @property
    def paypal_effective_redirect_uri(self) -> str:
        configured = self.paypal_redirect_uri.strip()
        if configured:
            return configured
        return f"http://localhost:8000{self.api_prefix}/paypal/oauth/callback"

    @property
    def paypal_api_base_url(self) -> str:
        configured = self.paypal_api_base.strip()
        if configured:
            return configured.rstrip("/")
        return (
            "https://api-m.sandbox.paypal.com"
            if self.paypal_sandbox
            else "https://api-m.paypal.com"
        )

    @property
    def paypal_authorize_base_url(self) -> str:
        configured = self.paypal_authorize_base.strip()
        if configured:
            return configured.rstrip("/")
        return (
            "https://www.sandbox.paypal.com"
            if self.paypal_sandbox
            else "https://www.paypal.com"
        )

    @property
    def paypal_scope_list(self) -> list[str]:
        return [
            scope
            for scope in self.paypal_scopes.replace(",", " ").split()
            if scope
        ]


@lru_cache
def get_settings() -> Settings:
    return Settings()
