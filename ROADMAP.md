# OpenRide — Deployment Roadmap & Gap Analysis

## Gaps Found in the Original Plan

The original PLAN.md is strong on architecture and features but **missing critical
real-world requirements** that separate "working code" from "app people actually use."
Here's everything that was missing, organized by category.

---

## GAP 1: Safety & Emergency Systems (Critical — Missing Entirely)

A ride-sharing app without safety features **will not get approved** on app stores
and **will face immediate legal liability**.

### What's Needed
- **Emergency SOS button** — Prominent on both driver and passenger screens during active rides. One tap to call local emergency services + share live location with pre-set emergency contacts.
- **Trip sharing** — Passenger can share a live trip link with friends/family (view-only map + ETA).
- **Driver identity verification** — Photo match before ride starts (passenger sees driver photo, license plate, car model). Driver must match the profile.
- **Ride recording opt-in** — Optional audio recording during ride (stored encrypted, only accessible during disputes).
- **Trusted contacts** — Users designate emergency contacts who get auto-notified if SOS is triggered.
- **Anomaly detection** — Alert if ride deviates significantly from expected route, or if car stops for extended time in unusual location.
- **Post-ride safety check** — "Did you arrive safely?" notification after dropoff.

### Database Additions
```sql
CREATE TABLE emergency_contacts (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
    name        VARCHAR(100) NOT NULL,
    phone       VARCHAR(20) NOT NULL,
    relationship VARCHAR(50),
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE trip_shares (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ride_id     UUID REFERENCES rides(id),
    share_token VARCHAR(64) UNIQUE NOT NULL,
    shared_with_phone VARCHAR(20),
    shared_with_email VARCHAR(255),
    expires_at  TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE safety_incidents (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ride_id         UUID REFERENCES rides(id),
    reported_by     UUID REFERENCES users(id),
    incident_type   VARCHAR(50) NOT NULL,
    description     TEXT,
    status          VARCHAR(20) DEFAULT 'open',
    resolved_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

---

## GAP 2: Driver Onboarding & Document Verification (Critical — Underspecified)

The plan has a driver_profiles table but no actual process for getting a driver
from "signs up" to "verified and able to accept rides."

### What's Needed
- **Document upload system** — Drivers must upload: driver's license (front/back), vehicle registration, proof of insurance, vehicle inspection report, profile photo.
- **File storage** — S3-compatible object storage (AWS S3, MinIO self-hosted, or Cloudflare R2) for document images.
- **Verification workflow** — Manual review queue initially (admin dashboard). Automated OCR/verification later.
- **Background check integration** — Partner with a provider like Checkr or Sterling for criminal background checks, driving record checks.
- **Vehicle inspection** — Some jurisdictions require annual inspection. Track expiry dates and auto-disable drivers when expired.
- **Document expiry tracking** — Cron job to check license/insurance expiry and notify drivers 30/14/7 days before.

### Database Additions
```sql
CREATE TABLE driver_documents (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id       UUID REFERENCES driver_profiles(id) ON DELETE CASCADE,
    document_type   VARCHAR(50) NOT NULL
                    CHECK (document_type IN ('license_front', 'license_back',
                    'vehicle_registration', 'insurance', 'inspection', 'profile_photo',
                    'background_check')),
    file_url        TEXT NOT NULL,
    status          VARCHAR(20) DEFAULT 'pending'
                    CHECK (status IN ('pending', 'approved', 'rejected')),
    rejection_reason TEXT,
    expires_at      DATE,
    reviewed_by     UUID REFERENCES users(id),
    reviewed_at     TIMESTAMPTZ,
    uploaded_at     TIMESTAMPTZ DEFAULT NOW()
);
```

### New Backend Services
```
backend/src/services/
    ├── fileUpload.js        # S3 presigned URLs, upload handling
    ├── backgroundCheck.js   # Checkr API integration
    └── documentExpiry.js    # Cron job for expiry notifications
```

---

## GAP 3: Phone Verification & Identity (Critical — Missing)

Email alone is not enough. Ride-sharing requires phone verification for trust and
communication.

### What's Needed
- **SMS verification** — Twilio or equivalent for OTP (one-time password) during registration.
- **Phone number masking** — When driver calls passenger (or vice versa), use a proxy number so neither party sees the other's real phone number. Twilio Proxy or similar.
- **Email verification** — Confirmation link on registration.
- **Two-factor authentication** — Optional but recommended for driver accounts.

### New Service
```
backend/src/services/
    └── sms.js               # Twilio integration: OTP, masked calling, notifications
```

---

## GAP 4: Deployment Infrastructure (Critical — Only Named, Not Specified)

The plan says "Docker + Kubernetes" but has zero detail on how to actually deploy.

### Infrastructure Architecture
```
                    ┌──────────────┐
                    │  Cloudflare  │  CDN + DDoS protection + SSL
                    │    (free)    │
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │ Load Balancer│  Nginx / cloud LB
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
        ┌─────▼──┐   ┌────▼───┐  ┌────▼───┐
        │ API 1  │   │ API 2  │  │ API 3  │   Node.js instances
        │(+ WS)  │   │(+ WS)  │  │(+ WS)  │   (autoscale)
        └────┬───┘   └───┬────┘  └───┬────┘
             │            │           │
        ┌────▼────────────▼───────────▼────┐
        │            Redis Cluster          │  Sessions, geo, pub/sub
        └────────────────┬─────────────────┘
                         │
        ┌────────────────▼─────────────────┐
        │     PostgreSQL (primary)          │  + read replica
        │     + PostGIS extension           │
        └────────────────┬─────────────────┘
                         │
        ┌────────────────▼─────────────────┐
        │     S3 / MinIO                    │  Document & file storage
        └──────────────────────────────────┘
```

### Hosting Options (Cost-Optimized for Non-Profit)
| Option | Monthly Cost (MVP) | Pros | Cons |
|--------|-------------------|------|------|
| **Railway / Render** | $25-50 | Easiest deploy, managed Postgres, autoscale | Cost grows fast |
| **DigitalOcean** | $40-80 | Good balance, managed DB available, predictable | Some ops overhead |
| **Hetzner** | $20-40 | Cheapest bare metal, European | More ops work, EU data laws |
| **AWS/GCP free tier** | $0-30 initially | Free credits for nonprofits (AWS Imagine Grant, GCP for Nonprofits) | Complexity, costs spike |

### Recommended MVP Deployment
```
Phase 1 (MVP):     DigitalOcean or Railway
                    - 1 API server ($12/mo)
                    - Managed PostgreSQL ($15/mo)
                    - Managed Redis ($15/mo)
                    - S3-compatible storage ($5/mo)
                    Total: ~$47/month

Phase 2 (Growth):   Kubernetes on DigitalOcean/Hetzner
                    - 3-node cluster
                    - Managed DB with read replica
                    - Redis cluster

Phase 3 (Scale):    Multi-region deployment
                    - Per-city infrastructure
                    - CDN for static assets
                    - Dedicated OSRM instances per region
```

### Docker Compose (Development)
```yaml
# docker-compose.yml — already in plan but needs actual definition
services:
  api:
    build: ./backend
    ports: ["3000:3000"]
    depends_on: [postgres, redis]
    environment:
      - DATABASE_URL=postgresql://openride:openride@postgres:5432/openride
      - REDIS_URL=redis://redis:6379
      - JWT_SECRET=${JWT_SECRET}
      - STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY}

  postgres:
    image: postgis/postgis:16-3.4
    ports: ["5432:5432"]
    environment:
      POSTGRES_DB: openride
      POSTGRES_USER: openride
      POSTGRES_PASSWORD: openride
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]

  osrm:
    image: osrm/osrm-backend
    ports: ["5001:5000"]
    volumes:
      - ./osrm-data:/data
    command: osrm-routed --algorithm mld /data/region.osrm

volumes:
  pgdata:
```

### CI/CD Pipeline
```yaml
# .github/workflows/deploy.yml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm test
      - run: npm run lint

  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build and push Docker image
      - name: Deploy to production
        # Railway: railway up
        # DigitalOcean: doctl apps update
        # K8s: kubectl apply
```

---

## GAP 5: App Store Deployment (Critical — Missing Entirely)

Building the mobile app is half the work. Getting it into users' hands is the other half.

### Apple App Store Requirements
- **Apple Developer Account** — $99/year (you need this)
- **App Store Review** — Apple reviews every submission. Ride-sharing apps get extra scrutiny.
- **Required info**: Privacy policy URL, support URL, app description, screenshots for all device sizes, age rating.
- **In-App Purchase rules** — Ride payments are "real-world goods/services" so Apple does NOT take a cut (unlike digital goods). Stripe is fine.
- **Location permissions** — Must justify "always" location access for drivers. "When in use" for passengers.
- **Build tooling** — EAS Build (Expo) or Xcode Cloud for iOS builds. Requires a Mac for signing certificates.

### Google Play Store Requirements
- **Developer Account** — $25 one-time fee
- **Play Store Review** — Faster than Apple but still reviews ride-sharing apps
- **Location policy** — Must declare foreground/background location usage and justify it
- **Data safety form** — Declare all data collected and how it's used

### Over-the-Air Updates
- **Expo/EAS Updates** — Push JS bundle updates without app store review (for non-native changes)
- **CodePush** — Alternative OTA update system

### Build & Release Pipeline
```
mobile/
├── eas.json                    # Expo Application Services config
├── app.json                    # App metadata, permissions, splash screen
├── assets/
│   ├── icon.png                # 1024x1024 app icon
│   ├── splash.png              # Splash screen
│   └── adaptive-icon.png       # Android adaptive icon
```

---

## GAP 6: Legal & Regulatory (Critical — Missing)

### Non-Profit Formation
- **Entity type**: Non-profit corporation or cooperative (depends on jurisdiction)
- **US**: File 501(c)(3) or 501(c)(12) with IRS. State registration.
- **EU**: Cooperative society (SCE) or national equivalent
- **Articles of incorporation**: Must encode the governance model (driver/passenger voting rights)
- **Board**: Initial board of directors, transitioning to elected board from driver/passenger community

### Transportation Network Company (TNC) Licensing
- **Most US cities/states require TNC licensing** — Similar to what Uber/Lyft hold
- **Per-city requirements vary**: Some need city permits, others state-level only
- **Insurance requirements**: Most states require specific commercial ride-sharing insurance minimums
- **Driver requirements**: Valid license, clean driving record, vehicle inspection, background check
- **This is the #1 legal blocker** — Cannot operate without proper licensing

### Required Legal Documents
- Terms of Service
- Privacy Policy (GDPR-compliant if serving EU users)
- Driver Agreement (independent contractor terms)
- Insurance disclosure
- Community governance charter

### Insurance
- **Commercial ride-sharing insurance** is mandatory and expensive
  - Period 0 (app off): Driver's personal insurance
  - Period 1 (app on, no ride): Platform provides contingent liability ($50k-100k)
  - Period 2 (en route to pickup): Platform provides $1M liability
  - Period 3 (passenger in car): Platform provides $1M liability + uninsured motorist
- **Provider options**: James River Insurance, National General, Buckle (all serve TNC market)
- **Cost**: This is typically the largest operating expense. $0.10-0.30 per ride-mile.

### Tax Obligations
- **US**: Issue 1099-NEC to drivers earning >$600/year
- **Tax reporting service**: Stripe handles 1099 generation for Connect accounts
- **International**: VAT/GST implications per country

---

## GAP 7: Monitoring, Logging & Error Tracking (Missing)

### What's Needed
```
Monitoring:       Prometheus + Grafana (already in plan) ✓
Error tracking:   Sentry (free tier: 5k errors/month)
Logging:          Structured JSON logs → Loki or CloudWatch
Uptime:           UptimeRobot or Better Stack (free tier)
APM:              Sentry Performance or Datadog (free tier)
Alerting:         PagerDuty/Opsgenie free tier → Slack/SMS alerts
```

### Key Metrics to Monitor
- API response times (p50, p95, p99)
- Ride match success rate
- Driver online count by region
- Payment failure rate
- Socket connection count
- Database query times
- Redis memory usage
- Error rates by endpoint

---

## GAP 8: Geocoding & Address Search (Missing)

The plan mentions OpenStreetMap for maps but doesn't address how passengers search for destinations.

### What's Needed
- **Autocomplete address search** — As passenger types, show matching addresses
- **Geocoding** — Convert address text to lat/lng coordinates
- **Reverse geocoding** — Convert GPS coordinates to human-readable address (for pickup location)

### Solutions (Open Source, No API Costs)
- **Nominatim** — OpenStreetMap's geocoding service. Can self-host.
- **Photon** — Fast geocoding built on OSM data. Better autocomplete than Nominatim.
- **Pelias** — Full-featured open geocoder by Mapzen. Best autocomplete.

### Recommendation
```
Development:    Use Nominatim public API (rate-limited, free)
Production:     Self-host Photon or Pelias alongside OSRM
```

### New Service
```
backend/src/services/
    └── geocoding.js          # Photon/Nominatim integration
```

---

## GAP 9: Cancellation & No-Show Policies (Missing)

### Policy Needed
```
Passenger cancels:
  - Within 2 minutes of request:     Free
  - After driver starts heading:     Small fee (community-voted, e.g., $3)
  - After driver arrives + 5 min wait: Full cancellation fee (e.g., $5)

Driver cancels:
  - Before heading to pickup:        No penalty (first 3 per day)
  - After heading to pickup:         Warning → affects matching priority
  - Repeated cancellations:          Temporary cooldown (30 min offline)

No-show:
  - Driver waits 5 minutes at pickup → can cancel → passenger charged wait fee
  - Passenger can report driver no-show → ride cancelled, no charge, driver flagged
```

### Database Addition
```sql
ALTER TABLE rides ADD COLUMN cancellation_fee DECIMAL(10,2) DEFAULT 0;
ALTER TABLE rides ADD COLUMN cancelled_by UUID REFERENCES users(id);
```

---

## GAP 10: Customer Support System (Missing)

### What's Needed
- **In-app help center** — FAQ, common issues, self-service
- **In-app support chat** — For urgent ride issues
- **Email support** — For non-urgent issues, disputes
- **Dispute resolution flow** — Passenger or driver reports issue → Support reviews → Resolution

### Options
- **Phase 1**: Simple in-app contact form → sends email to support@openride.org
- **Phase 2**: Integrate open-source help desk (Chatwoot — free, self-hosted)
- **Phase 3**: Community moderators from driver/passenger pool (paid per resolution)

### Database Addition
```sql
CREATE TABLE support_tickets (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id),
    ride_id         UUID REFERENCES rides(id),
    category        VARCHAR(50) NOT NULL,
    subject         VARCHAR(255) NOT NULL,
    description     TEXT NOT NULL,
    status          VARCHAR(20) DEFAULT 'open'
                    CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
    assigned_to     UUID REFERENCES users(id),
    resolved_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE support_messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id       UUID REFERENCES support_tickets(id),
    sender_id       UUID REFERENCES users(id),
    message         TEXT NOT NULL,
    is_internal     BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

---

## GAP 11: Passenger Convenience Features (Missing from MVP)

These are table-stakes features that Uber has — passengers will expect them from day one.

### Move to Phase 1 (MVP)
- **Saved places** — Home, Work, Favorites (stored locally + synced)
- **Ride history** — Listed in plan but needs receipt emails
- **Fare estimate before booking** — Listed in plan ✓
- **Driver ETA** — Using OSRM routing, not just straight-line distance
- **Multiple payment methods** — Stripe supports this, but need UI for managing cards

### Database Addition
```sql
CREATE TABLE saved_places (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
    label       VARCHAR(50) NOT NULL,
    address     TEXT NOT NULL,
    lat         DECIMAL(10,7) NOT NULL,
    lng         DECIMAL(10,7) NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE payment_methods (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID REFERENCES users(id) ON DELETE CASCADE,
    stripe_payment_method_id VARCHAR(255) NOT NULL,
    card_brand          VARCHAR(20),
    card_last4          VARCHAR(4),
    is_default          BOOLEAN DEFAULT FALSE,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);
```

---

## GAP 12: Environment & Secrets Management (Missing)

### What's Needed
```
.env.example — Checked into git (template, no real values)
.env         — NOT in git (real secrets, local dev)

Required environment variables:
  DATABASE_URL
  REDIS_URL
  JWT_SECRET
  JWT_REFRESH_SECRET
  STRIPE_SECRET_KEY
  STRIPE_PUBLISHABLE_KEY
  STRIPE_WEBHOOK_SECRET
  TWILIO_ACCOUNT_SID
  TWILIO_AUTH_TOKEN
  TWILIO_PHONE_NUMBER
  S3_BUCKET
  S3_ACCESS_KEY
  S3_SECRET_KEY
  S3_ENDPOINT
  SENTRY_DSN
  OSRM_URL
  GEOCODING_URL
  FCM_SERVER_KEY
  APP_URL
  NODE_ENV
```

### Production Secrets
- Use **cloud provider secrets manager** (DigitalOcean Secrets, AWS SSM, etc.)
- Or **Doppler** (free for small teams, syncs secrets to all environments)
- NEVER hardcode secrets in Docker images or git

---

## GAP 13: Testing Strategy (Underspecified)

### What's Needed
```
Backend:
  Unit tests:        Jest — services, utils, fare calculator, matching algorithm
  Integration tests: Supertest — API endpoints with test database
  Database tests:    Test migrations run cleanly, seed data works
  Socket tests:      Socket.IO client testing

Mobile:
  Unit tests:        Jest — components, stores, utils
  Component tests:   React Native Testing Library
  E2E tests:         Detox (iOS/Android) or Maestro (simpler, newer)

Load testing:
  k6 or Artillery — simulate concurrent ride requests, driver location updates

CI requirement:      All tests pass before deploy. No exceptions.
```

---

## GAP 14: Data Backup & Disaster Recovery (Missing)

### What's Needed
- **Automated daily backups** — PostgreSQL pg_dump to S3
- **Point-in-time recovery** — Enable WAL archiving
- **Tested restores** — Monthly test restore to verify backups work
- **Redis persistence** — RDB snapshots + AOF for durability
- **Multi-region backups** — Store backups in different region than primary
- **Runbook** — Documented steps for restoring from backup

---

## GAP 15: Landing Page & Marketing Site (Missing)

No one downloads an app they've never heard of.

### What's Needed
```
website/                    # Simple marketing site
├── index.html              # Landing page
├── drivers.html            # "Drive with OpenRide" page
├── about.html              # Non-profit mission, governance model
├── transparency.html       # Live financial dashboard (public)
└── privacy.html            # Privacy policy
```

### Can be a simple static site (no framework needed) or part of the Next.js web app.

---

---

# FULL DEPLOYMENT ROADMAP

## What I (Claude) Build vs. What You Do

### Legend
- **C** = Claude builds this (code, config, infrastructure-as-code)
- **Y** = You do this (requires accounts, money, legal decisions, physical actions)
- **C+Y** = Collaborative (Claude writes code/config, you provide credentials/decisions)

---

## PHASE 0: Foundation (Before Any Code)
*Estimated: 1-2 weeks of your time*

| # | Task | Who | Details |
|---|------|-----|---------|
| 0.1 | Choose a name & domain | **Y** | openride.org, fairfare.app, etc. Register domain. |
| 0.2 | Create GitHub organization | **Y** | For the open-source repo |
| 0.3 | Set up developer accounts | **Y** | Apple Developer ($99/yr), Google Play ($25), Stripe, Twilio, Sentry |
| 0.4 | Choose hosting provider | **Y** | I recommend DigitalOcean or Railway for MVP. Create account. |
| 0.5 | Decide launch city | **Y** | Research TNC requirements for that city/state |
| 0.6 | Consult a lawyer | **Y** | Non-profit formation, TNC licensing, insurance, driver agreements |
| 0.7 | Secure insurance | **Y** | Commercial ride-sharing insurance provider |
| 0.8 | Create Stripe Connect account | **Y** | Apply for platform/marketplace account (takes 1-2 weeks approval) |

---

## PHASE 1: MVP Core Build
*Claude builds. You review, test, provide API keys.*

| # | Task | Who | Details |
|---|------|-----|---------|
| **1.1 — Project Scaffolding** |||
| 1.1.1 | Initialize backend (Node.js + Express + TypeScript) | **C** | package.json, tsconfig, eslint, project structure |
| 1.1.2 | Initialize mobile app (React Native + Expo) | **C** | Expo managed workflow for easier builds |
| 1.1.3 | Docker Compose for local development | **C** | PostgreSQL + PostGIS, Redis, OSRM |
| 1.1.4 | Environment config + .env.example | **C** | All required env vars documented |
| 1.1.5 | CI/CD pipeline (GitHub Actions) | **C** | Lint, test, build on every PR |
| **1.2 — Database** |||
| 1.2.1 | Database migrations (all tables) | **C** | Using node-pg-migrate or Knex migrations |
| 1.2.2 | Seed data for development | **C** | Fake drivers, passengers, rides for testing |
| 1.2.3 | Database connection pooling | **C** | pg-pool configuration |
| **1.3 — Authentication** |||
| 1.3.1 | User registration (email + phone) | **C** | Input validation, password hashing (bcrypt) |
| 1.3.2 | Phone verification via SMS | **C+Y** | Claude writes code, you provide Twilio credentials |
| 1.3.3 | Login (JWT access + refresh tokens) | **C** | Secure token rotation |
| 1.3.4 | OAuth (Google + Apple sign-in) | **C+Y** | Claude writes code, you configure OAuth apps |
| 1.3.5 | Role selection (passenger/driver/both) | **C** | |
| 1.3.6 | Password reset flow | **C** | Email-based reset |
| **1.4 — Driver Onboarding** |||
| 1.4.1 | Driver registration form | **C** | Multi-step: personal → vehicle → documents |
| 1.4.2 | Document upload (S3 presigned URLs) | **C+Y** | Claude writes code, you provide S3 bucket |
| 1.4.3 | Admin document review dashboard | **C** | Web dashboard to approve/reject driver docs |
| 1.4.4 | Background check integration | **C+Y** | Claude writes Checkr integration, you get Checkr account |
| 1.4.5 | Document expiry notifications | **C** | Cron job checking license/insurance dates |
| **1.5 — Maps & Location** |||
| 1.5.1 | Map component (react-native-maps + OSM tiles) | **C** | |
| 1.5.2 | GPS location tracking (foreground + background) | **C** | Battery-optimized for drivers |
| 1.5.3 | Address search autocomplete (Photon/Nominatim) | **C** | |
| 1.5.4 | Route calculation & ETA (OSRM) | **C** | |
| 1.5.5 | Reverse geocoding (GPS → address) | **C** | |
| **1.6 — Ride System** |||
| 1.6.1 | Ride request API | **C** | Passenger submits pickup/dropoff |
| 1.6.2 | Driver matching algorithm | **C** | Redis GEORADIUS + scoring |
| 1.6.3 | Ride offer → accept/decline flow | **C** | Socket.IO real-time with 15s timeout |
| 1.6.4 | Real-time ride tracking | **C** | Driver location streaming to passenger |
| 1.6.5 | Ride state machine | **C** | requested → matched → arriving → in_progress → completed |
| 1.6.6 | Fare calculation service | **C** | Distance + time + surge, transparent breakdown |
| 1.6.7 | Cancellation handling | **C** | Policies, fees, driver/passenger flows |
| 1.6.8 | Fare estimate (pre-booking) | **C** | OSRM distance estimate → fare preview |
| **1.7 — Payments** |||
| 1.7.1 | Stripe Connect onboarding for drivers | **C+Y** | Claude writes code, you configure Stripe Connect |
| 1.7.2 | Passenger payment method management | **C** | Add/remove cards, set default |
| 1.7.3 | Ride charge + instant driver payout | **C** | Stripe PaymentIntent → Transfer |
| 1.7.4 | Refund handling | **C** | |
| 1.7.5 | Receipts (in-app + email) | **C** | Transparent fare breakdown |
| **1.8 — Ratings** |||
| 1.8.1 | Post-ride rating (1-5 stars + optional comment) | **C** | Bidirectional |
| 1.8.2 | Rating averages + display | **C** | |
| 1.8.3 | Report system (flag serious issues) | **C** | |
| **1.9 — Driver Dashboard** |||
| 1.9.1 | Go online/offline toggle | **C** | |
| 1.9.2 | Earnings dashboard (daily/weekly/monthly) | **C** | Charts, transaction history |
| 1.9.3 | Ride history | **C** | |
| 1.9.4 | Driver preferences (max pickup distance) | **C** | |
| **1.10 — Safety** |||
| 1.10.1 | Emergency SOS button | **C** | Calls emergency services + alerts contacts |
| 1.10.2 | Trip sharing (share live ride link) | **C** | |
| 1.10.3 | Emergency contacts management | **C** | |
| 1.10.4 | Route deviation alerts | **C** | |
| **1.11 — Notifications** |||
| 1.11.1 | Push notification service (FCM) | **C+Y** | Claude writes code, you set up Firebase project |
| 1.11.2 | Ride status notifications | **C** | Driver matched, arriving, ride complete |
| 1.11.3 | Email notifications (transactional) | **C+Y** | Receipts, verification — use Resend/SendGrid |
| **1.12 — Support** |||
| 1.12.1 | In-app help/FAQ | **C** | |
| 1.12.2 | Contact/report form | **C** | Creates support ticket |
| 1.12.3 | Support ticket system (admin side) | **C** | Web dashboard |

---

## PHASE 2: Community & Governance Features

| # | Task | Who | Details |
|---|------|-----|---------|
| 2.1 | Governance proposal creation | **C** | Users submit proposals with category |
| 2.2 | Voting system | **C** | Time-limited, one-vote-per-user, quorum rules |
| 2.3 | Vote results & execution | **C** | Auto-update platform params when proposals pass |
| 2.4 | Transparency dashboard | **C** | Public financials, real-time metrics |
| 2.5 | Surplus calculation engine | **C** | Quarterly reconciliation of fees vs costs |
| 2.6 | Surplus redistribution | **C+Y** | Auto-distribute via Stripe payouts |
| 2.7 | Peer review panel (disputes) | **C** | Random panel of verified users reviews flagged drivers |
| 2.8 | Community moderation | **C** | Elected moderators from user pool |

---

## PHASE 3: Pre-Launch Preparation
*Mix of code and real-world tasks*

| # | Task | Who | Details |
|---|------|-----|---------|
| 3.1 | Landing page / marketing site | **C** | Part of Next.js web app |
| 3.2 | Terms of Service | **Y** | Lawyer drafts, Claude can template |
| 3.3 | Privacy Policy | **Y** | GDPR/CCPA compliant |
| 3.4 | Driver agreement | **Y** | Legal document for independent contractors |
| 3.5 | App store assets | **C+Y** | Claude generates screenshot frames, you provide branding |
| 3.6 | App store submission (iOS) | **C+Y** | Claude prepares metadata, you submit from Apple account |
| 3.7 | App store submission (Android) | **C+Y** | Same |
| 3.8 | Production infrastructure setup | **C+Y** | Claude writes Terraform/configs, you provision accounts |
| 3.9 | SSL certificates | **C** | Let's Encrypt via Certbot or Cloudflare |
| 3.10 | Database backups configured | **C** | Automated daily backups to S3 |
| 3.11 | Monitoring & alerting | **C** | Prometheus + Grafana + Sentry + uptime checks |
| 3.12 | Load testing | **C** | k6 scripts simulating realistic traffic |
| 3.13 | Security audit | **C+Y** | Claude runs OWASP checks, you may want external audit |
| 3.14 | Penetration testing | **Y** | Hire a security firm or use bug bounty |

---

## PHASE 4: Soft Launch (Single City)

| # | Task | Who | Details |
|---|------|-----|---------|
| 4.1 | Recruit initial drivers (50-100) | **Y** | Partner with local taxi cooperatives, post in driver forums |
| 4.2 | Onboard & verify drivers | **Y** | Background checks, document review |
| 4.3 | Beta test with small passenger group | **Y** | Friends, family, early adopters |
| 4.4 | Fix bugs from beta feedback | **C** | |
| 4.5 | Monitor production metrics | **C+Y** | |
| 4.6 | Gather driver & passenger feedback | **Y** | |
| 4.7 | Iterate on UX based on feedback | **C** | |

---

## PHASE 5: Growth & Scale

| # | Task | Who | Details |
|---|------|-----|---------|
| 5.1 | Multi-city expansion | **Y** | New TNC licenses, local insurance, driver recruitment |
| 5.2 | Multi-language support (i18n) | **C** | |
| 5.3 | Ride scheduling | **C** | Book rides in advance |
| 5.4 | In-app chat | **C** | Driver ↔ passenger messaging |
| 5.5 | Ride sharing / carpooling | **C** | Match passengers going same direction |
| 5.6 | Accessibility features | **C** | Wheelchair-accessible vehicle type, screen reader support |
| 5.7 | Driver referral program | **C** | |
| 5.8 | Community marketing | **Y** | Word-of-mouth, local events, driver ambassadors |
| 5.9 | Apply for non-profit grants | **Y** | Tech non-profit grants (Mozilla, Ford Foundation, etc.) |

---

## Summary: What's Changed From Original Plan

| Area | Original Plan | Updated |
|------|--------------|---------|
| Safety | Not mentioned | Full SOS, trip sharing, anomaly detection, incident tracking |
| Driver onboarding | One table | Full document upload, verification workflow, background checks, expiry tracking |
| Phone verification | Not mentioned | SMS OTP via Twilio, phone masking for calls |
| Deployment | "Docker + K8s" | Full infrastructure diagram, hosting comparison, cost estimates, Docker Compose |
| App stores | Not mentioned | Full iOS/Android submission requirements and process |
| Legal/Regulatory | One bullet point | TNC licensing, non-profit formation, insurance tiers, tax reporting |
| Monitoring | "Prometheus + Grafana" | Error tracking, logging, uptime, APM, alerting, key metrics |
| Geocoding | Not mentioned | Address autocomplete, geocoding, reverse geocoding with open-source stack |
| Cancellation policy | Not mentioned | Full driver/passenger cancellation and no-show policies |
| Customer support | Not mentioned | Ticket system, help center, dispute flow |
| Passenger features | Basic | Saved places, multiple payment methods, receipt emails |
| Secrets management | Not mentioned | Full env var list, secrets manager recommendations |
| Testing | "tests/" directory | Unit, integration, E2E, load testing strategy |
| Backup/DR | Not mentioned | Automated backups, point-in-time recovery, tested restores |
| Landing page | Not mentioned | Marketing site for user acquisition |
| Roadmap clarity | 3 vague phases | 5 detailed phases with 80+ tasks, clear owner (Claude vs You) |
