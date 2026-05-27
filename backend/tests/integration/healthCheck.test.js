/**
 * Integration tests for the health check endpoints.
 *
 * These tests create a minimal Express app with just the health check router
 * and metrics endpoint to verify HTTP responses without needing a full server
 * boot or database connection.
 *
 * The health check router imports pool and redis, which will fail to connect.
 * We mock the database and redis modules to isolate the tests.
 */

import { jest } from '@jest/globals';

// Mock the database module
jest.unstable_mockModule('../../src/config/database.js', () => ({
  default: {
    query: jest.fn(),
    totalCount: 5,
    idleCount: 3,
    waitingCount: 0,
    end: jest.fn(),
  },
  query: jest.fn(),
}));

// Mock redis module
jest.unstable_mockModule('../../src/config/redis.js', () => ({
  default: {
    ping: jest.fn(),
    quit: jest.fn(),
  },
}));

// Mock the metrics module to provide activeConnections and activeRides gauges
jest.unstable_mockModule('../../src/middleware/metrics.js', () => ({
  activeConnections: {
    get: jest.fn().mockResolvedValue({ values: [{ value: 10 }] }),
  },
  activeRides: {
    get: jest.fn().mockResolvedValue({ values: [{ value: 3 }] }),
  },
  metricsMiddleware: (_req, _res, next) => next(),
  metricsEndpoint: jest.fn(),
}));

const pool = (await import('../../src/config/database.js')).default;
const redis = (await import('../../src/config/redis.js')).default;

// Now import the health check router (it will use the mocked modules)
const healthCheckRouter = (await import('../../src/middleware/healthCheck.js')).default;

// Use supertest with a mini Express app
const express = (await import('express')).default;
const request = (await import('supertest')).default;

function createApp() {
  const app = express();
  app.use('/health', healthCheckRouter);
  return app;
}

describe('GET /health', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns 200 when database and redis are healthy', async () => {
    pool.query.mockResolvedValue({ rows: [{ ok: 1 }] });
    redis.ping.mockResolvedValue('PONG');

    const app = createApp();
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body).toHaveProperty('timestamp');
    expect(res.body.services.database).toBe('ok');
    expect(res.body.services.redis).toBe('ok');
  });

  test('returns 503 when database is down', async () => {
    pool.query.mockRejectedValue(new Error('ECONNREFUSED'));
    redis.ping.mockResolvedValue('PONG');

    const app = createApp();
    const res = await request(app).get('/health');

    expect(res.status).toBe(503);
    expect(res.body.status).toBe('degraded');
    expect(res.body.services.database).toBe('error');
    expect(res.body.services.redis).toBe('ok');
  });

  test('returns 503 when redis is down', async () => {
    pool.query.mockResolvedValue({ rows: [{ ok: 1 }] });
    redis.ping.mockRejectedValue(new Error('Redis connection refused'));

    const app = createApp();
    const res = await request(app).get('/health');

    expect(res.status).toBe(503);
    expect(res.body.status).toBe('degraded');
    expect(res.body.services.database).toBe('ok');
    expect(res.body.services.redis).toBe('error');
  });

  test('returns 503 when both are down', async () => {
    pool.query.mockRejectedValue(new Error('DB down'));
    redis.ping.mockRejectedValue(new Error('Redis down'));

    const app = createApp();
    const res = await request(app).get('/health');

    expect(res.status).toBe(503);
    expect(res.body.status).toBe('degraded');
  });
});

describe('GET /health/live', () => {
  test('returns 200 with liveness info', async () => {
    const app = createApp();
    const res = await request(app).get('/health/live');

    expect(res.status).toBe(200);
    expect(res.body.alive).toBe(true);
    expect(res.body).toHaveProperty('timestamp');
    expect(res.body).toHaveProperty('uptime');
    expect(typeof res.body.uptime).toBe('number');
    expect(res.body).toHaveProperty('pid');
    expect(typeof res.body.pid).toBe('number');
  });

  test('liveness does not depend on database or redis', async () => {
    // Don't mock pool/redis at all — liveness should not call them
    pool.query.mockClear();
    redis.ping.mockClear();

    const app = createApp();
    const res = await request(app).get('/health/live');

    expect(res.status).toBe(200);
    expect(pool.query).not.toHaveBeenCalled();
    expect(redis.ping).not.toHaveBeenCalled();
  });
});

describe('GET /health/ready', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns 200 when all services are ready', async () => {
    pool.query.mockResolvedValue({ rows: [{ ok: 1 }] });
    redis.ping.mockResolvedValue('PONG');

    const app = createApp();
    const res = await request(app).get('/health/ready');

    expect(res.status).toBe(200);
    expect(res.body.ready).toBe(true);
    expect(res.body.checks.database.status).toBe('ok');
    expect(res.body.checks.redis.status).toBe('ok');
  });

  test('returns 503 when not ready', async () => {
    pool.query.mockRejectedValue(new Error('not ready'));
    redis.ping.mockResolvedValue('PONG');

    const app = createApp();
    const res = await request(app).get('/health/ready');

    expect(res.status).toBe(503);
    expect(res.body.ready).toBe(false);
  });
});
