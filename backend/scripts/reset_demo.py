"""Reset the local demo workspace to a pristine, seeded state.

Stops at nothing destructive without confirmation: it deletes the SQLite
database file and uploaded evidence under STORAGE_DIR, rebuilds the schema,
and re-seeds the 26 demo disputes.

Usage (from the backend directory, with the API stopped):

    python scripts/reset_demo.py          # asks for confirmation
    python scripts/reset_demo.py --yes    # non-interactive (CI / demo prep)

PostgreSQL workspaces are deliberately left alone: drop and recreate the
database (or `docker compose down -v` for the local stack) instead.
"""

from __future__ import annotations

import argparse
import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import func, select

from app.core.config import get_settings
from app.core.database import build_engine, build_session_factory, init_database
from app.models.dispute import Dispute
from app.models.evidence import EvidenceFile
from app.models.user import User
from app.services.seed import DEMO_EMAIL, DEMO_PASSWORD, seed_demo_data


def sqlite_path(database_url: str) -> Path:
    """Return the file backing a sqlite:// URL."""
    if not database_url.startswith("sqlite:///"):
        raise SystemExit(
            "This command only resets SQLite workspaces.\n"
            f"Configured DATABASE_URL: {database_url}\n"
            "For PostgreSQL, recreate the database (or run "
            "`docker compose down -v && docker compose up --build`)."
        )

    raw = database_url.removeprefix("sqlite:///")
    if not raw or raw == ":memory:":
        raise SystemExit("In-memory SQLite cannot be reset on disk.")

    path = Path(raw)
    if not path.is_absolute():
        path = Path.cwd() / path
    return path.resolve()


def clear_evidence(settings) -> int:
    root = Path(settings.storage_dir) / "evidence"
    if not root.exists():
        return 0

    removed = sum(1 for item in root.rglob("*") if item.is_file())
    shutil.rmtree(root)
    return removed


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--yes",
        action="store_true",
        help="skip the confirmation prompt",
    )
    args = parser.parse_args()

    settings = get_settings()
    db_path = sqlite_path(settings.database_url)
    evidence_count = (
        sum(1 for item in (Path(settings.storage_dir) / "evidence").rglob("*") if item.is_file())
        if (Path(settings.storage_dir) / "evidence").exists()
        else 0
    )

    print("Demo reset will delete:")
    print(f"  database: {db_path}")
    print(f"  uploaded evidence files: {evidence_count}")
    print("then rebuild the schema and seed 26 demo disputes.")
    print("Stop the API first; a running server keeps the SQLite file open.")

    if not args.yes:
        answer = input("Type 'reset' to continue: ").strip().lower()
        if answer != "reset":
            print("Aborted. Nothing was changed.")
            return 1

    if db_path.exists():
        db_path.unlink()
    for suffix in ("-wal", "-shm"):
        sidecar = db_path.with_name(db_path.name + suffix)
        if sidecar.exists():
            sidecar.unlink()

    removed = clear_evidence(settings)
    (Path(settings.storage_dir) / "evidence").mkdir(parents=True, exist_ok=True)

    engine = build_engine(settings.database_url)
    init_database(engine)
    session_factory = build_session_factory(engine)
    with session_factory() as db:
        seed_demo_data(db, settings)

    with session_factory() as db:
        users = db.scalar(select(func.count()).select_from(User))
        disputes = db.scalar(select(func.count()).select_from(Dispute))
        open_cases = db.scalar(
            select(func.count()).select_from(Dispute).where(Dispute.status == "open")
        )
        files = db.scalar(select(func.count()).select_from(EvidenceFile))

    engine.dispose()

    print("")
    print(f"Reset complete: {removed} stale files removed.")
    print(f"  users: {users}")
    print(f"  disputes: {disputes} ({open_cases} open)")
    print(f"  evidence rows: {files}")
    print(f"  login: {DEMO_EMAIL} / {DEMO_PASSWORD}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
