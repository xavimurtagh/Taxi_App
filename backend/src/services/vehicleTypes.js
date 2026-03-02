import redis from '../config/redis.js';
import { query } from '../config/database.js';

/**
 * Redis cache key for the full list of active vehicle types.
 */
const CACHE_KEY = 'vehicle_types:active';

/**
 * Redis cache key prefix for individual vehicle type lookups.
 */
const CACHE_KEY_PREFIX = 'vehicle_type:';

/**
 * Cache TTL in seconds (5 minutes).
 */
const CACHE_TTL = 300;

// ---------------------------------------------------------------------------
// getActiveVehicleTypes
// ---------------------------------------------------------------------------

/**
 * Get all active vehicle types sorted by sort_order.
 * Results are cached in Redis for 5 minutes.
 *
 * @returns {Promise<Array<{
 *   typeKey: string,
 *   label: string,
 *   description: string,
 *   priceMultiplier: number,
 *   minCapacity: number,
 *   maxCapacity: number,
 *   icon: string,
 *   sortOrder: number,
 *   features: object
 * }>>}
 */
export async function getActiveVehicleTypes() {
  // Try cache first
  try {
    const cached = await redis.get(CACHE_KEY);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (err) {
    console.warn('[vehicleTypes] Redis cache read failed:', err.message);
  }

  // Fetch from database
  const result = await query(
    `SELECT type_key, label, description, price_multiplier,
            min_capacity, max_capacity, icon, sort_order, features
     FROM vehicle_type_configs
     WHERE is_active = true
     ORDER BY sort_order ASC, type_key ASC`,
  );

  const vehicleTypes = result.rows.map((row) => ({
    typeKey: row.type_key,
    label: row.label,
    description: row.description,
    priceMultiplier: parseFloat(row.price_multiplier),
    minCapacity: row.min_capacity,
    maxCapacity: row.max_capacity,
    icon: row.icon,
    sortOrder: row.sort_order,
    features: row.features || {},
  }));

  // Store in cache
  try {
    await redis.set(CACHE_KEY, JSON.stringify(vehicleTypes), 'EX', CACHE_TTL);
  } catch (err) {
    console.warn('[vehicleTypes] Redis cache write failed:', err.message);
  }

  return vehicleTypes;
}

// ---------------------------------------------------------------------------
// getVehicleType
// ---------------------------------------------------------------------------

/**
 * Get a single vehicle type by its type_key.
 * Uses per-key Redis caching.
 *
 * @param {string} typeKey - The vehicle type key (e.g. 'economy', 'comfort')
 * @returns {Promise<object|null>} The vehicle type or null if not found / inactive
 */
export async function getVehicleType(typeKey) {
  const cacheKey = `${CACHE_KEY_PREFIX}${typeKey}`;

  // Try cache first
  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      // A cached "null" sentinel means the type does not exist
      if (cached === '__null__') {
        return null;
      }
      return JSON.parse(cached);
    }
  } catch (err) {
    console.warn('[vehicleTypes] Redis cache read failed:', err.message);
  }

  // Fetch from database
  const result = await query(
    `SELECT type_key, label, description, price_multiplier,
            min_capacity, max_capacity, icon, sort_order, features, is_active
     FROM vehicle_type_configs
     WHERE type_key = $1`,
    [typeKey],
  );

  if (result.rows.length === 0 || !result.rows[0].is_active) {
    // Cache the miss to avoid repeated database lookups
    try {
      await redis.set(cacheKey, '__null__', 'EX', CACHE_TTL);
    } catch {
      // Non-critical
    }
    return null;
  }

  const row = result.rows[0];
  const vehicleType = {
    typeKey: row.type_key,
    label: row.label,
    description: row.description,
    priceMultiplier: parseFloat(row.price_multiplier),
    minCapacity: row.min_capacity,
    maxCapacity: row.max_capacity,
    icon: row.icon,
    sortOrder: row.sort_order,
    features: row.features || {},
  };

  // Store in cache
  try {
    await redis.set(cacheKey, JSON.stringify(vehicleType), 'EX', CACHE_TTL);
  } catch (err) {
    console.warn('[vehicleTypes] Redis cache write failed:', err.message);
  }

  return vehicleType;
}

// ---------------------------------------------------------------------------
// getPriceMultiplier
// ---------------------------------------------------------------------------

/**
 * Get the price multiplier for a given vehicle type.
 * Used by the fare calculator. Returns 1.0 for unknown types as a safe default.
 *
 * @param {string} typeKey - The vehicle type key
 * @returns {Promise<number>} The price multiplier (defaults to 1.0)
 */
export async function getPriceMultiplier(typeKey) {
  try {
    const vehicleType = await getVehicleType(typeKey);
    if (vehicleType) {
      return vehicleType.priceMultiplier;
    }
  } catch (err) {
    console.error('[vehicleTypes] Error fetching price multiplier:', err.message);
  }

  // Default to 1.0 for unknown or errored types
  return 1.0;
}

// ---------------------------------------------------------------------------
// refreshCache
// ---------------------------------------------------------------------------

/**
 * Refresh the Redis cache for vehicle types.
 * Clears all cached entries and re-fetches from the database.
 *
 * @returns {Promise<void>}
 */
export async function refreshCache() {
  try {
    // Delete the main list cache
    await redis.del(CACHE_KEY);

    // Delete all individual type caches
    const result = await query(
      `SELECT type_key FROM vehicle_type_configs`,
    );

    const deleteKeys = result.rows.map((row) => `${CACHE_KEY_PREFIX}${row.type_key}`);
    if (deleteKeys.length > 0) {
      await redis.del(...deleteKeys);
    }

    // Pre-warm the cache by fetching all active types
    await getActiveVehicleTypes();

    console.log('[vehicleTypes] Cache refreshed successfully');
  } catch (err) {
    console.error('[vehicleTypes] Error refreshing cache:', err.message);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// getAccessibleVehicleTypes
// ---------------------------------------------------------------------------

/**
 * Get vehicle types that support accessibility features.
 * A vehicle type is considered accessible if its features JSONB contains
 * any accessibility-related keys (wheelchair_ramp, wheelchair_lift,
 * hearing_assistance, etc.) or if its type_key is 'accessible'.
 *
 * @returns {Promise<Array<object>>}
 */
export async function getAccessibleVehicleTypes() {
  // Try to serve from the full cached list first
  const allTypes = await getActiveVehicleTypes();

  const accessibilityKeys = [
    'wheelchair_ramp',
    'wheelchair_lift',
    'hearing_assistance',
    'visual_assistance',
    'extra_legroom',
    'service_animal_friendly',
  ];

  return allTypes.filter((vt) => {
    // The 'accessible' type is always included
    if (vt.typeKey === 'accessible') {
      return true;
    }

    // Check if the features object contains any accessibility-related keys
    if (vt.features && typeof vt.features === 'object') {
      return accessibilityKeys.some((key) => vt.features[key] === true);
    }

    return false;
  });
}
