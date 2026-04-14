"""
assignment_helpers.py — CrewAssignment lifecycle, StatusHistory audit, auto-completion.

CrewAssignment state machine (strict):
  assigned  →  pending_complete
  assigned  →  removed
  pending_complete  →  approved_complete   (contractor action OR 72h auto)
  pending_complete  →  removed             (contractor removes)
  approved_complete  →  (terminal)
  removed            →  (terminal)
"""
import uuid
import logging
from datetime import datetime, timezone
from typing import Optional
from fastapi import HTTPException
from database import db

logger = logging.getLogger(__name__)

VALID_TRANSITIONS: dict[str, set] = {
    "assigned":         {"pending_complete", "removed"},
    "pending_complete": {"approved_complete", "removed"},
    "approved_complete": set(),
    "removed":           set(),
}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ── Transition guard ──────────────────────────────────────────────────────────

def assert_assignment_transition(current: str, next_status: str) -> None:
    allowed = VALID_TRANSITIONS.get(current, set())
    if next_status not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid assignment transition: {current} → {next_status}",
        )


# ── CRUD ─────────────────────────────────────────────────────────────────────

async def get_assignment(job_id: str, crew_id: str) -> Optional[dict]:
    return await db.crew_assignments.find_one(
        {"job_id": job_id, "crew_id": crew_id}, {"_id": 0}
    )


async def get_or_create_assignment(job_id: str, crew_id: str) -> dict:
    existing = await get_assignment(job_id, crew_id)
    if existing:
        return existing
    now = _now()
    doc = {
        "id": str(uuid.uuid4()),
        "job_id": job_id,
        "crew_id": crew_id,
        "status": "assigned",
        "pending_complete_at": None,
        "last_contractor_action_at": None,
        "approved_at": None,
        "created_at": now,
        "updated_at": now,
    }
    try:
        await db.crew_assignments.insert_one(doc)
    except Exception:
        # Concurrent insert race — re-fetch
        existing = await get_assignment(job_id, crew_id)
        if existing:
            return existing
        raise
    return doc


async def update_assignment_status(
    assignment: dict,
    new_status: str,
    extra_fields: Optional[dict] = None,
    actor_id: str = "system",
    actor_type: str = "system",
) -> dict:
    """Validate transition, persist, audit-log. Returns updated assignment."""
    assert_assignment_transition(assignment["status"], new_status)
    now = _now()
    set_fields = {"status": new_status, "updated_at": now, **(extra_fields or {})}
    await db.crew_assignments.update_one(
        {"id": assignment["id"]}, {"$set": set_fields}
    )
    await log_status_history(
        job_id=assignment["job_id"],
        entity_type="crew_assignment",
        from_status=assignment["status"],
        to_status=new_status,
        actor_id=actor_id,
        actor_type=actor_type,
        crew_assignment_id=assignment["id"],
    )
    return {**assignment, **set_fields}


# ── Audit trail ───────────────────────────────────────────────────────────────

async def log_status_history(
    job_id: str,
    entity_type: str,
    from_status: str,
    to_status: str,
    actor_id: str,
    actor_type: str,
    crew_assignment_id: Optional[str] = None,
) -> None:
    await db.status_history.insert_one({
        "id": str(uuid.uuid4()),
        "job_id": job_id,
        "crew_assignment_id": crew_assignment_id,
        "entity_type": entity_type,
        "from_status": from_status,
        "to_status": to_status,
        "actor_id": actor_id,
        "actor_type": actor_type,
        "timestamp": _now(),
    })


# ── Completion gate ───────────────────────────────────────────────────────────

async def maybe_complete_job(job_id: str, actor_id: str = "system") -> bool:
    """
    If ALL assignments are in {approved_complete, removed} → Job → completed.
    Returns True when the job is newly completed.
    """
    assignments = await db.crew_assignments.find(
        {"job_id": job_id}, {"_id": 0}
    ).to_list(200)

    if not assignments:
        return False

    if not all(a["status"] in ("approved_complete", "removed") for a in assignments):
        return False

    job = await db.jobs.find_one({"id": job_id}, {"_id": 0})
    if not job or job["status"] in ("completed", "cancelled", "archived"):
        return False

    now = _now()
    await db.jobs.update_one(
        {"id": job_id},
        {"$set": {"status": "completed", "completed_at": now, "status_changed_at": now}},
    )
    await log_status_history(
        job_id=job_id,
        entity_type="job",
        from_status=job["status"],
        to_status="completed",
        actor_id=actor_id,
        actor_type="contractor" if actor_id != "system" else "system",
    )

    # Award points to approved-only crew
    from utils.notify import create_notification
    approved_crew = [a["crew_id"] for a in assignments if a["status"] == "approved_complete"]
    for crew_id in approved_crew:
        await db.users.update_one(
            {"id": crew_id}, {"$inc": {"points": 50, "jobs_completed": 1}}
        )
        await create_notification(
            crew_id, "job_verified", "Job Completed",
            f"'{job.get('title', 'Job')}' completed. +50 pts!"
        )
        try:
            from routes.ws_routes import manager
            await manager.send_to_user(crew_id, {
                "type": "job_completed_final",
                "job_id": job_id,
                "job_title": job.get("title", ""),
            })
        except Exception:
            pass

    try:
        from routes.ws_routes import manager
        await manager.send_to_user(job["contractor_id"], {
            "type": "job_completed_final",
            "job_id": job_id,
            "job_title": job.get("title", ""),
        })
    except Exception:
        pass

    logger.info(f"[JobCompleted] job_id={job_id} actor={actor_id}")
    return True


# ── Force-close (cancel / suspend override) ───────────────────────────────────

async def force_close_assignments(
    job_id: str,
    actor_id: str,
    actor_type: str,
) -> None:
    """
    On cancel/suspend: move all active assignments → approved_complete.
    This unblocks ratings on a terminal job (spec §5).
    """
    assignments = await db.crew_assignments.find(
        {"job_id": job_id, "status": {"$in": ["assigned", "pending_complete"]}},
        {"_id": 0}
    ).to_list(200)

    now = _now()
    for a in assignments:
        await db.crew_assignments.update_one(
            {"id": a["id"]},
            {"$set": {"status": "approved_complete", "approved_at": now, "updated_at": now}},
        )
        await log_status_history(
            job_id=job_id,
            entity_type="crew_assignment",
            from_status=a["status"],
            to_status="approved_complete",
            actor_id=actor_id,
            actor_type=actor_type,
            crew_assignment_id=a["id"],
        )
