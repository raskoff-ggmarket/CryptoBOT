from datetime import datetime, timedelta, timezone
from typing import Optional, Any
from jose import JWTError, jwt
from passlib.context import CryptContext
from cryptography.fernet import Fernet
from app.core.config import settings
import base64
import hashlib
import os

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def _prepare_password(password: str) -> str:
    # bcrypt truncates at 72 bytes; pre-hash with SHA-256 to handle any length safely
    return base64.b64encode(hashlib.sha256(password.encode()).digest()).decode()


def get_fernet() -> Fernet:
    key = settings.ENCRYPTION_KEY
    if not key:
        # Generate and warn - in production this must be set
        key = base64.urlsafe_b64encode(os.urandom(32)).decode()
    if len(base64.urlsafe_b64decode(key + "==")) != 32:
        key = base64.urlsafe_b64encode(base64.urlsafe_b64decode(key + "==")[:32]).decode()
    return Fernet(key)


def encrypt_api_key(api_key: str) -> str:
    f = get_fernet()
    return f.encrypt(api_key.encode()).decode()


def decrypt_api_key(encrypted_key: str) -> str:
    f = get_fernet()
    return f.decrypt(encrypted_key.encode()).decode()


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(_prepare_password(plain_password), hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(_prepare_password(password))


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_refresh_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError:
        return None


def generate_webhook_secret() -> str:
    return base64.urlsafe_b64encode(os.urandom(24)).decode()
