from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, String, Table, Column, Text
from sqlalchemy.types import TypeDecorator
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

operator_assignments = Table(
    "operator_assignments",
    Base.metadata,
    Column("user_id", ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("silo_id", ForeignKey("silos.id", ondelete="CASCADE"), primary_key=True),
)


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class UTCDateTime(TypeDecorator):
    """Timezone-aware UTC datetime that behaves the same on SQLite and PostgreSQL.

    SQLite discards tzinfo, so naive values came back from the API without an offset and
    browsers parsed them as local time. Values are normalised to UTC on write and tagged
    as UTC on read.
    """

    impl = DateTime
    cache_ok = True

    def __init__(self) -> None:
        super().__init__(timezone=True)

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(150))
    role: Mapped[str] = mapped_column(String(30), default="operator")
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utc_now)
    assigned_silos: Mapped[list["Silo"]] = relationship(
        secondary=operator_assignments, back_populates="operators"
    )


class Silo(Base):
    __tablename__ = "silos"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    location: Mapped[str] = mapped_column(String(200))
    grain_type: Mapped[str] = mapped_column(String(60))
    capacity_tonnes: Mapped[float] = mapped_column(Float)
    capacity_percent: Mapped[float] = mapped_column(Float, default=0.0)
    temperature_warning_c: Mapped[float] = mapped_column(Float, default=24.0)
    temperature_critical_c: Mapped[float] = mapped_column(Float, default=28.0)
    humidity_warning_percent: Mapped[float] = mapped_column(Float, default=65.0)
    humidity_critical_percent: Mapped[float] = mapped_column(Float, default=72.0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utc_now)
    operators: Mapped[list[User]] = relationship(
        secondary=operator_assignments, back_populates="assigned_silos"
    )
    readings: Mapped[list["SensorReading"]] = relationship(
        back_populates="silo", cascade="all, delete-orphan"
    )
    alerts: Mapped[list["Alert"]] = relationship(
        back_populates="silo", cascade="all, delete-orphan"
    )
    inspections: Mapped[list["Inspection"]] = relationship(
        back_populates="silo", cascade="all, delete-orphan"
    )


class SensorReading(Base):
    __tablename__ = "sensor_readings"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    silo_id: Mapped[int] = mapped_column(ForeignKey("silos.id", ondelete="CASCADE"), index=True)
    temperature_c: Mapped[float] = mapped_column(Float)
    humidity_percent: Mapped[float] = mapped_column(Float)
    grain_moisture_percent: Mapped[float | None] = mapped_column(Float, nullable=True)
    recorded_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utc_now, index=True)
    is_simulated: Mapped[bool] = mapped_column(Boolean, default=False)
    data_source: Mapped[str] = mapped_column(String(20), default="manual")
    source: Mapped[str] = mapped_column(String(80), default="unspecified")
    silo: Mapped[Silo] = relationship(back_populates="readings")


class Alert(Base):
    __tablename__ = "alerts"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    silo_id: Mapped[int] = mapped_column(ForeignKey("silos.id", ondelete="CASCADE"), index=True)
    severity: Mapped[str] = mapped_column(String(20), default="warning")
    message: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utc_now, index=True)
    acknowledged: Mapped[bool] = mapped_column(Boolean, default=False)
    resolved: Mapped[bool] = mapped_column(Boolean, default=False)
    silo: Mapped[Silo] = relationship(back_populates="alerts")


class Inspection(Base):
    __tablename__ = "inspections"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    silo_id: Mapped[int] = mapped_column(ForeignKey("silos.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    activity_type: Mapped[str] = mapped_column(String(40))
    notes: Mapped[str] = mapped_column(Text)
    performed_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utc_now, index=True)
    silo: Mapped[Silo] = relationship(back_populates="inspections")
    user: Mapped["User | None"] = relationship()

    @property
    def logged_by(self) -> str | None:
        return self.user.full_name if self.user else None
