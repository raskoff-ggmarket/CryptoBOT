from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.models.exchange_key import ExchangeKey
from app.core.security import decrypt_api_key
from app.services.binance_client import BinanceSpotClient
from app.schemas.common import success_response

router = APIRouter(prefix="/market", tags=["Market"])


async def _get_client(db: AsyncSession, current_user: User) -> BinanceSpotClient:
    result = await db.execute(
        select(ExchangeKey).where(
            ExchangeKey.user_id == current_user.id,
            ExchangeKey.is_valid == True
        ).limit(1)
    )
    key = result.scalar_one_or_none()
    if key:
        return BinanceSpotClient(
            decrypt_api_key(key.api_key_enc),
            decrypt_api_key(key.api_secret_enc),
        )
    # Public client for market data
    return BinanceSpotClient(api_key="", api_secret="")


@router.get("/pairs")
async def get_tradable_pairs(
    quote_asset: str = Query("USDT"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    client = await _get_client(db, current_user)
    pairs = await client.get_tradable_pairs(quote_asset)
    return success_response(pairs)


@router.get("/ticker/{pair}")
async def get_ticker(
    pair: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    client = await _get_client(db, current_user)
    ticker = await client.get_ticker_24h(pair.upper())
    return success_response(ticker)


@router.get("/klines/{pair}")
async def get_klines(
    pair: str,
    interval: str = Query("1h"),
    limit: int = Query(200, ge=1, le=1000),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    client = await _get_client(db, current_user)
    klines = await client.get_klines(pair.upper(), interval, limit)
    formatted = [{
        "open_time": k[0],
        "open": k[1],
        "high": k[2],
        "low": k[3],
        "close": k[4],
        "volume": k[5],
        "close_time": k[6],
    } for k in klines]
    return success_response(formatted)


@router.get("/exchange-info/{pair}")
async def get_exchange_info(
    pair: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    client = await _get_client(db, current_user)
    info = await client.get_symbol_info(pair.upper())
    filters = {f["filterType"]: f for f in info.get("filters", [])}
    return success_response({
        "symbol": info["symbol"],
        "baseAsset": info["baseAsset"],
        "quoteAsset": info["quoteAsset"],
        "lot_size": filters.get("LOT_SIZE"),
        "price_filter": filters.get("PRICE_FILTER"),
        "min_notional": filters.get("MIN_NOTIONAL"),
    })
