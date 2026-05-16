# TikTrack

Family chore tracking app built with React, Vite, and Firebase.

Recommended GitHub repo description:
`Family chore tracking app built with React, Vite, and Firebase.`

## What It Does

TikTrack helps families manage chores and rewards with separate parent and child experiences.

- Parent and child authentication flows
- Role-based routing and dashboards
- Child account linking for parent-managed families
- Firebase-backed auth, data, storage, analytics, and messaging foundations
- Theme support and unit-tested Firebase environment selection

## Current Status (May 8, 2026)

- Core parent/child product flows are implemented and working
- Background job schema alignment has been completed for app + functions collections
- Child daily task limit is enforced at 7 tasks in scheduler and child-visible task list
- Proof retention cleanup now includes 60-day cleanup for `proof_logs` and best-effort Storage asset deletion
- Firestore security rules hardened: fixed "Missing or insufficient permissions" error for delete operations on `programs`, `reward_settings`, and `reward_items` collections.
- Planner UI optimized: Removed all dummy/mock data fallbacks. The Kid Planner now uses a clean two-tab layout ("Calendar" and "Activities"), with parent-created activities grouped under the "Activities" tab.
- Test suite currently passes: `204/204` tests

## Project Structure

- `src/`: React app source code
- `functions/`: Firebase Cloud Functions source code
- `tests/`: Vitest suites
- `scripts/`: Local automation scripts
- `docs/guides/`: Implementation guides (`BACKGROUND_JOBS_GUIDE.md`, `TASK_SCHEDULING_GUIDE.md`, `REAL_TIME_SYNC_GUIDE.md`)
- `docs/reports/`: Project status/report documents (`PROJECT_COMPLETION_SUMMARY.md`)
- `docs/spec/`: Product skill/spec file (`TikTrack.skill`)

## User Documentation

- End-user walkthrough: `docs/guides/USER_GUIDE.md`
- Firebase setup and env guide: `docs/guides/FIREBASE_SETUP.md`
- Launch readiness report: `docs/reports/LAUNCH_READINESS.md`
- Architecture and route map: `docs/reports/ARCHITECTURE_SUMMARY.md`

## Tech Stack

- React 19
- Vite 8
- TypeScript
- Firebase
- Tailwind CSS
- Vitest

## Local Development

Install dependencies and start the full local stack with one command:

```bash
npm install
npm run local
```

This repository uses `legacy-peer-deps` during install because the current Vite 8 toolchain is ahead of some package peer version declarations used by Vitest and the PWA plugin.

`npm run local` does all of this for you:

- finds your local Java install
- starts Firebase emulators with persisted data
- waits for the emulators to be ready
- starts the Vite app

If you want to run the pieces manually instead:

```bash
npm run emulators:data
npm run dev
```

### Docker (Single Container: UI + Firebase Emulators)

This repo supports running both the Vite UI and Firebase emulators in one Docker container.

```bash
docker compose up --build
```

Ports exposed:

- `5173` Vite app
- `4000` Emulator UI
- `8080` Firestore emulator
- `9099` Auth emulator
- `9199` Storage emulator

Run tests:

```bash
npm test
```

Create a production build locally:

```bash
npm run build
```

## Local Data Flow

Local development now uses the Firebase Local Emulator Suite:

- Auth emulator on `127.0.0.1:9099`
- Firestore emulator on `127.0.0.1:8080`
- Storage emulator on `127.0.0.1:9199`
- Emulator UI on [http://127.0.0.1:4000](http://127.0.0.1:4000)

This means:

- local data stays on your machine
- local signups and child accounts do not touch production Firebase
- no extra local database layer is needed
- `.env`, emulator cache, and emulator data folders stay out of Git

Emulator data persists between sessions through the `.firebase-data` folder.

## Firebase Environments

Hosted deployments still use the live Firebase project by default.

- `prod`: the live Firebase project
- `test`: an optional separate hosted Firebase project if you choose to add one later

For hosted overrides, copy `.env.example` to `.env` and fill the relevant `VITE_FIREBASE_*` keys.

## Firebase Hosting

This repository is configured for Firebase Hosting as a single-page app:

- Build output directory: `dist`
- SPA rewrite: all routes go to `index.html`
- Default Firebase project alias: `tiktrack-f112b`

Local deploy flow:

```bash
npm run build
firebase deploy --only hosting
```

## Vercel Deployment

This repo includes `vercel.json` for SPA rewrite and cache headers.

1. Import repo in Vercel.
2. Set build command: `npm run build`.
3. Set output directory: `dist`.
4. Add `VITE_FIREBASE_*` variables only if overriding defaults.

## GitHub Actions Deployment

The repository includes a GitHub Actions workflow at `.github/workflows/firebase-hosting.yml`.

It does three things:

- runs tests on pushes and pull requests
- builds the app on pushes and pull requests
- deploys Firebase preview channels for pull requests and the live site for `main`

After the Firebase service-account secret is added, the next push to `main` should trigger the first live deployment automatically.

Before the workflow can deploy, add this GitHub repository secret:

- `FIREBASE_SERVICE_ACCOUNT_TIKTRACK_F112B`

To create that secret, generate a Firebase service account JSON key for the `tiktrack-f112b` project and paste the full JSON into the GitHub Actions secret value.

## Phase 1 Scope

- Auth flows: signup, login, and logout
- Role routing for parent and child users
- Child account creation and linking
- Child account listing in the parent dashboard
- Child data mapping by logged-in child UID
- Theme foundation with light and dark support
- Master Planner V2 foundation with shared master calendar logic
- Unit tests for auth helpers and Firebase environment selection
