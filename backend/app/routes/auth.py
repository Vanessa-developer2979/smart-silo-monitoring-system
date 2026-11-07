from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import User
from app.schemas import AuthResponse, LoginRequest, UserRead, UserRegistration
from app.security import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["authentication"])


def auth_response(user: User) -> AuthResponse:
    return AuthResponse(access_token=create_access_token(user.id, user.role), user=user)


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def register(payload: UserRegistration, db: Session = Depends(get_db)):
    user = User(
        email=str(payload.email).lower(),
        full_name=payload.full_name.strip(),
        role="operator",
        password_hash=hash_password(payload.password),
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="An account with this email already exists.") from exc
    db.refresh(user)
    return auth_response(user)


@router.post("/login", response_model=AuthResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == str(payload.email).lower()))
    password_ok = verify_password(payload.password, user.password_hash if user else None)
    if user is None or not user.is_active or not password_ok:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Email or password is incorrect.")
    return auth_response(user)


@router.get("/me", response_model=UserRead)
def current_user(user: User = Depends(get_current_user)):
    return user
