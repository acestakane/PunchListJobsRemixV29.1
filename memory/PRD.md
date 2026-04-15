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
- **New `utils/assignment_helpers.py`**: CrewAssignment state machine (assigned→pending_complete→approved_complete|removed)
- **New `crew_assignments` collection**: Unique(job_id, crew_id), indexed on status/pending_complete_at
- **New `status_history` collection**: Append-only audit log for every state transition
- **`job_helpers.py`**: Centralized constants (RATING_VALID_STATUSES, ACTIVE_STATUSES, STALE_STATUSES)
- **`job_routes.py`**: Idempotent crew-complete, per-crew approve-complete, 72h auto-approve APScheduler worker
- **`ContractorDashboard.jsx`**: approveCrewComplete helper, per-crew approval panel
- Travel Radius: `travel_radius_miles` field in models.py, profile edit+view, crew search dropdown filter

### Feb 2026 — P0 Security Fixes + P1 Component Refactor
- **P0 Bug Fix**: Fixed TDZ error (`can't access lexical declaration 'isCrew' before initialization`) in JobsItinerary.jsx — moved `isContractor`/`isCrew` declarations to top of component before derived computed values
- **P0 Code Quality**: Removed 2 unused variables (F841) in job_routes.py and payment_routes.py; all Python/JS lints clean
- **P1 Frontend Refactor** — extracted sub-components from large files:
  - `JobsItinerary.jsx` (894→424 lines): extracted to `/components/itinerary/` folder (ItineraryCard, EmptyPane, ItineraryRatingModal, DisputeModal, ItineraryActionBar)
  - `ContractorDashboard.jsx`: extracted ApplicantsPanel and CancelRequestsPanel to `/components/contractor/`
  - `OnboardingModal.jsx` (325→110 lines): extracted OnboardingStep1/2/3 to `/components/onboarding/`
  - `JobMap.jsx` (624→220 lines): extracted mapConstants.js + MapHelpers.jsx to `/components/map/`
  - `ProfilePage.jsx`: extracted SocialShareButtons to `/components/profile/`
- **P1 Backend Refactor** — extracted analytics_helpers.py from admin_routes.py:
  - Created `/backend/utils/analytics_helpers.py` with fetch_user_stats(), fetch_job_stats(), fetch_subscription_stats(), fetch_revenue_data(), fetch_performance_data(), fetch_recent_users()
  - `admin_routes.py` get_analytics() now delegates to helpers (75→12 lines)

## Prioritized Backlog

### P0 — Blocking
- None

### P1 — High Priority
- Add `/api/jobs/{id}/assignments` GET endpoint for admin audit view
- Wire WebSocket `job_completed_final` event to trigger rating prompt in Itinerary
- Component Refactor Phase 2: Further split CrewDashboard.jsx + auth_routes.py register()

### P2 — Medium Priority
- Add `status_history` tab to Admin Job detail view
- Square live keys when ready
- Email: configure SMTP credentials (currently mocked)

### P3 — Low Priority / Tech Debt
- Email notifications (send_job_completion_email is wired but SMTP not configured)
- Square payment live keys when ready

## Future/Backlog
- Full Square payment integration (live keys)
- Push notifications (PWA)
- SMS via Twilio
- GPS-based crew proximity matching
