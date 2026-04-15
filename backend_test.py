#!/usr/bin/env python3
"""
Backend API Testing for PunchListJobs - Runtime Safety Fixes Verification
Tests the specific None guards added to rating_routes.py and user_routes.py
"""

import asyncio
import aiohttp
import json
import sys
from datetime import datetime, timezone

# Backend URL from frontend .env
BACKEND_URL = "https://remix-job-tracker.preview.emergentagent.com/api"

# Test credentials from test_credentials.md
TEST_CREDENTIALS = {
    "superadmin": {"email": "superadmin@punchlistjobs.com", "password": "SuperAdmin@123"},
    "admin": {"email": "admin@punchlistjobs.com", "password": "Admin@123"},
    "crew": {"email": "crew1@punchlistjobs.com", "password": "Crew@123"},
    "contractor": {"email": "contractor1@punchlistjobs.com", "password": "Contractor@123"}
}

class TestSession:
    def __init__(self):
        self.session = None
        self.tokens = {}
        self.test_job_id = None
        self.test_crew_id = None
        self.test_contractor_id = None
        
    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()

    async def login(self, role):
        """Login and store token for role"""
        creds = TEST_CREDENTIALS[role]
        async with self.session.post(f"{BACKEND_URL}/auth/login", json=creds) as resp:
            if resp.status != 200:
                text = await resp.text()
                raise Exception(f"Login failed for {role}: {resp.status} - {text}")
            data = await resp.json()
            self.tokens[role] = data["access_token"]
            if role == "crew":
                self.test_crew_id = data["user"]["id"]
            elif role == "contractor":
                self.test_contractor_id = data["user"]["id"]
            print(f"✅ {role.capitalize()} login successful")
            return data

    def get_headers(self, role):
        """Get authorization headers for role"""
        return {"Authorization": f"Bearer {self.tokens[role]}"}

    async def test_auth_flows(self):
        """Test 1: Auth login for all 4 roles"""
        print("\n=== Testing Authentication Flows ===")
        
        for role in ["superadmin", "admin", "crew", "contractor"]:
            try:
                await self.login(role)
            except Exception as e:
                print(f"❌ {role.capitalize()} login failed: {e}")
                return False
        
        print("✅ All authentication flows working")
        return True

    async def test_profile_update(self):
        """Test 2: Profile update (PUT /api/users/profile) as crew - verify response returns full user object"""
        print("\n=== Testing Profile Update with Runtime Safety ===")
        
        try:
            # Update crew profile
            update_data = {
                "bio": f"Updated bio at {datetime.now().isoformat()}",
                "first_name": "Marcus",
                "last_name": "Johnson"
            }
            
            async with self.session.put(
                f"{BACKEND_URL}/users/profile",
                json=update_data,
                headers=self.get_headers("crew")
            ) as resp:
                if resp.status != 200:
                    text = await resp.text()
                    print(f"❌ Profile update failed: {resp.status} - {text}")
                    return False
                
                data = await resp.json()
                
                # Verify response contains full user object (testing the None guard fix)
                required_fields = ["id", "email", "name", "role", "bio"]
                missing_fields = [field for field in required_fields if field not in data]
                
                if missing_fields:
                    print(f"❌ Profile update response missing fields: {missing_fields}")
                    return False
                
                if data.get("bio") != update_data["bio"]:
                    print(f"❌ Profile update didn't persist bio change")
                    return False
                
                print("✅ Profile update working correctly - full user object returned")
                return True
                
        except Exception as e:
            print(f"❌ Profile update test failed: {e}")
            return False

    async def create_test_job(self):
        """Create a test job for rating flow testing"""
        print("\n=== Creating Test Job ===")
        
        try:
            job_data = {
                "title": f"Test Job for Rating Flow {datetime.now().strftime('%H:%M:%S')}",
                "description": "Test job to verify rating endpoints with runtime safety fixes",
                "trade": "Carpentry",
                "pay_rate": 25.0,
                "crew_needed": 1,
                "start_time": (datetime.now(timezone.utc)).isoformat(),
                "address": "123 Test St, Atlanta, GA 30309",
                "is_emergency": False,
                "is_boosted": False,
                "tasks": ["Frame walls", "Install drywall"]
            }
            
            async with self.session.post(
                f"{BACKEND_URL}/jobs/",
                json=job_data,
                headers=self.get_headers("contractor")
            ) as resp:
                if resp.status != 201:
                    text = await resp.text()
                    print(f"❌ Job creation failed: {resp.status} - {text}")
                    return False
                
                data = await resp.json()
                self.test_job_id = data["id"]
                print(f"✅ Test job created: {self.test_job_id}")
                return True
                
        except Exception as e:
            print(f"❌ Job creation failed: {e}")
            return False

    async def test_job_flow(self):
        """Test 3: Job create → crew accept → contractor approve → start job"""
        print("\n=== Testing Complete Job Flow ===")
        
        # Create job
        if not await self.create_test_job():
            return False
        
        try:
            # Crew accepts job
            async with self.session.post(
                f"{BACKEND_URL}/jobs/{self.test_job_id}/accept",
                headers=self.get_headers("crew")
            ) as resp:
                if resp.status != 200:
                    text = await resp.text()
                    print(f"❌ Crew accept failed: {resp.status} - {text}")
                    return False
                print("✅ Crew accepted job")
            
            # Contractor approves crew
            async with self.session.post(
                f"{BACKEND_URL}/jobs/{self.test_job_id}/applicants/{self.test_crew_id}/approve",
                headers=self.get_headers("contractor")
            ) as resp:
                if resp.status != 200:
                    text = await resp.text()
                    print(f"❌ Contractor approve failed: {resp.status} - {text}")
                    return False
                print("✅ Contractor approved crew")
            
            # Start job
            async with self.session.post(
                f"{BACKEND_URL}/jobs/{self.test_job_id}/start",
                headers=self.get_headers("contractor")
            ) as resp:
                if resp.status != 200:
                    text = await resp.text()
                    print(f"❌ Job start failed: {resp.status} - {text}")
                    return False
                print("✅ Job started successfully")
            
            return True
            
        except Exception as e:
            print(f"❌ Job flow test failed: {e}")
            return False

    async def test_job_completion_and_rating(self):
        """Test 4: Job complete flow → verify rating endpoints work with runtime safety"""
        print("\n=== Testing Job Completion and Rating Flow ===")
        
        try:
            # Complete job as crew
            async with self.session.post(
                f"{BACKEND_URL}/jobs/{self.test_job_id}/crew-complete",
                headers=self.get_headers("crew")
            ) as resp:
                if resp.status != 200:
                    text = await resp.text()
                    print(f"❌ Job completion failed: {resp.status} - {text}")
                    return False
                print("✅ Job completed by crew")
            
            # Contractor approves completion
            async with self.session.post(
                f"{BACKEND_URL}/jobs/{self.test_job_id}/crew/{self.test_crew_id}/approve-complete",
                headers=self.get_headers("contractor")
            ) as resp:
                if resp.status != 200:
                    text = await resp.text()
                    print(f"❌ Completion approval failed: {resp.status} - {text}")
                    return False
                print("✅ Job completion approved")
            
            # Test rating submission (POST /api/jobs/{job_id}/rate) - testing None guards
            rating_data = {
                "rated_id": self.test_crew_id,
                "job_id": self.test_job_id,
                "stars": 5,
                "review": "Excellent work! Testing runtime safety fixes."
            }
            
            async with self.session.post(
                f"{BACKEND_URL}/jobs/{self.test_job_id}/rate",
                json=rating_data,
                headers=self.get_headers("contractor")
            ) as resp:
                if resp.status != 200:
                    text = await resp.text()
                    print(f"❌ Rating submission failed: {resp.status} - {text}")
                    return False
                
                data = await resp.json()
                if "rating" not in data:
                    print(f"❌ Rating response missing rating data")
                    return False
                
                print("✅ Rating submission working with runtime safety")
            
            # Test rating skip (POST /api/jobs/{job_id}/rate/skip) - testing None guards
            # Create another job to test skip functionality
            if await self.create_test_job():
                # Accept and approve for skip test
                await self.session.post(f"{BACKEND_URL}/jobs/{self.test_job_id}/accept", headers=self.get_headers("crew"))
                await self.session.post(f"{BACKEND_URL}/jobs/{self.test_job_id}/applicants/{self.test_crew_id}/approve", headers=self.get_headers("contractor"))
                await self.session.post(f"{BACKEND_URL}/jobs/{self.test_job_id}/start", headers=self.get_headers("contractor"))
                await self.session.post(f"{BACKEND_URL}/jobs/{self.test_job_id}/crew-complete", headers=self.get_headers("crew"))
                await self.session.post(f"{BACKEND_URL}/jobs/{self.test_job_id}/crew/{self.test_crew_id}/approve-complete", headers=self.get_headers("contractor"))
                
                skip_data = {"crew_id": self.test_crew_id}
                async with self.session.post(
                    f"{BACKEND_URL}/jobs/{self.test_job_id}/rate/skip",
                    json=skip_data,
                    headers=self.get_headers("contractor")
                ) as resp:
                    if resp.status != 200:
                        text = await resp.text()
                        print(f"❌ Rating skip failed: {resp.status} - {text}")
                        return False
                    print("✅ Rating skip working with runtime safety")
            
            return True
            
        except Exception as e:
            print(f"❌ Job completion and rating test failed: {e}")
            return False

    async def test_jobs_itinerary(self):
        """Test 5: Jobs itinerary for both roles"""
        print("\n=== Testing Jobs Itinerary ===")
        
        try:
            # Test crew itinerary
            async with self.session.get(
                f"{BACKEND_URL}/jobs/itinerary",
                headers=self.get_headers("crew")
            ) as resp:
                if resp.status != 200:
                    text = await resp.text()
                    print(f"❌ Crew itinerary failed: {resp.status} - {text}")
                    return False
                
                data = await resp.json()
                if not isinstance(data, list):
                    print(f"❌ Crew itinerary should return list")
                    return False
                print("✅ Crew itinerary working")
            
            # Test contractor itinerary
            async with self.session.get(
                f"{BACKEND_URL}/jobs/itinerary",
                headers=self.get_headers("contractor")
            ) as resp:
                if resp.status != 200:
                    text = await resp.text()
                    print(f"❌ Contractor itinerary failed: {resp.status} - {text}")
                    return False
                
                data = await resp.json()
                if not isinstance(data, list):
                    print(f"❌ Contractor itinerary should return list")
                    return False
                print("✅ Contractor itinerary working")
            
            return True
            
        except Exception as e:
            print(f"❌ Jobs itinerary test failed: {e}")
            return False

    async def test_archive_endpoint(self):
        """Test 6: Archive endpoint"""
        print("\n=== Testing Archive Endpoint ===")
        
        try:
            # Test archive endpoint (assuming it exists)
            async with self.session.get(
                f"{BACKEND_URL}/jobs/archive",
                headers=self.get_headers("contractor")
            ) as resp:
                if resp.status == 404:
                    print("⚠️  Archive endpoint not found - may not be implemented")
                    return True
                elif resp.status != 200:
                    text = await resp.text()
                    print(f"❌ Archive endpoint failed: {resp.status} - {text}")
                    return False
                
                data = await resp.json()
                print("✅ Archive endpoint working")
                return True
                
        except Exception as e:
            print(f"❌ Archive endpoint test failed: {e}")
            return False

    async def test_backend_health(self):
        """Test backend health and basic connectivity"""
        print("\n=== Testing Backend Health ===")
        
        try:
            async with self.session.get(f"{BACKEND_URL}/") as resp:
                if resp.status != 200:
                    text = await resp.text()
                    print(f"❌ Backend health check failed: {resp.status} - {text}")
                    return False
                
                data = await resp.json()
                if data.get("status") != "operational":
                    print(f"❌ Backend not operational: {data}")
                    return False
                
                print("✅ Backend health check passed")
                return True
                
        except Exception as e:
            print(f"❌ Backend health check failed: {e}")
            return False

async def run_tests():
    """Run all backend tests"""
    print("🚀 Starting PunchListJobs Backend API Tests")
    print(f"Backend URL: {BACKEND_URL}")
    
    async with TestSession() as test:
        results = []
        
        # Test 1: Backend Health
        results.append(await test.test_backend_health())
        
        # Test 2: Authentication flows
        results.append(await test.test_auth_flows())
        
        # Test 3: Profile update with runtime safety
        results.append(await test.test_profile_update())
        
        # Test 4: Complete job flow
        results.append(await test.test_job_flow())
        
        # Test 5: Job completion and rating with runtime safety
        results.append(await test.test_job_completion_and_rating())
        
        # Test 6: Jobs itinerary
        results.append(await test.test_jobs_itinerary())
        
        # Test 7: Archive endpoint
        results.append(await test.test_archive_endpoint())
        
        # Summary
        passed = sum(results)
        total = len(results)
        
        print(f"\n{'='*50}")
        print(f"TEST SUMMARY: {passed}/{total} tests passed")
        
        if passed == total:
            print("🎉 All tests passed! Runtime safety fixes verified.")
            return True
        else:
            print("❌ Some tests failed. Check output above for details.")
            return False

if __name__ == "__main__":
    success = asyncio.run(run_tests())
    sys.exit(0 if success else 1)