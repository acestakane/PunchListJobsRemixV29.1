#!/usr/bin/env python3
"""
PunchListJobs Backend API Testing Suite
Tests the refactored code after code review fixes.
"""

import asyncio
import json
import uuid
from datetime import datetime, timezone, timedelta
import httpx

# Backend API URL from frontend .env
BASE_URL = "https://remix-job-tracker.preview.emergentagent.com/api"

# Test credentials from test_credentials.md
TEST_CREDENTIALS = {
    "superadmin": {"email": "superadmin@punchlistjobs.com", "password": "SuperAdmin@123"},
    "admin": {"email": "admin@punchlistjobs.com", "password": "Admin@123"},
    "crew": {"email": "crew1@punchlistjobs.com", "password": "Crew@123"},
    "contractor": {"email": "contractor1@punchlistjobs.com", "password": "Contractor@123"}
}

class APITester:
    def __init__(self):
        self.client = httpx.AsyncClient(timeout=30.0)
        self.tokens = {}
        self.test_results = []
        
    async def close(self):
        await self.client.aclose()
    
    def log_result(self, test_name: str, success: bool, details: str = ""):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        self.test_results.append(f"{status} {test_name}: {details}")
        print(f"{status} {test_name}: {details}")
    
    async def login(self, role: str) -> str:
        """Login and return access token"""
        if role in self.tokens:
            return self.tokens[role]
            
        creds = TEST_CREDENTIALS[role]
        try:
            response = await self.client.post(f"{BASE_URL}/auth/login", json={
                "email": creds["email"],
                "password": creds["password"]
            })
            
            if response.status_code == 200:
                data = response.json()
                token = data["access_token"]
                self.tokens[role] = token
                self.log_result(f"Login {role}", True, f"Token obtained")
                return token
            else:
                self.log_result(f"Login {role}", False, f"Status {response.status_code}: {response.text}")
                return ""
        except Exception as e:
            self.log_result(f"Login {role}", False, f"Exception: {str(e)}")
            return ""
    
    async def make_request(self, method: str, endpoint: str, token: str = "", json_data: dict = None, params: dict = None):
        """Make authenticated API request"""
        headers = {"Authorization": f"Bearer {token}"} if token else {}
        try:
            response = await self.client.request(
                method=method,
                url=f"{BASE_URL}{endpoint}",
                headers=headers,
                json=json_data,
                params=params
            )
            return response
        except Exception as e:
            print(f"Request failed: {method} {endpoint} - {str(e)}")
            return None
    
    async def test_auth_flows(self):
        """Test authentication for all 4 roles"""
        print("\n=== Testing Authentication Flows ===")
        
        for role in ["superadmin", "admin", "crew", "contractor"]:
            await self.login(role)
    
    async def test_admin_create_user(self):
        """Test admin create user endpoint with name parsing"""
        print("\n=== Testing Admin Create User (Name Parsing) ===")
        
        admin_token = await self.login("admin")
        if not admin_token:
            self.log_result("Admin Create User", False, "No admin token")
            return
        
        # Test with first_name/last_name
        test_user_data = {
            "email": f"testuser_{uuid.uuid4().hex[:8]}@example.com",
            "password": "TestPass@123",
            "first_name": "John",
            "last_name": "Doe",
            "role": "crew",
            "phone": "555-123-4567"
        }
        
        response = await self.make_request("POST", "/admin/users", admin_token, test_user_data)
        
        if response and response.status_code == 201:
            data = response.json()
            user = data.get("user", {})
            # Check if name parsing worked correctly
            expected_name = "John Doe"
            actual_name = user.get("name", "")
            if actual_name == expected_name:
                self.log_result("Admin Create User", True, f"User created with correct name: {actual_name}")
            else:
                self.log_result("Admin Create User", False, f"Name parsing failed. Expected: {expected_name}, Got: {actual_name}")
        else:
            error_msg = response.text if response else "No response"
            self.log_result("Admin Create User", False, f"Status {response.status_code if response else 'None'}: {error_msg}")
    
    async def test_superadmin_create_admin(self):
        """Test superadmin create admin endpoint"""
        print("\n=== Testing SuperAdmin Create Admin ===")
        
        superadmin_token = await self.login("superadmin")
        if not superadmin_token:
            self.log_result("SuperAdmin Create Admin", False, "No superadmin token")
            return
        
        # Test with first_name/last_name
        test_admin_data = {
            "email": f"testadmin_{uuid.uuid4().hex[:8]}@example.com",
            "password": "AdminPass@123",
            "first_name": "Jane",
            "last_name": "Smith",
            "phone": "555-987-6543"
        }
        
        response = await self.make_request("POST", "/admin/admins", superadmin_token, test_admin_data)
        
        if response and response.status_code == 201:
            data = response.json()
            admin = data.get("admin", {})
            # Check if name parsing worked correctly
            expected_name = "Jane Smith"
            actual_name = admin.get("name", "")
            if actual_name == expected_name:
                self.log_result("SuperAdmin Create Admin", True, f"Admin created with correct name: {actual_name}")
            else:
                self.log_result("SuperAdmin Create Admin", False, f"Name parsing failed. Expected: {expected_name}, Got: {actual_name}")
        else:
            error_msg = response.text if response else "No response"
            self.log_result("SuperAdmin Create Admin", False, f"Status {response.status_code if response else 'None'}: {error_msg}")
    
    async def test_superadmin_create_subadmin(self):
        """Test superadmin create subadmin endpoint"""
        print("\n=== Testing SuperAdmin Create SubAdmin ===")
        
        superadmin_token = await self.login("superadmin")
        if not superadmin_token:
            self.log_result("SuperAdmin Create SubAdmin", False, "No superadmin token")
            return
        
        # Test with name field
        test_subadmin_data = {
            "email": f"testsubadmin_{uuid.uuid4().hex[:8]}@example.com",
            "password": "SubAdminPass@123",
            "name": "Bob Wilson",
            "phone": "555-456-7890"
        }
        
        response = await self.make_request("POST", "/admin/subadmins", superadmin_token, test_subadmin_data)
        
        if response and response.status_code == 201:
            data = response.json()
            subadmin = data.get("subadmin", {})
            # Check if name parsing worked correctly
            expected_name = "Bob Wilson"
            actual_name = subadmin.get("name", "")
            if actual_name == expected_name:
                self.log_result("SuperAdmin Create SubAdmin", True, f"SubAdmin created with correct name: {actual_name}")
            else:
                self.log_result("SuperAdmin Create SubAdmin", False, f"Name parsing failed. Expected: {expected_name}, Got: {actual_name}")
        else:
            error_msg = response.text if response else "No response"
            self.log_result("SuperAdmin Create SubAdmin", False, f"Status {response.status_code if response else 'None'}: {error_msg}")
    
    async def test_jobs_itinerary(self):
        """Test jobs itinerary endpoint for crew and contractor"""
        print("\n=== Testing Jobs Itinerary Endpoint ===")
        
        # Test for crew
        crew_token = await self.login("crew")
        if crew_token:
            response = await self.make_request("GET", "/jobs/itinerary", crew_token)
            if response and response.status_code == 200:
                data = response.json()
                self.log_result("Jobs Itinerary (Crew)", True, f"Retrieved {len(data)} jobs")
            else:
                error_msg = response.text if response else "No response"
                self.log_result("Jobs Itinerary (Crew)", False, f"Status {response.status_code if response else 'None'}: {error_msg}")
        
        # Test for contractor
        contractor_token = await self.login("contractor")
        if contractor_token:
            response = await self.make_request("GET", "/jobs/itinerary", contractor_token)
            if response and response.status_code == 200:
                data = response.json()
                self.log_result("Jobs Itinerary (Contractor)", True, f"Retrieved {len(data)} jobs")
            else:
                error_msg = response.text if response else "No response"
                self.log_result("Jobs Itinerary (Contractor)", False, f"Status {response.status_code if response else 'None'}: {error_msg}")
    
    async def test_job_crud_operations(self):
        """Test job CRUD operations"""
        print("\n=== Testing Job CRUD Operations ===")
        
        contractor_token = await self.login("contractor")
        if not contractor_token:
            self.log_result("Job CRUD", False, "No contractor token")
            return
        
        # Create a job
        job_data = {
            "title": f"Test Job {uuid.uuid4().hex[:8]}",
            "description": "This is a test job for API testing",
            "trade": "Carpentry",
            "discipline": "CARPENTRY",
            "skill": "Framing",
            "crew_needed": 2,
            "pay_rate": 25.50,
            "address": "123 Test Street, Atlanta, GA 30309",
            "start_time": (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat(),
            "is_emergency": False,
            "is_boosted": False,
            "tasks": ["Install framing", "Check measurements", "Clean up"]
        }
        
        # Test GET /jobs first to verify authentication
        response = await self.make_request("GET", "/jobs/", contractor_token)
        
        # Create job
        response = await self.make_request("POST", "/jobs/", contractor_token, job_data)
        if response and response.status_code == 201:
            job = response.json()
            job_id = job["id"]
            self.log_result("Create Job", True, f"Job created with ID: {job_id}")
            
            # Get job by ID
            response = await self.make_request("GET", f"/jobs/{job_id}", contractor_token)
            if response and response.status_code == 200:
                retrieved_job = response.json()
                if retrieved_job["id"] == job_id:
                    self.log_result("Get Job by ID", True, f"Retrieved job: {retrieved_job['title']}")
                else:
                    self.log_result("Get Job by ID", False, "Job ID mismatch")
            else:
                error_msg = response.text if response else "No response"
                self.log_result("Get Job by ID", False, f"Status {response.status_code if response else 'None'}: {error_msg}")
            
            # List jobs
            response = await self.make_request("GET", "/jobs/", contractor_token)
            if response and response.status_code == 200:
                jobs = response.json()
                job_found = any(j["id"] == job_id for j in jobs)
                if job_found:
                    self.log_result("List Jobs", True, f"Found created job in list of {len(jobs)} jobs")
                else:
                    self.log_result("List Jobs", False, "Created job not found in list")
            else:
                error_msg = response.text if response else "No response"
                self.log_result("List Jobs", False, f"Status {response.status_code if response else 'None'}: {error_msg}")
            
            return job_id
        else:
            error_msg = response.text if response else "No response"
            self.log_result("Create Job", False, f"Status {response.status_code if response else 'None'}: {error_msg}")
            return None
    
    async def test_job_accept_flow(self):
        """Test crew accepting a job"""
        print("\n=== Testing Job Accept Flow ===")
        
        # First create a job as contractor
        job_id = await self.test_job_crud_operations()
        if not job_id:
            self.log_result("Job Accept Flow", False, "No job to accept")
            return
        
        # Now try to accept as crew
        crew_token = await self.login("crew")
        if not crew_token:
            self.log_result("Job Accept Flow", False, "No crew token")
            return
        
        response = await self.make_request("POST", f"/jobs/{job_id}/accept", crew_token)
        if response and response.status_code == 200:
            data = response.json()
            message = data.get("message", "")
            if "submitted" in message.lower() or "accepted" in message.lower():
                self.log_result("Job Accept Flow", True, f"Job accept successful: {message}")
            else:
                self.log_result("Job Accept Flow", False, f"Unexpected response: {message}")
        else:
            error_msg = response.text if response else "No response"
            self.log_result("Job Accept Flow", False, f"Status {response.status_code if response else 'None'}: {error_msg}")
    
    async def test_backend_api_health(self):
        """Test basic API health"""
        print("\n=== Testing Backend API Health ===")
        
        response = await self.make_request("GET", "/")
        if response and response.status_code == 200:
            data = response.json()
            if data.get("status") == "operational":
                self.log_result("API Health", True, f"API operational: {data.get('message')}")
            else:
                self.log_result("API Health", False, f"API not operational: {data}")
        else:
            error_msg = response.text if response else "No response"
            self.log_result("API Health", False, f"Status {response.status_code if response else 'None'}: {error_msg}")
    
    async def run_all_tests(self):
        """Run all backend tests"""
        print("🚀 Starting PunchListJobs Backend API Tests")
        print(f"Testing against: {BASE_URL}")
        
        try:
            # Test basic API health
            await self.test_backend_api_health()
            
            # Test authentication flows
            await self.test_auth_flows()
            
            # Test admin user creation with name parsing
            await self.test_admin_create_user()
            
            # Test superadmin admin creation
            await self.test_superadmin_create_admin()
            
            # Test superadmin subadmin creation
            await self.test_superadmin_create_subadmin()
            
            # Test jobs itinerary endpoint
            await self.test_jobs_itinerary()
            
            # Test job accept flow (includes CRUD)
            await self.test_job_accept_flow()
            
        except Exception as e:
            self.log_result("Test Suite", False, f"Unexpected error: {str(e)}")
        
        finally:
            await self.close()
        
        # Print summary
        print("\n" + "="*60)
        print("📊 TEST SUMMARY")
        print("="*60)
        
        passed = sum(1 for result in self.test_results if "✅ PASS" in result)
        failed = sum(1 for result in self.test_results if "❌ FAIL" in result)
        
        for result in self.test_results:
            print(result)
        
        print(f"\n📈 Results: {passed} passed, {failed} failed")
        
        if failed == 0:
            print("🎉 All tests passed!")
        else:
            print(f"⚠️  {failed} test(s) failed - check details above")
        
        return failed == 0

async def main():
    """Main test runner"""
    tester = APITester()
    success = await tester.run_all_tests()
    return success

if __name__ == "__main__":
    success = asyncio.run(main())
    exit(0 if success else 1)