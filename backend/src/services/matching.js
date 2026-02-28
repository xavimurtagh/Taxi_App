import redis from '../config/redis.js';
import { query } from '../config/database.js';
import { getIO } from '../sockets/index.js';

/**
 * Redis key for the geospatial index of driver positions.
 */
const DRIVER_LOCATIONS_KEY = 'driver:locations';

/**
 * Redis key prefix for per-driver metadata hashes.
 */
const DRIVER_META_PREFIX = 'driver:meta:';

/**
 * Maximum number of drivers to attempt offering a ride to before giving up.
 */
const MAX_OFFER_ATTEMPTS = 5;

/**
 * TTL (in seconds) for a ride offer stored in Redis.
 */
const OFFER_TTL_SECONDS = 20;

/**
 * How long (in ms) to wait for a driver to respond to an offer before
 * moving on to the next candidate.
 */
const OFFER_WAIT_MS = 15_000;

/**
 * Polling interval (in ms) when waiting for a driver response.
 */
const POLL_INTERVAL_MS = 500;

// ---------------------------------------------------------------------------
// findNearbyDrivers
// ---------------------------------------------------------------------------

/**
 * Find drivers within a given radius of the pickup location using the
 * Redis geospatial index.
 *
 * Each result is enriched with metadata from the driver:meta:{id} hash.
 * Only online, verified drivers are returned; optionally filtered by
 * vehicle type.
 *
 * @param {number}  pickupLat    - Pickup latitude
 * @param {number}  pickupLng    - Pickup longitude
 * @param {number}  [radiusKm=5] - Search radius in kilometres
 * @param {string|null} [vehicleType=null] - Filter by vehicle type (or null for any)
 * @returns {Promise<Array<{
 *   driverId: string,
 *   distance: number,
 *   lat: number,
 *   lng: number,
 *   vehicleType: string,
 *   rating: number
 * }>>}
 */
export async function findNearbyDrivers(pickupLat, pickupLng, radiusKm = 5, vehicleType = null) {
  try {
    // GEORADIUS returns members with their distances and coordinates
    const results = await redis.georadius(
      DRIVER_LOCATIONS_KEY,
      pickupLng,
      pickupLat,
      radiusKm,
      'km',
      'WITHCOORD',
      'WITHDIST',
      'ASC' // closest first
    );

    if (!results || results.length === 0) {
      return [];
    }

    const drivers = [];

    for (const result of results) {
      // result format: [memberId, distance, [lng, lat]]
      const driverId = result[0];
      const distance = parseFloat(result[1]);
      const [lng, lat] = result[2].map(Number);

      // Get driver metadata from Redis
      const metaKey = `${DRIVER_META_PREFIX}${driverId}`;
      const meta = await redis.hgetall(metaKey);

      // Skip drivers with no metadata (stale geo entries)
      if (!meta || Object.keys(meta).length === 0) {
        continue;
      }

      // Parse metadata — supports both hash and JSON-string formats
      let driverMeta;
      if (meta.lat !== undefined) {
        // Hash format from geolocation.js
        driverMeta = meta;
      } else if (typeof meta === 'string') {
        try {
          driverMeta = JSON.parse(meta);
        } catch {
          continue;
        }
      } else {
        driverMeta = meta;
      }

      // Only include online, verified drivers
      const isOnline = driverMeta.status === 'online' || !driverMeta.status;
      const isVerified = driverMeta.isVerified !== 'false';

      if (!isOnline || !isVerified) {
        continue;
      }

      // If vehicleType is specified, filter by match
      if (vehicleType && driverMeta.vehicleType && driverMeta.vehicleType !== vehicleType) {
        continue;
      }

      drivers.push({
        driverId,
        distance,
        lat,
        lng,
        vehicleType: driverMeta.vehicleType || 'economy',
        rating: parseFloat(driverMeta.rating) || 4.0,
      });
    }

    return drivers;
  } catch (err) {
    console.error('[matching] Error finding nearby drivers:', err.message);
    return [];
  }
}

// ---------------------------------------------------------------------------
// scoreDrivers
// ---------------------------------------------------------------------------

/**
 * Score and rank drivers for ride assignment.
 *
 * Scoring weights:
 *   - proximity:       40% (closer = higher score)
 *   - rating:          20% (rating / 5.0)
 *   - waitTime:        25% (longer idle since last ride = higher priority)
 *   - completionRate:  15% (completed / total rides, default 0.5 for new drivers)
 *
 * @param {Array<{ driverId: string, distance: number, lat: number, lng: number, vehicleType: string, rating: number }>} drivers
 * @param {number} pickupLat
 * @param {number} pickupLng
 * @returns {Promise<Array<{ driverId: string, distance: number, lat: number, lng: number, vehicleType: string, rating: number, score: number }>>}
 */
export async function scoreDrivers(drivers, pickupLat, pickupLng) {
  if (!drivers || drivers.length === 0) {
    return [];
  }

  // Determine the maximum distance in the set for normalisation
  const maxDistance = Math.max(...drivers.map((d) => d.distance), 0.1);

  const scored = [];

  for (const driver of drivers) {
    // --- Proximity score (40%) ---
    // Closer drivers get a higher score. Normalise to [0, 1].
    const proximityScore = 1 - driver.distance / maxDistance;

    // --- Rating score (20%) ---
    const ratingScore = (driver.rating || 4.0) / 5.0;

    // --- Wait time score (25%) ---
    // Drivers who have been idle longer get higher priority.
    let waitTimeScore = 0.5; // default for unknown
    try {
      const metaKey = `${DRIVER_META_PREFIX}${driver.driverId}`;
      const lastRideAt = await redis.hget(metaKey, 'lastRideAt');

      if (lastRideAt) {
        const idleMs = Date.now() - new Date(lastRideAt).getTime();
        const idleMinutes = idleMs / 60_000;
        // Cap at 60 minutes for normalisation
        waitTimeScore = Math.min(idleMinutes / 60, 1.0);
      } else {
        // No last ride recorded — treat as moderately idle
        waitTimeScore = 0.5;
      }
    } catch {
      waitTimeScore = 0.5;
    }

    // --- Completion rate score (15%) ---
    let completionRateScore = 0.5; // default for new drivers
    try {
      const metaKey = `${DRIVER_META_PREFIX}${driver.driverId}`;
      const totalRides = parseInt(await redis.hget(metaKey, 'totalRides') || '0', 10);
      const completedRides = parseInt(await redis.hget(metaKey, 'completedRides') || '0', 10);

      if (totalRides > 0) {
        completionRateScore = completedRides / totalRides;
      }
    } catch {
      completionRateScore = 0.5;
    }

    // --- Weighted total ---
    const score =
      proximityScore * 0.40 +
      ratingScore * 0.20 +
      waitTimeScore * 0.25 +
      completionRateScore * 0.15;

    scored.push({
      ...driver,
      score: Math.round(score * 10000) / 10000,
    });
  }

  // Sort by score descending (highest first)
  scored.sort((a, b) => b.score - a.score);

  return scored;
}

// ---------------------------------------------------------------------------
// matchRide
// ---------------------------------------------------------------------------

/**
 * Attempt to match a ride with an available driver.
 *
 * Finds nearby drivers, scores them, then iterates through the top candidates
 * (up to MAX_OFFER_ATTEMPTS), offering the ride to each one sequentially.
 * If no driver accepts within the initial 5 km radius, the search is expanded
 * to 10 km for one additional attempt.
 *
 * @param {string} rideId       - The ride UUID
 * @param {number} pickupLat    - Pickup latitude
 * @param {number} pickupLng    - Pickup longitude
 * @param {string} [vehicleType] - Requested vehicle type
 * @returns {Promise<object|null>} The matched ride, or null if no match found
 */
export async function matchRide(rideId, pickupLat, pickupLng, vehicleType) {
  // Try matching with the default 5 km radius first
  let result = await attemptMatch(rideId, pickupLat, pickupLng, vehicleType, 5);

  if (result) {
    return result;
  }

  // Expand to 10 km and retry once
  console.log(`[matching] No drivers found within 5km for ride ${rideId}, expanding to 10km`);
  result = await attemptMatch(rideId, pickupLat, pickupLng, vehicleType, 10);

  if (result) {
    return result;
  }

  // No match found — notify the passenger
  console.log(`[matching] No drivers available for ride ${rideId}`);

  const io = getIO();
  if (io) {
    // Look up the passenger for this ride
    try {
      const rideResult = await query(
        'SELECT passenger_id FROM rides WHERE id = $1',
        [rideId]
      );

      if (rideResult.rows.length > 0) {
        const passengerId = rideResult.rows[0].passenger_id;
        io.to(`user:${passengerId}`).emit('ride:no_drivers', {
          rideId,
          message: 'No drivers are currently available in your area. Please try again shortly.',
        });
      }
    } catch (err) {
      console.error('[matching] Error notifying passenger of no drivers:', err.message);
    }
  }

  return null;
}

/**
 * Internal helper — attempt to match a ride within the given radius.
 *
 * @param {string} rideId
 * @param {number} pickupLat
 * @param {number} pickupLng
 * @param {string|null} vehicleType
 * @param {number} radiusKm
 * @returns {Promise<object|null>}
 */
async function attemptMatch(rideId, pickupLat, pickupLng, vehicleType, radiusKm) {
  const drivers = await findNearbyDrivers(pickupLat, pickupLng, radiusKm, vehicleType);

  if (drivers.length === 0) {
    return null;
  }

  const scoredDrivers = await scoreDrivers(drivers, pickupLat, pickupLng);

  // Get ride details for the offer payload
  let rideDetails;
  try {
    const rideResult = await query(
      `SELECT id, passenger_id, pickup_address, dropoff_address,
              ST_Y(pickup_location::geometry) AS pickup_lat,
              ST_X(pickup_location::geometry) AS pickup_lng,
              ST_Y(dropoff_location::geometry) AS dropoff_lat,
              ST_X(dropoff_location::geometry) AS dropoff_lng,
              vehicle_type, estimated_fare
       FROM rides
       WHERE id = $1`,
      [rideId]
    );

    if (rideResult.rows.length === 0) {
      console.error(`[matching] Ride ${rideId} not found`);
      return null;
    }

    rideDetails = rideResult.rows[0];
  } catch (err) {
    console.error('[matching] Error fetching ride details:', err.message);
    return null;
  }

  const io = getIO();
  const attempts = Math.min(scoredDrivers.length, MAX_OFFER_ATTEMPTS);

  for (let i = 0; i < attempts; i++) {
    const driver = scoredDrivers[i];

    // Check that this driver does not already have an active ride
    try {
      const activeRideResult = await query(
        `SELECT id FROM rides
         WHERE driver_id = $1
           AND status IN ('matched', 'driver_arriving', 'in_progress')
         LIMIT 1`,
        [driver.driverId]
      );

      if (activeRideResult.rows.length > 0) {
        // Driver is busy — skip to next
        continue;
      }
    } catch (err) {
      console.error('[matching] Error checking driver active rides:', err.message);
      continue;
    }

    // Create the ride offer in Redis with a TTL
    const offerKey = `ride:offer:${rideId}:${driver.driverId}`;
    await redis.set(
      offerKey,
      JSON.stringify({
        rideId,
        driverId: driver.driverId,
        status: 'pending',
        offeredAt: new Date().toISOString(),
      }),
      'EX',
      OFFER_TTL_SECONDS
    );

    // Emit the ride offer to the driver via Socket.IO
    if (io) {
      io.to(`user:${driver.driverId}`).emit('ride:offer', {
        rideId: rideDetails.id,
        passengerId: rideDetails.passenger_id,
        pickupLat: rideDetails.pickup_lat,
        pickupLng: rideDetails.pickup_lng,
        pickupAddress: rideDetails.pickup_address,
        dropoffLat: rideDetails.dropoff_lat,
        dropoffLng: rideDetails.dropoff_lng,
        dropoffAddress: rideDetails.dropoff_address,
        vehicleType: rideDetails.vehicle_type,
        estimatedFare: rideDetails.estimated_fare,
        driverDistance: driver.distance,
        offeredAt: new Date().toISOString(),
        expiresInSeconds: OFFER_TTL_SECONDS,
      });
    }

    // Wait for the driver to respond (poll Redis for acceptance/decline)
    const accepted = await waitForDriverResponse(rideId, driver.driverId);

    if (accepted) {
      // Driver accepted — finalise the match
      const matchedRide = await acceptRide(rideId, driver.driverId);
      return matchedRide;
    }

    // Driver declined or timed out — clean up and try the next one
    await redis.del(offerKey);
    console.log(
      `[matching] Driver ${driver.driverId} did not accept ride ${rideId}, trying next`
    );
  }

  return null;
}

/**
 * Poll Redis to wait for a driver's response to a ride offer.
 *
 * The driver responds by either:
 *   - Calling acceptRide() which sets the offer status to 'accepted'
 *   - Calling declineRide() which deletes the offer key
 *
 * @param {string} rideId
 * @param {string} driverId
 * @returns {Promise<boolean>} true if the driver accepted
 */
async function waitForDriverResponse(rideId, driverId) {
  const offerKey = `ride:offer:${rideId}:${driverId}`;
  const startTime = Date.now();

  while (Date.now() - startTime < OFFER_WAIT_MS) {
    try {
      const offerData = await redis.get(offerKey);

      if (!offerData) {
        // Key was deleted — driver declined or TTL expired
        return false;
      }

      const offer = JSON.parse(offerData);

      if (offer.status === 'accepted') {
        return true;
      }

      if (offer.status === 'declined') {
        return false;
      }
    } catch {
      // Redis error — treat as timeout
      return false;
    }

    // Wait before polling again
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  // Timeout — driver did not respond
  return false;
}

// ---------------------------------------------------------------------------
// acceptRide
// ---------------------------------------------------------------------------

/**
 * Accept a ride offer.
 *
 * Updates the ride record in the database, cleans up the Redis offer key,
 * and emits a real-time notification to the passenger with driver information.
 *
 * @param {string} rideId   - Ride UUID
 * @param {string} driverId - Driver's user UUID
 * @returns {Promise<object>} The updated ride record
 */
export async function acceptRide(rideId, driverId) {
  // Mark the offer as accepted in Redis (so the polling loop picks it up)
  const offerKey = `ride:offer:${rideId}:${driverId}`;
  const offerData = await redis.get(offerKey);

  if (offerData) {
    const offer = JSON.parse(offerData);
    offer.status = 'accepted';
    await redis.set(offerKey, JSON.stringify(offer), 'EX', 10);
  }

  // Update the ride in the database
  const rideResult = await query(
    `UPDATE rides
     SET driver_id = $1,
         status = 'matched',
         matched_at = NOW(),
         updated_at = NOW()
     WHERE id = $2
     RETURNING id, passenger_id, driver_id, status,
               pickup_address, dropoff_address,
               ST_Y(pickup_location::geometry) AS pickup_lat,
               ST_X(pickup_location::geometry) AS pickup_lng,
               ST_Y(dropoff_location::geometry) AS dropoff_lat,
               ST_X(dropoff_location::geometry) AS dropoff_lng,
               vehicle_type, estimated_fare, estimated_distance,
               estimated_duration, surge_multiplier,
               requested_at, matched_at`,
    [driverId, rideId]
  );

  if (rideResult.rows.length === 0) {
    throw new Error(`Ride ${rideId} not found`);
  }

  const ride = rideResult.rows[0];

  // Delete the offer key from Redis
  await redis.del(offerKey);

  // Get driver info for the notification
  const driverResult = await query(
    `SELECT u.id, u.first_name, u.last_name, u.phone, u.avatar_url,
            dp.vehicle_make, dp.vehicle_model, dp.vehicle_year,
            dp.vehicle_color, dp.vehicle_plate, dp.vehicle_type,
            dp.rating, dp.total_rides
     FROM users u
     JOIN driver_profiles dp ON dp.user_id = u.id
     WHERE u.id = $1`,
    [driverId]
  );

  const driverInfo = driverResult.rows.length > 0 ? driverResult.rows[0] : null;

  // Get driver's current location from Redis
  let driverLat = null;
  let driverLng = null;
  try {
    const positions = await redis.geopos(DRIVER_LOCATIONS_KEY, driverId);
    if (positions && positions[0]) {
      driverLng = parseFloat(positions[0][0]);
      driverLat = parseFloat(positions[0][1]);
    }
  } catch {
    // Non-critical — passenger can still proceed without driver location
  }

  // Emit 'ride:matched' to the passenger
  const io = getIO();
  if (io) {
    io.to(`user:${ride.passenger_id}`).emit('ride:matched', {
      rideId: ride.id,
      driver: driverInfo
        ? {
            id: driverInfo.id,
            firstName: driverInfo.first_name,
            lastName: driverInfo.last_name,
            phone: driverInfo.phone,
            avatarUrl: driverInfo.avatar_url,
            vehicleMake: driverInfo.vehicle_make,
            vehicleModel: driverInfo.vehicle_model,
            vehicleYear: driverInfo.vehicle_year,
            vehicleColor: driverInfo.vehicle_color,
            vehiclePlate: driverInfo.vehicle_plate,
            vehicleType: driverInfo.vehicle_type,
            rating: driverInfo.rating,
            totalRides: driverInfo.total_rides,
            lat: driverLat,
            lng: driverLng,
          }
        : { id: driverId },
      matchedAt: ride.matched_at,
    });

    // Also emit to the driver to confirm
    io.to(`user:${driverId}`).emit('ride:matched_confirmed', {
      rideId: ride.id,
      passengerId: ride.passenger_id,
      pickupLat: ride.pickup_lat,
      pickupLng: ride.pickup_lng,
      pickupAddress: ride.pickup_address,
      dropoffLat: ride.dropoff_lat,
      dropoffLng: ride.dropoff_lng,
      dropoffAddress: ride.dropoff_address,
      estimatedFare: ride.estimated_fare,
      matchedAt: ride.matched_at,
    });
  }

  // Update driver meta in Redis to reflect they now have a ride
  try {
    const metaKey = `${DRIVER_META_PREFIX}${driverId}`;
    await redis.hset(metaKey, 'lastRideAt', new Date().toISOString());
    await redis.hset(metaKey, 'currentRideId', rideId);
  } catch {
    // Non-critical
  }

  return ride;
}

// ---------------------------------------------------------------------------
// declineRide
// ---------------------------------------------------------------------------

/**
 * Decline a ride offer.
 *
 * Removes the offer key from Redis so the matching loop can move on
 * to the next driver candidate.
 *
 * @param {string} rideId   - Ride UUID
 * @param {string} driverId - Driver's user UUID
 * @returns {boolean} true
 */
export async function declineRide(rideId, driverId) {
  const offerKey = `ride:offer:${rideId}:${driverId}`;

  // Set status to declined so the polling loop picks it up immediately
  try {
    const offerData = await redis.get(offerKey);
    if (offerData) {
      const offer = JSON.parse(offerData);
      offer.status = 'declined';
      await redis.set(offerKey, JSON.stringify(offer), 'EX', 5);
    }
  } catch {
    // If we can't update, just delete
    await redis.del(offerKey);
  }

  return true;
}
