import pg from 'pg';
import env from './env.js';

const { Pool } = pg;

const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

// Log successful connection on first connect
pool.on('connect', () => {
  console.log('[database] New client connected to PostgreSQL');
});

pool.on('error', (err) => {
  console.error('[database] Unexpected error on idle client:', err.message);
});

// Verify the connection on startup
pool
  .query('SELECT NOW()')
  .then(() => {
    console.log('[database] PostgreSQL connection pool established');
  })
  .catch((err) => {
    console.error('[database] Failed to connect to PostgreSQL:', err.message);
  });

/**
 * Execute a SQL query using the connection pool.
 *
 * @param {string} text  - SQL query string
 * @param {Array}  params - parameterised query values
 * @returns {Promise<pg.QueryResult>}
 */
export async function query(text, params) {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    if (env.NODE_ENV === 'development') {
      console.log('[database] query executed', {
        text: text.substring(0, 80),
        duration: `${duration}ms`,
        rows: result.rowCount,
      });
    }
    return result;
  } catch (err) {
    console.error('[database] query error', {
      text: text.substring(0, 80),
      error: err.message,
    });
    throw err;
  }
}

export default pool;
