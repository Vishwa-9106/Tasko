# Cookie Home Services

A full‑stack home services marketplace with customer and worker interfaces, real-time chat/notifications, bookings, reviews, and favorites.

## Features
- Customer and Worker portals
- Search workers by name, location, services, with filters and sorting
- Favorites (add/remove, synced with backend)
- Booking management with statuses and reviews
- Real-time messaging via Socket.io
- Fully responsive UI across pages (dashboard, services, bookings, search, home)

## Tech Stack
- Frontend: React (CRA), React Router, Axios, Tailwind CSS
- Backend: Node.js, Express, Mongoose (MongoDB), JWT Auth, Multer
- Realtime: Socket.io

## Monorepo Structure
```
./
├─ backend/           # Express API server
│  ├─ routes/         # auth, users, bookings, messages, services
│  ├─ models/         # User, Service, Message
│  ├─ middleware/     # auth, upload
│  ├─ server.js       # App entry
│  ├─ package.json
│  └─ .env            # Backend env vars (not committed)
└─ frontend/          # React app
   ├─ public/
   ├─ src/
   ├─ package.json
   └─ .env            # Frontend env vars
```

## Prerequisites
- Node.js LTS (v18+ recommended)
- MongoDB database (Atlas or local)

## Environment Variables
Create the following files (examples shown). Do NOT commit real secrets.

Backend: `backend/.env`
```
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>/<db>?retryWrites=true&w=majority
JWT_SECRET=your-secure-random-string
```

Frontend: `frontend/.env`
```
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_APP_NAME=Cookie Home Services
```

## Install & Run
### 1) Backend
```
# from ./backend
npm install
npm run dev   # starts on http://localhost:5000
```

### 2) Frontend
```
# from ./frontend
npm install
npm start     # starts on http://localhost:3000
```

Ensure `REACT_APP_API_URL` points to the backend API (e.g., http://localhost:5000/api).

## Available Scripts
Backend (`backend/package.json`):
- `npm run dev` – Start server with nodemon
- `npm start` – Start server with node

Frontend (`frontend/package.json`):
- `npm start` – Start CRA dev server
- `npm run build` – Production build
- `npm test` – Run tests

## Key Endpoints (examples)
- `POST /api/auth/register` – Register user
- `POST /api/auth/login` – Login and receive JWT
- `GET /api/users/workers` – Search workers (supports search/filter/sort)
- `GET /api/users/favorites` – Get favorites (customer)
- `POST /api/users/favorites/:workerId` – Toggle favorite
- `GET /api/users/worker/:id` – Worker profile

## Notes
- Keep `.env` files private. Do not commit production secrets.
- Tailwind is configured via `frontend/tailwind.config.js` and `postcss.config.js`.
- Realtime features require the frontend to connect to the backend Socket.io server.

## Troubleshooting
- CORS issues: ensure backend has CORS enabled and `REACT_APP_API_URL` matches origin.
- Mongo connection: verify `MONGODB_URI` and network access rules (IP allowlist on Atlas).
- JWT errors: confirm `Authorization: Bearer <token>` header is sent for protected routes.
