from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.models.deal import Deal
from app.models.bot import Bot
from app.models.daily_risk_snapshot import DailyRiskSnapshot
from app.models.risk_profile import RiskProfile
from app.schemas.dashboard import DashboardSummary, BotPerformance, RiskStatus
from app.schemas.common import success_response
from decimal import Decimal
from datetime import date

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/summary")
async def get_summary(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Bots
    bots_result = await db.execute(
        select(Bot.status, func.count(Bot.id)).where(Bot.user_id == current_user.id).group_by(Bot.status)
    )
    bot_counts = dict(bots_result.all())

    # Active deals
    active_deals = (await db.execute(
        select(func.count(Deal.id)).where(Deal.user_id == current_user.id, Deal.status == "active")
    )).scalar() or 0

    # Today's completed deals and PnL
    today = date.today()
    today_deals = (await db.execute(
        select(Deal).where(
            Deal.user_id == current_user.id,
            Deal.status == "completed",
            func.date(Deal.closed_at) == today,
        )
    )).scalars().all()

    daily_pnl = sum(d.realized_pnl or Decimal("0") for d in today_deals)

    # Total PnL
    all_completed = (await db.execute(
        select(Deal).where(Deal.user_id == current_user.id, Deal.status == "completed")
    )).scalars().all()

    total_profit = sum(d.realized_pnl or Decimal("0") for d in all_completed)
    winning = sum(1 for d in all_completed if d.realized_pnl and d.realized_pnl > 0)
    total = len(all_completed)
    win_rate = Decimal(str(round(winning / total * 100, 2))) if total else None

    return success_response(DashboardSummary(
        total_equity=Decimal("0"),
        used_capital=Decimal("0"),
        available_capital=Decimal("0"),
        daily_pnl=daily_pnl,
        daily_pnl_pct=Decimal("0"),
        total_profit=total_profit,
        active_bots=bot_counts.get("active", 0),
        inactive_bots=bot_counts.get("inactive", 0),
        active_deals=active_deals,
        completed_deals_today=len(today_deals),
        win_rate_pct=win_rate,
        avg_deal_duration_hours=None,
    ).model_dump())


@router.get("/performance")
async def get_performance(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    bots_result = await db.execute(
        select(Bot).where(Bot.user_id == current_user.id)
    )
    bots = bots_result.scalars().all()

    performance = []
    for bot in bots:
        deals = (await db.execute(
            select(Deal).where(Deal.bot_id == bot.id, Deal.status == "completed")
        )).scalars().all()

        active = (await db.execute(
            select(func.count(Deal.id)).where(Deal.bot_id == bot.id, Deal.status == "active")
        )).scalar() or 0

        total = len(deals)
        winning = sum(1 for d in deals if d.realized_pnl and d.realized_pnl > 0)
        total_profit = sum(d.realized_pnl or Decimal("0") for d in deals)
        win_rate = Decimal(str(round(winning / total * 100, 2))) if total else None

        performance.append(BotPerformance(
            bot_id=bot.id,
            bot_name=bot.name,
            pair=bot.pair,
            status=bot.status,
            total_deals=total,
            win_rate_pct=win_rate,
            total_profit=total_profit,
            active_deals=active,
        ).model_dump())

    return success_response(performance)


@router.get("/recent-trades")
async def get_recent_trades(
    limit: int = Query(10, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Deal).where(
            Deal.user_id == current_user.id,
            Deal.status == "completed"
        ).order_by(Deal.closed_at.desc()).limit(limit)
    )
    deals = result.scalars().all()
    return success_response([{
        "id": d.id,
        "bot_id": d.bot_id,
        "pair": d.pair,
        "realized_pnl": str(d.realized_pnl or 0),
        "realized_pnl_pct": str(d.realized_pnl_pct or 0),
        "opened_at": d.opened_at.isoformat() if d.opened_at else None,
        "closed_at": d.closed_at.isoformat() if d.closed_at else None,
        "safety_orders_filled": d.safety_orders_filled,
    } for d in deals])


@router.get("/risk-status")
async def get_risk_status(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    profile_result = await db.execute(
        select(RiskProfile).where(RiskProfile.user_id == current_user.id)
    )
    profile = profile_result.scalar_one_or_none()

    today_snapshot = (await db.execute(
        select(DailyRiskSnapshot).where(
            DailyRiskSnapshot.user_id == current_user.id,
            DailyRiskSnapshot.date == date.today()
        )
    )).scalar_one_or_none()

    active_deals = (await db.execute(
        select(func.count(Deal.id)).where(Deal.user_id == current_user.id, Deal.status == "active")
    )).scalar() or 0

    daily_loss = today_snapshot.realized_loss if today_snapshot else Decimal("0")
    starting_equity = today_snapshot.starting_equity if today_snapshot else Decimal("1000")
    daily_loss_pct = (
        daily_loss / starting_equity * 100 if starting_equity > 0 else Decimal("0")
    )

    max_daily_loss = profile.max_daily_loss_pct if profile else Decimal("5")
    max_open_deals = profile.max_open_deals if profile else 10
    max_capital_pct = profile.max_capital_pct if profile else Decimal("80")

    return success_response(RiskStatus(
        daily_loss_used_pct=abs(daily_loss_pct),
        daily_loss_limit_pct=max_daily_loss,
        open_deals=active_deals,
        max_open_deals=max_open_deals,
        capital_used_pct=Decimal("0"),
        max_capital_pct=max_capital_pct,
        risk_triggered=today_snapshot.risk_triggered if today_snapshot else False,
    ).model_dump())
