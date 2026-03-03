/**
 * Comprehensive security middleware for OpenRide API.
 *
 * Provides defense-in-depth security hardening beyond what Helmet and
 * express-rate-limit offer out of the box:
 *
 *  - CORS hardening (whitelist specific origins in production)
 *  - Additional security headers (Permissions-Policy, X-Frame-Options, etc.)
 *  - Request body sanitization (strip HTML tags to prevent XSS)
 *  - SQL injection pattern detection (log suspicious query parameters)
 *  - Request body size validation per route
 *  - IP-based rate limiting for auth endpoints (stricter than general)
 *  - Brute force protection for login (lockout after N failed attempts)
 *  - CSRF protection for state-changing operations (double-submit cookie)
 */

import crypto from 'node:crypto';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Allowed origins in production — add your domains here. */
const PRODUCTION_ORIGINS = [
  'https://openride.community',
  'https://www.openride.community',
  'https://app.openride.community',
  'https://admin.openride.community',
];

/** Origins allowed in development (permissive). */
const DEVELOPMENT_ORIGINS = ['*'];

/** Maximum failed login attempts before lockout. */
const MAX_LOGIN_ATTEMPTS = 5;

/** Lockout duration in milliseconds (15 minutes). */
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

/** Route-specific body size limits (in bytes). */
const ROUTE_BODY_LIMITS = {
  '/api/v1/auth/register': 2 * 1024,        // 2 KB
  '/api/v1/auth/login': 1 * 1024,            // 1 KB
  '/api/v1/rides': 4 * 1024,                 // 4 KB
  '/api/v1/ratings': 2 * 1024,               // 2 KB
  '/api/v1/governance/proposals': 16 * 1024,  // 16 KB (proposals can be long)
  '/api/v1/chat': 8 * 1024,                  // 8 KB
  '/api/v1/payments/webhook': 64 * 1024,     // 64 KB (Stripe webhooks)
};

/** Default body size limit for routes not explicitly listed. */
const DEFAULT_BODY_LIMIT = 10 * 1024; // 10 KB

/** CSRF cookie name and header name (double-submit pattern). */
const CSRF_COOKIE_NAME = '_csrf_token';
const CSRF_HEADER_NAME = 'x-csrf-token';

/** HTTP methods that are considered state-changing and need CSRF protection. */
const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Paths exempt from CSRF protection (e.g. auth, webhooks, API-only). */
const CSRF_EXEMPT_PATHS = [
  '/api/v1/auth/login',
  '/api/v1/auth/register',
  '/api/v1/auth/refresh',
  '/api/v1/payments/webhook',
  '/health',
];

// ---------------------------------------------------------------------------
// SQL injection detection patterns
// ---------------------------------------------------------------------------

/**
 * Common SQL injection patterns to detect in query parameters.
 * These are heuristic — not a substitute for parameterized queries, but
 * useful as an alerting layer.
 */
const SQL_INJECTION_PATTERNS = [
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|EXEC|UNION)\b\s)/i,
  /(\b(OR|AND)\b\s+\d+\s*=\s*\d+)/i,
  /(--|#|\/\*)/,
  /('\s*(OR|AND)\s+')/i,
  /(;\s*(DROP|DELETE|INSERT|UPDATE|ALTER))/i,
  /(\bUNION\b\s+\bALL\b\s+\bSELECT\b)/i,
  /(\bSLEEP\s*\()/i,
  /(\bBENCHMARK\s*\()/i,
  /(\bWAITFOR\b\s+\bDELAY\b)/i,
  /(\bLOAD_FILE\s*\()/i,
];

// ---------------------------------------------------------------------------
// In-memory stores (use Redis in clustered production deployments)
// ---------------------------------------------------------------------------

/**
 * Brute force tracker: { [ip:email]: { attempts: number, lockedUntil: number } }
 */
const bruteForceStore = new Map();

/**
 * Clean up expired brute force entries periodically (every 5 minutes).
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of bruteForceStore) {
    if (entry.lockedUntil && entry.lockedUntil < now) {
      bruteForceStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

// ---------------------------------------------------------------------------
// Middleware: Additional Security Headers
// ---------------------------------------------------------------------------

/**
 * Set security headers beyond what Helmet provides by default.
 * Apply this AFTER helmet() in the middleware chain.
 */
export function securityHeaders(req, res, next) {
  // Permissions-Policy: disable sensitive APIs for web clients.
  // Mobile apps handle camera/mic/geo natively; web frontend should not need them.
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()',
  );

  // Prevent MIME-type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');

  // Control referrer information
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Prevent browser from caching sensitive API responses
  if (req.path.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
  }

  // Remove the X-Powered-By header (Helmet may already do this, but be explicit)
  res.removeHeader('X-Powered-By');

  next();
}

// ---------------------------------------------------------------------------
// Middleware: CORS Hardening
// ---------------------------------------------------------------------------

/**
 * Returns a CORS origin validator function based on the current environment.
 *
 * In production, only whitelisted origins are allowed.
 * In development, all origins are permitted for convenience.
 *
 * @param {string} nodeEnv — 'production' | 'development' | 'test'
 * @returns {Function} CORS origin callback
 */
export function corsOriginValidator(nodeEnv) {
  return function validateOrigin(origin, callback) {
    // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
    if (!origin) {
      return callback(null, true);
    }

    if (nodeEnv === 'production') {
      if (PRODUCTION_ORIGINS.includes(origin)) {
        return callback(null, true);
      }
      // Check if the origin matches any custom CORS_ORIGINS env var (comma-separated)
      const customOrigins = process.env.CORS_ORIGINS;
      if (customOrigins) {
        const allowed = customOrigins.split(',').map((s) => s.trim());
        if (allowed.includes(origin)) {
          return callback(null, true);
        }
      }
      console.warn(`[security] CORS: blocked request from origin ${origin}`);
      return callback(new Error('Not allowed by CORS'), false);
    }

    // Non-production: allow all origins
    return callback(null, true);
  };
}

// ---------------------------------------------------------------------------
// Middleware: Request Body Sanitization (XSS Prevention)
// ---------------------------------------------------------------------------

/**
 * Recursively strip HTML tags from all string values in an object.
 * This is a defense-in-depth measure — proper output encoding should
 * also be applied on the client side.
 *
 * @param {*} value — any value from req.body
 * @returns {*} — sanitized value
 */
function stripHtmlTags(value) {
  if (typeof value === 'string') {
    // Remove HTML tags while preserving content
    return value.replace(/<[^>]*>/g, '');
  }

  if (Array.isArray(value)) {
    return value.map(stripHtmlTags);
  }

  if (value !== null && typeof value === 'object') {
    const sanitized = {};
    for (const key of Object.keys(value)) {
      sanitized[key] = stripHtmlTags(value[key]);
    }
    return sanitized;
  }

  return value;
}

/**
 * Middleware that sanitizes request body strings by stripping HTML tags.
 * Prevents stored XSS attacks where user input is rendered without escaping.
 */
export function sanitizeRequestBody(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    req.body = stripHtmlTags(req.body);
  }
  next();
}

// ---------------------------------------------------------------------------
// Middleware: SQL Injection Detection (Logging / Alerting)
// ---------------------------------------------------------------------------

/**
 * Inspect query parameters for SQL injection patterns.
 * This middleware does NOT block requests — it logs suspicious activity
 * so that security teams can investigate. Blocking is handled by
 * parameterized queries in the data layer.
 */
export function sqlInjectionDetector(req, res, next) {
  const queryParams = req.query;

  if (queryParams && typeof queryParams === 'object') {
    for (const [key, value] of Object.entries(queryParams)) {
      if (typeof value !== 'string') continue;

      for (const pattern of SQL_INJECTION_PATTERNS) {
        if (pattern.test(value)) {
          console.warn(
            `[security] SQL injection pattern detected — ` +
            `IP: ${req.ip}, ` +
            `path: ${req.path}, ` +
            `param: ${key}, ` +
            `value: ${value.substring(0, 100)}, ` +
            `pattern: ${pattern.toString()}`,
          );
          // Log but do not block — parameterized queries provide the real protection.
          // In a production system you might also push this to a SIEM.
          break;
        }
      }
    }
  }

  next();
}

// ---------------------------------------------------------------------------
// Middleware: Request Body Size Validation Per Route
// ---------------------------------------------------------------------------

/**
 * Enforce route-specific body size limits.
 *
 * Express's built-in `express.json({ limit })` applies globally. This
 * middleware provides finer-grained control so that, for example, login
 * payloads are capped at 1 KB while governance proposals can be 16 KB.
 */
export function routeBodySizeLimit(req, res, next) {
  // Only check requests with a body
  if (!req.body || req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return next();
  }

  // Find the most specific matching route limit
  let limit = DEFAULT_BODY_LIMIT;
  for (const [route, routeLimit] of Object.entries(ROUTE_BODY_LIMITS)) {
    if (req.originalUrl.startsWith(route)) {
      limit = routeLimit;
      break;
    }
  }

  // Estimate body size from Content-Length header or serialized body
  const contentLength = parseInt(req.headers['content-length'], 10);
  const bodySize = !isNaN(contentLength)
    ? contentLength
    : Buffer.byteLength(JSON.stringify(req.body), 'utf8');

  if (bodySize > limit) {
    return res.status(413).json({
      error: 'Payload too large',
      message: `Request body exceeds the ${Math.round(limit / 1024)} KB limit for this endpoint`,
    });
  }

  next();
}

// ---------------------------------------------------------------------------
// Middleware: Brute Force Protection for Login
// ---------------------------------------------------------------------------

/**
 * Track failed login attempts by IP + email combination.
 * After MAX_LOGIN_ATTEMPTS failures within the window, the IP+email
 * combination is locked out for LOCKOUT_DURATION_MS.
 *
 * This middleware should be applied BEFORE the login route handler.
 * Call `recordLoginFailure()` from the login handler on failed auth,
 * and `resetLoginAttempts()` on successful auth.
 */
export function bruteForceProtection(req, res, next) {
  // Only apply to login endpoint
  if (req.path !== '/login' && req.path !== '/auth/login') {
    return next();
  }

  if (req.method !== 'POST') {
    return next();
  }

  const email = req.body && req.body.email;
  if (!email) {
    return next();
  }

  const key = `${req.ip}:${email}`;
  const entry = bruteForceStore.get(key);

  if (entry) {
    // Check if currently locked out
    if (entry.lockedUntil && Date.now() < entry.lockedUntil) {
      const remainingMs = entry.lockedUntil - Date.now();
      const remainingMin = Math.ceil(remainingMs / 60_000);

      return res.status(429).json({
        error: 'Too many failed attempts',
        message: `Account temporarily locked. Try again in ${remainingMin} minute(s).`,
        retryAfter: Math.ceil(remainingMs / 1000),
      });
    }

    // If lockout has expired, reset
    if (entry.lockedUntil && Date.now() >= entry.lockedUntil) {
      bruteForceStore.delete(key);
    }
  }

  // Attach helper functions to the request for the route handler to use
  req.bruteForce = {
    /**
     * Call this when login fails (wrong password).
     */
    recordFailure: () => {
      const current = bruteForceStore.get(key) || { attempts: 0, lockedUntil: null };
      current.attempts += 1;

      if (current.attempts >= MAX_LOGIN_ATTEMPTS) {
        current.lockedUntil = Date.now() + LOCKOUT_DURATION_MS;
        console.warn(
          `[security] Brute force lockout — IP: ${req.ip}, email: ${email}, ` +
          `attempts: ${current.attempts}, locked for ${LOCKOUT_DURATION_MS / 60_000} min`,
        );
      }

      bruteForceStore.set(key, current);
    },

    /**
     * Call this when login succeeds — resets the counter.
     */
    resetAttempts: () => {
      bruteForceStore.delete(key);
    },
  };

  next();
}

// ---------------------------------------------------------------------------
// Middleware: CSRF Protection (Double-Submit Cookie Pattern)
// ---------------------------------------------------------------------------

/**
 * Generate a CSRF token and set it as a cookie.
 * The client must read this cookie value and send it back in the
 * X-CSRF-Token header for state-changing requests.
 *
 * This is the "double-submit cookie" pattern — it works even for
 * stateless APIs because the server verifies that the cookie value
 * matches the header value. An attacker on a different origin cannot
 * read or set cookies for our domain.
 */
export function csrfProtection(req, res, next) {
  const nodeEnv = process.env.NODE_ENV || 'development';

  // Skip CSRF in development and test environments
  if (nodeEnv !== 'production') {
    return next();
  }

  // Check if the path is exempt from CSRF
  const isExempt = CSRF_EXEMPT_PATHS.some((path) => req.originalUrl.startsWith(path));
  if (isExempt) {
    return next();
  }

  // For GET/HEAD/OPTIONS — just set the CSRF cookie if not present
  if (!STATE_CHANGING_METHODS.has(req.method)) {
    if (!req.cookies || !req.cookies[CSRF_COOKIE_NAME]) {
      const token = crypto.randomBytes(32).toString('hex');
      res.cookie(CSRF_COOKIE_NAME, token, {
        httpOnly: false,  // Client JS must be able to read it
        secure: true,
        sameSite: 'Strict',
        path: '/',
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
      });
    }
    return next();
  }

  // For state-changing methods — verify the CSRF token
  const cookieToken = req.cookies && req.cookies[CSRF_COOKIE_NAME];
  const headerToken = req.headers[CSRF_HEADER_NAME];

  if (!cookieToken || !headerToken) {
    return res.status(403).json({
      error: 'CSRF validation failed',
      message: 'Missing CSRF token. Include the X-CSRF-Token header.',
    });
  }

  // Use timing-safe comparison to prevent timing attacks
  try {
    const cookieBuf = Buffer.from(cookieToken, 'utf8');
    const headerBuf = Buffer.from(headerToken, 'utf8');

    if (cookieBuf.length !== headerBuf.length || !crypto.timingSafeEqual(cookieBuf, headerBuf)) {
      return res.status(403).json({
        error: 'CSRF validation failed',
        message: 'Invalid CSRF token.',
      });
    }
  } catch {
    return res.status(403).json({
      error: 'CSRF validation failed',
      message: 'Invalid CSRF token format.',
    });
  }

  next();
}

// ---------------------------------------------------------------------------
// Combined security middleware — apply all protections in one call
// ---------------------------------------------------------------------------

/**
 * Apply all security middleware in the recommended order.
 *
 * Usage in index.js:
 *   import { applySecurityMiddleware } from './middleware/security.js';
 *   applySecurityMiddleware(app);
 *
 * @param {import('express').Express} app — Express application instance
 * @param {object} [options]
 * @param {string} [options.nodeEnv] — override NODE_ENV
 */
export function applySecurityMiddleware(app, options = {}) {
  const nodeEnv = options.nodeEnv || process.env.NODE_ENV || 'development';

  // 1. Security headers (runs on every request)
  app.use(securityHeaders);

  // 2. SQL injection detection (logging only)
  app.use(sqlInjectionDetector);

  // 3. Request body sanitization (after body parsing)
  app.use(sanitizeRequestBody);

  // 4. Route-specific body size validation
  app.use(routeBodySizeLimit);

  // 5. Brute force protection for login
  app.use('/api/v1/auth', bruteForceProtection);

  // 6. CSRF protection (production only)
  if (nodeEnv === 'production') {
    app.use(csrfProtection);
  }

  console.log(`[security] Security middleware applied (env: ${nodeEnv})`);
}

// ---------------------------------------------------------------------------
// Exported constants for testing
// ---------------------------------------------------------------------------
export {
  MAX_LOGIN_ATTEMPTS,
  LOCKOUT_DURATION_MS,
  PRODUCTION_ORIGINS,
  ROUTE_BODY_LIMITS,
  SQL_INJECTION_PATTERNS,
};
