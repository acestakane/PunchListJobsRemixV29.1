"""
job_helpers.py — Shared constants, validation helpers, and query builders for
job/rating logic. Centralises magic numbers and repeated guard-clauses so
job_routes.py stays lean.
"""
from typing import Optional
from fastapi import HTTPException
from utils.geocoding import haversine_distance

# ─── Rating Constants ─────────────────────────────────────────────────────────

STARS_MIN = 1
STARS_MAX = 5

# Statuses that allow rating / skip-rating actions (HARD GATE — spec §6)
RATING_VALID_STATUSES = ("completed", "completed_pending_review", "past", "cancelled", "suspended")

# Statuses from which a job can be cancelled
CANCELLABLE_STATUSES = ("open", "fulfilled", "suspended", "in_progress", "pending_complete")

# ─── Job Status Groups ────────────────────────────────────────────────────────

ACTIVE_STATUSES = ["fulfilled", "in_progress", "pending_complete", "suspended", "completed", "past"]
STALE_STATUSES  = ["suspended", "cancelled", "pending_complete", "past"]


# ─── Query Builders ───────────────────────────────────────────────────────────

def build_list_jobs_query(
    role: str, user_id: str,
    status: Optional[str],
    trade: Optional[str],
    discipline: Optional[str],
    skill: Optional[str],
) -> dict:
    """Build the MongoDB query dict for the list_jobs endpoint."""
    query: dict = {"is_hidden": {"$ne": True}, "is_archived": {"$ne": True}}

    if role == "contractor":
        query["contractor_id"] = user_id
    else:
        query["status"] = status if status else "open"

    if trade:
        query["trade"] = trade
    if discipline:
        query["discipline"] = {"$regex": discipline, "$options": "i"}
    if skill:
        query["skill"] = {"$regex": skill, "$options": "i"}

    return query


def annotate_jobs_with_distance(
    jobs: list, lat: Optional[float], lng: Optional[float], radius: float
) -> list:
    """
    Filter jobs to those within `radius` miles of (lat, lng) and annotate
    each matching job with a `distance_miles` field. Returns filtered list.
    If lat/lng are None, returns the original list unchanged.
    """
    if not (lat and lng):
        return jobs

    filtered = []
    for job in jobs:
        loc = job.get("location") or {}
        jlat, jlng = loc.get("lat"), loc.get("lng")
        if jlat and jlng:
            d = haversine_distance(lat, lng, jlat, jlng)
            if d <= radius:
                job["distance_miles"] = round(d, 1)
                filtered.append(job)
    return filtered


def build_itinerary_query(role: str, uid: str, active_statuses: list) -> dict:
    """Build the MongoDB query dict for the jobs_itinerary endpoint."""
    if role == "crew":
        return {
            "crew_accepted": uid, "status": {"$in": active_statuses},
            "is_archived": {"$ne": True}, "crew_archived": {"$ne": uid}
        }
    elif role == "contractor":
        return {
            "contractor_id": uid, "crew_accepted": {"$exists": True, "$ne": []},
            "status": {"$in": active_statuses}, "is_archived": {"$ne": True}
        }
    else:
        return {"status": {"$in": active_statuses}, "is_archived": {"$ne": True}}


# ─── Rating Guards ────────────────────────────────────────────────────────────

def assert_rating_allowed(job: dict) -> None:
    """Raise 400 if ratings are blocked on this job (duplicated / already completed)."""
    if job.get("rating_completed", False):
        raise HTTPException(
            status_code=400,
            detail="Ratings are disabled for this job (duplicated or previously completed)",
        )


def assert_rating_status(job: dict, action: str = "rate") -> None:
    """Raise 400 if job status does not permit rating/skip-rating."""
    if job["status"] not in RATING_VALID_STATUSES:
        verb = "skip rating" if action == "skip" else "rate"
        raise HTTPException(
            status_code=400,
            detail=f"Can only {verb} after job completion. Current status: {job['status']}",
        )


def assert_job_participant(job: dict, user_id: str) -> tuple[bool, bool]:
    """
    Confirm the user was a participant in the job.
    Returns (is_contractor, is_crew).
    """
    is_contractor = job["contractor_id"] == user_id
    is_crew = user_id in job.get("crew_accepted", [])
    if not (is_contractor or is_crew):
        raise HTTPException(status_code=403, detail="Not part of this job")
    return is_contractor, is_crew


def assert_stars_valid(stars: int) -> None:
    """Raise 400 if star value is out of range."""
    if not STARS_MIN <= stars <= STARS_MAX:
        raise HTTPException(
            status_code=400,
            detail=f"Stars must be between {STARS_MIN} and {STARS_MAX}",
        )

