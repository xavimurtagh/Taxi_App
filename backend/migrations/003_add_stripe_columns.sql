-- Migration 003: Add Stripe-related columns to users table
-- Required by payment routes for Stripe Connect and customer management

BEGIN;

ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_connect_account_id VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_connect_status VARCHAR(20) DEFAULT 'pending';

CREATE INDEX IF NOT EXISTS idx_users_stripe_customer ON users (stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_stripe_connect ON users (stripe_connect_account_id) WHERE stripe_connect_account_id IS NOT NULL;

COMMIT;
