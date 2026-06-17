import asyncio
import logging
from decimal import Decimal
from datetime import datetime, timezone

from app.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(name="app.tasks.backtest_runner.run_backtest", bind=True)
def run_backtest(self, run_id: int):
    asyncio.run(_run_backtest_async(run_id))


async def _run_backtest_async(run_id: int):
    from app.core.database import AsyncSessionLocal
    from app.models.backtest_run import BacktestRun
    from app.models.backtest_result import BacktestResult
    from app.services.backtest_service import BacktestSimulator
    from app.services.binance_client import BinanceSpotClient
    from app.websocket.manager import ws_manager
    from sqlalchemy import select

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(BacktestRun).where(BacktestRun.id == run_id))
        run = result.scalar_one_or_none()
        if not run:
            return

        run.status = "running"
        await db.commit()

        try:
            # Use a public client (no API key needed for klines)
            client = BinanceSpotClient(api_key="", api_secret="")

            start_ts = int(datetime.combine(run.start_date, datetime.min.time()).timestamp() * 1000)
            end_ts = int(datetime.combine(run.end_date, datetime.max.time()).timestamp() * 1000)

            interval_map = {
                "1m": 60000, "5m": 300000, "15m": 900000, "30m": 1800000,
                "1h": 3600000, "4h": 14400000, "1d": 86400000,
            }
            interval_ms = interval_map.get(run.timeframe, 3600000)
            estimated_candles = min(5000, (end_ts - start_ts) // interval_ms)

            klines = await client.get_klines(run.pair, run.timeframe, int(estimated_candles))

            simulator = BacktestSimulator()

            async def progress_cb(pct, current_date, deals_count):
                async with AsyncSessionLocal() as inner_db:
                    r = await inner_db.get(BacktestRun, run_id)
                    if r:
                        r.progress_pct = Decimal(str(pct))
                        await inner_db.commit()
                await ws_manager.emit_backtest_progress(run.user_id, run_id, pct, current_date, deals_count)

            metrics = await simulator.run(klines, run.bot_config, run.initial_capital, progress_cb)

            async with AsyncSessionLocal() as db2:
                run2 = await db2.get(BacktestRun, run_id)
                run2.status = "completed"
                run2.progress_pct = Decimal("100")
                run2.completed_at = datetime.now(timezone.utc)

                bt_result = BacktestResult(
                    run_id=run_id,
                    **{k: v for k, v in metrics.items() if k not in ("equity_curve", "deals_detail")},
                    equity_curve=metrics["equity_curve"],
                    deals_detail=metrics["deals_detail"],
                )
                db2.add(bt_result)
                await db2.commit()

            await ws_manager.emit_backtest_completed(run.user_id, run_id, {
                "total_deals": metrics["total_deals"],
                "win_rate_pct": float(metrics["win_rate_pct"] or 0),
                "total_profit_pct": float(metrics["total_profit_pct"] or 0),
                "max_drawdown_pct": float(metrics["max_drawdown_pct"] or 0),
            })

        except Exception as e:
            logger.exception(f"Backtest {run_id} failed: {e}")
            async with AsyncSessionLocal() as db3:
                run3 = await db3.get(BacktestRun, run_id)
                if run3:
                    run3.status = "failed"
                    run3.error_message = str(e)
                    await db3.commit()
