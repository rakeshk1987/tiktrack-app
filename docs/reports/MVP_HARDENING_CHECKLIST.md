# TikTrack MVP Hardening Checklist

Date: 2026-05-14

## Security
- Tightened Firestore family-isolation checks for planner/reward/message surfaces.
- Hardened storage write path for proof uploads:
  - child-scope ownership checks
  - parent-of-child checks
  - image content-type restriction
  - 5MB upload cap

## Firebase Cost Controls
- Added Firestore composite index definitions in `firestore.indexes.json`.
- Confirmed planner event reads are date-ranged and child-scoped.
- Limited planner queries with `limit(...)` and explicit ordering.
- Added storage upload cap to reduce oversized proof uploads.

## Performance
- Added manual chunk splitting for Firebase and FullCalendar bundles.
- Route-level lazy loading now includes parent dashboard and planner v2 pages.
- Enabled FullCalendar progressive event rendering.

## PWA and Offline
- Updated manifest metadata for standalone install and dark theme color.
- Added runtime caching policy for image/static third-party assets.
- Added global install prompt and offline status toast-like signal.
- Kept planner mutation queue metadata in localStorage for stale cache awareness.

## UX and Accessibility
- Upgraded global crash fallback with retry/reload actions.
- Added global `:focus-visible` ring for keyboard navigation.
- Preserved minimum 44px actions in global install/offline affordances.
