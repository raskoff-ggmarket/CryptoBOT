from pydantic_settings import BaseSettings
from pydantic import Field
from typing import Optional
from functools import lru_cache


class Settings(BaseSettings):
    APP_NAME: str = "CryptoBOT"
    APP_VERSION: str = "1.0.0"
    ENVIRONMENT: str = "development"
    DEBUG: bool = False

    # Database
    DATABASE_URL: str = Field(
        default="postgresql+asyncpg://cryptobot:cryptobot123@localhost:5432/cryptobot"
    )
    DATABASE_POOL_SIZE: int = 20
    DATABASE_MAX_OVERFLOW: int = 40

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # Security
    SECRET_KEY: str = Field(default="changeme-in-production-supersecret-key-256bit")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # Encryption key for API keys (Fernet)
    ENCRYPTION_KEY: Optional[str] = None

    # CORS
    BACKEND_CORS_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:80",
    ]

    # Binance
    BINANCE_TESTNET: bool = False
    BINANCE_TESTNET_API_URL: str = "https://testnet.binance.vision"
    BINANCE_TESTNET_STREAM_URL: str = "wss://testnet.binance.vision"

    # Rate limits
    RATE_LIMIT_PER_MINUTE: int = 60
    BINANCE_REQUEST_WEIGHT_LIMIT: int = 1200

    # WebSocket
    WS_HEARTBEAT_INTERVAL: int = 30
    WS_MAX_CONNECTIONS: int = 1000

    # Plans: bu e-postalar ücretsiz Pro alır (virgülle ayrılmış)
    PRO_EMAILS: str = "raskoff.invest@gmail.com"

    # Bot settings
    MAX_BOTS_PER_USER: int = 20
    BOT_CHECK_INTERVAL_SECONDS: int = 5
    MAX_SAFETY_ORDERS: int = 25

    # Backtest
    BACKTEST_MAX_CANDLES: int = 5000

    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
