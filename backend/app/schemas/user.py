from pydantic import BaseModel, EmailStr, Field
from datetime import datetime
from typing import Optional


class UserRead(BaseModel):
    id: int
    email: str
    username: str
    is_active: bool
    is_verified: bool
    language: str
    timezone: str
    created_at: datetime

    model_config = {"from_attributes": True}


class UserUpdate(BaseModel):
    username: Optional[str] = Field(None, min_length=3, max_length=100)
    language: Optional[str] = Field(None, pattern="^(tr|en)$")
    timezone: Optional[str] = None


class PasswordChange(BaseModel):
    old_password: str
    new_password: str = Field(min_length=8)
