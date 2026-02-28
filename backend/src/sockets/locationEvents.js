import redis from '../config/redis.js';

/**
 * Redis key used by GEOADD / GEOSEARCH to index driver positions.
 */
const DRIVER_LOCATIONS_KEY = 'driver:locations';

/**
 * Redis key prefix for per-driver metadata (heading, speed, timestamp).
 */
const DRIVER_META_PREFIX = 'driver:meta:';

/**
 * Register location-related socket events for a connected client.
 *
 * Drivers push their GPS coordinates through `location:update`; the
 * position is persisted in Redis (GEOADD) for proximity queries, and
 * if the driver has an active ride, the updated location is forwarded
 * to the passenger in real time.
 *
 * @param {import('socket.io').Server} io
 * @param {import('socket.io').Socket} socket
 */
export function registerLocationEvents(io, socket) {
  const userId = socket.user.id;

  /**
   * location:update
   * Sent by drivers at regular intervals.
   * Payload: { lat, lng, heading?, speed?, rideId? }
   */
  socket.on('location:update', async (data) => {
    try {
      if (!data || typeof data.lat !== 'number' || typeof data.lng !== 'number') {
        return socket.emit('location:error', {
          message: 'Invalid payload: lat and lng (numbers) are required',
        });
      }

      const { lat, lng, heading, speed, rideId } = data;

      // Validate coordinate ranges
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return socket.emit('location:error', {
          message: 'Coordinates out of range: lat [-90,90], lng [-180,180]',
        });
      }

      // Store driver position in Redis geospatial index.
      // GEOADD key longitude latitude member
      await redis.geoadd(DRIVER_LOCATIONS_KEY, lng, lat, userId);

      // Store supplementary metadata with a TTL (5 minutes) so stale
      // entries are cleaned up automatically if the driver goes offline.
      const meta = JSON.stringify({
        lat,
        lng,
        heading: heading ?? null,
        speed: speed ?? null,
        updatedAt: new Date().toISOString(),
      });
      await redis.set(`${DRIVER_META_PREFIX}${userId}`, meta, 'EX', 300);

      // If the driver has an active ride, forward the location update to
      // everyone in the ride room (primarily the passenger).
      if (rideId) {
        io.to(`ride:${rideId}`).emit('location:driver_moved', {
          driverId: userId,
          lat,
          lng,
          heading: heading ?? null,
          speed: speed ?? null,
          updatedAt: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.error('[location] Error handling location:update:', err.message);
      socket.emit('location:error', {
        message: 'Failed to update location',
      });
    }
  });

  /**
   * location:subscribe
   * Sent by a passenger to start receiving real-time driver location
   * updates for their current ride.
   * Payload: { rideId }
   */
  socket.on('location:subscribe', (data) => {
    try {
      if (!data || !data.rideId) {
        return socket.emit('location:error', {
          message: 'Invalid payload: rideId is required',
        });
      }

      console.log(
        `[location] User ${userId} subscribed to location updates for ride ${data.rideId}`
      );

      // Join the ride room so the passenger receives location:driver_moved events
      socket.join(`ride:${data.rideId}`);

      socket.emit('location:subscribed', {
        rideId: data.rideId,
        message: 'You will now receive driver location updates',
      });
    } catch (err) {
      console.error('[location] Error handling location:subscribe:', err.message);
      socket.emit('location:error', {
        message: 'Failed to subscribe to location updates',
      });
    }
  });

  /**
   * location:unsubscribe
   * Sent by a passenger to stop receiving driver location updates.
   * Payload: { rideId }
   */
  socket.on('location:unsubscribe', (data) => {
    try {
      if (!data || !data.rideId) {
        return socket.emit('location:error', {
          message: 'Invalid payload: rideId is required',
        });
      }

      console.log(
        `[location] User ${userId} unsubscribed from location updates for ride ${data.rideId}`
      );

      socket.leave(`ride:${data.rideId}`);

      socket.emit('location:unsubscribed', {
        rideId: data.rideId,
        message: 'You will no longer receive driver location updates',
      });
    } catch (err) {
      console.error('[location] Error handling location:unsubscribe:', err.message);
      socket.emit('location:error', {
        message: 'Failed to unsubscribe from location updates',
      });
    }
  });

  /**
   * When the socket disconnects, clean up the driver's geospatial entry
   * so they stop appearing in nearby-driver queries.
   */
  socket.on('disconnect', async () => {
    if (socket.user.role === 'driver' || socket.user.role === 'both') {
      try {
        await redis.zrem(DRIVER_LOCATIONS_KEY, userId);
        await redis.del(`${DRIVER_META_PREFIX}${userId}`);
        console.log(`[location] Cleaned up location data for driver ${userId}`);
      } catch (err) {
        console.error(
          `[location] Failed to clean up location for driver ${userId}:`,
          err.message
        );
      }
    }
  });
}
