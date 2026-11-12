from app.services.ai.drafts import validate_llm_draft


def test_ai_analysis_payload(client):
    response = client.get("/api/disputes/PP-D-8492013/ai-analysis")

    assert response.status_code == 200
    analysis = response.json()
    assert analysis["classification"]["category"] == "Consumer dispute"
    assert analysis["classification"]["type"] == "Merchandise not received"
    assert 70 <= analysis["classification"]["confidence"] <= 98
    assert analysis["risk"]["level"] in {"low", "medium", "high"}
    assert 19 <= analysis["winLikelihood"] <= 93
    assert analysis["evidenceGaps"]
    assert all(set(gap) == {"type", "severity", "note"} for gap in analysis["evidenceGaps"])
    assert all(
        item["priority"] in {"do-first", "recommended", "deadline"}
        for item in analysis["recommendations"]
    )
    assert analysis["nextStep"]
    assert analysis["recommendation"]["tone"] in {"emerald", "rose", "amber", "sky"}
    assert "AC-10482" in analysis["responseDraft"]
    assert "8AB12935KJ7731042" in analysis["responseDraft"]
    assert analysis["model"] == "heuristic-v1"
    assert isinstance(analysis["generatedAt"], int)


def test_analysis_is_cached_until_evidence_changes(client):
    first = client.get("/api/disputes/PP-D-8492013/ai-analysis").json()
    second = client.get("/api/disputes/PP-D-8492013/ai-analysis").json()

    assert first["generatedAt"] == second["generatedAt"]

    refreshed = client.post("/api/disputes/PP-D-8492013/ai-analysis/refresh").json()
    assert refreshed["classification"] == first["classification"]
    assert refreshed["generatedAt"] >= first["generatedAt"]


def test_closed_case_has_no_win_likelihood(client):
    analysis = client.get("/api/disputes/PP-D-8491520/ai-analysis").json()

    assert analysis["winLikelihood"] is None
    assert analysis["risk"]["level"] == "low"
    assert analysis["winLikelihood"] is None


def test_llm_draft_guard_rejects_invented_ids(client):
    detail = client.get("/api/disputes/PP-D-8492013").json()

    class FakeDispute:
        order_id = detail["orderId"]
        transaction_id = detail["transactionId"]

    valid = (
        "Hello Jordan, thank you for your message about order AC-10482 and "
        "transaction 8AB12935KJ7731042. We have attached the signed delivery record "
        "and order confirmation for your review. Please let us know if you need more."
    )
    invented = valid.replace("AC-10482", "AC-99999")

    assert validate_llm_draft(valid, FakeDispute()) is True
    assert validate_llm_draft(invented, FakeDispute()) is False
    assert validate_llm_draft("Too short.", FakeDispute()) is False
