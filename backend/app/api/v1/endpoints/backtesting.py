from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.models.bot import Bot
from app.models.backtest_run import BacktestRun
from app.models.backtest_result import BacktestResult
from app.schemas.backtest import BacktestCreate, BacktestRunRead, BacktestResultRead
from app.schemas.common import success_response, paginated_response

router = APIRouter(prefix="/backtesting", tags=["Backtesting"])


@router.post("/runs")
async def create_run(
    data: BacktestCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    bot_config = data.bot_config or {}

    if data.bot_id:
        result = await db.execute(
            select(Bot).where(Bot.id == data.bot_id, Bot.user_id == current_user.id)
        )
        bot = result.scalar_one_or_none()
        if not bot:
            raise HTTPException(status_code=404, detail="Bot not found")
        bot_config = {
            "base_order_size": str(bot.base_order_size),
            "safety_order_size": str(bot.safety_order_size),
            "safety_order_step_pct": str(bot.safety_order_step_pct),
            "safety_order_volume_scale": str(bot.safety_order_volume_scale),
            "safety_order_step_scale": str(bot.safety_order_step_scale),
            "max_safety_orders": bot.max_safety_orders,
            "take_profit_pct": str(bot.take_profit_pct),
            "take_profit_type": bot.take_profit_type,
            "trailing_deviation_pct": str(bot.trailing_deviation_pct),
            "stop_loss_enabled": bot.stop_loss_enabled,
            "stop_loss_type": bot.stop_loss_type,
            "stop_loss_pct": str(bot.stop_loss_pct) if bot.stop_loss_pct else None,
            "stop_loss_trailing_pct": str(bot.stop_loss_trailing_pct) if bot.stop_loss_trailing_pct else None,
            "reinvest_pct": str(bot.reinvest_pct),
        }

    if not bot_config:
        raise HTTPException(status_code=400, detail="Either bot_id or bot_config must be provided")

    run = BacktestRun(
        user_id=current_user.id,
        bot_config=bot_config,
        pair=data.pair.upper(),
        timeframe=data.timeframe,
        start_date=data.start_date,
        end_date=data.end_date,
        initial_capital=data.initial_capital,
        status="pending",
    )
    db.add(run)
    await db.commit()

    # Enqueue Celery task
    from app.tasks.backtest_runner import run_backtest
    run_backtest.delay(run.id)

    return success_response(BacktestRunRead.model_validate(run).model_dump())


@router.get("/runs")
async def list_runs(
    status: str = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(BacktestRun).where(BacktestRun.user_id == current_user.id)
    if status:
        q = q.where(BacktestRun.status == status)

    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar()
    q = q.order_by(BacktestRun.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    runs = (await db.execute(q)).scalars().all()

    return paginated_response(
        [BacktestRunRead.model_validate(r).model_dump() for r in runs],
        total, page, page_size
    )


@router.get("/runs/{run_id}")
async def get_run(
    run_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    run = await _get_user_run(db, run_id, current_user.id)
    return success_response(BacktestRunRead.model_validate(run).model_dump())


@router.get("/runs/{run_id}/results")
async def get_results(
    run_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _get_user_run(db, run_id, current_user.id)
    result = await db.execute(
        select(BacktestResult).where(BacktestResult.run_id == run_id)
    )
    bt_result = result.scalar_one_or_none()
    if not bt_result:
        raise HTTPException(status_code=404, detail="Results not available yet")
    return success_response(BacktestResultRead.model_validate(bt_result).model_dump())


@router.delete("/runs/{run_id}")
async def delete_run(
    run_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    run = await _get_user_run(db, run_id, current_user.id)
    await db.delete(run)
    await db.commit()
    return success_response(message="Backtest run deleted")


async def _get_user_run(db: AsyncSession, run_id: int, user_id: int) -> BacktestRun:
    result = await db.execute(
        select(BacktestRun).where(BacktestRun.id == run_id, BacktestRun.user_id == user_id)
    )
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Backtest run not found")
    return run
