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
 * @param {string} passengerId          - Passenger UUID
 * @param {Object} data
 * @param {number} data.pickupLat       - Pickup latitude
 * @param {number} data.pickupLng       - Pickup longitude
 * @param {string} data.pickupAddress   - Human-readable pickup address
 * @param {number} data.dropoffLat      - Dropoff latitude
 * @param {number} data.dropoffLng      - Dropoff longitude
 * @param {string} data.dropoffAddress  - Human-readable dropoff address
 * @param {string} data.vehicleType     - Vehicle class (economy, comfort, etc.)
 * @param {string} data.scheduledTime   - ISO-8601 datetime string
 * @param {string} [data.notes]         - Optional notes
 * @param {boolean} [data.accessibilityNeeded] - Whether accessibility features needed
 * @param {boolean} [data.recurring]    - Whether this is a recurring ride
 * @param {Object} [data.recurrencePattern] - JSONB recurrence config
 * @returns {Promise<Object>} The newly created scheduled ride record
 */
export async function createScheduledRide(passengerId, data) {
  const {
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
    recurring = false,
    recurrencePattern = null,
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
       AND status IN ('scheduled', 'reminder_sent', 'dispatching')`,
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
       recurring, recurrence_pattern,
       status
     )
     VALUES (
       $1,
       ST_MakePoint($2, $3)::geography, $4,
       ST_MakePoint($5, $6)::geography, $7,
       $8, $9,
       $10, $11, $12,
       $13, $14,
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
       notes, accessibility_needed,
       recurring, recurrence_pattern,
       ride_id, created_at, updated_at`,
    [
      passengerId,
      pickupLng, pickupLat, pickupAddress,
      dropoffLng, dropoffLat, dropoffAddress,
      vehicleType, scheduledDate,
      fareEstimate.fare, notes || null, accessibilityNeeded,
      recurring, recurrencePattern ? JSON.stringify(recurrencePattern) : null,
    ]
  );

  return {
    ...formatScheduledRide(result.rows[0]),
    fareEstimate,
  };
}

// ---------------------------------------------------------------------------
// getScheduledRides
// ---------------------------------------------------------------------------

/**
 * List scheduled rides for a passenger with optional status filter and
 * pagination.
 *
 * @param {string} passengerId
 * @param {Object} [opts]
 * @param {string} [opts.status]  - Filter by status
 * @param {number} [opts.page=1]
 * @param {number} [opts.limit=20]
 * @returns {Promise<{ rides: Object[], total: number, page: number, limit: number }>}
 */
export async function getScheduledRides(passengerId, opts = {}) {
  const { status = null } = opts;
  const page = Math.max(1, parseInt(opts.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(opts.limit, 10) || 20));
  const offset = (page - 1) * limit;

  const conditions = ['passenger_id = $1'];
  const params = [passengerId];
  let paramIndex = 2;

  if (status) {
    conditions.push(`status = $${paramIndex}`);
    params.push(status);
    paramIndex++;
  }

  const whereClause = conditions.join(' AND ');

  const countResult = await query(
    `SELECT COUNT(*)::int AS total FROM scheduled_rides WHERE ${whereClause}`,
    params
  );

  const total = countResult.rows[0].total;

  const ridesResult = await query(
    `SELECT id, passenger_id, status,
            ST_Y(pickup_location::geometry)  AS pickup_lat,
            ST_X(pickup_location::geometry)  AS pickup_lng,
            pickup_address,
            ST_Y(dropoff_location::geometry) AS dropoff_lat,
            ST_X(dropoff_location::geometry) AS dropoff_lng,
            dropoff_address,
            vehicle_type, scheduled_time, estimated_fare,
            notes, accessibility_needed, ride_id,
            recurring, recurrence_pattern,
            created_at, updated_at
     FROM scheduled_rides
     WHERE ${whereClause}
     ORDER BY scheduled_time DESC
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    [...params, limit, offset]
  );

  return {
    rides: ridesResult.rows.map(formatScheduledRide),
    total,
    page,
    limit,
  };
}

// ---------------------------------------------------------------------------
// getScheduledRideById
// ---------------------------------------------------------------------------

/**
 * Get a single scheduled ride by ID, verifying ownership.
 *
 * @param {string} id          - Scheduled ride UUID
 * @param {string} passengerId - Requesting user's UUID
 * @returns {Promise<Object>}
 */
export async function getScheduledRideById(id, passengerId) {
  const result = await query(
    `SELECT id, passenger_id, status,
            ST_Y(pickup_location::geometry)  AS pickup_lat,
            ST_X(pickup_location::geometry)  AS pickup_lng,
            pickup_address,
            ST_Y(dropoff_location::geometry) AS dropoff_lat,
            ST_X(dropoff_location::geometry) AS dropoff_lng,
            dropoff_address,
            vehicle_type, scheduled_time, estimated_fare,
            notes, accessibility_needed, ride_id,
            recurring, recurrence_pattern,
            created_at, updated_at
     FROM scheduled_rides
     WHERE id = $1`,
    [id]
  );

  if (result.rows.length === 0) {
    throw Object.assign(new Error('Scheduled ride not found'), { statusCode: 404 });
  }

  const row = result.rows[0];

  if (row.passenger_id !== passengerId) {
    throw Object.assign(
      new Error('You are not authorized to view this scheduled ride'),
      { statusCode: 403 }
    );
  }

  return formatScheduledRide(row);
}

// ---------------------------------------------------------------------------
// updateScheduledRide
// ---------------------------------------------------------------------------

/**
 * Update a scheduled ride. Only allowed when status is 'scheduled'.
 *
 * @param {string} id          - Scheduled ride UUID
 * @param {string} passengerId - Requesting user's UUID
 * @param {Object} data        - Fields to update
 * @returns {Promise<Object>}  The updated scheduled ride
 */
export async function updateScheduledRide(id, passengerId, data) {
  // Verify ownership and status
  const existing = await query(
    `SELECT id, passenger_id, status, scheduled_time,
            ST_Y(pickup_location::geometry)  AS pickup_lat,
            ST_X(pickup_location::geometry)  AS pickup_lng,
            ST_Y(dropoff_location::geometry) AS dropoff_lat,
            ST_X(dropoff_location::geometry) AS dropoff_lng,
            vehicle_type
     FROM scheduled_rides WHERE id = $1`,
    [id]
  );

  if (existing.rows.length === 0) {
    throw Object.assign(new Error('Scheduled ride not found'), { statusCode: 404 });
  }

  const ride = existing.rows[0];

  if (ride.passenger_id !== passengerId) {
    throw Object.assign(
      new Error('You are not authorized to update this scheduled ride'),
      { statusCode: 403 }
    );
  }

  if (ride.status !== 'scheduled') {
    throw Object.assign(
      new Error(`Cannot update a scheduled ride with status '${ride.status}'. Only rides in 'scheduled' status can be modified.`),
      { statusCode: 409 }
    );
  }

  // Must be at least 30 min before the current scheduled pickup
  const currentScheduledTime = new Date(ride.scheduled_time);
  const minutesBefore = (currentScheduledTime.getTime() - Date.now()) / 60_000;

  if (minutesBefore < MIN_ADVANCE_MINUTES) {
    throw Object.assign(
      new Error(`Cannot update a scheduled ride less than ${MIN_ADVANCE_MINUTES} minutes before the pickup time`),
      { statusCode: 409 }
    );
  }

  // If a new scheduledTime is provided, validate it
  if (data.scheduledTime) {
    const newDate = new Date(data.scheduledTime);
    const diffMinutes = (newDate.getTime() - Date.now()) / 60_000;

    if (diffMinutes < MIN_ADVANCE_MINUTES) {
      throw Object.assign(
        new Error(`New scheduled time must be at least ${MIN_ADVANCE_MINUTES} minutes in the future`),
        { statusCode: 400 }
      );
    }

    const maxAdvanceHours =
      (await getConfig('scheduled_ride_advance_hours')) || DEFAULT_MAX_ADVANCE_HOURS;
    const maxMs = maxAdvanceHours * 60 * 60 * 1000;

    if (newDate.getTime() - Date.now() > maxMs) {
      throw Object.assign(
        new Error(`Scheduled time must be within the next ${maxAdvanceHours} hours`),
        { statusCode: 400 }
      );
    }
  }

  // Build dynamic SET clause
  const setClauses = [];
  const params = [];
  let paramIndex = 1;

  const {
    pickupLat,
    pickupLng,
    pickupAddress,
    dropoffLat,
    dropoffLng,
    dropoffAddress,
    vehicleType,
    scheduledTime,
    notes,
    accessibilityNeeded,
  } = data;

  if (pickupLat !== undefined && pickupLng !== undefined) {
    setClauses.push(`pickup_location = ST_MakePoint($${paramIndex}, $${paramIndex + 1})::geography`);
    params.push(pickupLng, pickupLat);
    paramIndex += 2;
  }

  if (pickupAddress !== undefined) {
    setClauses.push(`pickup_address = $${paramIndex}`);
    params.push(pickupAddress);
    paramIndex++;
  }

  if (dropoffLat !== undefined && dropoffLng !== undefined) {
    setClauses.push(`dropoff_location = ST_MakePoint($${paramIndex}, $${paramIndex + 1})::geography`);
    params.push(dropoffLng, dropoffLat);
    paramIndex += 2;
  }

  if (dropoffAddress !== undefined) {
    setClauses.push(`dropoff_address = $${paramIndex}`);
    params.push(dropoffAddress);
    paramIndex++;
  }

  if (vehicleType !== undefined) {
    setClauses.push(`vehicle_type = $${paramIndex}`);
    params.push(vehicleType);
    paramIndex++;
  }

  if (scheduledTime !== undefined) {
    setClauses.push(`scheduled_time = $${paramIndex}`);
    params.push(new Date(scheduledTime));
    paramIndex++;
  }

  if (notes !== undefined) {
    setClauses.push(`notes = $${paramIndex}`);
    params.push(notes || null);
    paramIndex++;
  }

  if (accessibilityNeeded !== undefined) {
    setClauses.push(`accessibility_needed = $${paramIndex}`);
    params.push(accessibilityNeeded);
    paramIndex++;
  }

  if (setClauses.length === 0) {
    throw Object.assign(new Error('No fields provided to update'), { statusCode: 400 });
  }

  // Re-estimate fare if location or vehicle type changed
  if (pickupLat !== undefined || dropoffLat !== undefined || vehicleType !== undefined) {
    const pLat = pickupLat ?? ride.pickup_lat;
    const pLng = pickupLng ?? ride.pickup_lng;
    const dLat = dropoffLat ?? ride.dropoff_lat;
    const dLng = dropoffLng ?? ride.dropoff_lng;
    const vType = vehicleType ?? ride.vehicle_type;

    const fareEstimate = await estimateFare(pLat, pLng, dLat, dLng, vType);

    setClauses.push(`estimated_fare = $${paramIndex}`);
    params.push(fareEstimate.fare);
    paramIndex++;
  }

  setClauses.push('updated_at = NOW()');
  params.push(id);

  const updateResult = await query(
    `UPDATE scheduled_rides
     SET ${setClauses.join(', ')}
     WHERE id = $${paramIndex}
     RETURNING
       id, passenger_id, status,
       ST_Y(pickup_location::geometry)  AS pickup_lat,
       ST_X(pickup_location::geometry)  AS pickup_lng,
       pickup_address,
       ST_Y(dropoff_location::geometry) AS dropoff_lat,
       ST_X(dropoff_location::geometry) AS dropoff_lng,
       dropoff_address,
       vehicle_type, scheduled_time, estimated_fare,
       notes, accessibility_needed, ride_id,
       recurring, recurrence_pattern,
       created_at, updated_at`,
    params
  );

  return formatScheduledRide(updateResult.rows[0]);
}

// ---------------------------------------------------------------------------
// cancelScheduledRide
// ---------------------------------------------------------------------------

/**
 * Cancel a scheduled ride.
 *
 * @param {string} id          - Scheduled ride UUID
 * @param {string} passengerId - Requesting user's UUID
 * @returns {Promise<Object>}  The cancelled ride
 */
export async function cancelScheduledRide(id, passengerId) {
  const existing = await query(
    `SELECT id, passenger_id, status FROM scheduled_rides WHERE id = $1`,
    [id]
  );

  if (existing.rows.length === 0) {
    throw Object.assign(new Error('Scheduled ride not found'), { statusCode: 404 });
  }

  const ride = existing.rows[0];

  if (ride.passenger_id !== passengerId) {
    throw Object.assign(
      new Error('You are not authorized to cancel this scheduled ride'),
      { statusCode: 403 }
    );
  }

  if (ride.status === 'cancelled' || ride.status === 'expired') {
    throw Object.assign(
      new Error(`This scheduled ride is already '${ride.status}'`),
      { statusCode: 409 }
    );
  }

  if (ride.status === 'matched') {
    throw Object.assign(
      new Error('This scheduled ride has already been matched. Cancel the active ride instead.'),
      { statusCode: 409 }
    );
  }

  const result = await query(
    `UPDATE scheduled_rides
     SET status = 'cancelled', updated_at = NOW()
     WHERE id = $1
     RETURNING
       id, passenger_id, status,
       ST_Y(pickup_location::geometry)  AS pickup_lat,
       ST_X(pickup_location::geometry)  AS pickup_lng,
       pickup_address,
       ST_Y(dropoff_location::geometry) AS dropoff_lat,
       ST_X(dropoff_location::geometry) AS dropoff_lng,
       dropoff_address,
       vehicle_type, scheduled_time, estimated_fare,
       notes, accessibility_needed, ride_id,
       recurring, recurrence_pattern,
       created_at, updated_at`,
    [id]
  );

  return formatScheduledRide(result.rows[0]);
}

// ---------------------------------------------------------------------------
// dispatchScheduledRides
// ---------------------------------------------------------------------------

/**
 * Dispatch all scheduled rides that are due.
 *
 * Called periodically by the scheduler. Finds rides whose scheduled_time is
 * within the reminder window, transitions them to 'dispatching', and creates
 * actual ride requests through the matching system.
 *
 * @returns {Promise<number>} Number of rides dispatched
 */
export async function dispatchScheduledRides() {
  const reminderMinutes =
    (await getConfig('scheduled_ride_reminder_minutes')) || DEFAULT_REMINDER_MINUTES;

  const dueRides = await query(
    `SELECT id, passenger_id, vehicle_type, estimated_fare,
            ST_Y(pickup_location::geometry)  AS pickup_lat,
            ST_X(pickup_location::geometry)  AS pickup_lng,
            pickup_address,
            ST_Y(dropoff_location::geometry) AS dropoff_lat,
            ST_X(dropoff_location::geometry) AS dropoff_lng,
            dropoff_address,
            scheduled_time, accessibility_needed
     FROM scheduled_rides
     WHERE status IN ('scheduled', 'reminder_sent')
       AND scheduled_time <= NOW() + ($1 || ' minutes')::INTERVAL
     ORDER BY scheduled_time ASC
     FOR UPDATE SKIP LOCKED`,
    [reminderMinutes]
  );

  let dispatched = 0;

  for (const sr of dueRides.rows) {
    try {
      await dispatchScheduledRide(sr.id);
      dispatched++;
    } catch (err) {
      console.error(
        `[scheduling] Failed to dispatch scheduled ride ${sr.id}:`,
        err.message
      );
    }
  }

  return dispatched;
}

// ---------------------------------------------------------------------------
// dispatchScheduledRide
// ---------------------------------------------------------------------------

/**
 * Convert a single scheduled ride into an actual ride and trigger driver
 * matching.
 *
 * @param {string} scheduledRideId - UUID of the scheduled_ride row
 * @returns {Promise<Object|null>} The created ride, or null on failure
 */
export async function dispatchScheduledRide(scheduledRideId) {
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
       requested_at
     )
     VALUES (
       $1, 'requested',
       ST_MakePoint($2, $3)::geography, $4,
       ST_MakePoint($5, $6)::geography, $7,
       $8,
       $9, $10, $11,
       $12,
       NOW()
     )
     RETURNING id, passenger_id, status, estimated_fare, requested_at`,
    [
      sr.passenger_id,
      sr.pickup_lng, sr.pickup_lat, sr.pickup_address,
      sr.dropoff_lng, sr.dropoff_lat, sr.dropoff_address,
      sr.vehicle_type,
      fareEstimate.fare,
      fareEstimate.estimatedDistance || 0,
      fareEstimate.estimatedDuration || 0,
      fareEstimate.surgeMultiplier || 1.0,
    ]
  );

  const ride = rideResult.rows[0];

  // Link the ride back to the scheduled_rides row
  await query(
    `UPDATE scheduled_rides SET ride_id = $1, updated_at = NOW() WHERE id = $2`,
    [ride.id, scheduledRideId]
  );

  // Notify the passenger
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
      const minutesUntil = Math.round(
        (new Date(sr.scheduled_time).getTime() - Date.now()) / 60_000
      );

      await notifyUser(sr.passenger_id, 'scheduled_ride:reminder', {
        scheduledRideId: sr.id,
        scheduledTime: sr.scheduled_time,
        pickupAddress: sr.pickup_address,
        dropoffAddress: sr.dropoff_address,
        vehicleType: sr.vehicle_type,
        minutesUntil,
        message: `Your scheduled ride to ${sr.dropoff_address} is coming up in approximately ${minutesUntil} minutes.`,
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
// expireOldScheduledRides
// ---------------------------------------------------------------------------

/**
 * Mark scheduled rides whose scheduled_time has passed (and were never
 * dispatched or matched) as 'expired'.
 *
 * @returns {Promise<number>} Number of rides expired
 */
export async function expireOldScheduledRides() {
  const result = await query(
    `UPDATE scheduled_rides
     SET status = 'expired', updated_at = NOW()
     WHERE status IN ('scheduled', 'reminder_sent')
       AND scheduled_time < NOW() - INTERVAL '15 minutes'
     RETURNING id, passenger_id`
  );

  for (const sr of result.rows) {
    try {
      await notifyUser(sr.passenger_id, 'scheduled_ride:expired', {
        scheduledRideId: sr.id,
        message: 'Your scheduled ride has expired because no driver was available. Please schedule a new ride.',
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
            notes, accessibility_needed, ride_id,
            recurring, recurrence_pattern,
            created_at, updated_at
     FROM scheduled_rides
     WHERE passenger_id = $1
       AND status IN ('scheduled', 'reminder_sent', 'dispatching')
       AND scheduled_time <= NOW() + INTERVAL '24 hours'
       AND scheduled_time > NOW()
     ORDER BY scheduled_time ASC`,
    [userId]
  );

  return result.rows.map(formatScheduledRide);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Transform a database row into the API response shape.
 *
 * @param {Object} row - Database row
 * @returns {Object}
 */
function formatScheduledRide(row) {
  return {
    id: row.id,
    passengerId: row.passenger_id,
    status: row.status,
    pickupLat: row.pickup_lat,
    pickupLng: row.pickup_lng,
    pickupAddress: row.pickup_address,
    dropoffLat: row.dropoff_lat,
    dropoffLng: row.dropoff_lng,
    dropoffAddress: row.dropoff_address,
    vehicleType: row.vehicle_type,
    scheduledTime: row.scheduled_time,
    estimatedFare: row.estimated_fare,
    notes: row.notes,
    accessibilityNeeded: row.accessibility_needed,
    rideId: row.ride_id || null,
    recurring: row.recurring || false,
    recurrencePattern: row.recurrence_pattern || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
