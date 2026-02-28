import { createServer } from 'node:http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import env from './config/env.js';
import pool from './config/database.js';
import redis from './config/redis.js';
import { generalLimiter } from './middleware/rateLimit.js';
import { setupSockets } from './sockets/index.js';

// ---------------------------------------------------------------------------
// Express application
// ---------------------------------------------------------------------------
const app = express();

// ---------------------------------------------------------------------------
// Global middleware
// ---------------------------------------------------------------------------

// Security headers
app.use(helmet());

// CORS
app.use(
  cors({
    origin: env.NODE_ENV === 'production'
      ? process.env.CORS_ORIGIN || 'https://openride.community'
      : '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
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

// General rate limiting
app.use(generalLimiter);

// ---------------------------------------------------------------------------
// Health-check (outside the /api/v1 prefix so load-balancers can probe easily)
// ---------------------------------------------------------------------------
app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    const redisStatus = redis.status === 'ready' ? 'ok' : redis.status;
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {
        database: 'ok',
        redis: redisStatus,
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
    { path: '/safety', module: './routes/safety.js' },
  ];

  for (const route of routeModules) {
    try {
      const mod = await import(route.module);
      apiRouter.use(route.path, mod.default || mod.router);
      console.log(`[routes] Mounted ${route.path}`);
    } catch (err) {
      // Module does not exist yet — skip silently during development
      if (err.code === 'ERR_MODULE_NOT_FOUND') {
        console.log(`[routes] Skipped ${route.path} (module not found)`);
      } else {
        console.error(`[routes] Failed to mount ${route.path}:`, err.message);
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
  console.error('[error] Unhandled error:', err);

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
    console.log('[server] Scheduler not started:', err.message);
  }

  // Start listening
  httpServer.listen(env.PORT, () => {
    console.log(
      `[server] OpenRide API listening on port ${env.PORT} (${env.NODE_ENV})`
    );
  });

  // ---------------------------------------------------------------------------
  // Graceful shutdown
  // ---------------------------------------------------------------------------
  const shutdown = async (signal) => {
    console.log(`\n[server] ${signal} received — shutting down gracefully...`);

    // Stop accepting new connections
    httpServer.close(() => {
      console.log('[server] HTTP server closed');
    });

    try {
      // Close database pool
      await pool.end();
      console.log('[server] PostgreSQL pool closed');
    } catch (err) {
      console.error('[server] Error closing PostgreSQL pool:', err.message);
    }

    try {
      // Disconnect Redis
      await redis.quit();
      console.log('[server] Redis connection closed');
    } catch (err) {
      console.error('[server] Error closing Redis connection:', err.message);
    }

    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Catch unhandled rejections so they don't silently disappear
  process.on('unhandledRejection', (reason) => {
    console.error('[server] Unhandled promise rejection:', reason);
  });

  process.on('uncaughtException', (err) => {
    console.error('[server] Uncaught exception:', err);
    process.exit(1);
  });
}

start().catch((err) => {
  console.error('[server] Failed to start:', err);
  process.exit(1);
});

export default app;
