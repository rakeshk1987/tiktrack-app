# TikTrack Architecture Summary

## App layers
- UI: React + TypeScript + Tailwind.
- Routing: `react-router-dom` with role-protected paths.
- Data: Firebase Auth + Firestore + Storage.
- PWA: `vite-plugin-pwa` with runtime caching.

## Primary feature modules
- `src/features/planner`: master calendar UX and planner services/hooks/components.
- `src/pages/child/*`: child-facing workflows (quests, planner, rewards, profile, growth).
- `src/pages/parent/*`: parent operations (family, approvals, planning, rewards, exams).
- `src/hooks/useData.ts`: app-level Firebase data orchestration for child/parent dashboards.

## Firestore collection map (core MVP)
- `users`, `child_profile`
- `tasks`, `task_logs`, `proof_logs`
- `events`, `programs`, `school_timetables`
- `reward_settings`, `reward_items`, `redemptions`
- `exams`, `exam_results`
- `growth_logs`, `special_dates`, `messages`

## Route map
- `/login`, `/signup`
- Child:
  - `/child`, `/child/quests`, `/child/planner`, `/child/diary`, `/child/rewards`, `/child/money-pot`, `/child/profile`, `/child/growth`, `/child/special-dates`
- Parent:
  - `/parent`, `/parent/onboarding`
- Planner v2:
  - `/planner/child`
  - `/planner/parent`

## Feature boundaries
- Planner recurrence kept lightweight (none/daily/weekly).
- No OAuth sync, no cloud functions dependency for core UX.
- Optimistic updates used only in controlled high-feedback paths.
