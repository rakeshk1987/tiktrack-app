# Firebase Setup (Launch Ready)

## 1) Local emulator mode (recommended)
1. Copy `.env.example` to `.env`.
2. Keep `VITE_APP_ENV=prod` (local still uses emulators automatically).
3. Run:
```bash
npm install
npm run local
```

## 2) Hosted environment variables
Set these in Vercel/Firebase Hosting only if you want explicit hosted overrides:
- `VITE_FIREBASE_PROD_API_KEY`
- `VITE_FIREBASE_PROD_AUTH_DOMAIN`
- `VITE_FIREBASE_PROD_PROJECT_ID`
- `VITE_FIREBASE_PROD_STORAGE_BUCKET`
- `VITE_FIREBASE_PROD_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_PROD_APP_ID`
- `VITE_FIREBASE_PROD_MEASUREMENT_ID`

## 3) Rules + indexes deploy
```bash
firebase deploy --only firestore:rules,firestore:indexes,storage
```

## 4) First-time family onboarding
1. Sign in as parent.
2. Create child account from Parent Dashboard.
3. Open `/parent/onboarding`.
4. Seed starter tasks/planner/rewards/timetable.
