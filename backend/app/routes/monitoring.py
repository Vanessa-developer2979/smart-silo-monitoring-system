from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.dependencies import get_current_user, require_admin
from app.models import Alert, SensorReading, Silo, User
from app.schemas import AlertCreate, AlertRead, ReadingCreate, ReadingRead

router = APIRouter(tags=["monitoring"], dependencies=[Depends(get_current_user)])


@router.get("/readings/", response_model=list[ReadingRead])
def list_readings(
    silo_id: int | None = Query(default=None, gt=0),
    data_source: Literal["simulation", "hardware", "manual"] | None = None,
    limit: int = Query(default=100, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(SensorReading).join(Silo).order_by(SensorReading.recorded_at.desc())
    if silo_id is not None:
        query = query.where(SensorReading.silo_id == silo_id)
    if current_user.role != "administrator":
        query = query.where(Silo.operators.any(User.id == current_user.id))
    if data_source is not None:
        query = query.where(SensorReading.data_source == data_source)
    return db.scalars(query.limit(limit)).all()


@router.get("/readings/latest")
def latest_readings(
    data_source: Literal["simulation", "hardware", "manual"] | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    silos = db.scalars(select(Silo).options(joinedload(Silo.readings))).unique().all()
    result = []
    for silo in silos:
        if current_user.role != "administrator" and silo not in current_user.assigned_silos:
            continue
        readings = [
            item for item in silo.readings
            if data_source is None or item.data_source == data_source
        ]
        reading = max(readings, key=lambda item: item.recorded_at, default=None)
        if reading:
            result.append(reading)
    return result


@router.post("/readings/", response_model=ReadingRead, status_code=status.HTTP_201_CREATED)
def create_reading(payload: ReadingCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    silo = db.get(Silo, payload.silo_id)
    if silo is None:
        raise HTTPException(status_code=404, detail="Silo not found.")
    if current_user.role != "administrator" and silo not in current_user.assigned_silos:
        raise HTTPException(status_code=403, detail="This silo is not assigned to your account.")
    reading_values = payload.model_dump(exclude={"recorded_at", "is_simulated"})
    reading = SensorReading(
        **reading_values,
        is_simulated=payload.data_source == "simulation",
    )
    if payload.recorded_at:
        reading.recorded_at = payload.recorded_at
    db.add(reading)

    severity = None
    if payload.temperature_c >= silo.temperature_critical_c or payload.humidity_percent >= silo.humidity_critical_percent:
        severity = "critical"
    elif payload.temperature_c >= silo.temperature_warning_c or payload.humidity_percent >= silo.humidity_warning_percent:
        severity = "warning"
    if severity:
        active_alert = db.scalar(
            select(Alert).where(
                Alert.silo_id == silo.id,
                Alert.severity == severity,
                Alert.acknowledged.is_(False),
                Alert.resolved.is_(False),
            )
        )
        if active_alert is None:
            db.add(
                Alert(
                    silo_id=silo.id,
                    severity=severity,
                    message=f"{severity.title()} threshold exceeded: {payload.temperature_c}°C, {payload.humidity_percent}% humidity.",
                )
            )
    db.commit()
    db.refresh(reading)
    return reading


@router.get("/alerts/")
def list_alerts(
    acknowledged: bool | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(Alert).options(joinedload(Alert.silo)).order_by(Alert.created_at.desc())
    if acknowledged is not None:
        query = query.where(Alert.acknowledged.is_(acknowledged))
    if current_user.role != "administrator":
        query = query.where(Alert.silo_id.in_([silo.id for silo in current_user.assigned_silos]))
    return [
        {
            "id": alert.id,
            "silo_id": alert.silo_id,
            "silo_name": alert.silo.name,
            "severity": alert.severity,
            "message": alert.message,
            "created_at": alert.created_at,
            "acknowledged": alert.acknowledged,
            "resolved": alert.resolved,
        }
        for alert in db.scalars(query).unique().all()
    ]


@router.post("/alerts/", response_model=AlertRead, status_code=status.HTTP_201_CREATED)
def create_alert(payload: AlertCreate, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    if db.get(Silo, payload.silo_id) is None:
        raise HTTPException(status_code=404, detail="Silo not found.")
    alert = Alert(**payload.model_dump())
    db.add(alert)
    db.commit()
    db.refresh(alert)
    return alert


@router.patch("/alerts/{alert_id}/acknowledge", response_model=AlertRead)
def acknowledge_alert(alert_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    alert = db.get(Alert, alert_id)
    if alert is None:
        raise HTTPException(status_code=404, detail="Alert not found.")
    if current_user.role != "administrator" and alert.silo not in current_user.assigned_silos:
        raise HTTPException(status_code=403, detail="This alert is outside your assigned silos.")
    alert.acknowledged = True
    db.commit()
    db.refresh(alert)
    return alert


@router.patch("/alerts/{alert_id}/resolve", response_model=AlertRead)
def resolve_alert(alert_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    alert = db.get(Alert, alert_id)
    if alert is None:
        raise HTTPException(status_code=404, detail="Alert not found.")
    if current_user.role != "administrator" and alert.silo not in current_user.assigned_silos:
        raise HTTPException(status_code=403, detail="This alert is outside your assigned silos.")
    alert.resolved = True
    db.commit()
    db.refresh(alert)
    return alert
