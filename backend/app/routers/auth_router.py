import secrets
import time
from fastapi import APIRouter, Depends, HTTPException, status, Request, Response
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User, UserProfile, RefreshToken
from app.schemas import UserCreate, UserLogin, Token, UserResponse, ProfileUpdate, UserProfileResponse
from app.auth.auth import (
    get_password_hash, verify_password, create_access_token, 
    create_refresh_token, verify_refresh_token, get_current_user, init_user_profile_and_twin
)
from app.config import settings
import logging

logger = logging.getLogger("carboeco")
router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(user_in: UserCreate, db: Session = Depends(get_db)):
    # Check if user already exists
    existing_user = db.query(User).filter(User.email == user_in.email).first()
    if existing_user:
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
        db.commit()
        db.refresh(user)
    except Exception as e:
        db.rollback()
        logger.error(f"User registration database error: {e}")
        raise HTTPException(status_code=500, detail="Database write failure during registration")

    # Initialize Profile & Digital Twin
    init_user_profile_and_twin(db, user)

    return user

@router.post("/login", response_model=Token)
def login(response: Response, form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user account")

    access_token = create_access_token(data={"sub": user.email})
    refresh_token = create_refresh_token(db, user.id)
    
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=settings.COOKIE_SECURE or settings.ENV.lower() == "production",
        samesite=settings.COOKIE_SAMESITE,
        max_age=7 * 24 * 60 * 60  # 7 days
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user
    }

@router.post("/refresh")
def refresh(request: Request, response: Response, db: Session = Depends(get_db)):
    refresh_token = request.cookies.get("refresh_token")
    if not refresh_token:
        raise HTTPException(status_code=401, detail="Refresh token missing")
    
    user_id = verify_refresh_token(db, refresh_token)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")
    
    access_token = create_access_token(data={"sub": user.email})
    new_refresh_token = create_refresh_token(db, user.id)
    
    response.set_cookie(
        key="refresh_token",
        value=new_refresh_token,
        httponly=True,
        secure=settings.COOKIE_SECURE or settings.ENV.lower() == "production",
        samesite=settings.COOKIE_SAMESITE,
        max_age=7 * 24 * 60 * 60
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user
    }

@router.post("/logout")
def logout(request: Request, response: Response, db: Session = Depends(get_db)):
    refresh_token = request.cookies.get("refresh_token")
    if refresh_token:
        db.query(RefreshToken).filter(RefreshToken.token == refresh_token).delete()
        db.commit()
    response.delete_cookie("refresh_token")
    return {"detail": "Logged out successfully"}

@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user

@router.put("/profile", response_model=UserProfileResponse)
def update_profile(
    profile_in: ProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    profile = db.query(UserProfile).filter(UserProfile.user_id == current_user.id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    if profile_in.full_name is not None:
        profile.full_name = profile_in.full_name
    if profile_in.avatar is not None:
        profile.avatar = profile_in.avatar
    if profile_in.carbon_budget is not None:
        profile.carbon_budget = profile_in.carbon_budget

    try:
        db.commit()
        db.refresh(profile)
    except Exception as e:
        db.rollback()
        logger.error(f"Profile update database error: {e}")
        raise HTTPException(status_code=500, detail="Database write failure during profile update")

    return profile

@router.post("/ws-ticket")
def generate_ws_ticket(
    current_user: User = Depends(get_current_user)
):
    from app.routers.websocket_router import ws_tickets
    ticket = secrets.token_hex(32)
    # Ticket valid for 30 seconds
    ws_tickets[ticket] = (current_user.id, time.time() + 30.0)
    return {"ticket": ticket}
