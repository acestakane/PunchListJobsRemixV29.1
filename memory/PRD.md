# PunchListJobs — PRD

## Problem Statement
Pull GitHub repository (PunchListJobsRemixV27) and run as a standalone application with demo accounts, mocked payment keys, and preview URL access.

## Architecture
- **Frontend**: React 19 + Tailwind + craco (port 3000)
- **Backend**: FastAPI + Motor/MongoDB (port 8001, prefix `/api`)
- **Database**: MongoDB (punchlistjobs) + `push_subscriptions` collection (new)
- **Auth**: JWT (HS256, 24h expiry), token stored in `sessionStorage` as `punchlist_token`
- **Payments**: Square SDK (mocked — empty token → demo mode)
- **AI**: Emergent LLM key (OpenAI GPT-4o for job matching & fraud detection)
- **Push**: pywebpush + VAPID (keys in .env) — real Web Push API

## Core Requirements (static)
- Blue-collar workforce marketplace
- Contractors post jobs; Crew members apply
- Admin/SuperAdmin manage platform
- Subscription-gated features (free tier included)
- Real-time WebSocket notifications + Web Push (background)
- GPS-based job proximity matching

## What's Been Implemented

### 2026-04-14 — Initial Setup
- Cloned repo from GitHub (PunchListJobsRemixV27)
- Installed all backend deps + frontend deps
- Configured backend .env (MONGO_URL, DB_NAME=punchlistjobs, JWT, EMERGENT_LLM_KEY, SQUARE mock, VAPID keys)
- All 11 demo accounts seeded on startup
- Services running via supervisor (hot reload enabled)

### 2026-04-14 — Phase 7: Travel Display Admin Toggle + Feature Batch
- Travel Radius: `travel_radius_miles` in models.py, profile edit, crew search filter
- Job Lifecycle Refactor: CrewAssignment state machine, status_history, assignment_helpers.py
- WebSocket `job_completed_final` event with contractor_id/contractor_name
- GET /api/jobs/{id}/assignments - admin audit trail endpoint
- Analytics helpers extracted to analytics_helpers.py
- Auth helpers extracted to auth_helpers.py
- Multiple sub-component extractions (itinerary, contractor, onboarding, map, crew, profile)

### 2026-04-15 — Code Quality & Security Refactoring
- P0: SharedJobPage.jsx localStorage token bug fixed
- P1: ProfilePage.jsx fetchRatings/fetchReferralInfo wrapped in useCallback
- P1: AuthPage.jsx split into ForgotPasswordPanel/ResetPasswordPanel/LoginRegisterPanel
- P1: job_routes.py 1800→1376 lines, rating_routes.py extracted (4 endpoints)
- Duplicate offer routes removed from job_routes.py
- TradeSelect.jsx hydration warning fixed

### 2026-04-15 — PWA Push Notifications
- `public/manifest.json`: PWA manifest with shortcuts, icons, theme
- `public/sw.js`: Service worker (push events, notification click→navigate, offline cache)
- `public/icon-192.png`, `public/icon-512.png`: App icons
- `backend/utils/push_utils.py`: `broadcast_push()` with pywebpush VAPID sending + auto-cleanup
- `backend/routes/push_routes.py`: 4 endpoints (vapid-public-key, subscribe, unsubscribe, test)
- `frontend/src/contexts/PushContext.jsx`: SW registration, subscribe/unsubscribe/sendTestPush hooks
- `backend/utils/notify.py`: `create_notification()` now also fires Web Push (alongside WS)
- `frontend/src/App.js`: Wrapped with `<PushProvider>`
- `frontend/src/pages/AppSettingsPage.jsx`: Web Push card with Enable/Test/Disable UI
- VAPID keys stored in backend `.env`

### 2026-04-15 — GPS-based Crew Proximity Matching
- `backend/routes/job_routes.py`: `list_jobs` computes `distance_miles` per job when lat/lng provided
- `frontend/src/components/JobCard.jsx`: Distance badge (green Navigation pill + X.X mi) when `job.distance_miles` is set
- `frontend/src/pages/CrewDashboard.jsx`: Auto-enables GPS if browser permission already granted (`navigator.permissions.query`); GPS sessionStorage instead of localStorage
- `frontend/src/components/crew/CrewDashboardHeader.jsx`: GPS button shows animated pulse dot + "GPS ON" when active, "Use My Location" when inactive
- `CrewDashboard.jsx`: "GPS active — sorted by distance" banner in list view when GPS on; `userLocation` prop passed to JobCard

## File Structure (Current)
```
/app/
├── backend/
│   ├── routes/
│   │   ├── job_routes.py       (~1376 lines)
│   │   ├── rating_routes.py    (4 rating endpoints)
│   │   ├── offers_routes.py    (standalone offer management)
│   │   ├── push_routes.py      (NEW: 4 push endpoints)
│   │   ├── admin_routes.py, auth_routes.py, user_routes.py, etc.
│   ├── utils/
│   │   ├── push_utils.py       (NEW: broadcast_push + VAPID sender)
│   │   ├── notify.py           (UPDATED: fires Web Push alongside WS)
│   │   ├── analytics_helpers.py, auth_helpers.py, job_helpers.py, assignment_helpers.py
│   ├── models.py, server.py, auth.py, database.py
├── frontend/
│   ├── public/
│   │   ├── sw.js               (NEW: Service Worker)
│   │   ├── manifest.json       (NEW: PWA manifest)
│   │   ├── icon-192.png, icon-512.png (NEW)
│   ├── src/
│   │   ├── pages/ (AuthPage.jsx thin, ProfilePage.jsx fixed hooks, etc.)
│   │   ├── contexts/
│   │   │   ├── PushContext.jsx (NEW: usePush hook)
│   │   │   └── AuthContext, ThemeContext, WebSocketContext
│   │   ├── components/
│   │   │   ├── auth/ (ForgotPasswordPanel, ResetPasswordPanel, LoginRegisterPanel)
│   │   │   ├── itinerary/, contractor/, onboarding/, map/, crew/, profile/
│   │   └── App.js (wraps PushProvider)
├── memory/ (PRD.md, test_credentials.md)
```

## Prioritized Backlog

### P0 — Blocking
- None

### P1 — Production Readiness
- Configure real VAPID subject (currently uses mailto:admin@punchlistjobs.com)
- Configure SMTP credentials for real email notifications (currently mocked)

### P2 — Upcoming
- Add `status_history` tab to Admin Job detail view (uses /api/jobs/{id}/assignments data)
- SMS via Twilio (backlogged per user request)
- Square live keys for real payments

### P3 — Future
- PWA "Add to Home Screen" flow for mobile crew members
- Background sync for offline job action queuing (sw.js stub already present)
- Push notification category preferences (only new jobs, only approvals, etc.)
- GPS-based "Find jobs within walking distance" quick filter

## Production Credentials Needed (for live deployment)
```
# Push Notifications (already generated - VAPID keys in .env)
VAPID_PUBLIC_KEY=<already set>
VAPID_PRIVATE_KEY=<already set>
VAPID_SUBJECT=mailto:<your-email>   # update to real admin email

# Email (currently mocked)
SMTP_HOST=smtp.gmail.com (or Resend API)
SMTP_PORT=587
SMTP_USER=<email>
SMTP_PASSWORD=<password>
RESEND_API_KEY=<key from resend.com>

# Payments (currently demo mode)
SQUARE_ACCESS_TOKEN=<live key from Square dashboard>
SQUARE_LOCATION_ID=<live location ID>

# SMS Twilio (backlogged)
TWILIO_ACCOUNT_SID=<from twilio.com/console>
TWILIO_AUTH_TOKEN=<from twilio.com/console>
TWILIO_PHONE_NUMBER=<purchased Twilio number>
```
