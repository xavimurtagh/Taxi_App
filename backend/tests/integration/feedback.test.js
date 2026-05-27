/**
 * Integration tests for the feedback API routes.
 *
 * We mock the database query function and the auth middleware to test
 * the route logic without a real database or JWT infrastructure.
 */

import { jest } from '@jest/globals';

// Mock the database module
const mockQuery = jest.fn();
jest.unstable_mockModule('../../src/config/database.js', () => ({
  default: {
    query: mockQuery,
    end: jest.fn(),
  },
  query: mockQuery,
}));

// Mock the auth middleware to inject a fake user
jest.unstable_mockModule('../../src/middleware/auth.js', () => ({
  authenticate: (req, _res, next) => {
    req.user = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      email: 'test@example.com',
      role: 'passenger',
    };
    next();
  },
}));

// Now dynamically import the modules that depend on the mocks
const feedbackRouter = (await import('../../src/routes/feedback.js')).default;
const express = (await import('express')).default;
const request = (await import('supertest')).default;

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/feedback', feedbackRouter);
  return app;
}

describe('POST /api/v1/feedback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('validates required field: type', async () => {
    const app = createApp();

    const res = await request(app)
      .post('/api/v1/feedback')
      .send({
        title: 'Test Feedback',
        description: 'Test description here',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
    expect(res.body.message).toContain('Type is required');
  });

  test('validates required field: title', async () => {
    const app = createApp();

    const res = await request(app)
      .post('/api/v1/feedback')
      .send({
        type: 'bug',
        description: 'Test description here',
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('Title is required');
  });

  test('validates required field: description', async () => {
    const app = createApp();

    const res = await request(app)
      .post('/api/v1/feedback')
      .send({
        type: 'bug',
        title: 'Test Title',
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('Description is required');
  });

  test('rejects invalid feedback type', async () => {
    const app = createApp();

    const res = await request(app)
      .post('/api/v1/feedback')
      .send({
        type: 'invalid_type',
        title: 'Test Title',
        description: 'Test description',
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('Type must be one of');
  });

  test('accepts valid feedback types', async () => {
    const validTypes = ['bug', 'feature_request', 'ux_feedback', 'general'];

    for (const type of validTypes) {
      mockQuery.mockResolvedValue({
        rows: [{
          id: 1,
          user_id: '550e8400-e29b-41d4-a716-446655440000',
          type,
          title: 'Test',
          description: 'Test desc',
          severity: 'medium',
          status: 'new',
          app_version: null,
          platform: null,
          device_info: '{}',
          screenshot_urls: null,
          metadata: '{}',
          created_at: new Date().toISOString(),
        }],
      });

      const app = createApp();
      const res = await request(app)
        .post('/api/v1/feedback')
        .send({
          type,
          title: 'Test Feedback',
          description: 'This is valid feedback',
        });

      expect(res.status).toBe(201);
      expect(res.body.feedback).toBeDefined();
      expect(res.body.feedback.type).toBe(type);
    }
  });

  test('creates feedback with all fields', async () => {
    mockQuery.mockResolvedValue({
      rows: [{
        id: 42,
        user_id: '550e8400-e29b-41d4-a716-446655440000',
        type: 'bug',
        title: 'App crashes on login',
        description: 'The app crashes when I try to log in with Google',
        severity: 'critical',
        status: 'new',
        app_version: '1.2.3',
        platform: 'ios',
        device_info: '{"model":"iPhone 15"}',
        screenshot_urls: null,
        metadata: '{}',
        created_at: '2024-01-01T00:00:00.000Z',
      }],
    });

    const app = createApp();
    const res = await request(app)
      .post('/api/v1/feedback')
      .send({
        type: 'bug',
        title: 'App crashes on login',
        description: 'The app crashes when I try to log in with Google',
        severity: 'critical',
        app_version: '1.2.3',
        platform: 'ios',
        device_info: { model: 'iPhone 15' },
      });

    expect(res.status).toBe(201);
    expect(res.body.feedback.type).toBe('bug');
    expect(res.body.feedback.title).toBe('App crashes on login');
    expect(res.body.feedback.severity).toBe('critical');

    // Verify the query was called with correct parameters
    expect(mockQuery).toHaveBeenCalledTimes(1);
    const queryArgs = mockQuery.mock.calls[0];
    expect(queryArgs[0]).toContain('INSERT INTO beta_feedback');
    // First param should be the user ID
    expect(queryArgs[1][0]).toBe('550e8400-e29b-41d4-a716-446655440000');
  });

  test('handles database errors gracefully', async () => {
    mockQuery.mockRejectedValue(new Error('Database connection failed'));

    const app = createApp();

    // Suppress console.error during this test
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const res = await request(app)
      .post('/api/v1/feedback')
      .send({
        type: 'bug',
        title: 'Test',
        description: 'Test desc',
      });

    consoleSpy.mockRestore();

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Internal server error');
  });
});

describe('GET /api/v1/feedback/stats', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns aggregate stats shape', async () => {
    // Mock 4 sequential queries for stats
    mockQuery
      .mockResolvedValueOnce({ rows: [{ total: '15' }] }) // total
      .mockResolvedValueOnce({
        rows: [
          { type: 'bug', count: '8' },
          { type: 'feature_request', count: '5' },
          { type: 'general', count: '2' },
        ],
      }) // byType
      .mockResolvedValueOnce({
        rows: [
          { status: 'new', count: '10' },
          { status: 'resolved', count: '5' },
        ],
      }) // byStatus
      .mockResolvedValueOnce({
        rows: [
          { severity: 'medium', count: '8' },
          { severity: 'critical', count: '4' },
          { severity: 'low', count: '3' },
        ],
      }); // bySeverity

    const app = createApp();
    const res = await request(app).get('/api/v1/feedback/stats');

    expect(res.status).toBe(200);
    expect(res.body.stats).toBeDefined();
    expect(res.body.stats.total).toBe(15);
    expect(res.body.stats.byType).toEqual({
      bug: 8,
      feature_request: 5,
      general: 2,
    });
    expect(res.body.stats.byStatus).toEqual({
      new: 10,
      resolved: 5,
    });
    expect(res.body.stats.bySeverity).toEqual({
      medium: 8,
      critical: 4,
      low: 3,
    });
  });

  test('stats endpoint is publicly accessible (no auth required)', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ total: '0' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const app = createApp();
    const res = await request(app).get('/api/v1/feedback/stats');

    // Should return 200, not 401
    expect(res.status).toBe(200);
    expect(res.body.stats.total).toBe(0);
  });

  test('handles database errors in stats', async () => {
    mockQuery.mockRejectedValue(new Error('DB error'));

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const app = createApp();
    const res = await request(app).get('/api/v1/feedback/stats');
    consoleSpy.mockRestore();

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Internal server error');
  });
});
