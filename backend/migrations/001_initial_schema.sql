-- ============================================================================
-- OpenRide Ride-Sharing Platform
-- Migration 001: Initial Schema
-- PostgreSQL with PostGIS
-- ============================================================================

BEGIN;

-- --------------------------------------------------------------------------
-- 1. Enable PostGIS extension
-- --------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS postgis;

-- --------------------------------------------------------------------------
-- 2. Users table
-- --------------------------------------------------------------------------
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255) NOT NULL UNIQUE,
    phone           VARCHAR(20) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    first_name      VARCHAR(100) NOT NULL,
    last_name       VARCHAR(100) NOT NULL,
    role            VARCHAR(10) NOT NULL CHECK (role IN ('passenger', 'driver', 'both')),
    avatar_url      TEXT,
    is_verified     BOOLEAN NOT NULL DEFAULT false,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    rating_avg      DECIMAL(3,2) NOT NULL DEFAULT 5.00,
    rating_count    INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --------------------------------------------------------------------------
-- 3. Driver profiles
-- --------------------------------------------------------------------------
CREATE TABLE driver_profiles (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    license_number          VARCHAR(50) NOT NULL,
    license_expiry          DATE NOT NULL,
    vehicle_make            VARCHAR(50) NOT NULL,
    vehicle_model           VARCHAR(50) NOT NULL,
    vehicle_year            INTEGER NOT NULL,
    vehicle_color           VARCHAR(30) NOT NULL,
    vehicle_plate           VARCHAR(20) NOT NULL,
    vehicle_type            VARCHAR(20) NOT NULL CHECK (vehicle_type IN ('economy', 'comfort', 'xl', 'accessible')),
    is_online               BOOLEAN NOT NULL DEFAULT false,
    current_location        GEOGRAPHY(Point, 4326),
    documents_verified      BOOLEAN NOT NULL DEFAULT false,
    background_check_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (background_check_status IN ('pending', 'passed', 'failed')),
    total_rides             INTEGER NOT NULL DEFAULT 0,
    total_earnings          DECIMAL(12,2) NOT NULL DEFAULT 0,
    max_pickup_distance_km  DECIMAL NOT NULL DEFAULT 10,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Spatial index on driver current location for proximity queries
CREATE INDEX idx_driver_profiles_current_location
    ON driver_profiles USING GIST (current_location);

-- --------------------------------------------------------------------------
-- 4. Driver documents
-- --------------------------------------------------------------------------
CREATE TABLE driver_documents (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id        UUID NOT NULL REFERENCES driver_profiles(id) ON DELETE CASCADE,
    document_type    VARCHAR(30) NOT NULL CHECK (document_type IN (
                         'license_front', 'license_back', 'vehicle_registration',
                         'insurance', 'inspection', 'profile_photo', 'background_check'
                     )),
    file_url         TEXT NOT NULL,
    status           VARCHAR(10) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    rejection_reason TEXT,
    expires_at       DATE,
    reviewed_by      UUID REFERENCES users(id),
    reviewed_at      TIMESTAMPTZ,
    uploaded_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --------------------------------------------------------------------------
-- 5. Rides
-- --------------------------------------------------------------------------
CREATE TABLE rides (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    passenger_id           UUID NOT NULL REFERENCES users(id),
    driver_id              UUID REFERENCES users(id),
    status                 VARCHAR(20) NOT NULL DEFAULT 'requested' CHECK (status IN (
                               'requested', 'matched', 'driver_arriving',
                               'in_progress', 'completed', 'cancelled'
                           )),
    pickup_location        GEOGRAPHY(Point, 4326) NOT NULL,
    pickup_address         TEXT NOT NULL,
    dropoff_location       GEOGRAPHY(Point, 4326) NOT NULL,
    dropoff_address        TEXT NOT NULL,
    estimated_distance_km  DECIMAL,
    estimated_duration_min INTEGER,
    actual_distance_km     DECIMAL,
    actual_duration_min    INTEGER,
    fare_amount            DECIMAL(10,2),
    platform_fee           DECIMAL(10,2),
    driver_payout          DECIMAL(10,2),
    surge_multiplier       DECIMAL(3,2) NOT NULL DEFAULT 1.00,
    vehicle_type           VARCHAR(20) NOT NULL DEFAULT 'economy',
    cancellation_fee       DECIMAL(10,2) NOT NULL DEFAULT 0,
    cancelled_by           UUID REFERENCES users(id),
    cancellation_reason    TEXT,
    requested_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    matched_at             TIMESTAMPTZ,
    pickup_at              TIMESTAMPTZ,
    dropoff_at             TIMESTAMPTZ,
    cancelled_at           TIMESTAMPTZ
);

CREATE INDEX idx_rides_status ON rides(status);
CREATE INDEX idx_rides_passenger_id ON rides(passenger_id);
CREATE INDEX idx_rides_driver_id ON rides(driver_id);

-- --------------------------------------------------------------------------
-- 6. Payments
-- --------------------------------------------------------------------------
CREATE TABLE payments (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ride_id             UUID NOT NULL REFERENCES rides(id),
    passenger_id        UUID NOT NULL REFERENCES users(id),
    driver_id           UUID NOT NULL REFERENCES users(id),
    amount              DECIMAL(10,2) NOT NULL,
    platform_fee        DECIMAL(10,2) NOT NULL,
    driver_payout       DECIMAL(10,2) NOT NULL,
    tip_amount          DECIMAL(10,2) NOT NULL DEFAULT 0,
    payment_method      VARCHAR(50),
    stripe_payment_id   VARCHAR(255),
    stripe_transfer_id  VARCHAR(255),
    status              VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'refunded', 'failed')),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --------------------------------------------------------------------------
-- 7. Payment methods
-- --------------------------------------------------------------------------
CREATE TABLE payment_methods (
    id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    stripe_payment_method_id  VARCHAR(255) NOT NULL,
    card_brand                VARCHAR(20),
    card_last4                VARCHAR(4),
    is_default                BOOLEAN NOT NULL DEFAULT false,
    created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --------------------------------------------------------------------------
-- 8. Ratings
-- --------------------------------------------------------------------------
CREATE TABLE ratings (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ride_id    UUID NOT NULL REFERENCES rides(id),
    rater_id   UUID NOT NULL REFERENCES users(id),
    rated_id   UUID NOT NULL REFERENCES users(id),
    score      INTEGER NOT NULL CHECK (score >= 1 AND score <= 5),
    comment    TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(ride_id, rater_id)
);

-- --------------------------------------------------------------------------
-- 9. Governance proposals
-- --------------------------------------------------------------------------
CREATE TABLE governance_proposals (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id       UUID NOT NULL REFERENCES users(id),
    title           VARCHAR(255) NOT NULL,
    description     TEXT NOT NULL,
    category        VARCHAR(20) NOT NULL CHECK (category IN ('pricing', 'policy', 'feature', 'spending', 'other')),
    status          VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'passed', 'rejected', 'implemented')),
    votes_for       INTEGER NOT NULL DEFAULT 0,
    votes_against   INTEGER NOT NULL DEFAULT 0,
    quorum_needed   INTEGER NOT NULL,
    voting_ends_at  TIMESTAMPTZ NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --------------------------------------------------------------------------
-- 10. Votes
-- --------------------------------------------------------------------------
CREATE TABLE votes (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proposal_id UUID NOT NULL REFERENCES governance_proposals(id),
    user_id     UUID NOT NULL REFERENCES users(id),
    vote        VARCHAR(10) NOT NULL CHECK (vote IN ('for', 'against', 'abstain')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(proposal_id, user_id)
);

-- --------------------------------------------------------------------------
-- 11. Platform financials
-- --------------------------------------------------------------------------
CREATE TABLE platform_financials (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    period_start          DATE NOT NULL,
    period_end            DATE NOT NULL,
    total_rides           INTEGER NOT NULL,
    total_fares           DECIMAL(14,2) NOT NULL,
    total_platform_fees   DECIMAL(14,2) NOT NULL,
    server_costs          DECIMAL(14,2) NOT NULL,
    payment_processing    DECIMAL(14,2) NOT NULL,
    insurance_costs       DECIMAL(14,2) NOT NULL,
    support_costs         DECIMAL(14,2) NOT NULL,
    surplus               DECIMAL(14,2) NOT NULL,
    redistributed         BOOLEAN NOT NULL DEFAULT false,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --------------------------------------------------------------------------
-- 12. Emergency contacts
-- --------------------------------------------------------------------------
CREATE TABLE emergency_contacts (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name          VARCHAR(100) NOT NULL,
    phone         VARCHAR(20) NOT NULL,
    relationship  VARCHAR(50) NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --------------------------------------------------------------------------
-- 13. Trip shares
-- --------------------------------------------------------------------------
CREATE TABLE trip_shares (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ride_id           UUID NOT NULL REFERENCES rides(id),
    share_token       VARCHAR(64) NOT NULL UNIQUE,
    shared_with_phone VARCHAR(20),
    shared_with_email VARCHAR(255),
    expires_at        TIMESTAMPTZ NOT NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --------------------------------------------------------------------------
-- 14. Safety incidents
-- --------------------------------------------------------------------------
CREATE TABLE safety_incidents (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ride_id       UUID NOT NULL REFERENCES rides(id),
    reported_by   UUID NOT NULL REFERENCES users(id),
    incident_type VARCHAR(50) NOT NULL,
    description   TEXT NOT NULL,
    status        VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved', 'closed')),
    resolved_at   TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --------------------------------------------------------------------------
-- 15. Support tickets
-- --------------------------------------------------------------------------
CREATE TABLE support_tickets (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id),
    ride_id     UUID REFERENCES rides(id),
    category    VARCHAR(50) NOT NULL,
    subject     VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    status      VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
    assigned_to UUID REFERENCES users(id),
    resolved_at TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --------------------------------------------------------------------------
-- 16. Support messages
-- --------------------------------------------------------------------------
CREATE TABLE support_messages (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id   UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
    sender_id   UUID NOT NULL REFERENCES users(id),
    message     TEXT NOT NULL,
    is_internal BOOLEAN NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --------------------------------------------------------------------------
-- 17. Saved places
-- --------------------------------------------------------------------------
CREATE TABLE saved_places (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    label      VARCHAR(50) NOT NULL,
    address    TEXT NOT NULL,
    location   GEOGRAPHY(Point, 4326) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --------------------------------------------------------------------------
-- 18. Refresh tokens
-- --------------------------------------------------------------------------
CREATE TABLE refresh_tokens (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token      VARCHAR(500) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_refresh_tokens_token ON refresh_tokens(token);

-- --------------------------------------------------------------------------
-- 19. Notification tokens
-- --------------------------------------------------------------------------
CREATE TABLE notification_tokens (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token      TEXT NOT NULL,
    platform   VARCHAR(10) NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, token)
);

-- --------------------------------------------------------------------------
-- Helper: auto-update updated_at trigger
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMIT;
