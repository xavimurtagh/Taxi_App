import { Router } from 'express';
import Joi from 'joi';
import { query } from '../config/database.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';

const router = Router();

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const updatePreferencesSchema = Joi.object({
  rideUpdates: Joi.boolean().optional(),
  chatMessages: Joi.boolean().optional(),
  governanceUpdates: Joi.boolean().optional(),
  promotions: Joi.boolean().optional(),
  scheduledRideReminders: Joi.boolean().optional(),
  referralUpdates: Joi.boolean().optional(),
  quietHoursStart: Joi.string()
    .pattern(/^([01]\d|2[0-3]):([0-5]\d)$/)
    .optional()
    .allow(null)
    .messages({
      'string.pattern.base': 'quietHoursStart must be in HH:MM format (24-hour)',
    }),
  quietHoursEnd: Joi.string()
    .pattern(/^([01]\d|2[0-3]):([0-5]\d)$/)
    .optional()
    .allow(null)
    .messages({
      'string.pattern.base': 'quietHoursEnd must be in HH:MM format (24-hour)',
    }),
}).min(1);

const registerTokenSchema = Joi.object({
  token: Joi.string().trim().min(1).max(500).required().messages({
    'any.required': 'Push token is required',
    'string.min': 'Push token cannot be empty',
  }),
  platform: Joi.string()
    .valid('ios', 'android', 'web')
    .required()
    .messages({
      'any.only': 'Platform must be one of: ios, android, web',
      'any.required': 'Platform is required',
    }),
});

const removeTokenSchema = Joi.object({
  token: Joi.string().trim().min(1).max(500).required().messages({
    'any.required': 'Push token is required',
    'string.min': 'Push token cannot be empty',
  }),
});

// ---------------------------------------------------------------------------
// GET / — Get user's notification history (paginated, with unread count)
// ---------------------------------------------------------------------------
router.get('/', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;
    const category = req.query.category || null;

    // Build WHERE clause
    let whereClause = 'WHERE nh.user_id = $1';
    const params = [userId];
    let paramIdx = 2;

    if (category) {
      whereClause += ` AND nh.category = $${paramIdx++}`;
      params.push(category);
    }

    // Total count (respects category filter)
    const countResult = await query(
      `SELECT COUNT(*)::int AS total FROM notification_history nh ${whereClause}`,
      params,
    );
    const total = countResult.rows[0].total;

    // Unread count (always for all notifications, not filtered by category)
    const unreadResult = await query(
      `SELECT COUNT(*)::int AS unread
       FROM notification_history
       WHERE user_id = $1 AND read = FALSE`,
      [userId],
    );
    const unreadCount = unreadResult.rows[0].unread;

    // Fetch paginated notifications
    const notificationsResult = await query(
      `SELECT nh.id, nh.title, nh.body, nh.category, nh.data,
              nh.read, nh.sent_at, nh.read_at
       FROM notification_history nh
       ${whereClause}
       ORDER BY nh.sent_at DESC
       LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
      [...params, limit, offset],
    );

    const notifications = notificationsResult.rows.map((row) => ({
      id: row.id,
      title: row.title,
      body: row.body,
      category: row.category,
      data: row.data,
      read: row.read,
      sentAt: row.sent_at,
      readAt: row.read_at,
    }));

    return res.status(200).json({
      notifications,
      unreadCount,
      total,
      page,
      limit,
    });
  } catch (err) {
    console.error('[notifications] GET / error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred while fetching notifications',
    });
  }
});

// ---------------------------------------------------------------------------
// PUT /:id/read — Mark a single notification as read
// ---------------------------------------------------------------------------
router.put('/:id/read', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const result = await query(
      `UPDATE notification_history
       SET read = TRUE, read_at = NOW()
       WHERE id = $1 AND user_id = $2 AND read = FALSE
       RETURNING id, title, body, category, data, read, sent_at, read_at`,
      [id, userId],
    );

    if (result.rows.length === 0) {
      // Check if notification exists at all for this user
      const existsResult = await query(
        `SELECT id, read FROM notification_history WHERE id = $1 AND user_id = $2`,
        [id, userId],
      );

      if (existsResult.rows.length === 0) {
        return res.status(404).json({
          error: 'Not found',
          message: 'Notification not found',
        });
      }

      // Already marked as read
      return res.status(200).json({
        message: 'Notification already marked as read',
      });
    }

    const row = result.rows[0];

    return res.status(200).json({
      message: 'Notification marked as read',
      notification: {
        id: row.id,
        title: row.title,
        body: row.body,
        category: row.category,
        data: row.data,
        read: row.read,
        sentAt: row.sent_at,
        readAt: row.read_at,
      },
    });
  } catch (err) {
    console.error('[notifications] PUT /:id/read error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred while marking the notification as read',
    });
  }
});

// ---------------------------------------------------------------------------
// PUT /read-all — Mark all notifications as read
// ---------------------------------------------------------------------------
router.put('/read-all', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await query(
      `UPDATE notification_history
       SET read = TRUE, read_at = NOW()
       WHERE user_id = $1 AND read = FALSE`,
      [userId],
    );

    return res.status(200).json({
      message: 'All notifications marked as read',
      updatedCount: result.rowCount,
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
// GET /preferences — Get notification preferences
// ---------------------------------------------------------------------------
router.get('/preferences', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await query(
      `SELECT ride_updates, chat_messages, governance_updates, promotions,
              scheduled_ride_reminders, referral_updates,
              quiet_hours_start, quiet_hours_end
       FROM notification_preferences
       WHERE user_id = $1`,
      [userId],
    );

    if (result.rows.length === 0) {
      // Return defaults matching the DB schema defaults
      return res.status(200).json({
        preferences: {
          rideUpdates: true,
          chatMessages: true,
          governanceUpdates: true,
          promotions: false,
          scheduledRideReminders: true,
          referralUpdates: true,
          quietHoursStart: null,
          quietHoursEnd: null,
        },
      });
    }

    const row = result.rows[0];

    return res.status(200).json({
      preferences: {
        rideUpdates: row.ride_updates,
        chatMessages: row.chat_messages,
        governanceUpdates: row.governance_updates,
        promotions: row.promotions,
        scheduledRideReminders: row.scheduled_ride_reminders,
        referralUpdates: row.referral_updates,
        quietHoursStart: row.quiet_hours_start || null,
        quietHoursEnd: row.quiet_hours_end || null,
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
// PUT /preferences — Update notification preferences
// ---------------------------------------------------------------------------
router.put(
  '/preferences',
  authenticate,
  validate(updatePreferencesSchema),
  async (req, res) => {
    try {
      const userId = req.user.id;
      const {
        rideUpdates,
        chatMessages,
        governanceUpdates,
        promotions,
        scheduledRideReminders,
        referralUpdates,
        quietHoursStart,
        quietHoursEnd,
      } = req.body;

      // Upsert: insert with defaults if row does not exist, otherwise update
      // only the fields that were provided (using COALESCE to preserve existing
      // values for omitted fields).
      const result = await query(
        `INSERT INTO notification_preferences (
           user_id, ride_updates, chat_messages, governance_updates,
           promotions, scheduled_ride_reminders, referral_updates,
           quiet_hours_start, quiet_hours_end
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (user_id) DO UPDATE SET
           ride_updates = COALESCE($2, notification_preferences.ride_updates),
           chat_messages = COALESCE($3, notification_preferences.chat_messages),
           governance_updates = COALESCE($4, notification_preferences.governance_updates),
           promotions = COALESCE($5, notification_preferences.promotions),
           scheduled_ride_reminders = COALESCE($6, notification_preferences.scheduled_ride_reminders),
           referral_updates = COALESCE($7, notification_preferences.referral_updates),
           quiet_hours_start = COALESCE($8, notification_preferences.quiet_hours_start),
           quiet_hours_end = COALESCE($9, notification_preferences.quiet_hours_end)
         RETURNING ride_updates, chat_messages, governance_updates, promotions,
                   scheduled_ride_reminders, referral_updates,
                   quiet_hours_start, quiet_hours_end`,
        [
          userId,
          rideUpdates ?? null,
          chatMessages ?? null,
          governanceUpdates ?? null,
          promotions ?? null,
          scheduledRideReminders ?? null,
          referralUpdates ?? null,
          quietHoursStart ?? null,
          quietHoursEnd ?? null,
        ],
      );

      const row = result.rows[0];

      return res.status(200).json({
        message: 'Notification preferences updated',
        preferences: {
          rideUpdates: row.ride_updates,
          chatMessages: row.chat_messages,
          governanceUpdates: row.governance_updates,
          promotions: row.promotions,
          scheduledRideReminders: row.scheduled_ride_reminders,
          referralUpdates: row.referral_updates,
          quietHoursStart: row.quiet_hours_start || null,
          quietHoursEnd: row.quiet_hours_end || null,
        },
      });
    } catch (err) {
      console.error('[notifications] PUT /preferences error:', err);
      return res.status(500).json({
        error: 'Internal server error',
        message: 'An unexpected error occurred while updating notification preferences',
      });
    }
  },
);

// ---------------------------------------------------------------------------
// POST /token — Register an Expo push token
// ---------------------------------------------------------------------------
router.post(
  '/token',
  authenticate,
  validate(registerTokenSchema),
  async (req, res) => {
    try {
      const userId = req.user.id;
      const { token, platform } = req.body;

      await query(
        `INSERT INTO notification_tokens (user_id, token, platform)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, token) DO UPDATE SET platform = $3`,
        [userId, token, platform],
      );

      return res.status(201).json({
        message: 'Push token registered successfully',
      });
    } catch (err) {
      console.error('[notifications] POST /token error:', err);
      return res.status(500).json({
        error: 'Internal server error',
        message: 'An unexpected error occurred while registering the push token',
      });
    }
  },
);

// ---------------------------------------------------------------------------
// DELETE /token — Remove a push token (on logout)
// ---------------------------------------------------------------------------
router.delete(
  '/token',
  authenticate,
  validate(removeTokenSchema),
  async (req, res) => {
    try {
      const userId = req.user.id;
      const { token } = req.body;

      const result = await query(
        `DELETE FROM notification_tokens
         WHERE user_id = $1 AND token = $2`,
        [userId, token],
      );

      if (result.rowCount === 0) {
        return res.status(404).json({
          error: 'Not found',
          message: 'Push token not found for this user',
        });
      }

      return res.status(200).json({
        message: 'Push token removed successfully',
      });
    } catch (err) {
      console.error('[notifications] DELETE /token error:', err);
      return res.status(500).json({
        error: 'Internal server error',
        message: 'An unexpected error occurred while removing the push token',
      });
    }
  },
);

export default router;
