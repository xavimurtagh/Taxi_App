import * as Sentry from '@sentry/node';
import env from '../config/env.js';
import logger from './logger.js';

// ---------------------------------------------------------------------------
// Sentry initialisation
// ---------------------------------------------------------------------------

/**
 * Initialise the Sentry SDK.
 * Call this as early as possible in the application lifecycle (before Express
 * middleware is mounted) so that all errors and transactions are captured.
 *
 * @param {object} [options] - Override any Sentry.init option
 */
export function initSentry(options = {}) {
  const dsn = env.SENTRY_DSN;

  if (!dsn) {
    logger.warn('SENTRY_DSN not configured — Sentry will be disabled');
    return;
  }

  Sentry.init({
    dsn,
    environment: env.NODE_ENV,
    release: `openride-api@${process.env.npm_package_version || '1.0.0'}`,

    // Performance tracing — sample rate can be tuned via env var
    tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),

    // Only send errors in production by default; in dev you may set the DSN
    // deliberately to test, so we still honour it.
    enabled: !!dsn,

    // Integrations
    integrations: [
      // Capture unhandled promise rejections
      Sentry.onUnhandledRejectionIntegration({ mode: 'warn' }),
    ],

    // Breadcrumb customisation — limit noisy breadcrumbs
    beforeBreadcrumb(breadcrumb) {
      // Drop excessively noisy console breadcrumbs in production
      if (breadcrumb.category === 'console' && env.NODE_ENV === 'production') {
        return null;
      }
      return breadcrumb;
    },

    // Allow caller to override anything
    ...options,
  });

  logger.info('Sentry initialised', { environment: env.NODE_ENV });
}

// ---------------------------------------------------------------------------
// Express integration helpers
// ---------------------------------------------------------------------------

/**
 * Returns the Sentry request handler middleware.
 * Mount this BEFORE all other middleware.
 */
export function sentryRequestHandler() {
  return Sentry.Handlers.requestHandler({
    // Attach user context from req.user (set by auth middleware)
    user: ['id', 'email', 'role'],
    // Include IP for abuse detection
    ip: true,
    // Include request data
    request: ['headers', 'method', 'url', 'query_string'],
  });
}

/**
 * Returns the Sentry tracing handler middleware.
 * Mount this AFTER the request handler and BEFORE routes.
 */
export function sentryTracingHandler() {
  return Sentry.Handlers.tracingHandler();
}

/**
 * Returns the Sentry error handler middleware.
 * Mount this AFTER all routes but BEFORE your own error handler.
 */
export function sentryErrorHandler() {
  return Sentry.Handlers.errorHandler({
    shouldHandleError(error) {
      // Capture 4xx >= 400 and all 5xx
      const status = error.status || error.statusCode || 500;
      return status >= 400;
    },
  });
}

/**
 * Attach user context to the current Sentry scope.
 * Call this after authentication succeeds.
 *
 * @param {{ id: string, email?: string, role?: string }} user
 */
export function setSentryUser(user) {
  Sentry.setUser({
    id: user.id,
    email: user.email,
    role: user.role,
  });
}

/**
 * Add a breadcrumb to the current scope.
 *
 * @param {string} message
 * @param {string} category
 * @param {object} [data]
 * @param {'debug'|'info'|'warning'|'error'} [level]
 */
export function addBreadcrumb(message, category, data = {}, level = 'info') {
  Sentry.addBreadcrumb({
    message,
    category,
    data,
    level,
  });
}

/**
 * Manually capture an exception.
 *
 * @param {Error} error
 * @param {object} [context]
 */
export function captureException(error, context = {}) {
  Sentry.withScope((scope) => {
    Object.entries(context).forEach(([key, value]) => {
      scope.setExtra(key, value);
    });
    Sentry.captureException(error);
  });
}

export default {
  initSentry,
  sentryRequestHandler,
  sentryTracingHandler,
  sentryErrorHandler,
  setSentryUser,
  addBreadcrumb,
  captureException,
};
