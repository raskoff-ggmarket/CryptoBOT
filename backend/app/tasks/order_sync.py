import asyncio
import logging
from app.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(name="app.tasks.order_sync.sync_open_orders")
def sync_open_orders():
    asyncio.run(_sync_async())


async def _sync_async():
    from app.core.database import AsyncSessionLocal
    from app.models.order import Order
    from app.models.deal import Deal
    from app.models.bot import Bot
    from app.models.exchange_key import ExchangeKey
    from app.services.binance_client import BinanceSpotClient
    from app.core.security import decrypt_api_key
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload
    from decimal import Decimal

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Order).where(Order.status.in_(["open", "pending"]), Order.is_paper == False)
            .options(selectinload(Order.deal))
        )
        orders = result.scalars().all()

        key_cache = {}
        for order in orders:
            if not order.binance_order_id:
                continue
            bot_result = await db.execute(
                select(Bot).where(Bot.id == order.bot_id).options(selectinload(Bot.exchange_key))
            )
            bot = bot_result.scalar_one_or_none()
            if not bot or not bot.exchange_key:
                continue

            key_id = bot.exchange_key_id
            if key_id not in key_cache:
                api_key = decrypt_api_key(bot.exchange_key.api_key_enc)
                api_secret = decrypt_api_key(bot.exchange_key.api_secret_enc)
                key_cache[key_id] = BinanceSpotClient(api_key, api_secret)

            client = key_cache[key_id]
            try:
                binance_order = await client.get_order_status(bot.pair, order.binance_order_id)
                status = binance_order.get("status", "").upper()

                if status == "FILLED":
                    order.status = "filled"
                    order.filled_quantity = Decimal(str(binance_order.get("executedQty", 0)))
                    order.avg_fill_price = Decimal(str(binance_order.get("price", 0)))
                elif status == "CANCELED":
                    order.status = "cancelled"
                elif status == "PARTIALLY_FILLED":
                    order.status = "partially_filled"
                    order.filled_quantity = Decimal(str(binance_order.get("executedQty", 0)))
            except Exception as e:
                logger.error(f"Order sync failed for order {order.id}: {e}")

        await db.commit()
