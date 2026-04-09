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
npm run dev
```

Run tests:

```bash
npm test
```

Create a production build locally:

```bash
npm run build
```

## Firebase Environments

This app supports two isolated Firebase systems:

- `prod`: the live Firebase project
- `test`: a separate Firebase project for safe local and test data

Safety rule:

- Local development always uses the `test` Firebase environment automatically.
- Hosted deployments use `prod` unless you explicitly override the runtime environment.

Copy `.env.example` to `.env` and set:

```bash
VITE_APP_ENV=prod
```

or:

```bash
VITE_APP_ENV=test
```

When `VITE_APP_ENV=test`, all `VITE_FIREBASE_TEST_*` values are required.

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
