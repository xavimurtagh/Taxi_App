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
// findMatchingRides
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
 * @param {number} [maxDetour=25]   - Maximum acceptable detour percentage
 * @returns {Promise<Array>} Matching shared rides
 */
export async function findMatchingRides(
  pickupLat,
  pickupLng,
  dropoffLat,
  dropoffLng,
  maxDetour
) {
  const maxDetourPercent =
    maxDetour || (await getConfig('pool_ride_max_detour_percent')) || DEFAULT_MAX_DETOUR_PERCENT;

  // Calculate a search radius based on the straight-line distance between the
  // requested pickup and dropoff, scaled by the detour percentage.
  // At minimum, search within 3 km to handle short trips.
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
       -- Distance from the shared ride origin to the requested pickup
       ST_Distance(sr.route_origin, r.pickup)   AS pickup_distance,
       -- Distance from the shared ride destination to the requested dropoff
       ST_Distance(sr.route_destination, r.dropoff) AS dropoff_distance,
       r.trip_distance
     FROM shared_rides sr, request r
     WHERE sr.status = 'open'
       AND sr.current_passengers < sr.max_passengers
       -- Pickup must be within detour% of the trip distance (min 3 km)
       AND ST_DWithin(
             sr.route_origin,
             r.pickup,
             GREATEST(r.trip_distance * $5 / 100.0, 3000)
           )
       -- Dropoff must be within detour% of the trip distance (min 3 km)
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
    'pool'
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
       is_shared, shared_ride_id,
       requested_at
     )
     VALUES (
       $1, 'requested',
       ST_MakePoint($2, $3)::geography, $4,
       ST_MakePoint($5, $6)::geography, $7,
       'pool',
       $8, $9, $10,
       $11,
       TRUE, $12,
       NOW()
     )
     RETURNING id, passenger_id, status, estimated_fare, requested_at`,
    [
      passengerId,
      pickup.lng, pickup.lat, pickup.address,
      dropoff.lng, dropoff.lat, dropoff.address,
      discountedFare,
      fareEstimate.estimatedDistance,
      fareEstimate.estimatedDuration,
      fareEstimate.surgeMultiplier,
      sharedRideId,
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
               pickup_order, dropoff_order, fare_share, status, joined_at`,
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

  return {
    participant: participantResult.rows[0],
    ride,
    discountedFare,
    originalFare: fareEstimate.fare,
    discountPercent,
  };
}

// ---------------------------------------------------------------------------
// calculateFareSplit
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
export async function calculateFareSplit(sharedRideId) {
  // Get all active participants with their ride data
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

  // Calculate total distance across all participants
  const totalDistance = participants.reduce(
    (sum, p) => sum + parseFloat(p.participant_distance || 0),
    0
  );

  // Calculate each participant's proportional share
  const splits = participants.map((p) => {
    const distance = parseFloat(p.participant_distance || 0);
    const proportion = totalDistance > 0 ? distance / totalDistance : 1 / participants.length;

    // Use actual fare if completed, otherwise estimated
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
 * Uses a simple nearest-neighbour heuristic: starting from the route origin,
 * greedily pick up the nearest passenger first, then after all pickups
 * determine the dropoff order similarly.
 *
 * @param {string} sharedRideId - UUID of the shared ride
 * @returns {Promise<Object>} Optimised order of pickups and dropoffs
 */
export async function optimizeRoute(sharedRideId) {
  // Get the shared ride origin
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

  const sr = srResult.rows[0];

  // Get active participants with their locations
  const participantsResult = await query(
    `SELECT
       srp.id AS participant_id,
       srp.passenger_id,
       srp.ride_id,
       ST_Y(srp.pickup_location::geometry)  AS pickup_lat,
       ST_X(srp.pickup_location::geometry)  AS pickup_lng,
       ST_Y(srp.dropoff_location::geometry) AS dropoff_lat,
       ST_X(srp.dropoff_location::geometry) AS dropoff_lng,
       -- Distance from route origin to pickup
       ST_Distance(
         sr.route_origin,
         srp.pickup_location
       ) AS pickup_dist_from_origin,
       -- Distance from route destination to dropoff
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

  // Nearest-neighbour ordering for pickups (sorted by distance from origin)
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

  // Nearest-neighbour ordering for dropoffs (sorted by distance from destination, reversed)
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
      `UPDATE shared_ride_participants
       SET pickup_order = $1
       WHERE id = $2`,
      [po.order, po.participantId]
    );
  }

  for (const dro of dropoffOrder) {
    await query(
      `UPDATE shared_ride_participants
       SET dropoff_order = $1
       WHERE id = $2`,
      [dro.order, dro.participantId]
    );
  }

  return {
    sharedRideId,
    pickupOrder,
    dropoffOrder,
  };
}
