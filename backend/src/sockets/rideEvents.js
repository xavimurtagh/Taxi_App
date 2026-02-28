/**
 * Register ride-lifecycle socket events for a connected client.
 *
 * These events complement the REST API — the REST endpoints handle
 * the heavy lifting (validation, persistence, payments), while the
 * socket layer keeps both parties informed in real time.
 *
 * @param {import('socket.io').Server} io
 * @param {import('socket.io').Socket} socket
 */
export function registerRideEvents(io, socket) {
  const userId = socket.user.id;

  /**
   * ride:request
   * Emitted by a passenger to notify drivers that a new ride is available.
   * Payload: { rideId, pickupLat, pickupLng, pickupAddress, dropoffAddress,
   *            vehicleType, estimatedFare }
   */
  socket.on('ride:request', (data) => {
    try {
      if (!data || !data.rideId) {
        return socket.emit('ride:error', {
          message: 'Invalid ride request payload: rideId is required',
        });
      }

      console.log(`[ride] Ride requested by ${userId}: ${data.rideId}`);

      // Join the passenger to the ride room so they receive updates
      socket.join(`ride:${data.rideId}`);

      // Broadcast the new ride request to all available drivers
      io.to('drivers').emit('ride:new', {
        rideId: data.rideId,
        passengerId: userId,
        pickupLat: data.pickupLat,
        pickupLng: data.pickupLng,
        pickupAddress: data.pickupAddress,
        dropoffAddress: data.dropoffAddress,
        vehicleType: data.vehicleType,
        estimatedFare: data.estimatedFare,
        requestedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error('[ride] Error handling ride:request:', err.message);
      socket.emit('ride:error', { message: 'Failed to process ride request' });
    }
  });

  /**
   * ride:accept
   * Emitted by a driver to accept a ride offer.
   * Payload: { rideId, driverLat, driverLng, estimatedArrival }
   */
  socket.on('ride:accept', (data) => {
    try {
      if (!data || !data.rideId) {
        return socket.emit('ride:error', {
          message: 'Invalid payload: rideId is required',
        });
      }

      console.log(`[ride] Ride ${data.rideId} accepted by driver ${userId}`);

      // Driver joins the ride room
      socket.join(`ride:${data.rideId}`);

      // Notify everyone in the ride room (passenger + driver)
      io.to(`ride:${data.rideId}`).emit('ride:accepted', {
        rideId: data.rideId,
        driverId: userId,
        driverLat: data.driverLat,
        driverLng: data.driverLng,
        estimatedArrival: data.estimatedArrival,
        acceptedAt: new Date().toISOString(),
      });

      // Notify other drivers that this ride is no longer available
      socket.to('drivers').emit('ride:unavailable', {
        rideId: data.rideId,
      });
    } catch (err) {
      console.error('[ride] Error handling ride:accept:', err.message);
      socket.emit('ride:error', { message: 'Failed to accept ride' });
    }
  });

  /**
   * ride:decline
   * Emitted by a driver to decline a ride offer.
   * Payload: { rideId, reason? }
   */
  socket.on('ride:decline', (data) => {
    try {
      if (!data || !data.rideId) {
        return socket.emit('ride:error', {
          message: 'Invalid payload: rideId is required',
        });
      }

      console.log(`[ride] Ride ${data.rideId} declined by driver ${userId}`);

      // Acknowledge back to the driver
      socket.emit('ride:declined', {
        rideId: data.rideId,
        driverId: userId,
        declinedAt: new Date().toISOString(),
      });

      // Notify the ride room (passenger) that this driver passed
      io.to(`ride:${data.rideId}`).emit('ride:driver_declined', {
        rideId: data.rideId,
        driverId: userId,
        reason: data.reason || null,
      });
    } catch (err) {
      console.error('[ride] Error handling ride:decline:', err.message);
      socket.emit('ride:error', { message: 'Failed to decline ride' });
    }
  });

  /**
   * ride:cancel
   * Emitted by either party to cancel an active ride.
   * Payload: { rideId, reason? }
   */
  socket.on('ride:cancel', (data) => {
    try {
      if (!data || !data.rideId) {
        return socket.emit('ride:error', {
          message: 'Invalid payload: rideId is required',
        });
      }

      console.log(`[ride] Ride ${data.rideId} cancelled by ${userId}`);

      io.to(`ride:${data.rideId}`).emit('ride:cancelled', {
        rideId: data.rideId,
        cancelledBy: userId,
        reason: data.reason || null,
        cancelledAt: new Date().toISOString(),
      });

      // Remove all sockets from the ride room
      io.in(`ride:${data.rideId}`).socketsLeave(`ride:${data.rideId}`);
    } catch (err) {
      console.error('[ride] Error handling ride:cancel:', err.message);
      socket.emit('ride:error', { message: 'Failed to cancel ride' });
    }
  });

  /**
   * ride:arrived
   * Emitted by the driver when they have arrived at the pickup location.
   * Payload: { rideId }
   */
  socket.on('ride:arrived', (data) => {
    try {
      if (!data || !data.rideId) {
        return socket.emit('ride:error', {
          message: 'Invalid payload: rideId is required',
        });
      }

      console.log(`[ride] Driver ${userId} arrived for ride ${data.rideId}`);

      io.to(`ride:${data.rideId}`).emit('ride:driver_arrived', {
        rideId: data.rideId,
        driverId: userId,
        arrivedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error('[ride] Error handling ride:arrived:', err.message);
      socket.emit('ride:error', { message: 'Failed to process arrival' });
    }
  });

  /**
   * ride:start
   * Emitted by the driver when the passenger has been picked up and the
   * ride has begun.
   * Payload: { rideId }
   */
  socket.on('ride:start', (data) => {
    try {
      if (!data || !data.rideId) {
        return socket.emit('ride:error', {
          message: 'Invalid payload: rideId is required',
        });
      }

      console.log(`[ride] Ride ${data.rideId} started by driver ${userId}`);

      io.to(`ride:${data.rideId}`).emit('ride:started', {
        rideId: data.rideId,
        driverId: userId,
        startedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error('[ride] Error handling ride:start:', err.message);
      socket.emit('ride:error', { message: 'Failed to start ride' });
    }
  });

  /**
   * ride:complete
   * Emitted by the driver when the ride has reached the destination.
   * Payload: { rideId, finalFare?, distanceKm?, durationMinutes? }
   */
  socket.on('ride:complete', (data) => {
    try {
      if (!data || !data.rideId) {
        return socket.emit('ride:error', {
          message: 'Invalid payload: rideId is required',
        });
      }

      console.log(`[ride] Ride ${data.rideId} completed by driver ${userId}`);

      io.to(`ride:${data.rideId}`).emit('ride:completed', {
        rideId: data.rideId,
        driverId: userId,
        finalFare: data.finalFare || null,
        distanceKm: data.distanceKm || null,
        durationMinutes: data.durationMinutes || null,
        completedAt: new Date().toISOString(),
      });

      // Clean up: remove everyone from the ride room
      io.in(`ride:${data.rideId}`).socketsLeave(`ride:${data.rideId}`);
    } catch (err) {
      console.error('[ride] Error handling ride:complete:', err.message);
      socket.emit('ride:error', { message: 'Failed to complete ride' });
    }
  });
}
