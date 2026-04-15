"""
push_routes.py — Push notification subscription management endpoints.
GET  /push/vapid-public-key   → return VAPID public key for frontend registration
POST /push/subscribe          → save subscription for current user
DELETE /push/unsubscribe      → remove subscription
POST /push/test               → send a test push to the requesting user
"""
import uuid
import os
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from database import db
from auth import get_current_user
from utils.push_utils import broadcast_push

router = APIRouter()


class PushSubscriptionIn(BaseModel):
    subscription: dict   # {endpoint, keys: {p256dh, auth}}


@router.get("/vapid-public-key")
async def get_vapid_public_key():
    key = os.environ.get("VAPID_PUBLIC_KEY", "")
    return {"public_key": key}


@router.post("/subscribe")
async def subscribe_push(body: PushSubscriptionIn, current_user: dict = Depends(get_current_user)):
    endpoint = body.subscription.get("endpoint")
    if not endpoint:
        raise HTTPException(status_code=400, detail="Missing endpoint in subscription")

    # Upsert by endpoint so re-subscribing the same browser doesn't duplicate
    await db.push_subscriptions.update_one(
        {"endpoint": endpoint},
        {"$set": {
            "endpoint": endpoint,
            "user_id": current_user["id"],
            "subscription": body.subscription,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True,
    )
    return {"message": "Subscribed to push notifications"}


@router.delete("/unsubscribe")
async def unsubscribe_push(body: PushSubscriptionIn, current_user: dict = Depends(get_current_user)):
    endpoint = body.subscription.get("endpoint")
    await db.push_subscriptions.delete_one({"endpoint": endpoint, "user_id": current_user["id"]})
    return {"message": "Unsubscribed"}


@router.post("/test")
async def test_push(current_user: dict = Depends(get_current_user)):
    delivered = await broadcast_push(
        db,
        current_user["id"],
        title="PunchListJobs",
        body="Push notifications are working!",
        url="/",
    )
    return {"delivered": delivered, "message": f"Sent to {delivered} device(s)"}
