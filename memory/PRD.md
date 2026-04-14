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

### 2026-04-14 — Job Lifecycle Refactor (Spec-Compliant)
- **New `utils/assignment_helpers.py`**: CrewAssignment state machine (assigned→pending_complete→approved_complete|removed), `maybe_complete_job`, `force_close_assignments`, `log_status_history`, `get_or_create_assignment`
- **New `crew_assignments` collection**: Unique(job_id, crew_id), indexed on status/pending_complete_at
- **New `status_history` collection**: Append-only audit log for every state transition
- **`job_helpers.py`**: `RATING_VALID_STATUSES = (completed, cancelled, suspended)` — eliminates premature ratings
- **`job_routes.py`**: `crew-complete` rewritten (idempotent, assignment-backed), new `approve-complete` per-crew, new `remove` endpoint, `cancel_job` + `suspend_job` call `force_close_assignments`, `verify_job` uses `maybe_complete_job`
- **`server.py`**: DB indices, startup migration (legacy crew_accepted → assignments), `auto_approve_pending_crew()` 72h scheduler
- **`JobsItinerary.jsx`**: Premature rating removed from `handleCrewComplete`, PAST_STATUSES uses `my_assignment_status`, per-crew Approve buttons for contractor when `pending_complete`, `crewCompleteLoading` debounce guard
- **`ContractorDashboard.jsx`**: `approveCrewComplete` helper, `pending_complete` label, per-crew approval panel
- Created `backend/utils/job_helpers.py` with RATING_VALID_STATUSES, ACTIVE_STATUSES, STALE_STATUSES constants + 4 guard helpers
- Refactored `job_routes.py`: rate_user() and skip_rating() each trimmed ~15 lines of duplicate validation; status constants shared
- ContractorDashboard.jsx: 7 repetitive status transition functions consolidated into single `jobAction` helper (~45 lines removed)
- Travel Radius end-to-end: `travel_radius_miles` field in models.py, `min_travel_radius` query filter in user_routes.py, ProfilePage edit+view, CrewProfileModal display, ContractorDashboard crew search dropdown

## Prioritized Backlog

### P0 — Blocking
- None

### P1 — High Priority
- None outstanding

### P2 — Medium Priority
- Phase 7 done
- Phase 8 done

### P3 — Low Priority / Tech Debt
- Email notifications (send_job_completion_email is wired but SMTP not configured)
- Square payment live keys when ready

## Future/Backlog
- Full Square payment integration (live keys)
- Push notifications (PWA)
- SMS via Twilio
- GPS-based crew proximity matching
