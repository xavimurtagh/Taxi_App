import rateLimit from 'express-rate-limit';

/**
 * General-purpose rate limiter.
 * 100 requests per 15 minute window per IP.
 */
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests',
    message: 'You have exceeded the rate limit. Please try again later.',
  },
});

/**
 * Stricter rate limiter for authentication endpoints (login, register).
 * 10 requests per 15 minute window per IP.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many authentication attempts',
    message:
      'You have made too many login/register attempts. Please try again in 15 minutes.',
  },
});

/**
 * Rate limiter for ride-related endpoints.
 * 30 requests per 15 minute window per IP.
 */
export const rideLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many ride requests',
    message:
      'You have exceeded the ride request limit. Please try again later.',
  },
});
