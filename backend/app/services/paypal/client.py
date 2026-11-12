import time
from dataclasses import dataclass
from urllib.parse import urlencode

import httpx

from app.core.config import Settings


class PayPalAPIError(Exception):
    def __init__(self, code: str, message: str, status_code: int | None = None):
        self.code = code
        self.status_code = status_code
        super().__init__(message)


@dataclass(frozen=True)
class PayPalTokens:
    access_token: str
    refresh_token: str | None
    expires_in: int | None
    refresh_token_expires_in: int | None
    scope: str | None


@dataclass(frozen=True)
class PayPalUserInfo:
    payer_id: str | None
    email: str | None
    name: str | None


def _optional_int(value: object) -> int | None:
    try:
        parsed = int(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return None
    return parsed if parsed > 0 else None


def _optional_str(value: object) -> str | None:
    return value if isinstance(value, str) and value.strip() else None


class PayPalClient:
    def __init__(
        self,
        settings: Settings,
        transport: httpx.BaseTransport | None = None,
    ):
        self.settings = settings
        self._transport = transport
        self._app_token: str | None = None
        self._app_token_expires_at: float = 0.0

    @property
    def configured(self) -> bool:
        return self.settings.paypal_configured

    def build_authorization_url(self, state: str) -> str:
        if not self.configured:
            raise PayPalAPIError(
                "not_configured", "PayPal sandbox credentials are not configured."
            )
        params = {
            "flowEntry": "static",
            "client_id": self.settings.paypal_client_id.strip(),
            "response_type": "code",
            "scope": " ".join(self.settings.paypal_scope_list),
            "redirect_uri": self.settings.paypal_effective_redirect_uri,
            "state": state,
        }
        return f"{self.settings.paypal_authorize_base_url}/connect?{urlencode(params)}"

    def exchange_code(self, code: str) -> PayPalTokens:
        payload = self._request(
            "POST",
            "/v1/oauth2/token",
            data={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": self.settings.paypal_effective_redirect_uri,
            },
            auth=(
                self.settings.paypal_client_id.strip(),
                self.settings.paypal_client_secret.strip(),
            ),
            headers={"Accept": "application/json", "Accept-Language": "en_US"},
        )
        return self._tokens(payload)

    def refresh_access_token(self, refresh_token: str) -> PayPalTokens:
        payload = self._request(
            "POST",
            "/v1/oauth2/token",
            data={"grant_type": "refresh_token", "refresh_token": refresh_token},
            auth=(
                self.settings.paypal_client_id.strip(),
                self.settings.paypal_client_secret.strip(),
            ),
            headers={"Accept": "application/json", "Accept-Language": "en_US"},
        )
        return self._tokens(payload)

    def fetch_userinfo(self, access_token: str) -> PayPalUserInfo:
        payload = self._request(
            "GET",
            "/v1/identity/oauth2/userinfo",
            params={"schema": "paypalv1.1"},
            headers={
                "Authorization": f"Bearer {access_token}",
                "Accept": "application/json",
            },
        )
        full_name = _optional_str(payload.get("name"))
        if full_name is None:
            parts = [
                _optional_str(payload.get("given_name")),
                _optional_str(payload.get("family_name")),
            ]
            full_name = " ".join(part for part in parts if part) or None

        return PayPalUserInfo(
            payer_id=_optional_str(payload.get("payer_id"))
            or _optional_str(payload.get("user_id")),
            email=_optional_str(payload.get("email")),
            name=full_name,
        )

    def get_app_access_token(self) -> str:
        """Client-credentials token for merchant APIs the app is enabled for."""
        now = time.monotonic()
        if self._app_token and now < self._app_token_expires_at - 60:
            return self._app_token

        payload = self._request(
            "POST",
            "/v1/oauth2/token",
            data={"grant_type": "client_credentials"},
            auth=(
                self.settings.paypal_client_id.strip(),
                self.settings.paypal_client_secret.strip(),
            ),
            headers={"Accept": "application/json", "Accept-Language": "en_US"},
        )
        tokens = self._tokens(payload)
        expires_in = tokens.expires_in or 300
        self._app_token = tokens.access_token
        self._app_token_expires_at = now + expires_in
        return tokens.access_token

    def list_disputes(
        self,
        access_token: str,
        *,
        # Live Disputes API rejects page_size above 50 with INVALID_REQUEST.
        page_size: int = 50,
        page: int = 1,
    ) -> dict:
        return self._request(
            "GET",
            "/v1/customer/disputes",
            params={"page_size": page_size, "page": page},
            headers=self._bearer(access_token),
        )

    def get_dispute(self, access_token: str, dispute_id: str) -> dict:
        return self._request(
            "GET",
            f"/v1/customer/disputes/{dispute_id}",
            headers=self._bearer(access_token),
        )

    def get_order(self, access_token: str, order_id: str) -> dict:
        return self._request(
            "GET",
            f"/v2/checkout/orders/{order_id}",
            headers=self._bearer(access_token),
        )

    def get_capture(self, access_token: str, capture_id: str) -> dict:
        return self._request(
            "GET",
            f"/v2/payments/captures/{capture_id}",
            headers=self._bearer(access_token),
        )

    def get_refund(self, access_token: str, refund_id: str) -> dict:
        return self._request(
            "GET",
            f"/v2/payments/refunds/{refund_id}",
            headers=self._bearer(access_token),
        )

    @staticmethod
    def _bearer(access_token: str) -> dict:
        return {
            "Authorization": f"Bearer {access_token}",
            "Accept": "application/json",
        }

    def _tokens(self, payload: dict) -> PayPalTokens:
        access_token = _optional_str(payload.get("access_token"))
        if access_token is None:
            raise PayPalAPIError(
                "invalid_response", "PayPal returned an unexpected token response."
            )
        return PayPalTokens(
            access_token=access_token,
            refresh_token=_optional_str(payload.get("refresh_token")),
            expires_in=_optional_int(payload.get("expires_in")),
            refresh_token_expires_in=_optional_int(
                payload.get("refresh_token_expires_in")
            ),
            scope=_optional_str(payload.get("scope")),
        )

    def _request(self, method: str, path: str, **kwargs) -> dict:
        url = f"{self.settings.paypal_api_base_url}{path}"
        try:
            with httpx.Client(
                timeout=self.settings.paypal_timeout_seconds,
                transport=self._transport,
                # Malformed proxy vars on some machines (e.g. NO_PROXY=[::1])
                # crash httpx during mount parsing; PayPal calls never route
                # through system proxies anyway.
                trust_env=False,
            ) as client:
                response = client.request(method, url, **kwargs)
        except httpx.HTTPError as exc:
            raise PayPalAPIError(
                "network_error", "Could not reach PayPal. Please try again."
            ) from exc

        if response.status_code >= 400:
            payload: dict = {}
            try:
                parsed = response.json()
                if isinstance(parsed, dict):
                    payload = parsed
            except ValueError:
                payload = {}
            code = (
                _optional_str(payload.get("error"))
                or _optional_str(payload.get("name"))
                or "http_error"
            )
            message = (
                _optional_str(payload.get("error_description"))
                or _optional_str(payload.get("message"))
                or f"PayPal returned HTTP {response.status_code}."
            )
            raise PayPalAPIError(
                code, message, status_code=response.status_code
            )

        try:
            parsed = response.json()
        except ValueError as exc:
            raise PayPalAPIError(
                "invalid_response", "PayPal returned a non-JSON response."
            ) from exc
        if not isinstance(parsed, dict):
            raise PayPalAPIError(
                "invalid_response", "PayPal returned an unexpected response."
            )
        return parsed
