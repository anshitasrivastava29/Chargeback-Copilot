from app.services.seed import DEMO_EMAIL, DEMO_PASSWORD


def _headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def test_reports_summary_reconciles_with_seed(client, demo_token):
    response = client.get("/api/reports/summary", headers=_headers(demo_token))
    assert response.status_code == 200

    data = response.json()
    totals = data["totals"]
    assert totals["total"] == 26
    assert totals["open"] == 9
    assert totals["won"] == 11
    assert totals["lost"] == 6
    assert totals["resolved"] == 17
    assert totals["winRate"] == 65

    assert sum(item["total"] for item in data["reasons"]) == 26
    assert sum(item["total"] for item in data["monthly"]) == 26
    assert data["evidence"]["documents"] > 0
    assert 0 <= data["evidence"]["coveragePercent"] <= 100
    assert data["deadlines"]["overdue"] >= 1


def test_reports_range_filter_and_validation(client, demo_token):
    response = client.get(
        "/api/reports/summary", params={"days": 30}, headers=_headers(demo_token)
    )
    assert response.status_code == 200
    data = response.json()
    assert data["rangeDays"] == 30
    assert data["totals"]["total"] < 26
    assert (
        data["totals"]["open"]
        + data["totals"]["won"]
        + data["totals"]["lost"]
        == data["totals"]["total"]
    )

    invalid = client.get(
        "/api/reports/summary", params={"days": 0}, headers=_headers(demo_token)
    )
    assert invalid.status_code == 422


def test_reports_are_tenant_scoped(client):
    signup = client.post(
        "/api/auth/signup",
        json={
            "name": "Second Merchant",
            "email": "reports-second@example.com",
            "password": "StrongPass123",
            "businessName": "Second Co",
        },
    )
    assert signup.status_code == 201
    token = signup.json()["accessToken"]

    data = client.get("/api/reports/summary", headers=_headers(token)).json()
    assert data["totals"]["total"] == 0
    assert data["monthly"] == []
    assert data["reasons"] == []


def test_demo_login_still_works_after_reports(client):
    response = client.post(
        "/api/auth/login", json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD}
    )
    assert response.status_code == 200
