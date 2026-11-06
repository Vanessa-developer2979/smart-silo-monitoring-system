from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, require_admin

from app.models import Silo, User
from app.schemas import AssignmentCreate, SiloCreate, SiloUpdate

router = APIRouter(tags=["silos and assignments"], dependencies=[Depends(get_current_user)])


def silo_payload(silo: Silo, data_source: Literal["hardware", "manual"] | None = None) -> dict:
    readings = [
        reading for reading in silo.readings
        if reading.data_source in ("hardware", "manual")
        and (data_source is None or reading.data_source == data_source)
    ]
    latest = max(readings, key=lambda reading: reading.recorded_at, default=None)
    status_value = "normal"
    if latest and (
        latest.temperature_c >= silo.temperature_critical_c
        or latest.humidity_percent >= silo.humidity_critical_percent
    ):
        status_value = "critical"
    elif latest and (
        latest.temperature_c >= silo.temperature_warning_c
        or latest.humidity_percent >= silo.humidity_warning_percent
    ):
        status_value = "warning"
    now = datetime.now(timezone.utc)
    recorded_at = latest.recorded_at if latest else None
    if recorded_at and recorded_at.tzinfo is None:
        recorded_at = recorded_at.replace(tzinfo=timezone.utc)
    is_fresh = recorded_at is not None and (now - recorded_at).total_seconds() <= 15 * 60
    if latest and latest.data_source == "hardware" and is_fresh:
        connection_status = "online"
    else:
        connection_status = "offline"
    return {
        "id": silo.id,
        "name": silo.name,
        "location": silo.location,
        "grain_type": silo.grain_type,
        "capacity_tonnes": silo.capacity_tonnes,
        "capacity_percent": silo.capacity_percent,
        "temperature_warning_c": silo.temperature_warning_c,
        "temperature_critical_c": silo.temperature_critical_c,
        "humidity_warning_percent": silo.humidity_warning_percent,
        "humidity_critical_percent": silo.humidity_critical_percent,
        "is_active": silo.is_active,
        "status": status_value,
        "latest_reading": {
            "temperature_c": latest.temperature_c,
            "humidity_percent": latest.humidity_percent,
            "grain_moisture_percent": latest.grain_moisture_percent,
            "is_simulated": latest.is_simulated,
            "data_source": latest.data_source,
            "recorded_at": latest.recorded_at,
        } if latest else None,
        "connection_status": connection_status,
        "operator_ids": [operator.id for operator in silo.operators],
    }


@router.get("/silos/")
def list_silos(
    data_source: Literal["hardware", "manual"] | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    silos = db.scalars(select(Silo).order_by(Silo.id)).all()
    if current_user.role != "administrator":
        assigned_ids = {silo.id for silo in current_user.assigned_silos}
        silos = [silo for silo in silos if silo.id in assigned_ids]
    return [silo_payload(silo, data_source) for silo in silos]


@router.post("/silos/", status_code=status.HTTP_201_CREATED)
def create_silo(payload: SiloCreate, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    if payload.temperature_critical_c < payload.temperature_warning_c:
        raise HTTPException(status_code=422, detail="Critical temperature must be at least the warning threshold.")
    if payload.humidity_critical_percent < payload.humidity_warning_percent:
        raise HTTPException(status_code=422, detail="Critical humidity must be at least the warning threshold.")
    silo = Silo(**payload.model_dump())
    db.add(silo)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="A silo with this name already exists.") from exc
    db.refresh(silo)
    return silo_payload(silo)


@router.get("/silos/{silo_id}")
def get_silo(silo_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    silo = db.get(Silo, silo_id)
    if silo is None:
        raise HTTPException(status_code=404, detail="Silo not found.")
    if current_user.role != "administrator" and silo not in current_user.assigned_silos:
        raise HTTPException(status_code=403, detail="This silo is not assigned to your account.")
    return silo_payload(silo)


@router.patch("/silos/{silo_id}")
def update_silo(silo_id: int, payload: SiloUpdate, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    silo = db.get(Silo, silo_id)
    if silo is None:
        raise HTTPException(status_code=404, detail="Silo not found.")
    updates = payload.model_dump(exclude_unset=True)
    temperature_warning = updates.get("temperature_warning_c", silo.temperature_warning_c)
    temperature_critical = updates.get("temperature_critical_c", silo.temperature_critical_c)
    humidity_warning = updates.get("humidity_warning_percent", silo.humidity_warning_percent)
    humidity_critical = updates.get("humidity_critical_percent", silo.humidity_critical_percent)
    if temperature_critical < temperature_warning:
        raise HTTPException(status_code=422, detail="Critical temperature must be at least the warning threshold.")
    if humidity_critical < humidity_warning:
        raise HTTPException(status_code=422, detail="Critical humidity must be at least the warning threshold.")
    for key, value in updates.items():
        setattr(silo, key, value)
    db.commit()
    db.refresh(silo)
    return silo_payload(silo)


@router.delete("/silos/{silo_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_silo(silo_id: int, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    silo = db.get(Silo, silo_id)
    if silo is None:
        raise HTTPException(status_code=404, detail="Silo not found.")
    db.delete(silo)
    db.commit()


@router.get("/assignments/")
def list_assignments(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    users = db.scalars(select(User).order_by(User.id)).all()
    return [{"user_id": user.id, "silo_ids": [silo.id for silo in user.assigned_silos]} for user in users]


@router.post("/assignments/", status_code=status.HTTP_201_CREATED)
def assign_operator(payload: AssignmentCreate, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    user = db.get(User, payload.user_id)
    silo = db.get(Silo, payload.silo_id)
    if user is None or silo is None:
        raise HTTPException(status_code=404, detail="User or silo not found.")
    if user.role != "operator":
        raise HTTPException(status_code=422, detail="Only operators can be assigned to silos.")
    if silo not in user.assigned_silos:
        user.assigned_silos.append(silo)
        db.commit()
    return {"user_id": user.id, "silo_id": silo.id, "assigned": True}


@router.delete("/assignments/{user_id}/{silo_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_assignment(user_id: int, silo_id: int, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    user = db.get(User, user_id)
    silo = db.get(Silo, silo_id)
    if user is None or silo is None:
        raise HTTPException(status_code=404, detail="User or silo not found.")
    if silo in user.assigned_silos:
        user.assigned_silos.remove(silo)
        db.commit()
