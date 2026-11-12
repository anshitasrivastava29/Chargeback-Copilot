from datetime import UTC, datetime, timedelta

import jwt
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import create_app


def test_dashboard_stats(client):
    response = client.get("/api/dashboard/stats")
    assert response.status_code == 200
    stats = response.json()
    assert stats["total"] == 26
    assert stats["open"] == 9
    assert stats["won"] == 11
    assert stats["lost"] == 6
    assert stats["winRate"] == 65
    assert stats["openValue"] > 0
    assert stats["reasons"] == 6
    assert stats["pendingActions"] == 9
    assert stats["overdueActions"] >= 1


def test_dashboard_range_filter(client):
    recent = client.get("/api/dashboard/stats?days=30").json()
    assert 0 < recent["total"] < 26


def test_pending_actions_shape_and_ordering(client):
    response = client.get("/api/dashboard/pending-actions?limit=5")
    assert response.status_code == 200
    actions = response.json()
    assert len(actions) == 5
    first = actions[0]
    assert set(first) >= {"id", "disputeId", "type", "title", "dispute", "due"}
    assert first["type"] in {"evidence", "response", "decision"}
    assert first["dispute"]["id"] == first["disputeId"]
    days = [action["due"]["days"] for action in actions if action["due"]]
    assert days == sorted(days)


def test_transactions_endpoints(client):
    listing = client.get("/api/transactions?pageSize=3")
    assert listing.status_code == 200
    payload = listing.json()
    assert payload["total"] == 26
    transaction = payload["items"][0]
    assert transaction["disputeId"]
    assert transaction["tracking"] is not None

    detail = client.get(f"/api/transactions/{transaction['id']}")
    assert detail.status_code == 200
    assert detail.json()["id"] == transaction["id"]

    assert client.get("/api/transactions/UNKNOWN").status_code == 404


def test_signup_login_and_tenant_isolation(client):
    signup = client.post(
        "/api/auth/signup",
        json={
            "name": "New Merchant",
            "email": "new.merchant@example.com",
            "password": "StrongPass123",
            "businessName": "New Shop",
        },
    )
    assert signup.status_code == 201
    payload = signup.json()
    assert payload["user"]["businessName"] == "New Shop"
    token = payload["accessToken"]

    headers = {"Authorization": f"Bearer {token}"}
    me = client.get("/api/auth/me", headers=headers)
    assert me.status_code == 200
    assert me.json()["email"] == "new.merchant@example.com"

    empty = client.get("/api/disputes", headers=headers)
    assert empty.status_code == 200
    assert empty.json()["total"] == 0

    duplicate = client.post(
        "/api/auth/signup",
        json={
            "name": "New Merchant",
            "email": "new.merchant@example.com",
            "password": "StrongPass123",
        },
    )
    assert duplicate.status_code == 409

    bad_login = client.post(
        "/api/auth/login",
        json={"email": "new.merchant@example.com", "password": "wrong-password"},
    )
    assert bad_login.status_code == 401


def test_expired_token_is_rejected(client):
    settings = client.app.state.settings
    expired = jwt.encode(
        {"sub": "1", "exp": datetime.now(UTC) - timedelta(minutes=5)},
        settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
    )
    response = client.get(
        "/api/disputes", headers={"Authorization": f"Bearer {expired}"}
    )
    assert response.status_code == 401

    garbage = client.get(
        "/api/disputes", headers={"Authorization": "Bearer not-a-jwt"}
    )
    assert garbage.status_code == 401


def test_auth_can_be_required_in_production_mode(tmp_path):
    settings = Settings(
        database_url=f"sqlite:///{tmp_path / 'secured.db'}",
        storage_dir=str(tmp_path / "storage"),
        seed_demo_data=True,
        ai_mode="heuristic",
        require_auth=True,
        jwt_secret="test-secret-key-that-is-at-least-32-bytes",
    )
    app = create_app(settings)
    with TestClient(app) as secured:
        assert secured.get("/api/disputes").status_code == 401
        login = secured.post(
            "/api/auth/login",
            json={"email": "demo@acmecommerce.com", "password": "Demo1234!"},
        )
        assert login.status_code == 200
        token = login.json()["accessToken"]
        allowed = secured.get(
            "/api/disputes", headers={"Authorization": f"Bearer {token}"}
        )
        assert allowed.status_code == 200
        assert allowed.json()["total"] == 26
