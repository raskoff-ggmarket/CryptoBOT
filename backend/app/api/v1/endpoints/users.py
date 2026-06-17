from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.security import verify_password, get_password_hash
from app.models.user import User
from app.schemas.user import UserRead, UserUpdate, PasswordChange
from app.schemas.common import success_response

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/me", response_model=None)
async def get_me(current_user: User = Depends(get_current_user)):
    return success_response(UserRead.model_validate(current_user).model_dump())


@router.patch("/me", response_model=None)
async def update_me(
    data: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if data.username is not None:
        current_user.username = data.username
    if data.language is not None:
        current_user.language = data.language
    if data.timezone is not None:
        current_user.timezone = data.timezone
    await db.commit()
    return success_response(UserRead.model_validate(current_user).model_dump())


@router.patch("/me/password", response_model=None)
async def change_password(
    data: PasswordChange,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not verify_password(data.old_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Wrong current password")
    current_user.hashed_password = get_password_hash(data.new_password)
    await db.commit()
    return success_response(message="Password updated")
