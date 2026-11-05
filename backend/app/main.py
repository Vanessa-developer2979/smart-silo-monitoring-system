from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, select, text

from app.config import settings
from app.database import Base, SessionLocal, engine
from app.routes import auth, inspections, monitoring, reports, silos, users
from app.models import Silo, User
from app.security import hash_password
from app.services.seed import LOCAL_SILO_NAME, seed_demo_data


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


def migrate_to_local_silo():
    migration_name = "retain-only-local-silo"
    with SessionLocal() as db:
        db.execute(
            text(
                "CREATE TABLE IF NOT EXISTS app_migrations ("
                "name VARCHAR(120) PRIMARY KEY, "
                "applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)"
            )
        )
        applied = db.scalar(
            text("SELECT 1 FROM app_migrations WHERE name = :name"),
            {"name": migration_name},
        )
        if applied:
            return

        silos = db.scalars(select(Silo).where(Silo.name != LOCAL_SILO_NAME)).all()
        for silo in silos:
            db.delete(silo)
        db.execute(
            text("INSERT INTO app_migrations (name) VALUES (:name)"),
            {"name": migration_name},
        )
        db.commit()


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    migrate_additive_columns()
    migrate_to_local_silo()
    with SessionLocal() as db:
        seed_demo_data(db)
        if bool(settings.initial_admin_email) != bool(settings.initial_admin_password):
            raise RuntimeError("Set both INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD to provision an administrator.")
        if settings.initial_admin_email:
            admin = db.scalar(select(User).where(User.email == settings.initial_admin_email))
            if admin is None:
                admin = User(email=settings.initial_admin_email)
                db.add(admin)
            if admin.password_hash is None:
                admin.full_name = settings.initial_admin_name
                admin.role = "administrator"
                admin.is_active = True
                admin.password_hash = hash_password(settings.initial_admin_password)
                db.commit()
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


@app.get("/health", tags=["health"])
def health_check():
    return {"status": "ok", "environment": settings.app_env}
