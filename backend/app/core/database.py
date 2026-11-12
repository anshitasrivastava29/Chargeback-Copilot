import logging
from collections.abc import Iterator

from fastapi import Request
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

logger = logging.getLogger(__name__)


class Base(DeclarativeBase):
    pass


def normalize_database_url(database_url: str) -> str:
    """Route plain PostgreSQL URLs to the psycopg 3 driver.

    SQLAlchemy defaults ``postgresql://`` to psycopg2, which this project does
    not install. Heroku-style ``postgres://`` URLs are also accepted.
    """
    if database_url.startswith("postgres://"):
        return database_url.replace("postgres://", "postgresql+psycopg://", 1)
    if database_url.startswith("postgresql://"):
        return database_url.replace("postgresql://", "postgresql+psycopg://", 1)
    return database_url


def build_engine(database_url: str) -> Engine:
    url = normalize_database_url(database_url)
    connect_args = {}
    if url.startswith("sqlite"):
        connect_args["check_same_thread"] = False

    return create_engine(
        url,
        connect_args=connect_args,
        pool_pre_ping=True,
        future=True,
    )


def build_session_factory(engine: Engine) -> sessionmaker[Session]:
    return sessionmaker(bind=engine, autoflush=False, expire_on_commit=False, future=True)


def init_database(engine: Engine) -> None:
    from app.models import (  # noqa: F401
        activity,
        ai_result,
        dispute,
        evidence,
        paypal,
        response,
        transaction,
        user,
    )

    if engine.dialect.name == "sqlite":
        Base.metadata.create_all(bind=engine)
        _upgrade_sqlite_columns(engine)
        _upgrade_sqlite_indexes(engine)
        return

    existing_tables = set(inspect(engine).get_table_names())
    missing_tables = sorted(set(Base.metadata.tables) - existing_tables)
    if missing_tables:
        database = engine.url.render_as_string(hide_password=True)
        raise RuntimeError(
            "Database schema is not initialized: missing "
            f"{', '.join(missing_tables)} in {database}. "
            "Run `alembic upgrade head` from the backend directory before "
            "starting the API."
        )


def _upgrade_sqlite_columns(engine: Engine) -> None:
    """Add later model columns to an existing SQLite demo database.

    ``create_all`` creates missing tables but never adds columns, so a local
    ``chargeback.db`` built before a release keeps the old ``users`` shape.
    Keep these statements additive and defaulted so demo data survives.
    """
    additions = {
        "notify_deadline_reminders": "BOOLEAN NOT NULL DEFAULT 1",
        "notify_weekly_digest": "BOOLEAN NOT NULL DEFAULT 1",
        "notify_case_updates": "BOOLEAN NOT NULL DEFAULT 1",
    }
    try:
        with engine.begin() as connection:
            existing = {
                row[1]
                for row in connection.execute(text("PRAGMA table_info(users)"))
            }
            for name, ddl in additions.items():
                if name not in existing:
                    connection.exec_driver_sql(
                        f"ALTER TABLE users ADD COLUMN {name} {ddl}"
                    )
    except Exception:
        logger.exception("Could not upgrade SQLite user preferences.")


def _upgrade_sqlite_indexes(engine: Engine) -> None:
    """Bring SQLite demo databases up to the latest uniqueness guarantees.

    ``create_all`` never alters an existing table, so an older local
    ``chargeback.db`` keeps its non-unique submission index. Recreate it as
    unique so double submissions are rejected by the database as well as the
    service guard.
    """
    try:
        with engine.begin() as connection:
            duplicate = connection.execute(
                text(
                    "SELECT dispute_id FROM response_submissions "
                    "GROUP BY dispute_id HAVING COUNT(*) > 1 LIMIT 1"
                )
            ).first()
            if duplicate is not None:
                logger.warning(
                    "response_submissions has duplicate rows for dispute %s; "
                    "skipping the unique index upgrade.",
                    duplicate[0],
                )
                return
            connection.exec_driver_sql(
                "DROP INDEX IF EXISTS ix_response_submissions_dispute_id"
            )
            connection.exec_driver_sql(
                "CREATE UNIQUE INDEX IF NOT EXISTS "
                "ix_response_submissions_dispute_id "
                "ON response_submissions (dispute_id)"
            )
    except Exception:
        logger.exception("Could not upgrade SQLite response_submissions index.")


def get_db(request: Request) -> Iterator[Session]:
    session_factory = request.app.state.session_factory
    db = session_factory()
    try:
        yield db
    finally:
        db.close()
