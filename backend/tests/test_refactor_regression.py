"""
Regression tests for refactor tasks:
- Admin analytics API (analytics_helpers.py extraction)
- Itinerary API for crew and contractor
"""
import pytest
import requests
import os

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")


def get_token(email, password):
    resp = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password})
    if resp.status_code == 200:
        return resp.json().get("access_token")
    return None


@pytest.fixture(scope="module")
def admin_token():
    token = get_token("superadmin@punchlistjobs.com", "SuperAdmin@123")
    if not token:
        pytest.skip("Admin login failed")
    return token


@pytest.fixture(scope="module")
def crew_token():
    token = get_token("crew1@punchlistjobs.com", "Crew@123")
    if not token:
        pytest.skip("Crew login failed")
    return token


@pytest.fixture(scope="module")
def contractor_token():
    token = get_token("contractor1@punchlistjobs.com", "Contractor@123")
    if not token:
        pytest.skip("Contractor login failed")
    return token


# Admin Analytics API
class TestAdminAnalytics:
    """Test that analytics endpoint returns all expected fields after helper extraction"""

    def test_analytics_returns_200(self, admin_token):
        resp = requests.get(
            f"{BASE_URL}/api/admin/analytics",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"

    def test_analytics_has_required_fields(self, admin_token):
        resp = requests.get(
            f"{BASE_URL}/api/admin/analytics",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        data = resp.json()
        # Core fields that must be present
        assert "total_users" in data, "Missing total_users"
        assert "crew_count" in data, "Missing crew_count"
        assert "active_jobs" in data, "Missing active_jobs"
        assert "total_revenue" in data, "Missing total_revenue"

    def test_analytics_field_types(self, admin_token):
        resp = requests.get(
            f"{BASE_URL}/api/admin/analytics",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        data = resp.json()
        assert isinstance(data["total_users"], int)
        assert isinstance(data["crew_count"], int)
        assert isinstance(data["active_jobs"], int)
        assert isinstance(data["total_revenue"], (int, float))


# Itinerary API
class TestItineraryAPI:
    """Test itinerary endpoint for crew and contractor"""

    def test_crew_itinerary_returns_200(self, crew_token):
        resp = requests.get(
            f"{BASE_URL}/api/jobs/itinerary",
            headers={"Authorization": f"Bearer {crew_token}"}
        )
        assert resp.status_code == 200, f"Got {resp.status_code}: {resp.text}"

    def test_crew_itinerary_returns_list(self, crew_token):
        resp = requests.get(
            f"{BASE_URL}/api/jobs/itinerary",
            headers={"Authorization": f"Bearer {crew_token}"}
        )
        data = resp.json()
        assert isinstance(data, list)

    def test_contractor_itinerary_returns_200(self, contractor_token):
        resp = requests.get(
            f"{BASE_URL}/api/jobs/itinerary",
            headers={"Authorization": f"Bearer {contractor_token}"}
        )
        assert resp.status_code == 200, f"Got {resp.status_code}: {resp.text}"

    def test_contractor_itinerary_returns_list(self, contractor_token):
        resp = requests.get(
            f"{BASE_URL}/api/jobs/itinerary",
            headers={"Authorization": f"Bearer {contractor_token}"}
        )
        data = resp.json()
        assert isinstance(data, list)
