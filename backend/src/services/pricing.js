import env from '../config/env.js';
import redis from '../config/redis.js';
import { query } from '../config/database.js';
import { haversineDistance } from '../utils/geoUtils.js';
import { calculateFare } from '../utils/fareCalculator.js';

/**
 * Redis key for the geospatial index of driver positions.
 */
const DRIVER_LOCATIONS_KEY = 'driver:locations';

// ---------------------------------------------------------------------------
// calculateSurge
// ---------------------------------------------------------------------------

/**
 * Calculate the dynamic surge multiplier for a given pickup area.
 *
 * The multiplier is based on the ratio of active ride requests to available
 * online drivers within a 3 km radius over the last 10 minutes.
 *
 * @param {number} pickupLat - Pickup latitude
 * @param {number} pickupLng - Pickup longitude
 * @returns {Promise<number>} Surge multiplier (1.0 = no surge)
 */
export async function calculateSurge(pickupLat, pickupLng) {
  try {
    // Count active ride requests in the area from the last 10 minutes.
    // We use ST_DWithin to find rides whose pickup_location is within 3 km.
    const requestsResult = await query(
      `SELECT COUNT(*)::int AS count
       FROM rides
       WHERE status IN ('requested', 'matched', 'driver_arriving', 'in_progress')
         AND requested_at >= NOW() - INTERVAL '10 minutes'
         AND ST_DWithin(
               pickup_location,
               ST_MakePoint($1, $2)::geography,
               $3
             )`,
      [pickupLng, pickupLat, 3000] // 3 km = 3000 metres
    );

    const activeRequests = requestsResult.rows[0].count;

    // Count online drivers in the area via Redis GEORADIUS
    const nearbyDriverIds = await redis.georadius(
      DRIVER_LOCATIONS_KEY,
      pickupLng,
      pickupLat,
      3,  // 3 km
      'km'
    );

    const onlineDrivers = nearbyDriverIds.length;

    // If there are no drivers at all, apply maximum surge
    if (onlineDrivers === 0) {
      return env.SURGE_CAP;
    }

    const ratio = activeRequests / onlineDrivers;

    let surge;
    if (ratio <= 1) {
      surge = 1.0;
    } else {
      // Gradual increase: 1.0 + 0.25 for each unit of demand above supply
      surge = Math.min(1.0 + (ratio - 1) * 0.25, env.SURGE_CAP);
    }

    // Round to two decimal places
    return Math.round(surge * 100) / 100;
  } catch (err) {
    console.error('[pricing] Error calculating surge:', err.message);
    // On error, default to no surge to avoid overcharging
    return 1.0;
  }
}

// ---------------------------------------------------------------------------
// estimateFare
// ---------------------------------------------------------------------------

/**
 * Produce a full fare estimate for a prospective ride.
 *
 * Uses the OSRM routing engine for accurate distance and duration, then
 * applies surge pricing and the standard fare formula.  Falls back to
 * haversine-based estimates if OSRM is unavailable.
 *
 * @param {number} pickupLat   - Pickup latitude
 * @param {number} pickupLng   - Pickup longitude
 * @param {number} dropoffLat  - Dropoff latitude
 * @param {number} dropoffLng  - Dropoff longitude
 * @param {string} [vehicleType='economy'] - Vehicle class
 * @returns {Promise<{
 *   estimatedDistance: number,
 *   estimatedDuration: number,
 *   fare: number,
 *   platformFee: number,
 *   driverPayout: number,
 *   breakdown: object,
 *   surgeMultiplier: number
 * }>}
 */
export async function estimateFare(pickupLat, pickupLng, dropoffLat, dropoffLng, vehicleType = 'economy') {
  let distanceKm;
  let durationMinutes;

  try {
    // Attempt OSRM route lookup
    const url =
      `${env.OSRM_URL}/route/v1/driving/` +
      `${pickupLng},${pickupLat};${dropoffLng},${dropoffLat}` +
      `?overview=false`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`OSRM returned HTTP ${response.status}`);
    }

    const data = await response.json();

    if (!data.routes || data.routes.length === 0) {
      throw new Error('OSRM returned no routes');
    }

    const route = data.routes[0];
    distanceKm = Math.round((route.distance / 1000) * 100) / 100;
    durationMinutes = Math.round((route.duration / 60) * 100) / 100;
  } catch (err) {
    console.warn('[pricing] OSRM route request failed, using fallback:', err.message);

    // Fallback: haversine distance * 1.3 road factor, 30 km/h average speed
    const straightLine = haversineDistance(pickupLat, pickupLng, dropoffLat, dropoffLng);
    distanceKm = Math.round(straightLine * 1.3 * 100) / 100;
    durationMinutes = Math.round((distanceKm / 30) * 60 * 100) / 100;
  }

  // Calculate surge multiplier for the pickup area
  const surgeMultiplier = await calculateSurge(pickupLat, pickupLng);

  // Compute fare using the shared fare calculator
  const fareResult = calculateFare({
    distanceKm,
    durationMinutes,
    surgeMultiplier,
    vehicleType,
  });

  return {
    estimatedDistance: distanceKm,
    estimatedDuration: durationMinutes,
    fare: fareResult.fare,
    platformFee: fareResult.platformFee,
    driverPayout: fareResult.driverPayout,
    breakdown: fareResult.breakdown,
    surgeMultiplier: fareResult.surgeMultiplier,
  };
}
