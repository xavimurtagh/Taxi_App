# OpenRide

A community-owned, non-profit ride-sharing platform where drivers keep 90-95% of fares and users democratically govern the platform.

## Why OpenRide?

| | Uber | OpenRide |
|---|---|---|
| Driver commission | 25-30% taken | 5-10% (costs only) |
| Surplus | To shareholders | Back to drivers & passengers |
| Governance | Corporate decisions | Democratic voting |
| Pricing | Opaque, uncapped surge | Transparent, community-capped |
| Deactivation | Algorithmic, instant | Peer review, appeals |

## Quick Start (Development)

### Prerequisites
- Node.js 20+
- Docker & Docker Compose

### 1. Clone and configure
```bash
git clone https://github.com/your-org/openride.git
cd openride
cp .env.example .env
# Edit .env with your API keys (Stripe, Twilio, etc.)
```

### 2. Start infrastructure
```bash
docker compose up postgres redis -d
```

### 3. Run database migrations
```bash
cd backend
npm install
psql $DATABASE_URL -f migrations/001_initial_schema.sql
psql $DATABASE_URL -f migrations/002_seed_data.sql  # dev data
```

### 4. Start the backend
```bash
npm run dev  # starts on http://localhost:3000
```

### 5. Start the mobile app
```bash
cd ../mobile
npm install
npm start  # starts Expo dev server
```

## Project Structure

```
├── backend/          Node.js + Express API server
│   ├── src/
│   │   ├── config/       Database, Redis, environment
│   │   ├── middleware/   Auth, validation, rate limiting
│   │   ├── routes/       REST API endpoints
│   │   ├── services/     Business logic (matching, pricing, safety)
│   │   ├── sockets/      Real-time events (ride tracking, location)
│   │   ├── jobs/         Background tasks (cron)
│   │   └── utils/        Fare calculator, geo utilities
│   └── migrations/       PostgreSQL schema & seed data
│
├── mobile/           React Native (Expo) mobile app
│   └── src/
│       ├── screens/      All app screens (auth, passenger, driver, governance)
│       ├── components/   Reusable UI components
│       ├── services/     API client, socket, location, storage
│       ├── store/        Zustand state management
│       └── navigation/   React Navigation setup
│
└── web/              Admin & governance dashboard (Next.js)
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/v1/auth/register | Create account |
| POST | /api/v1/auth/login | Sign in |
| POST | /api/v1/rides | Request a ride |
| GET | /api/v1/rides/estimate | Get fare estimate |
| POST | /api/v1/rides/:id/accept | Driver accepts ride |
| POST | /api/v1/rides/:id/complete | Complete a ride |
| POST | /api/v1/drivers/online | Go online |
| POST | /api/v1/drivers/location | Update driver location |
| GET | /api/v1/drivers/earnings | View earnings |
| POST | /api/v1/governance/proposals | Create proposal |
| POST | /api/v1/governance/proposals/:id/vote | Cast vote |
| GET | /api/v1/transparency/summary | Platform financials |
| POST | /api/v1/safety/sos | Trigger emergency SOS |

## Tech Stack

- **Mobile**: React Native + Expo
- **Backend**: Node.js + Express
- **Database**: PostgreSQL + PostGIS
- **Cache/Realtime**: Redis + Socket.IO
- **Maps**: OpenStreetMap + OSRM
- **Payments**: Stripe Connect
- **Auth**: JWT + OAuth2

## Contributing

OpenRide is open source and community-driven. See [PLAN.md](PLAN.md) for the full architecture and [ROADMAP.md](ROADMAP.md) for what's needed.

## License

AGPL-3.0 — Ensures all modifications remain open source.
