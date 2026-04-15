"""Rating endpoints for jobs — extracted from job_routes.py for maintainability."""
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends
from database import db
from auth import get_current_user
from models import RatingCreate, SkipRatingRequest
from utils.job_helpers import (
    assert_rating_allowed, assert_rating_status, assert_job_participant,
    assert_stars_valid,
)
import logging

router = APIRouter()
logger = logging.getLogger(__name__)


def now_str():
    return datetime.now(timezone.utc).isoformat()


@router.delete("/{job_id}/ratings/{rating_id}")
async def remove_rating(job_id: str, rating_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in ("admin", "superadmin"):
        raise HTTPException(status_code=403, detail="Only admins can remove ratings")
    rating = await db.ratings.find_one({"id": rating_id, "job_id": job_id}, {"_id": 0})
    if not rating:
        raise HTTPException(status_code=404, detail="Rating not found")
    await db.ratings.delete_one({"id": rating_id})
    remaining = await db.ratings.find({"rated_id": rating["rated_id"]}, {"_id": 0}).to_list(1000)
    avg = round(sum(r["stars"] for r in remaining) / len(remaining), 1) if remaining else 0
    await db.users.update_one(
        {"id": rating["rated_id"]},
        {"$set": {"rating": avg, "rating_count": len(remaining)}}
    )
    return {"message": "Rating removed"}


@router.post("/{job_id}/rate")
async def rate_user(job_id: str, data: RatingCreate, current_user: dict = Depends(get_current_user)):
    job = await db.jobs.find_one({"id": job_id}, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    assert_rating_allowed(job)
    assert_rating_status(job, action="rate")

    is_contractor, is_crew = assert_job_participant(job, current_user["id"])

    if is_contractor and data.rated_id not in job.get("crew_accepted", []):
        raise HTTPException(status_code=400, detail="Crew member was not part of this job")

    if is_contractor and data.rated_id in job.get("skipped_ratings", []):
        raise HTTPException(status_code=400, detail="Already skipped rating for this crew member")

    if is_crew and current_user["id"] in job.get("rated_by_crew", []):
        raise HTTPException(status_code=400, detail="Already handled rating for this contractor")

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
        await db.jobs.update_one({"id": job_id}, {"$addToSet": {"rated_crew": data.rated_id}})
    else:
        await db.jobs.update_one({"id": job_id}, {"$addToSet": {"rated_by_crew": current_user["id"]}})

    all_ratings = await db.ratings.find({"rated_id": data.rated_id}, {"_id": 0}).to_list(1000)
    avg = sum(r["stars"] for r in all_ratings) / len(all_ratings)
    await db.users.update_one(
        {"id": data.rated_id},
        {"$set": {"rating": round(avg, 1), "rating_count": len(all_ratings)}}
    )

    # AUTO-MOVE: if every approved crew member is now rated or skipped → "past"
    updated_job = await db.jobs.find_one({"id": job_id}, {"_id": 0})
    if updated_job:
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

    assert_rating_allowed(job)
    assert_rating_status(job, action="skip")

    is_contractor, is_crew = assert_job_participant(job, current_user["id"])

    if is_contractor:
        crew_id = data.crew_id
        if not crew_id:
            raise HTTPException(status_code=400, detail="crew_id is required for contractor skip")
        if crew_id not in job.get("crew_accepted", []):
            raise HTTPException(status_code=400, detail="Crew member not part of this job")

        existing = await db.ratings.find_one({
            "job_id": job_id, "rater_id": current_user["id"], "rated_id": crew_id
        })
        if existing:
            raise HTTPException(status_code=400, detail="Already rated this crew member — cannot skip")

        if crew_id in job.get("skipped_ratings", []):
            return {"message": "Rating already skipped", "crew_id": crew_id}

        await db.jobs.update_one({"id": job_id}, {"$addToSet": {"skipped_ratings": crew_id}})

    elif is_crew:
        contractor_id = data.contractor_id or job["contractor_id"]

        existing = await db.ratings.find_one({
            "rater_id": current_user["id"],
            "rated_id": contractor_id
        })
        if existing:
            raise HTTPException(status_code=400, detail="Already rated this contractor — cannot skip")

        if current_user["id"] in job.get("rated_by_crew", []):
            return {"message": "Rating already handled for this contractor", "contractor_id": contractor_id}

        await db.jobs.update_one({"id": job_id}, {"$addToSet": {"rated_by_crew": current_user["id"]}})

        updated_job = await db.jobs.find_one({"id": job_id}, {"_id": 0})
        if updated_job:
            crew_accepted = updated_job.get("crew_accepted", [])
            handled = set(updated_job.get("rated_crew", [])) | set(updated_job.get("skipped_ratings", []))
            if crew_accepted and all(c in handled for c in crew_accepted):
                await db.jobs.update_one({"id": job_id}, {"$set": {"status": "past"}})

        return {"message": "Rating skipped", "contractor_id": contractor_id}

    else:
        raise HTTPException(status_code=403, detail="Not part of this job")

    # AUTO-MOVE for contractor skip
    updated_job = await db.jobs.find_one({"id": job_id}, {"_id": 0})
    if updated_job:
        crew_accepted = updated_job.get("crew_accepted", [])
        handled = set(updated_job.get("rated_crew", [])) | set(updated_job.get("skipped_ratings", []))
        if crew_accepted and all(c in handled for c in crew_accepted):
            await db.jobs.update_one({"id": job_id}, {"$set": {"status": "past"}})

    return {"message": "Rating skipped", "crew_id": data.crew_id}


@router.get("/{job_id}/ratings")
async def get_job_ratings(job_id: str, current_user: dict = Depends(get_current_user)):
    ratings = await db.ratings.find({"job_id": job_id}, {"_id": 0}).to_list(100)
    return ratings
