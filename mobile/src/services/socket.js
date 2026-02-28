import { io } from 'socket.io-client';
import { SOCKET_URL } from '../utils/constants';

let socket = null;

/**
 * Connect to the Socket.IO server with an auth token.
 * @param {string} token - JWT token for authentication
 * @returns {object} socket instance
 */
export const connectSocket = (token) => {
  if (socket?.connected) {
    console.log('[Socket] Already connected');
    return socket;
  }

  socket = io(SOCKET_URL, {
    auth: {
      token,
    },
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
    timeout: 10000,
  });

  socket.on('connect', () => {
    console.log('[Socket] Connected:', socket.id);
  });

  socket.on('disconnect', (reason) => {
    console.log('[Socket] Disconnected:', reason);
  });

  socket.on('connect_error', (error) => {
    console.log('[Socket] Connection error:', error.message);
  });

  socket.on('reconnect', (attemptNumber) => {
    console.log('[Socket] Reconnected after', attemptNumber, 'attempts');
  });

  socket.on('reconnect_attempt', (attemptNumber) => {
    console.log('[Socket] Reconnection attempt:', attemptNumber);
  });

  return socket;
};

/**
 * Disconnect the current socket connection.
 */
export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
    console.log('[Socket] Manually disconnected');
  }
};

/**
 * Get the current socket instance.
 * @returns {object|null} socket instance or null
 */
export const getSocket = () => {
  return socket;
};
