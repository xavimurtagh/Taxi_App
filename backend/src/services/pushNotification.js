import { query } from '../config/database.js';
import { getIO } from '../sockets/index.js';

// ---------------------------------------------------------------------------
// Expo Push Notification Service
// ---------------------------------------------------------------------------
// Sends push notifications via Expo's push notification service and persists
// every notification in `notification_history` for in-app display.
// ---------------------------------------------------------------------------

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/**
 * Validate that a token looks like a valid Expo push token.
 *
 * @param {string} token
 * @returns {boolean}
 */
function isExpoPushToken(token) {
  return (
    typeof token === 'string' &&
    (token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken['))
  );
}

// ---------------------------------------------------------------------------
// Preferences & quiet-hours helpers
// ---------------------------------------------------------------------------

/**
 * Fetch a user's notification preferences. Returns `null` if no row exists
 * (meaning the user has never customised their preferences, and all defaults
 * apply).
 *
 * @param {string} userId
 * @returns {Promise<object|null>}
 */
async function getUserPreferences(userId) {
  const result = await query(
    `SELECT ride_updates, chat_messages, governance_updates, promotions,
            scheduled_ride_reminders, referral_updates,
            quiet_hours_start, quiet_hours_end
     FROM notification_preferences
     WHERE user_id = $1`,
    [userId],
  );
  return result.rows.length > 0 ? result.rows[0] : null;
}

/**
 * Check whether the current time falls within the user's quiet hours.
 * Handles the case where quiet hours span midnight (e.g. 22:00 - 07:00).
 *
 * @param {object|null} prefs - notification_preferences row
 * @returns {boolean}
 */
function isQuietHours(prefs) {
  if (!prefs || !prefs.quiet_hours_start || !prefs.quiet_hours_end) {
    return false;
  }

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const [startH, startM] = String(prefs.quiet_hours_start).split(':').map(Number);
  const [endH, endM] = String(prefs.quiet_hours_end).split(':').map(Number);
  const startMinutes = startH * 60 + (startM || 0);
  const endMinutes = endH * 60 + (endM || 0);

  if (startMinutes <= endMinutes) {
    // Same-day range (e.g. 09:00 - 17:00)
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  }
  // Overnight range (e.g. 22:00 - 07:00)
  return currentMinutes >= startMinutes || currentMinutes < endMinutes;
}

/**
 * Map a notification category to the corresponding preference column.
 *
 * @param {string} category
 * @returns {string|null} column name, or null if no preference applies
 */
function categoryToPreferenceKey(category) {
  const map = {
    ride: 'ride_updates',
    chat: 'chat_messages',
    governance: 'governance_updates',
    promotion: 'promotions',
    scheduled: 'scheduled_ride_reminders',
    referral: 'referral_updates',
  };
  return map[category] || null;
}

/**
 * Determine whether a user has opted in for a given notification category.
 *
 * @param {object|null} prefs
 * @param {string} category
 * @returns {boolean}
 */
function isCategoryAllowed(prefs, category) {
  if (!prefs) {
    // No preferences row means all defaults apply (true for everything
    // except promotions, which defaults to false in the schema).
    return category !== 'promotion';
  }

  const key = categoryToPreferenceKey(category);
  if (!key) {
    // Unknown category — allow by default (e.g. 'system')
    return true;
  }

  return prefs[key] !== false;
}

// ---------------------------------------------------------------------------
// Core send function
// ---------------------------------------------------------------------------

/**
 * Send a push notification to all of a user's registered devices.
 *
 * - Checks notification preferences and quiet hours before sending.
 * - Stores the notification in `notification_history`.
 * - Dispatches the actual push via Expo's push API.
 * - Also emits a `notification:new` socket event for real-time in-app display.
 *
 * @param {string} userId
 * @param {object} notification
 * @param {string} notification.title
 * @param {string} notification.body
 * @param {object} [notification.data]     - Arbitrary JSON payload for the client
 * @param {string} [notification.category] - 'ride' | 'chat' | 'governance' | 'promotion' | 'scheduled' | 'referral' | 'system'
 * @returns {Promise<object>} The saved notification_history row
 */
export async function sendPushNotification(userId, { title, body, data = {}, category = 'system' }) {
  // 1. Always persist to notification_history regardless of preferences
  const historyResult = await query(
    `INSERT INTO notification_history (user_id, title, body, category, data)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, user_id, title, body, category, data, read, sent_at`,
    [userId, title, body, category, JSON.stringify(data)],
  );

  const notification = historyResult.rows[0];

  // 2. Emit real-time socket event for in-app display
  try {
    const io = getIO();
    if (io) {
      io.to(`user:${userId}`).emit('notification:new', {
        id: notification.id,
        title: notification.title,
        body: notification.body,
        category: notification.category,
        data: notification.data,
        sentAt: notification.sent_at,
      });
    }
  } catch (err) {
    console.error('[pushNotification] Socket emit failed:', err.message);
  }

  // 3. Check user preferences — skip the actual push if the category is
  //    disabled or if quiet hours are active.
  try {
    const prefs = await getUserPreferences(userId);

    if (!isCategoryAllowed(prefs, category)) {
      console.log(`[pushNotification] Category '${category}' disabled for user ${userId} — skipping push`);
      return notification;
    }

    if (isQuietHours(prefs)) {
      console.log(`[pushNotification] Quiet hours active for user ${userId} — skipping push`);
      return notification;
    }
  } catch (err) {
    console.error('[pushNotification] Failed to check preferences:', err.message);
    // Continue — preference check is non-critical
  }

  // 4. Fetch the user's registered push tokens
  let tokens;
  try {
    const tokenResult = await query(
      `SELECT token, platform FROM notification_tokens WHERE user_id = $1`,
      [userId],
    );
    tokens = tokenResult.rows;
  } catch (err) {
    console.error('[pushNotification] Failed to fetch tokens:', err.message);
    return notification;
  }

  if (!tokens || tokens.length === 0) {
    return notification;
  }

  // 5. Build Expo push messages for each valid token
  const messages = tokens
    .filter((t) => isExpoPushToken(t.token))
    .map((t) => ({
      to: t.token,
      sound: 'default',
      title,
      body,
      data: { ...data, notificationId: notification.id },
      categoryId: category,
    }));

  if (messages.length === 0) {
    return notification;
  }

  // 6. Send to Expo push API
  try {
    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[pushNotification] Expo API error (${response.status}):`, errorText);
    } else {
      const result = await response.json();
      // Log any per-ticket errors from Expo
      if (result.data) {
        for (const ticket of result.data) {
          if (ticket.status === 'error') {
            console.error('[pushNotification] Expo ticket error:', ticket.message, ticket.details);
          }
        }
      }
    }
  } catch (err) {
    console.error('[pushNotification] Failed to send via Expo:', err.message);
  }

  return notification;
}

// ---------------------------------------------------------------------------
// Bulk send
// ---------------------------------------------------------------------------

/**
 * Send the same notification to multiple users.
 *
 * @param {string[]} userIds
 * @param {object} notification - { title, body, data?, category? }
 * @returns {Promise<object[]>} Array of saved notification_history rows
 */
export async function sendBulkPushNotifications(userIds, notification) {
  const results = await Promise.allSettled(
    userIds.map((userId) => sendPushNotification(userId, notification)),
  );

  return results
    .filter((r) => r.status === 'fulfilled')
    .map((r) => r.value);
}

// ---------------------------------------------------------------------------
// Convenience wrappers
// ---------------------------------------------------------------------------

/**
 * Send a notification for a ride lifecycle event.
 *
 * @param {string} userId    - Recipient
 * @param {string} rideEvent - Human-readable event (e.g. 'driver_assigned', 'ride_completed')
 * @param {object} rideData  - Context data (rideId, driverName, etc.)
 * @returns {Promise<object>}
 */
export async function sendRideNotification(userId, rideEvent, rideData = {}) {
  const eventMessages = {
    driver_assigned: {
      title: 'Driver Assigned',
      body: rideData.driverName
        ? `${rideData.driverName} is on the way to pick you up.`
        : 'A driver has been assigned to your ride.',
    },
    driver_arriving: {
      title: 'Driver Arriving',
      body: 'Your driver is almost at the pickup location.',
    },
    ride_started: {
      title: 'Ride Started',
      body: 'Your ride is now in progress. Enjoy your trip!',
    },
    ride_completed: {
      title: 'Ride Completed',
      body: rideData.fare
        ? `Your ride is complete. Total fare: $${rideData.fare}.`
        : 'Your ride has been completed.',
    },
    ride_cancelled: {
      title: 'Ride Cancelled',
      body: rideData.cancelledBy
        ? `Your ride was cancelled by the ${rideData.cancelledBy}.`
        : 'Your ride has been cancelled.',
    },
    driver_cancelled: {
      title: 'Driver Cancelled',
      body: 'Your driver had to cancel. We are looking for another driver.',
    },
    no_drivers_available: {
      title: 'No Drivers Available',
      body: 'We could not find a driver for your ride. Please try again shortly.',
    },
  };

  const msg = eventMessages[rideEvent] || {
    title: 'Ride Update',
    body: `Your ride status has been updated: ${rideEvent}`,
  };

  return sendPushNotification(userId, {
    title: msg.title,
    body: msg.body,
    data: { rideEvent, ...rideData },
    category: 'ride',
  });
}

/**
 * Send a chat message notification.
 *
 * @param {string} userId     - Recipient (the other participant)
 * @param {string} senderName - Display name of the message sender
 * @param {string} message    - The message text (truncated for the push body)
 * @param {string} rideId     - Associated ride
 * @returns {Promise<object>}
 */
export async function sendChatNotification(userId, senderName, message, rideId) {
  const truncatedMessage =
    message.length > 100 ? `${message.substring(0, 97)}...` : message;

  return sendPushNotification(userId, {
    title: `Message from ${senderName}`,
    body: truncatedMessage,
    data: { rideId, senderName, type: 'chat_message' },
    category: 'chat',
  });
}

/**
 * Send a reminder for a scheduled ride.
 *
 * @param {string} userId
 * @param {object} scheduledRide - { id, pickup_address, dropoff_address, scheduled_time }
 * @returns {Promise<object>}
 */
export async function sendScheduledRideReminder(userId, scheduledRide) {
  const scheduledTime = new Date(scheduledRide.scheduled_time);
  const timeStr = scheduledTime.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  return sendPushNotification(userId, {
    title: 'Upcoming Ride Reminder',
    body: `Your ride to ${scheduledRide.dropoff_address || 'your destination'} is scheduled for ${timeStr}.`,
    data: {
      scheduledRideId: scheduledRide.id,
      scheduledTime: scheduledRide.scheduled_time,
      pickupAddress: scheduledRide.pickup_address,
      dropoffAddress: scheduledRide.dropoff_address,
      type: 'scheduled_ride_reminder',
    },
    category: 'scheduled',
  });
}
