from datetime import timedelta

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.config import settings
from app.models import Alert, SensorReading, Silo, User, utc_now

DEMO_SILOS = (
    ("Kanengo", "Lilongwe District", "Maize", 1200, 78, 20.4, 56, 13.2),
    ("Mzuzu (Msonda)", "Mzuzu District", "Maize", 950, 62, 21.1, 58, 13.5),
    ("Luchenza", "Thyolo District", "Maize", 1100, 74, 22.0, 61, 13.8),
    ("Blantyre", "Blantyre District", "Groundnuts", 1400, 83, 23.2, 63, 12.9),
    ("Salima", "Salima District", "Rice", 1000, 68, 24.0, 65, 14.1),
    ("Dowa", "Dowa District", "Wheat", 1500, 91, 24.8, 68, 13.6),
)

LEGACY_SEED_NAMES = {
    "Northfield 01": "Kanengo",
    "Lilongwe Silo 01": "Kanengo",
    "Northfield 02": "Mzuzu (Msonda)",
    "Lilongwe Silo 02": "Mzuzu (Msonda)",
    "Riverside 01": "Dowa",
    "Dowa Silo 01": "Dowa",
    "West Ridge 01": "Salima",
    "Kasungu Silo 01": "Salima",
}


def _add_demo_readings(db: Session, silo: Silo, values: tuple[float, float, float]) -> None:
    existing_count = db.scalar(
        select(func.count(SensorReading.id)).where(
            SensorReading.silo_id == silo.id,
            SensorReading.source == "demo-seed",
        )
    ) or 0
    if existing_count >= 720:
        return

    db.execute(
        delete(SensorReading).where(
            SensorReading.silo_id == silo.id,
            SensorReading.source == "demo-seed",
        )
    )
    temperature, humidity, moisture = values
    now = utc_now()
    for offset in range(720):
        db.add(
            SensorReading(
                silo=silo,
                temperature_c=round(temperature + ((offset % 5) - 2) * 0.35, 1),
                humidity_percent=round(humidity + ((offset % 7) - 3) * 0.8, 1),
                grain_moisture_percent=moisture,
                recorded_at=now - timedelta(hours=719 - offset),
                is_simulated=True,
                data_source="simulation",
                source="demo-seed",
            )
        )


def seed_demo_data(db: Session) -> None:
    silos = db.scalars(select(Silo).order_by(Silo.id)).all()
    used_names = {silo.name for silo in silos}
    for silo in silos:
        target_name = LEGACY_SEED_NAMES.get(silo.name)
        if target_name:
            choices = (target_name, *(name for name, *_ in DEMO_SILOS))
            available_name = next((name for name in choices if name not in used_names), None)
            if available_name:
                used_names.remove(silo.name)
                silo.name = available_name
                used_names.add(available_name)

    silo_by_name = {silo.name: silo for silo in silos}
    for name, location, grain_type, capacity, fill, *_ in DEMO_SILOS:
        silo = silo_by_name.get(name)
        if silo is None:
            silo = Silo(
                name=name,
                location=location,
                grain_type=grain_type,
                capacity_tonnes=capacity,
                capacity_percent=fill,
            )
            db.add(silo)
            db.flush()
            silo_by_name[name] = silo
        else:
            silo.location = location
            silo.grain_type = grain_type
            silo.capacity_tonnes = capacity
            silo.capacity_percent = fill

    for name, _, _, _, _, temperature, humidity, moisture in DEMO_SILOS:
        silo = silo_by_name[name]
        for reading in silo.readings:
            if reading.source == "demo-seed":
                reading.data_source = "simulation"
                reading.is_simulated = True
                if reading.grain_moisture_percent is None:
                    reading.grain_moisture_percent = moisture
        _add_demo_readings(db, silo, (temperature, humidity, moisture))

    for user in db.scalars(select(User)).all():
        if user.email.endswith("@example.test") and user.password_hash is None:
            user.is_active = False
        elif settings.demo_mode_enabled and user.is_active and user.role == "operator" and not user.assigned_silos:
            user.assigned_silos.extend(silo_by_name[name] for name, *_ in DEMO_SILOS)

    if not db.scalar(select(Alert.id).limit(1)):
        silo_by_name["Dowa"].alerts.append(
            Alert(severity="warning", message="Simulated humidity is approaching the recommended limit (68%).")
        )
    db.commit()
