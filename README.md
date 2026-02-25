# Tasko

Tasko uses a shared architecture:

- One backend application (`backend`) on port `5000`
- One Firebase project (Authentication + Firestore)
- One backend environment file (`backend/.env`)
- Three frontend applications that share the same backend and database:
  - `user-app` on `3000`
  - `worker-app` on `3001`
  - `admin-panel` on `3002`

All three frontends connect to the same backend API and same Firebase project. Only UI/routing entry points are different by app.

## Project Structure

```text
tasko/
├── user-app/
├── worker-app/
├── admin-panel/
└── backend/
```

## Backend Requirements Implemented

- Node.js + Express + TypeScript
- Firebase Admin SDK connection to Firestore
- CORS enabled for:
  - `http://localhost:3000`
  - `http://localhost:3001`
  - `http://localhost:3002`
- REST APIs for:
  - authentication validation (`/api/auth/validate`)
  - booking creation (`/api/bookings`)
  - worker approval (`/api/workers/:workerId/approval`)
  - job assignment (`/api/jobs/assign`)
  - analytics (`/api/admin/analytics`)
- Role-based data uses `role` field in Firestore (`users`/`workers`)

## Single Environment File

Only configure environment variables in:

- `backend/.env` (copy from `backend/.env.example`)

This one file contains:

- Firebase Admin credentials
- Firebase Web config values returned to all frontends from `/api/config/client`

## Setup

1. Install dependencies from the project root (`d:\Tasko`):

```powershell
cd d:\Tasko
npm install
npm run install:all
```

2. Create backend env file:

```powershell
cd d:\Tasko\backend
copy .env.example .env
```

3. Fill Firebase values in `backend/.env`:

- Admin SDK keys:
  - `FIREBASE_PROJECT_ID`
  - `FIREBASE_CLIENT_EMAIL`
  - `FIREBASE_PRIVATE_KEY`
- Web SDK keys (same Firebase project):
  - `FIREBASE_WEB_API_KEY`
  - `FIREBASE_WEB_AUTH_DOMAIN`
  - `FIREBASE_WEB_PROJECT_ID`
  - `FIREBASE_WEB_STORAGE_BUCKET`
  - `FIREBASE_WEB_MESSAGING_SENDER_ID`
  - `FIREBASE_WEB_APP_ID`

## Run (From `d:\Tasko`)

Start all 4 apps with one command:

```powershell
cd d:\Tasko
npm run dev
```

You can also run one app at a time from root:

```powershell
npm run dev:backend
npm run dev:user
npm run dev:worker
npm run dev:admin
```

## Run (Manual Per App)

Open 4 terminals:

```powershell
cd d:\Tasko\backend; npm run dev
cd d:\Tasko\user-app; npm run dev
cd d:\Tasko\worker-app; npm run dev
cd d:\Tasko\admin-panel; npm run dev
```

## Firestore Collections

- `users`
- `workers`
- `bookings`
- `services`
- `packages`
