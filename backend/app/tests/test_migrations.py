from pathlib import Path

import pytest
from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.config import Config
from alembic.migration import MigrationContext
from sqlalchemy import create_engine, inspect

import app.models  # noqa: F401  (register every model on Base.metadata)
from app.core.config import get_settings
from app.core.database import Base, normalize_database_url

BACKEND_DIR = Path(__file__).resolve().parents[2]


@pytest.fixture
def alembic_config(tmp_path, monkeypatch):
    database_url = f"sqlite:///{tmp_path / 'migrations.db'}"
    monkeypatch.setenv("DATABASE_URL", database_url)
    get_settings.cache_clear()

    config = Config(str(BACKEND_DIR / "alembic.ini"))
    config.set_main_option("script_location", str(BACKEND_DIR / "migrations"))

    yield config, database_url

    get_settings.cache_clear()


def test_upgrade_head_matches_metadata(alembic_config):
    config, database_url = alembic_config
    command.upgrade(config, "head")

    engine = create_engine(database_url, future=True)
    try:
        tables = set(inspect(engine).get_table_names())
        assert set(Base.metadata.tables) <= tables

        with engine.connect() as connection:
            context = MigrationContext.configure(connection)
            assert compare_metadata(context, Base.metadata) == []
    finally:
        engine.dispose()


def test_downgrade_base_drops_application_tables(alembic_config):
    config, database_url = alembic_config
    command.upgrade(config, "head")
    command.downgrade(config, "base")

    engine = create_engine(database_url, future=True)
    try:
        tables = set(inspect(engine).get_table_names())
        assert tables.isdisjoint(Base.metadata.tables)
    finally:
        engine.dispose()

    command.upgrade(config, "head")


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        ("postgres://user:secret@db:5432/app", "postgresql+psycopg://user:secret@db:5432/app"),
        ("postgresql://user:secret@db:5432/app", "postgresql+psycopg://user:secret@db:5432/app"),
        ("postgresql+psycopg://user:secret@db:5432/app", "postgresql+psycopg://user:secret@db:5432/app"),
        ("sqlite:///./chargeback.db", "sqlite:///./chargeback.db"),
    ],
)
def test_normalize_database_url(value, expected):
    assert normalize_database_url(value) == expected
