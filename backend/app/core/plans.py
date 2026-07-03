from fastapi import HTTPException

from app.core.config import settings

PLAN_FREE = "free"
PLAN_PRO = "pro"

# None = sınırsız
PLAN_LIMITS = {
    PLAN_FREE: {
        "max_bots": 1,
        "max_exchange_keys": 1,
        "backtesting": False,
        "webhooks": False,
    },
    PLAN_PRO: {
        "max_bots": None,
        "max_exchange_keys": None,
        "backtesting": True,
        "webhooks": True,
    },
}


def pro_emails() -> set[str]:
    return {e.strip().lower() for e in settings.PRO_EMAILS.split(",") if e.strip()}


def plan_for_email(email: str) -> str:
    return PLAN_PRO if email.lower() in pro_emails() else PLAN_FREE


def get_limits(plan: str) -> dict:
    return PLAN_LIMITS.get(plan, PLAN_LIMITS[PLAN_FREE])


def require_feature(user, feature: str) -> None:
    if not get_limits(user.plan).get(feature):
        raise HTTPException(status_code=403, detail="This feature requires the Pro plan")
