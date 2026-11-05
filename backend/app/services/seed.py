from datetime import timedelta

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.models import Alert, SensorReading, Silo, User, utc_now

LOCAL_SILO_NAME = "Local Silo"

DEMO_SILOS = (
    (LOCAL_SILO_NAME, "Local Site", "Maize", 1200, 78, 20.4, 56, 13.2),
)

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

    if not db.scalar(select(Alert.id).limit(1)):
        silo_by_name[LOCAL_SILO_NAME].alerts.append(
            Alert(severity="warning", message="Simulated humidity is approaching the recommended limit (68%).")
        )
    db.commit()
