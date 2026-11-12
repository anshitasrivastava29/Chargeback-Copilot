from app.tests.conftest import make_pdf


def test_upload_evidence_updates_case_and_analysis(client):
    before = client.get("/api/disputes/PP-D-8492013").json()
    assert before["evidence"]["uploaded"] == 2

    response = client.post(
        "/api/disputes/PP-D-8492013/evidence",
        files={"file": ("customer-chat.pdf", make_pdf("Buyer conversation"), "application/pdf")},
        data={"evidenceType": "Customer communication"},
    )

    assert response.status_code == 201
    uploaded = response.json()
    assert uploaded["evidenceType"] == "Customer communication"
    assert uploaded["status"] == "ready"
    assert uploaded["source"] == "upload"

    after = client.get("/api/disputes/PP-D-8492013").json()
    assert after["evidence"]["uploaded"] == 3
    assert "Customer communication" in after["evidence"]["completed"]
    assert "Customer communication" not in after["evidence"]["missing"]

    analysis = client.get("/api/disputes/PP-D-8492013/ai-analysis").json()
    gap_types = {gap["type"] for gap in analysis["evidenceGaps"]}
    assert "Customer communication" not in gap_types

    delete = client.delete(
        f"/api/disputes/PP-D-8492013/evidence/{uploaded['id']}"
    )
    assert delete.status_code == 204
    restored = client.get("/api/disputes/PP-D-8492013").json()
    assert restored["evidence"]["uploaded"] == 2


def test_upload_rejects_spoofed_and_unknown_types(client):
    spoofed = client.post(
        "/api/disputes/PP-D-8492013/evidence",
        files={"file": ("fake.pdf", b"not really a pdf", "application/pdf")},
        data={"evidenceType": "Proof of delivery"},
    )
    assert spoofed.status_code == 400

    wrong_type = client.post(
        "/api/disputes/PP-D-8492013/evidence",
        files={"file": ("doc.pdf", make_pdf(), "application/pdf")},
        data={"evidenceType": "Made up evidence"},
    )
    assert wrong_type.status_code == 400


def test_evidence_list_returns_frontend_shape(client):
    response = client.get("/api/disputes/PP-D-8492013/evidence")

    assert response.status_code == 200
    files = response.json()
    assert len(files) == 2
    first = files[0]
    assert set(first) >= {
        "id",
        "name",
        "size",
        "mime",
        "evidenceType",
        "status",
        "uploadedAt",
        "source",
    }
    assert isinstance(first["uploadedAt"], int)


def test_evidence_download_for_seeded_demo_record_is_404(client):
    files = client.get("/api/disputes/PP-D-8492013/evidence").json()
    response = client.get(f"/api/evidence/{files[0]['id']}/file")
    assert response.status_code == 404
