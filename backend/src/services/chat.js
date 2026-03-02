import { query } from '../config/database.js';
import { getIO } from '../sockets/index.js';

/**
 * Send a chat message within a ride conversation.
 *
 * Persists the message to the database, then emits a real-time event
 * to all participants in the ride room via Socket.IO.
 *
 * @param {string} rideId       - The ride this message belongs to
 * @param {string} senderId     - The user sending the message
 * @param {string} message      - Message content
 * @param {string} messageType  - Message type: 'text', 'image', 'location', 'system'
 * @param {object} metadata     - Optional metadata (e.g. image URL, coordinates)
 * @returns {Promise<object>}   - The saved message row
 */
export async function sendMessage(rideId, senderId, message, messageType = 'text', metadata = {}) {
  const result = await query(
    `INSERT INTO chat_messages (ride_id, sender_id, message, message_type, metadata)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, ride_id, sender_id, message, message_type, metadata,
               is_read, created_at`,
    [rideId, senderId, message, messageType, JSON.stringify(metadata)]
  );

  const chatMessage = result.rows[0];

  // Emit the new message to all participants in the ride room
  try {
    const io = getIO();
    if (io) {
      io.to(`ride:${rideId}`).emit('chat:message', {
        id: chatMessage.id,
        rideId: chatMessage.ride_id,
        senderId: chatMessage.sender_id,
        message: chatMessage.message,
        messageType: chatMessage.message_type,
        metadata: chatMessage.metadata,
        createdAt: chatMessage.created_at,
      });
    }
  } catch (error) {
    console.error('[chat] Failed to emit chat:message via socket:', error.message);
  }

  return chatMessage;
}

/**
 * Retrieve paginated chat messages for a ride.
 *
 * Messages are returned in chronological order (oldest first).
 * Use the `before` parameter for cursor-based pagination — pass the
 * `created_at` timestamp of the earliest message in the current page
 * to fetch older messages.
 *
 * @param {string}      rideId - The ride to fetch messages for
 * @param {number}      limit  - Maximum number of messages to return
 * @param {string|null} before - ISO timestamp; only return messages created before this
 * @returns {Promise<object[]>}
 */
export async function getMessages(rideId, limit = 50, before = null) {
  const safeLimit = Math.min(100, Math.max(1, limit));

  let sql;
  let params;

  if (before) {
    sql = `SELECT id, ride_id, sender_id, message, message_type, metadata,
                  is_read, created_at
           FROM chat_messages
           WHERE ride_id = $1 AND created_at < $2
           ORDER BY created_at DESC
           LIMIT $3`;
    params = [rideId, before, safeLimit];
  } else {
    sql = `SELECT id, ride_id, sender_id, message, message_type, metadata,
                  is_read, created_at
           FROM chat_messages
           WHERE ride_id = $1
           ORDER BY created_at DESC
           LIMIT $2`;
    params = [rideId, safeLimit];
  }

  const result = await query(sql, params);

  // Return in chronological order (oldest first)
  return result.rows.reverse();
}

/**
 * Mark all messages in a ride as read for a given user.
 *
 * Only marks messages that were sent by *other* users (you don't
 * mark your own messages as read).
 *
 * @param {string} rideId - The ride whose messages to mark
 * @param {string} userId - The user who is reading
 * @returns {Promise<number>} Number of messages marked as read
 */
export async function markAsRead(rideId, userId) {
  const result = await query(
    `UPDATE chat_messages
     SET is_read = true
     WHERE ride_id = $1
       AND sender_id != $2
       AND is_read = false`,
    [rideId, userId]
  );

  // Notify the other participant that messages have been read
  try {
    const io = getIO();
    if (io) {
      io.to(`ride:${rideId}`).emit('chat:read', {
        rideId,
        readBy: userId,
        readAt: new Date().toISOString(),
      });
    }
  } catch (error) {
    console.error('[chat] Failed to emit chat:read via socket:', error.message);
  }

  return result.rowCount;
}

/**
 * Get the count of unread messages in a ride for a given user.
 *
 * Only counts messages sent by *other* users that have not been read.
 *
 * @param {string} rideId - The ride to check
 * @param {string} userId - The user to count unread for
 * @returns {Promise<number>}
 */
export async function getUnreadCount(rideId, userId) {
  const result = await query(
    `SELECT COUNT(*)::int AS count
     FROM chat_messages
     WHERE ride_id = $1
       AND sender_id != $2
       AND is_read = false`,
    [rideId, userId]
  );

  return result.rows[0].count;
}
