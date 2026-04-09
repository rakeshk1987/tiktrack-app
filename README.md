# TikTrack App

## Run

```bash
npm install --legacy-peer-deps
npm run dev
```

## Unit Tests

```bash
npm test
```

## Firebase Environments (Prod + Test)

This app supports two isolated Firebase systems:

- `prod`: original live Firebase project (default)
- `test`: separate Firebase project for test data

Local safety rule:

- Local/dev runtime always uses `test` Firebase automatically.
- `prod` is used only in hosted runtime (unless hosted is explicitly set to `test`).

Copy `.env.example` to `.env` and set:

```bash
VITE_APP_ENV=prod
```

or

```bash
VITE_APP_ENV=test
```

When using `test`, all `VITE_FIREBASE_TEST_*` values are required.

## Phase 1 Scope (Completed)

- Auth flows: signup/login/logout
- Role routing: parent and child
- Child account create/link to parent
- Child account list in parent dashboard
- Child data mapping by logged-in child UID
- Theme foundation (light/dark)
- Unit tests for auth helpers and Firebase environment selection
