import uuid
from pathlib import Path
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Depends, Query, UploadFile, File
from typing import List
from database import db
from auth import get_current_user, user_to_response
from models import JobCreate, JobUpdate, RatingCreate, SkipRatingRequest, TaskCheckRequest, DisputeCreate, OfferCreate, OfferCounter
from utils.geocoding import geocode_address, haversine_distance
from utils.email_utils import send_job_completion_email
from utils.matching import sort_jobs_for_crew
from utils.subscription import check_and_enforce_limit, increment_usage
from utils.notify import create_notification
from utils.activity_log import log_activity
from utils.job_helpers import (
    assert_rating_allowed, assert_rating_status, assert_job_participant,
    assert_stars_valid, RATING_VALID_STATUSES, ACTIVE_STATUSES, STALE_STATUSES,
)
from utils.assignment_helpers import (
    get_assignment, get_or_create_assignment, update_assignment_status,
    log_status_history, maybe_complete_job, force_close_assignments,
)
from typing import Optional
import logging

router = APIRouter()
logger = logging.getLogger(__name__)


def now_str():
    return datetime.now(timezone.utc).isoformat()


@router.post("/", status_code=201)
async def create_job(data: JobCreate, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "contractor":
        raise HTTPException(status_code=403, detail="Only contractors can post jobs")
    if not data.description.strip():
        raise HTTPException(status_code=400, detail="Description is required")
    await check_and_enforce_limit(current_user, "post")

    # Geocode the address
    location = await geocode_address(data.address)

    job_doc = {
        "id": str(uuid.uuid4()),
        "contractor_id": current_user["id"],
        "contractor_name": current_user.get("company_name") or current_user["name"],
        "title": data.title,
        "description": data.description,
        "trade": data.trade,
        "discipline": data.discipline or "",
        "skill": data.skill or "",
        "crew_needed": data.crew_needed,
        "crew_accepted": [],
        "crew_pending": [],
        "start_time": data.start_time,
        "pay_rate": data.pay_rate,
        "address": data.address,
        "location": location,
        "status": "open",
        "is_emergency": data.is_emergency,
        "is_boosted": data.is_boosted,
        "tasks": [t.strip() for t in data.tasks if t.strip()],
        "images": [],
        "task_completions": {},
        "crew_submitted_at": {},
        "created_at": now_str(),
        "completed_at": None,
        "rated_crew": [],
        "rated_by_crew": [],
        "skipped_ratings": [],
    }

    await db.jobs.insert_one(job_doc)
    await increment_usage(current_user["id"])

    # Broadcast via WebSocket
    try:
        from routes.ws_routes import manager
        await manager.broadcast_new_job(job_doc)
    except Exception as e:
        logger.warning(f"WS broadcast failed: {e}")

    return {k: v for k, v in job_doc.items() if k != "_id"}


@router.get("/")
@router.get("")
async def list_jobs(
    status: Optional[str] = None,
    trade: Optional[str] = None,
    discipline: Optional[str] = None,
    skill: Optional[str] = None,
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    radius: Optional[float] = 25,
    smart_match: Optional[bool] = False,
    current_user: dict = Depends(get_current_user)
):
    query = {"is_hidden": {"$ne": True}, "is_archived": {"$ne": True}}

    if current_user["role"] == "contractor":
        # Contractors only see their own jobs
        query["contractor_id"] = current_user["id"]
    else:
        # Crew sees only open jobs (fulfilled = fully staffed, belongs in Itinerary)
        if status:
            query["status"] = status
        else:
            query["status"] = "open"

    if trade:
        query["trade"] = trade
    if discipline:
        query["discipline"] = {"$regex": discipline, "$options": "i"}
    if skill:
        query["skill"] = {"$regex": skill, "$options": "i"}

    jobs = await db.jobs.find(query, {"_id": 0}).sort("created_at", -1).to_list(200)

    # Filter by radius if location provided
    if lat and lng:
        jobs = [j for j in jobs if j.get("location") and haversine_distance(
            lat, lng, j["location"]["lat"], j["location"]["lng"]
        ) <= radius]

    # Smart matching for crew: weighted distance + trade + skills
    if smart_match and current_user["role"] == "crew" and jobs:
        jobs = sort_jobs_for_crew(
            jobs,
            current_user,
            lat if (lat and lng) else None,
            lng if (lat and lng) else None,
            radius,
        )

    return jobs


@router.get("/archive")
async def list_archived_jobs(current_user: dict = Depends(get_current_user)):
    """Return archived jobs. Contractors see own; crew see jobs they archived or were on; admins see all."""
    if current_user["role"] in ("admin", "superadmin"):
        query = {"is_archived": True}
    elif current_user["role"] == "contractor":
        query = {"is_archived": True, "contractor_id": current_user["id"]}
    elif current_user["role"] == "crew":
        uid = current_user["id"]
        # Crew sees: contractor-archived jobs they were accepted for + jobs they independently archived
        query = {"$and": [
            {"crew_accepted": uid},
            {"$or": [{"is_archived": True}, {"crew_archived": uid}]}
        ]}
    else:
        raise HTTPException(status_code=403, detail="Not authorized to view archive")
    jobs = await db.jobs.find(query, {"_id": 0}).sort("archived_at", -1).to_list(200)
    return jobs


@router.get("/my-jobs")
async def my_jobs(current_user: dict = Depends(get_current_user)):
    if current_user["role"] == "contractor":
        jobs = await db.jobs.find({"contractor_id": current_user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
        return jobs
    uid = current_user["id"]
    accepted = await db.jobs.find({"crew_accepted": uid}, {"_id": 0}).sort("created_at", -1).to_list(100)
    for j in accepted:
        j["my_status"] = "accepted"
    pending = await db.jobs.find(
        {"crew_pending": uid, "crew_accepted": {"$not": {"$elemMatch": {"$eq": uid}}}},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    for j in pending:
        j["my_status"] = "pending"
    return accepted + pending


@router.get("/itinerary")
async def jobs_itinerary(current_user: dict = Depends(get_current_user)):
    """Return jobs with confirmed crew-contractor agreements for the itinerary view."""
    uid = current_user["id"]
    role = current_user["role"]
    active_statuses = ACTIVE_STATUSES

    # ── Auto-archive stale terminal jobs (lazy eval) ───────────────────────────
    AUTO_ARCHIVE_HOURS = 48
    threshold = (datetime.now(timezone.utc) - timedelta(hours=AUTO_ARCHIVE_HOURS)).isoformat()
    await db.jobs.update_many(
        {"status": {"$in": STALE_STATUSES}, "is_archived": {"$ne": True},
         "status_changed_at": {"$exists": True, "$lt": threshold}},
        [{"$set": {"is_archived": True, "archived_at": datetime.now(timezone.utc).isoformat(),
                   "archived_by": "system", "pre_archive_status": "$status", "status": "archived"}}]
    )

    if role == "crew":
        query = {"crew_accepted": uid, "status": {"$in": active_statuses},
                 "is_archived": {"$ne": True}, "crew_archived": {"$ne": uid}}
    elif role == "contractor":
        query = {"contractor_id": uid, "crew_accepted": {"$exists": True, "$ne": []},
                 "status": {"$in": active_statuses}, "is_archived": {"$ne": True}}
    else:
        query = {"status": {"$in": active_statuses}, "is_archived": {"$ne": True}}

    jobs = await db.jobs.find(query, {"_id": 0}).sort("start_time", 1).to_list(200)

    # Fetch all assignments for these jobs in bulk
    job_ids = [j["id"] for j in jobs]
    all_assignments = await db.crew_assignments.find(
        {"job_id": {"$in": job_ids}}, {"_id": 0}
    ).to_list(2000)
    assignments_by_job: dict[str, list] = {}
    for a in all_assignments:
        assignments_by_job.setdefault(a["job_id"], []).append(a)

    enriched = []
    for job in jobs:
        job_id = job["id"]
        job_assignments = assignments_by_job.get(job_id, [])

        # Per-crew: attach assignment map for frontend consumption
        assignment_map = {a["crew_id"]: a for a in job_assignments}
        job["crew_assignments"] = job_assignments

        # For crew: attach their own assignment status
        if role == "crew":
            my_a = assignment_map.get(uid)
            job["my_assignment_status"] = my_a["status"] if my_a else "assigned"
            # Per-spec: hide if removed
            if my_a and my_a["status"] == "removed":
                continue

        contractor = await db.users.find_one(
            {"id": job["contractor_id"]},
            {"_id": 0, "id": 1, "name": 1, "phone": 1, "email": 1, "company_name": 1}
        )
        job["contractor_profile"] = contractor or {}

        crew_profiles = []
        for crew_id in job.get("crew_accepted", []):
            crew = await db.users.find_one(
                {"id": crew_id}, {"_id": 0, "id": 1, "name": 1, "trade": 1, "discipline": 1, "phone": 1}
            )
            if crew:
                a = assignment_map.get(crew_id)
                crew["assignment_status"] = a["status"] if a else "assigned"
                crew_profiles.append(crew)
        job["crew_profiles"] = crew_profiles
        enriched.append(job)

    return enriched


@router.post("/{job_id}/cancel-notify")
async def cancel_notify(job_id: str, current_user: dict = Depends(get_current_user)):
    """Crew submits a cancel request — contractor must accept (re-list) or deny."""
    if current_user["role"] != "crew":
        raise HTTPException(status_code=403, detail="Only crew can use this action")
    job = await db.jobs.find_one({"id": job_id}, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if current_user["id"] not in job.get("crew_accepted", []):
        raise HTTPException(status_code=403, detail="Not assigned to this job")

    request = {"crew_id": current_user["id"], "crew_name": current_user["name"], "ts": now_str()}
    await db.jobs.update_one({"id": job_id}, {"$push": {"cancel_requests": request}})

    await create_notification(
        job["contractor_id"], "crew_cancel_notify", "Cancel Request",
        f"{current_user['name']} requested to cancel from '{job['title']}'. Accept or Deny."
    )
    try:
        from routes.ws_routes import manager
        await manager.send_to_user(job["contractor_id"], {
            "type": "crew_cancel_request", "job_id": job_id, "job_title": job["title"],
            "crew_id": current_user["id"], "crew_name": current_user["name"]
        })
    except Exception:
        pass
    return {"message": "Cancel request sent to contractor"}


@router.post("/{job_id}/cancel-requests/{crew_id}/accept")
async def accept_cancel_request(job_id: str, crew_id: str, current_user: dict = Depends(get_current_user)):
    """Contractor accepts cancel request — removes crew and re-lists job."""
    if current_user["role"] != "contractor":
        raise HTTPException(status_code=403, detail="Only contractors can respond to cancel requests")
    job = await db.jobs.find_one({"id": job_id}, {"_id": 0})
    if not job or job["contractor_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    new_accepted = [c for c in job.get("crew_accepted", []) if c != crew_id]
    new_requests = [r for r in job.get("cancel_requests", []) if r.get("crew_id") != crew_id]
    await db.jobs.update_one({"id": job_id}, {"$set": {
        "crew_accepted": new_accepted, "status": "open", "cancel_requests": new_requests
    }})
    await create_notification(crew_id, "cancel_accepted", "Cancel Approved",
        f"Your cancel request for '{job['title']}' was approved. Job re-listed.")
    try:
        from routes.ws_routes import manager
        await manager.send_to_user(crew_id, {"type": "cancel_accepted", "job_title": job["title"]})
    except Exception:
        pass
    return {"message": "Cancel accepted, job re-listed"}


@router.post("/{job_id}/cancel-requests/{crew_id}/deny")
async def deny_cancel_request(job_id: str, crew_id: str, current_user: dict = Depends(get_current_user)):
    """Contractor denies cancel request — crew remains on job."""
    if current_user["role"] != "contractor":
        raise HTTPException(status_code=403, detail="Only contractors can respond")
    job = await db.jobs.find_one({"id": job_id}, {"_id": 0})
    if not job or job["contractor_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    new_requests = [r for r in job.get("cancel_requests", []) if r.get("crew_id") != crew_id]
    await db.jobs.update_one({"id": job_id}, {"$set": {"cancel_requests": new_requests}})
    await create_notification(crew_id, "cancel_denied", "Cancel Request Denied",
        f"Your cancel request for '{job['title']}' was denied. You remain assigned.")
    try:
        from routes.ws_routes import manager
        await manager.send_to_user(crew_id, {"type": "cancel_denied", "job_title": job["title"]})
    except Exception:
        pass
    return {"message": "Cancel request denied"}


@router.post("/{job_id}/request-suspend")
async def request_suspend(job_id: str, current_user: dict = Depends(get_current_user)):
    """Crew requests a job suspension — contractor must approve via Suspend."""
    if current_user["role"] != "crew":
        raise HTTPException(status_code=403, detail="Only crew can request suspension")
    job = await db.jobs.find_one({"id": job_id}, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if current_user["id"] not in job.get("crew_accepted", []):
        raise HTTPException(status_code=403, detail="Not assigned to this job")
    await create_notification(
        job["contractor_id"], "suspend_request", "Suspension Request",
        f"{current_user['name']} has requested suspension of '{job['title']}'. Review and approve if needed."
    )
    return {"message": "Suspension request sent to contractor"}


@router.get("/{job_id}/share")
async def share_job_public(job_id: str):
    """Publicly accessible endpoint — returns sanitized job data for sharing.
    No auth required. Never returns exact address, contact info, or coordinates.
    """
    job = await db.jobs.find_one({"id": job_id}, {"_id": 0})
    if not job or job.get("is_archived") or job.get("is_hidden"):
        raise HTTPException(status_code=404, detail="Job not found or unavailable")
    loc = job.get("location") or {}
    crew_accepted_count = len(job.get("crew_accepted", []))
    return {
        "id": job["id"],
        "title": job["title"],
        "description": job.get("description", ""),
        "trade": job.get("trade", ""),
        "pay_rate": job.get("pay_rate", 0),
        "crew_needed": job.get("crew_needed", 1),
        "crew_accepted_count": crew_accepted_count,
        "is_full": crew_accepted_count >= job.get("crew_needed", 1),
        "status": job.get("status", "open"),
        "is_emergency": job.get("is_emergency", False),
        "start_time": job.get("start_time"),
        "city": loc.get("city", ""),
        "state": loc.get("state", ""),
        "created_at": job.get("created_at", ""),
    }


@router.get("/{job_id}")
async def get_job(job_id: str, current_user: dict = Depends(get_current_user)):
    job = await db.jobs.find_one({"id": job_id}, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.put("/{job_id}")
async def update_job(job_id: str, data: JobUpdate, current_user: dict = Depends(get_current_user)):
    job = await db.jobs.find_one({"id": job_id})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job["contractor_id"] != current_user["id"] and current_user["role"] not in ("admin", "superadmin"):
        raise HTTPException(status_code=403, detail="Not authorized")

    update = {k: v for k, v in data.model_dump().items() if v is not None}

    # Re-geocode if address changed
    if "address" in update:
        location = await geocode_address(update["address"])
        update["location"] = location

    if update:
        await db.jobs.update_one({"id": job_id}, {"$set": update})

    # Notify crew members of the update
    for crew_id in job.get("crew_accepted", []):
        await create_notification(
            crew_id, "job_updated", "Job Updated",
            f"The job '{job['title']}' has been updated by the contractor."
        )

    await log_activity(
        actor=current_user, action="job.updated", category="job",
        target_id=job_id, target_type="job", details={"fields": list(update.keys())}
    )
    return {"message": "Job updated"}


@router.delete("/{job_id}")
async def delete_job(job_id: str, current_user: dict = Depends(get_current_user)):
    """Soft-delete: moves job to archive instead of permanent removal."""
    job = await db.jobs.find_one({"id": job_id})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job["contractor_id"] != current_user["id"] and current_user["role"] not in ("admin", "superadmin"):
        raise HTTPException(status_code=403, detail="Not authorized")
    now = datetime.now(timezone.utc).isoformat()
    await db.jobs.update_one({"id": job_id}, {"$set": {
        "is_archived": True,
        "archived_at": now,
        "archived_by": current_user["id"],
        "is_hidden": True,
        "status": "archived",
    }})
    await log_activity(
        actor=current_user, action="job.archived", category="job",
        target_id=job_id, target_type="job", details={"title": job.get("title")}
    )
    return {"message": "Job archived"}


@router.post("/{job_id}/archive")
async def archive_job(job_id: str, current_user: dict = Depends(get_current_user)):
    """Explicitly archive a job (e.g. after cancel). Crew who were accepted can also archive completed/past jobs."""
    job = await db.jobs.find_one({"id": job_id})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    is_contractor = job["contractor_id"] == current_user["id"]
    is_admin = current_user["role"] in ("admin", "superadmin")
    # Crew can archive completed/past jobs they were part of
    is_accepted_crew = (
        current_user["role"] == "crew"
        and current_user["id"] in job.get("crew_accepted", [])
        and job.get("status") in ("completed", "past")
    )
    if is_accepted_crew:
        # Crew archives their own view only — does NOT affect the contractor's job record
        if current_user["id"] in job.get("crew_archived", []):
            raise HTTPException(status_code=400, detail="Already archived from your view")
        await db.jobs.update_one(
            {"id": job_id},
            {"$addToSet": {"crew_archived": current_user["id"]}}
        )
        await log_activity(
            actor=current_user, action="job.crew_archived", category="job",
            target_id=job_id, target_type="job", details={"title": job.get("title")}
        )
        return {"message": "Job archived from your view"}

    if not (is_contractor or is_admin):
        raise HTTPException(status_code=403, detail="Not authorized")
    if job.get("is_archived"):
        raise HTTPException(status_code=400, detail="Job is already archived")
    now = datetime.now(timezone.utc).isoformat()
    await db.jobs.update_one({"id": job_id}, {"$set": {
        "is_archived": True,
        "archived_at": now,
        "archived_by": current_user["id"],
        "pre_archive_status": job.get("status", "open"),
        "is_hidden": True,
        "status": "archived",
    }})
    await log_activity(
        actor=current_user, action="job.archived", category="job",
        target_id=job_id, target_type="job", details={"title": job.get("title")}
    )
    return {"message": "Job archived"}


@router.post("/{job_id}/unarchive")
async def unarchive_job(job_id: str, current_user: dict = Depends(get_current_user)):
    """Restore an archived job back to active state."""
    job = await db.jobs.find_one({"id": job_id})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job["contractor_id"] != current_user["id"] and current_user["role"] not in ("admin", "superadmin"):
        raise HTTPException(status_code=403, detail="Not authorized")
    if not job.get("is_archived"):
        raise HTTPException(status_code=400, detail="Job is not archived")
    restore_status = job.get("pre_archive_status") or "open"
    if restore_status in ("archived", "cancelled", "completed"):
        restore_status = "open"
    await db.jobs.update_one({"id": job_id}, {"$set": {
        "is_archived": False,
        "is_hidden": False,
        "status": restore_status,
    }, "$unset": {"archived_at": "", "archived_by": "", "pre_archive_status": ""}})
    await log_activity(
        actor=current_user, action="job.unarchived", category="job",
        target_id=job_id, target_type="job", details={"title": job.get("title"), "restored_to": restore_status}
    )
    return {"message": "Job unarchived", "status": restore_status}


@router.delete("/{job_id}/permanent")
async def permanent_delete_job(job_id: str, current_user: dict = Depends(get_current_user)):
    """Permanently delete an archived job — irreversible."""
    job = await db.jobs.find_one({"id": job_id})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job["contractor_id"] != current_user["id"] and current_user["role"] not in ("admin", "superadmin"):
        raise HTTPException(status_code=403, detail="Not authorized")
    if not job.get("is_archived"):
        raise HTTPException(status_code=400, detail="Only archived jobs can be permanently deleted. Archive it first.")
    await db.jobs.delete_one({"id": job_id})
    await log_activity(
        actor=current_user, action="job.permanently_deleted", category="job",
        target_id=job_id, target_type="job", details={"title": job.get("title")}
    )
    return {"message": "Job permanently deleted"}



REVEAL_CONTACT_PRICE = 2.99  # USD — one-time fee to view contractor contact while pending


@router.post("/{job_id}/reveal-contact")
async def reveal_contact(job_id: str, current_user: dict = Depends(get_current_user)):
    """Crew pays a one-time fee to reveal contractor contact info for a job."""
    if current_user["role"] != "crew":
        raise HTTPException(status_code=403, detail="Only crew can use paid reveal")

    job = await db.jobs.find_one(
        {"id": job_id},
        {"_id": 0, "paid_reveals": 1, "crew_accepted": 1, "title": 1}
    )
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    crew_id = current_user["id"]

    # Idempotent: already purchased
    if crew_id in job.get("paid_reveals", []):
        return {"message": "Already revealed", "has_paid_reveal": True}

    # Accepted crew don't need to pay
    if crew_id in job.get("crew_accepted", []):
        return {"message": "Already approved — contact visible", "has_paid_reveal": False}

    # Record payment (demo mode — Square token optional)
    tx_id = str(uuid.uuid4())
    await db.payment_transactions.insert_one({
        "id": tx_id,
        "user_id": crew_id,
        "amount": REVEAL_CONTACT_PRICE,
        "currency": "USD",
        "type": "contact_reveal",
        "job_id": job_id,
        "job_title": job.get("title", ""),
        "payment_method": "demo",
        "status": "completed",
        "created_at": now_str(),
    })

    # Persist the reveal on the job
    await db.jobs.update_one({"id": job_id}, {"$push": {"paid_reveals": crew_id}})

    return {"message": "Contact info unlocked", "has_paid_reveal": True, "amount": REVEAL_CONTACT_PRICE}


# ── UPLOAD DIRECTORY ──────────────────────────────────────────────────────────
_JOB_IMG_DIR = Path("/app/backend/uploads/job_images")
_ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}


@router.post("/{job_id}/images")
async def upload_job_images(
    job_id: str,
    files: List[UploadFile] = File(...),
    current_user: dict = Depends(get_current_user),
):
    """Upload up to 4 images for a job (contractor only)."""
    job = await db.jobs.find_one({"id": job_id}, {"_id": 0, "contractor_id": 1, "images": 1})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job["contractor_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Only the job contractor can upload images")
    existing = job.get("images", [])
    if len(existing) + len(files) > 4:
        raise HTTPException(status_code=400, detail=f"Max 4 images allowed (already have {len(existing)})")
    _JOB_IMG_DIR.mkdir(parents=True, exist_ok=True)
    new_urls: list[str] = []
    for f in files:
        if f.content_type not in _ALLOWED_IMAGE_TYPES:
            raise HTTPException(status_code=400, detail=f"Unsupported file type: {f.content_type}")
        ext = (f.filename or "img").rsplit(".", 1)[-1].lower()
        fname = f"{uuid.uuid4()}.{ext}"
        content = await f.read()
        (_JOB_IMG_DIR / fname).write_bytes(content)
        new_urls.append(f"/api/uploads/job_images/{fname}")
    await db.jobs.update_one({"id": job_id}, {"$push": {"images": {"$each": new_urls}}})
    return {"images": existing + new_urls}


@router.put("/{job_id}/task-check")
async def toggle_task(job_id: str, body: TaskCheckRequest, current_user: dict = Depends(get_current_user)):
    """Toggle a single task completion for the current user."""
    job = await db.jobs.find_one({"id": job_id}, {"_id": 0, "tasks": 1, "contractor_id": 1})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    tasks = job.get("tasks", [])
    if body.task_idx < 0 or body.task_idx >= len(tasks):
        raise HTTPException(status_code=400, detail="Invalid task index")
    # Key: contractor uses "contractor", crew uses their user ID
    actor = "contractor" if current_user["id"] == job["contractor_id"] else current_user["id"]
    field = f"task_completions.{actor}.{body.task_idx}"
    await db.jobs.update_one({"id": job_id}, {"$set": {field: body.checked}})
    return {"ok": True}


@router.post("/{job_id}/crew-complete")
async def crew_complete(job_id: str, current_user: dict = Depends(get_current_user)):
    """
    Crew marks their work done.  Idempotent — safe to call twice.
    Transitions:  assignment  assigned → pending_complete
                  job         any-active → pending_complete
    """
    if current_user["role"] != "crew":
        raise HTTPException(status_code=403, detail="Crew only")

    job = await db.jobs.find_one({"id": job_id}, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if current_user["id"] not in job.get("crew_accepted", []):
        raise HTTPException(status_code=403, detail="You are not assigned to this job")
    if job["status"] in ("completed", "cancelled", "archived"):
        raise HTTPException(status_code=400, detail=f"Job is already {job['status']}")

    # Idempotent: fetch or create assignment
    assignment = await get_or_create_assignment(job_id, current_user["id"])
    if assignment["status"] in ("pending_complete", "approved_complete"):
        return {"message": "Already submitted", "assignment_status": assignment["status"]}

    now = now_str()
    await update_assignment_status(
        assignment, "pending_complete",
        extra_fields={"pending_complete_at": now},
        actor_id=current_user["id"], actor_type="crew",
    )

    # Force job → pending_complete
    prev_job_status = job["status"]
    if prev_job_status not in ("pending_complete",):
        await db.jobs.update_one(
            {"id": job_id},
            {"$set": {"status": "pending_complete", "status_changed_at": now}},
        )
        await log_status_history(
            job_id=job_id, entity_type="job",
            from_status=prev_job_status, to_status="pending_complete",
            actor_id=current_user["id"], actor_type="crew",
        )

    # Notify contractor
    await create_notification(
        job["contractor_id"], "crew_submitted_complete", "Crew Submitted Completion",
        f"{current_user['name']} marked '{job['title']}' complete. Approve to finalize."
    )
    try:
        from routes.ws_routes import manager
        await manager.send_to_user(job["contractor_id"], {
            "type": "crew_submitted_complete",
            "job_id": job_id, "job_title": job["title"],
            "crew_name": current_user["name"], "crew_id": current_user["id"],
        })
    except Exception:
        pass

    return {"message": "Completion submitted", "assignment_status": "pending_complete"}


@router.post("/{job_id}/crew/{crew_id}/approve-complete")
async def approve_crew_complete(
    job_id: str, crew_id: str, current_user: dict = Depends(get_current_user)
):
    """
    Contractor approves a specific crew member's completion.
    Transitions: assignment pending_complete → approved_complete
    Resets 72h timer on ALL remaining pending_complete assignments.
    If all assignments are terminal → Job → completed.
    """
    if current_user["role"] not in ("contractor", "admin", "superadmin"):
        raise HTTPException(status_code=403, detail="Contractor only")

    job = await db.jobs.find_one({"id": job_id}, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job["contractor_id"] != current_user["id"] and current_user["role"] not in ("admin", "superadmin"):
        raise HTTPException(status_code=403, detail="Not your job")

    assignment = await get_assignment(job_id, crew_id)
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    if assignment["status"] == "approved_complete":
        return {"message": "Already approved", "job_completed": False}

    now = now_str()
    await update_assignment_status(
        assignment, "approved_complete",
        extra_fields={"approved_at": now},
        actor_id=current_user["id"], actor_type="contractor",
    )

    # Reset 72h timer for all remaining pending_complete assignments
    await db.crew_assignments.update_many(
        {"job_id": job_id, "status": "pending_complete"},
        {"$set": {"last_contractor_action_at": now, "updated_at": now}},
    )

    # Award partial points to the approved crew member now
    await db.users.update_one({"id": crew_id}, {"$inc": {"points": 10}})

    await create_notification(
        crew_id, "completion_approved", "Completion Approved",
        f"'{job['title']}' completion approved by contractor."
    )

    # Check if all done → complete job
    job_completed = await maybe_complete_job(job_id, actor_id=current_user["id"])

    try:
        from routes.ws_routes import manager
        await manager.send_to_user(crew_id, {
            "type": "completion_approved", "job_id": job_id,
            "job_title": job["title"], "job_completed": job_completed,
        })
    except Exception:
        pass

    return {"message": "Crew completion approved", "job_completed": job_completed}


@router.get("/{job_id}/assignments")
async def get_job_assignments(
    job_id: str, current_user: dict = Depends(get_current_user)
):
    """
    Admin audit endpoint: returns all crew assignments for a job,
    enriched with crew user profiles. Accessible by admins or the job's contractor.
    """
    job = await db.jobs.find_one({"id": job_id}, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    is_admin = current_user["role"] in ("admin", "superadmin")
    is_owner = job["contractor_id"] == current_user["id"]
    if not is_admin and not is_owner:
        raise HTTPException(status_code=403, detail="Not authorised")

    assignments = await db.crew_assignments.find(
        {"job_id": job_id}, {"_id": 0}
    ).sort("created_at", 1).to_list(200)

    # Enrich each assignment with crew profile fields
    enriched = []
    for a in assignments:
        crew = await db.users.find_one(
            {"id": a["crew_id"]},
            {"_id": 0, "name": 1, "email": 1, "trade": 1, "discipline": 1, "rating": 1, "jobs_completed": 1, "profile_photo": 1},
        )
        enriched.append({
            **a,
            "crew_profile": crew or {},
        })

    # Also pull status_history for the job
    history = await db.status_history.find(
        {"job_id": job_id}, {"_id": 0}
    ).sort("timestamp", 1).to_list(500)

    return {
        "job_id": job_id,
        "job_title": job.get("title", ""),
        "job_status": job.get("status", ""),
        "assignments": enriched,
        "status_history": history,
    }



async def remove_crew_from_job(
    job_id: str, crew_id: str, current_user: dict = Depends(get_current_user)
):
    """
    Contractor removes a crew member from an active or pending-complete job.
    Assignment → removed. Does not add to Past Jobs. May trigger job completion.
    """
    if current_user["role"] not in ("contractor", "admin", "superadmin"):
        raise HTTPException(status_code=403, detail="Contractor only")

    job = await db.jobs.find_one({"id": job_id}, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job["contractor_id"] != current_user["id"] and current_user["role"] not in ("admin", "superadmin"):
        raise HTTPException(status_code=403, detail="Not your job")

    assignment = await get_assignment(job_id, crew_id)
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    if assignment["status"] not in ("assigned", "pending_complete"):
        raise HTTPException(status_code=400, detail=f"Cannot remove crew with status '{assignment['status']}'")

    await update_assignment_status(
        assignment, "removed",
        actor_id=current_user["id"], actor_type="contractor",
    )

    new_accepted = [c for c in job.get("crew_accepted", []) if c != crew_id]
    await db.jobs.update_one({"id": job_id}, {"$set": {"crew_accepted": new_accepted}})

    await create_notification(
        crew_id, "removed_from_job", "Removed from Job",
        f"You have been removed from '{job['title']}'."
    )

    # Check if removal triggers completion
    await maybe_complete_job(job_id, actor_id=current_user["id"])

    return {"message": "Crew member removed"}


@router.post("/{job_id}/dispute")
async def create_dispute(job_id: str, body: DisputeCreate, current_user: dict = Depends(get_current_user)):
    """Submit a dispute/support request for a job."""
    if not body.reason.strip():
        raise HTTPException(status_code=400, detail="Dispute reason is required")
    job = await db.jobs.find_one({"id": job_id}, {"_id": 0, "title": 1})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    doc = {
        "id": str(uuid.uuid4()),
        "job_id": job_id,
        "job_title": job.get("title", ""),
        "user_id": current_user["id"],
        "user_role": current_user["role"],
        "reason": body.reason.strip(),
        "status": "open",
        "created_at": now_str(),
    }
    await db.disputes.insert_one(doc)
    return {"message": "Dispute submitted for admin review", "id": doc["id"]}


@router.post("/{job_id}/withdraw")
async def withdraw_from_job(job_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "crew":
        raise HTTPException(status_code=403, detail="Only crew can withdraw")
    job = await db.jobs.find_one({"id": job_id})
    if not job:
        raise HTTPException(status_code=404, detail="Not found")
    uid = current_user["id"]
    in_accepted = uid in job.get("crew_accepted", [])
    in_pending  = uid in job.get("crew_pending", [])
    if not in_accepted and not in_pending:
        raise HTTPException(status_code=400, detail="Not on this job")

    update: dict = {}
    if in_accepted:
        crew = [c for c in job["crew_accepted"] if c != uid]
        update["crew_accepted"] = crew
        update["status"] = "fulfilled" if len(crew) >= job.get("crew_needed", 1) else "open"
    if in_pending:
        update["crew_pending"] = [c for c in job.get("crew_pending", []) if c != uid]

    await db.jobs.update_one({"id": job_id}, {"$set": update})
    await log_activity(
        actor=current_user, action="job.withdrawn", category="job",
        target_id=job_id, target_type="job", details={"title": job["title"]}
    )
    return {"message": "Withdrawn from job"}


@router.post("/{job_id}/cancel")
async def cancel_job(job_id: str, archive: bool = False, current_user: dict = Depends(get_current_user)):
    """Cancel a job and notify all accepted crew. Pass ?archive=true to also archive."""
    job = await db.jobs.find_one({"id": job_id})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job["contractor_id"] != current_user["id"] and current_user["role"] not in ("admin", "superadmin"):
        raise HTTPException(status_code=403, detail="Not authorized")
    if job["status"] in ("completed", "cancelled", "archived"):
        raise HTTPException(status_code=400, detail=f"Job is already {job['status']}")

    now = datetime.now(timezone.utc).isoformat()
    updates: dict = {"status": "cancelled", "status_changed_at": now}
    if archive:
        updates.update({"is_archived": True, "archived_at": now,
                        "archived_by": current_user["id"], "pre_archive_status": "cancelled", "is_hidden": True})

    await db.jobs.update_one({"id": job_id}, {"$set": updates})

    # Force-close all open assignments → approved_complete (enables ratings, spec §5)
    await force_close_assignments(job_id, actor_id=current_user["id"], actor_type="contractor")
    await log_status_history(
        job_id=job_id, entity_type="job",
        from_status=job["status"], to_status="cancelled",
        actor_id=current_user["id"], actor_type="contractor",
    )

    for crew_id in job.get("crew_accepted", []):
        await create_notification(
            crew_id, "job_cancelled", "Job Cancelled",
            f"The job '{job['title']}' has been cancelled by the contractor."
        )
    action = "job.cancelled_and_archived" if archive else "job.cancelled"
    await log_activity(
        actor=current_user, action=action, category="job",
        target_id=job_id, target_type="job", details={"title": job["title"]}
    )
    return {"message": "Job cancelled and archived" if archive else "Job cancelled"}


@router.post("/{job_id}/suspend")
async def suspend_job(job_id: str, current_user: dict = Depends(get_current_user)):
    """Suspend an active job and notify accepted crew."""
    job = await db.jobs.find_one({"id": job_id})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job["contractor_id"] != current_user["id"] and current_user["role"] not in ("admin", "superadmin"):
        raise HTTPException(status_code=403, detail="Not authorized")
    if job["status"] not in ("open", "fulfilled", "in_progress", "pending_complete"):
        raise HTTPException(status_code=400, detail="Cannot suspend job in this state")

    await db.jobs.update_one({"id": job_id}, {"$set": {"status": "suspended", "status_changed_at": now_str()}})
    await force_close_assignments(job_id, actor_id=current_user["id"], actor_type="contractor")
    await log_status_history(
        job_id=job_id, entity_type="job",
        from_status=job["status"], to_status="suspended",
        actor_id=current_user["id"], actor_type="contractor",
    )

    for crew_id in job.get("crew_accepted", []):
        await create_notification(
            crew_id, "job_suspended", "Job Suspended",
            f"The job '{job['title']}' has been temporarily suspended."
        )
    await log_activity(
        actor=current_user, action="job.suspended", category="job",
        target_id=job_id, target_type="job", details={"title": job["title"]}
    )
    return {"message": "Job suspended"}


@router.post("/{job_id}/reactivate")
async def reactivate_job(job_id: str, current_user: dict = Depends(get_current_user)):
    """Reactivate a suspended job and notify crew."""
    job = await db.jobs.find_one({"id": job_id})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job["contractor_id"] != current_user["id"] and current_user["role"] not in ("admin", "superadmin"):
        raise HTTPException(status_code=403, detail="Not authorized")
    if job["status"] != "suspended":
        raise HTTPException(status_code=400, detail="Can only reactivate suspended jobs")

    crew = job.get("crew_accepted", [])
    new_status = "fulfilled" if len(crew) >= job.get("crew_needed", 1) else "open"
    await db.jobs.update_one({"id": job_id}, {"$set": {"status": new_status}})

    for crew_id in crew:
        await create_notification(
            crew_id, "job_reactivated", "Job Reactivated",
            f"Good news! The job '{job['title']}' has been reactivated."
        )
    await log_activity(
        actor=current_user, action="job.reactivated", category="job",
        target_id=job_id, target_type="job", details={"title": job["title"], "new_status": new_status}
    )
    return {"message": "Job reactivated", "status": new_status}


@router.post("/{job_id}/duplicate", status_code=201)
async def duplicate_job(job_id: str, current_user: dict = Depends(get_current_user)):
    """Duplicate an existing job to quickly repost it."""
    if current_user["role"] != "contractor":
        raise HTTPException(status_code=403, detail="Only contractors can duplicate jobs")
    await check_and_enforce_limit(current_user, "post")

    job = await db.jobs.find_one({"id": job_id}, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job["contractor_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    new_job = {
        "id": str(uuid.uuid4()),
        "contractor_id": job["contractor_id"],
        "contractor_name": job["contractor_name"],
        "title": f"{job['title']} (Copy)",
        "description": job["description"],
        "trade": job["trade"],
        "crew_needed": job["crew_needed"],
        "crew_accepted": [],
        "start_time": job["start_time"],
        "pay_rate": job["pay_rate"],
        "address": job.get("address", ""),
        "location": job["location"],
        "status": "open",
        "is_emergency": False,
        "is_boosted": False,
        "created_at": now_str(),
        "completed_at": None,
        "rated_crew": [],
        "rated_by_crew": [],
        "skipped_ratings": [],
        "is_hidden": False,
        # Mark rating as pre-completed so duplicated jobs never trigger rating prompts
        "rating_completed": True,
    }
    await db.jobs.insert_one(new_job)
    await increment_usage(current_user["id"])

    try:
        from routes.ws_routes import manager
        await manager.broadcast_new_job(new_job)
    except Exception:
        pass

    return {k: v for k, v in new_job.items() if k != "_id"}


@router.post("/{job_id}/accept")
async def accept_job(job_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "crew":
        raise HTTPException(status_code=403, detail="Only crew members can accept jobs")
    await check_and_enforce_limit(current_user, "respond")

    job = await db.jobs.find_one({"id": job_id}, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job["status"] not in ("open", "fulfilled"):
        raise HTTPException(status_code=400, detail=f"Job is {job['status']}, cannot accept")
    if current_user["id"] in job.get("crew_accepted", []):
        raise HTTPException(status_code=400, detail="Already accepted this job")
    if not job.get("is_emergency") and current_user["id"] in job.get("crew_pending", []):
        raise HTTPException(status_code=400, detail="Application already pending")

    if job.get("is_emergency"):
        # Emergency: atomic race-lock — direct accept
        result = await db.jobs.find_one_and_update(
            {
                "id": job_id,
                "status": {"$in": ["open", "fulfilled"]},
                "crew_accepted": {"$not": {"$elemMatch": {"$eq": current_user["id"]}}},
                "$expr": {"$lt": [{"$size": "$crew_accepted"}, "$crew_needed"]}
            },
            {"$push": {"crew_accepted": current_user["id"]}, "$set": {"status": "fulfilled"}},
            return_document=True
        )
        if not result:
            raise HTTPException(status_code=409, detail="Emergency job already claimed or slot unavailable")
        new_crew = result["crew_accepted"]
        try:
            from routes.ws_routes import manager
            await manager.send_to_user(job["contractor_id"], {
                "type": "job_accepted", "job_id": job_id,
                "crew_name": current_user["name"],
                "crew_count": len(new_crew), "crew_needed": job["crew_needed"]
            })
        except Exception:
            pass
        await create_notification(
            job["contractor_id"], "job_accepted", "Emergency Job Claimed",
            f"{current_user['name']} claimed your emergency job '{job['title']}'."
        )
        await increment_usage(current_user["id"])
        return {"message": "Emergency job accepted", "status": "fulfilled"}
    else:
        # Non-emergency: add to pending, contractor must approve
        await db.jobs.update_one({"id": job_id}, {"$push": {"crew_pending": current_user["id"]}})
        pending_count = len(job.get("crew_pending", [])) + 1
        try:
            from routes.ws_routes import manager
            await manager.send_to_user(job["contractor_id"], {
                "type": "new_applicant", "job_id": job_id,
                "job_title": job["title"],
                "crew_name": current_user["name"], "pending_count": pending_count
            })
        except Exception:
            pass
        await create_notification(
            job["contractor_id"], "new_applicant", "New Job Applicant",
            f"{current_user['name']} applied for '{job['title']}'. Review and approve."
        )
        await increment_usage(current_user["id"])
        return {"message": "Application submitted, awaiting contractor approval", "status": "pending"}


@router.get("/{job_id}/applicants")
async def get_applicants(job_id: str, current_user: dict = Depends(get_current_user)):
    """Return enriched pending applicant details for a job (contractor only)."""
    job = await db.jobs.find_one({"id": job_id}, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job["contractor_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    ids = job.get("crew_pending", [])
    if not ids:
        return []
    users = await db.users.find({"id": {"$in": ids}}, {"_id": 0, "password_hash": 0}).to_list(50)
    return users


@router.post("/{job_id}/applicants/{crew_id}/approve")
async def approve_applicant(job_id: str, crew_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "contractor":
        raise HTTPException(status_code=403, detail="Only contractors can approve applicants")
    job = await db.jobs.find_one({"id": job_id}, {"_id": 0})
    if not job or job["contractor_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    if crew_id not in job.get("crew_pending", []):
        raise HTTPException(status_code=400, detail="Crew member is not in pending list")

    # APPROVAL GUARD: deny immediately if already at capacity
    approved_count = len(job.get("crew_accepted", []))
    if approved_count >= job["crew_needed"]:
        new_pending = [c for c in job.get("crew_pending", []) if c != crew_id]
        await db.jobs.update_one({"id": job_id}, {"$set": {"crew_pending": new_pending}})
        await create_notification(crew_id, "application_declined", "Application Not Selected",
            f"Your application for '{job['title']}' was not selected. Keep applying!")
        try:
            from routes.ws_routes import manager
            await manager.send_to_user(crew_id, {"type": "application_declined", "job_title": job["title"]})
        except Exception:
            pass
        return {"message": "Crew limit reached — applicant denied", "status": job.get("status")}

    new_pending  = [c for c in job["crew_pending"] if c != crew_id]
    new_accepted = job.get("crew_accepted", []) + [crew_id]
    new_status   = "fulfilled" if len(new_accepted) >= job["crew_needed"] else "open"

    # AUTO-DENY: when this approval fills the quota, deny all remaining pending
    auto_denied_ids = []
    if len(new_accepted) >= job["crew_needed"]:
        auto_denied_ids = list(new_pending)
        new_pending = []

    await db.jobs.update_one({"id": job_id}, {"$set": {
        "crew_pending": new_pending, "crew_accepted": new_accepted, "status": new_status
    }})

    # Create CrewAssignment for the newly accepted crew member
    await get_or_create_assignment(job_id, crew_id)

    crew = await db.users.find_one({"id": crew_id}, {"_id": 0})
    crew_name = crew["name"] if crew else "Crew member"
    await create_notification(crew_id, "application_approved", "Application Approved",
        f"Your application for '{job['title']}' was approved! Check your itinerary.")
    try:
        from routes.ws_routes import manager
        await manager.send_to_user(crew_id, {"type": "application_approved", "job_title": job["title"]})
        await manager.send_to_user(job["contractor_id"], {
            "type": "job_accepted", "job_id": job_id,
            "crew_name": crew_name, "crew_count": len(new_accepted), "crew_needed": job["crew_needed"]
        })
    except Exception:
        pass

    # Notify each auto-denied applicant
    for denied_id in auto_denied_ids:
        await create_notification(denied_id, "application_declined", "Application Not Selected",
            f"Your application for '{job['title']}' was not selected. Keep applying!")
        try:
            from routes.ws_routes import manager
            await manager.send_to_user(denied_id, {"type": "application_declined", "job_title": job["title"]})
        except Exception:
            pass

    return {"message": "Applicant approved", "status": new_status, "auto_denied": len(auto_denied_ids)}


@router.post("/{job_id}/applicants/{crew_id}/decline")
async def decline_applicant(job_id: str, crew_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "contractor":
        raise HTTPException(status_code=403, detail="Only contractors can decline applicants")
    job = await db.jobs.find_one({"id": job_id}, {"_id": 0})
    if not job or job["contractor_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    new_pending = [c for c in job.get("crew_pending", []) if c != crew_id]
    await db.jobs.update_one({"id": job_id}, {"$set": {"crew_pending": new_pending}})
    await create_notification(crew_id, "application_declined", "Application Not Selected",
        f"Your application for '{job['title']}' was not selected. Keep applying!")
    try:
        from routes.ws_routes import manager
        await manager.send_to_user(crew_id, {"type": "application_declined", "job_title": job["title"]})
    except Exception:
        pass
    return {"message": "Applicant declined"}




# ── OFFER SYSTEM ──────────────────────────────────────────────────────────────

@router.post("/{job_id}/offers", status_code=201)
async def send_offer(job_id: str, data: OfferCreate, current_user: dict = Depends(get_current_user)):
    """Contractor sends a job offer directly to a crew member (bypasses application)."""
    if current_user["role"] != "contractor":
        raise HTTPException(status_code=403, detail="Only contractors can send offers")
    
    job = await db.jobs.find_one({"id": job_id}, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    if job["contractor_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not your job")
    
    if job["status"] not in ("open", "fulfilled"):
        raise HTTPException(status_code=400, detail=f"Cannot send offers for {job['status']} jobs")
    
    # Check if crew exists
    crew = await db.users.find_one({"id": data.crew_id, "role": "crew"}, {"_id": 0})
    if not crew:
        raise HTTPException(status_code=404, detail="Crew member not found")
    
    # Check if crew is already accepted or has pending application
    if data.crew_id in job.get("crew_accepted", []):
        raise HTTPException(status_code=400, detail="Crew member already accepted for this job")
    
    # Check if offer already exists and is pending
    existing_offer = await db.offers.find_one({
        "job_id": job_id,
        "crew_id": data.crew_id,
        "status": {"$in": ["pending", "countered"]}
    }, {"_id": 0})
    
    if existing_offer:
        raise HTTPException(status_code=400, detail="Active offer already exists for this crew member")
    
    # Validate pay rate
    if data.pay_rate <= 0:
        raise HTTPException(status_code=400, detail="Pay rate must be positive")
    
    # Create offer
    offer_doc = {
        "id": str(uuid.uuid4()),
        "job_id": job_id,
        "job_title": job["title"],
        "contractor_id": current_user["id"],
        "contractor_name": current_user.get("company_name") or current_user["name"],
        "crew_id": data.crew_id,
        "crew_name": crew.get("name", "Unknown"),
        "original_pay_rate": job["pay_rate"],
        "offered_pay_rate": data.pay_rate,
        "message": data.message or "",
        "status": "pending",
        "created_at": now_str(),
        "updated_at": now_str()
    }
    
    await db.offers.insert_one(offer_doc)
    
    # Notify crew
    await create_notification(
        data.crew_id,
        "offer_received",
        "Job Offer Received",
        f"{current_user.get('company_name') or current_user['name']} sent you an offer for '{job['title']}' at ${data.pay_rate}/hr"
    )
    
    await log_activity(
        actor=current_user,
        action="offer.sent",
        category="offer",
        target_id=offer_doc["id"],
        target_type="offer",
        details={"job_id": job_id, "crew_id": data.crew_id, "pay_rate": data.pay_rate}
    )
    
    return {k: v for k, v in offer_doc.items() if k != "_id"}


@router.get("/all-offers")
async def list_offers(
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """List offers. Crew sees received offers, Contractor sees sent offers."""
    if current_user["role"] == "crew":
        query = {"crew_id": current_user["id"]}
    elif current_user["role"] == "contractor":
        query = {"contractor_id": current_user["id"]}
    else:
        query = {}  # Admin sees all
    
    if status:
        query["status"] = status
    
    offers = await db.offers.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return offers


@router.post("/offers/{offer_id}/accept")
async def accept_offer(offer_id: str, current_user: dict = Depends(get_current_user)):
    """Crew accepts an offer. Auto-assigns crew to job and reduces open slots."""
    if current_user["role"] != "crew":
        raise HTTPException(status_code=403, detail="Only crew can accept offers")
    
    offer = await db.offers.find_one({"id": offer_id}, {"_id": 0})
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    
    if offer["crew_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not your offer")
    
    if offer["status"] != "pending" and offer["status"] != "countered":
        raise HTTPException(status_code=400, detail=f"Offer is {offer['status']}, cannot accept")
    
    # Get job
    job = await db.jobs.find_one({"id": offer["job_id"]}, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    # Check if already accepted
    if current_user["id"] in job.get("crew_accepted", []):
        raise HTTPException(status_code=400, detail="Already accepted for this job")
    
    # Check if job is full
    current_crew_count = len(job.get("crew_accepted", []))
    if current_crew_count >= job["crew_needed"]:
        raise HTTPException(status_code=400, detail="Job is already full")
    
    # Accept the offer: add crew to job
    await db.jobs.update_one(
        {"id": offer["job_id"]},
        {
            "$push": {"crew_accepted": current_user["id"]},
            "$pull": {"crew_pending": current_user["id"]},  # Remove from pending if exists
            "$set": {"updated_at": now_str()}
        }
    )

    # Create CrewAssignment for accepted crew
    await get_or_create_assignment(offer["job_id"], current_user["id"])
    await db.offers.update_one(
        {"id": offer_id},
        {"$set": {"status": "accepted", "updated_at": now_str()}}
    )
    
    # Check if job should be marked as fulfilled
    updated_job = await db.jobs.find_one({"id": offer["job_id"]}, {"_id": 0})
    if len(updated_job.get("crew_accepted", [])) >= updated_job["crew_needed"]:
        await db.jobs.update_one(
            {"id": offer["job_id"]},
            {"$set": {"status": "fulfilled", "status_changed_at": now_str()}}
        )
    
    # Notify contractor
    await create_notification(
        offer["contractor_id"],
        "offer_accepted",
        "Offer Accepted",
        f"{current_user['name']} accepted your offer for '{offer['job_title']}'"
    )
    
    await log_activity(
        actor=current_user,
        action="offer.accepted",
        category="offer",
        target_id=offer_id,
        target_type="offer",
        details={"job_id": offer["job_id"]}
    )
    
    return {"message": "Offer accepted", "job_status": updated_job.get("status")}


@router.post("/offers/{offer_id}/counter")
async def counter_offer(offer_id: str, data: OfferCounter, current_user: dict = Depends(get_current_user)):
    """Crew counters an offer with a different pay rate."""
    if current_user["role"] != "crew":
        raise HTTPException(status_code=403, detail="Only crew can counter offers")
    
    offer = await db.offers.find_one({"id": offer_id}, {"_id": 0})
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    
    if offer["crew_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not your offer")
    
    if offer["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"Cannot counter {offer['status']} offer")
    
    if data.counter_rate <= 0:
        raise HTTPException(status_code=400, detail="Counter rate must be positive")
    
    # Update offer with counter
    await db.offers.update_one(
        {"id": offer_id},
        {
            "$set": {
                "status": "countered",
                "counter_rate": data.counter_rate,
                "counter_message": data.message or "",
                "updated_at": now_str()
            }
        }
    )
    
    # Notify contractor
    await create_notification(
        offer["contractor_id"],
        "offer_countered",
        "Offer Countered",
        f"{current_user['name']} countered your offer for '{offer['job_title']}' with ${data.counter_rate}/hr"
    )
    
    await log_activity(
        actor=current_user,
        action="offer.countered",
        category="offer",
        target_id=offer_id,
        target_type="offer",
        details={"counter_rate": data.counter_rate}
    )
    
    return {"message": "Counter offer sent", "counter_rate": data.counter_rate}


@router.post("/offers/{offer_id}/decline")
async def decline_offer(offer_id: str, current_user: dict = Depends(get_current_user)):
    """Crew declines an offer."""
    if current_user["role"] != "crew":
        raise HTTPException(status_code=403, detail="Only crew can decline offers")
    
    offer = await db.offers.find_one({"id": offer_id}, {"_id": 0})
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    
    if offer["crew_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not your offer")
    
    if offer["status"] not in ("pending", "countered"):
        raise HTTPException(status_code=400, detail=f"Cannot decline {offer['status']} offer")
    
    # Update offer status
    await db.offers.update_one(
        {"id": offer_id},
        {"$set": {"status": "declined", "updated_at": now_str()}}
    )
    
    # Notify contractor
    await create_notification(
        offer["contractor_id"],
        "offer_declined",
        "Offer Declined",
        f"{current_user['name']} declined your offer for '{offer['job_title']}'"
    )
    
    await log_activity(
        actor=current_user,
        action="offer.declined",
        category="offer",
        target_id=offer_id,
        target_type="offer",
        details={"job_id": offer["job_id"]}
    )
    
    return {"message": "Offer declined"}


@router.post("/offers/{offer_id}/withdraw")
async def withdraw_offer(offer_id: str, current_user: dict = Depends(get_current_user)):
    """Contractor withdraws an offer."""
    if current_user["role"] != "contractor":
        raise HTTPException(status_code=403, detail="Only contractors can withdraw offers")
    
    offer = await db.offers.find_one({"id": offer_id}, {"_id": 0})
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    
    if offer["contractor_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not your offer")
    
    if offer["status"] == "accepted":
        raise HTTPException(status_code=400, detail="Cannot withdraw accepted offer")
    
    # Update offer status
    await db.offers.update_one(
        {"id": offer_id},
        {"$set": {"status": "withdrawn", "updated_at": now_str()}}
    )
    
    # Notify crew
    await create_notification(
        offer["crew_id"],
        "offer_withdrawn",
        "Offer Withdrawn",
        f"The offer for '{offer['job_title']}' has been withdrawn"
    )
    
    await log_activity(
        actor=current_user,
        action="offer.withdrawn",
        category="offer",
        target_id=offer_id,
        target_type="offer",
        details={"job_id": offer["job_id"]}
    )
    
    return {"message": "Offer withdrawn"}


@router.delete("/{job_id}/ratings/{rating_id}")
async def remove_rating(job_id: str, rating_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in ("admin", "superadmin"):
        raise HTTPException(status_code=403, detail="Only admins can remove ratings")
    rating = await db.ratings.find_one({"id": rating_id, "job_id": job_id}, {"_id": 0})
    if not rating:
        raise HTTPException(status_code=404, detail="Rating not found")
    await db.ratings.delete_one({"id": rating_id})
    # Recalculate average for the rated user
    remaining = await db.ratings.find({"rated_id": rating["rated_id"]}, {"_id": 0}).to_list(1000)
    avg = round(sum(r["stars"] for r in remaining) / len(remaining), 1) if remaining else 0
    await db.users.update_one(
        {"id": rating["rated_id"]},
        {"$set": {"rating": avg, "rating_count": len(remaining)}}
    )
    return {"message": "Rating removed"}


@router.post("/{job_id}/start")
async def start_job(job_id: str, current_user: dict = Depends(get_current_user)):
    job = await db.jobs.find_one({"id": job_id}, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job["contractor_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Only the contractor can start this job")
    if job["status"] not in ("open", "fulfilled"):
        raise HTTPException(status_code=400, detail="Job cannot be started in current status")

    started_at = now_str()
    await db.jobs.update_one({"id": job_id}, {"$set": {"status": "in_progress", "started_at": started_at}})

    # Notify all accepted crew
    for crew_id in job.get("crew_accepted", []):
        await create_notification(
            crew_id, "job_started", "Job Started",
            f"'{job['title']}' has started! Please proceed to the job site."
        )
        try:
            from routes.ws_routes import manager
            await manager.send_to_user(crew_id, {
                "type": "job_started", "job_id": job_id, "job_title": job["title"]
            })
        except Exception:
            pass

    return {"message": "Job started", "started_at": started_at}


@router.post("/{job_id}/complete")
async def complete_job(job_id: str, current_user: dict = Depends(get_current_user)):
    job = await db.jobs.find_one({"id": job_id}, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if current_user["id"] not in job.get("crew_accepted", []):
        raise HTTPException(status_code=403, detail="Not a crew member on this job")
    if job["status"] != "in_progress":
        raise HTTPException(status_code=400, detail="Job must be in_progress to complete")

    await db.jobs.update_one(
        {"id": job_id},
        {"$set": {"status": "completed_pending_review", "status_changed_at": now_str()}}
    )

    # Notify contractor (blocked for free-tier crew)
    contractor = await db.users.find_one({"id": job["contractor_id"]}, {"_id": 0})
    if contractor:
        await send_job_completion_email(contractor["email"], contractor["name"], job["title"], sender_user=current_user)
        try:
            from routes.ws_routes import manager
            await manager.send_to_user(job["contractor_id"], {
                "type": "job_completed",
                "job_id": job_id,
                "job_title": job["title"]
            })
        except Exception:
            pass

    # Persistent notification for contractor
    await create_notification(
        job["contractor_id"], "job_completed", "Job Marked Complete",
        f"{current_user['name']} has marked '{job['title']}' complete. Please review and verify."
    )

    return {"message": "Job marked complete, awaiting contractor review"}


@router.post("/{job_id}/verify")
async def verify_job(job_id: str, current_user: dict = Depends(get_current_user)):
    """
    Backward-compat: approve ALL pending crew at once.
    Prefer per-crew POST /{job_id}/crew/{crew_id}/approve-complete.
    """
    job = await db.jobs.find_one({"id": job_id}, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job["contractor_id"] != current_user["id"] and current_user["role"] not in ("admin", "superadmin"):
        raise HTTPException(status_code=403, detail="Only the contractor can verify")
    if job["status"] not in ("pending_complete", "completed_pending_review"):
        raise HTTPException(status_code=400, detail="Job not pending review")

    # Force-close all remaining assignments then complete
    await force_close_assignments(job_id, actor_id=current_user["id"], actor_type="contractor")
    await maybe_complete_job(job_id, actor_id=current_user["id"])

    return {"message": "Job verified and completed"}


@router.post("/{job_id}/rate")
async def rate_user(job_id: str, data: RatingCreate, current_user: dict = Depends(get_current_user)):
    job = await db.jobs.find_one({"id": job_id}, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    # Block rating for duplicated jobs or jobs marked as rating_completed
    assert_rating_allowed(job)
    assert_rating_status(job, action="rate")

    # Verify rater was part of this job
    is_contractor, is_crew = assert_job_participant(job, current_user["id"])

    # Validate rated user was part of the job
    if is_contractor and data.rated_id not in job.get("crew_accepted", []):
        raise HTTPException(status_code=400, detail="Crew member was not part of this job")

    # LOCK: already skipped this crew member (contractors only)
    if is_contractor and data.rated_id in job.get("skipped_ratings", []):
        raise HTTPException(status_code=400, detail="Already skipped rating for this crew member")

    # CREW → CONTRACTOR: once per job (job_id + rater_id + rated_id)
    # CONTRACTOR → CREW: once per job per crew (same constraint)
    if is_crew:
        existing = await db.ratings.find_one({
            "job_id": job_id,
            "rater_id": current_user["id"],
            "rated_id": data.rated_id
        })
        # Also block if crew already skipped this contractor for this job
        if current_user["id"] in job.get("rated_by_crew", []):
            raise HTTPException(status_code=400, detail="Already handled rating for this contractor")
    else:
        existing = await db.ratings.find_one({
            "job_id": job_id,
            "rater_id": current_user["id"],
            "rated_id": data.rated_id
        })
    if existing:
        raise HTTPException(status_code=400, detail="Already rated this person for this job")

    assert_stars_valid(data.stars)

    rating_doc = {
        "id": str(uuid.uuid4()),
        "rater_id": current_user["id"],
        "rated_id": data.rated_id,
        "job_id": job_id,
        "stars": data.stars,
        "review": data.review,
        "created_at": now_str()
    }
    
    try:
        await db.ratings.insert_one(rating_doc)
    except Exception as e:
        logger.error(f"Failed to insert rating: {e}")
        raise HTTPException(status_code=500, detail="Failed to save rating. Please try again.")

    if is_contractor:
        # Track rated_crew on the job document (contractor rated a crew member)
        await db.jobs.update_one(
            {"id": job_id},
            {"$addToSet": {"rated_crew": data.rated_id}}
        )
    else:
        # Track rated_by_crew: crew member has handled contractor rating for this job
        await db.jobs.update_one(
            {"id": job_id},
            {"$addToSet": {"rated_by_crew": current_user["id"]}}
        )

    # Update target user's average rating
    all_ratings = await db.ratings.find({"rated_id": data.rated_id}, {"_id": 0}).to_list(1000)
    avg = sum(r["stars"] for r in all_ratings) / len(all_ratings)
    await db.users.update_one(
        {"id": data.rated_id},
        {"$set": {"rating": round(avg, 1), "rating_count": len(all_ratings)}}
    )

    # AUTO-MOVE: if every approved crew member is now rated or skipped → "past"
    updated_job = await db.jobs.find_one({"id": job_id}, {"_id": 0})
    crew_accepted = updated_job.get("crew_accepted", [])
    handled = set(updated_job.get("rated_crew", [])) | set(updated_job.get("skipped_ratings", []))
    if crew_accepted and all(c in handled for c in crew_accepted):
        await db.jobs.update_one({"id": job_id}, {"$set": {"status": "past"}})

    return {"message": "Rating submitted", "rating": {k: v for k, v in rating_doc.items() if k != "_id"}}


@router.post("/{job_id}/rate/skip")
async def skip_rating(job_id: str, data: SkipRatingRequest, current_user: dict = Depends(get_current_user)):
    """Contractor skips rating a crew member, OR crew skips rating the contractor."""
    job = await db.jobs.find_one({"id": job_id}, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    # Block skip rating for duplicated jobs or jobs marked as rating_completed
    assert_rating_allowed(job)
    assert_rating_status(job, action="skip")

    is_contractor, is_crew = assert_job_participant(job, current_user["id"])

    if is_contractor:
        # Contractor skipping a crew member rating
        crew_id = data.crew_id
        if not crew_id:
            raise HTTPException(status_code=400, detail="crew_id is required for contractor skip")
        if crew_id not in job.get("crew_accepted", []):
            raise HTTPException(status_code=400, detail="Crew member not part of this job")

        # LOCK: already rated → cannot skip
        existing = await db.ratings.find_one({
            "job_id": job_id, "rater_id": current_user["id"], "rated_id": crew_id
        })
        if existing:
            raise HTTPException(status_code=400, detail="Already rated this crew member — cannot skip")

        # LOCK: already skipped (idempotent - allow re-skip)
        if crew_id in job.get("skipped_ratings", []):
            return {"message": "Rating already skipped", "crew_id": crew_id}

        await db.jobs.update_one(
            {"id": job_id},
            {"$addToSet": {"skipped_ratings": crew_id}}
        )

    elif is_crew:
        # Crew skipping contractor rating (once per contractor, Issue 2)
        contractor_id = data.contractor_id or job["contractor_id"]

        # LOCK: already rated this contractor
        existing = await db.ratings.find_one({
            "rater_id": current_user["id"],
            "rated_id": contractor_id
        })
        if existing:
            raise HTTPException(status_code=400, detail="Already rated this contractor — cannot skip")

        # LOCK: already handled (rated or skipped) for this job (idempotent - allow re-skip)
        if current_user["id"] in job.get("rated_by_crew", []):
            return {"message": "Rating already handled for this contractor", "contractor_id": contractor_id}

        await db.jobs.update_one(
            {"id": job_id},
            {"$addToSet": {"rated_by_crew": current_user["id"]}}
        )
        
        # AUTO-MOVE check for crew skip
        updated_job = await db.jobs.find_one({"id": job_id}, {"_id": 0})
        crew_accepted = updated_job.get("crew_accepted", [])
        handled = set(updated_job.get("rated_crew", [])) | set(updated_job.get("skipped_ratings", []))
        if crew_accepted and all(c in handled for c in crew_accepted):
            await db.jobs.update_one({"id": job_id}, {"$set": {"status": "past"}})
        
        return {"message": "Rating skipped", "contractor_id": contractor_id}

    else:
        raise HTTPException(status_code=403, detail="Not part of this job")

    # AUTO-MOVE: if every approved crew member is now rated or skipped → "past"
    updated_job = await db.jobs.find_one({"id": job_id}, {"_id": 0})
    crew_accepted = updated_job.get("crew_accepted", [])
    handled = set(updated_job.get("rated_crew", [])) | set(updated_job.get("skipped_ratings", []))
    if crew_accepted and all(c in handled for c in crew_accepted):
        await db.jobs.update_one({"id": job_id}, {"$set": {"status": "past"}})

    return {"message": "Rating skipped", "crew_id": data.crew_id}


@router.get("/{job_id}/ratings")
async def get_job_ratings(job_id: str, current_user: dict = Depends(get_current_user)):
    ratings = await db.ratings.find({"job_id": job_id}, {"_id": 0}).to_list(100)
    return ratings
