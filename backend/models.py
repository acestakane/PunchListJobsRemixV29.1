import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, EmailStr, field_validator
from utils.security import sanitize_and_validate


def utc_now_str() -> str:
    return datetime.now(timezone.utc).isoformat()


def trial_end_str(days: int = 30) -> str:
    return (datetime.now(timezone.utc) + timedelta(days=days)).isoformat()


# ─── Auth Models ─────────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    role: str  # crew, contractor, admin
    name: Optional[str] = Field(None, max_length=200)
    first_name: Optional[str] = Field(None, max_length=100)
    last_name: Optional[str] = Field(None, max_length=100)
    phone: Optional[str] = Field(None, max_length=20)
    address: Optional[str] = Field(None, max_length=500)
    trade: Optional[str] = Field(None, max_length=200)
    bio: Optional[str] = Field(None, max_length=2000)
    referral_code_used: Optional[str] = None
    company_name: Optional[str] = Field(None, max_length=200)
    captcha_token: Optional[str] = None
    
    @field_validator('name', 'first_name', 'last_name', 'company_name', 'bio', 'address', mode='before')
    @classmethod
    def sanitize_text_fields(cls, v):
        """Sanitize text fields to prevent XSS attacks."""
        if v is None:
            return v
        return sanitize_and_validate(v, max_length=2000)


class UserLogin(BaseModel):
    email: EmailStr
    password: str
    captcha_token: Optional[str] = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: Dict


# ─── User Models ─────────────────────────────────────────────────────────────

TRANSPORTATION_TYPES = ["Car", "SUV", "Truck", "Van", "Rideshare", "Public Transit", "Other"]


class ProfileUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=200)
    first_name: Optional[str] = Field(None, max_length=100)
    last_name: Optional[str] = Field(None, max_length=100)
    phone: Optional[str] = Field(None, max_length=20)
    bio: Optional[str] = Field(None, max_length=2000)
    trade: Optional[str] = Field(None, max_length=200)
    discipline: Optional[str] = Field(None, max_length=200)
    skill: Optional[str] = Field(None, max_length=200)
    skills: Optional[List[str]] = None
    availability: Optional[bool] = None
    is_online: Optional[bool] = None
    location: Optional[Dict] = None
    address: Optional[str] = Field(None, max_length=500)
    company_name: Optional[str] = Field(None, max_length=200)
    hide_location: Optional[bool] = None
    email: Optional[str] = None
    transportation_type: Optional[str] = None
    travel_radius_miles: Optional[int] = Field(None, ge=0, le=500)

    @field_validator('travel_radius_miles', mode='before')
    @classmethod
    def coerce_empty_to_none(cls, v):
        if v == '' or v is None:
            return None
        return v

    @field_validator('name', 'first_name', 'last_name', 'bio', 'address', 'company_name', mode='before')
    @classmethod
    def sanitize_text_fields(cls, v):
        """Sanitize text fields to prevent XSS attacks."""
        if v is None:
            return v
        return sanitize_and_validate(v, max_length=2000)


class OnlineStatusUpdate(BaseModel):
    is_online: bool


class LocationUpdate(BaseModel):
    lat: float
    lng: float
    city: Optional[str] = None


# ─── Job Models ──────────────────────────────────────────────────────────────

class JobCreate(BaseModel):
    title: str = Field(..., max_length=200)
    description: str = Field(..., max_length=5000)
    trade: str = Field(..., max_length=200)
    discipline: Optional[str] = Field(None, max_length=200)
    skill: Optional[str] = Field(None, max_length=200)
    crew_needed: int = Field(..., gt=0, le=100)
    start_time: str
    pay_rate: float = Field(..., gt=0, le=10000)
    address: str = Field(..., max_length=500)
    is_emergency: bool = False
    is_boosted: bool = False
    tasks: List[str] = Field(default_factory=list, max_length=50)
    
    @field_validator('title', 'description', 'address', mode='before')
    @classmethod
    def sanitize_text_fields(cls, v):
        """Sanitize text fields to prevent XSS attacks."""
        if v is None:
            return v
        return sanitize_and_validate(v, max_length=5000)
    
    @field_validator('tasks', mode='before')
    @classmethod
    def sanitize_tasks(cls, v):
        """Sanitize task list items."""
        if not v:
            return v
        return [sanitize_and_validate(task, max_length=500) for task in v if task]


class JobUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=200)
    description: Optional[str] = Field(None, max_length=5000)
    trade: Optional[str] = Field(None, max_length=200)
    discipline: Optional[str] = Field(None, max_length=200)
    skill: Optional[str] = Field(None, max_length=200)
    crew_needed: Optional[int] = Field(None, gt=0, le=100)
    start_time: Optional[str] = None
    pay_rate: Optional[float] = Field(None, gt=0, le=10000)
    address: Optional[str] = Field(None, max_length=500)
    is_emergency: Optional[bool] = None
    is_boosted: Optional[bool] = None
    tasks: Optional[List[str]] = Field(None, max_length=50)
    
    @field_validator('title', 'description', 'address', mode='before')
    @classmethod
    def sanitize_text_fields(cls, v):
        """Sanitize text fields to prevent XSS attacks."""
        if v is None:
            return v
        return sanitize_and_validate(v, max_length=5000)
    
    @field_validator('tasks', mode='before')
    @classmethod
    def sanitize_tasks(cls, v):
        """Sanitize task list items."""
        if not v:
            return v
        return [sanitize_and_validate(task, max_length=500) for task in v if task]


class TaskCheckRequest(BaseModel):
    task_idx: int
    checked: bool


class DisputeCreate(BaseModel):
    reason: str = Field(..., max_length=2000)
    
    @field_validator('reason', mode='before')
    @classmethod
    def sanitize_reason(cls, v):
        """Sanitize reason field."""
        return sanitize_and_validate(v, max_length=2000)


# ─── Rating Models ───────────────────────────────────────────────────────────

class RatingCreate(BaseModel):
    rated_id: str
    job_id: str
    stars: int = Field(..., ge=1, le=5)
    review: Optional[str] = Field(None, max_length=2000)
    
    @field_validator('review', mode='before')
    @classmethod
    def sanitize_review(cls, v):
        """Sanitize review field."""
        if v is None:
            return v
        return sanitize_and_validate(v, max_length=2000)


class SkipRatingRequest(BaseModel):
    crew_id: Optional[str] = None       # contractor skipping a crew member
    contractor_id: Optional[str] = None  # crew skipping contractor rating



# ─── Offer Models ────────────────────────────────────────────────────────────

class OfferCreate(BaseModel):
    crew_id: str
    pay_rate: float = Field(..., gt=0, le=10000)
    message: Optional[str] = Field(None, max_length=1000)
    
    @field_validator('message', mode='before')
    @classmethod
    def sanitize_message(cls, v):
        """Sanitize message field."""
        if v is None:
            return v
        return sanitize_and_validate(v, max_length=1000)


class OfferCounter(BaseModel):
    counter_rate: float = Field(..., gt=0, le=10000)
    message: Optional[str] = Field(None, max_length=1000)
    
    @field_validator('message', mode='before')
    @classmethod
    def sanitize_message(cls, v):
        """Sanitize message field."""
        if v is None:
            return v
        return sanitize_and_validate(v, max_length=1000)



# ─── Payment Models ──────────────────────────────────────────────────────────

class CheckoutRequest(BaseModel):
    plan: str  # daily, weekly, monthly, annual
    payment_method: str  # stripe, paypal, square, demo
    origin_url: str
    coupon_code: Optional[str] = None


class PayPalCaptureRequest(BaseModel):
    order_id: str
    plan: str
    user_id: str


# ─── Admin Models ────────────────────────────────────────────────────────────

class AdminUserUpdate(BaseModel):
    name: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    is_active: Optional[bool] = None
    is_verified: Optional[bool] = None
    role: Optional[str] = None
    points: Optional[int] = None
    subscription_status: Optional[str] = None


class TermsUpdate(BaseModel):
    content: str


class TradeCategory(BaseModel):
    name: str
    is_active: Optional[bool] = True

class TradeCategoryUpdate(BaseModel):
    name: Optional[str] = None
    is_active: Optional[bool] = None

class TradeCreate(BaseModel):
    name: str
    category_id: str
    is_active: Optional[bool] = True

class TradeUpdate(BaseModel):
    name: Optional[str] = None
    is_active: Optional[bool] = None

class SettingsUpdate(BaseModel):
    daily_price: Optional[float] = None
    weekly_price: Optional[float] = None
    monthly_price: Optional[float] = None
    annual_price: Optional[float] = None
    job_visibility_hours: Optional[int] = None
    free_crew_responses_per_month: Optional[int] = None
    free_contractor_posts_per_month: Optional[int] = None
    social_linkedin_enabled: Optional[bool] = None
    social_twitter_enabled: Optional[bool] = None
    social_facebook_enabled: Optional[bool] = None
    social_native_share_enabled: Optional[bool] = None
    show_verification_sidebar: Optional[bool] = None
    profile_boost_price: Optional[float] = None
    job_boost_price: Optional[float] = None
    emergency_post_price: Optional[float] = None
    accent_color: Optional[str] = None
    brand_color: Optional[str] = None
    nav_bg_color: Optional[str] = None
    site_name: Optional[str] = None
    tagline: Optional[str] = None
    enable_crew_transportation_type: Optional[bool] = None
    show_travel_distance: Optional[bool] = None


class CouponCreate(BaseModel):
    code: str
    type: str                            # "percent" | "fixed"
    value: float                         # percent (1-100) or fixed dollar amount
    max_uses: Optional[int] = None       # None = unlimited
    expires_at: Optional[str] = None     # ISO datetime string
    plan_restriction: Optional[str] = None  # None = any plan


class PasswordResetAdmin(BaseModel):
    new_password: str


class CMSPageUpdate(BaseModel):
    title: Optional[str] = None
    header_text: Optional[str] = None
    content: Optional[str] = None
    youtube_url: Optional[str] = None


# ─── Crew Request Models ─────────────────────────────────────────────────────

class CrewRequest(BaseModel):
    crew_id: str
    message: Optional[str] = None
    job_context: Optional[Dict] = None  # Optional job details to pre-fill


# ─── Contact Unlock Models ───────────────────────────────────────────────────

class ContactUnlockRequest(BaseModel):
    target_user_id: str


# ─── Referral / Points ───────────────────────────────────────────────────────

class RedeemPoints(BaseModel):
    points: int  # points to redeem for subscription days

