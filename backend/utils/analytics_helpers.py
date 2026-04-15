"""
Analytics helper functions that extract DB queries from the get_analytics route.
Each function runs its segment of DB queries and returns a partial dict.
"""
from database import db

ADMIN_ROLES = ("admin", "superadmin")


async def fetch_user_stats() -> dict:
    """Return user-count analytics."""
    total_users = await db.users.count_documents({"role": {"$nin": list(ADMIN_ROLES)}})
    crew_count = await db.users.count_documents({"role": "crew"})
    contractor_count = await db.users.count_documents({"role": "contractor"})
    return {
        "total_users": total_users,
        "crew_count": crew_count,
        "contractor_count": contractor_count,
    }


async def fetch_job_stats() -> dict:
    """Return job-count analytics."""
    active_jobs = await db.jobs.count_documents({"status": {"$in": ["open", "fulfilled", "in_progress"]}})
    completed_jobs = await db.jobs.count_documents({"status": "completed"})
    total_jobs = await db.jobs.count_documents({})
    return {
        "active_jobs": active_jobs,
        "completed_jobs": completed_jobs,
        "total_jobs": total_jobs,
    }


async def fetch_subscription_stats() -> dict:
    """Return subscription-tier counts."""
    active_subs = await db.users.count_documents({"subscription_status": "active"})
    trial_subs = await db.users.count_documents({"subscription_status": "trial"})
    expired_subs = await db.users.count_documents({"subscription_status": "expired"})
    return {
        "active_subscriptions": active_subs,
        "trial_subscriptions": trial_subs,
        "expired_subscriptions": expired_subs,
    }


async def fetch_revenue_data() -> dict:
    """Return revenue totals and breakdown by payment method."""
    payments = await db.payment_transactions.find(
        {"payment_status": "paid"},
        {"_id": 0, "amount": 1, "plan": 1, "payment_method": 1, "created_at": 1},
    ).to_list(1000)

    total_revenue = sum(p.get("amount", 0) for p in payments)
    revenue_by_method: dict = {}
    for p in payments:
        m = p.get("payment_method", "unknown")
        revenue_by_method[m] = round(revenue_by_method.get(m, 0) + p.get("amount", 0), 2)

    return {
        "total_revenue": round(total_revenue, 2),
        "revenue_by_method": revenue_by_method,
    }


async def fetch_performance_data(crew_count: int, completed_jobs: int, total_jobs: int) -> dict:
    """Return crew utilisation, leaderboards and job-by-trade breakdown."""
    active_crew = await db.users.count_documents({"role": "crew", "jobs_completed": {"$gt": 0}})
    crew_utilization = round((active_crew / crew_count * 100) if crew_count > 0 else 0, 1)
    online_crew = await db.users.count_documents({"role": "crew", "is_online": True})
    job_completion_rate = round((completed_jobs / total_jobs * 100) if total_jobs > 0 else 0, 1)

    top_contractors = await db.payment_transactions.aggregate([
        {"$match": {"payment_status": "paid"}},
        {"$group": {"_id": "$user_id", "total": {"$sum": "$amount"}, "count": {"$sum": 1}}},
        {"$sort": {"total": -1}},
        {"$limit": 5},
    ]).to_list(5)
    for c in top_contractors:
        u = await db.users.find_one({"id": c["_id"]}, {"_id": 0, "name": 1, "company_name": 1})
        c["name"] = (u.get("company_name") or u.get("name", "Unknown")) if u else "Unknown"
        c["total"] = round(c["total"], 2)

    top_crew = await db.users.find(
        {"role": "crew"},
        {"_id": 0, "name": 1, "jobs_completed": 1, "rating": 1, "trade": 1},
    ).sort("jobs_completed", -1).limit(5).to_list(5)

    jobs_by_trade_raw = await db.jobs.aggregate([
        {"$group": {"_id": "$trade", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 8},
    ]).to_list(8)

    return {
        "crew_utilization": crew_utilization,
        "online_crew": online_crew,
        "job_completion_rate": job_completion_rate,
        "top_contractors": top_contractors,
        "top_crew": top_crew,
        "jobs_by_trade": [{"trade": j["_id"] or "other", "count": j["count"]} for j in jobs_by_trade_raw],
    }


async def fetch_recent_users() -> list:
    """Return the 10 most recently created users (excluding password hash)."""
    return await db.users.find({}, {"_id": 0, "password_hash": 0}).sort("created_at", -1).to_list(10)
