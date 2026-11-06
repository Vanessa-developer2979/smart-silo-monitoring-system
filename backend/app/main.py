from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, select, text

from app.config import settings
from app.database import Base, SessionLocal, engine
from app.routes import auth, inspections, monitoring, reports, silos, users
from app.models import User
from app.security import hash_password


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
    if bool(settings.initial_admin_email) != bool(settings.initial_admin_password):
        raise RuntimeError("Set both INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD to provision an administrator.")
    if not settings.initial_admin_email:
        return

    with engine.begin() as connection:
        connection.execute(
            text(
                "CREATE TABLE IF NOT EXISTS app_migrations ("
                "name VARCHAR(120) PRIMARY KEY, "
                "applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)"
            )
        )

    migration_name = "initial-admin-provisioned"
    with SessionLocal() as db:
        if db.scalar(
            text("SELECT 1 FROM app_migrations WHERE name = :name"),
            {"name": migration_name},
        ):
            return

        admin = db.scalar(select(User).where(User.email == settings.initial_admin_email))
        if admin is None:
            admin = User(email=settings.initial_admin_email)
            db.add(admin)
        admin.full_name = settings.initial_admin_name
        admin.role = "administrator"
        admin.is_active = True
        admin.password_hash = hash_password(settings.initial_admin_password)
        db.execute(
            text("INSERT INTO app_migrations (name) VALUES (:name)"),
            {"name": migration_name},
        )
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
