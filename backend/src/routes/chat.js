import { Router } from 'express';
import Joi from 'joi';
import { query } from '../config/database.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import {
  sendMessage,
  getMessages,
  markAsRead,
  getUnreadCount,
} from '../services/chat.js';

const router = Router();

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const rideIdParamSchema = Joi.object({
  rideId: Joi.string().uuid().required(),
});

const sendMessageSchema = Joi.object({
  message: Joi.string().trim().min(1).max(2000).required(),
  messageType: Joi.string().valid('text', 'image', 'location', 'system').default('text'),
  metadata: Joi.object().default({}),
});

const messagesQuerySchema = Joi.object({
  limit: Joi.number().integer().min(1).max(100).default(50),
  before: Joi.string().isoDate().optional(),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Verify the requesting user is a participant (driver or passenger)
 * of the given ride. Returns the ride row if valid, or sends an
 * error response and returns null.
 */
async function verifyRideParticipant(rideId, userId, res) {
  const result = await query(
    `SELECT id, passenger_id, driver_id, status
     FROM rides
     WHERE id = $1`,
    [rideId]
  );

  if (result.rows.length === 0) {
    res.status(404).json({
      error: 'Not found',
      message: 'Ride not found',
    });
    return null;
  }

  const ride = result.rows[0];

  if (ride.passenger_id !== userId && ride.driver_id !== userId) {
    res.status(403).json({
      error: 'Forbidden',
      message: 'You are not a participant of this ride',
    });
    return null;
  }

  return ride;
}

// ---------------------------------------------------------------------------
// GET /:rideId/messages — Get chat messages for a ride
// ---------------------------------------------------------------------------
router.get(
  '/:rideId/messages',
  authenticate,
  validate(rideIdParamSchema, 'params'),
  validate(messagesQuerySchema, 'query'),
  async (req, res) => {
    try {
      const { rideId } = req.params;
      const userId = req.user.id;

      // Verify the user is a participant
      const ride = await verifyRideParticipant(rideId, userId, res);
      if (!ride) return;

      const { limit, before } = req.query;
      const messages = await getMessages(rideId, limit, before || null);

      return res.status(200).json({
        messages: messages.map((msg) => ({
          id: msg.id,
          rideId: msg.ride_id,
          senderId: msg.sender_id,
          message: msg.message,
          messageType: msg.message_type,
          metadata: msg.metadata,
          isRead: msg.is_read,
          createdAt: msg.created_at,
        })),
      });
    } catch (err) {
      console.error('[chat] GET /:rideId/messages error:', err);
      return res.status(500).json({
        error: 'Internal server error',
        message: 'An unexpected error occurred while fetching messages',
      });
    }
  }
);

// ---------------------------------------------------------------------------
// POST /:rideId/messages — Send a chat message
// ---------------------------------------------------------------------------
router.post(
  '/:rideId/messages',
  authenticate,
  validate(rideIdParamSchema, 'params'),
  validate(sendMessageSchema),
  async (req, res) => {
    try {
      const { rideId } = req.params;
      const userId = req.user.id;

      // Verify the user is a participant
      const ride = await verifyRideParticipant(rideId, userId, res);
      if (!ride) return;

      // Check ride is in an active state where chat is allowed
      const activeStatuses = ['matched', 'driver_arriving', 'in_progress'];
      if (!activeStatuses.includes(ride.status)) {
        return res.status(400).json({
          error: 'Bad request',
          message: `Chat is not available for rides in '${ride.status}' status`,
        });
      }

      const { message, messageType, metadata } = req.body;

      const chatMessage = await sendMessage(
        rideId,
        userId,
        message,
        messageType,
        metadata
      );

      return res.status(201).json({
        message: {
          id: chatMessage.id,
          rideId: chatMessage.ride_id,
          senderId: chatMessage.sender_id,
          message: chatMessage.message,
          messageType: chatMessage.message_type,
          metadata: chatMessage.metadata,
          isRead: chatMessage.is_read,
          createdAt: chatMessage.created_at,
        },
      });
    } catch (err) {
      console.error('[chat] POST /:rideId/messages error:', err);
      return res.status(500).json({
        error: 'Internal server error',
        message: 'An unexpected error occurred while sending the message',
      });
    }
  }
);

// ---------------------------------------------------------------------------
// PUT /:rideId/read — Mark messages as read
// ---------------------------------------------------------------------------
router.put(
  '/:rideId/read',
  authenticate,
  validate(rideIdParamSchema, 'params'),
  async (req, res) => {
    try {
      const { rideId } = req.params;
      const userId = req.user.id;

      // Verify the user is a participant
      const ride = await verifyRideParticipant(rideId, userId, res);
      if (!ride) return;

      const count = await markAsRead(rideId, userId);

      return res.status(200).json({
        message: 'Messages marked as read',
        count,
      });
    } catch (err) {
      console.error('[chat] PUT /:rideId/read error:', err);
      return res.status(500).json({
        error: 'Internal server error',
        message: 'An unexpected error occurred while marking messages as read',
      });
    }
  }
);

// ---------------------------------------------------------------------------
// GET /:rideId/unread-count — Get unread message count
// ---------------------------------------------------------------------------
router.get(
  '/:rideId/unread-count',
  authenticate,
  validate(rideIdParamSchema, 'params'),
  async (req, res) => {
    try {
      const { rideId } = req.params;
      const userId = req.user.id;

      // Verify the user is a participant
      const ride = await verifyRideParticipant(rideId, userId, res);
      if (!ride) return;

      const count = await getUnreadCount(rideId, userId);

      return res.status(200).json({
        unreadCount: count,
      });
    } catch (err) {
      console.error('[chat] GET /:rideId/unread-count error:', err);
      return res.status(500).json({
        error: 'Internal server error',
        message: 'An unexpected error occurred while fetching unread count',
      });
    }
  }
);

export default router;
