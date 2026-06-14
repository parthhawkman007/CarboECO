from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator
from typing import List, Optional, Dict, Any
from datetime import datetime

# Auth & User
class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128, description="Password must be at least 8 characters")

    model_config = ConfigDict(extra="forbid")

class UserLogin(BaseModel):
    email: EmailStr
    password: str

    model_config = ConfigDict(extra="forbid")

class UserProfileResponse(BaseModel):
    id: int
    user_id: int
    full_name: Optional[str] = None
    avatar: str
    xp: int
    level: int
    streak_count: int
    last_active_date: Optional[str] = None
    carbon_budget: float

    model_config = ConfigDict(from_attributes=True)

class UserResponse(BaseModel):
    id: int
    email: EmailStr
    role: str
    is_active: bool
    created_at: datetime
    profile: Optional[UserProfileResponse] = None

    model_config = ConfigDict(from_attributes=True)

class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse

class ProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    avatar: Optional[str] = None
    carbon_budget: Optional[float] = Field(None, gt=0)

    model_config = ConfigDict(extra="forbid")

# Carbon Logs
class CarbonLogCreate(BaseModel):
    date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$", description="Date in YYYY-MM-DD format")
    category: str = Field(..., description="transportation, energy, food, waste, shopping, digital")
    subcategory: str = Field(..., min_length=1, max_length=100)
    value: float = Field(..., gt=0, description="Numeric value of consumption")
    unit: str = Field(..., min_length=1, max_length=50)
    metadata_json: Optional[Dict[str, Any]] = None

    model_config = ConfigDict(extra="forbid")

    @field_validator('category')
    @classmethod
    def validate_category(cls, v: str) -> str:
        valid = {"transportation", "energy", "food", "waste", "shopping", "digital"}
        if v.lower() not in valid:
            raise ValueError(f"Category must be one of {valid}")
        return v.lower()

    @field_validator("date")
    @classmethod
    def validate_calendar_date(cls, v: str) -> str:
        try:
            datetime.strptime(v, "%Y-%m-%d")
        except ValueError as exc:
            raise ValueError("Date must be a valid calendar date in YYYY-MM-DD format") from exc
        return v

    @field_validator("subcategory", "unit")
    @classmethod
    def normalize_required_text(cls, v: str) -> str:
        normalized = v.strip()
        if not normalized:
            raise ValueError("Value cannot be blank")
        return normalized

class CarbonLogResponse(BaseModel):
    id: int
    user_id: int
    date: str
    category: str
    subcategory: str
    value: float
    unit: str
    co2_equivalent: float
    explanation: Optional[str] = None
    metadata_json: Optional[Dict[str, Any]] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

# Carbon Summary Dashboards
class CategorySummary(BaseModel):
    category: str
    co2_equivalent: float
    percentage: float
    logs_count: int

class CarbonSummary(BaseModel):
    daily_co2: float
    weekly_co2: float
    monthly_co2: float
    annual_co2: float
    daily_budget: float
    efficiency_rating: str  # e.g., A+, B, C, F
    category_breakdown: List[CategorySummary]

# AI Recommendations
class AIRecommendationResponse(BaseModel):
    id: int
    user_id: int
    title: str
    description: str
    impact_score: float
    category: str
    explanation: str
    status: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

# Achievements
class AchievementResponse(BaseModel):
    id: int
    name: str
    description: str
    xp_reward: int
    badge_code: str
    icon_url: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class UserAchievementResponse(BaseModel):
    id: int
    user_id: int
    achievement: AchievementResponse
    unlocked_at: datetime

    model_config = ConfigDict(from_attributes=True)

# Gamification Profile
class LeaderboardUser(BaseModel):
    user_id: int
    full_name: Optional[str] = None
    xp: int
    level: int
    streak_count: int
    avatar: str
    rank: int

class LeaderboardResponse(BaseModel):
    leaderboard: List[LeaderboardUser]
    user_rank: Optional[int] = None

# Education
class LearningLessonResponse(BaseModel):
    id: int
    path_id: int
    title: str
    content: str
    quiz_question: Optional[str] = None
    quiz_options: Optional[List[str]] = None
    xp_reward: int

    model_config = ConfigDict(from_attributes=True)

class LearningPathResponse(BaseModel):
    id: int
    title: str
    description: str
    difficulty: str
    estimated_minutes: int
    xp_reward: int
    lessons: List[LearningLessonResponse] = []

    model_config = ConfigDict(from_attributes=True)

class QuizSubmit(BaseModel):
    answer: str

    model_config = ConfigDict(extra="forbid")

class QuizResponse(BaseModel):
    correct: bool
    correct_answer: Optional[str] = None
    xp_earned: int
    explanation: str

# Simulation
class SimulationRunCreate(BaseModel):
    name: str
    inputs_json: Dict[str, Any]

    model_config = ConfigDict(extra="forbid")

class SimulationRunResponse(BaseModel):
    id: int
    user_id: int
    name: str
    inputs_json: Dict[str, Any]
    co2_saved: float
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

# Offset Marketplace
class OffsetProjectResponse(BaseModel):
    id: int
    name: str
    description: str
    cost_per_ton: float
    co2_offset: float
    image_url: Optional[str] = None
    verified_by: str

    model_config = ConfigDict(from_attributes=True)

class OffsetPurchaseRequest(BaseModel):
    project_id: int
    amount_bought: float = Field(..., gt=0, description="Amount in USD to purchase")

    model_config = ConfigDict(extra="forbid")

class OffsetPurchaseResponse(BaseModel):
    id: int
    project: OffsetProjectResponse
    amount_bought: float
    cost_paid: float
    co2_offsetted: float
    purchased_at: datetime

    model_config = ConfigDict(from_attributes=True)

# Digital Twin
class DigitalTwinResponse(BaseModel):
    id: int
    user_id: int
    tree_growth_stage: int
    energy_efficiency_score: float
    current_avatar_state_json: Dict[str, Any]
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

# Groups & Community
class EcoGroupCreate(BaseModel):
    name: str = Field(..., min_length=3, max_length=100)
    description: str = Field(..., min_length=10)

    model_config = ConfigDict(extra="forbid")

class EcoGroupResponse(BaseModel):
    id: int
    name: str
    description: str
    created_by: Optional[int] = None
    members_count: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class GroupMemberResponse(BaseModel):
    id: int
    group_id: int
    user_id: int
    joined_at: datetime
    user: Optional[UserResponse] = None

    model_config = ConfigDict(from_attributes=True)
