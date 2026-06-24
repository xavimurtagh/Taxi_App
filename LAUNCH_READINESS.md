# OpenRide — Launch Readiness Assessment

_Last updated: 2026-06-24_

This document records the state of the platform after end-to-end deployment
testing against real infrastructure (PostgreSQL 16 + PostGIS 3.4, Redis 7,
the Node/Express API, and the Next.js web build), and what remains before a
public launch.

---

## How this was validated

The full stack was deployed locally and exercised, not just statically
analyzed:

- A real Postgres + PostGIS cluster was initialized and **all 10 migrations**
  applied cleanly from scratch via the new `npm run migrate` runner.
- The API server was booted against real Postgres + Redis; **every route group
  was smoke-tested** (auth, rides, drivers, governance, transparency, payments,
  feedback, ratings, referrals, scheduling, ridesharing, accessibility, etc.).
- Core flows were driven end-to-end: register → login, ride request → active →
  cancel, fare estimate, driver earnings, transparency summary, governance
  proposals/voting eligibility, phone verification, and password reset.

This surfaced a class of bugs that unit tests and static audits missed —
schema/code column drift that only fails when a real query runs.

---

## Fixed during this assessment

### Deploy blockers
- **Missing migration runner.** `npm run migrate` pointed at a non-existent
  file. Added `src/db/migrate.js`: tracks applied files in `schema_migrations`,
  wraps each in a transaction, ensures `postgis`/`pgcrypto` extensions. CI now
  runs it instead of applying only `001`.
- **Migration 008 ordering bug** — altered `cancelled_by` type before dropping
  its FK constraint; reordered.

### Data-layer bugs (would 500 in production)
- Seed bcrypt hash didn't match the documented password — **no demo account
  could log in**. Regenerated.
- `driver_profiles` was missing `rating` and `is_approved` columns that the
  code reads → 500s on active-ride and driver-profile endpoints (migration 009).
- `estimated_duration`/`actual_duration` were INTEGER but the estimator emits
  fractional minutes → **every ride-creation path 500'd** (migration 010).
- `transparency`, `governance`, `redistribution`, `drivers`, and `payments`
  still read the renamed `fare_amount` / `actual_distance_km` /
  `actual_duration_min` columns. Updated to current names.

### Security / launch gaps
- **Phone verification was a stub** (`/send-verification` returned hardcoded
  `123456`; `/verify-phone` accepted any 6-digit code). Replaced with real
  Redis-backed codes (10-min TTL, 5-attempt throttle, single-use).
- **Password reset did not exist.** Added an email service (nodemailer, SMTP,
  dev-log fallback) plus `/forgot-password` and `/reset-password` with
  tokenized Redis-backed links (30-min TTL, single-use, anti-enumeration,
  session revocation on reset).
- **Production now fails fast** if JWT secrets are left at insecure defaults,
  and warns on missing Stripe/Twilio config.

### Client configuration
- Mobile hardcoded `http://localhost:3000`. Now reads
  `EXPO_PUBLIC_API_URL` / `EXPO_PUBLIC_SOCKET_URL`; `eas.json` fixed to use the
  inlined `EXPO_PUBLIC_*` vars and the correct `/api/v1` path.

---

## Integration status

| Integration | Status | Notes |
|---|---|---|
| Payments (Stripe) | **Real**, gated | Real PaymentIntents/transfers/refunds + webhook signature verification. Needs live keys. |
| Push (Expo) | **Real** | Calls the Expo push API directly. |
| File uploads (S3) | **Real**, gated | Presigned uploads; needs bucket + credentials. |
| Geocoding (Nominatim) | **Real**, gated | Defaults to public OSM; set a dedicated instance for volume. |
| Routing (OSRM) | **Fallback** | Uses OSRM when configured, else Haversine estimate. Fine for estimates. |
| SMS (Twilio) | **Real**, gated | Sends real SMS when configured; dev-logs otherwise. |
| Email (SMTP) | **Real**, gated | New; sends real email when configured, dev-logs otherwise. |

"Gated" = works when its env vars are set, degrades safely (or logs) when not.

---

## Remaining before public launch (requires accounts / infra — not code)

These cannot be completed from the codebase alone; they need real credentials,
hosting, or business decisions:

1. **Provision production credentials** — Stripe live keys + webhook secret,
   Twilio SMS, SMTP provider, S3 bucket, Google Maps key, Sentry DSN. All are
   wired; they just need values in the production environment.
2. **Stand up infrastructure** — point a domain at a host, run
   `docker-compose.prod.yml`, obtain SSL via the included certbot setup, run
   `npm run migrate` against the production DB. (All config exists under
   `infrastructure/` and `.github/workflows/deploy.yml`.)
3. **Seed data** — `002_seed_data.sql` is demo data. Do **not** load it in
   production; load only the platform-config rows.
4. **Run load + security tests against staging** — the k6 suite (`tests/load/`)
   and OWASP checks (`tests/security/`) exist but should be run against a
   deployed staging environment.
5. **App store submission** — metadata is prepared under
   `mobile/store-metadata/`; needs Apple/Google accounts and real builds.
6. **Legal/operational** — terms, privacy, and driver agreement pages exist;
   have them reviewed by counsel for the launch jurisdiction.

---

## Recommended pre-launch checklist

- [ ] Set all production env vars (see `.env.production.example`); confirm the
      app boots (it will refuse to start with default JWT secrets).
- [ ] `npm run migrate` against the production database (no seed data).
- [ ] Verify `/health`, `/health/ready`, and `/metrics` from outside the host.
- [ ] Complete one real Stripe test charge end-to-end in staging.
- [ ] Confirm a real SMS code and a real password-reset email are delivered.
- [ ] Run the k6 smoke + average-load scenarios against staging.
- [ ] Build the mobile app with the production EAS profile and verify it
      reaches the production API.
