from datetime import datetime, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import Alert, SensorReading, Silo, User
from app.services.readings import VALID_DATA_SOURCES

router = APIRouter(prefix="/reports", tags=["reports"], dependencies=[Depends(get_current_user)])
ReportRange = Literal["24h", "7d", "30d"]
DataSource = Literal["hardware", "manual"]


REPORT_ROW_LIMIT = 5000
RANGE_DAYS = {"24h": 1, "7d": 7, "30d": 30}


@router.get("/history")
def report_history(
    period: ReportRange = Query(default="7d"),
    silo_id: int | None = Query(default=None, gt=0),
    data_source: DataSource | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if silo_id is not None and current_user.role != "administrator":
        if not db.scalar(
            select(Silo.id).where(
                Silo.id == silo_id,
                Silo.operators.any(User.id == current_user.id),
            )
        ):
            raise HTTPException(status_code=403, detail="This silo is not assigned to your account.")

    cutoff = datetime.now(timezone.utc) - timedelta(days=RANGE_DAYS[period])
    conditions = [
        SensorReading.recorded_at >= cutoff,
        SensorReading.data_source.in_(VALID_DATA_SOURCES),
    ]
    if silo_id is not None:
        conditions.append(SensorReading.silo_id == silo_id)
    if data_source is not None:
        conditions.append(SensorReading.data_source == data_source)
    if current_user.role != "administrator":
        conditions.append(Silo.operators.any(User.id == current_user.id))

    # Totals and averages are computed over the whole range in SQL. Previously they were
    # derived from the capped row list, so a "30 days" report silently averaged only the
    # newest 5000 rows.
    stats = db.execute(
        select(
            func.count(SensorReading.id),
            func.count(func.distinct(SensorReading.silo_id)),
            func.avg(SensorReading.temperature_c),
            func.avg(SensorReading.humidity_percent),
            func.avg(SensorReading.grain_moisture_percent),
        )
        .select_from(SensorReading)
        .join(Silo, SensorReading.silo_id == Silo.id)
        .where(*conditions)
    ).one()
    total_count, silo_count, avg_temperature, avg_humidity, avg_moisture = stats

    rows = db.execute(
        select(SensorReading, Silo)
        .join(Silo, SensorReading.silo_id == Silo.id)
        .where(*conditions)
        .order_by(SensorReading.recorded_at.desc(), SensorReading.id.desc())
        .limit(REPORT_ROW_LIMIT)
    ).all()

    readings = []
    for reading, silo in rows:
        if reading.temperature_c >= silo.temperature_critical_c or reading.humidity_percent >= silo.humidity_critical_percent:
            status = "critical"
        elif reading.temperature_c >= silo.temperature_warning_c or reading.humidity_percent >= silo.humidity_warning_percent:
            status = "warning"
        else:
            status = "normal"
        readings.append(
            {
                "id": reading.id,
                "silo_id": silo.id,
                "silo_name": silo.name,
                "recorded_at": reading.recorded_at,
                "temperature_c": reading.temperature_c,
                "humidity_percent": reading.humidity_percent,
                "grain_moisture_percent": reading.grain_moisture_percent,
                "data_source": reading.data_source,
                "status": status,
            }
        )

    def rounded(value: float | None) -> float | None:
        return round(float(value), 2) if value is not None else None

    return {
        "silo_count": silo_count,
        "reading_count": total_count,
        "returned_count": len(readings),
        "truncated": total_count > len(readings),
        "average_temperature_c": rounded(avg_temperature),
        "average_humidity_percent": rounded(avg_humidity),
        "average_grain_moisture_percent": rounded(avg_moisture),
        "readings": readings,
        "period": period,
    }


@router.get("/summary")
def report_summary(
    period: ReportRange = Query(default="7d"),
    silo_id: int | None = Query(default=None, gt=0),
    data_source: DataSource | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    history = report_history(period, silo_id, data_source, db, current_user)
    silo_scope = select(Silo.id)
    if current_user.role != "administrator":
        silo_scope = silo_scope.where(Silo.operators.any(User.id == current_user.id))
    if silo_id is not None:
        silo_scope = silo_scope.where(Silo.id == silo_id)
    cutoff = datetime.now(timezone.utc) - timedelta(days=RANGE_DAYS[period])
    alert_count_query = select(func.count(Alert.id)).where(
        Alert.silo_id.in_(silo_scope),
        Alert.created_at >= cutoff,
    )
    history.update(
        alert_count=db.scalar(alert_count_query) or 0,
        data_notice="Readings are sourced from ESP32 hardware or authorized manual entry.",
    )
    return history
