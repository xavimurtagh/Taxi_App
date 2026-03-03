import { createServer } from 'node:http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import env from './config/env.js';
import pool from './config/database.js';
import redis from './config/redis.js';
import { generalLimiter } from './middleware/rateLimit.js';
import { applySecurityMiddleware, corsOriginValidator } from './middleware/security.js';
import { setupSockets } from './sockets/index.js';

// Monitoring & observability imports
import { initSentry, sentryRequestHandler, sentryTracingHandler, sentryErrorHandler } from './utils/sentry.js';
import logger from './utils/logger.js';
import { requestIdMiddleware } from './middleware/requestId.js';
import { metricsMiddleware, metricsEndpoint } from './middleware/metrics.js';
import healthCheckRouter from './middleware/healthCheck.js';

// ---------------------------------------------------------------------------
// Initialise Sentry (must happen before Express app is created)
// ---------------------------------------------------------------------------
initSentry();

// ---------------------------------------------------------------------------
// Express application
// ---------------------------------------------------------------------------
const app = express();

// ---------------------------------------------------------------------------
// Sentry request handler — must be the very first middleware
// ---------------------------------------------------------------------------
app.use(sentryRequestHandler());
app.use(sentryTracingHandler());

// ---------------------------------------------------------------------------
// Request ID — attach a unique ID to every request
// ---------------------------------------------------------------------------
app.use(requestIdMiddleware);

// ---------------------------------------------------------------------------
// Prometheus metrics collection middleware (before routes, after requestId)
// ---------------------------------------------------------------------------
app.use(metricsMiddleware);

// ---------------------------------------------------------------------------
// Prometheus /metrics endpoint — mounted OUTSIDE the rate limiter
// ---------------------------------------------------------------------------
app.get('/metrics', metricsEndpoint);

// ---------------------------------------------------------------------------
// Global middleware
// ---------------------------------------------------------------------------

// Security headers
app.use(helmet());

// CORS — uses security middleware's origin validator in production
app.use(
  cors({
    origin: corsOriginValidator(env.NODE_ENV),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
    credentials: true,
  })
);

// Request logging
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Stripe webhooks need raw body for signature verification — must come before json parser
app.use('/api/v1/payments/webhook', express.raw({ type: 'application/json' }));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Security hardening middleware (XSS sanitization, SQL injection detection,
// brute force protection, security headers, per-route body size limits)
applySecurityMiddleware(app, { nodeEnv: env.NODE_ENV });

// General rate limiting
app.use(generalLimiter);

// ---------------------------------------------------------------------------
// Health-check routes (outside the /api/v1 prefix so load-balancers can probe)
// ---------------------------------------------------------------------------
app.use('/health', healthCheckRouter);

// ---------------------------------------------------------------------------
// API routes — mounted under /api/v1
// ---------------------------------------------------------------------------
//
// Route modules are imported dynamically so the server boots cleanly even
// when route files have not been created yet (e.g. during early development).
// As you add routes, import them here and mount on the router.
// ---------------------------------------------------------------------------
const apiRouter = express.Router();

async function mountRoutes() {
  const routeModules = [
    { path: '/auth', module: './routes/auth.js' },
    { path: '/users', module: './routes/users.js' },
    { path: '/rides', module: './routes/rides.js' },
    { path: '/drivers', module: './routes/drivers.js' },
    { path: '/ratings', module: './routes/ratings.js' },
    { path: '/governance', module: './routes/governance.js' },
    { path: '/payments', module: './routes/payments.js' },
    { path: '/transparency', module: './routes/transparency.js' },
    { path: '/support', module: './routes/support.js' },
    { path: '/feedback', module: './routes/feedback.js' },
    { path: '/safety', module: './routes/safety.js' },
    { path: '/moderation', module: './routes/moderation.js' },
    { path: '/disputes', module: './routes/disputes.js' },
    { path: '/notifications', module: './routes/notifications.js' },
    { path: '/chat', module: './routes/chat.js' },
    { path: '/scheduling', module: './routes/scheduling.js' },
    { path: '/ridesharing', module: './routes/ridesharing.js' },
    { path: '/referrals', module: './routes/referrals.js' },
    { path: '/vehicle-types', module: './routes/vehicleTypes.js' },
    { path: '/accessibility', module: './routes/accessibility.js' },
  ];

  for (const route of routeModules) {
    try {
      const mod = await import(route.module);
      apiRouter.use(route.path, mod.default || mod.router);
      logger.info(`Mounted route ${route.path}`);
    } catch (err) {
      // Module does not exist yet — skip silently during development
      if (err.code === 'ERR_MODULE_NOT_FOUND') {
        logger.debug(`Skipped route ${route.path} (module not found)`);
      } else {
        logger.error(`Failed to mount route ${route.path}`, { error: err });
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 404 and global error handler
// ---------------------------------------------------------------------------
function notFoundHandler(_req, res) {
  res.status(404).json({
    error: 'Not found',
    message: 'The requested resource does not exist',
  });
}

function globalErrorHandler(err, _req, res, _next) {
  logger.error('Unhandled error', { error: err, requestId: _req.id });

  const statusCode = err.statusCode || err.status || 500;
  const message =
    env.NODE_ENV === 'production' && statusCode === 500
      ? 'Internal server error'
      : err.message || 'Internal server error';

  res.status(statusCode).json({
    error: statusCode === 500 ? 'Internal server error' : 'Error',
    message,
    ...(env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------
async function start() {
  // Mount routes (dynamic imports)
  await mountRoutes();
  app.use('/api/v1', apiRouter);

  // Sentry error handler — must come after routes but before our error handler
  app.use(sentryErrorHandler());

  // Catch-all and error handlers (must come after routes)
  app.use(notFoundHandler);
  app.use(globalErrorHandler);

  // Create the HTTP server so it can be shared with Socket.IO
  const httpServer = createServer(app);

  // Initialise Socket.IO
  setupSockets(httpServer);

  // Start background jobs (document expiry checks, proposal finalization, etc.)
  try {
    const { startScheduler } = await import('./jobs/scheduler.js');
    startScheduler();
  } catch (err) {
    logger.info('Scheduler not started', { reason: err.message });
  }

  // Start listening
  httpServer.listen(env.PORT, () => {
    logger.info(`OpenRide API listening on port ${env.PORT} (${env.NODE_ENV})`);
  });

  // ---------------------------------------------------------------------------
  // Graceful shutdown
  // ---------------------------------------------------------------------------
  const shutdown = async (signal) => {
    logger.info(`${signal} received — shutting down gracefully...`);

    // Stop accepting new connections
    httpServer.close(() => {
      logger.info('HTTP server closed');
    });

    try {
      // Close database pool
      await pool.end();
      logger.info('PostgreSQL pool closed');
    } catch (err) {
      logger.error('Error closing PostgreSQL pool', { error: err });
    }

    try {
      // Disconnect Redis
      await redis.quit();
      logger.info('Redis connection closed');
    } catch (err) {
      logger.error('Error closing Redis connection', { error: err });
    }

    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Catch unhandled rejections so they don't silently disappear
  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled promise rejection', { reason });
  });

  process.on('uncaughtException', (err) => {
    logger.error('Uncaught exception', { error: err });
    process.exit(1);
  });
}

start().catch((err) => {
  logger.error('Failed to start server', { error: err });
  process.exit(1);
});

export default app;
