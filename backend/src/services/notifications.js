import { query } from '../config/database.js';
import { getIO } from '../sockets/index.js';

/**
 * Send a push notification to a user via Socket.IO
 * Falls back to storing for later delivery
 */
export async function notifyUser(userId, event, data) {
  try {
    const io = getIO();
    if (io) {
      io.to(`user:${userId}`).emit(event, data);
    }
  } catch (error) {
    console.error(`[Notify] Socket emit failed for user ${userId}:`, error.message);
  }
}

/**
 * Notify passenger about ride status changes
 */
export async function notifyRideUpdate(ride, event, extraData = {}) {
  const data = {
    rideId: ride.id,
    status: ride.status,
    ...extraData,
  };

  if (ride.passenger_id) {
    await notifyUser(ride.passenger_id, `ride:${event}`, data);
  }
  if (ride.driver_id) {
    await notifyUser(ride.driver_id, `ride:${event}`, data);
  }
}

/**
 * Notify a driver of a new ride offer
 */
export async function notifyRideOffer(driverId, rideOffer) {
  await notifyUser(driverId, 'ride:offer', {
    rideId: rideOffer.rideId,
    pickupAddress: rideOffer.pickupAddress,
    dropoffAddress: rideOffer.dropoffAddress,
    estimatedFare: rideOffer.estimatedFare,
    estimatedDistance: rideOffer.estimatedDistance,
    passengerRating: rideOffer.passengerRating,
    passengerName: rideOffer.passengerName,
    pickupDistanceKm: rideOffer.pickupDistanceKm,
    expiresIn: 15,
  });
}

/**
 * Notify about governance events
 */
export async function notifyGovernance(event, data) {
  try {
    const io = getIO();
    if (io) {
      io.emit(`governance:${event}`, data);
    }
  } catch (error) {
    console.error('[Notify] Governance notification failed:', error.message);
  }
}

/**
 * Send notification to all online drivers in an area
 */
export async function notifyNearbyDrivers(driverIds, event, data) {
  for (const driverId of driverIds) {
    await notifyUser(driverId, event, data);
  }
}

/**
 * Store FCM/APNs token for push notifications
 */
export async function registerPushToken(userId, token, platform) {
  try {
    await query(
      `INSERT INTO notification_tokens (user_id, token, platform)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, token) DO UPDATE SET platform = $3`,
      [userId, token, platform]
    );
    return true;
  } catch (error) {
    console.error('[Notify] Failed to register push token:', error.message);
    return false;
  }
}

/**
 * Remove a push token (on logout)
 */
export async function removePushToken(userId, token) {
  try {
    await query(
      'DELETE FROM notification_tokens WHERE user_id = $1 AND token = $2',
      [userId, token]
    );
    return true;
  } catch (error) {
    console.error('[Notify] Failed to remove push token:', error.message);
    return false;
  }
}

/**
 * Get a user's notification preferences.
 * Returns default preferences if the user has not customised them yet.
 *
 * @param {string} userId
 * @returns {Promise<object>}
 */
export async function getUserPreferences(userId) {
  const defaults = {
    ride_updates: true,
    promotions: true,
    chat_messages: true,
    safety_alerts: true,
    payment_updates: true,
    push_enabled: true,
    email_enabled: true,
    sms_enabled: false,
  };

  try {
    const result = await query(
      `SELECT ride_updates, promotions, chat_messages, safety_alerts,
              payment_updates, push_enabled, email_enabled, sms_enabled
       FROM notification_preferences
       WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return defaults;
    }

    return result.rows[0];
  } catch (error) {
    console.error('[Notify] Failed to fetch user preferences:', error.message);
    return defaults;
  }
}

/**
 * Category-to-preference field mapping.
 * Used by sendPushNotification to check whether the user has opted
 * in to a particular notification category.
 */
const CATEGORY_PREFERENCE_MAP = {
  ride: 'ride_updates',
  promotion: 'promotions',
  chat: 'chat_messages',
  safety: 'safety_alerts',
  payment: 'payment_updates',
};

/**
 * Send a full push notification to a user.
 *
 * 1. Checks user preferences — skips if the user has opted out of
 *    this notification category or has push disabled entirely.
 * 2. Saves the notification to the notification_history table.
 * 3. Emits a real-time event via Socket.IO.
 * 4. Fetches the user's Expo push tokens and sends via the Expo
 *    push notification API.
 *
 * @param {string} userId   - Recipient user ID
 * @param {string} title    - Notification title
 * @param {string} body     - Notification body text
 * @param {string} category - Category key (ride, promotion, chat, safety, payment)
 * @param {object} data     - Additional data payload
 * @returns {Promise<object>} The saved notification_history row
 */
export async function sendPushNotification(userId, title, body, category, data = {}) {
  // 1. Check user preferences
  const prefs = await getUserPreferences(userId);

  const prefField = CATEGORY_PREFERENCE_MAP[category];
  if (prefField && prefs[prefField] === false) {
    console.log(`[Notify] User ${userId} opted out of '${category}' notifications — skipping`);
    return null;
  }

  // 2. Save to notification_history
  let notification;
  try {
    const result = await query(
      `INSERT INTO notification_history (user_id, title, body, category, data)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, user_id, title, body, category, data, is_read, created_at`,
      [userId, title, body, category, JSON.stringify(data)]
    );
    notification = result.rows[0];
  } catch (error) {
    console.error('[Notify] Failed to save notification to history:', error.message);
    return null;
  }

  // 3. Emit via Socket.IO for real-time delivery
  try {
    const io = getIO();
    if (io) {
      io.to(`user:${userId}`).emit('notification:new', {
        id: notification.id,
        title: notification.title,
        body: notification.body,
        category: notification.category,
        data: notification.data,
        createdAt: notification.created_at,
      });
    }
  } catch (error) {
    console.error('[Notify] Socket emit failed for push notification:', error.message);
  }

  // 4. Send via Expo push API if user has push enabled
  if (prefs.push_enabled === false) {
    return notification;
  }

  try {
    const tokenResult = await query(
      `SELECT token, platform
       FROM notification_tokens
       WHERE user_id = $1`,
      [userId]
    );

    if (tokenResult.rows.length === 0) {
      return notification;
    }

    // Build Expo push messages for each registered token
    const messages = tokenResult.rows.map((row) => ({
      to: row.token,
      title,
      body,
      data: {
        category,
        notificationId: notification.id,
        ...data,
      },
      sound: 'default',
      priority: category === 'safety' ? 'high' : 'default',
      channelId: category || 'default',
    }));

    // Send to Expo push API in a single batch request
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Notify] Expo push API error (${response.status}):`, errorText);
    } else {
      const result = await response.json();

      // Check for individual ticket errors and clean up invalid tokens
      if (result.data && Array.isArray(result.data)) {
        for (let i = 0; i < result.data.length; i++) {
          const ticket = result.data[i];
          if (ticket.status === 'error') {
            console.error(
              `[Notify] Expo push ticket error for token ${tokenResult.rows[i].token}:`,
              ticket.message
            );

            // Remove invalid tokens (DeviceNotRegistered)
            if (ticket.details?.error === 'DeviceNotRegistered') {
              await removePushToken(userId, tokenResult.rows[i].token);
              console.log(
                `[Notify] Removed stale token for user ${userId}: ${tokenResult.rows[i].token}`
              );
            }
          }
        }
      }
    }
  } catch (error) {
    // Push delivery is best-effort — do not fail the whole operation
    console.error('[Notify] Failed to send Expo push notification:', error.message);
  }

  return notification;
}
