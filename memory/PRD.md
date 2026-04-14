# PunchListJobs — PRD

## Problem Statement
Pull GitHub repository (PunchListJobsRemixV27) and run as a standalone application with demo accounts, mocked payment keys, and preview URL access.

## Architecture
- **Frontend**: React 19 + Tailwind + craco (port 3000)
- **Backend**: FastAPI + Motor/MongoDB (port 8001, prefix `/api`)
- **Database**: MongoDB (punchlistjobs)
- **Auth**: JWT (HS256, 24h expiry)
- **Payments**: Square SDK (mocked — empty token → demo mode)
- **AI**: Emergent LLM key (OpenAI GPT-4o for job matching & fraud detection)

## Core Requirements (static)
- Blue-collar workforce marketplace
- Contractors post jobs; Crew members apply
- Admin/SuperAdmin manage platform
- Subscription-gated features (free tier included)
- Real-time WebSocket notifications

## What's Been Implemented (with dates)

### 2026-04-14 — Initial Setup
- Cloned repo from GitHub (PunchListJobsRemixV27)
- Installed all backend deps (apscheduler, squareup, emergentintegrations)
- Installed all frontend deps (dompurify, leaflet, react-leaflet, react-google-recaptcha, react-helmet-async, react-square-web-payments-sdk)
- Configured backend .env (MONGO_URL, DB_NAME=punchlistjobs, JWT, EMERGENT_LLM_KEY, SQUARE mock)
- All 11 demo accounts seeded on startup (SuperAdmin, Admin, SubAdmin, 5 Crew, 3 Contractors)
- Services running via supervisor (hot reload enabled)

### 2026-04-14 — Phase 7: Travel Display Admin Toggle (P2)
- Added `show_travel_distance` field to `SettingsUpdate` model (backend/models.py)
- Added default `show_travel_distance: True` to settings init + migration (backend/server.py)
- Exposed `show_travel_distance` in `/api/settings/public` endpoint
- Added toggle in Admin SettingsTab.jsx under "Crew Features" section
- Updated CrewProfileModal.jsx to fetch public settings and conditionally render travel/transportation info when enabled

### 2026-04-14 — Phase 8: Code Refactor (P3)
- Created `backend/utils/job_helpers.py` with:
  - `RATING_VALID_STATUSES`, `ACTIVE_STATUSES`, `STALE_STATUSES` constants
  - `assert_rating_allowed()`, `assert_rating_status()`, `assert_job_participant()`, `assert_stars_valid()` helpers
- Refactored `job_routes.py`:
  - `rate_user()` uses helpers (removed ~15 lines of duplicate validation)
  - `skip_rating()` uses helpers (removed ~15 lines of duplicate validation)
  - `jobs_itinerary()` uses `ACTIVE_STATUSES` / `STALE_STATUSES` constants

## Prioritized Backlog

### P0 — Blocking
- None

### P1 — High Priority
- Contractor login UI redirect investigation (minor frontend race condition found in testing)

### P2 — Medium Priority  
- Phase 7 done ✅

### P3 — Low Priority / Tech Debt
- Phase 8 partial ✅ (ContractorDashboard.jsx state transitions not yet simplified)
- Email notifications (send_job_completion_email is wired but SMTP not configured)
- Square payment live keys when ready

## Future/Backlog
- Full Square payment integration (live keys)
- Push notifications (PWA)
- SMS via Twilio
- GPS-based crew proximity matching
