import uuid
from datetime import datetime, timezone
from database import db
import logging

logger = logging.getLogger(__name__)

# Push is imported lazily to avoid circular imports
_push_utils = None

def _get_push():
    global _push_utils
    if _push_utils is None:
        try:
            from utils import push_utils
            _push_utils = push_utils
        except Exception:
            pass
    return _push_utils


def now_str():
    return datetime.now(timezone.utc).isoformat()


async def create_notification(user_id: str, notif_type: str, title: str, body: str, data: dict = None):
    """Create an in-app notification, send via WebSocket, and fire a Web Push."""
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "type": notif_type,
        "title": title,
        "body": body,
        "data": data or {},
        "is_read": False,
        "created_at": now_str()
    }
    await db.notifications.insert_one(doc)
    safe = {k: v for k, v in doc.items() if k != "_id"}

    # 1. WebSocket (real-time in-app)
    try:
        from routes.ws_routes import manager
        await manager.send_to_user(user_id, {"type": "notification", "notification": safe})
    except Exception:
        pass

    # 2. Web Push (background, when tab is closed)
    push = _get_push()
    if push:
        nav_url = _notif_url(notif_type, data)
        try:
            await push.broadcast_push(db, user_id, title=title, body=body, url=nav_url)
        except Exception as e:
            logger.debug(f"[PUSH] broadcast failed for {notif_type}: {e}")

    return safe


def _notif_url(notif_type: str, data: dict) -> str:
    """Determine the navigation URL for a push based on notification type."""
    if not data:
        return "/"
    job_id = data.get("job_id")
    if notif_type in ("new_applicant", "application_approved", "application_declined",
                      "job_started", "job_completed", "job_cancelled", "cancel_approved",
                      "cancel_denied", "approve_complete"):
        if job_id:
            return "/crew/itinerary"
    if notif_type in ("new_message", "message_received"):
        return "/messages"
    if notif_type == "offer_received":
        return "/crew/dashboard"
    return "/"

