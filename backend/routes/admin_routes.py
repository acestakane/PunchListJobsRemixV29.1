from fastapi import APIRouter, HTTPException, Depends, Query, Request, UploadFile, File
from database import db
from auth import get_current_user, hash_password
from models import AdminUserUpdate, TermsUpdate, SettingsUpdate, PasswordResetAdmin
from utils.activity_log import log_activity
from utils.rbac import require_permission
from utils.user_helpers import parse_name_fields, build_base_user_doc
from utils.analytics_helpers import (
    fetch_user_stats, fetch_job_stats, fetch_subscription_stats,
    fetch_revenue_data, fetch_performance_data, fetch_recent_users,
)
from typing import Optional
import uuid
import logging
import csv
import io
import json as json_lib
from fastapi.responses import StreamingResponse, JSONResponse
from datetime import datetime, timezone, timedelta
import secrets
import string

router = APIRouter()
logger = logging.getLogger(__name__)

ADMIN_ROLES = ("admin", "superadmin")


async def require_admin(current_user: dict = Depends(get_current_user)):
    """Allow both admin and superadmin roles."""
    if current_user["role"] not in ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


async def require_superadmin(current_user: dict = Depends(get_current_user)):
    """Only superadmin can access these endpoints."""
    if current_user["role"] != "superadmin":
        raise HTTPException(status_code=403, detail="Super Administrator access required")
    return current_user


@router.get("/analytics")
async def get_analytics(admin: dict = Depends(require_admin)):
    user_stats = await fetch_user_stats()
    job_stats = await fetch_job_stats()
    sub_stats = await fetch_subscription_stats()
    revenue_data = await fetch_revenue_data()
    perf_data = await fetch_performance_data(
        crew_count=user_stats["crew_count"],
        completed_jobs=job_stats["completed_jobs"],
        total_jobs=job_stats["total_jobs"],
    )
    recent_users = await fetch_recent_users()
    return {**user_stats, **job_stats, **sub_stats, **revenue_data, **perf_data, "recent_users": recent_users}


@router.get("/users")
async def list_users(
    role: Optional[str] = None,
    search: Optional[str] = None,
    page: int = 1,
    limit: int = 20,
    admin: dict = Depends(require_admin)
):
    query = {}
    # Non-superadmin cannot see superadmin accounts
    if admin["role"] == "admin":
        query["role"] = {"$nin": ["superadmin"]}
    if role:
        if admin["role"] == "admin" and role == "superadmin":
            raise HTTPException(status_code=403, detail="Cannot view superadmin accounts")
        query["role"] = role
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}}
        ]

    skip = (page - 1) * limit
    users = await db.users.find(query, {"_id": 0, "password_hash": 0}).skip(skip).limit(limit).to_list(limit)
    total = await db.users.count_documents(query)
    return {"users": users, "total": total, "page": page, "pages": (total + limit - 1) // limit}


@router.get("/users/export")
async def export_users_csv(admin: dict = Depends(require_admin)):
    """Export users as CSV (no images)."""
    query = {"role": {"$nin": ["superadmin"]}} if admin["role"] == "admin" else {}
    users = await db.users.find(
        query, {"_id": 0, "password_hash": 0, "profile_photo": 0, "logo": 0}
    ).to_list(10000)

    fields = ["id", "name", "email", "role", "phone", "is_active", "is_verified",
              "subscription_status", "trade", "company_name", "points", "rating",
              "jobs_completed", "created_at"]
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=fields, extrasaction="ignore")
    writer.writeheader()
    for u in users:
        writer.writerow({k: u.get(k, "") for k in fields})

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="users_export.csv"'},
    )


@router.get("/users/export-json")
async def export_users_json(admin: dict = Depends(require_admin)):
    """Export users as JSON download."""
    query = {"role": {"$nin": ["superadmin"]}} if admin["role"] == "admin" else {}
    users = await db.users.find(
        query, {"_id": 0, "password_hash": 0, "profile_photo": 0, "logo": 0}
    ).to_list(10000)

    fields = ["id", "name", "email", "role", "phone", "is_active", "is_verified",
              "subscription_status", "trade", "company_name", "points", "rating",
              "jobs_completed", "created_at"]
    cleaned = [{k: u.get(k, "") for k in fields} for u in users]

    content = json_lib.dumps(cleaned, indent=2, default=str)
    return StreamingResponse(
        iter([content]),
        media_type="application/json",
        headers={"Content-Disposition": 'attachment; filename="users_export.json"'},
    )


@router.get("/users/{user_id}")
async def get_user(user_id: str, admin: dict = Depends(require_admin)):
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    # Admin cannot view superadmin details
    if admin["role"] == "admin" and user.get("role") == "superadmin":
        raise HTTPException(status_code=403, detail="Access denied")
    return user


@router.put("/users/{user_id}")
async def update_user(user_id: str, data: AdminUserUpdate, admin: dict = Depends(require_admin)):
    target = await db.users.find_one({"id": user_id})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    # Admin cannot modify superadmin
    if admin["role"] == "admin" and target.get("role") == "superadmin":
        raise HTTPException(status_code=403, detail="Cannot modify superadmin account")
    update = {k: v for k, v in data.model_dump().items() if v is not None}
    if not update:
        raise HTTPException(status_code=400, detail="No fields to update")
    await db.users.update_one({"id": user_id}, {"$set": update})
    return {"message": "User updated"}


@router.delete("/users/{user_id}")
async def delete_user(user_id: str, admin: dict = Depends(require_admin)):
    target = await db.users.find_one({"id": user_id})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if target.get("role") == "superadmin":
        raise HTTPException(status_code=403, detail="Cannot delete superadmin account")
    if admin["role"] == "admin" and target.get("role") == "admin":
        raise HTTPException(status_code=403, detail="Admins cannot delete other admin accounts")
    result = await db.users.delete_one({"id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    await log_activity(actor=admin, action="admin.user.delete", category="admin",
                       target_id=user_id, target_type="user",
                       details={"target_email": target.get("email"), "target_role": target.get("role")})
    return {"message": "User deleted"}


@router.post("/users/{user_id}/suspend")
async def suspend_user(user_id: str, admin: dict = Depends(require_admin)):
    target = await db.users.find_one({"id": user_id})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if target.get("role") in ("superadmin",):
        raise HTTPException(status_code=403, detail="Cannot suspend superadmin")
    if admin["role"] == "admin" and target.get("role") == "admin":
        raise HTTPException(status_code=403, detail="Admins cannot suspend other admins")
    await db.users.update_one({"id": user_id}, {"$set": {"is_active": False}})
    await log_activity(actor=admin, action="admin.user.suspend", category="admin",
                       target_id=user_id, target_type="user",
                       details={"target_email": target.get("email"), "target_role": target.get("role")})
    return {"message": "User suspended"}


@router.post("/users/{user_id}/activate")
async def activate_user(user_id: str, admin: dict = Depends(require_admin)):
    await db.users.update_one({"id": user_id}, {"$set": {"is_active": True}})
    return {"message": "User activated"}


@router.put("/users/{user_id}/points")
async def update_user_points(user_id: str, points: int, admin: dict = Depends(require_admin)):
    await db.users.update_one({"id": user_id}, {"$set": {"points": points}})
    return {"message": f"Points set to {points}"}


# ─── SuperAdmin: Manage Admin Accounts ───────────────────────────────────────

@router.get("/admins")
async def list_admins(superadmin: dict = Depends(require_superadmin)):
    """SuperAdmin only: list all admin accounts."""
    admins = await db.users.find(
        {"role": "admin"},
        {"_id": 0, "password_hash": 0}
    ).to_list(100)
    return {"admins": admins, "total": len(admins)}


@router.post("/admins", status_code=201)
async def create_admin(data: dict, superadmin: dict = Depends(require_superadmin)):
    """SuperAdmin only: create a new admin account."""
    email = data.get("email", "").lower()
    password = data.get("password", "")
    first_name, last_name, name = parse_name_fields(data)

    if not email or not password or not name:
        raise HTTPException(status_code=400, detail="email, password, and name are required")

    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    admin_doc = build_base_user_doc(
        email=email, password=password, role="admin",
        first_name=first_name, last_name=last_name, name=name,
        phone=data.get("phone"),
        is_verified=True, subscription_status="active", subscription_days=3650,
    )
    admin_doc["is_online"] = True  # admins default online
    await db.users.insert_one(admin_doc)
    safe = {k: v for k, v in admin_doc.items() if k not in ("password_hash", "_id")}
    return {"message": "Admin created", "admin": safe}


@router.put("/admins/{admin_id}")
async def update_admin(admin_id: str, data: dict, superadmin: dict = Depends(require_superadmin)):
    """SuperAdmin only: update an admin account."""
    target = await db.users.find_one({"id": admin_id, "role": "admin"})
    if not target:
        raise HTTPException(status_code=404, detail="Admin not found")

    allowed_fields = {"name", "email", "phone", "is_active", "is_verified"}
    update = {k: v for k, v in data.items() if k in allowed_fields and v is not None}

    if "password" in data:
        update["password_hash"] = hash_password(data["password"])

    if not update:
        raise HTTPException(status_code=400, detail="No valid fields to update")

    await db.users.update_one({"id": admin_id}, {"$set": update})
    return {"message": "Admin updated"}


@router.delete("/admins/{admin_id}")
async def delete_admin(admin_id: str, superadmin: dict = Depends(require_superadmin)):
    """SuperAdmin only: delete an admin account."""
    target = await db.users.find_one({"id": admin_id, "role": "admin"})
    if not target:
        raise HTTPException(status_code=404, detail="Admin not found")
    await db.users.delete_one({"id": admin_id})
    return {"message": "Admin deleted"}


@router.post("/admins/{admin_id}/suspend")
async def suspend_admin(admin_id: str, superadmin: dict = Depends(require_superadmin)):
    """SuperAdmin only: suspend an admin account."""
    target = await db.users.find_one({"id": admin_id, "role": "admin"})
    if not target:
        raise HTTPException(status_code=404, detail="Admin not found")
    await db.users.update_one({"id": admin_id}, {"$set": {"is_active": False}})
    return {"message": "Admin suspended"}


@router.post("/admins/{admin_id}/activate")
async def activate_admin(admin_id: str, superadmin: dict = Depends(require_superadmin)):
    """SuperAdmin only: activate an admin account."""
    target = await db.users.find_one({"id": admin_id, "role": "admin"})
    if not target:
        raise HTTPException(status_code=404, detail="Admin not found")
    await db.users.update_one({"id": admin_id}, {"$set": {"is_active": True}})
    return {"message": "Admin activated"}


@router.get("/jobs")
async def list_all_jobs(
    status: Optional[str] = None,
    page: int = 1,
    limit: int = 20,
    admin: dict = Depends(require_admin)
):
    query = {}
    if status:
        query["status"] = status
    skip = (page - 1) * limit
    jobs = await db.jobs.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.jobs.count_documents(query)
    return {"jobs": jobs, "total": total, "page": page}


@router.get("/map-data")
async def get_map_data(admin: dict = Depends(require_admin)):
    active_jobs = await db.jobs.find(
        {"status": {"$in": ["open", "fulfilled", "in_progress"]}},
        {"_id": 0}
    ).to_list(500)

    crew_with_location = await db.users.find(
        {"role": "crew", "location": {"$ne": None}, "is_active": True},
        {"_id": 0, "password_hash": 0, "id": 1, "name": 1, "trade": 1, "location": 1, "availability": 1}
    ).to_list(1000)

    return {"jobs": active_jobs, "crew": crew_with_location}


@router.get("/settings")
async def get_settings(admin: dict = Depends(require_admin)):
    settings = await db.settings.find_one({}, {"_id": 0})
    if not settings:
        settings = {
            "daily_price": 1.99, "weekly_price": 9.99, "monthly_price": 29.99, "annual_price": 179.94,
            "trial_days": 30, "job_visibility_hours": 12,
            "social_linkedin_enabled": True, "social_twitter_enabled": True,
            "social_facebook_enabled": True, "social_native_share_enabled": True,
            "enable_crew_transportation_type": False,
        }
    return settings


@router.put("/settings")
async def update_settings(data: SettingsUpdate, admin: dict = Depends(require_admin)):
    update = {k: v for k, v in data.model_dump().items() if v is not None}
    await db.settings.update_one({}, {"$set": update}, upsert=True)
    await log_activity(actor=admin, action="admin.settings.update", category="admin",
                       details={"changed_fields": list(update.keys())})
    return {"message": "Settings updated"}


@router.get("/terms")
async def get_terms(admin: dict = Depends(require_admin)):
    terms = await db.terms.find_one({}, {"_id": 0})
    return terms or {"content": "Terms and Conditions will be added here.", "version": 1}


@router.put("/terms")
async def update_terms(data: TermsUpdate, admin: dict = Depends(require_admin)):
    existing = await db.terms.find_one({})
    version = (existing.get("version", 0) + 1) if existing else 1
    await db.terms.update_one(
        {},
        {"$set": {"content": data.content, "version": version, "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True
    )
    return {"message": "Terms updated", "version": version}


@router.get("/payments")
async def list_payments(admin: dict = Depends(require_admin)):
    payments = await db.payment_transactions.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return payments


@router.get("/payments/by-user")
async def payments_by_user(admin: dict = Depends(require_admin)):
    pipeline = [
        {"$group": {
            "_id": "$user_id",
            "total": {"$sum": "$amount"},
            "count": {"$sum": 1},
            "transactions": {"$push": {
                "id": "$id", "amount": "$amount", "plan": "$plan",
                "payment_method": "$payment_method", "payment_status": "$payment_status",
                "created_at": "$created_at"
            }}
        }},
        {"$sort": {"total": -1}},
        {"$limit": 200}
    ]
    results = await db.payment_transactions.aggregate(pipeline).to_list(200)
    for r in results:
        u = await db.users.find_one({"id": r["_id"]}, {"_id": 0, "name": 1, "email": 1, "role": 1})
        r["user_name"] = (u.get("name") or "Unknown") if u else "Unknown"
        r["user_email"] = (u.get("email") or "") if u else ""
        r["user_role"] = (u.get("role") or "") if u else ""
        r["user_id"] = r.pop("_id") or ""
        r["total"] = round(r["total"], 2)
    return results


@router.get("/top-performers")
async def top_performers(admin: dict = Depends(require_admin)):
    top_by_jobs = await db.users.find(
        {"role": "crew", "jobs_completed": {"$gt": 0}},
        {"_id": 0, "id": 1, "name": 1, "trade": 1, "jobs_completed": 1, "rating": 1, "rating_count": 1}
    ).sort("jobs_completed", -1).limit(10).to_list(10)

    top_by_rating = await db.users.find(
        {"role": "crew", "rating_count": {"$gt": 0}},
        {"_id": 0, "id": 1, "name": 1, "trade": 1, "jobs_completed": 1, "rating": 1, "rating_count": 1}
    ).sort("rating", -1).limit(10).to_list(10)

    return {"top_by_jobs": top_by_jobs, "top_by_rating": top_by_rating}


@router.post("/users", status_code=201)
async def create_user(data: dict, admin: dict = Depends(require_admin)):
    email = (data.get("email") or "").lower().strip()
    password = data.get("password", "")
    first_name, last_name, name = parse_name_fields(data)
    role = (data.get("role") or "crew").strip().lower()

    if not email or not password or not name:
        raise HTTPException(status_code=400, detail="First name, email, and password are required")
    if role == "superadmin":
        raise HTTPException(status_code=403, detail="Cannot create superadmin accounts")
    if role == "admin" and admin["role"] != "superadmin":
        raise HTTPException(status_code=403, detail="Only superadmin can create admin accounts")
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already registered")

    doc = build_base_user_doc(
        email=email, password=password, role=role,
        first_name=first_name, last_name=last_name, name=name,
        phone=data.get("phone"),
        is_verified=False, subscription_status="trial", subscription_days=30,
    )
    await db.users.insert_one(doc)
    safe = {k: v for k, v in doc.items() if k not in ("password_hash", "_id")}
    await log_activity(actor=admin, action="admin.user.create", category="admin",
                       details={"target_email": email, "target_role": role})
    return {"message": "User created", "user": safe}


@router.delete("/jobs/{job_id}")
async def admin_delete_job(job_id: str, admin: dict = Depends(require_admin)):
    job = await db.jobs.find_one({"id": job_id})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    await db.jobs.delete_one({"id": job_id})
    await log_activity(actor=admin, action="admin.job.delete", category="admin",
                       target_id=job_id, target_type="job",
                       details={"title": job.get("title")})
    return {"message": "Job deleted"}


# ─── User Password Reset ──────────────────────────────────────────────────────

@router.post("/users/{user_id}/reset-password")
async def reset_user_password(user_id: str, data: PasswordResetAdmin, admin: dict = Depends(require_admin)):
    """Admin resets a specific user's password."""
    target = await db.users.find_one({"id": user_id})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if admin["role"] == "admin" and target.get("role") in ("superadmin", "admin"):
        raise HTTPException(status_code=403, detail="Cannot reset admin/superadmin password")
    if not data.new_password or len(data.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    await db.users.update_one({"id": user_id}, {"$set": {"password_hash": hash_password(data.new_password)}})
    await log_activity(actor=admin, action="admin.user.reset_password", category="admin",
                       target_id=user_id, target_type="user",
                       details={"target_email": target.get("email")})
    return {"message": "Password reset successfully"}


@router.post("/users/import", status_code=201)
async def import_users_csv(file: UploadFile = File(...), admin: dict = Depends(require_admin)):
    """Bulk import users from CSV. Upserts by email. No image columns."""
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="File must be a .csv")

    content = await file.read()
    reader = csv.DictReader(io.StringIO(content.decode("utf-8-sig")))
    created, updated, errors = 0, 0, []

    for row in reader:
        email = (row.get("email") or "").strip().lower()
        if not email:
            continue

        role = (row.get("role") or "crew").strip().lower()
        if role == "superadmin":
            errors.append(f"{email}: cannot import superadmin role")
            continue
        if role == "admin" and admin["role"] != "superadmin":
            errors.append(f"{email}: only superadmin can import admin accounts")
            continue

        update_data = {k: row[k].strip() for k in ("name", "role", "phone", "trade", "company_name") if row.get(k)}
        existing = await db.users.find_one({"email": email})

        if existing:
            if update_data:
                await db.users.update_one({"email": email}, {"$set": update_data})
                updated += 1
        else:
            now = datetime.now(timezone.utc).isoformat()
            code = ''.join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(8))
            doc = {
                "id": str(uuid.uuid4()), "email": email,
                "password_hash": hash_password("TempPass@123"),
                "role": role, "name": update_data.get("name", email.split("@")[0]),
                "phone": update_data.get("phone"), "is_active": True, "is_verified": False,
                "created_at": now, "subscription_status": "free",
                "usage_month": datetime.now(timezone.utc).strftime("%Y-%m"), "usage_count": 0,
                "points": 0, "referral_code": code,
                "trade": update_data.get("trade", ""), "company_name": update_data.get("company_name", ""),
                "bio": "", "skills": [], "profile_photo": None,
                "availability": True, "is_online": False, "location": None,
                "rating": 0.0, "rating_count": 0, "jobs_completed": 0,
            }
            try:
                await db.users.insert_one(doc)
                created += 1
            except Exception as e:
                errors.append(f"{email}: {str(e)}")

    return {"created": created, "updated": updated, "errors": errors}


# ─── SubAdmin Management (Admin creates / manages SubAdmins) ──────────────────

@router.get("/subadmins")
async def list_subadmins(admin: dict = Depends(require_admin)):
    subadmins = await db.users.find({"role": "subadmin"}, {"_id": 0, "password_hash": 0}).to_list(100)
    return {"subadmins": subadmins, "total": len(subadmins)}


@router.post("/subadmins", status_code=201)
async def create_subadmin(data: dict, admin: dict = Depends(require_admin)):
    email = (data.get("email") or "").lower().strip()
    password = data.get("password", "")
    first_name, last_name, name = parse_name_fields(data)
    if not email or not password or not name:
        raise HTTPException(status_code=400, detail="email, password, and name are required")
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already registered")

    doc = build_base_user_doc(
        email=email, password=password, role="subadmin",
        first_name=first_name, last_name=last_name, name=name,
        phone=data.get("phone"),
        is_verified=True, subscription_status="active", subscription_days=3650,
    )
    await db.users.insert_one(doc)
    safe = {k: v for k, v in doc.items() if k not in ("password_hash", "_id")}
    await log_activity(actor=admin, action="admin.subadmin.create", category="admin",
                       details={"target_email": email})
    return {"message": "SubAdmin created", "subadmin": safe}


@router.post("/subadmins/{sub_id}/suspend")
async def suspend_subadmin(sub_id: str, admin: dict = Depends(require_admin)):
    if not await db.users.find_one({"id": sub_id, "role": "subadmin"}):
        raise HTTPException(status_code=404, detail="SubAdmin not found")
    await db.users.update_one({"id": sub_id}, {"$set": {"is_active": False}})
    return {"message": "SubAdmin suspended"}


@router.post("/subadmins/{sub_id}/activate")
async def activate_subadmin(sub_id: str, admin: dict = Depends(require_admin)):
    if not await db.users.find_one({"id": sub_id, "role": "subadmin"}):
        raise HTTPException(status_code=404, detail="SubAdmin not found")
    await db.users.update_one({"id": sub_id}, {"$set": {"is_active": True}})
    return {"message": "SubAdmin activated"}


@router.delete("/subadmins/{sub_id}")
async def delete_subadmin(sub_id: str, admin: dict = Depends(require_admin)):
    if not await db.users.find_one({"id": sub_id, "role": "subadmin"}):
        raise HTTPException(status_code=404, detail="SubAdmin not found")
    await db.users.delete_one({"id": sub_id})
    return {"message": "SubAdmin deleted"}


# ─── GET /payments/history — All payments with period totals (admin) ──────────

@router.get("/payments/history")
async def admin_payments_history(admin: dict = Depends(require_admin)):
    txs = await db.payment_transactions.find({}, {"_id": 0}).sort("created_at", -1).to_list(2000)

    # Attach user info
    user_ids = list({tx["user_id"] for tx in txs})
    users = await db.users.find(
        {"id": {"$in": user_ids}}, {"_id": 0, "id": 1, "name": 1, "email": 1}
    ).to_list(2000)
    user_map = {u["id"]: u for u in users}
    for tx in txs:
        u = user_map.get(tx["user_id"], {})
        tx["user_name"]  = u.get("name", "Unknown")
        tx["user_email"] = u.get("email", "")

    now = datetime.now(timezone.utc)
    day_start   = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start  = day_start - timedelta(days=now.weekday())
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    year_start  = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)

    def _total(start: datetime) -> float:
        total = 0.0
        for tx in txs:
            if tx.get("status") != "completed":
                continue
            try:
                if datetime.fromisoformat(tx["created_at"].replace("Z", "")) >= start:
                    total += tx.get("amount", 0.0)
            except (KeyError, ValueError):
                pass
        return round(total, 2)

    all_time = round(sum(tx.get("amount", 0.0) for tx in txs if tx.get("status") == "completed"), 2)

    return {
        "transactions": txs,
        "totals": {
            "daily":    _total(day_start),
            "weekly":   _total(week_start),
            "monthly":  _total(month_start),
            "yearly":   _total(year_start),
            "all_time": all_time,
        },
    }



# ── Email admin endpoints ─────────────────────────────────────────────────────

@router.get("/email/status")
async def email_status(admin: dict = Depends(require_admin)):
    """Return current email delivery mode and configuration status."""
    from utils.email_utils import _active_mode, RESEND_API_KEY, SMTP_HOST, SMTP_USER, SENDER_EMAIL
    mode = _active_mode()
    return {
        "mode": mode,
        "sender_email": SENDER_EMAIL,
        "resend_configured": bool(RESEND_API_KEY),
        "smtp_configured": bool(SMTP_HOST and SMTP_USER),
        "production_ready": mode != "mock",
        "note": (
            "Live: emails are being sent via Resend." if mode == "resend" else
            "Live: emails are being sent via SMTP." if mode == "smtp" else
            "Mock mode: emails are logged but NOT sent. Add RESEND_API_KEY or SMTP credentials to go live."
        ),
    }


@router.get("/email/mock-log")
async def email_mock_log(admin: dict = Depends(require_admin)):
    """Return the last 50 emails that would have been sent (mock mode only)."""
    from utils.email_utils import mock_email_log
    return {"count": len(mock_email_log), "emails": list(mock_email_log)}


@router.post("/email/send-test")
async def send_test_email(data: dict, admin: dict = Depends(require_admin)):
    """Send a test email to verify configuration. Body: {to: str}"""
    from utils.email_utils import send_email, _wrap_template, _active_mode
    to = data.get("to", admin.get("email", ""))
    if not to:
        raise HTTPException(status_code=400, detail="'to' email required")
    mode = _active_mode()
    body = f"""
      <h2 style="margin:0 0 12px;color:#0f172a;font-size:20px;">Test Email</h2>
      <p style="color:#475569;line-height:1.6;margin:0 0 16px;">
        This is a test email from <strong>PunchListJobs</strong>.<br>
        Delivery mode: <strong>{mode.upper()}</strong>
      </p>
      <p style="color:#94a3b8;font-size:13px;margin:0;">Sent by admin: {admin.get('email')}</p>"""
    ok = await send_email(to, "PunchListJobs — Test Email", _wrap_template("Test Email", body))
    return {"success": ok, "mode": mode, "to": to}
