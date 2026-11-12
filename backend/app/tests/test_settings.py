def _headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def test_settings_summary_matches_workspace(client, demo_token):
    response = client.get("/api/settings", headers=_headers(demo_token))
    assert response.status_code == 200

    data = response.json()
    assert data["user"]["email"] == "demo@acmecommerce.com"
    assert data["user"]["businessName"] == "Acme Commerce"
    assert data["notifications"] == {
        "deadlineReminders": True,
        "weeklyDigest": True,
        "caseUpdates": True,
    }
    assert data["workspace"]["disputes"] == 26
    assert data["workspace"]["open"] == 9
    assert data["workspace"]["evidenceFiles"] > 0
    assert data["integrations"]["paypal"]["configured"] is False
    assert data["integrations"]["paypal"]["status"] == "not_configured"
    assert data["integrations"]["ai"]["mode"] == "heuristic"


def test_profile_update_is_persisted_and_returned_by_me(client, demo_token):
    response = client.patch(
        "/api/settings/profile",
        json={"name": "Aniket Merchant", "businessName": "Aniket App"},
        headers=_headers(demo_token),
    )
    assert response.status_code == 200
    assert response.json()["user"]["name"] == "Aniket Merchant"
    assert response.json()["user"]["businessName"] == "Aniket App"

    me = client.get("/api/auth/me", headers=_headers(demo_token)).json()
    assert me["name"] == "Aniket Merchant"
    assert me["businessName"] == "Aniket App"

    summary = client.get("/api/settings", headers=_headers(demo_token)).json()
    assert summary["user"]["name"] == "Aniket Merchant"


def test_blank_profile_is_rejected(client, demo_token):
    response = client.patch(
        "/api/settings/profile",
        json={"name": "  ", "businessName": "Acme"},
        headers=_headers(demo_token),
    )
    assert response.status_code == 400


def test_notification_preferences_round_trip(client, demo_token):
    response = client.patch(
        "/api/settings/notifications",
        json={
            "deadlineReminders": False,
            "weeklyDigest": True,
            "caseUpdates": False,
        },
        headers=_headers(demo_token),
    )
    assert response.status_code == 200
    assert response.json()["deadlineReminders"] is False
    assert response.json()["caseUpdates"] is False

    summary = client.get("/api/settings", headers=_headers(demo_token)).json()
    assert summary["notifications"]["deadlineReminders"] is False
    assert summary["notifications"]["weeklyDigest"] is True


def test_password_change_requires_current_and_updates_login(client, demo_token):
    wrong = client.post(
        "/api/settings/password",
        json={"currentPassword": "wrong-password", "newPassword": "NewPass1234"},
        headers=_headers(demo_token),
    )
    assert wrong.status_code == 400

    changed = client.post(
        "/api/settings/password",
        json={"currentPassword": "Demo1234!", "newPassword": "NewPass1234"},
        headers=_headers(demo_token),
    )
    assert changed.status_code == 200

    old_login = client.post(
        "/api/auth/login",
        json={"email": "demo@acmecommerce.com", "password": "Demo1234!"},
    )
    assert old_login.status_code == 401

    new_login = client.post(
        "/api/auth/login",
        json={"email": "demo@acmecommerce.com", "password": "NewPass1234"},
    )
    assert new_login.status_code == 200
