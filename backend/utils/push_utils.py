"""
push_utils.py — Web Push notification sender using pywebpush + VAPID.
Stores subscriptions in MongoDB `push_subscriptions` collection.
Falls back to logging if VAPID keys are not configured.
"""
import os
import json
import logging
from pywebpush import webpush, WebPushException

logger = logging.getLogger(__name__)

VAPID_PRIVATE_KEY = os.environ.get("VAPID_PRIVATE_KEY", "")
VAPID_PUBLIC_KEY  = os.environ.get("VAPID_PUBLIC_KEY", "")
VAPID_SUBJECT     = os.environ.get("VAPID_SUBJECT", "mailto:admin@punchlistjobs.com")


def _is_configured() -> bool:
    return bool(VAPID_PRIVATE_KEY and VAPID_PUBLIC_KEY)


async def send_push(subscription_info: dict, title: str, body: str, url: str = "/", icon: str = "/icon-192.png") -> bool:
    """
    Send a Web Push notification to a single subscription.
    Returns True on success, False on failure (expired subscriptions included).
    """
    if not _is_configured():
        logger.info(f"[PUSH-MOCK] {title}: {body} → {url}")
        return True

    payload = json.dumps({
        "title": title,
        "body": body,
        "url": url,
        "icon": icon,
    })

    try:
        webpush(
            subscription_info=subscription_info,
            data=payload,
            vapid_private_key=VAPID_PRIVATE_KEY,
            vapid_claims={"sub": VAPID_SUBJECT},
        )
        return True
    except WebPushException as ex:
        if ex.response and ex.response.status_code in (404, 410):
            # Subscription expired/unsubscribed — caller should delete it
            logger.info(f"[PUSH] Subscription expired (410/404): {ex}")
            return False
        logger.warning(f"[PUSH] WebPushException: {ex}")
        return False
    except Exception as ex:
        logger.warning(f"[PUSH] Unexpected error: {ex}")
        return False


async def broadcast_push(db, user_id: str, title: str, body: str, url: str = "/") -> int:
    """
    Broadcast a push notification to all subscriptions for a user.
    Auto-cleans expired subscriptions from DB.
    Returns count of successful deliveries.
    """
    subs = await db.push_subscriptions.find({"user_id": user_id}, {"_id": 0}).to_list(20)
    delivered = 0
    for sub in subs:
        ok = await send_push(sub["subscription"], title, body, url)
        if ok:
            delivered += 1
        else:
            # Clean up expired subscription
            await db.push_subscriptions.delete_one({"endpoint": sub["subscription"].get("endpoint")})
    return delivered
