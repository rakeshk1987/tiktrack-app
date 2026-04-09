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

## Tech Stack

- React 19
- Vite 8
- TypeScript
- Firebase
- Tailwind CSS
- Vitest

## Local Development

Install dependencies and start the app:

```bash
npm install
npm run emulators
npm run dev
```

This repository uses `legacy-peer-deps` during install because the current Vite 8 toolchain is ahead of some package peer version declarations used by Vitest and the PWA plugin.

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

If you want emulator data to persist between sessions, use:

```bash
npm run emulators:data
```

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
- Unit tests for auth helpers and Firebase environment selection
