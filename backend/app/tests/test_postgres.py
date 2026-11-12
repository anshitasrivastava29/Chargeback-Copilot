import os
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import create_app
from app.tests.conftest import make_pdf

POSTGRES_URL = os.environ.get("TEST_DATABASE_URL", "").strip()

pytestmark = pytest.mark.skipif(
    not POSTGRES_URL,
    reason="Set TEST_DATABASE_URL to a migrated PostgreSQL database to run this test.",
)


def test_postgres_round_trip(tmp_path):
    """Smoke the full stack against PostgreSQL (JSON columns, numerics, FKs)."""
    settings = Settings(
        _env_file=None,
        database_url=POSTGRES_URL,
        storage_dir=str(tmp_path / "storage"),
        seed_demo_data=True,
        ai_mode="heuristic",
        jwt_secret="postgres-test-secret-key-at-least-32-bytes",
        max_upload_mb=2,
    )
    app = create_app(settings)

    with TestClient(app) as client:
        health = client.get("/api/health")
        assert health.status_code == 200
        assert health.json()["database"] == "ok"

        listing = client.get("/api/disputes?pageSize=5").json()
        assert listing["total"] >= 26

        detail = client.get("/api/disputes/PP-D-8492013")
        assert detail.status_code == 200
        detail_body = detail.json()
        assert detail_body["buyer"]["name"]
        assert isinstance(detail_body["order"]["items"], list)
        assert detail_body["refund"]["key"]

        upload = client.post(
            "/api/disputes/PP-D-8492013/evidence",
            files={
                "file": (
                    "postgres-check.pdf",
                    make_pdf("order AC-10482 delivery confirmation"),
                    "application/pdf",
                )
            },
            data={"evidenceType": "Customer communication"},
        )
        assert upload.status_code == 201
        uploaded = upload.json()

        try:
            analysis = client.get("/api/disputes/PP-D-8492013/ai-analysis")
            assert analysis.status_code == 200
            payload = analysis.json()
            assert "evidenceGaps" in payload
            assert isinstance(payload["factors"], list)

            dashboard = client.get("/api/dashboard/stats").json()
            assert dashboard["total"] >= 26
            assert dashboard["winRate"] >= 0
        finally:
            client.delete(f"/api/disputes/PP-D-8492013/evidence/{uploaded['id']}")

    assert Path(settings.storage_dir).exists()
