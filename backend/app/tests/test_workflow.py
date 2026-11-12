from app.tests.conftest import make_pdf


def test_save_draft_and_submit_response(client):
    saved = client.post(
        "/api/disputes/PP-D-8492013/response-draft",
        json={"draft": "Reviewed and personalized response."},
    )
    assert saved.status_code == 200
    body = saved.json()
    assert body["disputeId"] == "PP-D-8492013"
    assert body["draft"] == "Reviewed and personalized response."
    assert body["savedAt"] > 10**12

    analysis = client.get("/api/disputes/PP-D-8492013/ai-analysis").json()
    assert analysis["responseDraft"] == "Reviewed and personalized response."

    upload = client.post(
        "/api/disputes/PP-D-8492013/evidence",
        files={"file": ("chat.pdf", make_pdf("email conversation"), "application/pdf")},
        data={"evidenceType": "Customer communication"},
    ).json()

    submitted = client.post(
        "/api/disputes/PP-D-8492013/submit",
        json={
            "body": "Final approved response.",
            "evidenceIds": [upload["id"]],
        },
    )
    assert submitted.status_code == 200
    submission = submitted.json()
    assert submission["status"] == "recorded"
    assert submission["disputeId"] == "PP-D-8492013"

    detail = client.get("/api/disputes/PP-D-8492013").json()
    assert detail["submittedAt"] == submission["submittedAt"]

    duplicate = client.post(
        "/api/disputes/PP-D-8492013/submit", json={"body": "Again"}
    )
    assert duplicate.status_code == 409
    assert (
        client.post(
            "/api/disputes/PP-D-8492013/response-draft", json={"draft": "Again"}
        ).status_code
        == 409
    )


def test_submit_rejects_unknown_evidence_ids(client):
    response = client.post(
        "/api/disputes/PP-D-8492013/submit",
        json={"body": "Final response.", "evidenceIds": ["missing-id"]},
    )
    assert response.status_code == 400


def test_closed_cases_are_read_only(client):
    assert (
        client.post(
            "/api/disputes/PP-D-8491520/response-draft", json={"draft": "Nope"}
        ).status_code
        == 409
    )
    assert (
        client.post(
            "/api/disputes/PP-D-8491520/submit", json={"body": "Nope"}
        ).status_code
        == 409
    )
