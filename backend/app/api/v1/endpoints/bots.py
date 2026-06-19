from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.security import generate_webhook_secret
from app.models.user import User
from app.models.bot import Bot
from app.models.deal import Deal
from app.models.exchange_key import ExchangeKey
from app.schemas.bot import BotCreate, BotRead, BotUpdate, BotStopRequest, BotStats, SafetyOrderPreview
from app.schemas.common import success_response, paginated_response
from app.services.dca_engine import dca_engine
from app.services.binance_client import BinanceSpotClient
from app.core.security import decrypt_api_key
from decimal import Decimal

router = APIRouter(prefix="/bots", tags=["Bots"])


@router.get("")
async def list_bots(
    status: str = Query(None),
    pair: str = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(Bot).where(Bot.user_id == current_user.id)
    if status:
        q = q.where(Bot.status == status)
    if pair:
        q = q.where(Bot.pair == pair.upper())

    total_result = await db.execute(select(func.count()).select_from(q.subquery()))
    total = total_result.scalar()

    q = q.order_by(Bot.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(q)
    bots = result.scalars().all()

    data = []
    for bot in bots:
        bot_data = BotRead.model_validate(bot).model_dump()
        active_count = await db.execute(
            select(func.count(Deal.id)).where(Deal.bot_id == bot.id, Deal.status == "active")
        )
        bot_data["active_deals_count"] = active_count.scalar() or 0
        data.append(bot_data)

    return paginated_response(data, total, page, page_size)


@router.post("")
async def create_bot(
    data: BotCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if data.exchange_key_id:
        ek = await db.execute(
            select(ExchangeKey).where(
                ExchangeKey.id == data.exchange_key_id,
                ExchangeKey.user_id == current_user.id
            )
        )
        if not ek.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="Exchange key not found")

    pair = data.pair.upper()
    base_asset = pair.replace("USDT", "").replace("BTC", "") if "USDT" in pair else pair[:-3]
    quote_asset = "USDT" if "USDT" in pair else pair[-3:]

    bot = Bot(
        user_id=current_user.id,
        exchange_key_id=data.exchange_key_id,
        name=data.name,
        pair=pair,
        base_asset=base_asset,
        quote_asset=quote_asset,
        base_order_type=data.base_order_type,
        base_order_size=data.base_order_size,
        max_safety_orders=data.max_safety_orders,
        safety_order_size=data.safety_order_size,
        safety_order_step_pct=data.safety_order_step_pct,
        safety_order_volume_scale=data.safety_order_volume_scale,
        safety_order_step_scale=data.safety_order_step_scale,
        take_profit_type=data.take_profit_type,
        take_profit_pct=data.take_profit_pct,
        trailing_deviation_pct=data.trailing_deviation_pct,
        stop_loss_enabled=data.stop_loss_enabled,
        stop_loss_type=data.stop_loss_type,
        stop_loss_pct=data.stop_loss_pct,
        stop_loss_trailing_pct=data.stop_loss_trailing_pct,
        start_condition=data.start_condition,
        reinvest_pct=data.reinvest_pct,
        is_paper=data.is_paper,
        max_deals_count=data.max_deals_count,
        cooldown_seconds=data.cooldown_seconds,
        webhook_secret=generate_webhook_secret() if data.start_condition == "webhook" else None,
    )
    db.add(bot)
    await db.commit()
    return success_response(BotRead.model_validate(bot).model_dump())


@router.get("/{bot_id}")
async def get_bot(
    bot_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    bot = await _get_user_bot(db, bot_id, current_user.id)
    bot_data = BotRead.model_validate(bot).model_dump()
    active_count = await db.execute(
        select(func.count(Deal.id)).where(Deal.bot_id == bot.id, Deal.status == "active")
    )
    bot_data["active_deals_count"] = active_count.scalar() or 0
    return success_response(bot_data)


@router.patch("/{bot_id}")
async def update_bot(
    bot_id: int,
    data: BotUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    bot = await _get_user_bot(db, bot_id, current_user.id)
    if bot.status == "active":
        raise HTTPException(status_code=400, detail="Cannot update active bot. Stop it first.")

    update_fields = data.model_dump(exclude_none=True)
    for field, value in update_fields.items():
        setattr(bot, field, value)

    await db.commit()
    return success_response(BotRead.model_validate(bot).model_dump())


@router.delete("/{bot_id}")
async def delete_bot(
    bot_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    bot = await _get_user_bot(db, bot_id, current_user.id)
    if bot.status == "active":
        bot.status = "inactive"
    await db.delete(bot)
    await db.commit()
    return success_response(message="Bot deleted")


@router.post("/{bot_id}/start")
async def start_bot(
    bot_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    bot = await _get_user_bot(db, bot_id, current_user.id)
    if bot.status == "active":
        raise HTTPException(status_code=400, detail="Bot is already active")
    if not bot.exchange_key_id and not bot.is_paper:
        raise HTTPException(status_code=400, detail="Exchange key required for live trading")

    bot.status = "active"
    await db.commit()
    return success_response({"status": "active"})


@router.post("/{bot_id}/stop")
async def stop_bot(
    bot_id: int,
    data: BotStopRequest = BotStopRequest(),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    bot = await _get_user_bot(db, bot_id, current_user.id)
    bot.status = "inactive"

    if data.close_deals:
        result = await db.execute(
            select(Deal).where(Deal.bot_id == bot_id, Deal.status == "active")
        )
        active_deals = result.scalars().all()
        for deal in active_deals:
            deal.status = "cancelled"

    await db.commit()
    return success_response({"status": "inactive"})


@router.post("/{bot_id}/pause")
async def pause_bot(
    bot_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    bot = await _get_user_bot(db, bot_id, current_user.id)
    if bot.status != "active":
        raise HTTPException(status_code=400, detail="Bot is not active")
    bot.status = "paused"
    await db.commit()
    return success_response({"status": "paused"})


@router.post("/{bot_id}/duplicate")
async def duplicate_bot(
    bot_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    bot = await _get_user_bot(db, bot_id, current_user.id)
    new_bot = Bot(
        user_id=current_user.id,
        exchange_key_id=bot.exchange_key_id,
        name=f"{bot.name} (Copy)",
        pair=bot.pair,
        base_asset=bot.base_asset,
        quote_asset=bot.quote_asset,
        base_order_type=bot.base_order_type,
        base_order_size=bot.base_order_size,
        max_safety_orders=bot.max_safety_orders,
        safety_order_size=bot.safety_order_size,
        safety_order_step_pct=bot.safety_order_step_pct,
        safety_order_volume_scale=bot.safety_order_volume_scale,
        safety_order_step_scale=bot.safety_order_step_scale,
        take_profit_type=bot.take_profit_type,
        take_profit_pct=bot.take_profit_pct,
        trailing_deviation_pct=bot.trailing_deviation_pct,
        stop_loss_enabled=bot.stop_loss_enabled,
        stop_loss_type=bot.stop_loss_type,
        stop_loss_pct=bot.stop_loss_pct,
        stop_loss_trailing_pct=bot.stop_loss_trailing_pct,
        start_condition=bot.start_condition,
        reinvest_pct=bot.reinvest_pct,
        is_paper=bot.is_paper,
    )
    db.add(new_bot)
    await db.commit()
    return success_response(BotRead.model_validate(new_bot).model_dump())


@router.get("/{bot_id}/stats")
async def get_bot_stats(
    bot_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    bot = await _get_user_bot(db, bot_id, current_user.id)
    result = await db.execute(
        select(Deal).where(Deal.bot_id == bot_id, Deal.status == "completed")
    )
    deals = result.scalars().all()

    total = len(deals)
    winning = sum(1 for d in deals if d.realized_pnl and d.realized_pnl > 0)
    total_profit = sum(d.realized_pnl or Decimal("0") for d in deals)

    return success_response(BotStats(
        bot_id=bot_id,
        total_deals=total,
        winning_deals=winning,
        losing_deals=total - winning,
        win_rate_pct=Decimal(str(round(winning / total * 100, 2))) if total else None,
        total_profit=total_profit,
        total_profit_pct=None,
        avg_deal_duration_hours=None,
    ).model_dump())


@router.get("/{bot_id}/safety-preview")
async def get_safety_preview(
    bot_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    bot = await _get_user_bot(db, bot_id, current_user.id)

    # Get current price — use the bot's key if present, otherwise a public client
    current_price = None
    api_key = api_secret = ""
    if bot.exchange_key_id:
        ek = await db.execute(
            select(ExchangeKey).where(ExchangeKey.id == bot.exchange_key_id)
        )
        key = ek.scalar_one_or_none()
        if key:
            api_key = decrypt_api_key(key.api_key_enc)
            api_secret = decrypt_api_key(key.api_secret_enc)
    try:
        client = BinanceSpotClient(api_key, api_secret)
        current_price = await client.get_ticker_price(bot.pair)
    except Exception:
        pass

    base_price = current_price or Decimal("100")

    levels = dca_engine.compute_safety_levels(
        base_price=base_price,
        base_order_size=bot.base_order_size,
        safety_order_size=bot.safety_order_size,
        safety_order_step_pct=bot.safety_order_step_pct,
        safety_order_volume_scale=bot.safety_order_volume_scale,
        safety_order_step_scale=bot.safety_order_step_scale,
        max_safety_orders=bot.max_safety_orders,
        take_profit_pct=bot.take_profit_pct,
    )

    preview = [
        SafetyOrderPreview(
            num=l.num,
            price=l.price,
            size_quote=l.size_quote,
            deviation_pct=l.deviation_pct,
            cumulative_deviation_pct=l.cumulative_deviation_pct,
            total_quote=l.total_quote,
            avg_price=l.avg_price,
            required_change_pct=l.required_change_pct,
        ).model_dump()
        for l in levels
    ]
    return success_response({"base_price": str(base_price), "levels": preview})


async def _get_user_bot(db: AsyncSession, bot_id: int, user_id: int) -> Bot:
    result = await db.execute(
        select(Bot).where(Bot.id == bot_id, Bot.user_id == user_id)
    )
    bot = result.scalar_one_or_none()
    if not bot:
        raise HTTPException(status_code=404, detail="Bot not found")
    return bot
