from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import Inspection, Silo, User
from app.schemas import InspectionCreate, InspectionRead

router = APIRouter(prefix="/inspections", tags=["inspections and maintenance"], dependencies=[Depends(get_current_user)])


@router.get("/", response_model=list[InspectionRead])
def list_inspections(silo_id: int | None = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    query = select(Inspection).join(Silo).order_by(Inspection.performed_at.desc())
    if silo_id is not None:
        query = query.where(Inspection.silo_id == silo_id)
    if current_user.role != "administrator":
        query = query.where(Silo.operators.any(User.id == current_user.id))
    return db.scalars(query).all()


@router.post("/", response_model=InspectionRead, status_code=status.HTTP_201_CREATED)
def create_inspection(payload: InspectionCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    silo = db.get(Silo, payload.silo_id)
    if silo is None:
        raise HTTPException(status_code=404, detail="Silo not found.")
    if current_user.role != "administrator" and silo not in current_user.assigned_silos:
        raise HTTPException(status_code=403, detail="This silo is not assigned to your account.")
    user_id = payload.user_id if current_user.role == "administrator" else current_user.id
    if user_id is not None and db.get(User, user_id) is None:
        raise HTTPException(status_code=404, detail="User not found.")
    inspection = Inspection(**payload.model_dump(exclude={"performed_at", "user_id"}), user_id=user_id)
    if payload.performed_at:
        inspection.performed_at = payload.performed_at
    db.add(inspection)
    db.commit()
    db.refresh(inspection)
    return inspection
