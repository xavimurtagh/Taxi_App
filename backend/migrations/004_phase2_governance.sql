-- Migration 004: Phase 2 — Community & Governance Features
-- Adds: platform config, disputes, peer reviews, moderators, payout tracking,
-- proposal execution log, moderation actions

BEGIN;

-- ============================================================================
-- Platform configuration (governable parameters)
-- Stores key-value pairs that can be changed by passed governance proposals
-- ============================================================================
CREATE TABLE platform_config (
    key             VARCHAR(100) PRIMARY KEY,
    value           TEXT NOT NULL,
    data_type       VARCHAR(20) NOT NULL DEFAULT 'string'
                    CHECK (data_type IN ('string', 'number', 'boolean', 'json')),
    description     TEXT,
    category        VARCHAR(50) NOT NULL DEFAULT 'general',
    governable      BOOLEAN DEFAULT TRUE,
    updated_by      UUID REFERENCES users(id),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default platform config from current env defaults
INSERT INTO platform_config (key, value, data_type, description, category) VALUES
    ('base_fare', '2.50', 'number', 'Base fare for rides in dollars', 'pricing'),
    ('per_km_rate', '1.20', 'number', 'Charge per kilometer in dollars', 'pricing'),
    ('per_minute_rate', '0.20', 'number', 'Charge per minute in dollars', 'pricing'),
    ('minimum_fare', '5.00', 'number', 'Minimum fare for any ride in dollars', 'pricing'),
    ('surge_cap', '1.50', 'number', 'Maximum surge multiplier', 'pricing'),
    ('platform_fee_percent', '7', 'number', 'Platform fee percentage taken from fares', 'pricing'),
    ('cancellation_fee_short', '3.00', 'number', 'Cancellation fee after driver dispatched', 'pricing'),
    ('cancellation_fee_noshow', '5.00', 'number', 'No-show cancellation fee', 'pricing'),
    ('min_rides_for_governance', '10', 'number', 'Minimum completed rides to participate in governance', 'governance'),
    ('voting_period_days', '7', 'number', 'Number of days a proposal is open for voting', 'governance'),
    ('quorum_percent', '10', 'number', 'Percentage of eligible voters needed for quorum', 'governance'),
    ('surplus_driver_share', '70', 'number', 'Percentage of surplus going to drivers', 'redistribution'),
    ('surplus_passenger_share', '30', 'number', 'Percentage of surplus going to passengers', 'redistribution'),
    ('max_pickup_distance_km', '10', 'number', 'Maximum pickup distance for matching', 'operations'),
    ('ride_offer_timeout_sec', '15', 'number', 'Seconds a driver has to accept a ride offer', 'operations'),
    ('driver_decline_limit', '3', 'number', 'Max declines per day before cooldown', 'operations'),
    ('moderator_term_months', '6', 'number', 'Length of moderator term in months', 'governance'),
    ('max_moderators', '5', 'number', 'Maximum number of active moderators', 'governance');

-- ============================================================================
-- Proposal execution log
-- Tracks what happened when a passed proposal was executed
-- ============================================================================
CREATE TABLE proposal_executions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proposal_id     UUID NOT NULL REFERENCES governance_proposals(id),
    status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'executed', 'failed', 'rolled_back')),
    config_key      VARCHAR(100) REFERENCES platform_config(key),
    old_value       TEXT,
    new_value       TEXT,
    error_message   TEXT,
    executed_by     VARCHAR(50) DEFAULT 'system',
    executed_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Add structured data to governance proposals for auto-execution
ALTER TABLE governance_proposals ADD COLUMN IF NOT EXISTS config_key VARCHAR(100);
ALTER TABLE governance_proposals ADD COLUMN IF NOT EXISTS proposed_value TEXT;
ALTER TABLE governance_proposals ADD COLUMN IF NOT EXISTS current_value TEXT;

-- ============================================================================
-- Disputes & peer review
-- ============================================================================
CREATE TABLE disputes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ride_id         UUID REFERENCES rides(id),
    initiator_id    UUID NOT NULL REFERENCES users(id),
    defendant_id    UUID NOT NULL REFERENCES users(id),
    dispute_type    VARCHAR(50) NOT NULL
                    CHECK (dispute_type IN ('safety', 'fraud', 'behavior', 'fare',
                    'discrimination', 'damage', 'deactivation_appeal', 'other')),
    title           VARCHAR(255) NOT NULL,
    description     TEXT NOT NULL,
    evidence_urls   TEXT[],
    status          VARCHAR(30) NOT NULL DEFAULT 'submitted'
                    CHECK (status IN ('submitted', 'panel_assigned', 'under_review',
                    'decision_made', 'appealed', 'appeal_review', 'final', 'closed')),
    outcome         VARCHAR(30)
                    CHECK (outcome IN ('upheld', 'dismissed', 'partial', 'pending')),
    resolution      TEXT,
    compensation_amount DECIMAL(10,2) DEFAULT 0,
    panel_size      INTEGER DEFAULT 5,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    resolved_at     TIMESTAMPTZ
);

CREATE INDEX idx_disputes_status ON disputes (status);
CREATE INDEX idx_disputes_defendant ON disputes (defendant_id);

CREATE TABLE dispute_evidence (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dispute_id      UUID NOT NULL REFERENCES disputes(id) ON DELETE CASCADE,
    submitted_by    UUID NOT NULL REFERENCES users(id),
    evidence_type   VARCHAR(30) NOT NULL
                    CHECK (evidence_type IN ('text', 'image', 'screenshot', 'ride_data', 'other')),
    content         TEXT NOT NULL,
    file_url        TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE dispute_reviews (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dispute_id      UUID NOT NULL REFERENCES disputes(id) ON DELETE CASCADE,
    reviewer_id     UUID NOT NULL REFERENCES users(id),
    vote            VARCHAR(20) NOT NULL
                    CHECK (vote IN ('uphold', 'dismiss', 'partial')),
    reasoning       TEXT NOT NULL,
    reviewed_at     TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(dispute_id, reviewer_id)
);

CREATE TABLE dispute_panel_members (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dispute_id      UUID NOT NULL REFERENCES disputes(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id),
    invited_at      TIMESTAMPTZ DEFAULT NOW(),
    responded_at    TIMESTAMPTZ,
    accepted        BOOLEAN,
    UNIQUE(dispute_id, user_id)
);

-- ============================================================================
-- Moderators & elections
-- ============================================================================
CREATE TABLE moderator_elections (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title           VARCHAR(255) NOT NULL,
    description     TEXT,
    seats_available INTEGER NOT NULL DEFAULT 1,
    status          VARCHAR(20) NOT NULL DEFAULT 'nominations'
                    CHECK (status IN ('nominations', 'voting', 'completed', 'cancelled')),
    nominations_end TIMESTAMPTZ NOT NULL,
    voting_ends     TIMESTAMPTZ NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE moderator_candidates (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    election_id     UUID NOT NULL REFERENCES moderator_elections(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id),
    statement       TEXT NOT NULL,
    votes_received  INTEGER DEFAULT 0,
    elected         BOOLEAN DEFAULT FALSE,
    nominated_at    TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(election_id, user_id)
);

CREATE TABLE moderator_election_votes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    election_id     UUID NOT NULL REFERENCES moderator_elections(id) ON DELETE CASCADE,
    voter_id        UUID NOT NULL REFERENCES users(id),
    candidate_id    UUID NOT NULL REFERENCES moderator_candidates(id),
    voted_at        TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(election_id, voter_id)
);

CREATE TABLE moderators (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id),
    election_id     UUID REFERENCES moderator_elections(id),
    term_start      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    term_end        TIMESTAMPTZ NOT NULL,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_moderators_active ON moderators (is_active) WHERE is_active = TRUE;

CREATE TABLE moderation_actions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    moderator_id    UUID NOT NULL REFERENCES moderators(id),
    target_user_id  UUID REFERENCES users(id),
    target_proposal_id UUID REFERENCES governance_proposals(id),
    action_type     VARCHAR(50) NOT NULL
                    CHECK (action_type IN ('warn_user', 'suspend_user', 'unsuspend_user',
                    'remove_review', 'flag_proposal', 'remove_proposal', 'escalate_dispute')),
    reason          TEXT NOT NULL,
    duration_hours  INTEGER,
    reversed        BOOLEAN DEFAULT FALSE,
    reversed_at     TIMESTAMPTZ,
    reversed_by     UUID REFERENCES moderators(id),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- Payout distributions tracking
-- ============================================================================
CREATE TABLE payout_distributions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    period_start        DATE NOT NULL,
    period_end          DATE NOT NULL,
    financials_id       UUID REFERENCES platform_financials(id),
    total_surplus       DECIMAL(14,2) NOT NULL,
    driver_pool         DECIMAL(14,2) NOT NULL,
    passenger_pool      DECIMAL(14,2) NOT NULL,
    status              VARCHAR(20) NOT NULL DEFAULT 'calculated'
                        CHECK (status IN ('calculated', 'approved', 'processing', 'completed', 'failed')),
    approved_by         UUID REFERENCES users(id),
    approved_at         TIMESTAMPTZ,
    completed_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE payout_items (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    distribution_id     UUID NOT NULL REFERENCES payout_distributions(id) ON DELETE CASCADE,
    user_id             UUID NOT NULL REFERENCES users(id),
    user_type           VARCHAR(20) NOT NULL CHECK (user_type IN ('driver', 'passenger')),
    rides_in_period     INTEGER NOT NULL,
    amount              DECIMAL(10,2) NOT NULL,
    stripe_transfer_id  VARCHAR(255),
    status              VARCHAR(20) NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    error_message       TEXT,
    processed_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_payout_items_distribution ON payout_items (distribution_id);
CREATE INDEX idx_payout_items_user ON payout_items (user_id);

-- ============================================================================
-- Proposal comments/discussion
-- ============================================================================
CREATE TABLE proposal_comments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proposal_id     UUID NOT NULL REFERENCES governance_proposals(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id),
    parent_id       UUID REFERENCES proposal_comments(id),
    content         TEXT NOT NULL,
    is_hidden       BOOLEAN DEFAULT FALSE,
    hidden_by       UUID REFERENCES moderators(id),
    hidden_reason   TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_proposal_comments_proposal ON proposal_comments (proposal_id);

-- Add is_moderator flag to users for quick permission checks
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_moderator BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_until TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspension_reason TEXT;

COMMIT;
