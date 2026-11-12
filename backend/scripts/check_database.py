"""Check the configured database without starting the API.

Prints a redacted connection target, server version, migration revision, and
row counts. Credentials are never printed. Useful after pointing
DATABASE_URL at Supabase (or any PostgreSQL instance).

Usage (from the backend directory):

    python scripts/check_database.py
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.pool import NullPool

from app.core.config import get_settings
from app.core.database import normalize_database_url


def main() -> int:
    settings = get_settings()
    url = normalize_database_url(settings.database_url)
    engine = create_engine(url, poolclass=NullPool, future=True)
    target = engine.url.render_as_string(hide_password=True)

    print(f"target: {target}")
    try:
        with engine.connect() as connection:
            if engine.dialect.name == "postgresql":
                version = connection.execute(text("SHOW server_version")).scalar()
                print(f"dialect: postgresql | server {version}")
            else:
                version = connection.execute(text("SELECT sqlite_version()")).scalar()
                print(f"dialect: sqlite | server {version}")

            tables = set(inspect(connection).get_table_names())
            if "alembic_version" in tables:
                revision = connection.execute(
                    text("SELECT version_num FROM alembic_version")
                ).scalar()
                print(f"alembic revision: {revision}")
            else:
                print("alembic revision: none (schema created by app startup or not migrated)")

            for table in ("users", "disputes", "evidence_files"):
                if table in tables:
                    # Table names come from the fixed tuple above, not user input.
                    count = connection.execute(
                        text(f"SELECT COUNT(*) FROM {table}")
                    ).scalar()
                    print(f"{table}: {count}")
    except Exception as exc:
        print(f"FAILED: {type(exc).__name__}: {exc}")
        print(
            "Check DATABASE_URL, SSL mode, and that the Supabase project is running. "
            "Use the Session pooler URI for IPv4 connectivity."
        )
        return 1
    finally:
        engine.dispose()

    print("OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
