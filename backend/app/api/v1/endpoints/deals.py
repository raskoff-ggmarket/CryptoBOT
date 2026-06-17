from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.models.deal import Deal
from app.models.order import Order
from app.models.bot import Bot
from app.schemas.deal import DealRead, OrderRead, DealCloseRequest
from app.schemas.common import success_response, paginated_response
from decimal import Decimal
from datetime import datetime, timezone

router = APIRouter(prefix="/deals", tags=["Deals"])


@router.get("")
async def list_deals(
    bot_id: int = Query(None),
    status: str = Query(None),
    pair: str = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(Deal).where(Deal.user_id == current_user.id)
    if bot_id:
        q = q.where(Deal.bot_id == bot_id)
    if status:
        q = q.where(Deal.status == status)
    if pair:
        q = q.where(Deal.pair == pair.upper())

    total_result = await db.execute(select(func.count()).select_from(q.subquery()))
    total = total_result.scalar()

    q = q.order_by(Deal.opened_at.desc()).offset((page - 1) * page_size).limit(page_size)
    q = q.options(selectinload(Deal.orders))
    result = await db.execute(q)
    deals = result.scalars().all()

    data = []
    for deal in deals:
        d = DealRead.model_validate(deal).model_dump()
        if deal.current_price and deal.average_price and deal.status == "active":
            d["unrealized_pnl_pct"] = float(
                (deal.current_price - deal.average_price) / deal.average_price * 100
            )
        if deal.opened_at and deal.closed_at:
            d["duration_minutes"] = int((deal.closed_at - deal.opened_at).total_seconds() / 60)
        data.append(d)

    return paginated_response(data, total, page, page_size)


@router.get("/{deal_id}")
async def get_deal(
    deal_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Deal).where(Deal.id == deal_id, Deal.user_id == current_user.id)
        .options(selectinload(Deal.orders))
    )
    deal = result.scalar_one_or_none()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")

    d = DealRead.model_validate(deal).model_dump()
    if deal.current_price and deal.average_price and deal.status == "active":
        d["unrealized_pnl_pct"] = float(
            (deal.current_price - deal.average_price) / deal.average_price * 100
        )
    return success_response(d)


@router.post("/{deal_id}/close")
async def close_deal(
    deal_id: int,
    data: DealCloseRequest = DealCloseRequest(),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Deal).where(Deal.id == deal_id, Deal.user_id == current_user.id)
    )
    deal = result.scalar_one_or_none()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    if deal.status != "active":
        raise HTTPException(status_code=400, detail="Deal is not active")

    deal.status = "completed"
    deal.closed_at = datetime.now(timezone.utc)
    deal.realized_pnl = Decimal("0")
    await db.commit()
    return success_response({"status": "completed", "reason": data.reason})


@router.post("/{deal_id}/cancel")
async def cancel_deal(
    deal_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Deal).where(Deal.id == deal_id, Deal.user_id == current_user.id)
    )
    deal = result.scalar_one_or_none()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")

    deal.status = "cancelled"
    deal.closed_at = datetime.now(timezone.utc)

    # Cancel open orders
    open_orders = await db.execute(
        select(Order).where(Order.deal_id == deal_id, Order.status.in_(["open", "pending"]))
    )
    for order in open_orders.scalars():
        order.status = "cancelled"

    await db.commit()
    return success_response({"status": "cancelled"})
