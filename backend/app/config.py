import os
import secrets

from dotenv import load_dotenv

load_dotenv()


class Settings:
    app_env: str = os.getenv("APP_ENV", "development")
    demo_mode_enabled: bool = os.getenv(
        "DEMO_MODE_ENABLED",
        "false" if os.getenv("APP_ENV", "development").lower() == "production" else "true",
    ).strip().lower() in {"1", "true", "yes", "on"}
    database_url: str = os.getenv("DATABASE_URL", "sqlite:///./smart_silo.db")
    jwt_secret_key: str = os.getenv("JWT_SECRET_KEY", "")
    jwt_access_token_minutes: int = int(os.getenv("JWT_ACCESS_TOKEN_MINUTES", "30"))
    initial_admin_email: str = os.getenv("INITIAL_ADMIN_EMAIL", "").strip().lower()
    initial_admin_password: str = os.getenv("INITIAL_ADMIN_PASSWORD", "")
    initial_admin_name: str = os.getenv("INITIAL_ADMIN_NAME", "System Administrator")
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
