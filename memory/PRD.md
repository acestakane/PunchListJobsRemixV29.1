# PunchListJobs — PRD

## Problem Statement
Pull GitHub repository (PunchListJobsRemixV27) and run as a standalone application with demo accounts, mocked payment keys, and preview URL access.

## Architecture
- **Frontend**: React 19 + Tailwind + craco (port 3000)
- **Backend**: FastAPI + Motor/MongoDB (port 8001, prefix `/api`)
- **Database**: MongoDB (punchlistjobs)
- **Auth**: JWT (HS256, 24h expiry), token stored in `sessionStorage` as `punchlist_token`
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

### Feb 2026 — P1 Feature Batch
- **GET /api/jobs/{id}/assignments**: New admin audit endpoint — returns all crew assignments for a job enriched with crew profiles + full status_history log. Accessible by admin or job-owning contractor. Returns 403 for crew.
- **WS job_completed_final → Rating Prompt**: `assignment_helpers.py` now includes `contractor_id`+`contractor_name` in the event payload. `JobsItinerary.jsx` listens via `useWebSocket.addListener` — auto-refreshes list + opens rating modal for crew. `CrewDashboard.jsx` shows toast + action button to navigate to /itinerary.
- **auth_helpers.py**: Extracted `resolve_full_name()`, `generate_referral_code()`, `build_user_doc()` from auth_routes.py register() function (90→40 lines)
- **Crew Dashboard Sub-components**: Extracted `CrewDashboardHeader.jsx`, `SubscriptionBanners.jsx`, `JobFiltersRow.jsx` from `CrewDashboard.jsx`
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

### 2026-04-15 — Code Quality & Security Refactoring Sprint
- **P0 Security Fix**: Removed `localStorage.getItem("token")` from `SharedJobPage.jsx` — now relies on axios default Authorization header set by AuthContext (token is in sessionStorage, not localStorage)
- **P1 Hook Deps Fix**: `ProfilePage.jsx` — `fetchRatings` and `fetchReferralInfo` moved before useEffect, wrapped in `useCallback` with proper deps `[user?.id]` and `[]`. Now included in useEffect deps array `[user, userId, fetchReferralInfo, fetchRatings]`.
- **P1 sessionStorage Migration**: `App.js` and `OnboardingModal.jsx` now use `sessionStorage` for the onboarding completion flag (was localStorage). `AppSettingsPage.jsx` intentionally keeps localStorage for persistent UI preferences (dark mode, notification settings).
- **P1 Frontend Refactor** — `AuthPage.jsx` (499→160 lines) split into:
  - `/components/auth/ForgotPasswordPanel.jsx`
  - `/components/auth/ResetPasswordPanel.jsx`
  - `/components/auth/LoginRegisterPanel.jsx`
  - `AuthPage.jsx` is now a thin orchestrator with handler functions + left hero panel
- **P1 Backend Refactor** — `job_routes.py` (1800→1376 lines) cleaned:
  - Created `/backend/routes/rating_routes.py` with `rate_user`, `skip_rating`, `remove_rating`, `get_job_ratings` (4 endpoints)
  - Removed duplicate offer management routes (`/offers/{id}/accept`, `/offers/{id}/counter`, `/offers/{id}/decline`, `/offers/{id}/withdraw`) that were duplicated from `offers_routes.py`
  - `server.py` registers `rating_router` at prefix `/api/jobs`
- **Minor Fix**: Fixed React hydration warning in `TradeSelect.jsx` — `{"\u00A0\u00A0"}{t.name}` → `{"\u00A0\u00A0${t.name}"}` (single text node inside option)
- **Testing**: 100% pass rate (14 backend tests, all frontend flows including auth, dashboard, profile, itinerary)

## File Structure (Current)
```
/app/
├── backend/
│   ├── routes/
│   │   ├── job_routes.py       (~1376 lines, main job CRUD)
│   │   ├── rating_routes.py    (NEW: 4 rating endpoints)
│   │   ├── offers_routes.py    (standalone offer management)
│   │   ├── admin_routes.py     (admin + analytics)
│   │   ├── auth_routes.py      (login, register, reset)
│   │   └── ...others
│   ├── utils/
│   │   ├── analytics_helpers.py
│   │   ├── auth_helpers.py
│   │   ├── job_helpers.py
│   │   └── assignment_helpers.py
│   ├── models.py
│   ├── server.py
│   ├── auth.py
│   └── database.py
├── frontend/
│   ├── src/
│   │   ├── pages/ (AuthPage.jsx thin, ProfilePage.jsx fixed hooks, etc.)
│   │   ├── components/
│   │   │   ├── auth/ (ForgotPasswordPanel, ResetPasswordPanel, LoginRegisterPanel)
│   │   │   ├── itinerary/ (ItineraryCard, EmptyPane, etc.)
│   │   │   ├── contractor/ (ApplicantsPanel, CancelRequestsPanel)
│   │   │   ├── onboarding/ (Step1/2/3)
│   │   │   ├── map/ (mapConstants, MapHelpers)
│   │   │   ├── crew/ (CrewDashboardHeader, SubscriptionBanners, JobFiltersRow)
│   │   │   └── profile/ (SocialShareButtons)
│   │   ├── contexts/ (AuthContext → sessionStorage token)
│   │   └── App.js
├── memory/ (PRD.md, test_credentials.md)
```

## Prioritized Backlog

### P0 — Blocking
- None

### P1 — High Priority
- None outstanding (all P1s complete)

### P2 — Medium Priority
- Add `status_history` tab to Admin Job detail view (uses `/api/jobs/{id}/assignments` data)
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
