/**
 * Unit tests for src/middleware/security.js
 *
 * Tests the individual security middleware functions that can be tested
 * without a full Express app or database connection.
 */

import { jest } from '@jest/globals';

const {
  sanitizeRequestBody,
  sqlInjectionDetector,
  bruteForceProtection,
  csrfProtection,
  securityHeaders,
  corsOriginValidator,
  routeBodySizeLimit,
  MAX_LOGIN_ATTEMPTS,
  SQL_INJECTION_PATTERNS,
} = await import('../../src/middleware/security.js');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockReq(overrides = {}) {
  return {
    headers: {},
    body: null,
    query: {},
    path: '/',
    originalUrl: '/',
    method: 'GET',
    ip: '127.0.0.1',
    cookies: {},
    ...overrides,
  };
}

function mockRes() {
  const res = {
    _headers: {},
    _statusCode: 200,
    _body: null,
    setHeader: jest.fn((name, value) => {
      res._headers[name] = value;
    }),
    removeHeader: jest.fn((name) => {
      delete res._headers[name];
    }),
    getHeader: jest.fn((name) => res._headers[name]),
    status: jest.fn((code) => {
      res._statusCode = code;
      return res;
    }),
    json: jest.fn((body) => {
      res._body = body;
      return res;
    }),
    cookie: jest.fn(),
  };
  return res;
}

// ---------------------------------------------------------------------------
// sanitizeRequestBody
// ---------------------------------------------------------------------------
describe('sanitizeRequestBody', () => {
  test('strips HTML tags from string values', () => {
    const req = mockReq({
      body: {
        name: '<script>alert("xss")</script>John',
        bio: 'Hello <b>World</b>',
      },
    });
    const res = mockRes();
    const next = jest.fn();

    sanitizeRequestBody(req, res, next);

    expect(req.body.name).toBe('alert("xss")John');
    expect(req.body.bio).toBe('Hello World');
    expect(next).toHaveBeenCalled();
  });

  test('strips nested HTML tags in objects', () => {
    const req = mockReq({
      body: {
        user: {
          name: '<img src=x onerror=alert(1)>Test',
          address: {
            street: '123 <div>Main</div> St',
          },
        },
      },
    });
    const res = mockRes();
    const next = jest.fn();

    sanitizeRequestBody(req, res, next);

    expect(req.body.user.name).toBe('Test');
    expect(req.body.user.address.street).toBe('123 Main St');
  });

  test('strips HTML from arrays', () => {
    const req = mockReq({
      body: {
        tags: ['<b>bold</b>', '<i>italic</i>', 'plain'],
      },
    });
    const res = mockRes();
    const next = jest.fn();

    sanitizeRequestBody(req, res, next);

    expect(req.body.tags).toEqual(['bold', 'italic', 'plain']);
  });

  test('preserves non-string values', () => {
    const req = mockReq({
      body: {
        count: 42,
        active: true,
        score: 3.14,
        nothing: null,
      },
    });
    const res = mockRes();
    const next = jest.fn();

    sanitizeRequestBody(req, res, next);

    expect(req.body.count).toBe(42);
    expect(req.body.active).toBe(true);
    expect(req.body.score).toBe(3.14);
    expect(req.body.nothing).toBeNull();
  });

  test('handles empty body gracefully', () => {
    const req = mockReq({ body: null });
    const res = mockRes();
    const next = jest.fn();

    sanitizeRequestBody(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('handles undefined body gracefully', () => {
    const req = mockReq({ body: undefined });
    const res = mockRes();
    const next = jest.fn();

    sanitizeRequestBody(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// sqlInjectionDetector
// ---------------------------------------------------------------------------
describe('sqlInjectionDetector', () => {
  let warnSpy;

  beforeEach(() => {
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  test('detects SELECT injection pattern', () => {
    const req = mockReq({
      query: { search: "' OR SELECT * FROM users --" },
    });
    const res = mockRes();
    const next = jest.fn();

    sqlInjectionDetector(req, res, next);

    expect(warnSpy).toHaveBeenCalled();
    expect(warnSpy.mock.calls[0][0]).toContain('SQL injection');
    expect(next).toHaveBeenCalled(); // Does not block
  });

  test('detects DROP TABLE pattern', () => {
    const req = mockReq({
      query: { id: "1; DROP TABLE users" },
    });
    const res = mockRes();
    const next = jest.fn();

    sqlInjectionDetector(req, res, next);

    expect(warnSpy).toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });

  test('detects UNION ALL SELECT pattern', () => {
    const req = mockReq({
      query: { page: "1 UNION ALL SELECT password FROM users" },
    });
    const res = mockRes();
    const next = jest.fn();

    sqlInjectionDetector(req, res, next);

    expect(warnSpy).toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });

  test('detects OR 1=1 pattern', () => {
    const req = mockReq({
      query: { username: "admin' OR 1=1 --" },
    });
    const res = mockRes();
    const next = jest.fn();

    sqlInjectionDetector(req, res, next);

    expect(warnSpy).toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });

  test('detects SQL comment patterns', () => {
    const req = mockReq({
      query: { q: "value -- comment" },
    });
    const res = mockRes();
    const next = jest.fn();

    sqlInjectionDetector(req, res, next);

    expect(warnSpy).toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });

  test('detects SLEEP injection (time-based)', () => {
    const req = mockReq({
      query: { id: "1 AND SLEEP(5)" },
    });
    const res = mockRes();
    const next = jest.fn();

    sqlInjectionDetector(req, res, next);

    expect(warnSpy).toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });

  test('does NOT flag normal query parameters', () => {
    const req = mockReq({
      query: { search: 'coffee shop', page: '2', limit: '10' },
    });
    const res = mockRes();
    const next = jest.fn();

    sqlInjectionDetector(req, res, next);

    expect(warnSpy).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });

  test('does NOT flag empty query object', () => {
    const req = mockReq({ query: {} });
    const res = mockRes();
    const next = jest.fn();

    sqlInjectionDetector(req, res, next);

    expect(warnSpy).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });

  test('ignores non-string query values', () => {
    const req = mockReq({
      query: { limit: 10, active: true },
    });
    const res = mockRes();
    const next = jest.fn();

    sqlInjectionDetector(req, res, next);

    expect(warnSpy).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });

  test('SQL_INJECTION_PATTERNS is exported and is an array', () => {
    expect(Array.isArray(SQL_INJECTION_PATTERNS)).toBe(true);
    expect(SQL_INJECTION_PATTERNS.length).toBeGreaterThan(0);
    // Each should be a RegExp
    for (const pattern of SQL_INJECTION_PATTERNS) {
      expect(pattern).toBeInstanceOf(RegExp);
    }
  });
});

// ---------------------------------------------------------------------------
// bruteForceProtection
// ---------------------------------------------------------------------------
describe('bruteForceProtection', () => {
  test('allows first login attempt', () => {
    const req = mockReq({
      path: '/login',
      method: 'POST',
      body: { email: 'user@test.com' },
      ip: '10.0.0.1',
    });
    const res = mockRes();
    const next = jest.fn();

    bruteForceProtection(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.bruteForce).toBeDefined();
    expect(typeof req.bruteForce.recordFailure).toBe('function');
    expect(typeof req.bruteForce.resetAttempts).toBe('function');
  });

  test('locks out after MAX_LOGIN_ATTEMPTS failures', () => {
    const email = `lockout-${Date.now()}@test.com`;
    const ip = '10.0.0.99';

    // Simulate MAX_LOGIN_ATTEMPTS failures
    for (let i = 0; i < MAX_LOGIN_ATTEMPTS; i++) {
      const req = mockReq({
        path: '/login',
        method: 'POST',
        body: { email },
        ip,
      });
      const res = mockRes();
      const next = jest.fn();

      bruteForceProtection(req, res, next);

      if (next.mock.calls.length > 0) {
        // Record failure
        req.bruteForce.recordFailure();
      }
    }

    // The next attempt should be locked out
    const lockedReq = mockReq({
      path: '/login',
      method: 'POST',
      body: { email },
      ip,
    });
    const lockedRes = mockRes();
    const lockedNext = jest.fn();

    bruteForceProtection(lockedReq, lockedRes, lockedNext);

    expect(lockedNext).not.toHaveBeenCalled();
    expect(lockedRes.status).toHaveBeenCalledWith(429);
    expect(lockedRes.json).toHaveBeenCalled();
    expect(lockedRes._body.error).toContain('Too many failed attempts');
  });

  test('resets attempts on successful login', () => {
    const email = `reset-${Date.now()}@test.com`;
    const ip = '10.0.0.100';

    // Record a few failures
    for (let i = 0; i < 3; i++) {
      const req = mockReq({
        path: '/login',
        method: 'POST',
        body: { email },
        ip,
      });
      const res = mockRes();
      const next = jest.fn();

      bruteForceProtection(req, res, next);
      req.bruteForce.recordFailure();
    }

    // Now reset (simulate successful login)
    {
      const req = mockReq({
        path: '/login',
        method: 'POST',
        body: { email },
        ip,
      });
      const res = mockRes();
      const next = jest.fn();

      bruteForceProtection(req, res, next);
      req.bruteForce.resetAttempts();
    }

    // Should be able to try again (no lockout)
    const req = mockReq({
      path: '/login',
      method: 'POST',
      body: { email },
      ip,
    });
    const res = mockRes();
    const next = jest.fn();

    bruteForceProtection(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('skips non-login paths', () => {
    const req = mockReq({
      path: '/register',
      method: 'POST',
      body: { email: 'user@test.com' },
    });
    const res = mockRes();
    const next = jest.fn();

    bruteForceProtection(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.bruteForce).toBeUndefined();
  });

  test('skips non-POST requests', () => {
    const req = mockReq({
      path: '/login',
      method: 'GET',
    });
    const res = mockRes();
    const next = jest.fn();

    bruteForceProtection(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('skips when no email in body', () => {
    const req = mockReq({
      path: '/login',
      method: 'POST',
      body: {},
    });
    const res = mockRes();
    const next = jest.fn();

    bruteForceProtection(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// csrfProtection
// ---------------------------------------------------------------------------
describe('csrfProtection', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  test('skips in non-production environment', () => {
    process.env.NODE_ENV = 'development';
    const req = mockReq({ method: 'POST', originalUrl: '/api/v1/rides' });
    const res = mockRes();
    const next = jest.fn();

    csrfProtection(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('skips in test environment', () => {
    process.env.NODE_ENV = 'test';
    const req = mockReq({ method: 'POST', originalUrl: '/api/v1/rides' });
    const res = mockRes();
    const next = jest.fn();

    csrfProtection(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('skips exempt paths in production', () => {
    process.env.NODE_ENV = 'production';

    const exemptPaths = [
      '/api/v1/auth/login',
      '/api/v1/auth/register',
      '/api/v1/auth/refresh',
      '/api/v1/payments/webhook',
      '/health',
    ];

    for (const path of exemptPaths) {
      const req = mockReq({ method: 'POST', originalUrl: path });
      const res = mockRes();
      const next = jest.fn();

      csrfProtection(req, res, next);
      expect(next).toHaveBeenCalled();
    }
  });

  test('rejects POST without CSRF token in production', () => {
    process.env.NODE_ENV = 'production';
    const req = mockReq({
      method: 'POST',
      originalUrl: '/api/v1/rides',
      cookies: {},
      headers: {},
    });
    const res = mockRes();
    const next = jest.fn();

    csrfProtection(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res._body.error).toContain('CSRF');
  });

  test('accepts matching CSRF tokens in production', () => {
    process.env.NODE_ENV = 'production';
    const token = 'abc123def456';
    const req = mockReq({
      method: 'POST',
      originalUrl: '/api/v1/rides',
      cookies: { _csrf_token: token },
      headers: { 'x-csrf-token': token },
    });
    const res = mockRes();
    const next = jest.fn();

    csrfProtection(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('rejects mismatched CSRF tokens in production', () => {
    process.env.NODE_ENV = 'production';
    const req = mockReq({
      method: 'POST',
      originalUrl: '/api/v1/rides',
      cookies: { _csrf_token: 'token-a' },
      headers: { 'x-csrf-token': 'token-b' },
    });
    const res = mockRes();
    const next = jest.fn();

    csrfProtection(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('sets CSRF cookie on GET request in production if not present', () => {
    process.env.NODE_ENV = 'production';
    const req = mockReq({
      method: 'GET',
      originalUrl: '/api/v1/rides',
      cookies: {},
    });
    const res = mockRes();
    const next = jest.fn();

    csrfProtection(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.cookie).toHaveBeenCalled();
    const cookieCall = res.cookie.mock.calls[0];
    expect(cookieCall[0]).toBe('_csrf_token');
    expect(typeof cookieCall[1]).toBe('string');
    expect(cookieCall[1].length).toBe(64); // 32 random bytes -> 64 hex chars
  });
});

// ---------------------------------------------------------------------------
// securityHeaders
// ---------------------------------------------------------------------------
describe('securityHeaders', () => {
  test('sets Permissions-Policy header', () => {
    const req = mockReq({ path: '/api/v1/test' });
    const res = mockRes();
    const next = jest.fn();

    securityHeaders(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith(
      'Permissions-Policy',
      expect.stringContaining('camera=()'),
    );
    expect(next).toHaveBeenCalled();
  });

  test('sets X-Content-Type-Options to nosniff', () => {
    const req = mockReq({ path: '/test' });
    const res = mockRes();
    const next = jest.fn();

    securityHeaders(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
  });

  test('sets X-Frame-Options to DENY', () => {
    const req = mockReq({ path: '/test' });
    const res = mockRes();
    const next = jest.fn();

    securityHeaders(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith('X-Frame-Options', 'DENY');
  });

  test('sets Cache-Control for API paths', () => {
    const req = mockReq({ path: '/api/v1/users' });
    const res = mockRes();
    const next = jest.fn();

    securityHeaders(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith(
      'Cache-Control',
      expect.stringContaining('no-store'),
    );
    expect(res.setHeader).toHaveBeenCalledWith('Pragma', 'no-cache');
  });

  test('does NOT set Cache-Control for non-API paths', () => {
    const req = mockReq({ path: '/health' });
    const res = mockRes();
    const next = jest.fn();

    securityHeaders(req, res, next);

    const cacheControlCalls = res.setHeader.mock.calls.filter(
      (c) => c[0] === 'Cache-Control'
    );
    expect(cacheControlCalls.length).toBe(0);
  });

  test('removes X-Powered-By header', () => {
    const req = mockReq({ path: '/test' });
    const res = mockRes();
    const next = jest.fn();

    securityHeaders(req, res, next);

    expect(res.removeHeader).toHaveBeenCalledWith('X-Powered-By');
  });
});

// ---------------------------------------------------------------------------
// corsOriginValidator
// ---------------------------------------------------------------------------
describe('corsOriginValidator', () => {
  test('allows requests with no origin (mobile apps, curl)', () => {
    const validator = corsOriginValidator('production');
    const callback = jest.fn();
    validator(undefined, callback);
    expect(callback).toHaveBeenCalledWith(null, true);
  });

  test('allows whitelisted origins in production', () => {
    const validator = corsOriginValidator('production');
    const callback = jest.fn();
    validator('https://openride.community', callback);
    expect(callback).toHaveBeenCalledWith(null, true);
  });

  test('blocks non-whitelisted origins in production', () => {
    const validator = corsOriginValidator('production');
    const callback = jest.fn();

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    validator('https://evil.example.com', callback);
    warnSpy.mockRestore();

    expect(callback).toHaveBeenCalledWith(expect.any(Error), false);
  });

  test('allows any origin in development', () => {
    const validator = corsOriginValidator('development');
    const callback = jest.fn();
    validator('http://localhost:3000', callback);
    expect(callback).toHaveBeenCalledWith(null, true);
  });

  test('allows any origin in test', () => {
    const validator = corsOriginValidator('test');
    const callback = jest.fn();
    validator('http://anything.com', callback);
    expect(callback).toHaveBeenCalledWith(null, true);
  });
});

// ---------------------------------------------------------------------------
// routeBodySizeLimit
// ---------------------------------------------------------------------------
describe('routeBodySizeLimit', () => {
  test('allows small body on login route', () => {
    const req = mockReq({
      method: 'POST',
      originalUrl: '/api/v1/auth/login',
      body: { email: 'a@b.com', password: 'x' },
      headers: { 'content-length': '50' },
    });
    const res = mockRes();
    const next = jest.fn();

    routeBodySizeLimit(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('rejects oversized body on login route', () => {
    const req = mockReq({
      method: 'POST',
      originalUrl: '/api/v1/auth/login',
      body: { data: 'x'.repeat(2000) },
      headers: { 'content-length': '2048' },
    });
    const res = mockRes();
    const next = jest.fn();

    routeBodySizeLimit(req, res, next);
    expect(res.status).toHaveBeenCalledWith(413);
    expect(res._body.error).toContain('Payload too large');
  });

  test('skips GET requests', () => {
    const req = mockReq({
      method: 'GET',
      originalUrl: '/api/v1/users',
    });
    const res = mockRes();
    const next = jest.fn();

    routeBodySizeLimit(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('skips requests with no body', () => {
    const req = mockReq({
      method: 'POST',
      originalUrl: '/api/v1/auth/login',
      body: null,
    });
    const res = mockRes();
    const next = jest.fn();

    routeBodySizeLimit(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});
