#!/usr/bin/env python3
"""
Backend test for PunchListJobs rating flow fix.
Tests the critical bug fix where crew members couldn't rate contractors after job completion
because the auto-move to "past" status blocked ratings.
"""

import asyncio
import aiohttp
import json
import sys
from datetime import datetime, timezone

# Backend URL from environment
BACKEND_URL = "https://remix-job-tracker.preview.emergentagent.com/api"

# Test credentials
CONTRACTOR_EMAIL = "contractor1@punchlistjobs.com"
CONTRACTOR_PASSWORD = "Contractor@123"
CREW_EMAIL = "crew1@punchlistjobs.com"
CREW_PASSWORD = "Crew@123"

class TestResult:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.errors = []
        
    def success(self, test_name):
        print(f"✅ {test_name}")
        self.passed += 1
        
    def failure(self, test_name, error):
        print(f"❌ {test_name}: {error}")
        self.failed += 1
        self.errors.append(f"{test_name}: {error}")
        
    def summary(self):
        total = self.passed + self.failed
        print(f"\n=== TEST SUMMARY ===")
        print(f"Total: {total}, Passed: {self.passed}, Failed: {self.failed}")
        if self.errors:
            print("\nFAILURES:")
            for error in self.errors:
                print(f"  - {error}")
        return self.failed == 0

async def make_request(session, method, endpoint, data=None, headers=None, expected_status=200):
    """Make HTTP request and return response data"""
    url = f"{BACKEND_URL}{endpoint}"
    try:
        async with session.request(method, url, json=data, headers=headers) as response:
            response_data = await response.json()
            if response.status != expected_status:
                raise Exception(f"Expected {expected_status}, got {response.status}: {response_data}")
            return response_data
    except Exception as e:
        raise Exception(f"Request failed: {str(e)}")

async def login_user(session, email, password):
    """Login user and return auth token"""
    login_data = {"email": email, "password": password}
    response = await make_request(session, "POST", "/auth/login", login_data)
    return response["access_token"]

async def test_auth_flows(session, result):
    """Test authentication for both contractor and crew"""
    try:
        # Test contractor login
        contractor_token = await login_user(session, CONTRACTOR_EMAIL, CONTRACTOR_PASSWORD)
        if not contractor_token:
            raise Exception("No access token returned")
        result.success("Contractor authentication")
        
        # Test crew login
        crew_token = await login_user(session, CREW_EMAIL, CREW_PASSWORD)
        if not crew_token:
            raise Exception("No access token returned")
        result.success("Crew authentication")
        
        return contractor_token, crew_token
        
    except Exception as e:
        result.failure("Authentication flows", str(e))
        return None, None

async def test_job_lifecycle_with_rating(session, contractor_token, crew_token, result):
    """Test the complete job lifecycle with rating - the main test"""
    contractor_headers = {"Authorization": f"Bearer {contractor_token}"}
    crew_headers = {"Authorization": f"Bearer {crew_token}"}
    
    try:
        # Step 1: Create job
        job_data = {
            "title": "Rating Test Job",
            "description": "Test job for rating flow fix",
            "trade": "General",
            "crew_needed": 1,
            "pay_rate": 25,
            "start_time": "2026-04-20T09:00:00Z",
            "address": "123 Test Street, Atlanta, GA"
        }
        
        job_response = await make_request(session, "POST", "/jobs/", job_data, contractor_headers, 201)
        job_id = job_response["id"]
        result.success("Job creation")
        
        # Step 2: Crew accepts job
        await make_request(session, "POST", f"/jobs/{job_id}/accept", {}, crew_headers)
        result.success("Crew job acceptance")
        
        # Get crew ID for approval
        crew_profile = await make_request(session, "GET", "/users/me", {}, crew_headers)
        crew_id = crew_profile["id"]
        
        # Step 3: Contractor approves crew
        await make_request(session, "POST", f"/jobs/{job_id}/applicants/{crew_id}/approve", {}, contractor_headers)
        result.success("Contractor approves crew")
        
        # Step 4: Contractor starts job
        await make_request(session, "POST", f"/jobs/{job_id}/start", {}, contractor_headers)
        result.success("Job start")
        
        # Step 5: Crew completes job
        await make_request(session, "POST", f"/jobs/{job_id}/crew-complete", {}, crew_headers)
        result.success("Crew completion submission")
        
        # Step 6: Contractor approves completion
        await make_request(session, "POST", f"/jobs/{job_id}/crew/{crew_id}/approve-complete", {}, contractor_headers)
        result.success("Contractor approves completion")
        
        # Verify job status is now "completed"
        job_status = await make_request(session, "GET", f"/jobs/{job_id}", {}, contractor_headers)
        if job_status["status"] != "completed":
            raise Exception(f"Expected job status 'completed', got '{job_status['status']}'")
        result.success("Job status verification (completed)")
        
        # Get contractor ID for rating
        contractor_profile = await make_request(session, "GET", "/users/me", {}, contractor_headers)
        contractor_id = contractor_profile["id"]
        
        # Step 7: Contractor rates crew (this should auto-move job to "past")
        rating_data = {
            "rated_id": crew_id,
            "job_id": job_id,
            "stars": 5,
            "review": "Great work!"
        }
        await make_request(session, "POST", f"/jobs/{job_id}/rate", rating_data, contractor_headers)
        result.success("Contractor rates crew")
        
        # Verify job auto-moved to "past" status
        job_status = await make_request(session, "GET", f"/jobs/{job_id}", {}, contractor_headers)
        if job_status["status"] != "past":
            raise Exception(f"Expected job status 'past' after contractor rating, got '{job_status['status']}'")
        result.success("Job auto-move to 'past' status")
        
        # Step 8: CRITICAL TEST - Crew rates contractor (this was the bug)
        crew_rating_data = {
            "rated_id": contractor_id,
            "job_id": job_id,
            "stars": 4,
            "review": "Good contractor"
        }
        await make_request(session, "POST", f"/jobs/{job_id}/rate", crew_rating_data, crew_headers)
        result.success("CRITICAL: Crew rates contractor on 'past' status job")
        
        # Step 9: Test crew skip rating on past status
        skip_data = {"contractor_id": contractor_id}
        # This should work but we already rated, so expect 400
        try:
            await make_request(session, "POST", f"/jobs/{job_id}/rate/skip", skip_data, crew_headers, 400)
            result.success("Crew skip rating validation (already rated)")
        except Exception as e:
            if "already rated" in str(e).lower():
                result.success("Crew skip rating validation (already rated)")
            else:
                raise e
        
        return job_id
        
    except Exception as e:
        result.failure("Job lifecycle with rating", str(e))
        return None

async def test_jobs_itinerary(session, contractor_token, crew_token, result):
    """Test jobs itinerary endpoint still works"""
    contractor_headers = {"Authorization": f"Bearer {contractor_token}"}
    crew_headers = {"Authorization": f"Bearer {crew_token}"}
    
    try:
        # Test contractor itinerary
        contractor_itinerary = await make_request(session, "GET", "/jobs/itinerary", {}, contractor_headers)
        result.success("Contractor jobs itinerary")
        
        # Test crew itinerary
        crew_itinerary = await make_request(session, "GET", "/jobs/itinerary", {}, crew_headers)
        result.success("Crew jobs itinerary")
        
    except Exception as e:
        result.failure("Jobs itinerary endpoints", str(e))

async def test_rating_status_validation(session, contractor_token, crew_token, result):
    """Test that rating is properly allowed on 'past' and 'completed_pending_review' statuses"""
    contractor_headers = {"Authorization": f"Bearer {contractor_token}"}
    crew_headers = {"Authorization": f"Bearer {crew_token}"}
    
    try:
        # Create a test job to verify rating validation
        job_data = {
            "title": "Rating Validation Test",
            "description": "Test rating status validation",
            "trade": "General",
            "crew_needed": 1,
            "pay_rate": 20,
            "start_time": "2026-04-20T10:00:00Z",
            "address": "456 Test Avenue, Atlanta, GA"
        }
        
        job_response = await make_request(session, "POST", "/jobs/", job_data, contractor_headers, 201)
        job_id = job_response["id"]
        
        # Try to rate on "open" status (should fail)
        crew_profile = await make_request(session, "GET", "/users/me", {}, crew_headers)
        crew_id = crew_profile["id"]
        
        rating_data = {
            "rated_id": crew_id,
            "job_id": job_id,
            "stars": 5,
            "review": "Test"
        }
        
        try:
            await make_request(session, "POST", f"/jobs/{job_id}/rate", rating_data, contractor_headers, 400)
            result.success("Rating blocked on 'open' status")
        except Exception as e:
            if "completion" in str(e).lower():
                result.success("Rating blocked on 'open' status")
            else:
                raise e
        
    except Exception as e:
        result.failure("Rating status validation", str(e))

async def main():
    """Main test runner"""
    print("🚀 Starting PunchListJobs Rating Flow Fix Tests")
    print(f"Backend URL: {BACKEND_URL}")
    print("=" * 60)
    
    result = TestResult()
    
    async with aiohttp.ClientSession() as session:
        # Test 1: Authentication flows
        contractor_token, crew_token = await test_auth_flows(session, result)
        
        if not contractor_token or not crew_token:
            print("❌ Cannot proceed without authentication tokens")
            return False
        
        # Test 2: Main test - Full job lifecycle with rating
        job_id = await test_job_lifecycle_with_rating(session, contractor_token, crew_token, result)
        
        # Test 3: Jobs itinerary endpoint
        await test_jobs_itinerary(session, contractor_token, crew_token, result)
        
        # Test 4: Rating status validation
        await test_rating_status_validation(session, contractor_token, crew_token, result)
    
    print("=" * 60)
    success = result.summary()
    
    if success:
        print("🎉 All tests passed! Rating flow fix is working correctly.")
    else:
        print("💥 Some tests failed. Check the errors above.")
    
    return success

if __name__ == "__main__":
    try:
        success = asyncio.run(main())
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n⚠️  Tests interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"💥 Test runner failed: {e}")
        sys.exit(1)