import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import { registerRideEvents } from './rideEvents.js';
import { registerLocationEvents } from './locationEvents.js';

/**
 * The global Socket.IO server instance.
 * Exported so that services can emit events without having a direct
 * reference to a socket.
 */
let io = null;

/**
 * Authenticate an incoming socket connection by verifying the JWT
 * provided in the handshake (either as auth.token or as a query
 * parameter).
 *
 * @param {import('socket.io').Socket} socket
 * @param {Function} next
 */
function authenticateSocket(socket, next) {
  const token =
    socket.handshake.auth?.token || socket.handshake.query?.token;

  if (!token) {
    return next(new Error('Authentication required: no token provided'));
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    socket.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
    };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(new Error('Authentication failed: token has expired'));
    }
    return next(new Error('Authentication failed: invalid token'));
  }
}

/**
 * Create and configure the Socket.IO server, attach event handlers,
 * and return the io instance.
 *
 * @param {import('http').Server} httpServer - Node HTTP server
 * @returns {import('socket.io').Server}
 */
export function setupSockets(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: env.NODE_ENV === 'production'
        ? process.env.CORS_ORIGIN || 'https://openride.community'
        : '*',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingInterval: 25000,
    pingTimeout: 20000,
    transports: ['websocket', 'polling'],
  });

  // JWT authentication middleware
  io.use(authenticateSocket);

  io.on('connection', (socket) => {
    const { id: userId, email, role } = socket.user;

    console.log(
      `[socket] User connected: ${email} (${userId}), role=${role}, socketId=${socket.id}`
    );

    // Join the user to their own private room so services can emit
    // targeted events using io.to(`user:${userId}`).
    socket.join(`user:${userId}`);

    // If the user is a driver, also join the drivers room for broadcasts
    if (role === 'driver' || role === 'both') {
      socket.join('drivers');
    }

    // Register domain-specific event handlers
    registerRideEvents(io, socket);
    registerLocationEvents(io, socket);

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      console.log(
        `[socket] User disconnected: ${email} (${userId}), reason=${reason}`
      );
    });

    // Generic error handler
    socket.on('error', (err) => {
      console.error(
        `[socket] Error for user ${email} (${userId}):`,
        err.message
      );
    });
  });

  console.log('[socket] Socket.IO server initialised');

  return io;
}

/**
 * Get the current Socket.IO server instance.
 * Returns null if setupSockets has not been called yet.
 *
 * @returns {import('socket.io').Server | null}
 */
export function getIO() {
  return io;
}
