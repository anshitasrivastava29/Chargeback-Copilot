from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from app.core.config import Settings
from app.core.timeutils import utcnow
from app.main import create_app
from app.models.evidence import EvidenceFile
from app.models.response import ResponseDraft, ResponseSubmission
from app.tests.conftest import make_pdf

SECURE_SETTINGS = {
    "seed_demo_data": True,
    "ai_mode": "heuristic",
    "jwt_secret": "test-secret-key-that-is-at-least-32-bytes",
}


def _app(tmp_path, **overrides) -> TestClient:
    settings = Settings(
        _env_file=None,
        database_url=f"sqlite:///{tmp_path / 'hardening.db'}",
        storage_dir=str(tmp_path / "storage"),
        **{**SECURE_SETTINGS, **overrides},
    )
    return TestClient(create_app(settings))


def test_request_id_is_generated_echoed_and_returned_to_clients(client):
    generated = client.get("/api/health")
    assert generated.status_code == 200
    assert generated.headers.get("X-Request-ID")
    assert generated.json()["requestId"] == generated.headers["X-Request-ID"]

    supplied = "req-test-123"
    echoed = client.get("/api/health", headers={"X-Request-ID": supplied})
    assert echoed.headers["X-Request-ID"] == supplied
    assert echoed.json()["requestId"] == supplied


def test_health_returns_503_when_database_probe_fails(tmp_path):
    class BrokenSessionFactory:
        def __call__(self):
            raise RuntimeError("database is down")

    app = create_app(
        Settings(
            _env_file=None,
            database_url=f"sqlite:///{tmp_path / 'health.db'}",
            storage_dir=str(tmp_path / "storage"),
            **SECURE_SETTINGS,
        )
    )
    app.state.session_factory = BrokenSessionFactory()

    with TestClient(app) as health_client:
        response = health_client.get("/api/health")

    assert response.status_code == 503
    payload = response.json()
    assert payload["status"] == "degraded"
    assert payload["database"] == "error"


def test_oversized_request_is_rejected_before_parsing(tmp_path):
    with _app(tmp_path, max_request_mb=0) as oversized_client:
        response = oversized_client.post(
            "/api/auth/login",
            json={"email": "demo@acmecommerce.com", "password": "Demo1234!"},
        )

    assert response.status_code == 413
    assert "limit" in response.json()["detail"]
    assert response.headers.get("X-Request-ID")


def test_upload_sanitizes_path_traversal(client, settings):
    response = client.post(
        "/api/disputes/PP-D-8492013/evidence",
        files={
            "file": (
                "../../evil.pdf",
                make_pdf("order AC-10482"),
                "application/pdf",
            )
        },
        data={"evidenceType": "Customer communication"},
    )
    assert response.status_code == 201
    uploaded = response.json()
    assert uploaded["name"] == "evil.pdf"

    with client.app.state.session_factory() as db:
        record = db.get(EvidenceFile, uploaded["id"])
        stored = Path(record.storage_path).resolve()

    evidence_root = (Path(settings.storage_dir) / "evidence").resolve()
    assert evidence_root in stored.parents
    assert stored.name.endswith("evil.pdf")


def test_evidence_download_is_tenant_scoped(client):
    uploaded = client.post(
        "/api/disputes/PP-D-8492013/evidence",
        files={"file": ("proof.pdf", make_pdf("order AC-10482"), "application/pdf")},
        data={"evidenceType": "Customer communication"},
    ).json()
    download_url = f"/api/evidence/{uploaded['id']}/file"

    assert client.get(download_url).status_code == 200

    other_merchant = client.post(
        "/api/auth/signup",
        json={
            "name": "Other Merchant",
            "email": "other@example.com",
            "password": "StrongPass123",
        },
    ).json()
    headers = {"Authorization": f"Bearer {other_merchant['accessToken']}"}

    denied = client.get(download_url, headers=headers)
    assert denied.status_code == 404
    assert denied.json()["detail"] == "Evidence file not found."

    # Stored uploads no longer advertise an unauthenticated preview URL; the
    # frontend fetches them through the authenticated API client as blobs.
    detail = client.get("/api/disputes/PP-D-8492013").json()
    listed = next(item for item in detail["evidenceFiles"] if item["id"] == uploaded["id"])
    assert listed["previewUrl"] is None


def test_concurrent_submit_records_exactly_one_response(client):
    def submit(index: int):
        return client.post(
            "/api/disputes/PP-D-8492013/submit",
            json={"body": f"Concurrent response {index}"},
        )

    with ThreadPoolExecutor(max_workers=2) as pool:
        responses = list(pool.map(submit, range(2)))

    assert sorted(response.status_code for response in responses) == [200, 409]

    with client.app.state.session_factory() as db:
        count = db.scalar(
            select(func.count())
            .select_from(ResponseSubmission)
            .where(ResponseSubmission.dispute_id == "PP-D-8492013")
        )
        assert count == 1
        assert db.scalar(
            select(ResponseSubmission.dispute_id).where(
                ResponseSubmission.dispute_id == "PP-D-8492013"
            )
        ) == "PP-D-8492013"


def test_database_rejects_a_second_submission(client):
    first = client.post(
        "/api/disputes/PP-D-8492013/submit", json={"body": "First response"}
    )
    assert first.status_code == 200

    with client.app.state.session_factory() as db:
        db.add(
            ResponseSubmission(
                dispute_id="PP-D-8492013",
                body="Duplicate response",
                evidence_ids=[],
                status="recorded",
                submitted_at=utcnow(),
            )
        )
        with pytest.raises(IntegrityError):
            db.commit()
        db.rollback()


def test_concurrent_first_draft_saves_keep_one_row(client):
    def save(index: int):
        return client.post(
            "/api/disputes/PP-D-8492013/response-draft",
            json={"draft": f"Concurrent draft {index}"},
        )

    with ThreadPoolExecutor(max_workers=2) as pool:
        responses = list(pool.map(save, range(2)))

    assert all(response.status_code == 200 for response in responses)

    with client.app.state.session_factory() as db:
        drafts = list(
            db.scalars(
                select(ResponseDraft).where(
                    ResponseDraft.dispute_id == "PP-D-8492013"
                )
            )
        )

    assert len(drafts) == 1
    assert drafts[0].draft in {"Concurrent draft 0", "Concurrent draft 1"}
