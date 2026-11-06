import os
import secrets

from dotenv import load_dotenv

load_dotenv()

database_url = os.getenv("DATABASE_URL", "sqlite:///./smart_silo.db")
if database_url.startswith(("postgres://", "postgresql://")):
    database_url = database_url.replace("postgres://", "postgresql+psycopg://", 1)
    database_url = database_url.replace("postgresql://", "postgresql+psycopg://", 1)


class Settings:
    app_env: str = os.getenv("APP_ENV", "development")
    database_url: str = database_url
    jwt_secret_key: str = os.getenv("JWT_SECRET_KEY", "")
    jwt_access_token_minutes: int = int(os.getenv("JWT_ACCESS_TOKEN_MINUTES", "30"))
    initial_admin_email: str = os.getenv("INITIAL_ADMIN_EMAIL", "").strip().lower()
    initial_admin_password: str = os.getenv("INITIAL_ADMIN_PASSWORD", "")
    initial_admin_name: str = os.getenv("INITIAL_ADMIN_NAME", "System Administrator")
    esp32_api_key: str = os.getenv("ESP32_API_KEY", "")
    cors_origins: list[str] = [
        origin.strip()
        for origin in os.getenv(
            "CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
        ).split(",")
        if origin.strip()
    ]


settings = Settings()
if not settings.jwt_secret_key:
    if settings.app_env.lower() == "production":
        raise RuntimeError("JWT_SECRET_KEY must be configured in production.")
    settings.jwt_secret_key = secrets.token_urlsafe(48)
if len(settings.jwt_secret_key) < 32 and settings.app_env.lower() == "production":
    raise RuntimeError("JWT_SECRET_KEY must contain at least 32 characters in production.")
if settings.esp32_api_key and len(settings.esp32_api_key) < 32 and settings.app_env.lower() == "production":
    raise RuntimeError("ESP32_API_KEY must contain at least 32 characters in production.")
