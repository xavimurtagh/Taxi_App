import redis from '../config/redis.js';
import { query } from '../config/database.js';

/**
 * Redis key for the geospatial index of driver positions.
 */
const DRIVER_LOCATIONS_KEY = 'driver:locations';

/**
 * Redis key prefix for per-driver metadata hashes.
 */
const DRIVER_META_PREFIX = 'driver:meta:';

/**
 * Full list of supported accessibility features with human-readable descriptions.
 */
const ACCESSIBILITY_OPTIONS = [
  {
    key: 'wheelchair_ramp',
    label: 'Wheelchair Ramp',
    description: 'Vehicle is equipped with a wheelchair ramp for easy boarding',
    category: 'mobility',
  },
  {
    key: 'wheelchair_lift',
    label: 'Wheelchair Lift',
    description: 'Vehicle has a powered wheelchair lift for secure boarding',
    category: 'mobility',
  },
  {
    key: 'wheelchair_space',
    label: 'Wheelchair Space',
    description: 'Vehicle has dedicated space to secure a wheelchair during transit',
    category: 'mobility',
  },
  {
    key: 'extra_legroom',
    label: 'Extra Legroom',
    description: 'Vehicle offers additional legroom for passengers with mobility needs',
    category: 'mobility',
  },
  {
    key: 'hand_controls',
    label: 'Hand Controls',
    description: 'Driver uses hand controls (informational for passenger awareness)',
    category: 'mobility',
  },
  {
    key: 'hearing_assistance',
    label: 'Hearing Assistance',
    description: 'Driver is trained in communicating with hearing-impaired passengers',
    category: 'sensory',
  },
  {
    key: 'visual_assistance',
    label: 'Visual Assistance',
    description: 'Driver is trained in assisting visually impaired passengers',
    category: 'sensory',
  },
  {
    key: 'sign_language',
    label: 'Sign Language',
    description: 'Driver knows sign language for communication with deaf passengers',
    category: 'sensory',
  },
  {
    key: 'service_animal_friendly',
    label: 'Service Animal Friendly',
    description: 'Driver welcomes service animals in the vehicle',
    category: 'general',
  },
  {
    key: 'step_stool',
    label: 'Step Stool',
    description: 'Vehicle is equipped with a step stool for easier entry and exit',
    category: 'mobility',
  },
  {
    key: 'child_seat',
    label: 'Child Seat',
    description: 'Vehicle is equipped with a child safety seat',
    category: 'general',
  },
];

/**
 * Set of valid accessibility feature keys for quick validation.
 */
const VALID_FEATURE_KEYS = new Set(ACCESSIBILITY_OPTIONS.map((opt) => opt.key));

// ---------------------------------------------------------------------------
// matchAccessibleDriver
// ---------------------------------------------------------------------------

/**
 * Find nearby drivers whose accessibility_features match the passenger's needs.
 *
 * Uses the Redis geospatial index to find drivers within a 10 km radius,
 * then filters by accessibility feature match. Only online, verified drivers
 * whose profiles contain ALL of the requested accessibility features are returned.
 *
 * @param {number} pickupLat - Pickup latitude
 * @param {number} pickupLng - Pickup longitude
 * @param {string[]} accessibilityNeeds - Array of required accessibility feature keys
 * @returns {Promise<Array<{
 *   driverId: string,
 *   distance: number,
 *   lat: number,
 *   lng: number,
 *   vehicleType: string,
 *   rating: number,
 *   accessibilityFeatures: string[]
 * }>>}
 */
export async function matchAccessibleDriver(pickupLat, pickupLng, accessibilityNeeds) {
  if (!accessibilityNeeds || accessibilityNeeds.length === 0) {
    return [];
  }

  // Search within 10 km for accessible drivers (wider radius than standard)
  const radiusKm = 10;

  try {
    const results = await redis.georadius(
      DRIVER_LOCATIONS_KEY,
      pickupLng,
      pickupLat,
      radiusKm,
      'km',
      'WITHCOORD',
      'WITHDIST',
      'ASC',
    );

    if (!results || results.length === 0) {
      return [];
    }

    // Collect driver IDs for a batch database query
    const driverIds = results.map((r) => r[0]);

    // Fetch accessibility features from driver_profiles for all nearby drivers
    const profilesResult = await query(
      `SELECT dp.user_id, dp.accessibility_features, dp.vehicle_type,
              u.rating_avg
       FROM driver_profiles dp
       JOIN users u ON u.id = dp.user_id
       WHERE dp.user_id = ANY($1)
         AND dp.is_online = true
         AND dp.documents_verified = true
         AND dp.background_check_status = 'passed'`,
      [driverIds],
    );

    // Index profiles by user_id for fast lookup
    const profileMap = new Map();
    for (const row of profilesResult.rows) {
      profileMap.set(row.user_id, row);
    }

    const matchedDrivers = [];

    for (const result of results) {
      const driverId = result[0];
      const distance = parseFloat(result[1]);
      const [lng, lat] = result[2].map(Number);

      const profile = profileMap.get(driverId);
      if (!profile) {
        continue;
      }

      // Check if the driver's accessibility features satisfy all passenger needs
      const driverFeatures = profile.accessibility_features || {};
      const hasAllFeatures = accessibilityNeeds.every(
        (need) => driverFeatures[need] === true,
      );

      if (!hasAllFeatures) {
        continue;
      }

      matchedDrivers.push({
        driverId,
        distance: Math.round(distance * 100) / 100,
        lat,
        lng,
        vehicleType: profile.vehicle_type || 'accessible',
        rating: parseFloat(profile.rating_avg) || 4.0,
        accessibilityFeatures: Object.keys(driverFeatures).filter(
          (key) => driverFeatures[key] === true,
        ),
      });
    }

    return matchedDrivers;
  } catch (err) {
    console.error('[accessibility] Error matching accessible drivers:', err.message);
    return [];
  }
}

// ---------------------------------------------------------------------------
// validateAccessibilityMatch
// ---------------------------------------------------------------------------

/**
 * Check if a driver can accommodate the passenger's accessibility needs.
 *
 * @param {object} driverProfile - Driver profile object with accessibility_features JSONB
 * @param {string[]} passengerNeeds - Array of required accessibility feature keys
 * @returns {{ isMatch: boolean, matched: string[], unmatched: string[] }}
 */
export function validateAccessibilityMatch(driverProfile, passengerNeeds) {
  if (!passengerNeeds || passengerNeeds.length === 0) {
    return { isMatch: true, matched: [], unmatched: [] };
  }

  const driverFeatures = driverProfile?.accessibility_features || {};
  const matched = [];
  const unmatched = [];

  for (const need of passengerNeeds) {
    if (driverFeatures[need] === true) {
      matched.push(need);
    } else {
      unmatched.push(need);
    }
  }

  return {
    isMatch: unmatched.length === 0,
    matched,
    unmatched,
  };
}

// ---------------------------------------------------------------------------
// getAccessibilityOptions
// ---------------------------------------------------------------------------

/**
 * Return the full list of available accessibility features with descriptions.
 *
 * @returns {Array<{ key: string, label: string, description: string, category: string }>}
 */
export function getAccessibilityOptions() {
  return ACCESSIBILITY_OPTIONS;
}

// ---------------------------------------------------------------------------
// updateDriverAccessibility
// ---------------------------------------------------------------------------

/**
 * Update a driver's accessibility features in the database.
 * Only accepts valid feature keys; unknown keys are silently ignored.
 *
 * @param {string} driverId - The driver's user ID (UUID)
 * @param {object} features - Object mapping feature keys to boolean values
 * @returns {Promise<object>} The updated accessibility_features JSONB
 */
export async function updateDriverAccessibility(driverId, features) {
  // Filter to only valid feature keys
  const sanitised = {};
  for (const [key, value] of Object.entries(features)) {
    if (VALID_FEATURE_KEYS.has(key) && typeof value === 'boolean') {
      sanitised[key] = value;
    }
  }

  const result = await query(
    `UPDATE driver_profiles
     SET accessibility_features = $1
     WHERE user_id = $2
     RETURNING user_id, accessibility_features`,
    [JSON.stringify(sanitised), driverId],
  );

  if (result.rows.length === 0) {
    return null;
  }

  // Also update Redis driver metadata if the driver is currently online
  try {
    const metaKey = `${DRIVER_META_PREFIX}${driverId}`;
    const exists = await redis.exists(metaKey);
    if (exists) {
      await redis.hset(
        metaKey,
        'accessibilityFeatures',
        JSON.stringify(sanitised),
      );
    }
  } catch (err) {
    console.warn('[accessibility] Failed to update Redis meta:', err.message);
  }

  return result.rows[0].accessibility_features;
}

/**
 * Exported set of valid feature keys for use in validation schemas.
 */
export { VALID_FEATURE_KEYS };
