from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, select, text

from app.config import settings
from app.database import Base, SessionLocal, engine
from app.routes import auth, inspections, monitoring, reports, silos, users
from app.models import User
from app.security import hash_password, verify_password


def migrate_additive_columns():
    additions = {
        "silos": {"capacity_percent": "FLOAT NOT NULL DEFAULT 0"},
        "sensor_readings": {
            "grain_moisture_percent": "FLOAT",
            "data_source": "VARCHAR(20) NOT NULL DEFAULT 'simulation'",
        },
        "alerts": {"resolved": "BOOLEAN NOT NULL DEFAULT FALSE"},
        "users": {"password_hash": "VARCHAR(255)"},
    }
    with engine.begin() as connection:
        for table_name, columns in additions.items():
            existing = {column["name"] for column in inspect(connection).get_columns(table_name)}
            for column_name, declaration in columns.items():
                if column_name not in existing:
                    connection.execute(
                        text(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {declaration}")
                    )
        connection.execute(
            text(
                "UPDATE sensor_readings SET data_source = CASE "
                "WHEN is_simulated IS TRUE THEN 'simulation' ELSE 'manual' END "
                "WHERE data_source = 'simulation' AND is_simulated IS FALSE"
            )
        )


def provision_initial_admin():
    """Keep the bootstrap administrator in sync with INITIAL_ADMIN_EMAIL / INITIAL_ADMIN_PASSWORD.

    The account is created if missing. If it exists but the stored password no longer matches
    the configured one, the password is reset and the account is re-activated as administrator.
    Previously this ran only once, so changing the variables later silently did nothing and
    locked people out. When the password already matches, nothing is modified, so an admin
    who was deliberately deactivated stays deactivated.
    """
    if bool(settings.initial_admin_email) != bool(settings.initial_admin_password):
        raise RuntimeError("Set both INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD to provision an administrator.")
    if not settings.initial_admin_email:
        return

    with SessionLocal() as db:
        admin = db.scalar(select(User).where(User.email == settings.initial_admin_email))
        if admin is not None and verify_password(settings.initial_admin_password, admin.password_hash):
            return
        if admin is None:
            admin = User(email=settings.initial_admin_email)
            db.add(admin)
        admin.full_name = admin.full_name or settings.initial_admin_name
        admin.role = "administrator"
        admin.is_active = True
        admin.password_hash = hash_password(settings.initial_admin_password)
        db.commit()


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    migrate_additive_columns()
    provision_initial_admin()
    yield


app = FastAPI(
    title="Smart Silo Monitoring API",
    description="Role-protected API for grain silo users, storage, sensor readings, alerts, and inspections.",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

for route_module in (auth, users, silos, monitoring, inspections, reports):
    app.include_router(route_module.router, prefix="/api")
app.include_router(monitoring.hardware_router, prefix="/api")


@app.get("/health", tags=["health"])
def health_check():
    return {"status": "ok", "environment": settings.app_env}