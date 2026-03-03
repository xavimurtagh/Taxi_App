import { v4 as uuidv4 } from 'uuid';

/**
 * Request ID middleware.
 *
 * - Reads an incoming X-Request-ID header (propagated from upstream proxies).
 * - Falls back to generating a fresh UUID v4.
 * - Attaches the ID to `req.id` and echoes it on the response via the
 *   X-Request-ID header so clients can correlate logs.
 */
export function requestIdMiddleware(req, _res, next) {
  const incoming = req.headers['x-request-id'];
  const id = incoming && typeof incoming === 'string' && incoming.length > 0
    ? incoming
    : uuidv4();

  // Attach to request for downstream use (logger, error handlers, etc.)
  req.id = id;

  // Echo on the response
  _res.setHeader('X-Request-ID', id);

  next();
}

export default requestIdMiddleware;
