import { sendMessage, markAsRead } from '../services/chat.js';

/**
 * Register chat-related socket events for a connected client.
 *
 * Handles real-time messaging between driver and passenger during
 * an active ride. Clients must join the `ride:<rideId>` room
 * (handled automatically by ride events) to participate.
 *
 * @param {import('socket.io').Socket} socket
 * @param {import('socket.io').Server} io
 */
export function registerChatEvents(socket, io) {
  const userId = socket.user.id;

  /**
   * chat:send
   * Client sends a new chat message.
   * Payload: { rideId, message, messageType?, metadata? }
   *
   * The message is persisted to the database and then broadcast
   * to all participants in the ride room (including the sender).
   */
  socket.on('chat:send', async (data) => {
    try {
      if (!data || !data.rideId || !data.message) {
        return socket.emit('chat:error', {
          message: 'Invalid payload: rideId and message are required',
        });
      }

      const { rideId, message, messageType, metadata } = data;

      // Validate message is not empty after trimming
      const trimmedMessage = String(message).trim();
      if (!trimmedMessage) {
        return socket.emit('chat:error', {
          message: 'Message cannot be empty',
        });
      }

      // Persist and broadcast via the chat service
      const savedMessage = await sendMessage(
        rideId,
        userId,
        trimmedMessage,
        messageType || 'text',
        metadata || {}
      );

      // Acknowledge success back to the sender
      socket.emit('chat:sent', {
        id: savedMessage.id,
        rideId: savedMessage.ride_id,
        createdAt: savedMessage.created_at,
      });
    } catch (err) {
      console.error('[chat] Error handling chat:send:', err.message);
      socket.emit('chat:error', { message: 'Failed to send message' });
    }
  });

  /**
   * chat:typing
   * Typing indicator — forwarded to the other participant(s) in
   * the ride room. Not persisted.
   * Payload: { rideId, isTyping }
   */
  socket.on('chat:typing', (data) => {
    try {
      if (!data || !data.rideId) {
        return socket.emit('chat:error', {
          message: 'Invalid payload: rideId is required',
        });
      }

      // Broadcast to everyone in the ride room *except* the sender
      socket.to(`ride:${data.rideId}`).emit('chat:typing', {
        rideId: data.rideId,
        userId,
        isTyping: Boolean(data.isTyping),
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      console.error('[chat] Error handling chat:typing:', err.message);
    }
  });

  /**
   * chat:read
   * Client marks all messages in a ride as read.
   * Payload: { rideId }
   *
   * Updates the database and notifies the other participant.
   */
  socket.on('chat:read', async (data) => {
    try {
      if (!data || !data.rideId) {
        return socket.emit('chat:error', {
          message: 'Invalid payload: rideId is required',
        });
      }

      await markAsRead(data.rideId, userId);
    } catch (err) {
      console.error('[chat] Error handling chat:read:', err.message);
      socket.emit('chat:error', { message: 'Failed to mark messages as read' });
    }
  });
}
