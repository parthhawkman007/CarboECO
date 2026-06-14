from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text, JSON, Table, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base

# Association table for Group Members
class GroupMember(Base):
    __tablename__ = "group_members"
    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, ForeignKey("eco_groups.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    joined_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="group_memberships")
    group = relationship("EcoGroup", back_populates="members")

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(50), default="user", nullable=False)  # user, admin
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    profile = relationship("UserProfile", back_populates="user", uselist=False, cascade="all, delete-orphan")
    carbon_logs = relationship("CarbonLog", back_populates="user", cascade="all, delete-orphan")
    ai_recommendations = relationship("AIRecommendation", back_populates="user", cascade="all, delete-orphan")
    achievements = relationship("UserAchievement", back_populates="user", cascade="all, delete-orphan")
    simulations = relationship("SimulationRun", back_populates="user", cascade="all, delete-orphan")
    offsets = relationship("UserOffset", back_populates="user", cascade="all, delete-orphan")
    digital_twin = relationship("DigitalTwinState", back_populates="user", uselist=False, cascade="all, delete-orphan")
    group_memberships = relationship("GroupMember", back_populates="user", cascade="all, delete-orphan")

class UserProfile(Base):
    __tablename__ = "user_profiles"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    full_name = Column(String(255), nullable=True)
    avatar = Column(String(255), default="default_avatar.png")
    xp = Column(Integer, default=0, nullable=False)
    level = Column(Integer, default=1, nullable=False)
    streak_count = Column(Integer, default=0, nullable=False)
    last_active_date = Column(String(50), nullable=True)  # YYYY-MM-DD
    carbon_budget = Column(Float, default=15.0, nullable=False)  # target kg CO2e per day

    user = relationship("User", back_populates="profile")

class CarbonLog(Base):
    __tablename__ = "carbon_logs"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    date = Column(String(50), nullable=False, index=True)  # YYYY-MM-DD
    category = Column(String(100), nullable=False, index=True)  # transportation, energy, food, waste, shopping, digital
    subcategory = Column(String(100), nullable=False)
    value = Column(Float, nullable=False)  # e.g., km driven, kWh consumed, kg beef
    unit = Column(String(50), nullable=False)  # km, kWh, kg, USD, hours
    co2_equivalent = Column(Float, nullable=False)  # kg CO2e
    explanation = Column(Text, nullable=True)  # Explainable AI/Calculation explanation
    metadata_json = Column(JSON, nullable=True)  # additional details
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="carbon_logs")

    __table_args__ = (
        Index("idx_user_date_category", "user_id", "date", "category"),
    )

class AIRecommendation(Base):
    __tablename__ = "ai_recommendations"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    impact_score = Column(Float, nullable=False)  # Potential CO2e reduction in kg
    category = Column(String(100), nullable=False)
    explanation = Column(Text, nullable=False)  # Explainable AI logic
    status = Column(String(50), default="active", nullable=False)  # active, completed, skipped
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="ai_recommendations")

class Achievement(Base):
    __tablename__ = "achievements"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, unique=True)
    description = Column(Text, nullable=False)
    xp_reward = Column(Integer, default=100, nullable=False)
    badge_code = Column(String(100), nullable=False, unique=True)  # e.g. first_log, zero_waste, transit_master
    icon_url = Column(String(255), nullable=True)

class UserAchievement(Base):
    __tablename__ = "user_achievements"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    achievement_id = Column(Integer, ForeignKey("achievements.id", ondelete="CASCADE"), nullable=False)
    unlocked_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="achievements")
    achievement = relationship("Achievement")

class EcoGroup(Base):
    __tablename__ = "eco_groups"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, unique=True)
    description = Column(Text, nullable=False)
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    members_count = Column(Integer, default=1, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    members = relationship("GroupMember", back_populates="group", cascade="all, delete-orphan")

class LearningPath(Base):
    __tablename__ = "learning_paths"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    difficulty = Column(String(50), default="Beginner", nullable=False)  # Beginner, Intermediate, Expert
    estimated_minutes = Column(Integer, default=15, nullable=False)
    xp_reward = Column(Integer, default=150, nullable=False)

    lessons = relationship("LearningLesson", back_populates="path", cascade="all, delete-orphan")

class LearningLesson(Base):
    __tablename__ = "learning_lessons"
    id = Column(Integer, primary_key=True, index=True)
    path_id = Column(Integer, ForeignKey("learning_paths.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)
    quiz_question = Column(Text, nullable=True)
    quiz_options = Column(JSON, nullable=True)  # List of strings
    quiz_answer = Column(String(255), nullable=True)
    xp_reward = Column(Integer, default=50, nullable=False)

    path = relationship("LearningPath", back_populates="lessons")

class UserLessonProgress(Base):
    __tablename__ = "user_lessons_progress"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    lesson_id = Column(Integer, ForeignKey("learning_lessons.id", ondelete="CASCADE"), nullable=False)
    completed = Column(Boolean, default=False, nullable=False)
    completed_at = Column(DateTime(timezone=True), server_default=func.now())

    lesson = relationship("LearningLesson")

class SimulationRun(Base):
    __tablename__ = "simulation_runs"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    inputs_json = Column(JSON, nullable=False)  # inputs for simulation
    co2_saved = Column(Float, nullable=False)  # kg CO2e saved
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="simulations")

class OffsetProject(Base):
    __tablename__ = "offset_projects"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, unique=True)
    description = Column(Text, nullable=False)
    cost_per_ton = Column(Float, nullable=False)  # Cost in USD per ton of CO2 offsetted
    co2_offset = Column(Float, nullable=False)  # Total capacity or current offset in tons
    image_url = Column(String(255), nullable=True)
    verified_by = Column(String(255), default="Gold Standard", nullable=False)

class UserOffset(Base):
    __tablename__ = "user_offsets"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    project_id = Column(Integer, ForeignKey("offset_projects.id", ondelete="CASCADE"), nullable=False)
    amount_bought = Column(Float, nullable=False)  # USD spent
    cost_paid = Column(Float, nullable=False)  # USD
    co2_offsetted = Column(Float, nullable=False)  # kg CO2 offsetted
    purchased_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="offsets")
    project = relationship("OffsetProject")

class DigitalTwinState(Base):
    __tablename__ = "digital_twin_states"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    tree_growth_stage = Column(Integer, default=1, nullable=False)  # 1 to 5 (Seed, Sprout, Sapling, Tree, Mature Tree)
    energy_efficiency_score = Column(Float, default=50.0, nullable=False)  # 0 to 100
    current_avatar_state_json = Column(JSON, nullable=False)  # health index, color variables, accessory lists
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())

    user = relationship("User", back_populates="digital_twin")

class RefreshToken(Base):
    __tablename__ = "refresh_tokens"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token = Column(String(512), unique=True, index=True, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User")
