from datetime import datetime, timedelta, timezone
from typing import Optional, Union, Any
import secrets

from jose import JWTError, jwt
import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User, UserProfile, DigitalTwinState, RefreshToken
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
    # bcrypt requires bytes
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

def create_refresh_token(db: Session, user_id: int) -> str:
    token = secrets.token_hex(64)
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    db.query(RefreshToken).filter(RefreshToken.user_id == user_id).delete()
    db_token = RefreshToken(user_id=user_id, token=token, expires_at=expires_at)
    db.add(db_token)
    db.commit()
    return token

def verify_refresh_token(db: Session, token: str) -> Optional[int]:
    db_token = db.query(RefreshToken).filter(RefreshToken.token == token).first()
    if not db_token:
        return None
    # Support both naive and timezone-aware datetimes stored in DB
    expires = db_token.expires_at
    now = datetime.now(timezone.utc)
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if expires < now:
        db.delete(db_token)
        db.commit()
        return None
    return db_token.user_id

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
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

    user = db.query(User).filter(User.email == email).first()
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

def init_user_profile_and_twin(db: Session, user: User) -> UserProfile:
    # Initialize profile
    profile = UserProfile(
        user_id=user.id,
        full_name=user.email.split("@")[0].capitalize(),
        avatar="avatar_1.png",
        xp=0,
        level=1,
        streak_count=0,
        last_active_date=None,
        carbon_budget=15.0
    )
    db.add(profile)
    
    # Initialize Digital Twin
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
        db.commit()
        db.refresh(profile)
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to initialize profile and twin for user {user.id}: {e}")
        raise HTTPException(status_code=500, detail="Database profile initialization failed")
        
    return profile
