import uuid
import secrets
import os
import httpx
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, status, Depends
from database import db
from models import UserCreate, UserLogin
from auth import hash_password, verify_password, create_token, user_to_response, get_current_user
from utils.email_utils import send_welcome_email
from utils.activity_log import log_activity
from utils.notify import create_notification
from utils.auth_helpers import resolve_full_name, generate_referral_code, build_user_doc

router = APIRouter()

RECAPTCHA_SECRET = os.environ.get("RECAPTCHA_SECRET_KEY", "")


async def verify_captcha(token: str | None):
    """Verify reCAPTCHA token with Google. Skip if no secret configured."""
    if not RECAPTCHA_SECRET or not token:
        return
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://www.google.com/recaptcha/api/siteverify",
            data={"secret": RECAPTCHA_SECRET, "response": token},
        )
        result = resp.json()
        if not result.get("success"):
            raise HTTPException(status_code=400, detail="CAPTCHA verification failed")


async def _process_referral(user_doc: dict, referral_code_used: str, now: str) -> None:
    """Award points and log referral when a valid referral code is used."""
    referrer = await db.users.find_one({"referral_code": referral_code_used})
    if not referrer:
        return
    user_doc["referred_by"] = referrer["id"]
    await db.users.update_one({"id": referrer["id"]}, {"$inc": {"points": 100}})
    await create_notification(
        referrer["id"], "referral_bonus", "Referral Bonus +100 pts",
        "You earned 100 points! Someone signed up using your referral code.",
    )
    await db.referrals.insert_one({
        "id": str(uuid.uuid4()),
        "referrer_id": referrer["id"],
        "referred_id": user_doc["id"],
        "points_awarded": 100,
        "created_at": now,
    })


@router.post("/register", status_code=201)
async def register(data: UserCreate):
    await verify_captcha(data.captcha_token)

    existing = await db.users.find_one({"email": data.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    if data.role not in ("crew", "contractor"):
        raise HTTPException(status_code=400, detail="Role must be crew or contractor")

    full_name = resolve_full_name(data)
    if not full_name:
        raise HTTPException(status_code=400, detail="Name is required")

    code = generate_referral_code()
    while await db.users.find_one({"referral_code": code}):
        code = generate_referral_code()

    now = datetime.now(timezone.utc).isoformat()
    user_doc = build_user_doc(data, full_name, code, now)
    user_doc["password_hash"] = hash_password(data.password)

    if data.referral_code_used:
        await _process_referral(user_doc, data.referral_code_used, now)

    await db.users.insert_one(user_doc)
    token = create_token({"sub": user_doc["id"], "role": user_doc["role"]})
    await send_welcome_email(full_name, data.email, data.role)
    await log_activity(
        actor=user_to_response(user_doc), action="auth.register", category="auth",
        details={"role": data.role, "email": data.email},
    )
    return {"access_token": token, "token_type": "bearer", "user": user_to_response(user_doc)}


@router.post("/login")
async def login(data: UserLogin):
    await verify_captcha(data.captcha_token)
    user = await db.users.find_one({"email": data.email.lower()}, {"_id": 0})
    if not user or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.get("is_active", True):
        raise HTTPException(status_code=403, detail="Account suspended")

    token = create_token({"sub": user["id"], "role": user["role"]})
    await log_activity(actor=user_to_response(user), action="auth.login", category="auth",
                       details={"email": data.email.lower()})
    return {"access_token": token, "token_type": "bearer", "user": user_to_response(user)}


@router.get("/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    return user_to_response(current_user)


# ─── Forgot / Reset Password ──────────────────────────────────────────────────

@router.post("/forgot-password")
async def forgot_password(data: dict):
    """Request a password reset. In demo mode the token is returned in the response."""
    email = (data.get("email") or "").lower().strip()
    if not email:
        raise HTTPException(status_code=400, detail="Email is required")

    user = await db.users.find_one({"email": email})
    # Don't reveal whether the email exists
    token = secrets.token_urlsafe(32)
    expires_at = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()

    if user:
        await db.password_resets.delete_many({"user_id": user["id"]})
        await db.password_resets.insert_one({
            "token": token,
            "user_id": user["id"],
            "email": email,
            "expires_at": expires_at,
            "used": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        await log_activity(
            actor={"id": user["id"], "name": user.get("name", ""), "role": user.get("role", "")},
            action="auth.forgot_password", category="auth",
            details={"email": email}
        )
        return {
            "message": "If this email is registered, a reset link has been sent.",
            "demo_token": token,
            "reset_url": f"/auth?mode=reset&token={token}",
        }

    return {"message": "If this email is registered, a reset link has been sent."}


@router.post("/reset-password")
async def reset_password(data: dict):
    """Set a new password using the token from forgot-password."""
    token = (data.get("token") or "").strip()
    new_password = data.get("new_password", "")

    if not token or not new_password:
        raise HTTPException(status_code=400, detail="Token and new_password are required")
    if len(new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    reset = await db.password_resets.find_one({"token": token, "used": False})
    if not reset:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")

    try:
        exp = datetime.fromisoformat(reset["expires_at"].replace("Z", "+00:00"))
        if exp < datetime.now(timezone.utc):
            raise HTTPException(status_code=400, detail="Reset token has expired. Please request a new one.")
    except ValueError:
        pass

    await db.users.update_one(
        {"id": reset["user_id"]},
        {"$set": {"password_hash": hash_password(new_password)}}
    )
    await db.password_resets.update_one({"token": token}, {"$set": {"used": True}})

    await log_activity(
        actor={"id": reset["user_id"], "name": "", "role": ""},
        action="auth.password_reset", category="auth",
        details={"email": reset.get("email")}
    )
    return {"message": "Password reset successfully. You can now log in."}
