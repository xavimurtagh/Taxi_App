# OpenRide — A Community-Owned Ride-Sharing Platform

## Why Uber Wins (And Where It Fails)

### What Makes Uber Dominant
1. **Network effects** — More drivers means shorter wait times, which attracts more passengers, which attracts more drivers. This flywheel is nearly impossible to break once established.
2. **Frictionless UX** — One tap to ride. No cash, no negotiation, no phone calls. GPS does the navigation. Rating systems build trust.
3. **Dynamic pricing (surge)** — Ensures supply meets demand. Passengers always get a ride if they're willing to pay.
4. **Massive subsidies and VC funding** — Uber operated at a loss for years to undercut competitors on price and flood markets with cheap rides.
5. **Brand recognition** — "Uber" has become a verb. That level of brand penetration is a moat in itself.
6. **Technology infrastructure** — Real-time matching algorithms, route optimization, ETA prediction, fraud detection — all refined over a decade.
7. **Driver onboarding pipeline** — Easy sign-up, background checks, and fast activation get supply online quickly.

### Where Uber Fails (Our Opportunity)
1. **Driver exploitation** — Uber takes 25-30% commission. Drivers have no say in pricing, policies, or platform rules. Deactivation is opaque and unappealable.
2. **Surge pricing hurts passengers** — 3x-5x fares during emergencies, bad weather, or events feel predatory.
3. **No community ownership** — All value extracted to shareholders. Drivers and passengers are commodities.
4. **Opaque algorithms** — Drivers don't know why they get certain rides. Passengers don't know the real fare breakdown.
5. **Race to the bottom** — Constant fare cuts to attract passengers at driver expense.
6. **No loyalty** — Neither drivers nor passengers have any reason to be loyal beyond price.
7. **Privacy concerns** — Extensive tracking and data collection with unclear usage.

---

## OpenRide: The Model

### Core Philosophy
- **Non-profit cooperative**: Zero profit extraction. All revenue goes to drivers and operational costs.
- **Democratic governance**: Drivers and passengers vote on platform policies, fare structures, and feature priorities.
- **Radical transparency**: Open books. Everyone can see where every dollar goes.
- **Fair compensation**: Drivers keep 90-95% of fares. The 5-10% platform fee covers only server costs, payment processing, insurance, and support.
- **Surplus redistribution**: Any leftover funds at end of quarter redistributed proportionally to active drivers and passengers.

### How We Compete With Uber
| Problem | Uber | OpenRide |
|---------|------|----------|
| Commission | 25-30% | 5-10% (cost-only) |
| Driver voice | None | Democratic votes on policies |
| Surge pricing | Algorithmic, uncapped | Community-approved caps (e.g., max 1.5x) |
| Transparency | Opaque | Open financials, open-source code |
| Surplus | To shareholders | Back to drivers & passengers |
| Deactivation | Opaque, instant | Peer review panel, appeals process |
| Data | Monetized | Minimal collection, user-owned |

---

## Technical Architecture Plan

### Tech Stack
```
Frontend (Mobile):    React Native (iOS + Android from single codebase)
Frontend (Web):       React + Next.js (admin dashboard, governance portal)
Backend API:          Node.js + Express (or Fastify for performance)
Real-time:            Socket.IO (ride matching, location updates, chat)
Database:             PostgreSQL (primary) + Redis (caching, sessions, geospatial)
Maps & Routing:       OpenStreetMap + OSRM (open-source, no vendor lock-in)
Payments:             Stripe Connect (direct payouts to drivers)
Auth:                 JWT + OAuth2 (Google, Apple sign-in)
Push Notifications:   Firebase Cloud Messaging (FCM) / APNs
Deployment:           Docker + Kubernetes on commodity cloud
CI/CD:                GitHub Actions
Monitoring:           Prometheus + Grafana
```

### Why This Stack
- **React Native**: Single codebase for both platforms. Huge ecosystem. Easier to find contributors for an open-source project.
- **Node.js**: JavaScript everywhere. Largest developer community. Excellent for real-time I/O.
- **PostgreSQL + PostGIS**: Enterprise-grade, open-source, with native geospatial queries for finding nearby drivers.
- **Redis**: Sub-millisecond geospatial lookups via GEOADD/GEORADIUS for real-time driver proximity.
- **OpenStreetMap/OSRM**: No per-request API costs. Self-hosted. Community-maintained map data.
- **Stripe Connect**: Handles regulatory complexity of multi-party payments. Instant payouts to drivers.

---

## Application Structure

```
Taxi_App/
├── PLAN.md
├── README.md
├── docker-compose.yml
│
├── backend/
│   ├── package.json
│   ├── src/
│   │   ├── index.js                 # Entry point
│   │   ├── config/
│   │   │   ├── database.js          # PostgreSQL connection
│   │   │   ├── redis.js             # Redis connection
│   │   │   └── env.js               # Environment config
│   │   ├── middleware/
│   │   │   ├── auth.js              # JWT verification
│   │   │   ├── rateLimit.js         # Rate limiting
│   │   │   └── validation.js        # Request validation
│   │   ├── models/
│   │   │   ├── User.js              # Base user (shared fields)
│   │   │   ├── Driver.js            # Driver profile, vehicle, docs
│   │   │   ├── Passenger.js         # Passenger preferences
│   │   │   ├── Ride.js              # Ride lifecycle
│   │   │   ├── Payment.js           # Transaction records
│   │   │   ├── Rating.js            # Bidirectional ratings
│   │   │   ├── Proposal.js          # Governance proposals
│   │   │   └── Vote.js              # Votes on proposals
│   │   ├── routes/
│   │   │   ├── auth.js              # Register, login, OAuth
│   │   │   ├── rides.js             # Request, match, track, complete
│   │   │   ├── drivers.js           # Profile, availability, earnings
│   │   │   ├── passengers.js        # Profile, ride history
│   │   │   ├── payments.js          # Fare calc, payouts, refunds
│   │   │   ├── ratings.js           # Submit and view ratings
│   │   │   ├── governance.js        # Proposals, voting, results
│   │   │   └── transparency.js      # Open financials API
│   │   ├── services/
│   │   │   ├── matching.js          # Driver-passenger matching algorithm
│   │   │   ├── pricing.js           # Fair fare calculation
│   │   │   ├── geolocation.js       # Location tracking, ETA
│   │   │   ├── notifications.js     # Push notifications
│   │   │   ├── payment.js           # Stripe integration
│   │   │   └── governance.js        # Vote tallying, proposal execution
│   │   ├── sockets/
│   │   │   ├── index.js             # Socket.IO setup
│   │   │   ├── rideEvents.js        # Real-time ride updates
│   │   │   └── locationEvents.js    # Driver location streaming
│   │   └── utils/
│   │       ├── fareCalculator.js    # Distance/time-based fare logic
│   │       ├── geoUtils.js          # Haversine, bounding boxes
│   │       └── validators.js        # Input validation schemas
│   │
│   ├── migrations/                  # Database migrations
│   └── tests/
│       ├── unit/
│       └── integration/
│
├── mobile/
│   ├── package.json
│   ├── App.js
│   ├── src/
│   │   ├── navigation/
│   │   │   ├── AppNavigator.js      # Main nav structure
│   │   │   ├── PassengerNav.js      # Passenger flow screens
│   │   │   └── DriverNav.js         # Driver flow screens
│   │   ├── screens/
│   │   │   ├── auth/
│   │   │   │   ├── LoginScreen.js
│   │   │   │   ├── RegisterScreen.js
│   │   │   │   └── RoleSelectScreen.js
│   │   │   ├── passenger/
│   │   │   │   ├── HomeScreen.js         # Map + request ride
│   │   │   │   ├── RideTrackingScreen.js # Live ride tracking
│   │   │   │   ├── RideHistoryScreen.js
│   │   │   │   ├── PaymentScreen.js
│   │   │   │   └── RatingScreen.js
│   │   │   ├── driver/
│   │   │   │   ├── DashboardScreen.js    # Go online, see requests
│   │   │   │   ├── RideRequestScreen.js  # Accept/decline rides
│   │   │   │   ├── NavigationScreen.js   # Turn-by-turn nav
│   │   │   │   ├── EarningsScreen.js     # Daily/weekly/monthly
│   │   │   │   └── RatingScreen.js
│   │   │   ├── governance/
│   │   │   │   ├── ProposalsScreen.js    # View & create proposals
│   │   │   │   ├── VotingScreen.js       # Cast votes
│   │   │   │   └── ResultsScreen.js      # See outcomes
│   │   │   └── shared/
│   │   │       ├── ProfileScreen.js
│   │   │       ├── SettingsScreen.js
│   │   │       └── TransparencyScreen.js # See platform finances
│   │   ├── components/
│   │   │   ├── Map.js                    # Map component wrapper
│   │   │   ├── RideCard.js
│   │   │   ├── DriverCard.js
│   │   │   ├── FareEstimate.js
│   │   │   ├── ProposalCard.js
│   │   │   └── EarningsChart.js
│   │   ├── services/
│   │   │   ├── api.js                    # HTTP client
│   │   │   ├── socket.js                 # Socket.IO client
│   │   │   ├── location.js              # GPS tracking
│   │   │   └── storage.js               # AsyncStorage helpers
│   │   ├── store/                        # State management (Zustand)
│   │   │   ├── authStore.js
│   │   │   ├── rideStore.js
│   │   │   ├── locationStore.js
│   │   │   └── governanceStore.js
│   │   └── utils/
│   │       ├── formatters.js
│   │       └── constants.js
│   │
│   └── __tests__/
│
└── web/                                  # Admin + Governance dashboard
    ├── package.json
    └── src/
        ├── pages/
        │   ├── dashboard.js              # Platform health metrics
        │   ├── financials.js             # Open books
        │   ├── governance.js             # Proposal management
        │   └── drivers.js                # Driver management
        └── components/
```

---

## Database Schema (Key Tables)

### users
```sql
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255) UNIQUE NOT NULL,
    phone           VARCHAR(20) UNIQUE NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    first_name      VARCHAR(100) NOT NULL,
    last_name       VARCHAR(100) NOT NULL,
    role            VARCHAR(20) NOT NULL CHECK (role IN ('passenger', 'driver', 'both')),
    avatar_url      TEXT,
    is_verified     BOOLEAN DEFAULT FALSE,
    rating_avg      DECIMAL(3,2) DEFAULT 5.00,
    rating_count    INTEGER DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);
```

### driver_profiles
```sql
CREATE TABLE driver_profiles (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID REFERENCES users(id) ON DELETE CASCADE,
    license_number      VARCHAR(50) NOT NULL,
    license_expiry      DATE NOT NULL,
    vehicle_make        VARCHAR(100),
    vehicle_model       VARCHAR(100),
    vehicle_year        INTEGER,
    vehicle_color       VARCHAR(50),
    vehicle_plate       VARCHAR(20),
    vehicle_type        VARCHAR(20) CHECK (vehicle_type IN ('economy', 'comfort', 'xl', 'accessible')),
    is_online           BOOLEAN DEFAULT FALSE,
    current_lat         DECIMAL(10,7),
    current_lng         DECIMAL(10,7),
    documents_verified  BOOLEAN DEFAULT FALSE,
    total_rides         INTEGER DEFAULT 0,
    total_earnings      DECIMAL(12,2) DEFAULT 0,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Geospatial index for finding nearby drivers
CREATE INDEX idx_driver_location ON driver_profiles
    USING GIST (ST_MakePoint(current_lng, current_lat));
```

### rides
```sql
CREATE TABLE rides (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    passenger_id        UUID REFERENCES users(id),
    driver_id           UUID REFERENCES users(id),
    status              VARCHAR(20) NOT NULL DEFAULT 'requested'
                        CHECK (status IN ('requested', 'matched', 'driver_arriving',
                        'in_progress', 'completed', 'cancelled')),
    pickup_lat          DECIMAL(10,7) NOT NULL,
    pickup_lng          DECIMAL(10,7) NOT NULL,
    pickup_address      TEXT,
    dropoff_lat         DECIMAL(10,7) NOT NULL,
    dropoff_lng         DECIMAL(10,7) NOT NULL,
    dropoff_address     TEXT,
    estimated_distance  DECIMAL(10,2),  -- km
    estimated_duration  INTEGER,         -- minutes
    actual_distance     DECIMAL(10,2),
    actual_duration     INTEGER,
    fare_amount         DECIMAL(10,2),
    platform_fee        DECIMAL(10,2),   -- 5-10% for costs only
    driver_payout       DECIMAL(10,2),
    surge_multiplier    DECIMAL(3,2) DEFAULT 1.00,
    vehicle_type        VARCHAR(20) DEFAULT 'economy',
    requested_at        TIMESTAMPTZ DEFAULT NOW(),
    matched_at          TIMESTAMPTZ,
    pickup_at           TIMESTAMPTZ,
    dropoff_at          TIMESTAMPTZ,
    cancelled_at        TIMESTAMPTZ,
    cancellation_reason TEXT
);
```

### payments
```sql
CREATE TABLE payments (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ride_id             UUID REFERENCES rides(id),
    passenger_id        UUID REFERENCES users(id),
    driver_id           UUID REFERENCES users(id),
    amount              DECIMAL(10,2) NOT NULL,
    platform_fee        DECIMAL(10,2) NOT NULL,
    driver_payout       DECIMAL(10,2) NOT NULL,
    payment_method      VARCHAR(20) NOT NULL,
    stripe_payment_id   VARCHAR(255),
    stripe_transfer_id  VARCHAR(255),
    status              VARCHAR(20) DEFAULT 'pending'
                        CHECK (status IN ('pending', 'completed', 'refunded', 'failed')),
    created_at          TIMESTAMPTZ DEFAULT NOW()
);
```

### governance_proposals
```sql
CREATE TABLE governance_proposals (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id       UUID REFERENCES users(id),
    title           VARCHAR(255) NOT NULL,
    description     TEXT NOT NULL,
    category        VARCHAR(50) NOT NULL
                    CHECK (category IN ('pricing', 'policy', 'feature', 'spending', 'other')),
    status          VARCHAR(20) DEFAULT 'active'
                    CHECK (status IN ('active', 'passed', 'rejected', 'implemented')),
    votes_for       INTEGER DEFAULT 0,
    votes_against   INTEGER DEFAULT 0,
    quorum_needed   INTEGER NOT NULL,       -- minimum votes to be valid
    voting_ends_at  TIMESTAMPTZ NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

### votes
```sql
CREATE TABLE votes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proposal_id     UUID REFERENCES governance_proposals(id),
    user_id         UUID REFERENCES users(id),
    vote            VARCHAR(10) CHECK (vote IN ('for', 'against', 'abstain')),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(proposal_id, user_id)  -- one vote per user per proposal
);
```

### platform_financials (transparency)
```sql
CREATE TABLE platform_financials (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    period_start        DATE NOT NULL,
    period_end          DATE NOT NULL,
    total_rides         INTEGER,
    total_fares         DECIMAL(14,2),
    total_platform_fees DECIMAL(14,2),
    server_costs        DECIMAL(14,2),
    payment_processing  DECIMAL(14,2),
    insurance_costs     DECIMAL(14,2),
    support_costs       DECIMAL(14,2),
    surplus             DECIMAL(14,2),      -- what's left to redistribute
    redistributed       BOOLEAN DEFAULT FALSE,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Core Feature Specifications

### 1. Ride Flow (Passenger)
```
Open App → See map with nearby drivers → Enter destination
→ See fare estimate (transparent breakdown) → Select vehicle type
→ Confirm ride → Matched with nearest suitable driver
→ See driver info, ETA, live tracking → Driver arrives
→ Ride in progress (live route) → Arrive at destination
→ Auto-charge (or cash) → Rate driver → See receipt with full breakdown
```

### 2. Ride Flow (Driver)
```
Open App → Toggle "Online" → Set preferences (max distance, vehicle type)
→ Receive ride request (see passenger rating, pickup distance, fare estimate)
→ Accept or decline (no penalty for reasonable declines)
→ Navigate to pickup → Confirm passenger pickup
→ Navigate to destination → Confirm dropoff
→ See earnings instantly → Rate passenger
→ See daily/weekly earnings dashboard
```

### 3. Fare Calculation (Transparent)
```
Base fare:                      Community-voted (e.g., $2.50)
Per km:                         Community-voted (e.g., $1.20/km)
Per minute:                     Community-voted (e.g., $0.20/min)
Minimum fare:                   Community-voted (e.g., $5.00)
Surge cap:                      Community-voted (e.g., max 1.5x)
Platform fee:                   Cost-based (e.g., 7%)

Fare = max(minimum, base + (distance × per_km) + (duration × per_min)) × surge
Driver gets: Fare × (1 - platform_fee_percentage)
```

### 4. Governance System
- **Who can vote**: Any verified driver or passenger with 10+ rides
- **Proposal categories**: Pricing changes, policy updates, feature requests, spending approvals
- **Voting period**: 7 days per proposal
- **Quorum**: 10% of eligible voters must participate
- **Passage**: Simple majority (>50% of votes cast)
- **Examples of votable items**:
  - "Increase base fare from $2.50 to $3.00"
  - "Cap surge pricing at 1.3x instead of 1.5x"
  - "Add in-app tipping"
  - "Approve $5,000 for marketing in Chicago"
  - "Change cancellation policy"

### 5. Transparency Dashboard
Publicly accessible page showing:
- Total rides this month/quarter/year
- Total fares collected
- Platform fee breakdown (server costs, payment processing, insurance, support)
- Surplus amount and redistribution status
- Driver earnings statistics (median, average, percentiles — anonymized)
- Governance vote history and outcomes

### 6. Surplus Redistribution
At the end of each quarter:
1. Calculate total platform fees collected
2. Subtract actual operating costs (servers, Stripe fees, insurance, support salaries)
3. Remaining surplus split: 70% to drivers (proportional to rides completed), 30% to passengers (proportional to rides taken)
4. Distributed as account credits or direct payouts

---

## Matching Algorithm

```
When passenger requests ride:
1. Query Redis GEORADIUS for online drivers within 5km
2. Filter by vehicle type match
3. Filter by driver preferences (max pickup distance)
4. Score remaining drivers:
   - Proximity weight:     40% (closer = higher score)
   - Rating weight:        20% (higher rated = slight preference)
   - Wait time weight:     25% (drivers waiting longer get priority)
   - Completion rate:      15% (reliable drivers preferred)
5. Offer ride to highest-scoring driver
6. Driver has 15 seconds to accept
7. If declined/timeout, offer to next driver
8. If no driver found within 3 attempts, expand radius to 10km
9. If still none, notify passenger with estimated wait time
```

---

## What Makes This Easy to Use

### For Passengers
- **One-tap ride request** — Just like Uber. No friction.
- **Transparent pricing** — See exactly where your money goes before you confirm.
- **Fair surge caps** — Never pay more than 1.5x (or whatever the community votes).
- **Governance participation** — Vote on policies that affect your rides.
- **Quarterly dividends** — Get money back from surplus redistribution.
- **Privacy-first** — Minimal data collection, clear data usage policy.

### For Drivers
- **Keep 90-95% of fares** — vs 70-75% on Uber.
- **Democratic voice** — Vote on fare rates, policies, and platform features.
- **Transparent earnings** — See exactly what you earn and why.
- **Fair deactivation** — Peer review panel, not opaque algorithms.
- **No forced acceptance** — Decline rides without hidden penalties.
- **Quarterly bonuses** — Surplus redistribution based on contribution.
- **Earnings dashboard** — Clear daily/weekly/monthly breakdowns.

---

## Implementation Phases

### Phase 1: MVP Core (What we build first)
- [ ] Project scaffolding (backend + mobile + database)
- [ ] User authentication (register, login, JWT)
- [ ] Driver profile & vehicle registration
- [ ] Map integration with OpenStreetMap
- [ ] Ride request & matching (basic proximity)
- [ ] Real-time ride tracking via Socket.IO
- [ ] Fare calculation (distance + time based)
- [ ] Payment processing via Stripe Connect
- [ ] Basic ratings system
- [ ] Driver earnings dashboard

### Phase 2: Community Features
- [ ] Governance proposal system
- [ ] Voting mechanism
- [ ] Transparency dashboard (open financials)
- [ ] Surplus calculation & redistribution
- [ ] Driver peer review panel for disputes

### Phase 3: Polish & Scale
- [ ] Push notifications
- [ ] Ride scheduling (book in advance)
- [ ] Multiple vehicle types
- [ ] Accessibility features (wheelchair accessible vehicles)
- [ ] In-app chat between driver and passenger
- [ ] Ride sharing (split fare with others going same direction)
- [ ] Driver referral program
- [ ] Multi-language support
- [ ] Offline-capable driver app

---

## Key Differentiators Summary

| Feature | Why It Matters |
|---------|---------------|
| 5-10% fee (cost only) | Drivers earn significantly more per ride |
| Democratic governance | Users control the platform, not shareholders |
| Transparent financials | Trust through radical openness |
| Surplus redistribution | Passengers and drivers share in success |
| Fair deactivation | Drivers can't be fired by an algorithm |
| Capped surge pricing | Passengers protected from price gouging |
| Open source | Community can verify, contribute, and fork |
| Privacy-first | Minimal tracking, no data monetization |

---

## Risk Mitigation

1. **Cold start problem** (no drivers = no passengers): Launch city-by-city. Partner with local taxi cooperatives. Offer initial driver bonuses funded by grants/donations.
2. **Regulatory compliance**: Follow Uber's model per-city. Budget for legal review in each market.
3. **Safety**: Background checks for drivers, in-app emergency button, ride sharing with trusted contacts, trip monitoring.
4. **Sustainability**: The 5-10% platform fee must cover costs. Model finances carefully. Accept donations/grants for initial runway.
5. **Competition from Uber**: Compete on values, not subsidies. Target drivers frustrated with Uber's commission and passengers who care about fairness.
