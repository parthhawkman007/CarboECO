from datetime import datetime, timedelta, timezone
from typing import Optional, Union, Any
import secrets
import hashlib

import jwt
from jwt import PyJWTError as JWTError
import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from sqlalchemy.orm import joinedload
from app.database import get_db
from app.models import User, UserProfile, DigitalTwinState, RefreshToken, AuditLog
from app.config import settings
import logging

logger = logging.getLogger("carboeco")

# JWT configuration
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(
            plain_password.encode('utf-8'),
            hashed_password.encode('utf-8')
        )
    except Exception as e:
        logger.error(f"Password verification error: {e}")
        return False

def get_password_hash(password: str) -> str:
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed.decode('utf-8')

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

async def log_security_event(db: AsyncSession, user_id: Optional[int], event_type: str, details: str, ip_address: Optional[str] = None, user_agent: Optional[str] = None):
    try:
        audit = AuditLog(
            user_id=user_id,
            event_type=event_type,
            details=details,
            ip_address=ip_address,
            user_agent=user_agent
        )
        db.add(audit)
        await db.commit()
    except Exception as e:
        logger.error(f"Failed to log security event: {e}")

async def create_refresh_token(db: AsyncSession, user_id: int) -> str:
    token = secrets.token_hex(64)
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    
    # Refresh Token Rotation (RTR): Prune any existing tokens for this user
    await db.execute(delete(RefreshToken).where(RefreshToken.user_id == user_id))
    
    db_token = RefreshToken(user_id=user_id, token=token_hash, expires_at=expires_at)
    db.add(db_token)
    await db.commit()
    return token

async def verify_refresh_token(db: AsyncSession, token: str) -> Optional[int]:
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    stmt = select(RefreshToken).where(RefreshToken.token == token_hash)
    res = await db.execute(stmt)
    db_token = res.scalar_one_or_none()
    if not db_token:
        return None
        
    expires = db_token.expires_at
    now = datetime.now(timezone.utc)
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
        
    if expires < now:
        await db.delete(db_token)
        await db.commit()
        return None
        
    return db_token.user_id

async def get_current_user(token: str = Depends(oauth2_scheme), db: AsyncSession = Depends(get_db)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    # Eager load the user's profile to prevent lazy-loading errors in async session lifecycle
    stmt = select(User).options(joinedload(User.profile)).where(User.email == email)
    res = await db.execute(stmt)
    user = res.scalar_one_or_none()
    
    if user is None:
        raise credentials_exception
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return user

def check_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have administrative privileges to perform this action."
        )
    return user

async def init_user_profile_and_twin(db: AsyncSession, user: User) -> UserProfile:
    profile = UserProfile(
        user_id=user.id,
        full_name=user.email.split("@")[0].capitalize(),
        avatar="default_avatar.png",
        xp=0,
        level=1,
        streak_count=0,
        last_active_date=None,
        carbon_budget=15.0,
        region="US"
    )
    db.add(profile)
    
    twin = DigitalTwinState(
        user_id=user.id,
        tree_growth_stage=1,
        energy_efficiency_score=50.0,
        current_avatar_state_json={
            "health": 100,
            "theme": "emerald",
            "leaves_color": "#10B981",
            "accessories": [],
            "last_watered_date": datetime.now(timezone.utc).strftime("%Y-%m-%d")
        }
    )
    db.add(twin)
    
    try:
        await db.commit()
        await db.refresh(profile)
    except Exception as e:
        await db.rollback()
        logger.error(f"Failed to initialize profile and twin for user {user.id}: {e}")
        raise HTTPException(status_code=500, detail="Database profile initialization failed")
        
    return profile
