import { Router } from 'express';
import pool from '../config/database.js';
import redis from '../config/redis.js';
import { activeConnections, activeRides } from './metrics.js';

const router = Router();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const startTime = Date.now();

/**
 * Ping PostgreSQL and measure latency.
 * @returns {{ status: string, latencyMs: number }}
 */
async function checkPostgres() {
  const start = Date.now();
  try {
    const result = await pool.query('SELECT 1 AS ok');
    const latencyMs = Date.now() - start;
    return {
      status: result.rows[0]?.ok === 1 ? 'ok' : 'degraded',
      latencyMs,
    };
  } catch (err) {
    return { status: 'error', latencyMs: Date.now() - start, error: err.message };
  }
}

/**
 * Ping Redis and measure latency.
 * @returns {{ status: string, latencyMs: number }}
 */
async function checkRedis() {
  const start = Date.now();
  try {
    const pong = await redis.ping();
    const latencyMs = Date.now() - start;
    return { status: pong === 'PONG' ? 'ok' : 'degraded', latencyMs };
  } catch (err) {
    return { status: 'error', latencyMs: Date.now() - start, error: err.message };
  }
}

/**
 * Get memory usage details.
 */
function getMemoryUsage() {
  const mem = process.memoryUsage();
  return {
    rss: mem.rss,
    rssMb: Math.round(mem.rss / 1024 / 1024),
    heapTotal: mem.heapTotal,
    heapTotalMb: Math.round(mem.heapTotal / 1024 / 1024),
    heapUsed: mem.heapUsed,
    heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
    external: mem.external,
    arrayBuffers: mem.arrayBuffers,
  };
}

/**
 * Try to get the last successful migration version from the database.
 */
async function getLastMigrationVersion() {
  try {
    const result = await pool.query(
      `SELECT version, name FROM migrations ORDER BY id DESC LIMIT 1`
    );
    if (result.rows.length > 0) {
      return { version: result.rows[0].version, name: result.rows[0].name };
    }
    return { version: 'unknown', name: 'unknown' };
  } catch {
    // Table may not exist yet
    return { version: 'n/a', name: 'migrations table not found' };
  }
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

/**
 * GET /health
 * Simple health check for load balancers.
 * Returns 200 with { status: 'ok' } when core services are reachable,
 * or 503 with { status: 'degraded' } when something is wrong.
 */
router.get('/', async (_req, res) => {
  try {
    const [dbCheck, redisCheck] = await Promise.all([
      checkPostgres(),
      checkRedis(),
    ]);

    const allOk = dbCheck.status === 'ok' && redisCheck.status === 'ok';

    res.status(allOk ? 200 : 503).json({
      status: allOk ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      services: {
        database: dbCheck.status,
        redis: redisCheck.status,
      },
    });
  } catch (err) {
    res.status(503).json({
      status: 'degraded',
      timestamp: new Date().toISOString(),
      error: err.message,
    });
  }
});

/**
 * GET /health/ready
 * Readiness probe — returns 200 only when ALL dependencies are connected
 * and ready to serve traffic. Kubernetes / ECS uses this to decide whether
 * to send traffic to this instance.
 */
router.get('/ready', async (_req, res) => {
  try {
    const [dbCheck, redisCheck] = await Promise.all([
      checkPostgres(),
      checkRedis(),
    ]);

    const ready = dbCheck.status === 'ok' && redisCheck.status === 'ok';

    res.status(ready ? 200 : 503).json({
      ready,
      timestamp: new Date().toISOString(),
      checks: {
        database: dbCheck,
        redis: redisCheck,
      },
    });
  } catch (err) {
    res.status(503).json({
      ready: false,
      timestamp: new Date().toISOString(),
      error: err.message,
    });
  }
});

/**
 * GET /health/live
 * Liveness probe — if the process is running and can handle a request
 * this returns 200. If this fails, the orchestrator should restart the pod.
 */
router.get('/live', (_req, res) => {
  res.json({
    alive: true,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    pid: process.pid,
  });
});

/**
 * GET /health/detailed
 * Detailed status for operators / dashboards.
 * Returns latency information for every dependency, memory stats, etc.
 */
router.get('/detailed', async (_req, res) => {
  try {
    const [dbCheck, redisCheck, migration] = await Promise.all([
      checkPostgres(),
      checkRedis(),
      getLastMigrationVersion(),
    ]);

    const memory = getMemoryUsage();
    const uptimeSeconds = process.uptime();

    // Collect pool stats if available
    let poolStats = {};
    try {
      poolStats = {
        totalCount: pool.totalCount,
        idleCount: pool.idleCount,
        waitingCount: pool.waitingCount,
      };
    } catch {
      // pg pool may not expose these in all versions
    }

    const overallStatus =
      dbCheck.status === 'ok' && redisCheck.status === 'ok'
        ? 'ok'
        : 'degraded';

    res.status(overallStatus === 'ok' ? 200 : 503).json({
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      uptime: {
        seconds: Math.floor(uptimeSeconds),
        human: formatUptime(uptimeSeconds),
        startedAt: new Date(startTime).toISOString(),
      },
      dependencies: {
        database: {
          ...dbCheck,
          pool: poolStats,
        },
        redis: redisCheck,
      },
      memory,
      migration,
      connections: {
        websocket: await getGaugeValue(activeConnections),
      },
      rides: {
        active: await getGaugeValue(activeRides),
      },
      node: {
        version: process.version,
        platform: process.platform,
        arch: process.arch,
        pid: process.pid,
      },
    });
  } catch (err) {
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: err.message,
    });
  }
});

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/**
 * Safely get a gauge value.
 */
async function getGaugeValue(gauge) {
  try {
    const metric = await gauge.get();
    if (metric.values && metric.values.length > 0) {
      return metric.values[0].value;
    }
    return 0;
  } catch {
    return 0;
  }
}

/**
 * Format seconds to a human-readable string.
 */
function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(' ');
}

export default router;
