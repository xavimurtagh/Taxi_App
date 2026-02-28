-- Migration 005: Phase 2 extras
-- Adds columns referenced by moderation, execution, and redistribution systems

BEGIN;

-- Ratings soft-delete for moderation
ALTER TABLE ratings ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT FALSE;

-- Index for quick lookup of non-hidden ratings
CREATE INDEX IF NOT EXISTS idx_ratings_visible ON ratings (rated_id) WHERE is_hidden = FALSE;

-- Credit balance for surplus redistribution (passengers and drivers without Stripe Connect)
ALTER TABLE users ADD COLUMN IF NOT EXISTS credit_balance DECIMAL(10,2) NOT NULL DEFAULT 0;

COMMIT;
