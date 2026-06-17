from celery import Celery
from app.core.config import settings

celery_app = Celery(
    "cryptobot",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=[
        "app.tasks.bot_runner",
        "app.tasks.backtest_runner",
        "app.tasks.risk_checker",
        "app.tasks.order_sync",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Europe/Istanbul",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    task_routes={
        "app.tasks.bot_runner.*": {"queue": "bots"},
        "app.tasks.backtest_runner.*": {"queue": "backtests"},
        "app.tasks.risk_checker.*": {"queue": "risk"},
        "app.tasks.order_sync.*": {"queue": "default"},
    },
    beat_schedule={
        "bot-tick-every-5s": {
            "task": "app.tasks.bot_runner.run_all_active_bots",
            "schedule": 5.0,
            "options": {"queue": "bots"},
        },
        "order-sync-every-30s": {
            "task": "app.tasks.order_sync.sync_open_orders",
            "schedule": 30.0,
            "options": {"queue": "default"},
        },
        "risk-check-daily-reset": {
            "task": "app.tasks.risk_checker.reset_daily_risk",
            "schedule": 86400.0,
            "options": {"queue": "risk"},
        },
    },
)
