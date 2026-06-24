-- ============================================================================
-- OpenRide Ride-Sharing Platform
-- Migration 010: Allow fractional ride durations
-- ============================================================================
-- estimated_duration / actual_duration were INTEGER (minutes), but the fare
-- estimator and routing produce fractional minute values (e.g. 3.32 min).
-- Inserting a fractional value into an INTEGER column raised error 22P02 and
-- broke every ride-creation path (request, schedule, shared ride, matching).
-- estimated_distance is already DECIMAL; align duration to NUMERIC so fractional
-- minutes are stored losslessly.
-- ============================================================================

BEGIN;

ALTER TABLE rides
  ALTER COLUMN estimated_duration TYPE NUMERIC(10,2)
    USING estimated_duration::NUMERIC,
  ALTER COLUMN actual_duration TYPE NUMERIC(10,2)
    USING actual_duration::NUMERIC;

COMMIT;
