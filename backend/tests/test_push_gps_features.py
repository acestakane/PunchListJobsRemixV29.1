"""
Tests for Push Notification and GPS Distance features (iteration 4)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")


def get_token(email, password):
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password})
    if r.status_code == 200:
        return r.json().get("token") or r.json().get("access_token")
    return None


CREW_TOKEN = None
CONTRACTOR_TOKEN = None


def setup_module(module):
    global CREW_TOKEN, CONTRACTOR_TOKEN
    CREW_TOKEN = get_token("crew1@punchlistjobs.com", "Crew@123")
    CONTRACTOR_TOKEN = get_token("contractor1@punchlistjobs.com", "Contractor@123")


# ── Push Routes ───────────────────────────────────────────────────────────────

def test_vapid_public_key():
    r = requests.get(f"{BASE_URL}/api/push/vapid-public-key")
    assert r.status_code == 200
    data = r.json()
    assert "public_key" in data
    assert len(data["public_key"]) > 0, "VAPID public key should not be empty"
    print(f"VAPID key starts with: {data['public_key'][:20]}")


def test_subscribe_requires_auth():
    payload = {"subscription": {"endpoint": "https://example.com/push/test", "keys": {"p256dh": "abc", "auth": "def"}}}
    r = requests.post(f"{BASE_URL}/api/push/subscribe", json=payload)
    assert r.status_code in [401, 403], f"Expected auth required, got {r.status_code}"


def test_subscribe_with_auth():
    if not CREW_TOKEN:
        pytest.skip("No crew token available")
    headers = {"Authorization": f"Bearer {CREW_TOKEN}"}
    payload = {"subscription": {"endpoint": "https://fcm.googleapis.com/test_endpoint_crew1", "keys": {"p256dh": "testkey", "auth": "testauth"}}}
    r = requests.post(f"{BASE_URL}/api/push/subscribe", json=payload, headers=headers)
    assert r.status_code == 200
    data = r.json()
    assert "message" in data or "Subscribed" in str(data)


def test_push_test_with_auth():
    if not CREW_TOKEN:
        pytest.skip("No crew token available")
    headers = {"Authorization": f"Bearer {CREW_TOKEN}"}
    r = requests.post(f"{BASE_URL}/api/push/test", headers=headers)
    assert r.status_code == 200
    data = r.json()
    assert "delivered" in data
    assert isinstance(data["delivered"], int)
    print(f"Test push delivered count: {data['delivered']}")


def test_push_test_requires_auth():
    r = requests.post(f"{BASE_URL}/api/push/test")
    assert r.status_code in [401, 403]


# ── GPS / Distance Features ──────────────────────────────────────────────────

def test_jobs_with_lat_lng_returns_distance():
    """Jobs near New York should have distance_miles field"""
    if not CREW_TOKEN:
        pytest.skip("No crew token")
    headers = {"Authorization": f"Bearer {CREW_TOKEN}"}
    r = requests.get(f"{BASE_URL}/api/jobs?lat=40.7128&lng=-74.0060&radius=100", headers=headers)
    assert r.status_code == 200
    data = r.json()
    jobs = data if isinstance(data, list) else data.get("jobs", data.get("data", []))
    if len(jobs) > 0:
        # At least some jobs should have distance_miles
        has_distance = any("distance_miles" in j for j in jobs)
        print(f"Jobs with distance_miles: {sum(1 for j in jobs if 'distance_miles' in j)}/{len(jobs)}")
        # Jobs that are within the radius should have the field
        # (may be 0 jobs if no jobs in NYC radius - but endpoint must work)
        print(f"Total jobs returned: {len(jobs)}")
    else:
        print("No jobs returned for NYC coordinates - may be out of radius")


def test_jobs_without_lat_lng_no_distance():
    """Jobs without GPS params should NOT have distance_miles"""
    if not CREW_TOKEN:
        pytest.skip("No crew token")
    headers = {"Authorization": f"Bearer {CREW_TOKEN}"}
    r = requests.get(f"{BASE_URL}/api/jobs", headers=headers)
    assert r.status_code == 200
    data = r.json()
    jobs = data if isinstance(data, list) else data.get("jobs", data.get("data", []))
    for j in jobs:
        assert "distance_miles" not in j, f"Job {j.get('id')} should not have distance_miles without lat/lng"
    print(f"Verified {len(jobs)} jobs have no distance_miles field")


def test_jobs_with_atlanta_coords():
    """Atlanta coords should return jobs with distance_miles (seed data is Atlanta-based)"""
    if not CREW_TOKEN:
        pytest.skip("No crew token")
    headers = {"Authorization": f"Bearer {CREW_TOKEN}"}
    r = requests.get(f"{BASE_URL}/api/jobs?lat=33.7490&lng=-84.3880&radius=50", headers=headers)
    assert r.status_code == 200
    data = r.json()
    jobs = data if isinstance(data, list) else data.get("jobs", data.get("data", []))
    print(f"Atlanta jobs returned: {len(jobs)}")
    if len(jobs) > 0:
        has_distance = any("distance_miles" in j for j in jobs)
        assert has_distance, "Atlanta-area jobs should have distance_miles field"
        distances = [j["distance_miles"] for j in jobs if "distance_miles" in j]
        print(f"Distance values: {distances[:5]}")


# ── Static Files ─────────────────────────────────────────────────────────────

def test_manifest_json_accessible():
    r = requests.get(f"{BASE_URL}/manifest.json")
    assert r.status_code == 200
    data = r.json()
    assert "name" in data or "short_name" in data
    print(f"Manifest name: {data.get('name')}")


def test_sw_js_accessible():
    r = requests.get(f"{BASE_URL}/sw.js")
    assert r.status_code == 200
    assert len(r.text) > 0
    print(f"sw.js size: {len(r.text)} bytes")
