"""
Celery task: ticks every 5s for all active bots.
Each bot checks: indicator signal -> open deal, price -> trigger SO/TP/SL.
"""
import asyncio
import logging
from decimal import Decimal
from datetime import datetime, timezone

from app.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(name="app.tasks.bot_runner.run_all_active_bots", bind=True, max_retries=3)
def run_all_active_bots(self):
    asyncio.run(_run_all_bots_async())


async def _run_all_bots_async():
    from app.core.database import AsyncSessionLocal
    from app.models.bot import Bot
    from sqlalchemy import select

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Bot).where(Bot.status == "active")
        )
        bots = result.scalars().all()

    tasks = [_tick_bot(bot.id) for bot in bots]
    if tasks:
        await asyncio.gather(*tasks, return_exceptions=True)


async def _tick_bot(bot_id: int):
    from app.core.database import AsyncSessionLocal
    from app.models.bot import Bot
    from app.models.deal import Deal
    from app.models.order import Order
    from app.models.exchange_key import ExchangeKey
    from app.services.binance_client import BinanceSpotClient
    from app.services.paper_trading import paper_engine
    from app.services.dca_engine import dca_engine
    from app.services.indicator_service import evaluate_conditions, klines_to_df
    from app.core.security import decrypt_api_key
    from app.websocket.manager import ws_manager
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Bot).where(Bot.id == bot_id)
            .options(selectinload(Bot.exchange_key))
        )
        bot = result.scalar_one_or_none()
        if not bot or bot.status != "active":
            return

        # Get current price
        try:
            if bot.is_paper:
                client = None
                # For paper trading, use a read-only client for price data
                if bot.exchange_key:
                    api_key = decrypt_api_key(bot.exchange_key.api_key_enc)
                    api_secret = decrypt_api_key(bot.exchange_key.api_secret_enc)
                    client = BinanceSpotClient(api_key, api_secret)
                else:
                    return
            else:
                if not bot.exchange_key:
                    return
                api_key = decrypt_api_key(bot.exchange_key.api_key_enc)
                api_secret = decrypt_api_key(bot.exchange_key.api_secret_enc)
                client = BinanceSpotClient(api_key, api_secret)

            current_price = await client.get_ticker_price(bot.pair)
        except Exception as e:
            logger.error(f"Bot {bot_id}: price fetch failed: {e}")
            return

        # Get active deal
        active_deal_result = await db.execute(
            select(Deal).where(Deal.bot_id == bot_id, Deal.status == "active")
            .options(selectinload(Deal.orders))
        )
        active_deal = active_deal_result.scalar_one_or_none()

        if active_deal:
            # Update price and check TP/SL
            active_deal.current_price = current_price
            await _check_deal_conditions(db, bot, active_deal, current_price, client)
        else:
            # Check if should open new deal
            await _try_open_deal(db, bot, current_price, client)

        await db.commit()


async def _try_open_deal(db, bot, current_price: Decimal, client):
    from app.models.deal import Deal
    from app.models.order import Order
    from app.services.dca_engine import dca_engine
    from app.services.indicator_service import evaluate_conditions, klines_to_df
    from app.services.paper_trading import paper_engine
    from app.websocket.manager import ws_manager
    from datetime import datetime, timezone

    # Check start condition
    if bot.start_condition == "indicator":
        try:
            klines = await client.get_klines(bot.pair, "1h", 200)
            df = klines_to_df(klines)
            from app.models.indicator_config import IndicatorConfig
            from sqlalchemy import select
            ic_result = await db.execute(
                select(IndicatorConfig).where(
                    IndicatorConfig.bot_id == bot.id,
                    IndicatorConfig.trigger_type == "start_deal"
                )
            )
            ic = ic_result.scalar_one_or_none()
            if ic and not evaluate_conditions(df, ic.conditions, ic.logic_operator):
                return
        except Exception as e:
            logger.error(f"Bot {bot.id}: indicator check failed: {e}")
            return
    elif bot.start_condition == "webhook":
        return  # Webhooks are handled separately

    # Place base order
    if bot.is_paper:
        fill = paper_engine.simulate_market_buy(current_price, bot.base_order_size)
    else:
        try:
            binance_result = await client.place_market_buy(bot.pair, bot.base_order_size)
            fill = {
                "binance_order_id": str(binance_result["orderId"]),
                "avg_fill_price": Decimal(str(binance_result.get("fills", [{}])[0].get("price", current_price))) if binance_result.get("fills") else current_price,
                "filled_quantity": Decimal(str(binance_result["executedQty"])),
                "quote_qty": Decimal(str(binance_result["cummulativeQuoteQty"])),
                "commission": Decimal("0"),
                "status": "FILLED",
                "filled_at": datetime.now(timezone.utc),
            }
        except Exception as e:
            logger.error(f"Bot {bot.id}: base order failed: {e}")
            return

    fill_price = fill["avg_fill_price"]
    state = dca_engine.compute_initial_state(
        base_fill_price=fill_price,
        base_order_size=bot.base_order_size,
        safety_order_size=bot.safety_order_size,
        safety_order_step_pct=bot.safety_order_step_pct,
        safety_order_volume_scale=bot.safety_order_volume_scale,
        safety_order_step_scale=bot.safety_order_step_scale,
        max_safety_orders=bot.max_safety_orders,
        take_profit_pct=bot.take_profit_pct,
        stop_loss_pct=bot.stop_loss_pct if bot.stop_loss_enabled else None,
    )

    now = datetime.now(timezone.utc)
    deal = Deal(
        bot_id=bot.id,
        user_id=bot.user_id,
        pair=bot.pair,
        is_paper=bot.is_paper,
        status="active",
        base_order_price=fill_price,
        average_price=state.avg_price,
        current_price=current_price,
        take_profit_price=state.take_profit_price,
        stop_loss_price=state.stop_loss_price,
        total_base_qty=state.total_base,
        total_quote_spent=state.total_quote,
        opened_at=now,
    )
    db.add(deal)
    await db.flush()

    base_order = Order(
        deal_id=deal.id,
        bot_id=bot.id,
        user_id=bot.user_id,
        binance_order_id=fill.get("binance_order_id"),
        type="base",
        side="BUY",
        order_type="MARKET",
        status="filled",
        quantity=fill["filled_quantity"],
        filled_quantity=fill["filled_quantity"],
        quote_qty=fill["quote_qty"],
        avg_fill_price=fill_price,
        commission=fill.get("commission", Decimal("0")),
        is_paper=bot.is_paper,
        placed_at=now,
        filled_at=fill.get("filled_at", now),
    )
    db.add(base_order)

    bot.last_deal_at = now
    await db.flush()

    asyncio.create_task(ws_manager.emit_deal_opened(bot.id, {
        "deal_id": deal.id,
        "pair": deal.pair,
        "base_order_price": str(fill_price),
        "take_profit_price": str(state.take_profit_price),
        "stop_loss_price": str(state.stop_loss_price) if state.stop_loss_price else None,
    }))


async def _check_deal_conditions(db, bot, deal: "Deal", current_price: Decimal, client):
    from app.services.dca_engine import dca_engine, DCAState
    from app.services.paper_trading import paper_engine
    from app.models.order import Order
    from app.websocket.manager import ws_manager
    from datetime import datetime, timezone
    import asyncio

    state = DCAState(
        base_price=deal.base_order_price or current_price,
        total_base=deal.total_base_qty,
        total_quote=deal.total_quote_spent,
        avg_price=deal.average_price or current_price,
        take_profit_price=deal.take_profit_price or current_price,
        stop_loss_price=deal.stop_loss_price,
        safety_levels=dca_engine.compute_safety_levels(
            base_price=deal.base_order_price or current_price,
            base_order_size=bot.base_order_size,
            safety_order_size=bot.safety_order_size,
            safety_order_step_pct=bot.safety_order_step_pct,
            safety_order_volume_scale=bot.safety_order_volume_scale,
            safety_order_step_scale=bot.safety_order_step_scale,
            max_safety_orders=bot.max_safety_orders,
            take_profit_pct=bot.take_profit_pct,
        ),
        next_so_index=deal.safety_orders_filled,
        trailing_tp_high=deal.trailing_tp_high,
        trailing_tp_active=deal.trailing_tp_active,
        trailing_sl_high=deal.trailing_sl_high,
    )

    # Check TP
    tp_triggered, tp_reason = dca_engine.check_take_profit(
        state, current_price, bot.take_profit_type, bot.trailing_deviation_pct
    )

    # Check SL
    sl_triggered, sl_reason = dca_engine.check_stop_loss(
        state, current_price, bot.stop_loss_enabled, bot.stop_loss_type, bot.stop_loss_trailing_pct
    )

    now = datetime.now(timezone.utc)

    if tp_triggered or sl_triggered:
        close_reason = tp_reason if tp_triggered else sl_reason
        close_price = state.take_profit_price if tp_triggered else (state.stop_loss_price or current_price)

        if bot.is_paper:
            sell_result = paper_engine.simulate_market_sell(close_price, state.total_base)
        else:
            try:
                sell_result = await client.place_market_sell(bot.pair, state.total_base)
                sell_fill_price = Decimal(str(sell_result.get("fills", [{}])[0].get("price", close_price)))
                sell_result["avg_fill_price"] = sell_fill_price
            except Exception as e:
                logger.error(f"Deal {deal.id}: sell failed: {e}")
                return

        commission = sell_result.get("commission", deal.total_quote_spent * Decimal("0.001"))
        pnl, pnl_pct = dca_engine.compute_realized_pnl(
            state.avg_price, sell_result["avg_fill_price"], state.total_base, commission
        )

        deal.status = "completed"
        deal.realized_pnl = pnl
        deal.realized_pnl_pct = pnl_pct
        deal.commission_paid += commission
        deal.closed_at = now

        tp_order = Order(
            deal_id=deal.id,
            bot_id=bot.id,
            user_id=bot.user_id,
            type="take_profit" if tp_triggered else "stop_loss",
            side="SELL",
            order_type="MARKET",
            status="filled",
            quantity=state.total_base,
            filled_quantity=state.total_base,
            avg_fill_price=sell_result["avg_fill_price"],
            commission=commission,
            is_paper=bot.is_paper,
            placed_at=now,
            filled_at=now,
        )
        db.add(tp_order)
        bot.deals_completed += 1

        # Reinvest
        if pnl > 0 and bot.reinvest_pct > 0:
            new_base, new_so = dca_engine.compute_reinvested_sizes(
                pnl, bot.base_order_size, bot.safety_order_size, bot.reinvest_pct
            )
            bot.base_order_size = new_base
            bot.safety_order_size = new_so

        asyncio.create_task(ws_manager.emit_deal_closed(bot.id, {
            "deal_id": deal.id,
            "close_reason": close_reason,
            "realized_pnl": str(pnl),
            "realized_pnl_pct": str(pnl_pct),
        }))
        return

    # Update trailing state
    deal.trailing_tp_high = state.trailing_tp_high
    deal.trailing_tp_active = state.trailing_tp_active
    deal.trailing_sl_high = state.trailing_sl_high

    # Check and place next safety order
    if state.next_so_index < len(state.safety_levels):
        next_so = state.safety_levels[state.next_so_index]
        if current_price <= next_so.price and deal.safety_orders_placed == deal.safety_orders_filled:
            if bot.is_paper:
                so_fill = paper_engine.simulate_market_buy(current_price, next_so.size_quote)
            else:
                try:
                    so_fill = await client.place_market_buy(bot.pair, next_so.size_quote)
                    so_fill["avg_fill_price"] = Decimal(str(so_fill.get("fills", [{}])[0].get("price", current_price)))
                    so_fill["filled_quantity"] = Decimal(str(so_fill["executedQty"]))
                    so_fill["quote_qty"] = Decimal(str(so_fill["cummulativeQuoteQty"]))
                    so_fill["commission"] = Decimal("0")
                except Exception as e:
                    logger.error(f"Deal {deal.id}: SO placement failed: {e}")
                    return

            new_state = dca_engine.apply_safety_order_fill(
                state, so_fill["avg_fill_price"], next_so.size_quote,
                bot.take_profit_pct, bot.stop_loss_pct, bot.stop_loss_type
            )

            deal.average_price = new_state.avg_price
            deal.total_base_qty = new_state.total_base
            deal.total_quote_spent = new_state.total_quote
            deal.take_profit_price = new_state.take_profit_price
            deal.stop_loss_price = new_state.stop_loss_price
            deal.safety_orders_placed += 1
            deal.safety_orders_filled += 1

            so_order = Order(
                deal_id=deal.id,
                bot_id=bot.id,
                user_id=bot.user_id,
                type=f"safety_{state.next_so_index + 1}",
                side="BUY",
                order_type="MARKET",
                status="filled",
                safety_order_num=state.next_so_index + 1,
                quantity=so_fill["filled_quantity"],
                filled_quantity=so_fill["filled_quantity"],
                avg_fill_price=so_fill["avg_fill_price"],
                quote_qty=so_fill["quote_qty"],
                commission=so_fill.get("commission", Decimal("0")),
                is_paper=bot.is_paper,
                placed_at=now,
                filled_at=now,
            )
            db.add(so_order)

    # Emit update
    unrealized_pnl_pct = (
        (current_price - (deal.average_price or current_price)) / (deal.average_price or current_price) * 100
    )
    asyncio.create_task(ws_manager.emit_deal_updated(bot.id, {
        "deal_id": deal.id,
        "average_price": str(deal.average_price),
        "current_price": str(current_price),
        "take_profit_price": str(deal.take_profit_price),
        "safety_orders_filled": deal.safety_orders_filled,
        "unrealized_pnl_pct": str(round(unrealized_pnl_pct, 4)),
    }))
