import secrets
import time
import hashlib
from fastapi import APIRouter, Depends, HTTPException, status, Request, Response
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from sqlalchemy.orm import joinedload
from app.database import get_db
from app.models import User, UserProfile, RefreshToken
from app.schemas import UserCreate, UserLogin, Token, UserResponse, ProfileUpdate, UserProfileResponse
from app.auth.auth import (
    get_password_hash, verify_password, create_access_token, 
    create_refresh_token, verify_refresh_token, get_current_user, 
    init_user_profile_and_twin, log_security_event
)
from app.config import settings
from app.services.cache import CacheService
import logging

logger = logging.getLogger("carboeco")
router = APIRouter(prefix="/auth", tags=["Authentication"])

login_failures_mem: dict[str, tuple[int, float]] = {}

async def is_account_locked(email: str) -> bool:
    now = time.time()
    redis_client = await CacheService.get_client()
    if redis_client:
        try:
            lockout = await redis_client.get(f"lockout:{email}")
            if lockout:
                return True
        except Exception as e:
            logger.warning(f"Redis lockout check failed: {e}")
    else:
        if email in login_failures_mem:
            count, lockout_until = login_failures_mem[email]
            if lockout_until and now < lockout_until:
                return True
    return False

async def record_login_failure(email: str):
    now = time.time()
    redis_client = await CacheService.get_client()
    if redis_client:
        try:
            fail_key = f"login_failures:{email}"
            lock_key = f"lockout:{email}"
            fails = await redis_client.incr(fail_key)
            if fails == 1:
                await redis_client.expire(fail_key, 900)  # 15 minutes window
            if fails >= 5:
                await redis_client.set(lock_key, "locked", ex=900)  # lock for 15 mins
                await redis_client.delete(fail_key)
        except Exception as e:
            logger.warning(f"Redis login failure recording failed: {e}")
    else:
        if email not in login_failures_mem:
            login_failures_mem[email] = (0, 0.0)
        count, lockout_until = login_failures_mem[email]
        count += 1
        if count >= 5:
            lockout_until = now + 900.0  # 15 mins lockout
        login_failures_mem[email] = (count, lockout_until)

async def reset_login_failures(email: str):
    redis_client = await CacheService.get_client()
    if redis_client:
        try:
            await redis_client.delete(f"login_failures:{email}")
            await redis_client.delete(f"lockout:{email}")
        except Exception as e:
            logger.warning(f"Redis login failure reset failed: {e}")
    else:
        login_failures_mem.pop(email, None)

@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(user_in: UserCreate, request: Request, db: AsyncSession = Depends(get_db)):
    # Check if user already exists
    stmt = select(User).where(User.email == user_in.email)
    res = await db.execute(stmt)
    existing_user = res.scalar_one_or_none()
    if existing_user:
        await log_security_event(
            db, 
            user_id=None, 
            event_type="registration_failed", 
            details=f"Attempted registration with existing email: {user_in.email}",
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent")
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email address already exists."
        )

    # Hash the password and create the user record
    hashed_password = get_password_hash(user_in.password)
    user = User(
        email=user_in.email,
        password_hash=hashed_password,
        role="user",
        is_active=True
    )
    db.add(user)
    try:
        await db.commit()
        await db.refresh(user)
    except Exception as e:
        await db.rollback()
        logger.error(f"User registration database error: {e}")
        raise HTTPException(status_code=500, detail="Database write failure during registration")

    # Initialize Profile & Digital Twin
    await init_user_profile_and_twin(db, user)

    await log_security_event(
        db,
        user_id=user.id,
        event_type="registration_success",
        details=f"User registered successfully: {user.email}",
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent")
    )

    stmt_full = select(User).options(joinedload(User.profile)).where(User.id == user.id)
    res_full = await db.execute(stmt_full)
    user_full = res_full.scalar_one()

    return user_full

@router.post("/login", response_model=Token)
async def login(
    response: Response, 
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(), 
    db: AsyncSession = Depends(get_db)
):
    if await is_account_locked(form_data.username):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is temporarily locked out due to multiple failed login attempts. Please try again after 15 minutes."
        )

    stmt = select(User).where(User.email == form_data.username)
    res = await db.execute(stmt)
    user = res.scalar_one_or_none()
    
    if not user or not verify_password(form_data.password, user.password_hash):
        await record_login_failure(form_data.username)
        await log_security_event(
            db,
            user_id=None,
            event_type="login_failed",
            details=f"Failed login attempt for username: {form_data.username}",
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent")
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_active:
        await log_security_event(
            db,
            user_id=user.id,
            event_type="login_blocked",
            details="Login blocked due to inactive account",
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent")
        )
        raise HTTPException(status_code=400, detail="Inactive user account")

    await reset_login_failures(form_data.username)

    access_token = create_access_token(data={"sub": user.email})
    refresh_token = await create_refresh_token(db, user.id)
    
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=settings.COOKIE_SECURE or settings.ENV.lower() == "production",
        samesite=settings.COOKIE_SAMESITE,
        max_age=7 * 24 * 60 * 60  # 7 days
    )
    
    await log_security_event(
        db,
        user_id=user.id,
        event_type="login_success",
        details="User logged in successfully",
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent")
    )
    
    # Reload user options to ensure profile relationship is available
    stmt_full = select(User).options(joinedload(User.profile)).where(User.id == user.id)
    res_full = await db.execute(stmt_full)
    user_full = res_full.scalar_one()

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user_full
    }

@router.post("/refresh")
async def refresh(request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    refresh_token = request.cookies.get("refresh_token")
    if not refresh_token:
        raise HTTPException(status_code=401, detail="Refresh token missing")
    
    user_id = await verify_refresh_token(db, refresh_token)
    if not user_id:
        await log_security_event(
            db,
            user_id=None,
            event_type="token_refresh_failed",
            details="Invalid or expired refresh token",
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent")
        )
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")
    
    stmt = select(User).where(User.id == user_id)
    res = await db.execute(stmt)
    user = res.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")
    
    access_token = create_access_token(data={"sub": user.email})
    new_refresh_token = await create_refresh_token(db, user.id)
    
    response.set_cookie(
        key="refresh_token",
        value=new_refresh_token,
        httponly=True,
        secure=settings.COOKIE_SECURE or settings.ENV.lower() == "production",
        samesite=settings.COOKIE_SAMESITE,
        max_age=7 * 24 * 60 * 60
    )
    
    await log_security_event(
        db,
        user_id=user.id,
        event_type="token_refresh_success",
        details="Access token rotated successfully via refresh token",
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent")
    )
    
    stmt_full = select(User).options(joinedload(User.profile)).where(User.id == user.id)
    res_full = await db.execute(stmt_full)
    user_full = res_full.scalar_one()

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user_full
    }

@router.post("/logout")
async def logout(request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    refresh_token = request.cookies.get("refresh_token")
    if refresh_token:
        # Hash the token before querying (tokens stored as SHA-256 hashes in DB)
        token_hash = hashlib.sha256(refresh_token.encode()).hexdigest()
        # Determine the user before deleting the token for logging
        stmt = select(RefreshToken).where(RefreshToken.token == token_hash)
        res = await db.execute(stmt)
        token_obj = res.scalar_one_or_none()
        if token_obj:
            await log_security_event(
                db,
                user_id=token_obj.user_id,
                event_type="logout",
                details="User logged out and revoked refresh token",
                ip_address=request.client.host if request.client else None,
                user_agent=request.headers.get("user-agent")
            )
        await db.execute(delete(RefreshToken).where(RefreshToken.token == token_hash))
        await db.commit()
    response.delete_cookie("refresh_token")
    return {"detail": "Logged out successfully"}

@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user

@router.put("/profile", response_model=UserProfileResponse)
async def update_profile(
    profile_in: ProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(UserProfile).where(UserProfile.user_id == current_user.id)
    res = await db.execute(stmt)
    profile = res.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    if profile_in.full_name is not None:
        profile.full_name = profile_in.full_name
    if profile_in.avatar is not None:
        profile.avatar = profile_in.avatar
    if profile_in.carbon_budget is not None:
        profile.carbon_budget = profile_in.carbon_budget

    try:
        await db.commit()
        await db.refresh(profile)
    except Exception as e:
        await db.rollback()
        logger.error(f"Profile update database error: {e}")
        raise HTTPException(status_code=500, detail="Database write failure during profile update")

    return profile

@router.post("/ws-ticket")
async def generate_ws_ticket(
    current_user: User = Depends(get_current_user)
):
    ticket = secrets.token_hex(32)
    await CacheService.set(f"ws_ticket:{ticket}", current_user.id, expire=30)
    return {"ticket": ticket}
