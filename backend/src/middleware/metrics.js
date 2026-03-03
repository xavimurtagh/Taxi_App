import client from 'prom-client';

// ---------------------------------------------------------------------------
// Registry & default metrics
// ---------------------------------------------------------------------------
const register = new client.Registry();

// Add default Node.js metrics (memory, CPU, event loop lag, GC, etc.)
client.collectDefaultMetrics({
  register,
  prefix: 'openride_',
  labels: { service: 'openride-api' },
});

// ---------------------------------------------------------------------------
// Custom metrics
// ---------------------------------------------------------------------------

// HTTP metrics
export const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

export const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
});

export const httpRequestSize = new client.Histogram({
  name: 'http_request_size_bytes',
  help: 'Size of HTTP request bodies in bytes',
  buckets: [100, 500, 1000, 5000, 10000, 50000, 100000, 500000, 1000000],
  registers: [register],
});

export const httpResponseSize = new client.Histogram({
  name: 'http_response_size_bytes',
  help: 'Size of HTTP response bodies in bytes',
  buckets: [100, 500, 1000, 5000, 10000, 50000, 100000, 500000, 1000000],
  registers: [register],
});

// WebSocket / connection metrics
export const activeConnections = new client.Gauge({
  name: 'active_connections',
  help: 'Number of currently active WebSocket connections',
  registers: [register],
});

// Ride metrics
export const activeRides = new client.Gauge({
  name: 'active_rides',
  help: 'Number of rides currently in progress',
  registers: [register],
});

export const rideRequestsTotal = new client.Counter({
  name: 'ride_requests_total',
  help: 'Total number of ride requests',
  labelNames: ['status'],
  registers: [register],
});

export const rideDuration = new client.Histogram({
  name: 'ride_duration_seconds',
  help: 'Duration of completed rides in seconds',
  buckets: [60, 120, 300, 600, 900, 1200, 1800, 2700, 3600, 5400, 7200],
  registers: [register],
});

export const driverMatchingDuration = new client.Histogram({
  name: 'driver_matching_duration_seconds',
  help: 'Time to match a driver in seconds',
  buckets: [1, 2, 5, 10, 15, 20, 30, 45, 60, 90, 120],
  registers: [register],
});

// Payment metrics
export const paymentTransactionsTotal = new client.Counter({
  name: 'payment_transactions_total',
  help: 'Total number of payment transactions',
  labelNames: ['status', 'type'],
  registers: [register],
});

// Database metrics
export const databaseQueryDuration = new client.Histogram({
  name: 'database_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['operation'],
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [register],
});

// Redis metrics
export const redisOperationsTotal = new client.Counter({
  name: 'redis_operations_total',
  help: 'Total number of Redis operations',
  labelNames: ['operation', 'status'],
  registers: [register],
});

// ---------------------------------------------------------------------------
// Helper functions for use in other services
// ---------------------------------------------------------------------------

/**
 * Record an HTTP request metric (typically called from middleware).
 */
export function recordHttpRequest(method, route, statusCode, durationSec) {
  httpRequestsTotal.inc({ method, route, status_code: statusCode });
  httpRequestDuration.observe({ method, route }, durationSec);
}

/**
 * Record a ride request outcome.
 * @param {'matched'|'no_driver'|'cancelled'} status
 */
export function recordRideRequest(status) {
  rideRequestsTotal.inc({ status });
}

/**
 * Record the duration of a completed ride.
 * @param {number} seconds
 */
export function recordRideDuration(seconds) {
  rideDuration.observe(seconds);
}

/**
 * Record how long it took to match a driver.
 * @param {number} seconds
 */
export function recordDriverMatchingDuration(seconds) {
  driverMatchingDuration.observe(seconds);
}

/**
 * Record a payment transaction.
 * @param {'success'|'failure'|'refund'} status
 * @param {'charge'|'payout'|'refund'} type
 */
export function recordPaymentTransaction(status, type) {
  paymentTransactionsTotal.inc({ status, type });
}

/**
 * Record a database query duration.
 * @param {string} operation  - e.g. 'select', 'insert', 'update', 'delete'
 * @param {number} seconds
 */
export function recordDbQuery(operation, seconds) {
  databaseQueryDuration.observe({ operation }, seconds);
}

/**
 * Record a Redis operation.
 * @param {string} operation - e.g. 'get', 'set', 'del'
 * @param {'success'|'error'} status
 */
export function recordRedisOp(operation, status) {
  redisOperationsTotal.inc({ operation, status });
}

/**
 * Set the current number of active WebSocket connections.
 * @param {number} count
 */
export function setActiveConnections(count) {
  activeConnections.set(count);
}

/**
 * Set the current number of active rides.
 * @param {number} count
 */
export function setActiveRides(count) {
  activeRides.set(count);
}

// ---------------------------------------------------------------------------
// Metrics collection middleware
// ---------------------------------------------------------------------------

/**
 * Express middleware that records request duration, size, etc.
 * Mount this early in the middleware chain (after requestId, before routes).
 */
export function metricsMiddleware(req, res, next) {
  const start = process.hrtime.bigint();

  // Record request size
  const reqSize = parseInt(req.headers['content-length'] || '0', 10);
  if (reqSize > 0) {
    httpRequestSize.observe(reqSize);
  }

  // Capture the original end to measure response
  const originalEnd = res.end;
  res.end = function (...args) {
    // Compute duration
    const durationNs = Number(process.hrtime.bigint() - start);
    const durationSec = durationNs / 1e9;

    // Normalise route — prefer Express matched route over raw URL
    const route = req.route?.path
      ? `${req.baseUrl || ''}${req.route.path}`
      : req.path || 'unknown';

    const method = req.method;
    const statusCode = res.statusCode;

    // Record metrics
    httpRequestsTotal.inc({ method, route, status_code: statusCode });
    httpRequestDuration.observe({ method, route }, durationSec);

    // Record response size
    const resSize = parseInt(res.getHeader('content-length') || '0', 10);
    if (resSize > 0) {
      httpResponseSize.observe(resSize);
    }

    // Call the original end
    return originalEnd.apply(this, args);
  };

  next();
}

// ---------------------------------------------------------------------------
// /metrics endpoint handler
// ---------------------------------------------------------------------------

/**
 * Express route handler that serves Prometheus-format metrics.
 * Mount this OUTSIDE the rate limiter:
 *   app.get('/metrics', metricsEndpoint);
 */
export async function metricsEndpoint(_req, res) {
  try {
    res.set('Content-Type', register.contentType);
    const metrics = await register.metrics();
    res.end(metrics);
  } catch (err) {
    res.status(500).end(err.message);
  }
}

export { register };
export default metricsMiddleware;
