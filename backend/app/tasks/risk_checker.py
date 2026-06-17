import asyncio
from app.tasks.celery_app import celery_app


@celery_app.task(name="app.tasks.risk_checker.reset_daily_risk")
def reset_daily_risk():
    asyncio.run(_reset_async())


async def _reset_async():
    from app.core.database import AsyncSessionLocal
    from app.models.daily_risk_snapshot import DailyRiskSnapshot
    from app.models.user import User
    from sqlalchemy import select
    from datetime import date, datetime, timezone
    from decimal import Decimal

    today = date.today()
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.is_active == True))
        users = result.scalars().all()

        for user in users:
            existing = await db.execute(
                select(DailyRiskSnapshot).where(
                    DailyRiskSnapshot.user_id == user.id,
                    DailyRiskSnapshot.date == today
                )
            )
            if not existing.scalar_one_or_none():
                snapshot = DailyRiskSnapshot(
                    user_id=user.id,
                    date=today,
                    starting_equity=Decimal("0"),
                    realized_loss=Decimal("0"),
                    deals_opened=0,
                    risk_triggered=False,
                )
                db.add(snapshot)

        await db.commit()
