import json
from urllib.parse import parse_qs, urlsplit

import httpx
import pytest
from cryptography.fernet import Fernet
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.config import Settings
from app.core.token_cipher import decrypt_token
from app.main import create_app
from app.models.paypal import PayPalConnection
from app.services.paypal import PayPalClient

CALLBACK_PATH = "/api/paypal/oauth/callback"


class PayPalStub:
    def __init__(self):
        self.calls: list[httpx.Request] = []

    def __call__(self, request: httpx.Request) -> httpx.Response:
        self.calls.append(request)

        if request.url.path == "/v1/oauth2/token":
            form = parse_qs(request.content.decode())
            grant = form.get("grant_type", [""])[0]
            authorization = request.headers.get("authorization", "")
            assert authorization.startswith("Basic ")

            if grant == "authorization_code":
                code = form.get("code", [""])[0]
                if code == "expired-code":
                    return httpx.Response(
                        400,
                        json={
                            "error": "invalid_grant",
                            "error_description": "Authorization code does not exist",
                        },
                    )
                if code == "bad-client":
                    return httpx.Response(
                        401,
                        json={
                            "error": "invalid_client",
                            "error_description": "Client Authentication failed",
                        },
                    )
                return httpx.Response(
                    200,
                    json={
                        "access_token": "access-token-1",
                        "refresh_token": "refresh-token-1",
                        "token_type": "Bearer",
                        "expires_in": 3600,
                        "refresh_token_expires_in": 86400,
                        "scope": "openid email",
                    },
                )

            if grant == "refresh_token":
                refresh_token = form.get("refresh_token", [""])[0]
                if refresh_token == "stale-refresh":
                    return httpx.Response(
                        400,
                        json={
                            "error": "invalid_grant",
                            "error_description": "Refresh token is invalid",
                        },
                    )
                return httpx.Response(
                    200,
                    json={
                        "access_token": "access-token-2",
                        "refresh_token": "refresh-token-2",
                        "token_type": "Bearer",
                        "expires_in": 3600,
                        "scope": "openid email",
                    },
                )

        if request.url.path == "/v1/identity/oauth2/userinfo":
            assert request.headers.get("authorization") == "Bearer access-token-1"
            return httpx.Response(
                200,
                json={
                    "user_id": "PAYER123",
                    "payer_id": "PAYER123",
                    "email": "merchant@sandbox.example",
                    "name": "Sandbox Merchant",
                },
            )

        return httpx.Response(404, json={"error": "not_found"})


@pytest.fixture
def stub() -> PayPalStub:
    return PayPalStub()


@pytest.fixture
def paypal_settings(tmp_path) -> Settings:
    return Settings(
        _env_file=None,
        database_url=f"sqlite:///{tmp_path / 'paypal.db'}",
        storage_dir=str(tmp_path / "storage"),
        seed_demo_data=True,
        ai_mode="heuristic",
        require_auth=False,
        jwt_secret="test-secret-key-that-is-at-least-32-bytes",
        paypal_client_id="sandbox-client-id",
        paypal_client_secret="sandbox-client-secret",
        paypal_redirect_uri="http://testserver/api/paypal/oauth/callback",
        paypal_return_url="http://localhost:5173/paypal",
        paypal_token_encryption_key=Fernet.generate_key().decode(),
    )


@pytest.fixture
def paypal_app(paypal_settings, stub):
    app = create_app(paypal_settings)
    with TestClient(app) as client:
        app.state.paypal_client = PayPalClient(
            paypal_settings, transport=httpx.MockTransport(stub)
        )
        yield client, app


def _start_connection(client: TestClient) -> tuple[str, str]:
    response = client.post("/api/paypal/connect")
    assert response.status_code == 200
    payload = response.json()
    query = parse_qs(urlsplit(payload["authorizationUrl"]).query)
    return query["state"][0], payload["authorizationUrl"]


def _callback_url(code: str, state: str) -> str:
    return f"{CALLBACK_PATH}?code={code}&state={state}"


def test_unconfigured_connection_and_connect_guarded(client):
    status_response = client.get("/api/paypal/connection")
    assert status_response.status_code == 200
    status_payload = status_response.json()
    assert status_payload["configured"] is False
    assert status_payload["connected"] is False
    assert status_payload["environment"] == "sandbox"
    assert status_payload["sandbox"] is True
    assert status_payload["redirectUri"].endswith(CALLBACK_PATH)

    connect_response = client.post("/api/paypal/connect")
    assert connect_response.status_code == 503
    assert "PAYPAL_CLIENT_ID" in connect_response.json()["detail"]


def test_authorization_url_is_scoped_and_hides_secret(paypal_app):
    client, _ = paypal_app
    state, authorization_url = _start_connection(client)

    parsed = urlsplit(authorization_url)
    query = parse_qs(parsed.query)
    assert parsed.scheme == "https"
    assert parsed.netloc == "www.sandbox.paypal.com"
    assert parsed.path == "/connect"
    assert query["flowEntry"] == ["static"]
    assert query["client_id"] == ["sandbox-client-id"]
    assert query["response_type"] == ["code"]
    assert query["scope"] == ["openid email"]
    assert query["redirect_uri"] == ["http://testserver/api/paypal/oauth/callback"]
    assert query["state"] == [state]
    assert len(state) >= 32
    assert "sandbox-client-secret" not in authorization_url


def test_callback_stores_encrypted_tokens_and_hides_them(paypal_app, paypal_settings):
    client, app = paypal_app
    state, _ = _start_connection(client)

    callback = client.get(
        _callback_url("sandbox-code", state), follow_redirects=False
    )
    assert callback.status_code == 303
    assert callback.headers["location"] == "http://localhost:5173/paypal?paypal=connected"

    connection_response = client.get("/api/paypal/connection")
    assert connection_response.status_code == 200
    payload = connection_response.json()
    assert payload["connected"] is True
    assert payload["status"] == "connected"
    assert payload["accountEmail"] == "merchant@sandbox.example"
    assert payload["accountName"] == "Sandbox Merchant"
    assert payload["payerId"] == "PAYER123"
    assert payload["scopes"] == ["openid", "email"]
    assert payload["tokenExpiresAt"] > 0
    assert payload["lastVerifiedAt"] > 0

    serialized = json.dumps(payload)
    assert "sandbox-client-secret" not in serialized
    assert "access-token-1" not in serialized
    assert "refresh-token-1" not in serialized
    assert "access_token" not in serialized
    assert "accessToken" not in serialized

    with app.state.session_factory() as db:
        connection = db.scalar(select(PayPalConnection))
        assert connection is not None
        assert connection.access_token_encrypted != "access-token-1"
        assert connection.refresh_token_encrypted != "refresh-token-1"
        assert (
            decrypt_token(connection.access_token_encrypted, paypal_settings)
            == "access-token-1"
        )
        assert (
            decrypt_token(connection.refresh_token_encrypted, paypal_settings)
            == "refresh-token-1"
        )


def test_oauth_state_is_single_use(paypal_app):
    client, _ = paypal_app
    state, _ = _start_connection(client)

    first = client.get(
        _callback_url("sandbox-code", state), follow_redirects=False
    )
    assert first.headers["location"].endswith("paypal=connected")

    replay = client.get(
        _callback_url("sandbox-code", state), follow_redirects=False
    )
    assert replay.status_code == 303
    assert replay.headers["location"].endswith(
        "paypal=error&reason=invalid_state"
    )
    assert client.get("/api/paypal/connection").json()["connected"] is True

    missing_state = client.get(
        f"{CALLBACK_PATH}?code=sandbox-code", follow_redirects=False
    )
    assert missing_state.headers["location"].endswith(
        "paypal=error&reason=invalid_state"
    )


def test_callback_maps_paypal_rejections_without_exposing_details(paypal_app):
    client, _ = paypal_app

    expired_state, _ = _start_connection(client)
    rejected = client.get(
        _callback_url("expired-code", expired_state), follow_redirects=False
    )
    assert rejected.headers["location"].endswith(
        "paypal=error&reason=authorization_rejected"
    )

    bad_client_state, _ = _start_connection(client)
    misconfigured = client.get(
        _callback_url("bad-client", bad_client_state), follow_redirects=False
    )
    assert misconfigured.headers["location"].endswith(
        "paypal=error&reason=configuration_error"
    )

    payload = client.get("/api/paypal/connection").json()
    assert payload["connected"] is False
    assert "Client Authentication failed" not in json.dumps(payload)


def test_refresh_rotates_tokens(paypal_app, paypal_settings, stub):
    client, app = paypal_app
    state, _ = _start_connection(client)
    client.get(_callback_url("sandbox-code", state), follow_redirects=False)

    response = client.post("/api/paypal/connection/refresh")
    assert response.status_code == 200
    payload = response.json()
    assert payload["connected"] is True
    assert payload["lastVerifiedAt"] > 0
    assert "access-token-2" not in json.dumps(payload)

    grants = [
        parse_qs(call.content.decode()).get("grant_type", [""])[0]
        for call in stub.calls
        if call.url.path == "/v1/oauth2/token"
    ]
    assert grants == ["authorization_code", "refresh_token"]

    with app.state.session_factory() as db:
        connection = db.scalar(select(PayPalConnection))
        assert (
            decrypt_token(connection.access_token_encrypted, paypal_settings)
            == "access-token-2"
        )
        assert (
            decrypt_token(connection.refresh_token_encrypted, paypal_settings)
            == "refresh-token-2"
        )


def test_disconnect_removes_stored_tokens(paypal_app):
    client, app = paypal_app
    state, _ = _start_connection(client)
    client.get(_callback_url("sandbox-code", state), follow_redirects=False)

    response = client.post("/api/paypal/connection/disconnect")
    assert response.status_code == 200
    assert response.json()["connected"] is False
    assert response.json()["status"] == "disconnected"

    with app.state.session_factory() as db:
        assert db.scalar(select(PayPalConnection)) is None

    assert client.get("/api/paypal/connection").json()["connected"] is False
    assert client.post("/api/paypal/connection/refresh").status_code == 409


def test_connection_endpoints_require_auth_when_enabled(paypal_settings):
    secured_settings = paypal_settings.model_copy(update={"require_auth": True})
    app = create_app(secured_settings)
    with TestClient(app) as secured:
        assert secured.get("/api/paypal/connection").status_code == 401
        assert secured.post("/api/paypal/connect").status_code == 401

        login = secured.post(
            "/api/auth/login",
            json={"email": "demo@acmecommerce.com", "password": "Demo1234!"},
        )
        assert login.status_code == 200
        headers = {"Authorization": f"Bearer {login.json()['accessToken']}"}
        assert secured.get("/api/paypal/connection", headers=headers).status_code == 200
