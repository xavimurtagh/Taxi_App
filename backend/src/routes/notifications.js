import { Router } from 'express';
import Joi from 'joi';
import { query } from '../config/database.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import { registerPushToken, removePushToken } from '../services/notifications.js';

const router = Router();

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const preferencesSchema = Joi.object({
  ride_updates: Joi.boolean(),
  promotions: Joi.boolean(),
  chat_messages: Joi.boolean(),
  safety_alerts: Joi.boolean(),
  payment_updates: Joi.boolean(),
  push_enabled: Joi.boolean(),
  email_enabled: Joi.boolean(),
  sms_enabled: Joi.boolean(),
}).min(1);

const registerTokenSchema = Joi.object({
  token: Joi.string().trim().min(1).max(500).required(),
  platform: Joi.string().valid('ios', 'android', 'web').required(),
});

const removeTokenSchema = Joi.object({
  token: Joi.string().trim().min(1).max(500).required(),
});

const historyQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

const notificationIdSchema = Joi.object({
  id: Joi.string().uuid().required(),
});

// ---------------------------------------------------------------------------
// GET /preferences — Get user's notification preferences
// ---------------------------------------------------------------------------
router.get('/preferences', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await query(
      `SELECT ride_updates, promotions, chat_messages, safety_alerts,
              payment_updates, push_enabled, email_enabled, sms_enabled,
              updated_at
       FROM notification_preferences
       WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      // Return defaults if no preferences have been saved yet
      return res.status(200).json({
        preferences: {
          rideUpdates: true,
          promotions: true,
          chatMessages: true,
          safetyAlerts: true,
          paymentUpdates: true,
          pushEnabled: true,
          emailEnabled: true,
          smsEnabled: false,
          updatedAt: null,
        },
      });
    }

    const row = result.rows[0];
    return res.status(200).json({
      preferences: {
        rideUpdates: row.ride_updates,
        promotions: row.promotions,
        chatMessages: row.chat_messages,
        safetyAlerts: row.safety_alerts,
        paymentUpdates: row.payment_updates,
        pushEnabled: row.push_enabled,
        emailEnabled: row.email_enabled,
        smsEnabled: row.sms_enabled,
        updatedAt: row.updated_at,
      },
    });
  } catch (err) {
    console.error('[notifications] GET /preferences error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred while fetching notification preferences',
    });
  }
});

// ---------------------------------------------------------------------------
// POST /preferences — Update notification preferences
// ---------------------------------------------------------------------------
router.post(
  '/preferences',
  authenticate,
  validate(preferencesSchema),
  async (req, res) => {
    try {
      const userId = req.user.id;
      const fields = req.body;

      // Build dynamic SET clause from the validated fields
      const setClauses = [];
      const values = [];
      let paramIndex = 1;

      for (const [key, value] of Object.entries(fields)) {
        setClauses.push(`${key} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }

      values.push(userId);

      const result = await query(
        `INSERT INTO notification_preferences (user_id, ${Object.keys(fields).join(', ')})
         VALUES ($${paramIndex}, ${Object.keys(fields).map((_, i) => `$${i + 1}`).join(', ')})
         ON CONFLICT (user_id)
         DO UPDATE SET ${setClauses.join(', ')}, updated_at = NOW()
         RETURNING ride_updates, promotions, chat_messages, safety_alerts,
                   payment_updates, push_enabled, email_enabled, sms_enabled,
                   updated_at`,
        values
      );

      const row = result.rows[0];
      return res.status(200).json({
        preferences: {
          rideUpdates: row.ride_updates,
          promotions: row.promotions,
          chatMessages: row.chat_messages,
          safetyAlerts: row.safety_alerts,
          paymentUpdates: row.payment_updates,
          pushEnabled: row.push_enabled,
          emailEnabled: row.email_enabled,
          smsEnabled: row.sms_enabled,
          updatedAt: row.updated_at,
        },
      });
    } catch (err) {
      console.error('[notifications] POST /preferences error:', err);
      return res.status(500).json({
        error: 'Internal server error',
        message: 'An unexpected error occurred while updating notification preferences',
      });
    }
  }
);

// ---------------------------------------------------------------------------
// POST /register-token — Register push notification token
// ---------------------------------------------------------------------------
router.post(
  '/register-token',
  authenticate,
  validate(registerTokenSchema),
  async (req, res) => {
    try {
      const { token, platform } = req.body;
      const userId = req.user.id;

      const success = await registerPushToken(userId, token, platform);

      if (!success) {
        return res.status(500).json({
          error: 'Internal server error',
          message: 'Failed to register push notification token',
        });
      }

      return res.status(200).json({
        message: 'Push notification token registered successfully',
      });
    } catch (err) {
      console.error('[notifications] POST /register-token error:', err);
      return res.status(500).json({
        error: 'Internal server error',
        message: 'An unexpected error occurred while registering push token',
      });
    }
  }
);

// ---------------------------------------------------------------------------
// DELETE /register-token — Remove push token on logout
// ---------------------------------------------------------------------------
router.delete(
  '/register-token',
  authenticate,
  validate(removeTokenSchema),
  async (req, res) => {
    try {
      const { token } = req.body;
      const userId = req.user.id;

      const success = await removePushToken(userId, token);

      if (!success) {
        return res.status(500).json({
          error: 'Internal server error',
          message: 'Failed to remove push notification token',
        });
      }

      return res.status(200).json({
        message: 'Push notification token removed successfully',
      });
    } catch (err) {
      console.error('[notifications] DELETE /register-token error:', err);
      return res.status(500).json({
        error: 'Internal server error',
        message: 'An unexpected error occurred while removing push token',
      });
    }
  }
);

// ---------------------------------------------------------------------------
// GET /history — Get notification history with pagination
// ---------------------------------------------------------------------------
router.get(
  '/history',
  authenticate,
  validate(historyQuerySchema, 'query'),
  async (req, res) => {
    try {
      const userId = req.user.id;
      const { page, limit } = req.query;
      const offset = (page - 1) * limit;

      // Get total count
      const countResult = await query(
        `SELECT COUNT(*)::int AS total
         FROM notification_history
         WHERE user_id = $1`,
        [userId]
      );
      const total = countResult.rows[0].total;

      // Get paginated notifications
      const result = await query(
        `SELECT id, user_id, title, body, category, data,
                is_read, created_at
         FROM notification_history
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        [userId, limit, offset]
      );

      const notifications = result.rows.map((row) => ({
        id: row.id,
        title: row.title,
        body: row.body,
        category: row.category,
        data: row.data,
        isRead: row.is_read,
        createdAt: row.created_at,
      }));

      return res.status(200).json({
        notifications,
        total,
        page,
        limit,
      });
    } catch (err) {
      console.error('[notifications] GET /history error:', err);
      return res.status(500).json({
        error: 'Internal server error',
        message: 'An unexpected error occurred while fetching notification history',
      });
    }
  }
);

// ---------------------------------------------------------------------------
// PUT /read-all — Mark all notifications as read
// ---------------------------------------------------------------------------
router.put('/read-all', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await query(
      `UPDATE notification_history
       SET is_read = true
       WHERE user_id = $1 AND is_read = false`,
      [userId]
    );

    return res.status(200).json({
      message: 'All notifications marked as read',
      count: result.rowCount,
    });
  } catch (err) {
    console.error('[notifications] PUT /read-all error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred while marking notifications as read',
    });
  }
});

// ---------------------------------------------------------------------------
// GET /unread-count — Get count of unread notifications
// ---------------------------------------------------------------------------
router.get('/unread-count', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await query(
      `SELECT COUNT(*)::int AS count
       FROM notification_history
       WHERE user_id = $1 AND is_read = false`,
      [userId]
    );

    return res.status(200).json({
      unreadCount: result.rows[0].count,
    });
  } catch (err) {
    console.error('[notifications] GET /unread-count error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred while fetching unread count',
    });
  }
});

// ---------------------------------------------------------------------------
// PUT /:id/read — Mark a single notification as read
// ---------------------------------------------------------------------------
router.put(
  '/:id/read',
  authenticate,
  validate(notificationIdSchema, 'params'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const result = await query(
        `UPDATE notification_history
         SET is_read = true
         WHERE id = $1 AND user_id = $2
         RETURNING id, title, body, category, data, is_read, created_at`,
        [id, userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: 'Not found',
          message: 'Notification not found',
        });
      }

      const row = result.rows[0];
      return res.status(200).json({
        notification: {
          id: row.id,
          title: row.title,
          body: row.body,
          category: row.category,
          data: row.data,
          isRead: row.is_read,
          createdAt: row.created_at,
        },
      });
    } catch (err) {
      console.error('[notifications] PUT /:id/read error:', err);
      return res.status(500).json({
        error: 'Internal server error',
        message: 'An unexpected error occurred while marking notification as read',
      });
    }
  }
);

export default router;
