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
 * Default search radius in kilometres for accessible driver matching.
 */
const DEFAULT_RADIUS_KM = 10;

/**
 * Maximum number of accessible drivers to return.
 */
const MAX_RESULTS = 20;

// ---------------------------------------------------------------------------
// Accessibility feature definitions
// ---------------------------------------------------------------------------

/**
 * All recognised accessibility features with human-readable descriptions.
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
    description: 'Vehicle has a powered wheelchair lift for passengers who use wheelchairs',
    category: 'mobility',
  },
  {
    key: 'wheelchair_securement',
    label: 'Wheelchair Securement',
    description: 'Vehicle has proper securement devices for wheelchairs during transit',
    category: 'mobility',
  },
  {
    key: 'extra_legroom',
    label: 'Extra Legroom',
    description: 'Vehicle offers additional legroom for passengers with mobility needs',
    category: 'mobility',
  },
  {
    key: 'step_free_access',
    label: 'Step-Free Access',
    description: 'Vehicle provides step-free access for passengers with limited mobility',
    category: 'mobility',
  },
  {
    key: 'hearing_assistance',
    label: 'Hearing Assistance',
    description: 'Driver is trained to assist passengers who are deaf or hard of hearing',
    category: 'sensory',
  },
  {
    key: 'visual_assistance',
    label: 'Visual Assistance',
    description: 'Driver is trained to assist passengers who are blind or visually impaired',
    category: 'sensory',
  },
  {
    key: 'sign_language',
    label: 'Sign Language',
    description: 'Driver knows sign language and can communicate with deaf passengers',
    category: 'sensory',
  },
  {
    key: 'service_animal_friendly',
    label: 'Service Animal Friendly',
    description: 'Vehicle accommodates service animals at no additional charge',
    category: 'general',
  },
  {
    key: 'child_seat',
    label: 'Child Seat',
    description: 'Vehicle is equipped with a child safety seat',
    category: 'general',
  },
  {
    key: 'stretcher_accessible',
    label: 'Stretcher Accessible',
    description: 'Vehicle can accommodate a stretcher for passengers with medical needs',
    category: 'medical',
  },
];

/**
 * Set of valid accessibility feature keys for fast lookup.
 */
const VALID_FEATURE_KEYS = new Set(ACCESSIBILITY_OPTIONS.map((opt) => opt.key));

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
// validateAccessibilityMatch
// ---------------------------------------------------------------------------

/**
 * Check if a driver's accessibility features can accommodate the passenger's needs.
 *
 * Every feature in the passenger's needs array must be present and set to true
 * in the driver's accessibility_features JSONB.
 *
 * @param {{ accessibility_features: object }} driverProfile - Driver profile row with accessibility_features
 * @param {string[]} passengerNeeds - Array of accessibility feature keys the passenger requires
 * @returns {{ isMatch: boolean, matchedFeatures: string[], missingFeatures: string[] }}
 */
export function validateAccessibilityMatch(driverProfile, passengerNeeds) {
  if (!passengerNeeds || passengerNeeds.length === 0) {
    return { isMatch: true, matchedFeatures: [], missingFeatures: [] };
  }

  const driverFeatures = driverProfile.accessibility_features || {};
  const matchedFeatures = [];
  const missingFeatures = [];

  for (const need of passengerNeeds) {
    if (driverFeatures[need] === true) {
      matchedFeatures.push(need);
    } else {
      missingFeatures.push(need);
    }
  }

  return {
    isMatch: missingFeatures.length === 0,
    matchedFeatures,
    missingFeatures,
  };
}

// ---------------------------------------------------------------------------
// matchAccessibleDriver
// ---------------------------------------------------------------------------

/**
 * Find nearby drivers whose accessibility features match the passenger's needs.
 *
 * Uses the Redis geospatial index to find drivers within the search radius,
 * then filters by accessibility features from the database.
 *
 * @param {number} pickupLat - Pickup latitude
 * @param {number} pickupLng - Pickup longitude
 * @param {string[]} accessibilityNeeds - Array of required accessibility feature keys
 * @param {number} [radiusKm=10] - Search radius in kilometres
 * @returns {Promise<Array<{
 *   driverId: string,
 *   distance: number,
 *   lat: number,
 *   lng: number,
 *   matchedFeatures: string[],
 *   vehicleType: string,
 *   rating: number
 * }>>}
 */
export async function matchAccessibleDriver(pickupLat, pickupLng, accessibilityNeeds, radiusKm = DEFAULT_RADIUS_KM) {
  if (!accessibilityNeeds || accessibilityNeeds.length === 0) {
    return [];
  }

  try {
    // Step 1: Find nearby drivers from Redis geo index
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

    // Collect driver IDs that are online
    const candidateDrivers = [];

    for (const result of results) {
      const driverId = result[0];
      const distance = parseFloat(result[1]);
      const [lng, lat] = result[2].map(Number);

      // Check driver metadata to ensure they are online and verified
      const metaKey = `${DRIVER_META_PREFIX}${driverId}`;
      const meta = await redis.hgetall(metaKey);

      if (!meta || Object.keys(meta).length === 0) {
        continue;
      }

      const isOnline = meta.status === 'online' || !meta.status;
      const isVerified = meta.isVerified !== 'false';

      if (!isOnline || !isVerified) {
        continue;
      }

      candidateDrivers.push({
        driverId,
        distance,
        lat,
        lng,
        vehicleType: meta.vehicleType || 'economy',
        rating: parseFloat(meta.rating) || 4.0,
      });
    }

    if (candidateDrivers.length === 0) {
      return [];
    }

    // Step 2: Fetch accessibility features from the database for candidate drivers
    const driverIds = candidateDrivers.map((d) => d.driverId);
    const placeholders = driverIds.map((_, i) => `$${i + 1}`).join(', ');

    const profilesResult = await query(
      `SELECT dp.user_id, dp.accessibility_features
       FROM driver_profiles dp
       WHERE dp.user_id IN (${placeholders})
         AND dp.is_online = true`,
      driverIds,
    );

    // Build a lookup map: driverId -> accessibility_features
    const featuresByDriver = new Map();
    for (const row of profilesResult.rows) {
      featuresByDriver.set(row.user_id, row.accessibility_features || {});
    }

    // Step 3: Filter drivers that match all accessibility needs
    const matchedDrivers = [];

    for (const driver of candidateDrivers) {
      const driverFeatures = featuresByDriver.get(driver.driverId);

      if (!driverFeatures) {
        continue;
      }

      const validation = validateAccessibilityMatch(
        { accessibility_features: driverFeatures },
        accessibilityNeeds,
      );

      if (validation.isMatch) {
        matchedDrivers.push({
          driverId: driver.driverId,
          distance: driver.distance,
          lat: driver.lat,
          lng: driver.lng,
          matchedFeatures: validation.matchedFeatures,
          vehicleType: driver.vehicleType,
          rating: driver.rating,
        });
      }

      // Cap results
      if (matchedDrivers.length >= MAX_RESULTS) {
        break;
      }
    }

    return matchedDrivers;
  } catch (err) {
    console.error('[accessibility] Error matching accessible drivers:', err.message);
    return [];
  }
}

// ---------------------------------------------------------------------------
// updateDriverAccessibility
// ---------------------------------------------------------------------------

/**
 * Update a driver's accessibility features in the database.
 *
 * @param {string} driverId - The driver's user UUID
 * @param {object} features - JSONB object of accessibility features (key: boolean)
 * @returns {Promise<object>} The updated accessibility_features
 * @throws {Error} If the driver profile is not found
 */
export async function updateDriverAccessibility(driverId, features) {
  // Validate that all feature keys are recognised
  const validatedFeatures = {};
  for (const [key, value] of Object.entries(features)) {
    if (VALID_FEATURE_KEYS.has(key)) {
      validatedFeatures[key] = Boolean(value);
    }
  }

  const result = await query(
    `UPDATE driver_profiles
     SET accessibility_features = $1
     WHERE user_id = $2
     RETURNING user_id, accessibility_features`,
    [JSON.stringify(validatedFeatures), driverId],
  );

  if (result.rows.length === 0) {
    const error = new Error('Driver profile not found');
    error.statusCode = 404;
    throw error;
  }

  return result.rows[0].accessibility_features;
}

export { VALID_FEATURE_KEYS };
