def _headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def test_vault_lists_every_owned_file_with_case_context(client, demo_token):
    response = client.get("/api/evidence", headers=_headers(demo_token))
    assert response.status_code == 200

    data = response.json()
    assert data["stats"]["files"] == data["total"]
    assert data["stats"]["files"] > 0
    assert data["stats"]["ready"] + data["stats"]["needsAttention"] == data["stats"][
        "files"
    ]
    assert data["stats"]["types"] >= 5
    assert data["types"]

    item = data["items"][0]
    assert {"id", "name", "evidenceType", "status", "uploadedAt"} <= set(item)
    assert item["dispute"]["id"].startswith("PP-D-")
    assert item["hasFile"] is False  # seeded demo rows have no stored bytes


def test_vault_filters_by_type_search_and_attention(client, demo_token):
    by_type = client.get(
        "/api/evidence",
        params={"type": "Proof of delivery"},
        headers=_headers(demo_token),
    ).json()
    assert by_type["total"] > 0
    assert all(
        item["evidenceType"] == "Proof of delivery" for item in by_type["items"]
    )

    searched = client.get(
        "/api/evidence",
        params={"q": "PP-D-8492013"},
        headers=_headers(demo_token),
    ).json()
    assert searched["total"] == 2
    assert all(item["dispute"]["id"] == "PP-D-8492013" for item in searched["items"])

    attention = client.get(
        "/api/evidence",
        params={"status": "attention"},
        headers=_headers(demo_token),
    ).json()
    assert attention["total"] == 0


def test_vault_pagination(client, demo_token):
    data = client.get(
        "/api/evidence",
        params={"page": 2, "pageSize": 5},
        headers=_headers(demo_token),
    ).json()
    assert data["page"] == 2
    assert data["pageSize"] == 5
    assert len(data["items"]) == 5
    assert data["totalPages"] > 2


def test_vault_is_tenant_scoped(client):
    signup = client.post(
        "/api/auth/signup",
        json={
            "name": "Vault Merchant",
            "email": "vault-second@example.com",
            "password": "StrongPass123",
        },
    )
    assert signup.status_code == 201
    token = signup.json()["accessToken"]

    data = client.get("/api/evidence", headers=_headers(token)).json()
    assert data["total"] == 0
    assert data["items"] == []
    assert data["stats"]["files"] == 0
