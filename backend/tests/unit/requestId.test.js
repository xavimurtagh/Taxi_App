/**
 * Unit tests for src/middleware/requestId.js
 *
 * The requestIdMiddleware is a pure Express middleware with no database
 * dependencies — it only depends on the 'uuid' package.
 */

import { jest } from '@jest/globals';

const { requestIdMiddleware } = await import('../../src/middleware/requestId.js');

describe('requestIdMiddleware', () => {
  /**
   * Create a minimal mock request.
   */
  function mockReq(headers = {}) {
    return {
      headers: { ...headers },
    };
  }

  /**
   * Create a minimal mock response with setHeader spy.
   */
  function mockRes() {
    const res = {
      _headers: {},
      setHeader: jest.fn((name, value) => {
        res._headers[name] = value;
      }),
    };
    return res;
  }

  test('generates a UUID when no X-Request-ID header is present', () => {
    const req = mockReq();
    const res = mockRes();
    const next = jest.fn();

    requestIdMiddleware(req, res, next);

    // Should have assigned an ID to req.id
    expect(req.id).toBeDefined();
    expect(typeof req.id).toBe('string');
    // UUID v4 format: 8-4-4-4-12 hex chars
    expect(req.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
    // Should have set the response header
    expect(res.setHeader).toHaveBeenCalledWith('X-Request-ID', req.id);
    // Should call next
    expect(next).toHaveBeenCalledTimes(1);
  });

  test('uses incoming X-Request-ID header when present', () => {
    const req = mockReq({ 'x-request-id': 'my-custom-request-id' });
    const res = mockRes();
    const next = jest.fn();

    requestIdMiddleware(req, res, next);

    expect(req.id).toBe('my-custom-request-id');
    expect(res.setHeader).toHaveBeenCalledWith(
      'X-Request-ID',
      'my-custom-request-id'
    );
    expect(next).toHaveBeenCalledTimes(1);
  });

  test('generates a UUID when X-Request-ID header is empty string', () => {
    const req = mockReq({ 'x-request-id': '' });
    const res = mockRes();
    const next = jest.fn();

    requestIdMiddleware(req, res, next);

    expect(req.id).toBeDefined();
    expect(req.id.length).toBeGreaterThan(0);
    // Should NOT be empty string
    expect(req.id).not.toBe('');
    expect(next).toHaveBeenCalledTimes(1);
  });

  test('generates unique IDs for each request', () => {
    const ids = new Set();
    for (let i = 0; i < 100; i++) {
      const req = mockReq();
      const res = mockRes();
      const next = jest.fn();
      requestIdMiddleware(req, res, next);
      ids.add(req.id);
    }
    // All 100 should be unique
    expect(ids.size).toBe(100);
  });

  test('sets X-Request-ID response header with the same value as req.id', () => {
    const req = mockReq();
    const res = mockRes();
    const next = jest.fn();

    requestIdMiddleware(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith('X-Request-ID', req.id);
  });

  test('always calls next()', () => {
    const req = mockReq();
    const res = mockRes();
    const next = jest.fn();

    requestIdMiddleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    // Should be called with no arguments (not an error)
    expect(next).toHaveBeenCalledWith();
  });

  test('preserves a non-empty incoming request ID string', () => {
    const customId = 'trace-abc-123-xyz';
    const req = mockReq({ 'x-request-id': customId });
    const res = mockRes();
    const next = jest.fn();

    requestIdMiddleware(req, res, next);

    expect(req.id).toBe(customId);
  });
});
