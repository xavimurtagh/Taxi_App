-- ============================================================================
-- OpenRide Ride-Sharing Platform
-- Migration 009: Driver profile columns expected by application code
-- ============================================================================
-- Application code reads driver_profiles.rating and driver_profiles.is_approved
-- in several places (users.js, rides.js, matching.js, ridesharing.js), but
-- neither column existed in the schema, causing 500 errors on the active-ride
-- and driver-profile endpoints. This migration adds them.
-- ============================================================================

BEGIN;

-- is_approved: a driver is approved once their documents are verified and the
-- background check has passed. A generated column keeps it always correct with
-- no application-level syncing required.
ALTER TABLE driver_profiles
  ADD COLUMN IF NOT EXISTS is_approved BOOLEAN
  GENERATED ALWAYS AS (documents_verified AND background_check_status = 'passed') STORED;

-- rating: denormalized copy of the driver's users.rating_avg so driver queries
-- that join driver_profiles can read a rating without an extra users join.
ALTER TABLE driver_profiles
  ADD COLUMN IF NOT EXISTS rating DECIMAL(3,2) NOT NULL DEFAULT 5.00;

-- Backfill rating from the canonical users.rating_avg value.
UPDATE driver_profiles dp
  SET rating = u.rating_avg
  FROM users u
  WHERE u.id = dp.user_id;

COMMIT;
