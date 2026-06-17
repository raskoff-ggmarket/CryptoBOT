from fastapi import APIRouter, Depends, HTTPException, Request, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.models.bot import Bot
from app.models.webhook_signal import WebhookSignal
from app.schemas.common import success_response, paginated_response
from decimal import Decimal
from datetime import datetime, timezone

router = APIRouter(prefix="/webhooks", tags=["Webhooks"])


@router.post("/bots/{bot_id}")
async def receive_webhook(
    bot_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    payload = await request.json()

    result = await db.execute(select(Bot).where(Bot.id == bot_id))
    bot = result.scalar_one_or_none()
    if not bot:
        raise HTTPException(status_code=404, detail="Bot not found")

    if bot.start_condition != "webhook":
        raise HTTPException(status_code=400, detail="Bot is not configured for webhooks")

    # Validate webhook secret
    provided_secret = payload.get("secret", "")
    if bot.webhook_secret and provided_secret != bot.webhook_secret:
        raise HTTPException(status_code=403, detail="Invalid webhook secret")

    action = payload.get("action", "start_deal")
    pair = payload.get("pair", bot.pair)
    price_str = payload.get("price")
    price = Decimal(str(price_str)) if price_str else None

    signal = WebhookSignal(
        bot_id=bot_id,
        user_id=bot.user_id,
        raw_payload=payload,
        action=action,
        pair=pair,
        price=price,
        received_at=datetime.now(timezone.utc),
    )
    db.add(signal)
    await db.commit()

    # Trigger bot action based on signal
    if action == "start_deal" and bot.status == "active":
        signal.processed = True
        signal.processed_at = datetime.now(timezone.utc)
        await db.commit()

    return success_response({"signal_id": signal.id, "action": action})


@router.get("/signals")
async def list_signals(
    bot_id: int = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(WebhookSignal).where(WebhookSignal.user_id == current_user.id)
    if bot_id:
        q = q.where(WebhookSignal.bot_id == bot_id)

    from sqlalchemy import func
    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar()
    q = q.order_by(WebhookSignal.received_at.desc()).offset((page - 1) * page_size).limit(page_size)
    signals = (await db.execute(q)).scalars().all()

    data = [{
        "id": s.id,
        "bot_id": s.bot_id,
        "action": s.action,
        "pair": s.pair,
        "price": str(s.price) if s.price else None,
        "processed": s.processed,
        "error_message": s.error_message,
        "received_at": s.received_at.isoformat(),
    } for s in signals]

    return paginated_response(data, total, page, page_size)


@router.post("/bots/{bot_id}/regenerate-secret")
async def regenerate_secret(
    bot_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Bot).where(Bot.id == bot_id, Bot.user_id == current_user.id)
    )
    bot = result.scalar_one_or_none()
    if not bot:
        raise HTTPException(status_code=404, detail="Bot not found")

    from app.core.security import generate_webhook_secret
    bot.webhook_secret = generate_webhook_secret()
    await db.commit()
    return success_response({"webhook_secret": bot.webhook_secret})
