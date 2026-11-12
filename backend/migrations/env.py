from logging.config import fileConfig

from alembic import context
from sqlalchemy import create_engine, pool

import app.models  # noqa: F401  (register every model on Base.metadata)
from app.core.config import get_settings
from app.core.database import Base, normalize_database_url

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def get_database_url() -> str:
    """Use the app settings, with an optional ``-x db_url=...`` override."""
    overrides = context.get_x_argument(as_dictionary=True)
    database_url = overrides.get("db_url") or get_settings().database_url
    return normalize_database_url(database_url)


def run_migrations_offline() -> None:
    """Emit SQL without connecting; this also verifies other dialects.

    Example:
        alembic upgrade head --sql -x db_url=postgresql://user:pass@host/db
    """
    context.configure(
        url=get_database_url(),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = create_engine(
        get_database_url(),
        poolclass=pool.NullPool,
        future=True,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
            # SQLite cannot ALTER constraints in place; batch mode rewrites tables.
            render_as_batch=connection.dialect.name == "sqlite",
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
