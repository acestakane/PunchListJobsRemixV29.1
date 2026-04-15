"""
auth_helpers.py — Pure functions extracted from the register route.
"""
import uuid
import secrets
import string
from datetime import datetime, timezone


def resolve_full_name(data) -> str:
    """Derive full name from first_name/last_name, falling back to name."""
    first_name = (data.first_name or "").strip()
    last_name = (data.last_name or "").strip()
    if first_name or last_name:
        return f"{first_name} {last_name}".strip()
    return (data.name or "").strip()


def generate_referral_code(length: int = 8) -> str:
    alphabet = string.ascii_uppercase + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


def build_user_doc(data, full_name: str, code: str, now: str) -> dict:
    """Build the full user document dict ready for MongoDB insert."""
    return {
        "id": str(uuid.uuid4()),
        "email": data.email.lower(),
        "password_hash": None,          # caller must fill in after hashing
        "role": data.role,
        "name": full_name,
        "first_name": (data.first_name or "").strip(),
        "last_name": (data.last_name or "").strip(),
        "phone": data.phone,
        "is_active": True,
        "is_verified": False,
        "created_at": now,
        "subscription_status": "free",
        "subscription_plan": None,
        "subscription_end": None,
        "usage_month": datetime.now(timezone.utc).strftime("%Y-%m"),
        "usage_count": 0,
        "points": 50,
        "referral_code": code,
        "referred_by": None,
        "bio": data.bio or "",
        "trade": data.trade or "",
        "address": data.address or "",
        "skills": [],
        "profile_photo": None,
        "availability": True,
        "is_online": False,
        "location": None,
        "rating": 0.0,
        "rating_count": 0,
        "jobs_completed": 0,
        "company_name": data.company_name or "",
        "logo": None,
        "hide_location": False,
        "favorite_crew": [],
    }
