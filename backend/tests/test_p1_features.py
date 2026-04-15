"""
P1 Feature Tests:
1. GET /api/jobs/{id}/assignments - admin audit endpoint
2. POST /api/auth/register - after auth_helpers refactor
3. Admin analytics fields
"""
import pytest
import requests
import os

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")


def get_token(email, password):
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password})
    if r.status_code == 200:
        return r.json().get("access_token")
    return None


@pytest.fixture(scope="module")
def admin_token():
    return get_token("admin@punchlistjobs.com", "Admin@123")


@pytest.fixture(scope="module")
def crew_token():
    return get_token("crew1@punchlistjobs.com", "Crew@123")


@pytest.fixture(scope="module")
def contractor_token():
    return get_token("contractor1@punchlistjobs.com", "Contractor@123")


@pytest.fixture(scope="module")
def job_id_with_assignments(admin_token):
    """Find a job that likely has assignments (in_progress or fulfilled or completed)"""
    headers = {"Authorization": f"Bearer {admin_token}"}
    r = requests.get(f"{BASE_URL}/api/admin/jobs?limit=50", headers=headers)
    assert r.status_code == 200
    jobs = r.json()
    if isinstance(jobs, dict):
        jobs = jobs.get("jobs", [])
    for j in jobs:
        if j.get("status") in ("in_progress", "fulfilled", "completed", "pending_complete"):
            return j["id"]
    # fallback: return any job id
    if jobs:
        return jobs[0]["id"]
    return None


# --- GET /api/jobs/{id}/assignments ---

class TestJobAssignmentsEndpoint:
    """Tests for GET /api/jobs/{id}/assignments"""

    def test_admin_can_get_assignments(self, admin_token, job_id_with_assignments):
        """Admin should get 200 with expected fields"""
        if not job_id_with_assignments:
            pytest.skip("No job found")
        headers = {"Authorization": f"Bearer {admin_token}"}
        r = requests.get(f"{BASE_URL}/api/jobs/{job_id_with_assignments}/assignments", headers=headers)
        assert r.status_code == 200
        data = r.json()
        assert "job_id" in data
        assert "job_title" in data
        assert "job_status" in data
        assert "assignments" in data
        assert "status_history" in data
        assert isinstance(data["assignments"], list)
        assert isinstance(data["status_history"], list)
        print(f"PASS: admin got assignments for job {job_id_with_assignments}, {len(data['assignments'])} assignments")

    def test_crew_cannot_get_unowned_job_assignments(self, crew_token, job_id_with_assignments):
        """Crew user should get 403 for a job they don't own"""
        if not job_id_with_assignments:
            pytest.skip("No job found")
        headers = {"Authorization": f"Bearer {crew_token}"}
        r = requests.get(f"{BASE_URL}/api/jobs/{job_id_with_assignments}/assignments", headers=headers)
        # Crew is not admin or contractor, should get 403
        assert r.status_code == 403
        print(f"PASS: crew got 403 as expected")

    def test_invalid_job_id_returns_404(self, admin_token):
        """Non-existent job should return 404"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        r = requests.get(f"{BASE_URL}/api/jobs/nonexistent-job-xyz/assignments", headers=headers)
        assert r.status_code == 404

    def test_unauthenticated_returns_401(self, job_id_with_assignments):
        """No token should return 401"""
        if not job_id_with_assignments:
            pytest.skip("No job found")
        r = requests.get(f"{BASE_URL}/api/jobs/{job_id_with_assignments}/assignments")
        assert r.status_code in (401, 403)


# --- POST /api/auth/register after refactor ---

class TestRegisterAfterRefactor:
    """Verify register still works after auth_helpers extraction"""

    def test_register_new_user_returns_token(self):
        import uuid
        unique_email = f"TEST_reg_{uuid.uuid4().hex[:8]}@example.com"
        payload = {
            "email": unique_email,
            "password": "TestPass@123",
            "role": "crew",
            "name": "Test Crew User",
            "phone": "5550001111",
        }
        r = requests.post(f"{BASE_URL}/api/auth/register", json=payload)
        assert r.status_code in (200, 201), f"Expected 200/201, got {r.status_code}: {r.text}"
        data = r.json()
        assert "access_token" in data, f"access_token not in response: {data}"
        assert isinstance(data["access_token"], str)
        assert len(data["access_token"]) > 10
        print(f"PASS: registered {unique_email} successfully")

    def test_register_duplicate_email_returns_error(self):
        """Registering existing email should return 400"""
        r = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": "crew1@punchlistjobs.com",
            "password": "Crew@123",
            "role": "crew",
            "name": "Duplicate",
            "phone": "5550000000",
        })
        assert r.status_code in (400, 409), f"Expected 400/409, got {r.status_code}"
        print("PASS: duplicate email rejected")


# --- Admin analytics ---

class TestAdminAnalytics:
    """Verify analytics endpoint returns expected fields"""

    def test_analytics_fields(self, admin_token):
        headers = {"Authorization": f"Bearer {admin_token}"}
        r = requests.get(f"{BASE_URL}/api/admin/analytics", headers=headers)
        assert r.status_code == 200
        data = r.json()
        for field in ["total_users", "crew_count", "active_jobs", "total_revenue"]:
            assert field in data, f"Missing field: {field}"
        print(f"PASS: analytics fields present: {list(data.keys())[:8]}")
