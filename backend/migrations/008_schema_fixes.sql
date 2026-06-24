-- ============================================================================
-- OpenRide Ride-Sharing Platform
-- Migration 008: Schema Fixes
-- Aligns column names with application code and fixes constraint issues.
-- ============================================================================

BEGIN;

-- --------------------------------------------------------------------------
-- 1. rides table: rename columns to match application code
-- --------------------------------------------------------------------------

ALTER TABLE rides RENAME COLUMN estimated_distance_km TO estimated_distance;
ALTER TABLE rides RENAME COLUMN estimated_duration_min TO estimated_duration;
ALTER TABLE rides RENAME COLUMN actual_distance_km TO actual_distance;
ALTER TABLE rides RENAME COLUMN actual_duration_min TO actual_duration;
ALTER TABLE rides RENAME COLUMN fare_amount TO estimated_fare;

ALTER TABLE rides ADD COLUMN IF NOT EXISTS actual_fare DECIMAL(10,2);
ALTER TABLE rides ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- cancelled_by stores role strings ('passenger', 'driver', 'system'), not UUIDs
-- Drop the FK constraint before changing the type (the type change would
-- otherwise try to re-validate the FK against incompatible types).
ALTER TABLE rides DROP CONSTRAINT IF EXISTS rides_cancelled_by_fkey;
ALTER TABLE rides ALTER COLUMN cancelled_by TYPE VARCHAR(20) USING cancelled_by::VARCHAR;

-- --------------------------------------------------------------------------
-- 2. chat_messages: rename read -> is_read, allow NULL sender for system msgs
-- --------------------------------------------------------------------------

ALTER TABLE chat_messages RENAME COLUMN read TO is_read;
ALTER TABLE chat_messages ALTER COLUMN sender_id DROP NOT NULL;

-- Recreate index that referenced the old column name
DROP INDEX IF EXISTS idx_chat_messages_unread;
CREATE INDEX idx_chat_messages_unread ON chat_messages(ride_id, sender_id) WHERE is_read = FALSE;

-- --------------------------------------------------------------------------
-- 3. shared_ride_participants: add missing timestamp columns
-- --------------------------------------------------------------------------

ALTER TABLE shared_ride_participants ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE shared_ride_participants ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- --------------------------------------------------------------------------
-- 4. referrals: add missing updated_at
-- --------------------------------------------------------------------------

ALTER TABLE referrals ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- --------------------------------------------------------------------------
-- 5. rides.shared_ride_id: add missing FK constraint
-- --------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'rides_shared_ride_id_fkey'
  ) THEN
    ALTER TABLE rides ADD CONSTRAINT rides_shared_ride_id_fkey
      FOREIGN KEY (shared_ride_id) REFERENCES shared_rides(id);
  END IF;
END $$;

COMMIT;
