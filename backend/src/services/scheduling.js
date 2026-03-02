import { query } from '../config/database.js';
import { getIO } from '../sockets/index.js';
import { estimateFare } from './pricing.js';
import { matchRide } from './matching.js';
import { getConfig } from './platformConfig.js';
import { notifyUser } from './notifications.js';

// ---------------------------------------------------------------------------
// Constants & defaults
// ---------------------------------------------------------------------------

const MIN_ADVANCE_MINUTES = 30;
const DEFAULT_MAX_ADVANCE_HOURS = 168; // 7 days
const DEFAULT_MAX_SCHEDULED_PER_USER = 10;
const DEFAULT_REMINDER_MINUTES = 30;

// ---------------------------------------------------------------------------
// createScheduledRide
// ---------------------------------------------------------------------------

/**
 * Validate inputs and persist a new scheduled ride.
 *
 * @param {Object} data
 * @param {string} data.passengerId       - Passenger UUID
 * @param {number} data.pickupLat         - Pickup latitude
 * @param {number} data.pickupLng         - Pickup longitude
 * @param {string} data.pickupAddress     - Human-readable pickup address
 * @param {number} data.dropoffLat        - Dropoff latitude
 * @param {number} data.dropoffLng        - Dropoff longitude
 * @param {string} data.dropoffAddress    - Human-readable dropoff address
 * @param {string} data.vehicleType       - Vehicle class (economy, comfort, etc.)
 * @param {string} data.scheduledTime     - ISO-8601 datetime string
 * @param {string} [data.notes]           - Optional notes
 * @param {boolean} [data.accessibilityNeeded] - Whether accessibility features needed
 * @returns {Promise<Object>} The newly created scheduled ride record
 */
export async function createScheduledRide(data) {
  const {
    passengerId,
    pickupLat,
    pickupLng,
    pickupAddress,
    dropoffLat,
    dropoffLng,
    dropoffAddress,
    vehicleType = 'economy',
    scheduledTime,
    notes,
    accessibilityNeeded = false,
  } = data;

  // --- Time validation ---
  const scheduledDate = new Date(scheduledTime);
  const now = new Date();
  const diffMs = scheduledDate.getTime() - now.getTime();
  const diffMinutes = diffMs / 60_000;

  if (diffMinutes < MIN_ADVANCE_MINUTES) {
    throw Object.assign(
      new Error(`Scheduled time must be at least ${MIN_ADVANCE_MINUTES} minutes in the future`),
      { statusCode: 400 }
    );
  }

  const maxAdvanceHours =
    (await getConfig('scheduled_ride_advance_hours')) || DEFAULT_MAX_ADVANCE_HOURS;
  const maxAdvanceMs = maxAdvanceHours * 60 * 60 * 1000;

  if (diffMs > maxAdvanceMs) {
    throw Object.assign(
      new Error(`Scheduled time must be within the next ${maxAdvanceHours} hours`),
      { statusCode: 400 }
    );
  }

  // --- Limit active scheduled rides ---
  const maxScheduled =
    (await getConfig('max_scheduled_rides_per_user')) || DEFAULT_MAX_SCHEDULED_PER_USER;

  const countResult = await query(
    `SELECT COUNT(*)::int AS total
     FROM scheduled_rides
     WHERE passenger_id = $1
       AND status IN ('scheduled', 'reminder_sent')`,
    [passengerId]
  );

  if (countResult.rows[0].total >= maxScheduled) {
    throw Object.assign(
      new Error(`You can have at most ${maxScheduled} active scheduled rides`),
      { statusCode: 409 }
    );
  }

  // --- Fare estimate ---
  const fareEstimate = await estimateFare(
    pickupLat,
    pickupLng,
    dropoffLat,
    dropoffLng,
    vehicleType
  );

  // --- Persist ---
  const result = await query(
    `INSERT INTO scheduled_rides (
       passenger_id,
       pickup_location, pickup_address,
       dropoff_location, dropoff_address,
       vehicle_type, scheduled_time,
       estimated_fare, notes, accessibility_needed,
       status
     )
     VALUES (
       $1,
       ST_MakePoint($2, $3)::geography, $4,
       ST_MakePoint($5, $6)::geography, $7,
       $8, $9,
       $10, $11, $12,
       'scheduled'
     )
     RETURNING
       id, passenger_id, status,
       ST_Y(pickup_location::geometry)  AS pickup_lat,
       ST_X(pickup_location::geometry)  AS pickup_lng,
       pickup_address,
       ST_Y(dropoff_location::geometry) AS dropoff_lat,
       ST_X(dropoff_location::geometry) AS dropoff_lng,
       dropoff_address,
       vehicle_type, scheduled_time, estimated_fare,
       notes, accessibility_needed, created_at`,
    [
      passengerId,
      pickupLng, pickupLat, pickupAddress,
      dropoffLng, dropoffLat, dropoffAddress,
      vehicleType, scheduledDate,
      fareEstimate.fare, notes || null, accessibilityNeeded,
    ]
  );

  return {
    ...result.rows[0],
    fareEstimate,
  };
}

// ---------------------------------------------------------------------------
// dispatchScheduledRide
// ---------------------------------------------------------------------------

/**
 * Convert a scheduled ride into an actual ride and trigger driver matching.
 *
 * Called by the scheduler when the scheduled_time is approaching (within 15 min).
 *
 * @param {string} scheduledRideId - UUID of the scheduled_ride row
 * @returns {Promise<Object|null>} The created ride, or null on failure
 */
export async function dispatchScheduledRide(scheduledRideId) {
  // Fetch the scheduled ride (only if still dispatchable)
  const srResult = await query(
    `SELECT id, passenger_id, vehicle_type, estimated_fare,
            ST_Y(pickup_location::geometry)  AS pickup_lat,
            ST_X(pickup_location::geometry)  AS pickup_lng,
            pickup_address,
            ST_Y(dropoff_location::geometry) AS dropoff_lat,
            ST_X(dropoff_location::geometry) AS dropoff_lng,
            dropoff_address,
            scheduled_time, accessibility_needed
     FROM scheduled_rides
     WHERE id = $1
       AND status IN ('scheduled', 'reminder_sent')`,
    [scheduledRideId]
  );

  if (srResult.rows.length === 0) {
    return null;
  }

  const sr = srResult.rows[0];

  // Transition to 'dispatching'
  await query(
    `UPDATE scheduled_rides SET status = 'dispatching', updated_at = NOW() WHERE id = $1`,
    [scheduledRideId]
  );

  // Get a fresh fare estimate
  let fareEstimate;
  try {
    fareEstimate = await estimateFare(
      sr.pickup_lat,
      sr.pickup_lng,
      sr.dropoff_lat,
      sr.dropoff_lng,
      sr.vehicle_type
    );
  } catch {
    // Fall back to the stored estimate
    fareEstimate = {
      fare: parseFloat(sr.estimated_fare),
      estimatedDistance: 0,
      estimatedDuration: 0,
      surgeMultiplier: 1.0,
    };
  }

  // Create the actual ride record
  const rideResult = await query(
    `INSERT INTO rides (
       passenger_id, status,
       pickup_location, pickup_address,
       dropoff_location, dropoff_address,
       vehicle_type,
       estimated_fare, estimated_distance, estimated_duration,
       surge_multiplier,
       scheduled_ride_id,
       accessibility_features,
       requested_at
     )
     VALUES (
       $1, 'requested',
       ST_MakePoint($2, $3)::geography, $4,
       ST_MakePoint($5, $6)::geography, $7,
       $8,
       $9, $10, $11,
       $12,
       $13,
       $14,
       NOW()
     )
     RETURNING id, passenger_id, status,
               ST_Y(pickup_location::geometry) AS pickup_lat,
               ST_X(pickup_location::geometry) AS pickup_lng,
               pickup_address,
               ST_Y(dropoff_location::geometry) AS dropoff_lat,
               ST_X(dropoff_location::geometry) AS dropoff_lng,
               dropoff_address,
               vehicle_type, estimated_fare, requested_at`,
    [
      sr.passenger_id,
      sr.pickup_lng, sr.pickup_lat, sr.pickup_address,
      sr.dropoff_lng, sr.dropoff_lat, sr.dropoff_address,
      sr.vehicle_type,
      fareEstimate.fare,
      fareEstimate.estimatedDistance || 0,
      fareEstimate.estimatedDuration || 0,
      fareEstimate.surgeMultiplier || 1.0,
      scheduledRideId,
      sr.accessibility_needed ? JSON.stringify({ wheelchair: true }) : '{}',
    ]
  );

  const ride = rideResult.rows[0];

  // Link the ride back to the scheduled_rides row
  await query(
    `UPDATE scheduled_rides SET ride_id = $1, updated_at = NOW() WHERE id = $2`,
    [ride.id, scheduledRideId]
  );

  // Notify the passenger that their scheduled ride is being dispatched
  await notifyUser(sr.passenger_id, 'scheduled_ride:dispatching', {
    scheduledRideId,
    rideId: ride.id,
    message: 'Your scheduled ride is being matched with a driver now.',
  });

  // Trigger matching in the background
  matchRide(ride.id, sr.pickup_lat, sr.pickup_lng, sr.vehicle_type).then(
    (matched) => {
      if (matched) {
        query(
          `UPDATE scheduled_rides SET status = 'matched', updated_at = NOW() WHERE id = $1`,
          [scheduledRideId]
        ).catch((err) => {
          console.error('[scheduling] Failed to update scheduled ride status to matched:', err.message);
        });
      }
    },
    (err) => {
      console.error(`[scheduling] Background matching failed for scheduled ride ${scheduledRideId}:`, err.message);
    }
  );

  return ride;
}

// ---------------------------------------------------------------------------
// sendReminders
// ---------------------------------------------------------------------------

/**
 * Find scheduled rides within the reminder window and send push notifications.
 *
 * Only rides in 'scheduled' status are eligible. After sending, the status is
 * transitioned to 'reminder_sent'.
 *
 * @returns {Promise<number>} Number of reminders sent
 */
export async function sendReminders() {
  const reminderMinutes =
    (await getConfig('scheduled_ride_reminder_minutes')) || DEFAULT_REMINDER_MINUTES;

  const result = await query(
    `SELECT id, passenger_id, scheduled_time, pickup_address, dropoff_address, vehicle_type
     FROM scheduled_rides
     WHERE status = 'scheduled'
       AND scheduled_time <= NOW() + ($1 || ' minutes')::INTERVAL
       AND scheduled_time > NOW()`,
    [reminderMinutes]
  );

  let count = 0;

  for (const sr of result.rows) {
    try {
      await notifyUser(sr.passenger_id, 'scheduled_ride:reminder', {
        scheduledRideId: sr.id,
        scheduledTime: sr.scheduled_time,
        pickupAddress: sr.pickup_address,
        dropoffAddress: sr.dropoff_address,
        vehicleType: sr.vehicle_type,
        message: `Your scheduled ride to ${sr.dropoff_address} is coming up at ${new Date(sr.scheduled_time).toLocaleTimeString()}.`,
      });

      await query(
        `UPDATE scheduled_rides SET status = 'reminder_sent', updated_at = NOW() WHERE id = $1`,
        [sr.id]
      );

      count++;
    } catch (err) {
      console.error(`[scheduling] Failed to send reminder for scheduled ride ${sr.id}:`, err.message);
    }
  }

  return count;
}

// ---------------------------------------------------------------------------
// expireStaleScheduled
// ---------------------------------------------------------------------------

/**
 * Mark scheduled rides whose scheduled_time has passed (and were never
 * dispatched or matched) as 'expired'.
 *
 * @returns {Promise<number>} Number of rides expired
 */
export async function expireStaleScheduled() {
  const result = await query(
    `UPDATE scheduled_rides
     SET status = 'expired', updated_at = NOW()
     WHERE status IN ('scheduled', 'reminder_sent')
       AND scheduled_time < NOW()
     RETURNING id, passenger_id`
  );

  // Notify each passenger
  for (const sr of result.rows) {
    try {
      await notifyUser(sr.passenger_id, 'scheduled_ride:expired', {
        scheduledRideId: sr.id,
        message: 'Your scheduled ride has expired because no driver was available.',
      });
    } catch {
      // Non-critical
    }
  }

  return result.rowCount;
}

// ---------------------------------------------------------------------------
// getUpcoming
// ---------------------------------------------------------------------------

/**
 * Get upcoming scheduled rides for a user within the next 24 hours.
 *
 * @param {string} userId - User UUID
 * @returns {Promise<Array>} List of upcoming scheduled rides
 */
export async function getUpcoming(userId) {
  const result = await query(
    `SELECT id, passenger_id, status,
            ST_Y(pickup_location::geometry)  AS pickup_lat,
            ST_X(pickup_location::geometry)  AS pickup_lng,
            pickup_address,
            ST_Y(dropoff_location::geometry) AS dropoff_lat,
            ST_X(dropoff_location::geometry) AS dropoff_lng,
            dropoff_address,
            vehicle_type, scheduled_time, estimated_fare,
            notes, accessibility_needed, ride_id, created_at
     FROM scheduled_rides
     WHERE passenger_id = $1
       AND status IN ('scheduled', 'reminder_sent', 'dispatching')
       AND scheduled_time <= NOW() + INTERVAL '24 hours'
       AND scheduled_time > NOW()
     ORDER BY scheduled_time ASC`,
    [userId]
  );

  return result.rows;
}
