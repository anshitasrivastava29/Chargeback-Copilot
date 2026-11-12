from datetime import UTC, datetime


def utcnow() -> datetime:
    """Naive UTC timestamp, stored consistently across SQLite and PostgreSQL."""
    return datetime.now(UTC).replace(tzinfo=None)


def to_ms(value: datetime | None) -> int | None:
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=UTC)
    return int(value.timestamp() * 1000)


def from_ms(value: int | None) -> datetime | None:
    if value is None:
        return None
    return datetime.fromtimestamp(value / 1000, tz=UTC).replace(tzinfo=None)


def format_date(value: datetime | None) -> str:
    if value is None:
        return ""
    return f"{value.strftime('%b')} {value.day}, {value.year}"


def days_until(value: datetime | None, reference: datetime | None = None) -> int | None:
    if value is None:
        return None
    reference = reference or utcnow()
    return (value.date() - reference.date()).days
