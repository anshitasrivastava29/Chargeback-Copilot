import json
from datetime import UTC, datetime, timedelta
from typing import ClassVar
from urllib.parse import parse_qs

import httpx
import pytest
from cryptography.fernet import Fernet
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.core.timeutils import utcnow
from app.core.token_cipher import encrypt_token
from app.main import create_app
from app.models.paypal import PayPalConnection
from app.services.paypal import PayPalClient
from app.services.paypal import normalize as nz


def _iso(moment: datetime) -> str:
    return moment.strftime("%Y-%m-%dT%H:%M:%SZ")


class PayPalSyncStub:
    """Mock PayPal backend for the Disputes/Payments/Orders/Refunds read path."""

    include_refund_on_first = False
    first_dispute_has_order = False
    capture_overrides: ClassVar[dict[str, tuple[int, dict]]] = {}

    def __init__(self):
        self.calls: list[httpx.Request] = []
        now = datetime.now(UTC)
        self.created = _iso(now - timedelta(days=2))
        self.due = _iso(now + timedelta(days=2))
        self.resolved = _iso(now - timedelta(days=1))

    def __call__(self, request: httpx.Request) -> httpx.Response:
        self.calls.append(request)
        path = request.url.path

        if path == "/v1/oauth2/token":
            return self._token(parse_qs(request.content.decode()))
        if path == "/v1/customer/disputes":
            assert request.headers.get("authorization") in {
                "Bearer app-token-1",
                "Bearer merchant-token-1",
                "Bearer merchant-token-2",
            }
            return httpx.Response(
                200,
                json={
                    "items": [
                        self._first_dispute(),
                        self._second_dispute(),
                        self._unlinked_dispute(),
                    ]
                },
            )

        if path == "/v1/customer/disputes/PP-D-111":
            payload = self._first_dispute()
            if self.include_refund_on_first:
                payload["refund_details"] = {
                    "refund_id": "REF-999",
                    "gross_amount": {"value": "249.00", "currency_code": "USD"},
                    "create_time": self.resolved,
                }
            return httpx.Response(200, json=payload)

        if path == "/v1/customer/disputes/PP-D-222":
            return httpx.Response(200, json=self._second_dispute())

        if path == "/v2/payments/captures/CAP-111":
            override = self.capture_overrides.get("CAP-111")
            if override:
                status_code, body = override
                return httpx.Response(status_code, json=body)
            return httpx.Response(
                200,
                json={
                    "id": "CAP-111",
                    "status": "COMPLETED",
                    "amount": {"value": "249.00", "currency_code": "USD"},
                    "custom_id": "AC-9001",
                    "create_time": self.created,
                },
            )

        if path == "/v2/payments/captures/CAP-222":
            return httpx.Response(
                404,
                json={
                    "name": "INVALID_RESOURCE_ID",
                    "message": "The requested resource was not found.",
                },
            )

        if path == "/v2/payments/refunds/REF-999":
            return httpx.Response(
                200,
                json={
                    "id": "REF-999",
                    "status": "COMPLETED",
                    "amount": {"value": "249.00", "currency_code": "USD"},
                    "create_time": self.resolved,
                },
            )

        if path in {"/v2/checkout/orders/ORDER-888", "/v2/checkout/orders/ORDER-777"}:
            return self._order(path.rsplit("/", 1)[-1])

        return httpx.Response(404, json={"name": "INVALID_RESOURCE_ID"})

    def _token(self, form: dict) -> httpx.Response:
        grant = form.get("grant_type", [""])[0]
        if grant == "client_credentials":
            return httpx.Response(
                200,
                json={
                    "access_token": "app-token-1",
                    "token_type": "Bearer",
                    "expires_in": 3600,
                    "scope": "openid https://uri.paypal.com/services/disputes/read-seller",
                },
            )
        if grant == "refresh_token":
            return httpx.Response(
                200,
                json={
                    "access_token": "merchant-token-2",
                    "refresh_token": "merchant-refresh-2",
                    "token_type": "Bearer",
                    "expires_in": 3600,
                    "scope": "openid disputes/read-seller",
                },
            )
        return httpx.Response(
            200,
            json={
                "access_token": "merchant-token-1",
                "refresh_token": "merchant-refresh-1",
                "token_type": "Bearer",
                "expires_in": 3600,
                "scope": "openid disputes/read-seller",
            },
        )

    def _order(self, order_id: str) -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "id": order_id,
                "status": "COMPLETED",
                "payer": {
                    "name": {"given_name": "PayPal", "surname": "Buyer"},
                    "email_address": "buyer@sandbox.example",
                },
                "purchase_units": [
                    {
                        "items": [
                            {
                                "name": "Aero Wireless Headphones",
                                "sku": "AC-HP-201",
                                "quantity": "1",
                                "unit_amount": {"value": "249.00"},
                            }
                        ],
                        "shipping": {
                            "name": {"full_name": "PayPal Buyer"},
                            "address": {
                                "address_line_1": "482 Willow Lane",
                                "admin_area_2": "Portland",
                                "admin_area_1": "OR",
                                "postal_code": "97205",
                                "country_code": "US",
                            },
                        },
                    }
                ],
            },
        )

    def _first_dispute(self) -> dict:
        payload = {
            "dispute_id": "PP-D-111",
            "create_time": self.created,
            "update_time": self.created,
            "reason": "ITEM_NOT_RECEIVED",
            "status": "OPEN",
            "dispute_state": "OPEN",
            "dispute_life_cycle_stage": "CHARGEBACK",
            "disputed_amount": {"value": "249.00", "currency_code": "USD"},
            "disputed_transactions": [{"seller_transaction_id": "CAP-111"}],
            "extensions": {"response_required_by": self.due},
        }
        if self.first_dispute_has_order:
            payload["checkout_order_id"] = "ORDER-888"
        return payload

    def _second_dispute(self) -> dict:
        return {
            "dispute_id": "PP-D-222",
            "create_time": self.created,
            "update_time": self.resolved,
            "reason": "MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED",
            "status": "RESOLVED",
            "dispute_state": "RESOLVED_BUYER_FAVOR",
            "dispute_life_cycle_stage": "CHARGEBACK",
            "disputed_amount": {"value": "89.99", "currency_code": "USD"},
            "disputed_transactions": [{"seller_transaction_id": "CAP-222"}],
            "refund_details": {
                "refund_id": "REF-222",
                "gross_amount": {"value": "89.99", "currency_code": "USD"},
                "create_time": self.resolved,
            },
        }

    def _unlinked_dispute(self) -> dict:
        return {
            "dispute_id": "PP-D-333",
            "create_time": self.created,
            "reason": "UNAUTHORIZED_TRANSACTION",
            "dispute_state": "OPEN",
            "disputed_amount": {"value": "10.00", "currency_code": "USD"},
        }


@pytest.fixture
def stub() -> PayPalSyncStub:
    return PayPalSyncStub()


@pytest.fixture
def sync_settings(tmp_path) -> Settings:
    return Settings(
        _env_file=None,
        database_url=f"sqlite:///{tmp_path / 'sync.db'}",
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
def sync_app(sync_settings, stub):
    app = create_app(sync_settings)
    with TestClient(app) as client:
        app.state.paypal_client = PayPalClient(
            sync_settings, transport=httpx.MockTransport(stub)
        )
        yield client, app, stub


def test_sync_creates_normalized_disputes_and_transactions(sync_app):
    client, _app, stub = sync_app

    response = client.post("/api/paypal/sync")
    assert response.status_code == 200
    payload = response.json()
    assert payload["tokenSource"] == "application"
    assert payload["fetched"] == 3
    assert payload["created"] == 2
    assert payload["skipped"] == 1
    assert payload["transactionsCreated"] == 2
    assert payload["ordersEnriched"] == 0
    assert payload["refundsObserved"] == 1

    inbox = client.get("/api/disputes", params={"pageSize": 100}).json()
    by_id = {item["id"]: item for item in inbox["items"]}

    imported = by_id["PP-D-111"]
    assert imported["reason"] == "Item not received"
    assert imported["status"] == "open"
    assert imported["priority"] == "high"
    assert imported["amount"] == 249.0
    assert imported["orderId"] == "AC-9001"
    assert imported["buyer"]["name"] == "PayPal customer"

    resolved = by_id["PP-D-222"]
    assert resolved["reason"] == "Item not as described"
    assert resolved["status"] == "lost"
    assert resolved["priority"] == "low"
    assert resolved["amount"] == 89.99
    assert resolved["orderId"] == "CAP-222"

    detail = client.get("/api/disputes/PP-D-111").json()
    assert detail["order"]["id"] == "AC-9001"
    assert any(
        activity["label"] == "Imported from PayPal" for activity in detail["activity"]
    )

    refund_detail = client.get("/api/disputes/PP-D-222").json()
    assert refund_detail["refund"]["key"] == "refunded"
    assert any(
        activity["label"] == "Refund issued via PayPal"
        for activity in refund_detail["activity"]
    )

    transaction = client.get("/api/transactions/CAP-111").json()
    assert transaction["orderId"] == "AC-9001"
    assert transaction["amount"] == 249.0
    assert transaction["status"] == "completed"

    token_calls = [
        call for call in stub.calls if call.url.path == "/v1/oauth2/token"
    ]
    assert parse_qs(token_calls[0].content.decode())["grant_type"] == [
        "client_credentials"
    ]
    wire = json.dumps([call.content.decode() for call in stub.calls])
    assert "sandbox-client-secret" not in wire


def test_sync_is_idempotent_and_updates_existing_rows(sync_app):
    client, _app, _ = sync_app

    first = client.post("/api/paypal/sync")
    assert first.status_code == 200
    assert first.json()["created"] == 2

    second = client.post("/api/paypal/sync")
    assert second.status_code == 200
    payload = second.json()
    assert payload["created"] == 0
    assert payload["updated"] == 2
    assert payload["transactionsCreated"] == 0
    assert payload["transactionsUpdated"] == 2

    inbox = client.get("/api/disputes", params={"pageSize": 100}).json()
    assert (
        len([item for item in inbox["items"] if item["id"] == "PP-D-111"]) == 1
    )


def test_normalizer_mappings():
    assert (
        nz.normalize_reason("MERCHANDISE_OR_SERVICE_NOT_RECEIVED")
        == "Item not received"
    )
    assert nz.normalize_reason("DUPLICATE_TRANSACTION") == "Duplicate charge"
    assert nz.normalize_reason("CREDIT_NOT_PROCESSED") == "Credit not processed"
    assert nz.normalize_reason("SOMETHING_NEW") == "Item not as described"
    assert nz.normalize_status("RESOLVED_SELLER_FAVOR") == "won"
    assert nz.normalize_status("RESOLVED_WITH_SELLER_PROTECTION") == "won"
    assert nz.normalize_status("RESOLVED_BUYER_FAVOR") == "lost"
    assert nz.normalize_status("WAITING_FOR_SELLER_RESPONSE") == "open"
    assert nz.normalize_status("UNDER_REVIEW") == "open"

    parsed = nz.parse_paypal_time("2026-11-01T10:20:30Z")
    assert parsed is not None and parsed.year == 2026 and parsed.hour == 10

    # Real dispute payloads nest the transaction under disputed_transactions.
    normalized = nz.normalize_dispute(
        {
            "dispute_id": "PP-D-999",
            "dispute_state": "OPEN",
            "disputed_transactions": [{"seller_transaction_id": "CAP-999"}],
        }
    )
    assert normalized["transaction_ref"] == "CAP-999"


def test_permissions_reports_authorized_and_unverified(sync_app):
    client, _app, _stub = sync_app

    response = client.get("/api/paypal/permissions")
    assert response.status_code == 200
    payload = response.json()
    assert payload["tokenSource"] == "application"

    checks = {check["api"]: check for check in payload["checks"]}
    assert checks["Disputes"]["status"] == "authorized"
    assert checks["Payments"]["status"] == "authorized"
    assert checks["Refunds"]["status"] == "unverified"
    assert checks["Orders"]["status"] == "unverified"
    assert "sandbox-client-secret" not in json.dumps(payload)


def test_permissions_verify_orders_and_refunds_with_samples(sync_settings, stub):
    settings = sync_settings.model_copy(
        update={"paypal_sample_order_id": "ORDER-777"}
    )
    stub.include_refund_on_first = True
    app = create_app(settings)
    with TestClient(app) as client:
        app.state.paypal_client = PayPalClient(
            settings, transport=httpx.MockTransport(stub)
        )
        response = client.get("/api/paypal/permissions")
        assert response.status_code == 200
        checks = {check["api"]: check for check in response.json()["checks"]}
        assert checks["Orders"]["status"] == "authorized"
        assert checks["Refunds"]["status"] == "authorized"


def test_permissions_reports_forbidden_when_app_lacks_api(sync_settings):
    class ForbiddenCaptureStub(PayPalSyncStub):
        capture_overrides: ClassVar[dict[str, tuple[int, dict]]] = {
            "CAP-111": (403, {"error": "not_authorized", "message": "No permission"})
        }

    app = create_app(sync_settings)
    with TestClient(app) as client:
        app.state.paypal_client = PayPalClient(
            sync_settings,
            transport=httpx.MockTransport(ForbiddenCaptureStub()),
        )
        response = client.get("/api/paypal/permissions")
        assert response.status_code == 200
        checks = {check["api"]: check for check in response.json()["checks"]}
        assert checks["Payments"]["status"] == "forbidden"


def test_sync_uses_merchant_token_when_scope_allows(sync_app):
    client, app, stub = sync_app
    settings: Settings = app.state.settings

    with app.state.session_factory() as db:
        db.add(
            PayPalConnection(
                merchant_id=1,
                environment="sandbox",
                status="connected",
                scopes="openid https://uri.paypal.com/services/disputes/read-seller",
                access_token_encrypted=encrypt_token("merchant-token-1", settings),
                refresh_token_encrypted=encrypt_token(
                    "merchant-refresh-1", settings
                ),
                access_token_expires_at=utcnow() + timedelta(hours=1),
            )
        )
        db.commit()

    response = client.post("/api/paypal/sync")
    assert response.status_code == 200
    assert response.json()["tokenSource"] == "merchant"

    dispute_calls = [
        call for call in stub.calls if call.url.path == "/v1/customer/disputes"
    ]
    assert dispute_calls[0].headers["authorization"] == "Bearer merchant-token-1"


def test_sync_requires_configuration(sync_settings):
    locked = sync_settings.model_copy(
        update={"paypal_client_id": "", "paypal_client_secret": ""}
    )
    app = create_app(locked)
    with TestClient(app) as client:
        app.state.paypal_client = PayPalClient(locked)

        sync_response = client.post("/api/paypal/sync")
        assert sync_response.status_code == 503
        assert "PAYPAL_CLIENT_ID" in sync_response.json()["detail"]

        permissions_response = client.get("/api/paypal/permissions")
        assert permissions_response.status_code == 503


def test_sync_enriches_buyer_from_checkout_order(sync_app):
    client, _app, stub = sync_app
    stub.first_dispute_has_order = True

    response = client.post("/api/paypal/sync")
    assert response.status_code == 200
    assert response.json()["ordersEnriched"] == 1

    inbox = client.get("/api/disputes", params={"pageSize": 100}).json()
    imported = next(item for item in inbox["items"] if item["id"] == "PP-D-111")
    assert imported["buyer"]["name"] == "PayPal Buyer"
    assert imported["buyer"]["email"] == "buyer@sandbox.example"

    transaction = client.get("/api/transactions/CAP-111").json()
    assert transaction["buyerEmail"] == "buyer@sandbox.example"
    assert transaction["items"][0]["name"] == "Aero Wireless Headphones"
    assert transaction["shippingAddress"]["line1"] == "482 Willow Lane"
    assert transaction["shippingAddress"]["country"] == "US"


class PagedSyncStub(PayPalSyncStub):
    """Serves the dispute list across two pages via a next-page link."""

    def __call__(self, request: httpx.Request) -> httpx.Response:
        if request.url.path == "/v1/customer/disputes":
            self.calls.append(request)
            page = request.url.params.get("page", "1")
            if page == "1":
                return httpx.Response(
                    200,
                    json={
                        "items": [self._first_dispute()],
                        "links": [
                            {
                                "rel": "next",
                                "href": "https://api-m.sandbox.paypal.com"
                                "/v1/customer/disputes?page=2&page_size=50",
                            }
                        ],
                    },
                )
            return httpx.Response(
                200,
                json={
                    "items": [self._second_dispute(), self._unlinked_dispute()],
                    "links": [
                        {
                            "rel": "self",
                            "href": "https://api-m.sandbox.paypal.com"
                            "/v1/customer/disputes?page=2&page_size=50",
                        }
                    ],
                },
            )
        return super().__call__(request)


def test_sync_follows_next_page_links(sync_app):
    client, app, _stub = sync_app
    paged = PagedSyncStub()
    app.state.paypal_client = PayPalClient(
        app.state.paypal_client.settings, transport=httpx.MockTransport(paged)
    )

    response = client.post("/api/paypal/sync")
    assert response.status_code == 200
    payload = response.json()
    assert payload["fetched"] == 3
    assert payload["created"] == 2
    assert payload["skipped"] == 1

    requested_pages = [
        call.url.params["page"]
        for call in paged.calls
        if call.url.path == "/v1/customer/disputes"
    ]
    assert requested_pages == ["1", "2"]

    inbox = client.get("/api/disputes", params={"pageSize": 100}).json()
    ids = {item["id"] for item in inbox["items"]}
    assert {"PP-D-111", "PP-D-222"} <= ids
