import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import create_app


def make_pdf(text: str = "order AC-10482 email conversation") -> bytes:
    """Minimal valid PDF with a text object, enough for pypdf extraction."""
    escaped = text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
    stream = f"BT /F1 12 Tf 20 250 Td ({escaped}) Tj ET"
    objects = [
        "<< /Type /Catalog /Pages 2 0 R >>",
        "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        (
            "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 300] "
            "/Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>"
        ),
        f"<< /Length {len(stream)} >>\nstream\n{stream}\nendstream",
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]

    header = "%PDF-1.4\n"
    body = ""
    offsets = []
    for index, obj in enumerate(objects, start=1):
        offsets.append(len(header) + len(body))
        body += f"{index} 0 obj\n{obj}\nendobj\n"

    xref_offset = len(header) + len(body)
    xref = "xref\n0 6\n0000000000 65535 f \n" + "".join(
        f"{offset:010d} 00000 n \n" for offset in offsets
    )
    trailer = f"trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n{xref_offset}\n%%EOF\n"
    return (header + body + xref + trailer).encode("latin-1")


@pytest.fixture
def settings(tmp_path) -> Settings:
    return Settings(
        _env_file=None,
        database_url=f"sqlite:///{tmp_path / 'test.db'}",
        storage_dir=str(tmp_path / "storage"),
        seed_demo_data=True,
        ai_mode="heuristic",
        require_auth=False,
        jwt_secret="test-secret-key-that-is-at-least-32-bytes",
        max_upload_mb=2,
    )


@pytest.fixture
def client(settings) -> TestClient:
    app = create_app(settings)
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def demo_token(client) -> str:
    response = client.post(
        "/api/auth/login",
        json={"email": "demo@acmecommerce.com", "password": "Demo1234!"},
    )
    assert response.status_code == 200
    return response.json()["accessToken"]
