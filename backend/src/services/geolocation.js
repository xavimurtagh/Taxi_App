import env from '../config/env.js';
import redis from '../config/redis.js';
import { haversineDistance } from '../utils/geoUtils.js';

/**
 * Redis key for the geospatial index of driver positions.
 */
const DRIVER_LOCATIONS_KEY = 'driver:locations';

/**
 * Redis key prefix for per-driver metadata hashes.
 */
const DRIVER_META_PREFIX = 'driver:meta:';

/**
 * TTL (in seconds) for driver metadata entries.
 * Stale entries expire automatically if a driver stops sending updates.
 */
const META_TTL_SECONDS = 300;

// ---------------------------------------------------------------------------
// getRoute
// ---------------------------------------------------------------------------

/**
 * Get a driving route between two points using the OSRM backend.
 *
 * @param {number} startLat  - Start latitude
 * @param {number} startLng  - Start longitude
 * @param {number} endLat    - End latitude
 * @param {number} endLng    - End longitude
 * @returns {Promise<{ distance: number, duration: number, geometry: string }>}
 *          distance in km, duration in minutes, geometry as encoded polyline
 */
export async function getRoute(startLat, startLng, endLat, endLng) {
  try {
    const url =
      `${env.OSRM_URL}/route/v1/driving/` +
      `${startLng},${startLat};${endLng},${endLat}` +
      `?overview=full&geometries=polyline`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`OSRM returned HTTP ${response.status}`);
    }

    const data = await response.json();

    if (!data.routes || data.routes.length === 0) {
      throw new Error('OSRM returned no routes');
    }

    const route = data.routes[0];

    return {
      distance: Math.round((route.distance / 1000) * 100) / 100, // metres -> km
      duration: Math.round((route.duration / 60) * 100) / 100,    // seconds -> minutes
      geometry: route.geometry,
    };
  } catch (err) {
    console.warn('[geolocation] OSRM route request failed, using fallback:', err.message);

    // Fallback: haversine straight-line with a 1.3x road-winding factor
    const straightLine = haversineDistance(startLat, startLng, endLat, endLng);
    const estimatedDistance = Math.round(straightLine * 1.3 * 100) / 100;
    const estimatedDuration = Math.round((estimatedDistance / 30) * 60 * 100) / 100; // 30 km/h

    return {
      distance: estimatedDistance,
      duration: estimatedDuration,
      geometry: null,
    };
  }
}

// ---------------------------------------------------------------------------
// getETA
// ---------------------------------------------------------------------------

/**
 * Get the estimated time of arrival for a driver heading to a pickup point.
 *
 * @param {number} driverLat  - Driver's current latitude
 * @param {number} driverLng  - Driver's current longitude
 * @param {number} pickupLat  - Pickup latitude
 * @param {number} pickupLng  - Pickup longitude
 * @returns {Promise<{ distanceKm: number, durationMinutes: number }>}
 */
export async function getETA(driverLat, driverLng, pickupLat, pickupLng) {
  try {
    const url =
      `${env.OSRM_URL}/route/v1/driving/` +
      `${driverLng},${driverLat};${pickupLng},${pickupLat}` +
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

    return {
      distanceKm: Math.round((route.distance / 1000) * 100) / 100,
      durationMinutes: Math.round((route.duration / 60) * 100) / 100,
    };
  } catch (err) {
    console.warn('[geolocation] OSRM ETA request failed, using fallback:', err.message);

    const straightLine = haversineDistance(driverLat, driverLng, pickupLat, pickupLng);
    const estimatedDistance = Math.round(straightLine * 1.3 * 100) / 100;
    const estimatedDuration = Math.round((estimatedDistance / 30) * 60 * 100) / 100;

    return {
      distanceKm: estimatedDistance,
      durationMinutes: estimatedDuration,
    };
  }
}

// ---------------------------------------------------------------------------
// updateDriverLocation
// ---------------------------------------------------------------------------

/**
 * Store or update a driver's position in the Redis geospatial index and
 * refresh the metadata hash with a sliding TTL.
 *
 * @param {string} driverId - Driver's user ID
 * @param {number} lat      - Latitude
 * @param {number} lng      - Longitude
 * @returns {Promise<true>}
 */
export async function updateDriverLocation(driverId, lat, lng) {
  // GEOADD key longitude latitude member
  await redis.geoadd(DRIVER_LOCATIONS_KEY, lng, lat, driverId);

  // Store metadata as a hash with a TTL so stale entries self-clean
  const metaKey = `${DRIVER_META_PREFIX}${driverId}`;
  await redis.hset(metaKey, {
    lat: String(lat),
    lng: String(lng),
    updatedAt: new Date().toISOString(),
  });
  await redis.expire(metaKey, META_TTL_SECONDS);

  return true;
}

// ---------------------------------------------------------------------------
// removeDriverLocation
// ---------------------------------------------------------------------------

/**
 * Remove a driver from the geospatial index and delete their metadata.
 *
 * @param {string} driverId - Driver's user ID
 * @returns {Promise<void>}
 */
export async function removeDriverLocation(driverId) {
  await redis.zrem(DRIVER_LOCATIONS_KEY, driverId);
  await redis.del(`${DRIVER_META_PREFIX}${driverId}`);
}
