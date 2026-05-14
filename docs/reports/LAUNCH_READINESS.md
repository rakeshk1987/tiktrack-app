# TikTrack Launch Readiness

Date: 2026-05-14

## Deployment readiness
- `npm run build` passes.
- SPA rewrites configured for Firebase Hosting (`firebase.json`) and Vercel (`vercel.json`).
- Firestore indexes committed in `firestore.indexes.json`.
- Firestore + Storage rules hardened for family isolation and role boundaries.

## Onboarding completeness
- Parent onboarding route: `/parent/onboarding`.
- Guided setup includes:
  - child profile reference
  - first task creation
  - one-click starter seed data (tasks, events, rewards, timetable)
- Planner empty states now route to onboarding.

## PWA and responsive quality
- Manifest tuned for standalone mobile usage.
- Offline/install UI signals added globally.
- Parent/child navigation remains role-separated and mobile-safe.

## Firebase efficiency
- Date-range event queries preserved.
- Composite indexes added for planner/exam/timetable read paths.
- Proof upload restrictions include type + size caps.
