from datetime import datetime, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import Alert, SensorReading, Silo, User

router = APIRouter(prefix="/reports", tags=["reports"], dependencies=[Depends(get_current_user)])
ReportRange = Literal["24h", "7d", "30d"]
DataSource = Literal["hardware", "manual"]


@router.get("/history")
def report_history(
    period: ReportRange = Query(default="7d"),
    silo_id: int | None = Query(default=None, gt=0),
    data_source: DataSource | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    range_days = {"24h": 1, "7d": 7, "30d": 30}
    cutoff = datetime.now(timezone.utc) - timedelta(days=range_days[period])
    query = (
        select(SensorReading, Silo)
        .join(Silo, SensorReading.silo_id == Silo.id)
        .where(SensorReading.recorded_at >= cutoff)
        .where(SensorReading.data_source.in_(("hardware", "manual")))
        .order_by(SensorReading.recorded_at.desc(), SensorReading.id.desc())
        .limit(5000)
    )
    if silo_id is not None:
        query = query.where(SensorReading.silo_id == silo_id)
    if data_source is not None:
        query = query.where(SensorReading.data_source == data_source)
    if current_user.role != "administrator":
        query = query.where(Silo.operators.any(User.id == current_user.id))

    rows = db.execute(query).all()
    if silo_id is not None and current_user.role != "administrator":
        if not db.scalar(
            select(Silo.id).where(
                Silo.id == silo_id,
                Silo.operators.any(User.id == current_user.id),
            )
        ):
            raise HTTPException(status_code=403, detail="This silo is not assigned to your account.")

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

    silo_count = len({reading["silo_id"] for reading in readings})

    def average(key: str) -> float | None:
        values = [reading[key] for reading in readings if reading[key] is not None]
        return round(sum(values) / len(values), 2) if values else None

    return {
        "silo_count": silo_count,
        "reading_count": len(readings),
        "average_temperature_c": average("temperature_c"),
        "average_humidity_percent": average("humidity_percent"),
        "average_grain_moisture_percent": average("grain_moisture_percent"),
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
    cutoff = datetime.now(timezone.utc) - timedelta(days={"24h": 1, "7d": 7, "30d": 30}[period])
    alert_count_query = select(func.count(Alert.id)).where(
        Alert.silo_id.in_(silo_scope),
        Alert.created_at >= cutoff,
    )
    history.update(
        alert_count=db.scalar(alert_count_query) or 0,
        data_notice="Readings are sourced from ESP32 hardware or authorized manual entry.",
    )
    return history
