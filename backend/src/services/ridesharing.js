import { query } from '../config/database.js';
import { getIO } from '../sockets/index.js';
import { estimateFare } from './pricing.js';
import { getConfig } from './platformConfig.js';
import { notifyUser } from './notifications.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_MAX_DETOUR_PERCENT = 25;
const DEFAULT_POOL_DISCOUNT_PERCENT = 30;

// ---------------------------------------------------------------------------
// findMatchingSharedRides
// ---------------------------------------------------------------------------

/**
 * Find open shared rides whose route is compatible with the requested
 * pickup and dropoff locations.
 *
 * Uses PostGIS ST_DWithin to compare the requested pickup/dropoff against
 * the shared ride's origin and destination. A "compatible" shared ride is
 * one where both the pickup and dropoff are within a configurable detour
 * percentage of the shared ride's route distance.
 *
 * @param {number} pickupLat        - Passenger's pickup latitude
 * @param {number} pickupLng        - Passenger's pickup longitude
 * @param {number} dropoffLat       - Passenger's dropoff latitude
 * @param {number} dropoffLng       - Passenger's dropoff longitude
 * @param {number} [maxDetour]      - Maximum acceptable detour percentage
 * @returns {Promise<Array>} Matching shared rides
 */
export async function findMatchingSharedRides(
  pickupLat,
  pickupLng,
  dropoffLat,
  dropoffLng,
  maxDetour
) {
  const maxDetourPercent =
    maxDetour || (await getConfig('pool_ride_max_detour_percent')) || DEFAULT_MAX_DETOUR_PERCENT;

  const result = await query(
    `WITH request AS (
       SELECT
         ST_MakePoint($1, $2)::geography AS pickup,
         ST_MakePoint($3, $4)::geography AS dropoff,
         ST_Distance(
           ST_MakePoint($1, $2)::geography,
           ST_MakePoint($3, $4)::geography
         ) AS trip_distance
     )
     SELECT
       sr.id,
       sr.driver_id,
       sr.status,
       sr.max_passengers,
       sr.current_passengers,
       sr.vehicle_type,
       ST_Y(sr.route_origin::geometry)      AS origin_lat,
       ST_X(sr.route_origin::geometry)      AS origin_lng,
       ST_Y(sr.route_destination::geometry) AS dest_lat,
       ST_X(sr.route_destination::geometry) AS dest_lng,
       sr.created_at,
       ST_Distance(sr.route_origin, r.pickup)       AS pickup_distance,
       ST_Distance(sr.route_destination, r.dropoff)  AS dropoff_distance,
       r.trip_distance
     FROM shared_rides sr, request r
     WHERE sr.status = 'open'
       AND sr.current_passengers < sr.max_passengers
       AND ST_DWithin(
             sr.route_origin,
             r.pickup,
             GREATEST(r.trip_distance * $5 / 100.0, 3000)
           )
       AND ST_DWithin(
             sr.route_destination,
             r.dropoff,
             GREATEST(r.trip_distance * $5 / 100.0, 3000)
           )
     ORDER BY (
       ST_Distance(sr.route_origin, r.pickup) +
       ST_Distance(sr.route_destination, r.dropoff)
     ) ASC
     LIMIT 20`,
    [pickupLng, pickupLat, dropoffLng, dropoffLat, maxDetourPercent]
  );

  return result.rows.map((row) => ({
    id: row.id,
    driverId: row.driver_id,
    status: row.status,
    maxPassengers: row.max_passengers,
    currentPassengers: row.current_passengers,
    vehicleType: row.vehicle_type,
    originLat: row.origin_lat,
    originLng: row.origin_lng,
    destLat: row.dest_lat,
    destLng: row.dest_lng,
    pickupDistance: Math.round(row.pickup_distance),
    dropoffDistance: Math.round(row.dropoff_distance),
    createdAt: row.created_at,
  }));
}

// ---------------------------------------------------------------------------
// createSharedRide
// ---------------------------------------------------------------------------

/**
 * Create a new shared ride offered by a driver.
 *
 * @param {string} driverId    - Driver's user UUID
 * @param {Object} routeData
 * @param {number} routeData.originLat
 * @param {number} routeData.originLng
 * @param {number} routeData.destLat
 * @param {number} routeData.destLng
 * @param {string} [routeData.vehicleType='economy']
 * @param {number} [routeData.maxPassengers=3]
 * @param {Object} [routeData.routeGeometry] - JSONB route geometry
 * @returns {Promise<Object>} The created shared ride
 */
export async function createSharedRide(driverId, routeData) {
  const {
    originLat,
    originLng,
    destLat,
    destLng,
    vehicleType = 'economy',
    maxPassengers = 3,
    routeGeometry = null,
  } = routeData;

  // Verify the driver doesn't already have an active shared ride
  const existingResult = await query(
    `SELECT id FROM shared_rides
     WHERE driver_id = $1
       AND status IN ('open', 'full', 'in_progress')
     LIMIT 1`,
    [driverId]
  );

  if (existingResult.rows.length > 0) {
    throw Object.assign(
      new Error('You already have an active shared ride'),
      { statusCode: 409 }
    );
  }

  const result = await query(
    `INSERT INTO shared_rides (
       driver_id, status,
       route_origin, route_destination,
       route_geometry,
       max_passengers, current_passengers,
       vehicle_type
     )
     VALUES (
       $1, 'open',
       ST_MakePoint($2, $3)::geography,
       ST_MakePoint($4, $5)::geography,
       $6,
       $7, 0,
       $8
     )
     RETURNING
       id, driver_id, status,
       ST_Y(route_origin::geometry)      AS origin_lat,
       ST_X(route_origin::geometry)      AS origin_lng,
       ST_Y(route_destination::geometry) AS dest_lat,
       ST_X(route_destination::geometry) AS dest_lng,
       route_geometry,
       max_passengers, current_passengers, vehicle_type,
       created_at`,
    [
      driverId,
      originLng, originLat,
      destLng, destLat,
      routeGeometry ? JSON.stringify(routeGeometry) : null,
      maxPassengers,
      vehicleType,
    ]
  );

  return formatSharedRide(result.rows[0]);
}

// ---------------------------------------------------------------------------
// getSharedRideById
// ---------------------------------------------------------------------------

/**
 * Get a shared ride by ID with its participants.
 *
 * @param {string} sharedRideId - UUID of the shared ride
 * @returns {Promise<Object>} Shared ride with participants
 */
export async function getSharedRideById(sharedRideId) {
  const srResult = await query(
    `SELECT
       sr.id, sr.driver_id, sr.status,
       ST_Y(sr.route_origin::geometry)      AS origin_lat,
       ST_X(sr.route_origin::geometry)      AS origin_lng,
       ST_Y(sr.route_destination::geometry) AS dest_lat,
       ST_X(sr.route_destination::geometry) AS dest_lng,
       sr.route_geometry,
       sr.max_passengers, sr.current_passengers, sr.vehicle_type,
       sr.created_at, sr.updated_at,
       u.first_name AS driver_first_name,
       u.last_name AS driver_last_name,
       dp.vehicle_make, dp.vehicle_model, dp.vehicle_color, dp.vehicle_plate,
       dp.rating AS driver_rating
     FROM shared_rides sr
     LEFT JOIN users u ON u.id = sr.driver_id
     LEFT JOIN driver_profiles dp ON dp.user_id = sr.driver_id
     WHERE sr.id = $1`,
    [sharedRideId]
  );

  if (srResult.rows.length === 0) {
    throw Object.assign(new Error('Shared ride not found'), { statusCode: 404 });
  }

  const row = srResult.rows[0];

  // Get participants
  const participantsResult = await query(
    `SELECT
       srp.id AS participant_id,
       srp.passenger_id,
       srp.ride_id,
       srp.pickup_order,
       srp.dropoff_order,
       srp.fare_share,
       srp.status,
       ST_Y(srp.pickup_location::geometry)  AS pickup_lat,
       ST_X(srp.pickup_location::geometry)  AS pickup_lng,
       ST_Y(srp.dropoff_location::geometry) AS dropoff_lat,
       ST_X(srp.dropoff_location::geometry) AS dropoff_lng,
       u.first_name, u.last_name
     FROM shared_ride_participants srp
     JOIN users u ON u.id = srp.passenger_id
     WHERE srp.shared_ride_id = $1
       AND srp.status != 'cancelled'
     ORDER BY srp.pickup_order ASC`,
    [sharedRideId]
  );

  const sharedRide = formatSharedRide(row);

  sharedRide.driver = row.driver_id
    ? {
        id: row.driver_id,
        firstName: row.driver_first_name,
        lastName: row.driver_last_name,
        vehicleMake: row.vehicle_make,
        vehicleModel: row.vehicle_model,
        vehicleColor: row.vehicle_color,
        vehiclePlate: row.vehicle_plate,
        rating: row.driver_rating,
      }
    : null;

  sharedRide.participants = participantsResult.rows.map((p) => ({
    participantId: p.participant_id,
    passengerId: p.passenger_id,
    rideId: p.ride_id,
    firstName: p.first_name,
    lastName: p.last_name,
    pickupLat: p.pickup_lat,
    pickupLng: p.pickup_lng,
    dropoffLat: p.dropoff_lat,
    dropoffLng: p.dropoff_lng,
    pickupOrder: p.pickup_order,
    dropoffOrder: p.dropoff_order,
    fareShare: p.fare_share,
    status: p.status,
  }));

  return sharedRide;
}

// ---------------------------------------------------------------------------
// joinSharedRide
// ---------------------------------------------------------------------------

/**
 * Add a passenger to an existing shared ride.
 *
 * Creates a ride record for the new passenger, links it to the shared ride,
 * and increments the participant count.
 *
 * @param {string} sharedRideId - UUID of the shared ride
 * @param {string} passengerId  - UUID of the joining passenger
 * @param {Object} pickup       - { lat, lng, address }
 * @param {Object} dropoff      - { lat, lng, address }
 * @returns {Promise<Object>} The participant record and associated ride
 */
export async function joinSharedRide(sharedRideId, passengerId, pickup, dropoff) {
  // Verify the shared ride exists and has capacity
  const srResult = await query(
    `SELECT id, driver_id, status, max_passengers, current_passengers, vehicle_type,
            ST_Y(route_origin::geometry)      AS origin_lat,
            ST_X(route_origin::geometry)      AS origin_lng,
            ST_Y(route_destination::geometry) AS dest_lat,
            ST_X(route_destination::geometry) AS dest_lng
     FROM shared_rides
     WHERE id = $1`,
    [sharedRideId]
  );

  if (srResult.rows.length === 0) {
    throw Object.assign(new Error('Shared ride not found'), { statusCode: 404 });
  }

  const sr = srResult.rows[0];

  if (sr.status !== 'open') {
    throw Object.assign(
      new Error(`Cannot join a shared ride with status '${sr.status}'`),
      { statusCode: 409 }
    );
  }

  if (sr.current_passengers >= sr.max_passengers) {
    throw Object.assign(new Error('This shared ride is already full'), { statusCode: 409 });
  }

  // Check the passenger is not already in this shared ride
  const existingParticipant = await query(
    `SELECT id FROM shared_ride_participants
     WHERE shared_ride_id = $1 AND passenger_id = $2 AND status != 'cancelled'`,
    [sharedRideId, passengerId]
  );

  if (existingParticipant.rows.length > 0) {
    throw Object.assign(
      new Error('You have already joined this shared ride'),
      { statusCode: 409 }
    );
  }

  // Get fare estimate with pool discount
  const fareEstimate = await estimateFare(
    pickup.lat,
    pickup.lng,
    dropoff.lat,
    dropoff.lng,
    sr.vehicle_type
  );

  const discountPercent =
    (await getConfig('pool_ride_discount_percent')) || DEFAULT_POOL_DISCOUNT_PERCENT;
  const discountedFare = Math.round(fareEstimate.fare * (1 - discountPercent / 100) * 100) / 100;

  // Create the ride record
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
      passengerId,
      pickup.lng, pickup.lat, pickup.address,
      dropoff.lng, dropoff.lat, dropoff.address,
      sr.vehicle_type,
      discountedFare,
      fareEstimate.estimatedDistance,
      fareEstimate.estimatedDuration,
      fareEstimate.surgeMultiplier,
    ]
  );

  const ride = rideResult.rows[0];

  // Determine pickup/dropoff order (next available slot)
  const orderResult = await query(
    `SELECT COALESCE(MAX(pickup_order), 0) + 1 AS next_order
     FROM shared_ride_participants
     WHERE shared_ride_id = $1 AND status != 'cancelled'`,
    [sharedRideId]
  );

  const nextOrder = orderResult.rows[0].next_order;

  // Create the participant record
  const participantResult = await query(
    `INSERT INTO shared_ride_participants (
       shared_ride_id, ride_id, passenger_id,
       pickup_location, dropoff_location,
       pickup_order, dropoff_order,
       fare_share, status
     )
     VALUES (
       $1, $2, $3,
       ST_MakePoint($4, $5)::geography,
       ST_MakePoint($6, $7)::geography,
       $8, $9,
       $10, 'confirmed'
     )
     RETURNING id, shared_ride_id, ride_id, passenger_id,
               pickup_order, dropoff_order, fare_share, status`,
    [
      sharedRideId, ride.id, passengerId,
      pickup.lng, pickup.lat,
      dropoff.lng, dropoff.lat,
      nextOrder, nextOrder,
      discountedFare,
    ]
  );

  // Increment the passenger count and mark as full if needed
  const newCount = sr.current_passengers + 1;
  const newStatus = newCount >= sr.max_passengers ? 'full' : 'open';

  await query(
    `UPDATE shared_rides
     SET current_passengers = $1, status = $2, updated_at = NOW()
     WHERE id = $3`,
    [newCount, newStatus, sharedRideId]
  );

  // If a driver is assigned, set the ride as matched
  if (sr.driver_id) {
    await query(
      `UPDATE rides SET driver_id = $1, status = 'matched', matched_at = NOW(), updated_at = NOW()
       WHERE id = $2`,
      [sr.driver_id, ride.id]
    );
  }

  // Notify the driver and other participants
  const io = getIO();
  if (io && sr.driver_id) {
    io.to(`user:${sr.driver_id}`).emit('shared_ride:passenger_joined', {
      sharedRideId,
      passengerId,
      rideId: ride.id,
      currentPassengers: newCount,
    });
  }

  // Optimise the route now that a new passenger has joined
  try {
    await optimizeRoute(sharedRideId);
  } catch (err) {
    console.error('[ridesharing] Route optimisation failed:', err.message);
  }

  return {
    participant: participantResult.rows[0],
    ride,
    discountedFare,
    originalFare: fareEstimate.fare,
    discountPercent,
  };
}

// ---------------------------------------------------------------------------
// leaveSharedRide
// ---------------------------------------------------------------------------

/**
 * Remove a passenger from a shared ride.
 *
 * Cancels their participant record, updates counts, and recalculates the
 * route and fare splits.
 *
 * @param {string} sharedRideId - UUID of the shared ride
 * @param {string} passengerId  - UUID of the passenger leaving
 * @returns {Promise<Object>} Confirmation with updated ride info
 */
export async function leaveSharedRide(sharedRideId, passengerId) {
  // Verify the shared ride exists
  const srResult = await query(
    `SELECT id, driver_id, status, current_passengers, max_passengers
     FROM shared_rides
     WHERE id = $1`,
    [sharedRideId]
  );

  if (srResult.rows.length === 0) {
    throw Object.assign(new Error('Shared ride not found'), { statusCode: 404 });
  }

  const sr = srResult.rows[0];

  if (sr.status === 'completed' || sr.status === 'cancelled') {
    throw Object.assign(
      new Error(`Cannot leave a shared ride with status '${sr.status}'`),
      { statusCode: 409 }
    );
  }

  // Find the participant record
  const participantResult = await query(
    `SELECT id, ride_id, status
     FROM shared_ride_participants
     WHERE shared_ride_id = $1
       AND passenger_id = $2
       AND status NOT IN ('cancelled', 'dropped_off')`,
    [sharedRideId, passengerId]
  );

  if (participantResult.rows.length === 0) {
    throw Object.assign(
      new Error('You are not an active participant in this shared ride'),
      { statusCode: 404 }
    );
  }

  const participant = participantResult.rows[0];

  // Cancel the participant record
  await query(
    `UPDATE shared_ride_participants
     SET status = 'cancelled', updated_at = NOW()
     WHERE id = $1`,
    [participant.id]
  );

  // Cancel the associated ride record
  if (participant.ride_id) {
    await query(
      `UPDATE rides
       SET status = 'cancelled',
           cancelled_at = NOW(),
           cancelled_by = 'passenger',
           cancellation_reason = 'Left shared ride',
           updated_at = NOW()
       WHERE id = $1
         AND status NOT IN ('completed', 'cancelled')`,
      [participant.ride_id]
    );
  }

  // Decrement the passenger count and re-open if was full
  const newCount = Math.max(0, sr.current_passengers - 1);
  let newStatus = sr.status;

  if (sr.status === 'full' && newCount < sr.max_passengers) {
    newStatus = 'open';
  }

  // If no passengers left, revert to open
  if (newCount === 0 && sr.status === 'in_progress') {
    newStatus = 'open';
  }

  await query(
    `UPDATE shared_rides
     SET current_passengers = $1, status = $2, updated_at = NOW()
     WHERE id = $3`,
    [newCount, newStatus, sharedRideId]
  );

  // Notify the driver
  const io = getIO();
  if (io && sr.driver_id) {
    io.to(`user:${sr.driver_id}`).emit('shared_ride:passenger_left', {
      sharedRideId,
      passengerId,
      currentPassengers: newCount,
    });
  }

  // Re-optimise the route
  if (newCount > 0) {
    try {
      await optimizeRoute(sharedRideId);
    } catch (err) {
      console.error('[ridesharing] Route re-optimisation failed:', err.message);
    }
  }

  return {
    sharedRideId,
    passengerId,
    currentPassengers: newCount,
    status: newStatus,
  };
}

// ---------------------------------------------------------------------------
// requestSharedRide
// ---------------------------------------------------------------------------

/**
 * Request a shared ride. Searches for existing compatible shared rides
 * first; if a match is found the passenger joins that ride, otherwise
 * a new shared ride request is queued for a driver to pick up.
 *
 * @param {string} passengerId
 * @param {Object} data
 * @param {number} data.pickupLat
 * @param {number} data.pickupLng
 * @param {string} data.pickupAddress
 * @param {number} data.dropoffLat
 * @param {number} data.dropoffLng
 * @param {string} data.dropoffAddress
 * @param {string} [data.vehicleType='economy']
 * @returns {Promise<Object>} Either a joined shared ride or a new pending one
 */
export async function requestSharedRide(passengerId, data) {
  const {
    pickupLat,
    pickupLng,
    pickupAddress,
    dropoffLat,
    dropoffLng,
    dropoffAddress,
    vehicleType = 'economy',
  } = data;

  // Check if passenger already has an active ride
  const activeRide = await query(
    `SELECT id FROM rides
     WHERE passenger_id = $1
       AND status NOT IN ('completed', 'cancelled')
     LIMIT 1`,
    [passengerId]
  );

  if (activeRide.rows.length > 0) {
    throw Object.assign(
      new Error('You already have an active ride. Complete or cancel it first.'),
      { statusCode: 409 }
    );
  }

  // Try to find a matching shared ride
  const matches = await findMatchingSharedRides(
    pickupLat,
    pickupLng,
    dropoffLat,
    dropoffLng
  );

  // Filter for matching vehicle type if possible
  const vehicleMatches = matches.filter((m) => m.vehicleType === vehicleType);
  const bestMatches = vehicleMatches.length > 0 ? vehicleMatches : matches;

  if (bestMatches.length > 0) {
    // Join the best matching shared ride
    const bestMatch = bestMatches[0];

    const joinResult = await joinSharedRide(
      bestMatch.id,
      passengerId,
      { lat: pickupLat, lng: pickupLng, address: pickupAddress },
      { lat: dropoffLat, lng: dropoffLng, address: dropoffAddress }
    );

    return {
      matched: true,
      sharedRideId: bestMatch.id,
      ...joinResult,
    };
  }

  // No match found — create a ride record and wait for a driver or another
  // compatible passenger
  const fareEstimate = await estimateFare(
    pickupLat,
    pickupLng,
    dropoffLat,
    dropoffLng,
    vehicleType
  );

  const discountPercent =
    (await getConfig('pool_ride_discount_percent')) || DEFAULT_POOL_DISCOUNT_PERCENT;
  const discountedFare = Math.round(fareEstimate.fare * (1 - discountPercent / 100) * 100) / 100;

  // Create an unmatched shared ride (no driver yet)
  const srResult = await query(
    `INSERT INTO shared_rides (
       driver_id, status,
       route_origin, route_destination,
       max_passengers, current_passengers,
       vehicle_type
     )
     VALUES (
       NULL, 'open',
       ST_MakePoint($1, $2)::geography,
       ST_MakePoint($3, $4)::geography,
       3, 1,
       $5
     )
     RETURNING
       id, status,
       ST_Y(route_origin::geometry)      AS origin_lat,
       ST_X(route_origin::geometry)      AS origin_lng,
       ST_Y(route_destination::geometry) AS dest_lat,
       ST_X(route_destination::geometry) AS dest_lng,
       max_passengers, current_passengers, vehicle_type,
       created_at`,
    [pickupLng, pickupLat, dropoffLng, dropoffLat, vehicleType]
  );

  const sharedRide = srResult.rows[0];

  // Create the ride record for this passenger
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
      passengerId,
      pickupLng, pickupLat, pickupAddress,
      dropoffLng, dropoffLat, dropoffAddress,
      vehicleType,
      discountedFare,
      fareEstimate.estimatedDistance,
      fareEstimate.estimatedDuration,
      fareEstimate.surgeMultiplier,
    ]
  );

  const ride = rideResult.rows[0];

  // Create participant record
  await query(
    `INSERT INTO shared_ride_participants (
       shared_ride_id, ride_id, passenger_id,
       pickup_location, dropoff_location,
       pickup_order, dropoff_order,
       fare_share, status
     )
     VALUES (
       $1, $2, $3,
       ST_MakePoint($4, $5)::geography,
       ST_MakePoint($6, $7)::geography,
       1, 1,
       $8, 'confirmed'
     )`,
    [
      sharedRide.id, ride.id, passengerId,
      pickupLng, pickupLat,
      dropoffLng, dropoffLat,
      discountedFare,
    ]
  );

  return {
    matched: false,
    sharedRideId: sharedRide.id,
    ride,
    discountedFare,
    originalFare: fareEstimate.fare,
    discountPercent,
    fareEstimate: {
      fare: fareEstimate.fare,
      estimatedDistance: fareEstimate.estimatedDistance,
      estimatedDuration: fareEstimate.estimatedDuration,
      surgeMultiplier: fareEstimate.surgeMultiplier,
      breakdown: fareEstimate.breakdown,
    },
  };
}

// ---------------------------------------------------------------------------
// getAvailableSharedRides
// ---------------------------------------------------------------------------

/**
 * List available shared rides near a given route.
 *
 * @param {number} pickupLat
 * @param {number} pickupLng
 * @param {number} dropoffLat
 * @param {number} dropoffLng
 * @param {number} [radiusMetres=5000]
 * @returns {Promise<Array>} Available shared rides
 */
export async function getAvailableSharedRides(
  pickupLat,
  pickupLng,
  dropoffLat,
  dropoffLng,
  radiusMetres = 5000
) {
  const result = await query(
    `SELECT
       sr.id,
       sr.driver_id,
       sr.status,
       sr.max_passengers,
       sr.current_passengers,
       sr.vehicle_type,
       ST_Y(sr.route_origin::geometry)      AS origin_lat,
       ST_X(sr.route_origin::geometry)      AS origin_lng,
       ST_Y(sr.route_destination::geometry) AS dest_lat,
       ST_X(sr.route_destination::geometry) AS dest_lng,
       sr.created_at,
       ST_Distance(sr.route_origin, ST_MakePoint($1, $2)::geography)       AS pickup_distance,
       ST_Distance(sr.route_destination, ST_MakePoint($3, $4)::geography)   AS dropoff_distance
     FROM shared_rides sr
     WHERE sr.status = 'open'
       AND sr.current_passengers < sr.max_passengers
       AND ST_DWithin(
             sr.route_origin,
             ST_MakePoint($1, $2)::geography,
             $5
           )
     ORDER BY ST_Distance(sr.route_origin, ST_MakePoint($1, $2)::geography) ASC
     LIMIT 20`,
    [pickupLng, pickupLat, dropoffLng, dropoffLat, radiusMetres]
  );

  return result.rows.map((row) => ({
    id: row.id,
    driverId: row.driver_id,
    status: row.status,
    maxPassengers: row.max_passengers,
    currentPassengers: row.current_passengers,
    vehicleType: row.vehicle_type,
    originLat: row.origin_lat,
    originLng: row.origin_lng,
    destLat: row.dest_lat,
    destLng: row.dest_lng,
    pickupDistance: Math.round(row.pickup_distance),
    dropoffDistance: Math.round(row.dropoff_distance),
    createdAt: row.created_at,
  }));
}

// ---------------------------------------------------------------------------
// getActiveSharedRide
// ---------------------------------------------------------------------------

/**
 * Get a user's active shared ride (as passenger or driver).
 *
 * @param {string} userId - User UUID
 * @returns {Promise<Object|null>} Active shared ride or null
 */
export async function getActiveSharedRide(userId) {
  // Check as passenger first
  const asPassenger = await query(
    `SELECT srp.shared_ride_id
     FROM shared_ride_participants srp
     WHERE srp.passenger_id = $1
       AND srp.status IN ('pending', 'confirmed', 'picked_up')
     ORDER BY srp.created_at DESC
     LIMIT 1`,
    [userId]
  );

  if (asPassenger.rows.length > 0) {
    return getSharedRideById(asPassenger.rows[0].shared_ride_id);
  }

  // Check as driver
  const asDriver = await query(
    `SELECT id FROM shared_rides
     WHERE driver_id = $1
       AND status IN ('open', 'full', 'in_progress')
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId]
  );

  if (asDriver.rows.length > 0) {
    return getSharedRideById(asDriver.rows[0].id);
  }

  return null;
}

// ---------------------------------------------------------------------------
// calculateFareShare
// ---------------------------------------------------------------------------

/**
 * Calculate the fare split for all active participants in a shared ride.
 *
 * The fare is split proportionally based on each participant's trip distance
 * relative to the total pooled distance, then a pool discount is applied.
 *
 * @param {string} sharedRideId - UUID of the shared ride
 * @returns {Promise<Object>} Fare split details for each participant
 */
export async function calculateFareShare(sharedRideId) {
  const participantsResult = await query(
    `SELECT
       srp.id AS participant_id,
       srp.passenger_id,
       srp.ride_id,
       srp.fare_share AS current_fare_share,
       srp.status,
       r.estimated_fare,
       r.estimated_distance,
       r.actual_fare,
       r.actual_distance,
       ST_Distance(srp.pickup_location, srp.dropoff_location) AS participant_distance
     FROM shared_ride_participants srp
     JOIN rides r ON r.id = srp.ride_id
     WHERE srp.shared_ride_id = $1
       AND srp.status NOT IN ('cancelled')
     ORDER BY srp.pickup_order ASC`,
    [sharedRideId]
  );

  if (participantsResult.rows.length === 0) {
    throw Object.assign(new Error('No active participants found'), { statusCode: 404 });
  }

  const participants = participantsResult.rows;
  const discountPercent =
    (await getConfig('pool_ride_discount_percent')) || DEFAULT_POOL_DISCOUNT_PERCENT;

  const totalDistance = participants.reduce(
    (sum, p) => sum + parseFloat(p.participant_distance || 0),
    0
  );

  const splits = participants.map((p) => {
    const distance = parseFloat(p.participant_distance || 0);
    const proportion = totalDistance > 0 ? distance / totalDistance : 1 / participants.length;

    const baseFare = parseFloat(p.actual_fare || p.estimated_fare || 0);
    const discountedFare = Math.round(baseFare * (1 - discountPercent / 100) * 100) / 100;

    return {
      participantId: p.participant_id,
      passengerId: p.passenger_id,
      rideId: p.ride_id,
      status: p.status,
      distanceMetres: Math.round(distance),
      proportion: Math.round(proportion * 10000) / 10000,
      originalFare: baseFare,
      fareShare: discountedFare,
      discount: Math.round((baseFare - discountedFare) * 100) / 100,
    };
  });

  // Update fare shares in the database
  for (const split of splits) {
    await query(
      `UPDATE shared_ride_participants SET fare_share = $1 WHERE id = $2`,
      [split.fareShare, split.participantId]
    );
  }

  const totalOriginalFare = splits.reduce((sum, s) => sum + s.originalFare, 0);
  const totalDiscountedFare = splits.reduce((sum, s) => sum + s.fareShare, 0);

  return {
    sharedRideId,
    participantCount: participants.length,
    discountPercent,
    totalOriginalFare: Math.round(totalOriginalFare * 100) / 100,
    totalDiscountedFare: Math.round(totalDiscountedFare * 100) / 100,
    totalSaved: Math.round((totalOriginalFare - totalDiscountedFare) * 100) / 100,
    splits,
  };
}

// ---------------------------------------------------------------------------
// optimizeRoute
// ---------------------------------------------------------------------------

/**
 * Calculate the optimal pickup and dropoff order for a shared ride based on
 * minimising total route distance.
 *
 * Uses a nearest-neighbour heuristic: starting from the route origin,
 * greedily pick up the nearest passenger first, then determine the dropoff
 * order similarly relative to the destination.
 *
 * @param {string} sharedRideId - UUID of the shared ride
 * @returns {Promise<Object>} Optimised order of pickups and dropoffs
 */
export async function optimizeRoute(sharedRideId) {
  const srResult = await query(
    `SELECT id,
            ST_Y(route_origin::geometry)      AS origin_lat,
            ST_X(route_origin::geometry)      AS origin_lng,
            ST_Y(route_destination::geometry) AS dest_lat,
            ST_X(route_destination::geometry) AS dest_lng
     FROM shared_rides
     WHERE id = $1`,
    [sharedRideId]
  );

  if (srResult.rows.length === 0) {
    throw Object.assign(new Error('Shared ride not found'), { statusCode: 404 });
  }

  const participantsResult = await query(
    `SELECT
       srp.id AS participant_id,
       srp.passenger_id,
       srp.ride_id,
       ST_Y(srp.pickup_location::geometry)  AS pickup_lat,
       ST_X(srp.pickup_location::geometry)  AS pickup_lng,
       ST_Y(srp.dropoff_location::geometry) AS dropoff_lat,
       ST_X(srp.dropoff_location::geometry) AS dropoff_lng,
       ST_Distance(
         sr.route_origin,
         srp.pickup_location
       ) AS pickup_dist_from_origin,
       ST_Distance(
         sr.route_destination,
         srp.dropoff_location
       ) AS dropoff_dist_from_dest
     FROM shared_ride_participants srp
     JOIN shared_rides sr ON sr.id = srp.shared_ride_id
     WHERE srp.shared_ride_id = $1
       AND srp.status NOT IN ('cancelled', 'dropped_off')
     ORDER BY srp.pickup_order ASC`,
    [sharedRideId]
  );

  const participants = participantsResult.rows;

  if (participants.length === 0) {
    return { sharedRideId, pickupOrder: [], dropoffOrder: [] };
  }

  // Nearest-neighbour ordering for pickups
  const pickupOrder = [...participants]
    .sort((a, b) => parseFloat(a.pickup_dist_from_origin) - parseFloat(b.pickup_dist_from_origin))
    .map((p, i) => ({
      participantId: p.participant_id,
      passengerId: p.passenger_id,
      order: i + 1,
      pickupLat: p.pickup_lat,
      pickupLng: p.pickup_lng,
      distanceFromOrigin: Math.round(parseFloat(p.pickup_dist_from_origin)),
    }));

  // Dropoff ordering: drop off the passenger closest to route destination last
  // (i.e., farthest from destination gets dropped off first)
  const dropoffOrder = [...participants]
    .sort((a, b) => parseFloat(b.dropoff_dist_from_dest) - parseFloat(a.dropoff_dist_from_dest))
    .map((p, i) => ({
      participantId: p.participant_id,
      passengerId: p.passenger_id,
      order: i + 1,
      dropoffLat: p.dropoff_lat,
      dropoffLng: p.dropoff_lng,
      distanceFromDest: Math.round(parseFloat(p.dropoff_dist_from_dest)),
    }));

  // Persist the optimised order
  for (const po of pickupOrder) {
    await query(
      `UPDATE shared_ride_participants SET pickup_order = $1 WHERE id = $2`,
      [po.order, po.participantId]
    );
  }

  for (const dro of dropoffOrder) {
    await query(
      `UPDATE shared_ride_participants SET dropoff_order = $1 WHERE id = $2`,
      [dro.order, dro.participantId]
    );
  }

  return {
    sharedRideId,
    pickupOrder,
    dropoffOrder,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Format a shared ride database row into the API response shape.
 *
 * @param {Object} row - Database row
 * @returns {Object}
 */
function formatSharedRide(row) {
  return {
    id: row.id,
    driverId: row.driver_id || null,
    status: row.status,
    originLat: row.origin_lat,
    originLng: row.origin_lng,
    destLat: row.dest_lat,
    destLng: row.dest_lng,
    routeGeometry: row.route_geometry || null,
    maxPassengers: row.max_passengers,
    currentPassengers: row.current_passengers,
    vehicleType: row.vehicle_type,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
