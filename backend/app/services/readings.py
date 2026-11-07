"""Shared reading queries.

Readings accumulate quickly (an ESP32 posts continuously), so callers must never load
``silo.readings`` wholesale. These helpers fetch only the rows they need.
"""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import SensorReading

VALID_DATA_SOURCES = ("hardware", "manual")


def latest_reading(db: Session, silo_id: int, data_source: str | None = None) -> SensorReading | None:
    query = select(SensorReading).where(
        SensorReading.silo_id == silo_id,
        SensorReading.data_source.in_(VALID_DATA_SOURCES),
    )
    if data_source is not None:
        query = query.where(SensorReading.data_source == data_source)
    query = query.order_by(SensorReading.recorded_at.desc(), SensorReading.id.desc()).limit(1)
    return db.scalar(query)
