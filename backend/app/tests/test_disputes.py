def test_health_reports_service_status(client):
    response = client.get("/api/health")

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["aiMode"] == "heuristic"
    assert payload["llmConfigured"] is False


def test_list_disputes_matches_frontend_contract(client):
    response = client.get("/api/disputes?pageSize=5")

    assert response.status_code == 200
    payload = response.json()
    assert payload["total"] == 26
    assert payload["pageSize"] == 5
    assert payload["counts"] == {"all": 26, "open": 9, "won": 11, "lost": 6}

    first = payload["items"][0]
    assert set(first) >= {
        "id",
        "buyer",
        "reason",
        "amount",
        "status",
        "priority",
        "openedAt",
        "dueAt",
        "resolvedAt",
        "evidence",
        "transactionId",
        "orderId",
    }
    assert isinstance(first["openedAt"], int)
    assert first["openedAt"] > 10**12
    assert set(first["evidence"]) >= {"uploaded", "required"}


def test_list_filters_search_sort_and_pagination(client):
    open_page = client.get("/api/disputes?status=open&pageSize=50").json()
    assert open_page["total"] == 9
    assert all(item["status"] == "open" for item in open_page["items"])

    searched = client.get("/api/disputes?q=jordan").json()
    assert searched["total"] == 1
    assert searched["items"][0]["id"] == "PP-D-8492013"

    by_amount = client.get("/api/disputes?sort=amount&pageSize=2").json()
    amounts = [item["amount"] for item in by_amount["items"]]
    assert amounts == sorted(amounts, reverse=True)

    page_two = client.get("/api/disputes?pageSize=10&page=2").json()
    assert page_two["page"] == 2
    assert len(page_two["items"]) == 10


def test_dispute_detail_contains_case_context(client):
    response = client.get("/api/disputes/PP-D-8492013")

    assert response.status_code == 200
    detail = response.json()
    assert detail["id"] == "PP-D-8492013"
    assert detail["customer"]["emailVerified"] is True
    assert detail["order"]["id"] == "AC-10482"
    assert detail["order"]["total"] == 249.0
    assert detail["tracking"]["available"] is True
    assert detail["tracking"]["carrier"] in {"UPS", "USPS", "FedEx", "DHL Express"}
    assert detail["refund"]["label"]
    assert isinstance(detail["activity"], list)
    assert len(detail["evidenceFiles"]) == 2
    assert detail["submittedAt"] is None


def test_dispute_detail_404_and_validation(client):
    assert client.get("/api/disputes/PP-D-0000000").status_code == 404
    assert client.get("/api/disputes?status=bogus").status_code == 422
    assert client.get("/api/disputes?pageSize=500").status_code == 422
