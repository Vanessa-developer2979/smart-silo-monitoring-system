from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class UserCreate(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=1, max_length=150)
    role: Literal["administrator", "operator"] = "operator"
    password: str = Field(min_length=8, max_length=128)


class UserRegistration(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=1, max_length=150)
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class UserRead(ORMModel):
    id: int
    email: str
    full_name: str
    role: str
    is_active: bool
    created_at: datetime


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserRead


class SiloCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    location: str = Field(min_length=1, max_length=200)
    grain_type: str = Field(min_length=1, max_length=60)
    capacity_tonnes: float = Field(gt=0)
    capacity_percent: float = Field(default=0, ge=0, le=100)
    temperature_warning_c: float = Field(default=24, ge=-20, le=80)
    temperature_critical_c: float = Field(default=28, ge=-20, le=80)
    humidity_warning_percent: float = Field(default=65, ge=0, le=100)
    humidity_critical_percent: float = Field(default=72, ge=0, le=100)


class SiloUpdate(BaseModel):
    name: str = Field(default=None, min_length=1, max_length=120)
    location: str = Field(default=None, min_length=1, max_length=200)
    grain_type: str = Field(default=None, min_length=1, max_length=60)
    capacity_tonnes: float = Field(default=None, gt=0)
    capacity_percent: float = Field(default=None, ge=0, le=100)
    temperature_warning_c: float = Field(default=None, ge=-20, le=80)
    temperature_critical_c: float = Field(default=None, ge=-20, le=80)
    humidity_warning_percent: float = Field(default=None, ge=0, le=100)
    humidity_critical_percent: float = Field(default=None, ge=0, le=100)
    is_active: bool | None = None


class ReadingValues(BaseModel):
    silo_id: int = Field(gt=0)
    temperature_c: float = Field(ge=-80, le=120)
    humidity_percent: float = Field(ge=0, le=100)
    grain_moisture_percent: float | None = Field(default=None, ge=0, le=100)
    recorded_at: datetime | None = None


class ReadingCreate(ReadingValues):
    data_source: Literal["manual"] = "manual"


class HardwareReadingCreate(ReadingValues):
    pass


class ReadingRead(ORMModel):
    id: int
    silo_id: int
    temperature_c: float
    humidity_percent: float
    grain_moisture_percent: float | None
    recorded_at: datetime
    is_simulated: bool
    data_source: Literal["hardware", "manual"]
    source: str


class AlertCreate(BaseModel):
    silo_id: int = Field(gt=0)
    severity: Literal["info", "warning", "critical"]
    message: str = Field(min_length=1, max_length=1000)


class AlertRead(ORMModel):
    id: int
    silo_id: int
    severity: str
    message: str
    created_at: datetime
    acknowledged: bool
    resolved: bool


class InspectionCreate(BaseModel):
    silo_id: int = Field(gt=0)
    user_id: int | None = None
    activity_type: Literal["inspection", "maintenance", "cleaning", "other"]
    notes: str = Field(min_length=1, max_length=5000)
    performed_at: datetime | None = None


class InspectionRead(ORMModel):
    id: int
    silo_id: int
    user_id: int | None
    activity_type: str
    notes: str
    performed_at: datetime
    logged_by: str | None = None


class AssignmentCreate(BaseModel):
    user_id: int = Field(gt=0)
    silo_id: int = Field(gt=0)
