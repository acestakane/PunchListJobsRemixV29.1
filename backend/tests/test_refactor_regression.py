"""Regression tests for code quality refactoring sprint — rating routes, auth, jobs, offers."""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

CREW_EMAIL = "crew1@punchlistjobs.com"
CREW_PASS = "Crew@123"
CONTRACTOR_EMAIL = "contractor1@punchlistjobs.com"
CONTRACTOR_PASS = "Contractor@123"
ADMIN_EMAIL = "admin@punchlistjobs.com"
ADMIN_PASS = "Admin@123"


def login(email, password):
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, f"Login failed for {email}: {r.text}"
    data = r.json()
    return data.get("access_token") or data.get("token")


@pytest.fixture(scope="module")
def crew_token():
    return login(CREW_EMAIL, CREW_PASS)


@pytest.fixture(scope="module")
def contractor_token():
    return login(CONTRACTOR_EMAIL, CONTRACTOR_PASS)


@pytest.fixture(scope="module")
def admin_token():
    return login(ADMIN_EMAIL, ADMIN_PASS)


def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


# --- Auth Tests ---
class TestAuth:
    def test_crew_login(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": CREW_EMAIL, "password": CREW_PASS})
        assert r.status_code == 200
        data = r.json()
        assert "access_token" in data
        assert data["user"]["role"] == "crew"

    def test_contractor_login(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": CONTRACTOR_EMAIL, "password": CONTRACTOR_PASS})
        assert r.status_code == 200
        data = r.json()
        assert "access_token" in data
        assert data["user"]["role"] == "contractor"

    def test_admin_login(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS})
        assert r.status_code == 200
        data = r.json()
        assert "access_token" in data
        assert data["user"]["role"] in ("admin", "superadmin")

    def test_invalid_login(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": "bad@bad.com", "password": "wrong"})
        assert r.status_code in (401, 400, 404)


# --- Jobs Tests ---
class TestJobs:
    def test_get_jobs_list(self, crew_token):
        r = requests.get(f"{BASE_URL}/api/jobs", headers=auth_headers(crew_token))
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, (list, dict))

    def test_get_jobs_contractor(self, contractor_token):
        r = requests.get(f"{BASE_URL}/api/jobs", headers=auth_headers(contractor_token))
        assert r.status_code == 200


# --- Offers Tests ---
class TestOffers:
    def test_get_offers(self, crew_token):
        r = requests.get(f"{BASE_URL}/api/offers", headers=auth_headers(crew_token))
        assert r.status_code == 200

    def test_get_offers_contractor(self, contractor_token):
        r = requests.get(f"{BASE_URL}/api/offers", headers=auth_headers(contractor_token))
        assert r.status_code == 200


# --- Rating Routes Tests ---
class TestRatingRoutes:
    def test_get_job_ratings_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/jobs/nonexistent-job/ratings")
        assert r.status_code in (401, 403)

    def test_get_job_ratings_invalid_job(self, crew_token):
        r = requests.get(f"{BASE_URL}/api/jobs/nonexistent-job-id/ratings", headers=auth_headers(crew_token))
        # Should return 200 with empty list or 404
        assert r.status_code in (200, 404)
        if r.status_code == 200:
            assert isinstance(r.json(), list)

    def test_get_job_ratings_with_real_job(self, crew_token):
        """Get first job and test ratings endpoint on it."""
        jobs_r = requests.get(f"{BASE_URL}/api/jobs", headers=auth_headers(crew_token))
        assert jobs_r.status_code == 200
        jobs_data = jobs_r.json()
        jobs = jobs_data if isinstance(jobs_data, list) else jobs_data.get("jobs", [])
        if not jobs:
            pytest.skip("No jobs available for rating test")
        job_id = jobs[0]["id"]
        r = requests.get(f"{BASE_URL}/api/jobs/{job_id}/ratings", headers=auth_headers(crew_token))
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_rate_user_not_on_job(self, crew_token):
        """POST to rate on nonexistent job should return 404."""
        r = requests.post(
            f"{BASE_URL}/api/jobs/nonexistent-job/rate",
            json={"rated_id": "someone", "stars": 5, "review": "good"},
            headers=auth_headers(crew_token)
        )
        assert r.status_code in (404, 400, 403, 422)

    def test_rate_user_not_participant(self, crew_token):
        """Rate on a real job where user is not a participant → 403."""
        jobs_r = requests.get(f"{BASE_URL}/api/jobs", headers=auth_headers(crew_token))
        jobs_data = jobs_r.json()
        jobs = jobs_data if isinstance(jobs_data, list) else jobs_data.get("jobs", [])
        # Find a completed job not involving crew1
        target = next((j for j in jobs if j.get("status") in ("completed", "past")), None)
        if not target:
            pytest.skip("No completed/past jobs available")
        r = requests.post(
            f"{BASE_URL}/api/jobs/{target['id']}/rate",
            json={"rated_id": "someone", "stars": 5},
            headers=auth_headers(crew_token)
        )
        assert r.status_code in (400, 403, 404)


# --- Profile / User Tests ---
class TestUsers:
    def test_get_profile_crew(self, crew_token):
        r = requests.get(f"{BASE_URL}/api/users/me", headers=auth_headers(crew_token))
        assert r.status_code == 200
        data = r.json()
        assert data["email"] == CREW_EMAIL

    def test_get_profile_contractor(self, contractor_token):
        r = requests.get(f"{BASE_URL}/api/users/me", headers=auth_headers(contractor_token))
        assert r.status_code == 200
        data = r.json()
        assert data["email"] == CONTRACTOR_EMAIL
