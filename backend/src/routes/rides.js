import { Router } from 'express';
import { query } from '../config/database.js';
import redis from '../config/redis.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import { rideRequestSchema } from '../utils/validators.js';
import { calculateFare } from '../utils/fareCalculator.js';
import { estimateFare } from '../services/pricing.js';
import { matchRide, acceptRide, declineRide } from '../services/matching.js';
import { getIO } from '../sockets/index.js';

const router = Router();

// ---------------------------------------------------------------------------
// POST / — Request a new ride
// ---------------------------------------------------------------------------
router.post(
  '/',
  authenticate,
  validate(rideRequestSchema),
  async (req, res) => {
    try {
      const {
        pickupLat,
        pickupLng,
        pickupAddress,
        dropoffLat,
        dropoffLng,
        dropoffAddress,
        vehicleType,
      } = req.body;

      const passengerId = req.user.id;

      // Check if passenger already has an active ride
      const activeRide = await query(
        `SELECT id, status FROM rides
         WHERE passenger_id = $1
           AND status NOT IN ('completed', 'cancelled')
         LIMIT 1`,
        [passengerId]
      );

      if (activeRide.rows.length > 0) {
        return res.status(409).json({
          error: 'Conflict',
          message: 'You already have an active ride. Please complete or cancel it before requesting a new one.',
          activeRideId: activeRide.rows[0].id,
        });
      }

      // Get fare estimate
      const fareEstimate = await estimateFare(
        pickupLat,
        pickupLng,
        dropoffLat,
        dropoffLng,
        vehicleType
      );

      // Insert the ride into the database
      const rideResult = await query(
        `INSERT INTO rides (
           passenger_id, status,
           pickup_location, pickup_address,
           dropoff_location, dropoff_address,
           vehicle_type,
           estimated_fare, estimated_distance, estimated_duration,
           surge_multiplier,
           requested_at
         )
         VALUES (
           $1, 'requested',
           ST_MakePoint($2, $3)::geography, $4,
           ST_MakePoint($5, $6)::geography, $7,
           $8,
           $9, $10, $11,
           $12,
           NOW()
         )
         RETURNING id, passenger_id, status,
                   ST_Y(pickup_location::geometry) AS pickup_lat,
                   ST_X(pickup_location::geometry) AS pickup_lng,
                   pickup_address,
                   ST_Y(dropoff_location::geometry) AS dropoff_lat,
                   ST_X(dropoff_location::geometry) AS dropoff_lng,
                   dropoff_address,
                   vehicle_type, estimated_fare, estimated_distance,
                   estimated_duration, surge_multiplier, requested_at`,
        [
          passengerId,
          pickupLng, pickupLat, pickupAddress,
          dropoffLng, dropoffLat, dropoffAddress,
          vehicleType,
          fareEstimate.fare,
          fareEstimate.estimatedDistance,
          fareEstimate.estimatedDuration,
          fareEstimate.surgeMultiplier,
        ]
      );

      const ride = rideResult.rows[0];

      // Start the matching process in the background — do NOT await it fully
      matchRide(ride.id, pickupLat, pickupLng, vehicleType).catch((err) => {
        console.error(`[rides] Background matching failed for ride ${ride.id}:`, err.message);
      });

      return res.status(201).json({
        ride: {
          id: ride.id,
          passengerId: ride.passenger_id,
          status: ride.status,
          pickupLat: ride.pickup_lat,
          pickupLng: ride.pickup_lng,
          pickupAddress: ride.pickup_address,
          dropoffLat: ride.dropoff_lat,
          dropoffLng: ride.dropoff_lng,
          dropoffAddress: ride.dropoff_address,
          vehicleType: ride.vehicle_type,
          estimatedFare: ride.estimated_fare,
          estimatedDistance: ride.estimated_distance,
          estimatedDuration: ride.estimated_duration,
          surgeMultiplier: ride.surge_multiplier,
          requestedAt: ride.requested_at,
        },
        fareEstimate: {
          fare: fareEstimate.fare,
          platformFee: fareEstimate.platformFee,
          driverPayout: fareEstimate.driverPayout,
          breakdown: fareEstimate.breakdown,
          surgeMultiplier: fareEstimate.surgeMultiplier,
          estimatedDistance: fareEstimate.estimatedDistance,
          estimatedDuration: fareEstimate.estimatedDuration,
        },
      });
    } catch (err) {
      console.error('[rides] POST / error:', err);
      return res.status(500).json({
        error: 'Internal server error',
        message: 'An unexpected error occurred while requesting the ride',
      });
    }
  }
);

// ---------------------------------------------------------------------------
// GET /estimate — Fare estimate without creating a ride
// ---------------------------------------------------------------------------
router.get('/estimate', authenticate, async (req, res) => {
  try {
    const { pickupLat, pickupLng, dropoffLat, dropoffLng, vehicleType } = req.query;

    // Validate required query parameters
    const lat1 = parseFloat(pickupLat);
    const lng1 = parseFloat(pickupLng);
    const lat2 = parseFloat(dropoffLat);
    const lng2 = parseFloat(dropoffLng);

    if (isNaN(lat1) || isNaN(lng1) || isNaN(lat2) || isNaN(lng2)) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'pickupLat, pickupLng, dropoffLat, and dropoffLng are required and must be valid numbers',
      });
    }

    if (lat1 < -90 || lat1 > 90 || lat2 < -90 || lat2 > 90) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Latitude values must be between -90 and 90',
      });
    }

    if (lng1 < -180 || lng1 > 180 || lng2 < -180 || lng2 > 180) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Longitude values must be between -180 and 180',
      });
    }

    const estimate = await estimateFare(
      lat1,
      lng1,
      lat2,
      lng2,
      vehicleType || 'economy'
    );

    return res.status(200).json({
      estimatedDistance: estimate.estimatedDistance,
      estimatedDuration: estimate.estimatedDuration,
      fare: estimate.fare,
      platformFee: estimate.platformFee,
      driverPayout: estimate.driverPayout,
      breakdown: estimate.breakdown,
      surgeMultiplier: estimate.surgeMultiplier,
    });
  } catch (err) {
    console.error('[rides] GET /estimate error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred while estimating the fare',
    });
  }
});

// ---------------------------------------------------------------------------
// GET /active — Current user's active ride
// ---------------------------------------------------------------------------
router.get('/active', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await query(
      `SELECT r.id, r.passenger_id, r.driver_id, r.status,
              ST_Y(r.pickup_location::geometry) AS pickup_lat,
              ST_X(r.pickup_location::geometry) AS pickup_lng,
              r.pickup_address,
              ST_Y(r.dropoff_location::geometry) AS dropoff_lat,
              ST_X(r.dropoff_location::geometry) AS dropoff_lng,
              r.dropoff_address,
              r.vehicle_type, r.estimated_fare, r.estimated_distance,
              r.estimated_duration, r.surge_multiplier,
              r.actual_fare, r.actual_distance, r.actual_duration,
              r.requested_at, r.matched_at, r.pickup_at, r.dropoff_at,
              r.cancelled_at, r.cancellation_fee, r.cancelled_by,
              u.first_name AS driver_first_name,
              u.last_name AS driver_last_name,
              u.phone AS driver_phone,
              u.avatar_url AS driver_avatar_url,
              dp.vehicle_make, dp.vehicle_model, dp.vehicle_year,
              dp.vehicle_color, dp.vehicle_plate, dp.vehicle_type AS driver_vehicle_type,
              dp.rating AS driver_rating
       FROM rides r
       LEFT JOIN users u ON u.id = r.driver_id
       LEFT JOIN driver_profiles dp ON dp.user_id = r.driver_id
       WHERE (r.passenger_id = $1 OR r.driver_id = $1)
         AND r.status NOT IN ('completed', 'cancelled')
       ORDER BY r.requested_at DESC
       LIMIT 1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(200).json({ ride: null });
    }

    const row = result.rows[0];

    const ride = {
      id: row.id,
      passengerId: row.passenger_id,
      driverId: row.driver_id,
      status: row.status,
      pickupLat: row.pickup_lat,
      pickupLng: row.pickup_lng,
      pickupAddress: row.pickup_address,
      dropoffLat: row.dropoff_lat,
      dropoffLng: row.dropoff_lng,
      dropoffAddress: row.dropoff_address,
      vehicleType: row.vehicle_type,
      estimatedFare: row.estimated_fare,
      estimatedDistance: row.estimated_distance,
      estimatedDuration: row.estimated_duration,
      surgeMultiplier: row.surge_multiplier,
      actualFare: row.actual_fare,
      actualDistance: row.actual_distance,
      actualDuration: row.actual_duration,
      requestedAt: row.requested_at,
      matchedAt: row.matched_at,
      pickupAt: row.pickup_at,
      dropoffAt: row.dropoff_at,
      cancelledAt: row.cancelled_at,
      cancellationFee: row.cancellation_fee,
      cancelledBy: row.cancelled_by,
    };

    // Include driver info if matched
    if (row.driver_id) {
      ride.driver = {
        id: row.driver_id,
        firstName: row.driver_first_name,
        lastName: row.driver_last_name,
        phone: row.driver_phone,
        avatarUrl: row.driver_avatar_url,
        vehicleMake: row.vehicle_make,
        vehicleModel: row.vehicle_model,
        vehicleYear: row.vehicle_year,
        vehicleColor: row.vehicle_color,
        vehiclePlate: row.vehicle_plate,
        vehicleType: row.driver_vehicle_type,
        rating: row.driver_rating,
      };
    }

    return res.status(200).json({ ride });
  } catch (err) {
    console.error('[rides] GET /active error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred while fetching the active ride',
    });
  }
});

// ---------------------------------------------------------------------------
// GET /history — Ride history with pagination
// ---------------------------------------------------------------------------
router.get('/history', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;

    // Count total rides for this user
    const countResult = await query(
      `SELECT COUNT(*)::int AS total
       FROM rides
       WHERE passenger_id = $1 OR driver_id = $1`,
      [userId]
    );

    const total = countResult.rows[0].total;

    // Fetch paginated rides
    const ridesResult = await query(
      `SELECT r.id, r.passenger_id, r.driver_id, r.status,
              ST_Y(r.pickup_location::geometry) AS pickup_lat,
              ST_X(r.pickup_location::geometry) AS pickup_lng,
              r.pickup_address,
              ST_Y(r.dropoff_location::geometry) AS dropoff_lat,
              ST_X(r.dropoff_location::geometry) AS dropoff_lng,
              r.dropoff_address,
              r.vehicle_type, r.estimated_fare, r.actual_fare,
              r.estimated_distance, r.actual_distance,
              r.estimated_duration, r.actual_duration,
              r.surge_multiplier,
              r.requested_at, r.matched_at, r.pickup_at, r.dropoff_at,
              r.cancelled_at, r.cancellation_fee
       FROM rides r
       WHERE r.passenger_id = $1 OR r.driver_id = $1
       ORDER BY r.requested_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    const rides = ridesResult.rows.map((row) => ({
      id: row.id,
      passengerId: row.passenger_id,
      driverId: row.driver_id,
      status: row.status,
      pickupLat: row.pickup_lat,
      pickupLng: row.pickup_lng,
      pickupAddress: row.pickup_address,
      dropoffLat: row.dropoff_lat,
      dropoffLng: row.dropoff_lng,
      dropoffAddress: row.dropoff_address,
      vehicleType: row.vehicle_type,
      estimatedFare: row.estimated_fare,
      actualFare: row.actual_fare,
      estimatedDistance: row.estimated_distance,
      actualDistance: row.actual_distance,
      estimatedDuration: row.estimated_duration,
      actualDuration: row.actual_duration,
      surgeMultiplier: row.surge_multiplier,
      requestedAt: row.requested_at,
      matchedAt: row.matched_at,
      pickupAt: row.pickup_at,
      dropoffAt: row.dropoff_at,
      cancelledAt: row.cancelled_at,
      cancellationFee: row.cancellation_fee,
    }));

    return res.status(200).json({
      rides,
      total,
      page,
      limit,
    });
  } catch (err) {
    console.error('[rides] GET /history error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred while fetching ride history',
    });
  }
});

// ---------------------------------------------------------------------------
// GET /:id — Get ride by ID
// ---------------------------------------------------------------------------
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const result = await query(
      `SELECT r.id, r.passenger_id, r.driver_id, r.status,
              ST_Y(r.pickup_location::geometry) AS pickup_lat,
              ST_X(r.pickup_location::geometry) AS pickup_lng,
              r.pickup_address,
              ST_Y(r.dropoff_location::geometry) AS dropoff_lat,
              ST_X(r.dropoff_location::geometry) AS dropoff_lng,
              r.dropoff_address,
              r.vehicle_type, r.estimated_fare, r.actual_fare,
              r.estimated_distance, r.actual_distance,
              r.estimated_duration, r.actual_duration,
              r.surge_multiplier, r.platform_fee, r.driver_payout,
              r.requested_at, r.matched_at, r.pickup_at, r.dropoff_at,
              r.cancelled_at, r.cancellation_fee, r.cancelled_by,
              r.cancellation_reason,
              -- Passenger info
              pu.first_name AS passenger_first_name,
              pu.last_name AS passenger_last_name,
              pu.phone AS passenger_phone,
              pu.avatar_url AS passenger_avatar_url,
              -- Driver info
              du.first_name AS driver_first_name,
              du.last_name AS driver_last_name,
              du.phone AS driver_phone,
              du.avatar_url AS driver_avatar_url,
              dp.vehicle_make, dp.vehicle_model, dp.vehicle_year,
              dp.vehicle_color, dp.vehicle_plate,
              dp.vehicle_type AS driver_vehicle_type,
              dp.rating AS driver_rating, dp.total_rides AS driver_total_rides
       FROM rides r
       JOIN users pu ON pu.id = r.passenger_id
       LEFT JOIN users du ON du.id = r.driver_id
       LEFT JOIN driver_profiles dp ON dp.user_id = r.driver_id
       WHERE r.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Ride not found',
      });
    }

    const row = result.rows[0];

    // Verify the requesting user is either the passenger or driver
    if (row.passenger_id !== userId && row.driver_id !== userId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You are not authorized to view this ride',
      });
    }

    const ride = {
      id: row.id,
      passengerId: row.passenger_id,
      driverId: row.driver_id,
      status: row.status,
      pickupLat: row.pickup_lat,
      pickupLng: row.pickup_lng,
      pickupAddress: row.pickup_address,
      dropoffLat: row.dropoff_lat,
      dropoffLng: row.dropoff_lng,
      dropoffAddress: row.dropoff_address,
      vehicleType: row.vehicle_type,
      estimatedFare: row.estimated_fare,
      actualFare: row.actual_fare,
      estimatedDistance: row.estimated_distance,
      actualDistance: row.actual_distance,
      estimatedDuration: row.estimated_duration,
      actualDuration: row.actual_duration,
      surgeMultiplier: row.surge_multiplier,
      platformFee: row.platform_fee,
      driverPayout: row.driver_payout,
      requestedAt: row.requested_at,
      matchedAt: row.matched_at,
      pickupAt: row.pickup_at,
      dropoffAt: row.dropoff_at,
      cancelledAt: row.cancelled_at,
      cancellationFee: row.cancellation_fee,
      cancelledBy: row.cancelled_by,
      cancellationReason: row.cancellation_reason,
      passenger: {
        id: row.passenger_id,
        firstName: row.passenger_first_name,
        lastName: row.passenger_last_name,
        phone: row.passenger_phone,
        avatarUrl: row.passenger_avatar_url,
      },
    };

    if (row.driver_id) {
      ride.driver = {
        id: row.driver_id,
        firstName: row.driver_first_name,
        lastName: row.driver_last_name,
        phone: row.driver_phone,
        avatarUrl: row.driver_avatar_url,
        vehicleMake: row.vehicle_make,
        vehicleModel: row.vehicle_model,
        vehicleYear: row.vehicle_year,
        vehicleColor: row.vehicle_color,
        vehiclePlate: row.vehicle_plate,
        vehicleType: row.driver_vehicle_type,
        rating: row.driver_rating,
        totalRides: row.driver_total_rides,
      };
    }

    return res.status(200).json(ride);
  } catch (err) {
    console.error('[rides] GET /:id error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred while fetching the ride',
    });
  }
});

// ---------------------------------------------------------------------------
// POST /:id/accept — Driver accepts a ride
// ---------------------------------------------------------------------------
router.post(
  '/:id/accept',
  authenticate,
  requireRole('driver', 'both'),
  async (req, res) => {
    try {
      const { id: rideId } = req.params;
      const driverId = req.user.id;

      // Verify the ride exists and is in 'requested' status
      const rideCheck = await query(
        `SELECT id, status, passenger_id FROM rides WHERE id = $1`,
        [rideId]
      );

      if (rideCheck.rows.length === 0) {
        return res.status(404).json({
          error: 'Not found',
          message: 'Ride not found',
        });
      }

      if (rideCheck.rows[0].status !== 'requested') {
        return res.status(409).json({
          error: 'Conflict',
          message: `This ride cannot be accepted because it is currently in '${rideCheck.rows[0].status}' status`,
        });
      }

      // Check the driver doesn't already have an active ride
      const activeDriverRide = await query(
        `SELECT id FROM rides
         WHERE driver_id = $1
           AND status IN ('matched', 'driver_arriving', 'in_progress')
         LIMIT 1`,
        [driverId]
      );

      if (activeDriverRide.rows.length > 0) {
        return res.status(409).json({
          error: 'Conflict',
          message: 'You already have an active ride. Please complete it before accepting a new one.',
        });
      }

      const ride = await acceptRide(rideId, driverId);

      return res.status(200).json({
        id: ride.id,
        passengerId: ride.passenger_id,
        driverId: ride.driver_id,
        status: ride.status,
        pickupLat: ride.pickup_lat,
        pickupLng: ride.pickup_lng,
        pickupAddress: ride.pickup_address,
        dropoffLat: ride.dropoff_lat,
        dropoffLng: ride.dropoff_lng,
        dropoffAddress: ride.dropoff_address,
        vehicleType: ride.vehicle_type,
        estimatedFare: ride.estimated_fare,
        matchedAt: ride.matched_at,
      });
    } catch (err) {
      console.error('[rides] POST /:id/accept error:', err);
      return res.status(500).json({
        error: 'Internal server error',
        message: 'An unexpected error occurred while accepting the ride',
      });
    }
  }
);

// ---------------------------------------------------------------------------
// POST /:id/decline — Driver declines a ride offer
// ---------------------------------------------------------------------------
router.post(
  '/:id/decline',
  authenticate,
  requireRole('driver', 'both'),
  async (req, res) => {
    try {
      const { id: rideId } = req.params;
      const driverId = req.user.id;

      await declineRide(rideId, driverId);

      return res.status(200).json({
        message: 'Ride declined',
      });
    } catch (err) {
      console.error('[rides] POST /:id/decline error:', err);
      return res.status(500).json({
        error: 'Internal server error',
        message: 'An unexpected error occurred while declining the ride',
      });
    }
  }
);

// ---------------------------------------------------------------------------
// POST /:id/arriving — Driver marks themselves as arriving
// ---------------------------------------------------------------------------
router.post('/:id/arriving', authenticate, async (req, res) => {
  try {
    const { id: rideId } = req.params;
    const driverId = req.user.id;

    // Verify ride exists and the requesting user is the assigned driver
    const rideCheck = await query(
      `SELECT id, driver_id, passenger_id, status FROM rides WHERE id = $1`,
      [rideId]
    );

    if (rideCheck.rows.length === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Ride not found',
      });
    }

    const ride = rideCheck.rows[0];

    if (ride.driver_id !== driverId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Only the assigned driver can update this ride',
      });
    }

    if (ride.status !== 'matched') {
      return res.status(409).json({
        error: 'Conflict',
        message: `Cannot transition to 'driver_arriving' from '${ride.status}' status`,
      });
    }

    const updateResult = await query(
      `UPDATE rides
       SET status = 'driver_arriving',
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, passenger_id, driver_id, status,
                 ST_Y(pickup_location::geometry) AS pickup_lat,
                 ST_X(pickup_location::geometry) AS pickup_lng,
                 pickup_address,
                 ST_Y(dropoff_location::geometry) AS dropoff_lat,
                 ST_X(dropoff_location::geometry) AS dropoff_lng,
                 dropoff_address,
                 vehicle_type, estimated_fare, matched_at`,
      [rideId]
    );

    const updatedRide = updateResult.rows[0];

    // Emit socket event to the passenger
    const io = getIO();
    if (io) {
      io.to(`user:${ride.passenger_id}`).emit('ride:driver_arriving', {
        rideId: updatedRide.id,
        driverId: updatedRide.driver_id,
        status: updatedRide.status,
        arrivedAt: new Date().toISOString(),
      });
    }

    return res.status(200).json({
      id: updatedRide.id,
      passengerId: updatedRide.passenger_id,
      driverId: updatedRide.driver_id,
      status: updatedRide.status,
      pickupLat: updatedRide.pickup_lat,
      pickupLng: updatedRide.pickup_lng,
      pickupAddress: updatedRide.pickup_address,
      dropoffLat: updatedRide.dropoff_lat,
      dropoffLng: updatedRide.dropoff_lng,
      dropoffAddress: updatedRide.dropoff_address,
      vehicleType: updatedRide.vehicle_type,
      estimatedFare: updatedRide.estimated_fare,
      matchedAt: updatedRide.matched_at,
    });
  } catch (err) {
    console.error('[rides] POST /:id/arriving error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred while updating ride status',
    });
  }
});

// ---------------------------------------------------------------------------
// POST /:id/pickup — Driver picks up the passenger
// ---------------------------------------------------------------------------
router.post('/:id/pickup', authenticate, async (req, res) => {
  try {
    const { id: rideId } = req.params;
    const driverId = req.user.id;

    // Verify ride exists and the requesting user is the assigned driver
    const rideCheck = await query(
      `SELECT id, driver_id, passenger_id, status FROM rides WHERE id = $1`,
      [rideId]
    );

    if (rideCheck.rows.length === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Ride not found',
      });
    }

    const ride = rideCheck.rows[0];

    if (ride.driver_id !== driverId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Only the assigned driver can update this ride',
      });
    }

    if (ride.status !== 'driver_arriving') {
      return res.status(409).json({
        error: 'Conflict',
        message: `Cannot transition to 'in_progress' from '${ride.status}' status`,
      });
    }

    const updateResult = await query(
      `UPDATE rides
       SET status = 'in_progress',
           pickup_at = NOW(),
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, passenger_id, driver_id, status,
                 ST_Y(pickup_location::geometry) AS pickup_lat,
                 ST_X(pickup_location::geometry) AS pickup_lng,
                 pickup_address,
                 ST_Y(dropoff_location::geometry) AS dropoff_lat,
                 ST_X(dropoff_location::geometry) AS dropoff_lng,
                 dropoff_address,
                 vehicle_type, estimated_fare, matched_at, pickup_at`,
      [rideId]
    );

    const updatedRide = updateResult.rows[0];

    // Emit socket event to the passenger
    const io = getIO();
    if (io) {
      io.to(`user:${ride.passenger_id}`).emit('ride:in_progress', {
        rideId: updatedRide.id,
        driverId: updatedRide.driver_id,
        status: updatedRide.status,
        pickupAt: updatedRide.pickup_at,
      });
    }

    return res.status(200).json({
      id: updatedRide.id,
      passengerId: updatedRide.passenger_id,
      driverId: updatedRide.driver_id,
      status: updatedRide.status,
      pickupLat: updatedRide.pickup_lat,
      pickupLng: updatedRide.pickup_lng,
      pickupAddress: updatedRide.pickup_address,
      dropoffLat: updatedRide.dropoff_lat,
      dropoffLng: updatedRide.dropoff_lng,
      dropoffAddress: updatedRide.dropoff_address,
      vehicleType: updatedRide.vehicle_type,
      estimatedFare: updatedRide.estimated_fare,
      matchedAt: updatedRide.matched_at,
      pickupAt: updatedRide.pickup_at,
    });
  } catch (err) {
    console.error('[rides] POST /:id/pickup error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred while updating ride status',
    });
  }
});

// ---------------------------------------------------------------------------
// POST /:id/complete — Driver completes the ride
// ---------------------------------------------------------------------------
router.post('/:id/complete', authenticate, async (req, res) => {
  try {
    const { id: rideId } = req.params;
    const driverId = req.user.id;

    // Verify ride exists and the requesting user is the assigned driver
    const rideCheck = await query(
      `SELECT id, driver_id, passenger_id, status, vehicle_type,
              surge_multiplier, estimated_fare, estimated_distance, estimated_duration,
              pickup_at
       FROM rides
       WHERE id = $1`,
      [rideId]
    );

    if (rideCheck.rows.length === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Ride not found',
      });
    }

    const ride = rideCheck.rows[0];

    if (ride.driver_id !== driverId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Only the assigned driver can complete this ride',
      });
    }

    if (ride.status !== 'in_progress') {
      return res.status(409).json({
        error: 'Conflict',
        message: `Cannot complete a ride that is in '${ride.status}' status`,
      });
    }

    // Use actual values from request body, or fall back to estimates
    const { actualDistanceKm, actualDurationMin } = req.body;

    const distanceKm = parseFloat(actualDistanceKm) || parseFloat(ride.estimated_distance);
    const durationMinutes = parseFloat(actualDurationMin) || parseFloat(ride.estimated_duration);

    // Calculate final fare based on actual distance/time
    const fareResult = calculateFare({
      distanceKm,
      durationMinutes,
      surgeMultiplier: parseFloat(ride.surge_multiplier) || 1.0,
      vehicleType: ride.vehicle_type || 'economy',
    });

    // Update the ride with completion data
    const updateResult = await query(
      `UPDATE rides
       SET status = 'completed',
           dropoff_at = NOW(),
           actual_fare = $1,
           actual_distance = $2,
           actual_duration = $3,
           platform_fee = $4,
           driver_payout = $5,
           updated_at = NOW()
       WHERE id = $6
       RETURNING id, passenger_id, driver_id, status,
                 ST_Y(pickup_location::geometry) AS pickup_lat,
                 ST_X(pickup_location::geometry) AS pickup_lng,
                 pickup_address,
                 ST_Y(dropoff_location::geometry) AS dropoff_lat,
                 ST_X(dropoff_location::geometry) AS dropoff_lng,
                 dropoff_address,
                 vehicle_type, estimated_fare, actual_fare,
                 estimated_distance, actual_distance,
                 estimated_duration, actual_duration,
                 surge_multiplier, platform_fee, driver_payout,
                 requested_at, matched_at, pickup_at, dropoff_at`,
      [
        fareResult.fare,
        distanceKm,
        durationMinutes,
        fareResult.platformFee,
        fareResult.driverPayout,
        rideId,
      ]
    );

    const completedRide = updateResult.rows[0];

    // Update driver stats: increment total_rides and add to total_earnings
    await query(
      `UPDATE driver_profiles
       SET total_rides = total_rides + 1,
           total_earnings = COALESCE(total_earnings, 0) + $1,
           updated_at = NOW()
       WHERE user_id = $2`,
      [fareResult.driverPayout, driverId]
    );

    // Clean up driver meta in Redis
    try {
      const metaKey = `driver:meta:${driverId}`;
      await redis.hdel(metaKey, 'currentRideId');
      await redis.hset(metaKey, 'lastRideAt', new Date().toISOString());
    } catch {
      // Non-critical
    }

    // Emit socket event with final fare info
    const io = getIO();
    if (io) {
      io.to(`user:${ride.passenger_id}`).emit('ride:completed', {
        rideId: completedRide.id,
        status: 'completed',
        actualFare: completedRide.actual_fare,
        actualDistance: completedRide.actual_distance,
        actualDuration: completedRide.actual_duration,
        platformFee: completedRide.platform_fee,
        driverPayout: completedRide.driver_payout,
        fareBreakdown: fareResult.breakdown,
        dropoffAt: completedRide.dropoff_at,
      });

      io.to(`user:${driverId}`).emit('ride:completed', {
        rideId: completedRide.id,
        status: 'completed',
        actualFare: completedRide.actual_fare,
        driverPayout: completedRide.driver_payout,
        dropoffAt: completedRide.dropoff_at,
      });
    }

    return res.status(200).json({
      id: completedRide.id,
      passengerId: completedRide.passenger_id,
      driverId: completedRide.driver_id,
      status: completedRide.status,
      pickupLat: completedRide.pickup_lat,
      pickupLng: completedRide.pickup_lng,
      pickupAddress: completedRide.pickup_address,
      dropoffLat: completedRide.dropoff_lat,
      dropoffLng: completedRide.dropoff_lng,
      dropoffAddress: completedRide.dropoff_address,
      vehicleType: completedRide.vehicle_type,
      estimatedFare: completedRide.estimated_fare,
      actualFare: completedRide.actual_fare,
      estimatedDistance: completedRide.estimated_distance,
      actualDistance: completedRide.actual_distance,
      estimatedDuration: completedRide.estimated_duration,
      actualDuration: completedRide.actual_duration,
      surgeMultiplier: completedRide.surge_multiplier,
      platformFee: completedRide.platform_fee,
      driverPayout: completedRide.driver_payout,
      fareBreakdown: fareResult.breakdown,
      requestedAt: completedRide.requested_at,
      matchedAt: completedRide.matched_at,
      pickupAt: completedRide.pickup_at,
      dropoffAt: completedRide.dropoff_at,
    });
  } catch (err) {
    console.error('[rides] POST /:id/complete error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred while completing the ride',
    });
  }
});

// ---------------------------------------------------------------------------
// POST /:id/cancel — Cancel a ride
// ---------------------------------------------------------------------------
router.post('/:id/cancel', authenticate, async (req, res) => {
  try {
    const { id: rideId } = req.params;
    const userId = req.user.id;
    const { reason } = req.body;

    // Fetch the ride
    const rideResult = await query(
      `SELECT id, passenger_id, driver_id, status, requested_at, matched_at
       FROM rides
       WHERE id = $1`,
      [rideId]
    );

    if (rideResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Ride not found',
      });
    }

    const ride = rideResult.rows[0];

    // Verify the requesting user is the passenger or driver of this ride
    if (ride.passenger_id !== userId && ride.driver_id !== userId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You are not authorized to cancel this ride',
      });
    }

    // Check ride is cancellable
    if (ride.status === 'completed' || ride.status === 'cancelled') {
      return res.status(409).json({
        error: 'Conflict',
        message: `This ride cannot be cancelled because it is already '${ride.status}'`,
      });
    }

    // Calculate cancellation fee based on ride status and who is cancelling
    let cancellationFee = 0;
    const isPassenger = ride.passenger_id === userId;
    const isDriver = ride.driver_id === userId;

    if (isPassenger) {
      if (ride.status === 'requested') {
        // Free cancellation if within 2 minutes of request
        const requestedAt = new Date(ride.requested_at);
        const minutesSinceRequest = (Date.now() - requestedAt.getTime()) / 60_000;

        if (minutesSinceRequest >= 2) {
          cancellationFee = 3.00;
        }
        // else free cancellation
      } else if (ride.status === 'matched') {
        cancellationFee = 3.00;
      } else if (ride.status === 'driver_arriving') {
        // Check if driver has been waiting 5+ minutes since matched
        if (ride.matched_at) {
          const matchedAt = new Date(ride.matched_at);
          const minutesSinceMatch = (Date.now() - matchedAt.getTime()) / 60_000;

          if (minutesSinceMatch >= 5) {
            cancellationFee = 5.00;
          } else {
            cancellationFee = 3.00;
          }
        } else {
          cancellationFee = 3.00;
        }
      } else if (ride.status === 'in_progress') {
        // In-progress cancellation by passenger is expensive
        cancellationFee = 5.00;
      }
    }
    // Drivers: no fee for cancellation (but it's logged)

    // Determine who cancelled
    const cancelledBy = isPassenger ? 'passenger' : 'driver';

    // Update the ride
    const updateResult = await query(
      `UPDATE rides
       SET status = 'cancelled',
           cancelled_by = $1,
           cancellation_reason = $2,
           cancellation_fee = $3,
           cancelled_at = NOW(),
           updated_at = NOW()
       WHERE id = $4
       RETURNING id, passenger_id, driver_id, status,
                 ST_Y(pickup_location::geometry) AS pickup_lat,
                 ST_X(pickup_location::geometry) AS pickup_lng,
                 pickup_address,
                 ST_Y(dropoff_location::geometry) AS dropoff_lat,
                 ST_X(dropoff_location::geometry) AS dropoff_lng,
                 dropoff_address,
                 vehicle_type, estimated_fare,
                 cancelled_by, cancellation_reason, cancellation_fee,
                 cancelled_at, requested_at`,
      [cancelledBy, reason || null, cancellationFee, rideId]
    );

    const cancelledRide = updateResult.rows[0];

    // Clean up driver meta in Redis if a driver was assigned
    if (ride.driver_id) {
      try {
        const metaKey = `driver:meta:${ride.driver_id}`;
        await redis.hdel(metaKey, 'currentRideId');
      } catch {
        // Non-critical
      }
    }

    // Emit socket events
    const io = getIO();
    if (io) {
      const cancelEvent = {
        rideId: cancelledRide.id,
        status: 'cancelled',
        cancelledBy: cancelledRide.cancelled_by,
        cancellationReason: cancelledRide.cancellation_reason,
        cancellationFee: cancelledRide.cancellation_fee,
        cancelledAt: cancelledRide.cancelled_at,
      };

      // Notify the passenger
      io.to(`user:${ride.passenger_id}`).emit('ride:cancelled', cancelEvent);

      // Notify the driver (if assigned)
      if (ride.driver_id) {
        io.to(`user:${ride.driver_id}`).emit('ride:cancelled', cancelEvent);
      }
    }

    return res.status(200).json({
      ride: {
        id: cancelledRide.id,
        passengerId: cancelledRide.passenger_id,
        driverId: cancelledRide.driver_id,
        status: cancelledRide.status,
        pickupLat: cancelledRide.pickup_lat,
        pickupLng: cancelledRide.pickup_lng,
        pickupAddress: cancelledRide.pickup_address,
        dropoffLat: cancelledRide.dropoff_lat,
        dropoffLng: cancelledRide.dropoff_lng,
        dropoffAddress: cancelledRide.dropoff_address,
        vehicleType: cancelledRide.vehicle_type,
        estimatedFare: cancelledRide.estimated_fare,
        cancelledBy: cancelledRide.cancelled_by,
        cancellationReason: cancelledRide.cancellation_reason,
        cancellationFee: cancelledRide.cancellation_fee,
        cancelledAt: cancelledRide.cancelled_at,
        requestedAt: cancelledRide.requested_at,
      },
      cancellationFee,
    });
  } catch (err) {
    console.error('[rides] POST /:id/cancel error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred while cancelling the ride',
    });
  }
});

export default router;
