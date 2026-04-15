"""Helpers for user document creation and name parsing — extracted from admin_routes.py
to reduce cyclomatic complexity of create_user() and create_admin()."""

import uuid
import secrets
import string
from datetime import datetime, timezone, timedelta
from auth import hash_password


def parse_name_fields(data: dict) -> tuple[str, str, str]:
    """Parse and normalize first_name, last_name, and full name from request data.

    Returns (first_name, last_name, name).
    """
    first_name = (data.get("first_name") or "").strip()
    last_name = (data.get("last_name") or "").strip()
    name = (data.get("name") or "").strip() or f"{first_name} {last_name}".strip()
    if not first_name and not last_name and name:
        parts = name.split(" ", 1)
        first_name = parts[0]
        last_name = parts[1] if len(parts) > 1 else ""
    return first_name, last_name, name


def generate_referral_code(length: int = 8) -> str:
    """Generate a random alphanumeric referral code."""
    return "".join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(length))


def build_base_user_doc(
    *,
    email: str,
    password: str,
    role: str,
    first_name: str,
    last_name: str,
    name: str,
    phone: str | None = None,
    is_verified: bool = False,
    subscription_status: str = "trial",
    subscription_days: int = 30,
) -> dict:
    """Build a canonical user document with all required fields.

    Use this instead of duplicating the field list in create_user / create_admin.
    """
    now = datetime.now(timezone.utc).isoformat()
    end = (datetime.now(timezone.utc) + timedelta(days=subscription_days)).isoformat()
    return {
        "id": str(uuid.uuid4()),
        "email": email,
        "password_hash": hash_password(password),
        "role": role,
        "name": name,
        "first_name": first_name,
        "last_name": last_name,
        "phone": phone,
        "is_active": True,
        "is_verified": is_verified,
        "created_at": now,
        "trial_start_date": now,
        "trial_end_date": end,
        "subscription_status": subscription_status,
        "subscription_plan": "monthly",
        "subscription_end": end,
        "usage_month": datetime.now(timezone.utc).strftime("%Y-%m"),
        "usage_count": 0,
        "points": 0,
        "referral_code": generate_referral_code(),
        "referred_by": None,
        "bio": "",
        "trade": "",
        "skills": [],
        "profile_photo": None,
        "availability": True,
        "is_online": False,
        "location": None,
        "rating": 0.0,
        "rating_count": 0,
        "jobs_completed": 0,
        "company_name": "",
        "logo": None,
        "hide_location": False,
        "favorite_crew": [],
        "profile_views": 0,
    }
