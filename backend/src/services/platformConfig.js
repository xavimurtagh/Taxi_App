import { query } from '../config/database.js';
import redis from '../config/redis.js';

/**
 * Redis key prefix for cached platform config values.
 */
const CACHE_PREFIX = 'config:';

/**
 * Default TTL for cached config entries (in seconds).
 */
const CACHE_TTL = 300;

// ---------------------------------------------------------------------------
// parseValue
// ---------------------------------------------------------------------------

/**
 * Parse a raw string value from the database according to its declared type.
 *
 * @param {string} raw      - The stored string value
 * @param {string} dataType - One of 'number', 'boolean', 'json', 'string'
 * @returns {*} The parsed value
 */
function parseValue(raw, dataType) {
  switch (dataType) {
    case 'number':
      return parseFloat(raw);
    case 'boolean':
      return raw === 'true';
    case 'json':
      return JSON.parse(raw);
    case 'string':
    default:
      return raw;
  }
}

// ---------------------------------------------------------------------------
// getConfig
// ---------------------------------------------------------------------------

/**
 * Retrieve a single platform configuration value by key.
 *
 * Checks Redis first; on cache miss, loads from the database and populates
 * the cache with a 300-second TTL.
 *
 * @param {string} key - The config key to look up
 * @returns {Promise<*>} The parsed config value, or null if not found
 */
export async function getConfig(key) {
  try {
    // Check Redis cache first
    const cached = await redis.get(`${CACHE_PREFIX}${key}`);

    if (cached !== null) {
      try {
        const parsed = JSON.parse(cached);
        return parsed.value;
      } catch {
        // If the cached payload is corrupt, fall through to DB
      }
    }

    // Cache miss – query the database
    const result = await query(
      'SELECT value, data_type FROM platform_config WHERE key = $1',
      [key]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const { value, data_type } = result.rows[0];
    const parsed = parseValue(value, data_type);

    // Store in Redis for subsequent reads
    await redis.set(
      `${CACHE_PREFIX}${key}`,
      JSON.stringify({ value: parsed }),
      'EX',
      CACHE_TTL
    );

    return parsed;
  } catch (err) {
    console.error('[platformConfig] Error getting config for key:', key, err.message);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// getAllConfig
// ---------------------------------------------------------------------------

/**
 * Retrieve all platform configuration values, optionally filtered by
 * category.
 *
 * @param {string|null} [category=null] - If provided, only return entries
 *   belonging to this category.
 * @returns {Promise<Object>} A plain object mapping config keys to their
 *   parsed values.
 */
export async function getAllConfig(category = null) {
  try {
    let result;

    if (category) {
      result = await query(
        'SELECT key, value, data_type FROM platform_config WHERE category = $1',
        [category]
      );
    } else {
      result = await query(
        'SELECT key, value, data_type FROM platform_config'
      );
    }

    const config = {};
    for (const row of result.rows) {
      config[row.key] = parseValue(row.value, row.data_type);
    }

    return config;
  } catch (err) {
    console.error('[platformConfig] Error getting all config:', err.message);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// updateConfig
// ---------------------------------------------------------------------------

/**
 * Update a single governable platform configuration value.
 *
 * Verifies that the key exists and is marked as governable before allowing
 * the update.  Records the old value for audit purposes and invalidates the
 * Redis cache for the key.
 *
 * @param {string} key       - The config key to update
 * @param {*}      value     - The new value (will be stored as a string)
 * @param {string} updatedBy - Identifier of the actor performing the update
 *   (e.g. a user id or 'governance')
 * @returns {Promise<{key: string, oldValue: *, newValue: *}>}
 * @throws {Error} If the key does not exist or is not governable
 */
export async function updateConfig(key, value, updatedBy) {
  try {
    // Verify the key exists and is governable
    const existing = await query(
      'SELECT value, data_type, governable FROM platform_config WHERE key = $1',
      [key]
    );

    if (existing.rows.length === 0) {
      throw new Error(`Config key "${key}" does not exist`);
    }

    const row = existing.rows[0];

    if (!row.governable) {
      throw new Error(`Config key "${key}" is not governable`);
    }

    const oldValue = parseValue(row.value, row.data_type);
    const newValueStr = typeof value === 'object' ? JSON.stringify(value) : String(value);

    // Persist the update
    await query(
      `UPDATE platform_config
       SET value = $1, updated_by = $2, updated_at = NOW()
       WHERE key = $3`,
      [newValueStr, updatedBy, key]
    );

    // Invalidate the Redis cache so subsequent reads fetch the new value
    await redis.del(`${CACHE_PREFIX}${key}`);

    const newValue = parseValue(newValueStr, row.data_type);

    return { key, oldValue, newValue };
  } catch (err) {
    console.error('[platformConfig] Error updating config key:', key, err.message);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// getGovernableParams
// ---------------------------------------------------------------------------

/**
 * Return all governable configuration parameters, grouped by category.
 *
 * @returns {Promise<Object>} An object keyed by category, each containing
 *   an array of { key, value, dataType, description, category }.
 */
export async function getGovernableParams() {
  try {
    const result = await query(
      `SELECT key, value, data_type, description, category
       FROM platform_config
       WHERE governable = true
       ORDER BY category, key`
    );

    const grouped = {};

    for (const row of result.rows) {
      const category = row.category || 'uncategorized';

      if (!grouped[category]) {
        grouped[category] = [];
      }

      grouped[category].push({
        key: row.key,
        value: parseValue(row.value, row.data_type),
        dataType: row.data_type,
        description: row.description,
        category,
      });
    }

    return grouped;
  } catch (err) {
    console.error('[platformConfig] Error getting governable params:', err.message);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// refreshConfigCache
// ---------------------------------------------------------------------------

/**
 * Load every config entry from the database into Redis.
 *
 * Intended to be called at application startup so that subsequent
 * {@link getConfig} calls are served from cache.
 *
 * @returns {Promise<number>} The number of config entries cached
 */
export async function refreshConfigCache() {
  try {
    const result = await query(
      'SELECT key, value, data_type FROM platform_config'
    );

    let count = 0;

    for (const row of result.rows) {
      const parsed = parseValue(row.value, row.data_type);

      await redis.set(
        `${CACHE_PREFIX}${row.key}`,
        JSON.stringify({ value: parsed }),
        'EX',
        CACHE_TTL
      );

      count++;
    }

    console.log(`[platformConfig] Cached ${count} config entries in Redis`);
    return count;
  } catch (err) {
    console.error('[platformConfig] Error refreshing config cache:', err.message);
    throw err;
  }
}
