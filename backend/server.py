from fastapi import FastAPI, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
import uuid
from auth import hash_password
from database import db, client
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from datetime import datetime, timezone, timedelta
import secrets
import string

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

app = FastAPI(title="PunchListJobs API", version="1.0.0", redirect_slashes=False)
api_router = APIRouter(prefix="/api")

from routes.auth_routes import router as auth_router
from routes.job_routes import router as job_router
from routes.user_routes import router as user_router
from routes.admin_routes import router as admin_router
from routes.payment_routes import router as payment_router
from routes.ws_routes import router as ws_router
from routes.address_routes import router as address_router
from routes.activity_routes import router as activity_router
from routes.cms_routes import router as cms_router
from routes.coupon_routes import router as coupon_router
from routes.boost_routes import router as boost_router
from routes.concern_routes import router as concern_router
from routes.trades_routes import router as trades_router
from routes.message_routes import router as message_router
from routes.offers_routes import router as offers_router

api_router.include_router(auth_router, prefix="/auth", tags=["auth"])
api_router.include_router(job_router, prefix="/jobs", tags=["jobs"])
api_router.include_router(user_router, prefix="/users", tags=["users"])
api_router.include_router(admin_router, prefix="/admin", tags=["admin"])
api_router.include_router(payment_router, prefix="/payments", tags=["payments"])
api_router.include_router(ws_router)
api_router.include_router(address_router, prefix="/utils/address", tags=["address"])
api_router.include_router(activity_router, prefix="/admin", tags=["activity_logs"])
api_router.include_router(cms_router, prefix="/cms", tags=["cms"])
api_router.include_router(coupon_router, prefix="/coupons", tags=["coupons"])
api_router.include_router(boost_router, prefix="/boost", tags=["boost"])
api_router.include_router(concern_router, prefix="/concerns", tags=["concerns"])
api_router.include_router(trades_router, prefix="/trades", tags=["trades"])
api_router.include_router(message_router, prefix="/messages", tags=["messages"])
api_router.include_router(offers_router, prefix="/offers", tags=["offers"])

from fastapi import APIRouter as _AR
from database import db as _db

_pub = _AR()

@_pub.get("/settings/public")
async def public_settings():
    settings = await _db.settings.find_one({}, {"_id": 0})
    defaults = {
        "social_linkedin_enabled": True, "social_twitter_enabled": True,
        "social_facebook_enabled": True, "social_native_share_enabled": True,
        "show_verification_sidebar": True,
        "site_name": "PunchListJobs",
        "tagline": "A Blue Collar ME Company",
    }
    if not settings:
        return defaults
    public_keys = (
        "show_verification_sidebar", "accent_color", "brand_color", "nav_bg_color",
        "site_name", "tagline", "enable_crew_transportation_type", "show_travel_distance"
    )
    result = {k: v for k, v in settings.items() if k.startswith("social_") or k in public_keys}
    return {**defaults, **result}


import html as _html


@_pub.get("/j/{job_id}", response_class=HTMLResponse)
async def og_share_page(job_id: str):
    """Backend OG-tag page for social crawlers (Slack, Twitter, iMessage).
    Real browsers are redirected immediately to the React SPA at /j/{job_id}.
    """
    job = await _db.jobs.find_one({"id": job_id}, {"_id": 0})
    if not job or job.get("is_archived") or job.get("is_hidden"):
        return HTMLResponse("<html><body><p>Job not found.</p></body></html>", status_code=404)

    loc = job.get("location") or {}
    city  = loc.get("city", "")
    state = loc.get("state", "")
    location_str = ", ".join(filter(None, [city, state])) or "Location TBD"

    crew_accepted = len(job.get("crew_accepted", []))
    crew_needed   = job.get("crew_needed", 1)
    pay_rate      = job.get("pay_rate", 0)
    trade         = job.get("trade", "")

    og_title = _html.escape(f"{job['title']} — ${pay_rate}/hr in {location_str}")
    raw_desc  = (job.get("description") or "").strip()
    slot_info = f"{crew_accepted}/{crew_needed} slots filled"
    og_desc   = _html.escape(f"{raw_desc[:120] + ' | ' if raw_desc else ''}{trade + ' | ' if trade else ''}{slot_info}")
    spa_url   = f"/j/{job_id}"

    html_body = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>{og_title}</title>

  <!-- Open Graph -->
  <meta property="og:type"        content="website">
  <meta property="og:site_name"   content="PunchListJobs">
  <meta property="og:url"         content="{spa_url}">
  <meta property="og:title"       content="{og_title}">
  <meta property="og:description" content="{og_desc}">

  <!-- Twitter Card -->
  <meta name="twitter:card"        content="summary">
  <meta name="twitter:site"        content="@PunchListJobs">
  <meta name="twitter:title"       content="{og_title}">
  <meta name="twitter:description" content="{og_desc}">

  <!-- Instant redirect for real browsers -->
  <meta http-equiv="refresh" content="0; url={spa_url}">
  <script>window.location.replace("{spa_url}")</script>
</head>
<body>
  <p>Redirecting to <a href="{spa_url}">{og_title}</a>…</p>
</body>
</html>"""
    return HTMLResponse(html_body)

api_router.include_router(_pub)

@api_router.get("/")
async def root():
    return {"message": "PunchListJobs API", "status": "operational", "version": "1.0.0"}

app.include_router(api_router)

uploads_dir = ROOT_DIR / "uploads"
uploads_dir.mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(uploads_dir)), name="uploads")
app.mount("/api/uploads", StaticFiles(directory=str(uploads_dir)), name="api_uploads")

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()


def gen_code():
    alphabet = string.ascii_uppercase + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(8))


def base_user(email, password, role, name, **extra):
    now = datetime.now(timezone.utc).isoformat()
    parts = name.split(" ", 1)
    return {
        "id": str(uuid.uuid4()),
        "email": email.lower(),
        "password_hash": hash_password(password),
        "role": role,
        "name": name,
        "first_name": parts[0] if parts else "",
        "last_name": parts[1] if len(parts) > 1 else "",
        "phone": extra.get("phone"),
        "is_active": True,
        "is_verified": True,
        "created_at": now,
        "trial_start_date": now,
        "trial_end_date": (datetime.now(timezone.utc) + timedelta(days=3650)).isoformat(),
        "subscription_status": "active",
        "subscription_plan": "monthly",
        "subscription_end": (datetime.now(timezone.utc) + timedelta(days=3650)).isoformat(),
        "usage_month": datetime.now(timezone.utc).strftime("%Y-%m"),
        "usage_count": 0,
        "points": extra.get("points", 0),
        "referral_code": gen_code(),
        "referred_by": None,
        "bio": extra.get("bio", ""),
        "trade": extra.get("trade", ""),
        "skills": extra.get("skills", []),
        "profile_photo": None,
        "availability": extra.get("availability", True),
        "is_online": extra.get("is_online", False),
        "location": extra.get("location"),
        "rating": extra.get("rating", 0.0),
        "rating_count": extra.get("rating_count", 0),
        "jobs_completed": extra.get("jobs_completed", 0),
        "company_name": extra.get("company_name", ""),
        "logo": None,
        "hide_location": False,
        "favorite_crew": [],
        "profile_views": 0,
    }


async def seed_accounts():
    """Seed demo accounts if they don't exist."""

    if not await db.users.find_one({"email": "superadmin@punchlistjobs.com"}):
        doc = base_user("superadmin@punchlistjobs.com", "SuperAdmin@123", "superadmin",
                        "Super Administrator", is_online=True)
        await db.users.insert_one(doc)
        logger.info("SuperAdmin created")

    if not await db.users.find_one({"email": "admin@punchlistjobs.com"}):
        doc = base_user("admin@punchlistjobs.com", "Admin@123", "admin",
                        "Platform Admin", is_online=True)
        await db.users.insert_one(doc)
        logger.info("Admin created")

    if not await db.users.find_one({"email": "subadmin@punchlistjobs.com"}):
        doc = base_user("subadmin@punchlistjobs.com", "SubAdmin@123", "subadmin",
                        "Sub Administrator", is_online=False)
        await db.users.insert_one(doc)
        logger.info("SubAdmin created")

    crew_seeds = [
        {"email": "crew1@punchlistjobs.com", "password": "Crew@123", "name": "Marcus Johnson",
         "trade": "Carpentry", "discipline": "CARPENTRY", "skills": ["Framing", "Drywall", "Finishing"], "bio": "10 years of carpentry experience",
         "phone": "555-101-0001", "rating": 4.8, "rating_count": 24, "jobs_completed": 47, "is_online": True,
         "location": {"lat": 33.7490, "lng": -84.3880, "city": "Atlanta"}, "points": 2350, "availability": True},
        {"email": "crew2@punchlistjobs.com", "password": "Crew@123", "name": "Darius Williams",
         "trade": "Electrical", "discipline": "ELECTRICAL", "skills": ["Wiring", "Panel Install", "Lighting"], "bio": "Licensed electrician, residential & commercial",
         "phone": "555-101-0002", "rating": 4.9, "rating_count": 31, "jobs_completed": 62, "is_online": False,
         "location": {"lat": 33.8490, "lng": -84.2880, "city": "Decatur"}, "points": 3100, "availability": True},
        {"email": "crew3@punchlistjobs.com", "password": "Crew@123", "name": "Andre Thomas",
         "trade": "Plumbing", "discipline": "PLUMBING", "skills": ["Pipe Installation", "Leak Repair", "Fixture Install"], "bio": "Master plumber with 15 years",
         "phone": "555-101-0003", "rating": 4.7, "rating_count": 18, "jobs_completed": 33, "is_online": True,
         "location": {"lat": 33.6490, "lng": -84.4880, "city": "Marietta"}, "points": 1650, "availability": True},
        {"email": "crew4@punchlistjobs.com", "password": "Crew@123", "name": "Kevin Brown",
         "trade": "General Labor", "discipline": "GENERAL LABOR", "skills": ["Demo", "Clean-up", "Moving", "Hauling"], "bio": "Reliable and hardworking",
         "phone": "555-101-0004", "rating": 4.5, "rating_count": 12, "jobs_completed": 28, "is_online": False,
         "location": {"lat": 33.9490, "lng": -84.1880, "city": "Smyrna"}, "points": 1400, "availability": True},
        {"email": "crew5@punchlistjobs.com", "password": "Crew@123", "name": "Terrence Davis",
         "trade": "HVAC", "discipline": "HVAC", "skills": ["AC Install", "Ductwork", "Refrigerant"], "bio": "EPA certified HVAC technician",
         "phone": "555-101-0005", "rating": 4.6, "rating_count": 15, "jobs_completed": 29, "is_online": True,
         "location": {"lat": 33.7790, "lng": -84.3580, "city": "Atlanta"}, "points": 1450, "availability": False},
    ]

    for c in crew_seeds:
        if not await db.users.find_one({"email": c["email"]}):
            doc = base_user(c["email"], c["password"], "crew", c["name"],
                            trade=c["trade"], skills=c["skills"], bio=c["bio"],
                            phone=c["phone"], rating=c["rating"], rating_count=c["rating_count"],
                            jobs_completed=c["jobs_completed"], is_online=c["is_online"],
                            location=c["location"], points=c["points"], availability=c["availability"])
            await db.users.insert_one(doc)

    contractor_seeds = [
        {"email": "contractor1@punchlistjobs.com", "password": "Contractor@123",
         "name": "Robert BuildCo", "company_name": "BuildCo Construction",
         "trade": "General Contracting", "bio": "Full-service construction company",
         "phone": "555-200-0001", "is_online": True,
         "location": {"lat": 33.7490, "lng": -84.3880, "city": "Atlanta"}},
        {"email": "contractor2@punchlistjobs.com", "password": "Contractor@123",
         "name": "Sarah Renovate Pro", "company_name": "Renovate Pro LLC",
         "trade": "Renovation", "bio": "Residential renovation specialists",
         "phone": "555-200-0002", "is_online": False,
         "location": {"lat": 33.8490, "lng": -84.2880, "city": "Decatur"}},
        {"email": "contractor3@punchlistjobs.com", "password": "Contractor@123",
         "name": "James Elite Build", "company_name": "Elite Build Group",
         "trade": "Commercial Construction", "bio": "Commercial & industrial projects",
         "phone": "555-200-0003", "is_online": True,
         "location": {"lat": 33.6490, "lng": -84.4880, "city": "Marietta"}},
    ]

    for c in contractor_seeds:
        if not await db.users.find_one({"email": c["email"]}):
            doc = base_user(c["email"], c["password"], "contractor", c["name"],
                            company_name=c["company_name"], trade=c["trade"], bio=c["bio"],
                            phone=c["phone"], is_online=c["is_online"], location=c["location"])
            await db.users.insert_one(doc)


async def hide_old_completed_jobs():
    try:
        settings = await db.settings.find_one({}, {"_id": 0})
        hours = settings.get("job_visibility_hours", 12) if settings else 12
        cutoff = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()
        result = await db.jobs.update_many(
            {"status": "completed", "completed_at": {"$lt": cutoff}, "is_hidden": {"$ne": True}},
            {"$set": {"is_hidden": True}}
        )
        if result.modified_count > 0:
            logger.info(f"Cron: hid {result.modified_count} completed jobs older than {hours}h")
    except Exception as e:
        logger.error(f"Cron job error: {e}")


async def expire_emergency_jobs():
    try:
        cutoff = (datetime.now(timezone.utc) - timedelta(minutes=30)).isoformat()
        result = await db.jobs.update_many(
            {"is_emergency": True, "status": "open", "created_at": {"$lt": cutoff}},
            {"$set": {"status": "expired", "is_hidden": True}}
        )
        if result.modified_count > 0:
            logger.info(f"Cron: expired {result.modified_count} emergency jobs")
    except Exception as e:
        logger.error(f"Emergency expiry cron error: {e}")


async def auto_start_jobs():
    """Auto-start fulfilled jobs whose start_time has passed."""
    try:
        from utils.notify import create_notification
        now = datetime.now(timezone.utc).isoformat()
        jobs = await db.jobs.find(
            {"status": "fulfilled", "start_time": {"$lte": now}, "started_at": {"$exists": False}},
            {"_id": 0}
        ).to_list(50)
        for job in jobs:
            await db.jobs.update_one({"id": job["id"]}, {"$set": {"status": "in_progress", "started_at": now}})
            for crew_id in job.get("crew_accepted", []):
                await create_notification(crew_id, "job_started", "Job Started",
                    f"'{job['title']}' has started automatically. Proceed to the job site.")
        if jobs:
            logger.info(f"Auto-started {len(jobs)} job(s)")
    except Exception as e:
        logger.error(f"Auto-start jobs cron error: {e}")


async def auto_status_jobs():
    """Time-based job status automation for idle open jobs with no crew accepted.
    24h → suspended | 48h → cancelled | 72h → archived
    Only acts on jobs with no accepted crew (never disrupts active workflows).
    """
    try:
        now_utc = datetime.now(timezone.utc)
        cutoff_24h = (now_utc - timedelta(hours=24)).isoformat()
        cutoff_48h = (now_utc - timedelta(hours=48)).isoformat()
        cutoff_72h = (now_utc - timedelta(hours=72)).isoformat()

        idle = {"crew_accepted": {"$size": 0}, "is_archived": {"$ne": True}}

        r1 = await db.jobs.update_many(
            {**idle, "status": "open", "created_at": {"$lt": cutoff_24h}},
            {"$set": {"status": "suspended"}},
        )
        r2 = await db.jobs.update_many(
            {**idle, "status": "suspended", "created_at": {"$lt": cutoff_48h}},
            {"$set": {"status": "cancelled"}},
        )
        r3 = await db.jobs.update_many(
            {**idle, "status": "cancelled", "created_at": {"$lt": cutoff_72h}},
            {"$set": {"is_archived": True, "status": "cancelled"}},
        )
        total = r1.modified_count + r2.modified_count + r3.modified_count
        if total:
            logger.info(f"auto_status_jobs: suspended={r1.modified_count} cancelled={r2.modified_count} archived={r3.modified_count}")
    except Exception as e:
        logger.error(f"auto_status_jobs cron error: {e}")


_SEED_TRADES = [
    {"name": "Carpentry",     "trades": ["Framing", "Rough Carpentry", "Finish Carpentry", "Cabinet Making", "Deck Building", "Drywall Hanging"]},
    {"name": "Electrical",    "trades": ["Wiring", "Panel Install", "Lighting", "Low Voltage", "Solar Install"]},
    {"name": "Plumbing",      "trades": ["Pipe Installation", "Leak Repair", "Fixture Install", "Gas Lines", "Drain Cleaning"]},
    {"name": "HVAC",          "trades": ["AC Install", "Ductwork", "Refrigerant", "Heat Pump", "Ventilation"]},
    {"name": "Painting",      "trades": ["Interior Painting", "Exterior Painting", "Staining", "Wallpaper", "Drywall Finishing"]},
    {"name": "Landscaping",   "trades": ["Lawn Care", "Hardscaping", "Irrigation", "Tree Trimming", "Grading"]},
    {"name": "Masonry",       "trades": ["Brickwork", "Stonework", "Concrete Work", "Block Laying", "Stucco"]},
    {"name": "Roofing",       "trades": ["Shingle Install", "Flat Roofing", "Gutters", "Skylight Install", "Roof Repair"]},
    {"name": "General Labor", "trades": ["Demo", "Clean-up", "Moving", "Hauling", "Site Prep", "Material Handling"]},
    {"name": "Flooring",      "trades": ["Hardwood", "Tile Setting", "Carpet Install", "LVP Install", "Refinishing"]},
]


async def migrate_crew_assignments():
    """
    Idempotent migration: create CrewAssignment for every crew member
    already accepted into a job. Maps existing crew_submitted_at → pending_complete.
    """
    from utils.assignment_helpers import log_status_history as _log
    now = datetime.now(timezone.utc).isoformat()
    jobs = await db.jobs.find(
        {"crew_accepted": {"$exists": True, "$ne": []}}, {"_id": 0}
    ).to_list(5000)
    created = 0
    for job in jobs:
        job_id = job["id"]
        submitted = job.get("crew_submitted_at", {}) or {}
        for crew_id in job.get("crew_accepted", []):
            existing = await db.crew_assignments.find_one({"job_id": job_id, "crew_id": crew_id})
            if existing:
                continue
            # Determine status from legacy data
            if job["status"] in ("completed", "cancelled", "suspended", "archived", "past"):
                status = "approved_complete"
            elif crew_id in submitted:
                status = "pending_complete"
            else:
                status = "assigned"
            doc = {
                "id": str(uuid.uuid4()),
                "job_id": job_id,
                "crew_id": crew_id,
                "status": status,
                "pending_complete_at": submitted.get(crew_id) if status == "pending_complete" else None,
                "last_contractor_action_at": None,
                "approved_at": now if status == "approved_complete" else None,
                "created_at": job.get("created_at", now),
                "updated_at": now,
            }
            try:
                await db.crew_assignments.insert_one(doc)
                created += 1
            except Exception:
                pass
    if created:
        logger.info(f"Migration: created {created} CrewAssignments from legacy data")

    # Migrate jobs in completed_pending_review → pending_complete
    r = await db.jobs.update_many(
        {"status": "completed_pending_review"},
        {"$set": {"status": "pending_complete"}}
    )
    if r.modified_count:
        logger.info(f"Migration: {r.modified_count} jobs completed_pending_review → pending_complete")


async def auto_approve_pending_crew():
    """
    72-hour rule: auto-approve crew whose completion has been pending > 72h
    with no contractor action. Spec §3.
    """
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=72)).isoformat()
    from utils.assignment_helpers import log_status_history as _log, maybe_complete_job as _complete

    to_approve = await db.crew_assignments.find(
        {"status": "pending_complete", "$or": [
            {"last_contractor_action_at": None,   "pending_complete_at": {"$lt": cutoff}},
            {"last_contractor_action_at": {"$lt": cutoff}},
        ]},
        {"_id": 0}
    ).to_list(500)

    if not to_approve:
        return

    now = datetime.now(timezone.utc).isoformat()
    affected_jobs: set[str] = set()
    for a in to_approve:
        await db.crew_assignments.update_one(
            {"id": a["id"]},
            {"$set": {"status": "approved_complete", "approved_at": now, "updated_at": now}},
        )
        await _log(
            job_id=a["job_id"], entity_type="crew_assignment",
            from_status="pending_complete", to_status="approved_complete",
            actor_id="system", actor_type="system",
            crew_assignment_id=a["id"],
        )
        affected_jobs.add(a["job_id"])
        logger.info(f"[AutoApprove] assignment={a['id']} crew={a['crew_id']} job={a['job_id']}")

    for job_id in affected_jobs:
        await _complete(job_id, actor_id="system")


async def seed_trades():
    """Idempotent seed: insert disciplines/trades/skills. Migrates existing trades to add skills."""
    from discipline_data import DISCIPLINE_TREE
    for entry in DISCIPLINE_TREE:
        cat = await db.trade_categories.find_one({"name": entry["name"]})
        if not cat:
            cat_id = str(uuid.uuid4())
            now = datetime.now(timezone.utc).isoformat()
            await db.trade_categories.insert_one({
                "id": cat_id, "name": entry["name"],
                "slug": entry["name"].lower().replace(" ", "-"),
                "is_active": True, "created_at": now,
            })
        else:
            cat_id = cat["id"]

        for trade_data in entry.get("trades", []):
            trade_name = trade_data["name"] if isinstance(trade_data, dict) else trade_data
            skills = trade_data.get("skills", []) if isinstance(trade_data, dict) else []
            existing = await db.trades.find_one({"category_id": cat_id, "name": trade_name})
            if not existing:
                now = datetime.now(timezone.utc).isoformat()
                await db.trades.insert_one({
                    "id": str(uuid.uuid4()), "name": trade_name,
                    "category_id": cat_id, "category_name": entry["name"],
                    "is_active": True, "created_at": now, "skills": skills,
                })
            elif skills and not existing.get("skills"):
                # Migrate: add skills to trades that were seeded before skills existed
                await db.trades.update_one({"id": existing["id"]}, {"$set": {"skills": skills}})


@app.on_event("startup")
async def startup_event():
    try:
        await db.users.create_index("email", unique=True)
        await db.users.create_index("referral_code", sparse=True)
        await db.users.create_index("is_online")
        await db.users.create_index([("location_geo", "2dsphere")], sparse=True)
        await db.jobs.create_index("status")
        await db.jobs.create_index("contractor_id")
        await db.jobs.create_index("created_at")
        await db.jobs.create_index([("location_geo", "2dsphere")], sparse=True)
        await db.jobs.create_index([("completed_at", 1), ("status", 1)])
        await db.crew_requests.create_index([("crew_id", 1), ("status", 1)])
        await db.crew_requests.create_index([("contractor_id", 1)])
        await db.activity_logs.create_index("created_at")
        await db.activity_logs.create_index("category")
        await db.activity_logs.create_index("actor_id")
        await db.activity_logs.create_index("target_id")
        # CrewAssignment indices (unique constraint + fast lookup)
        await db.crew_assignments.create_index(
            [("job_id", 1), ("crew_id", 1)], unique=True
        )
        await db.crew_assignments.create_index([("job_id", 1), ("status", 1)])
        await db.crew_assignments.create_index("status")
        await db.crew_assignments.create_index("pending_complete_at")
        # StatusHistory indices (append-only audit log)
        await db.status_history.create_index([("job_id", 1), ("timestamp", -1)])
        await db.status_history.create_index("entity_type")
        logger.info("Database indexes created")
    except Exception as e:
        logger.warning(f"Index creation: {e}")

    # Migrate: ensure profile_views field exists
    try:
        result = await db.users.update_many(
            {"profile_views": {"$exists": False}},
            {"$set": {"profile_views": 0}}
        )
        if result.modified_count:
            logger.info(f"Migration: added profile_views to {result.modified_count} users")
    except Exception as e:
        logger.warning(f"profile_views migration: {e}")

    # Migrate first_name/last_name from existing name
    try:
        users_without_fn = await db.users.find(
            {"first_name": {"$exists": False}}, {"_id": 0, "id": 1, "name": 1}
        ).to_list(10000)
        for u in users_without_fn:
            parts = (u.get("name") or "").strip().split(" ", 1)
            await db.users.update_one({"id": u["id"]}, {"$set": {
                "first_name": parts[0] if parts else "",
                "last_name": parts[1] if len(parts) > 1 else "",
            }})
        if users_without_fn:
            logger.info(f"Migration: split names for {len(users_without_fn)} users")
    except Exception as e:
        logger.warning(f"first_name/last_name migration: {e}")

    # Seed accounts
    await seed_accounts()
    # Migrate legacy data → CrewAssignment collection
    await migrate_crew_assignments()

    # Init default settings (including site_name/tagline + lighter blue defaults)
    existing_settings = await db.settings.find_one({})
    if not existing_settings:
        await db.settings.insert_one({
            "daily_price": 1.99,
            "weekly_price": 9.99,
            "monthly_price": 29.99,
            "annual_price": 179.94,
            "trial_days": 30,
            "annual_trial_days": 180,
            "job_visibility_hours": 12,
            "emergency_expiry_minutes": 30,
            "cashapp_cashtag": os.environ.get("CASHAPP_CASHTAG", "punchlistjobs"),
            "social_linkedin_enabled": True,
            "social_twitter_enabled": True,
            "social_facebook_enabled": True,
            "social_native_share_enabled": True,
            "free_crew_responses_per_month": 3,
            "free_contractor_posts_per_month": 2,
            "accent_color": "#38BDF8",
            "brand_color": "#2563EB",
            "nav_bg_color": "#1D4ED8",
            "site_name": "PunchListJobs",
            "tagline": "A Blue Collar ME Company",
            "show_travel_distance": True,
        })
        logger.info("Default settings created")
    else:
        updates = {}
        if not existing_settings.get("annual_price"):
            updates["annual_price"] = 179.94
        if "free_crew_responses_per_month" not in existing_settings:
            updates["free_crew_responses_per_month"] = 3
        if "free_contractor_posts_per_month" not in existing_settings:
            updates["free_contractor_posts_per_month"] = 2
        if "accent_color" not in existing_settings:
            updates["accent_color"] = "#38BDF8"
        if "brand_color" not in existing_settings:
            updates["brand_color"] = "#2563EB"
        if "nav_bg_color" not in existing_settings:
            updates["nav_bg_color"] = "#1D4ED8"
        if "site_name" not in existing_settings:
            updates["site_name"] = "PunchListJobs"
        if "tagline" not in existing_settings:
            updates["tagline"] = "A Blue Collar ME Company"
        if "show_travel_distance" not in existing_settings:
            updates["show_travel_distance"] = True
        if updates:
            await db.settings.update_one({}, {"$set": updates})

    scheduler.add_job(hide_old_completed_jobs, "interval", hours=1, id="hide_jobs_cron", replace_existing=True)
    scheduler.add_job(expire_emergency_jobs, "interval", minutes=15, id="emergency_expiry_cron", replace_existing=True)
    scheduler.add_job(auto_start_jobs, "interval", minutes=5, id="auto_start_jobs_cron", replace_existing=True)
    scheduler.add_job(auto_status_jobs, "interval", hours=1, id="auto_status_jobs_cron", replace_existing=True)
    scheduler.add_job(auto_approve_pending_crew, "interval", hours=2, id="auto_approve_crew_cron", replace_existing=True)
    scheduler.start()

    await seed_trades()

    logger.info("PunchListJobs API started successfully")
    logger.info("  SuperAdmin: superadmin@punchlistjobs.com / SuperAdmin@123")
    logger.info("  Admin:      admin@punchlistjobs.com / Admin@123")
    logger.info("  Crew:       crew1@punchlistjobs.com / Crew@123")
    logger.info("  Contractor: contractor1@punchlistjobs.com / Contractor@123")


@app.on_event("shutdown")
async def shutdown_db_client():
    scheduler.shutdown(wait=False)
    client.close()
