from sqlalchemy import String, Boolean, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from app.core.database import Base
from datetime import datetime


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    username: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    plan: Mapped[str] = mapped_column(String(20), default="free", server_default="free")
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    language: Mapped[str] = mapped_column(String(5), default="tr")
    timezone: Mapped[str] = mapped_column(String(50), default="Europe/Istanbul")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    exchange_keys: Mapped[list["ExchangeKey"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    bots: Mapped[list["Bot"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    deals: Mapped[list["Deal"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    risk_profile: Mapped["RiskProfile"] = relationship(back_populates="user", uselist=False, cascade="all, delete-orphan")
    audit_logs: Mapped[list["AuditLog"]] = relationship(back_populates="user", cascade="all, delete-orphan")
