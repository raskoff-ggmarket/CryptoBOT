from fastapi import APIRouter
from app.api.v1.endpoints import auth, users, exchange_keys, bots, deals, backtesting, dashboard, webhooks, market, indicators

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(exchange_keys.router)
api_router.include_router(bots.router)
api_router.include_router(deals.router)
api_router.include_router(backtesting.router)
api_router.include_router(dashboard.router)
api_router.include_router(webhooks.router)
api_router.include_router(market.router)
api_router.include_router(indicators.router)
