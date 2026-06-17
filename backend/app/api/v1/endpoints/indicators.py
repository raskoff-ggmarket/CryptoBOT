from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.models.bot import Bot
from app.models.indicator_config import IndicatorConfig
from app.models.exchange_key import ExchangeKey
from app.services.indicator_service import AVAILABLE_INDICATORS, evaluate_conditions, klines_to_df
from app.services.binance_client import BinanceSpotClient
from app.core.security import decrypt_api_key
from app.schemas.common import success_response

router = APIRouter(tags=["Indicators"])

VALID_TIMEFRAMES = ["1m", "3m", "5m", "15m", "30m", "1h", "2h", "4h", "6h", "8h", "12h", "1d", "3d", "1w"]


@router.get("/indicators/available")
async def get_available_indicators(current_user: User = Depends(get_current_user)):
    return success_response(list(AVAILABLE_INDICATORS.values()))


@router.get("/indicators/timeframes")
async def get_timeframes(current_user: User = Depends(get_current_user)):
    return success_response(VALID_TIMEFRAMES)


@router.post("/indicators/evaluate")
async def evaluate_indicator(
    pair: str = Query(...),
    timeframe: str = Query("1h"),
    conditions: list = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if conditions is None:
        conditions = []

    ek = (await db.execute(
        select(ExchangeKey).where(
            ExchangeKey.user_id == current_user.id,
            ExchangeKey.is_valid == True
        ).limit(1)
    )).scalar_one_or_none()

    if ek:
        client = BinanceSpotClient(decrypt_api_key(ek.api_key_enc), decrypt_api_key(ek.api_secret_enc))
    else:
        client = BinanceSpotClient(api_key="", api_secret="")

    klines = await client.get_klines(pair.upper(), timeframe, 200)
    df = klines_to_df(klines)
    result = evaluate_conditions(df, conditions)
    return success_response({"pair": pair, "timeframe": timeframe, "signal": result})


@router.get("/bots/{bot_id}/indicators")
async def get_bot_indicators(
    bot_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    bot = await _get_user_bot(db, bot_id, current_user.id)
    result = await db.execute(select(IndicatorConfig).where(IndicatorConfig.bot_id == bot_id))
    configs = result.scalars().all()
    return success_response([{
        "id": c.id,
        "trigger_type": c.trigger_type,
        "logic_operator": c.logic_operator,
        "conditions": c.conditions,
    } for c in configs])


@router.put("/bots/{bot_id}/indicators")
async def set_bot_indicators(
    bot_id: int,
    data: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    bot = await _get_user_bot(db, bot_id, current_user.id)

    # Delete existing
    result = await db.execute(select(IndicatorConfig).where(IndicatorConfig.bot_id == bot_id))
    for ic in result.scalars():
        await db.delete(ic)

    # Insert new
    configs = data.get("configs", [])
    for cfg in configs:
        ic = IndicatorConfig(
            bot_id=bot_id,
            trigger_type=cfg.get("trigger_type", "start_deal"),
            logic_operator=cfg.get("logic_operator", "AND"),
            conditions=cfg.get("conditions", []),
        )
        db.add(ic)

    await db.commit()
    return success_response(message="Indicator configs updated")


async def _get_user_bot(db: AsyncSession, bot_id: int, user_id: int) -> Bot:
    result = await db.execute(select(Bot).where(Bot.id == bot_id, Bot.user_id == user_id))
    bot = result.scalar_one_or_none()
    if not bot:
        raise HTTPException(status_code=404, detail="Bot not found")
    return bot
