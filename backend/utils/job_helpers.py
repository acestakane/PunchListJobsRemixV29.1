"""
job_helpers.py — Shared constants and validation helpers for job/rating logic.

Centralises magic numbers and repeated guard-clauses so job_routes.py stays lean.
"""
from fastapi import HTTPException

# ─── Rating Constants ─────────────────────────────────────────────────────────

STARS_MIN = 1
STARS_MAX = 5

# Statuses that allow rating / skip-rating actions
RATING_VALID_STATUSES = ("completed", "completed_pending_review", "past")

# ─── Job Status Groups ────────────────────────────────────────────────────────

ACTIVE_STATUSES = ["fulfilled", "in_progress", "completed_pending_review", "suspended", "completed", "past"]
STALE_STATUSES  = ["suspended", "cancelled", "completed_pending_review", "past"]
CANCELLABLE_STATUSES = ("open", "fulfilled", "suspended", "in_progress")


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
