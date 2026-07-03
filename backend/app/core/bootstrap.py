import logging

from sqlalchemy import select

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.core.plans import plan_for_email
from app.core.security import get_password_hash
from app.models.user import User
from app.models.risk_profile import RiskProfile

logger = logging.getLogger(__name__)


async def seed_initial_user() -> None:
    """INITIAL_USER_* env değişkenleri doluysa ilk açılışta hesabı oluşturur."""
    email = (settings.INITIAL_USER_EMAIL or "").strip().lower()
    password = settings.INITIAL_USER_PASSWORD
    if not email or not password:
        return

    username = (settings.INITIAL_USER_USERNAME or email.split("@")[0]).strip()

    async with AsyncSessionLocal() as db:
        existing = await db.execute(
            select(User).where((User.email == email) | (User.username == username))
        )
        if existing.scalar_one_or_none():
            return

        user = User(
            email=email,
            username=username,
            hashed_password=get_password_hash(password),
            plan=plan_for_email(email),
        )
        db.add(user)
        await db.flush()
        db.add(RiskProfile(user_id=user.id))
        await db.commit()
        logger.info(f"Initial user created: {email} (plan={user.plan})")
