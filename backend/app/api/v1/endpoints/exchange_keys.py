from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.security import encrypt_api_key, decrypt_api_key
from app.models.user import User
from app.models.exchange_key import ExchangeKey
from app.schemas.exchange_key import ExchangeKeyCreate, ExchangeKeyRead, ExchangeKeyUpdate, AccountBalances, BalanceItem
from app.schemas.common import success_response
from app.services.binance_client import BinanceSpotClient
from datetime import datetime, timezone

router = APIRouter(prefix="/exchange-keys", tags=["Exchange Keys"])


def _mask_key(key: ExchangeKey) -> dict:
    data = ExchangeKeyRead.model_validate(key).model_dump()
    raw_key = decrypt_api_key(key.api_key_enc)
    data["api_key_masked"] = raw_key[:6] + "*" * (len(raw_key) - 10) + raw_key[-4:]
    return data


@router.get("")
async def list_keys(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(ExchangeKey).where(ExchangeKey.user_id == current_user.id))
    keys = result.scalars().all()
    return success_response([_mask_key(k) for k in keys])


@router.post("")
async def create_key(
    data: ExchangeKeyCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    key = ExchangeKey(
        user_id=current_user.id,
        label=data.label,
        exchange=data.exchange,
        api_key_enc=encrypt_api_key(data.api_key),
        api_secret_enc=encrypt_api_key(data.api_secret),
        is_paper=data.is_paper,
    )
    db.add(key)
    await db.commit()
    return success_response(_mask_key(key))


@router.get("/{key_id}")
async def get_key(
    key_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    key = await _get_user_key(db, key_id, current_user.id)
    return success_response(_mask_key(key))


@router.patch("/{key_id}")
async def update_key(
    key_id: int,
    data: ExchangeKeyUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    key = await _get_user_key(db, key_id, current_user.id)
    if data.label:
        key.label = data.label
    await db.commit()
    return success_response(_mask_key(key))


@router.delete("/{key_id}")
async def delete_key(
    key_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    key = await _get_user_key(db, key_id, current_user.id)
    await db.delete(key)
    await db.commit()
    return success_response(message="Exchange key deleted")


@router.post("/{key_id}/validate")
async def validate_key(
    key_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    key = await _get_user_key(db, key_id, current_user.id)
    api_key = decrypt_api_key(key.api_key_enc)
    api_secret = decrypt_api_key(key.api_secret_enc)
    client = BinanceSpotClient(api_key, api_secret)
    result = await client.validate_api_key()
    key.is_valid = result["valid"]
    key.permissions = result.get("permissions", [])
    key.validated_at = datetime.now(timezone.utc)
    await db.commit()
    return success_response(result)


@router.get("/{key_id}/balances")
async def get_balances(
    key_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    key = await _get_user_key(db, key_id, current_user.id)
    api_key = decrypt_api_key(key.api_key_enc)
    api_secret = decrypt_api_key(key.api_secret_enc)
    client = BinanceSpotClient(api_key, api_secret)
    balances = await client.get_balances()
    items = [
        BalanceItem(
            asset=b["asset"],
            free=b["free"],
            locked=b["locked"],
            total=str(float(b["free"]) + float(b["locked"])),
        )
        for b in balances
    ]
    return success_response(AccountBalances(exchange_key_id=key_id, balances=items).model_dump())


async def _get_user_key(db: AsyncSession, key_id: int, user_id: int) -> ExchangeKey:
    result = await db.execute(
        select(ExchangeKey).where(ExchangeKey.id == key_id, ExchangeKey.user_id == user_id)
    )
    key = result.scalar_one_or_none()
    if not key:
        raise HTTPException(status_code=404, detail="Exchange key not found")
    return key
