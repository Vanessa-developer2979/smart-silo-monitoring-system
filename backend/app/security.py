from datetime import datetime, timedelta, timezone

import jwt
from pwdlib import PasswordHash

from app.config import settings

password_hash = PasswordHash.recommended()
# Verified against when an account does not exist so login timing does not reveal
# which email addresses are registered.
_DUMMY_HASH = password_hash.hash("timing-equalisation-placeholder")


def hash_password(password: str) -> str:
    return password_hash.hash(password)


def verify_password(password: str, hashed_password: str | None) -> bool:
    if not hashed_password:
        password_hash.verify(password, _DUMMY_HASH)
        return False
    return password_hash.verify(password, hashed_password)


def create_access_token(user_id: int, role: str) -> str:
    token_role = "admin" if role == "administrator" else "operator"
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_access_token_minutes)
    return jwt.encode(
        {"sub": str(user_id), "role": token_role, "exp": expires_at},
        settings.jwt_secret_key,
        algorithm="HS256",
    )
