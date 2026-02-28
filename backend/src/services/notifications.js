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
