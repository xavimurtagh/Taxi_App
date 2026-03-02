import { Router } from 'express';
import Joi from 'joi';
import { query } from '../config/database.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import { estimateFare } from '../services/pricing.js';
import { getIO } from '../sockets/index.js';
import {
  findMatchingRides,
  joinSharedRide,
  calculateFareSplit,
  optimizeRoute,
} from '../services/ridesharing.js';

const router = Router();

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const matchSchema = Joi.object({
  pickupLat: Joi.number().min(-90).max(90).required().messages({
    'any.required': 'Pickup latitude is required',
  }),
  pickupLng: Joi.number().min(-180).max(180).required().messages({
    'any.required': 'Pickup longitude is required',
  }),
  dropoffLat: Joi.number().min(-90).max(90).required().messages({
    'any.required': 'Dropoff latitude is required',
  }),
  dropoffLng: Joi.number().min(-180).max(180).required().messages({
    'any.required': 'Dropoff longitude is required',
  }),
  maxDetourPercent: Joi.number().min(5).max(50).default(25).messages({
    'number.min': 'Max detour must be at least 5%',
    'number.max': 'Max detour cannot exceed 50%',
  }),
});

const joinSchema = Joi.object({
  pickupLat: Joi.number().min(-90).max(90).required(),
  pickupLng: Joi.number().min(-180).max(180).required(),
  pickupAddress: Joi.string().trim().min(1).max(500).required(),
  dropoffLat: Joi.number().min(-90).max(90).required(),
  dropoffLng: Joi.number().min(-180).max(180).required(),
  dropoffAddress: Joi.string().trim().min(1).max(500).required(),
});

const createSharedRideSchema = Joi.object({
  pickupLat: Joi.number().min(-90).max(90).required(),
  pickupLng: Joi.number().min(-180).max(180).required(),
  pickupAddress: Joi.string().trim().min(1).max(500).required(),
  dropoffLat: Joi.number().min(-90).max(90).required(),
  dropoffLng: Joi.number().min(-180).max(180).required(),
  dropoffAddress: Joi.string().trim().min(1).max(500).required(),
  maxPassengers: Joi.number().integer().min(1).max(6).default(3),
  vehicleType: Joi.string().valid('pool', 'economy', 'xl').default('pool'),
});

// ---------------------------------------------------------------------------
// POST /match — Find compatible shared rides
// ---------------------------------------------------------------------------
router.post(
  '/match',
  authenticate,
  validate(matchSchema),
  async (req, res) => {
    try {
      const { pickupLat, pickupLng, dropoffLat, dropoffLng, maxDetourPercent } = req.body;

      const matches = await findMatchingRides(
        pickupLat,
        pickupLng,
        dropoffLat,
        dropoffLng,
        maxDetourPercent
      );

      return res.status(200).json({
        matches,
        total: matches.length,
      });
    } catch (err) {
      console.error('[ridesharing] POST /match error:', err);
      return res.status(500).json({
        error: 'Internal server error',
        message: 'An unexpected error occurred while searching for shared rides',
      });
    }
  }
);

// ---------------------------------------------------------------------------
// POST /join/:sharedRideId — Join an existing shared ride
// ---------------------------------------------------------------------------
router.post(
  '/join/:sharedRideId',
  authenticate,
  validate(joinSchema),
  async (req, res) => {
    try {
      const { sharedRideId } = req.params;
      const passengerId = req.user.id;
      const { pickupLat, pickupLng, pickupAddress, dropoffLat, dropoffLng, dropoffAddress } = req.body;

      const result = await joinSharedRide(
        sharedRideId,
        passengerId,
        { lat: pickupLat, lng: pickupLng, address: pickupAddress },
        { lat: dropoffLat, lng: dropoffLng, address: dropoffAddress }
      );

      return res.status(201).json({
        participant: result.participant,
        ride: {
          id: result.ride.id,
          status: result.ride.status,
          estimatedFare: result.ride.estimated_fare,
        },
        fareDetails: {
          originalFare: result.originalFare,
          discountedFare: result.discountedFare,
          discountPercent: result.discountPercent,
        },
      });
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({
          error: err.statusCode === 404 ? 'Not found' : 'Conflict',
          message: err.message,
        });
      }
      console.error('[ridesharing] POST /join/:sharedRideId error:', err);
      return res.status(500).json({
        error: 'Internal server error',
        message: 'An unexpected error occurred while joining the shared ride',
      });
    }
  }
);

// ---------------------------------------------------------------------------
// POST /create — Create a new shared ride
// ---------------------------------------------------------------------------
router.post(
  '/create',
  authenticate,
  validate(createSharedRideSchema),
  async (req, res) => {
    try {
      const userId = req.user.id;
      const {
        pickupLat,
        pickupLng,
        pickupAddress,
        dropoffLat,
        dropoffLng,
        dropoffAddress,
        maxPassengers,
        vehicleType,
      } = req.body;

      // Determine if user is creating as driver or passenger
      const userRole = req.user.role;
      const isDriver = userRole === 'driver' || userRole === 'both';

      // Create the shared ride
      const sharedResult = await query(
        `INSERT INTO shared_rides (
           driver_id, status,
           route_origin, route_destination,
           max_passengers, current_passengers,
           vehicle_type
         )
         VALUES (
           $1, 'open',
           ST_MakePoint($2, $3)::geography,
           ST_MakePoint($4, $5)::geography,
           $6, $7,
           $8
         )
         RETURNING
           id, driver_id, status,
           ST_Y(route_origin::geometry)      AS origin_lat,
           ST_X(route_origin::geometry)      AS origin_lng,
           ST_Y(route_destination::geometry) AS dest_lat,
           ST_X(route_destination::geometry) AS dest_lng,
           max_passengers, current_passengers,
           vehicle_type, created_at`,
        [
          isDriver ? userId : null,
          pickupLng, pickupLat,
          dropoffLng, dropoffLat,
          maxPassengers,
          isDriver ? 0 : 1, // If passenger creates, they count as 1
          vehicleType,
        ]
      );

      const sharedRide = sharedResult.rows[0];

      // If the creator is a passenger, also create their ride + participant record
      let participantData = null;
      if (!isDriver) {
        const fareEstimate = await estimateFare(
          pickupLat,
          pickupLng,
          dropoffLat,
          dropoffLng,
          vehicleType
        );

        const rideResult = await query(
          `INSERT INTO rides (
             passenger_id, status,
             pickup_location, pickup_address,
             dropoff_location, dropoff_address,
             vehicle_type,
             estimated_fare, estimated_distance, estimated_duration,
             surge_multiplier,
             is_shared, shared_ride_id,
             requested_at
           )
           VALUES (
             $1, 'requested',
             ST_MakePoint($2, $3)::geography, $4,
             ST_MakePoint($5, $6)::geography, $7,
             $8,
             $9, $10, $11,
             $12,
             TRUE, $13,
             NOW()
           )
           RETURNING id, passenger_id, status, estimated_fare`,
          [
            userId,
            pickupLng, pickupLat, pickupAddress,
            dropoffLng, dropoffLat, dropoffAddress,
            vehicleType,
            fareEstimate.fare,
            fareEstimate.estimatedDistance,
            fareEstimate.estimatedDuration,
            fareEstimate.surgeMultiplier,
            sharedRide.id,
          ]
        );

        const ride = rideResult.rows[0];

        const participantResult = await query(
          `INSERT INTO shared_ride_participants (
             shared_ride_id, ride_id, passenger_id,
             pickup_location, dropoff_location,
             pickup_order, dropoff_order,
             fare_share, status
           )
           VALUES (
             $1, $2, $3,
             ST_MakePoint($4, $5)::geography,
             ST_MakePoint($6, $7)::geography,
             1, 1,
             $8, 'confirmed'
           )
           RETURNING id, shared_ride_id, ride_id, passenger_id,
                     pickup_order, dropoff_order, fare_share, status, joined_at`,
          [
            sharedRide.id, ride.id, userId,
            pickupLng, pickupLat,
            dropoffLng, dropoffLat,
            fareEstimate.fare,
          ]
        );

        participantData = {
          participant: participantResult.rows[0],
          ride: {
            id: ride.id,
            status: ride.status,
            estimatedFare: ride.estimated_fare,
          },
        };
      }

      return res.status(201).json({
        sharedRide: {
          id: sharedRide.id,
          driverId: sharedRide.driver_id,
          status: sharedRide.status,
          originLat: sharedRide.origin_lat,
          originLng: sharedRide.origin_lng,
          destLat: sharedRide.dest_lat,
          destLng: sharedRide.dest_lng,
          maxPassengers: sharedRide.max_passengers,
          currentPassengers: sharedRide.current_passengers,
          vehicleType: sharedRide.vehicle_type,
          createdAt: sharedRide.created_at,
        },
        ...(participantData || {}),
      });
    } catch (err) {
      console.error('[ridesharing] POST /create error:', err);
      return res.status(500).json({
        error: 'Internal server error',
        message: 'An unexpected error occurred while creating the shared ride',
      });
    }
  }
);

// ---------------------------------------------------------------------------
// GET /active — Get user's active shared rides
// ---------------------------------------------------------------------------
router.get('/active', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await query(
      `SELECT DISTINCT
         sr.id,
         sr.driver_id,
         sr.status,
         ST_Y(sr.route_origin::geometry)      AS origin_lat,
         ST_X(sr.route_origin::geometry)      AS origin_lng,
         ST_Y(sr.route_destination::geometry) AS dest_lat,
         ST_X(sr.route_destination::geometry) AS dest_lng,
         sr.max_passengers,
         sr.current_passengers,
         sr.vehicle_type,
         sr.created_at
       FROM shared_rides sr
       LEFT JOIN shared_ride_participants srp ON srp.shared_ride_id = sr.id
       WHERE (sr.driver_id = $1 OR srp.passenger_id = $1)
         AND sr.status IN ('open', 'full', 'in_progress')
         AND (srp.status IS NULL OR srp.status NOT IN ('cancelled'))
       ORDER BY sr.created_at DESC`,
      [userId]
    );

    return res.status(200).json({
      rides: result.rows.map((row) => ({
        id: row.id,
        driverId: row.driver_id,
        status: row.status,
        originLat: row.origin_lat,
        originLng: row.origin_lng,
        destLat: row.dest_lat,
        destLng: row.dest_lng,
        maxPassengers: row.max_passengers,
        currentPassengers: row.current_passengers,
        vehicleType: row.vehicle_type,
        createdAt: row.created_at,
      })),
    });
  } catch (err) {
    console.error('[ridesharing] GET /active error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred while fetching active shared rides',
    });
  }
});

// ---------------------------------------------------------------------------
// GET /:id — Get shared ride details with all participants
// ---------------------------------------------------------------------------
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    // Get the shared ride
    const srResult = await query(
      `SELECT
         sr.id,
         sr.driver_id,
         sr.status,
         ST_Y(sr.route_origin::geometry)      AS origin_lat,
         ST_X(sr.route_origin::geometry)      AS origin_lng,
         ST_Y(sr.route_destination::geometry) AS dest_lat,
         ST_X(sr.route_destination::geometry) AS dest_lng,
         sr.max_passengers,
         sr.current_passengers,
         sr.vehicle_type,
         sr.route_geometry,
         sr.created_at,
         sr.updated_at,
         -- Driver info
         u.first_name AS driver_first_name,
         u.last_name AS driver_last_name,
         dp.vehicle_make,
         dp.vehicle_model,
         dp.vehicle_color,
         dp.vehicle_plate,
         dp.rating AS driver_rating
       FROM shared_rides sr
       LEFT JOIN users u ON u.id = sr.driver_id
       LEFT JOIN driver_profiles dp ON dp.user_id = sr.driver_id
       WHERE sr.id = $1`,
      [id]
    );

    if (srResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Shared ride not found',
      });
    }

    const sr = srResult.rows[0];

    // Get all participants
    const participantsResult = await query(
      `SELECT
         srp.id AS participant_id,
         srp.passenger_id,
         srp.ride_id,
         srp.pickup_order,
         srp.dropoff_order,
         srp.fare_share,
         srp.status,
         srp.joined_at,
         ST_Y(srp.pickup_location::geometry)  AS pickup_lat,
         ST_X(srp.pickup_location::geometry)  AS pickup_lng,
         ST_Y(srp.dropoff_location::geometry) AS dropoff_lat,
         ST_X(srp.dropoff_location::geometry) AS dropoff_lng,
         u.first_name,
         u.last_name,
         u.avatar_url
       FROM shared_ride_participants srp
       JOIN users u ON u.id = srp.passenger_id
       WHERE srp.shared_ride_id = $1
       ORDER BY srp.pickup_order ASC`,
      [id]
    );

    const sharedRide = {
      id: sr.id,
      driverId: sr.driver_id,
      status: sr.status,
      originLat: sr.origin_lat,
      originLng: sr.origin_lng,
      destLat: sr.dest_lat,
      destLng: sr.dest_lng,
      maxPassengers: sr.max_passengers,
      currentPassengers: sr.current_passengers,
      vehicleType: sr.vehicle_type,
      routeGeometry: sr.route_geometry,
      createdAt: sr.created_at,
      updatedAt: sr.updated_at,
    };

    if (sr.driver_id) {
      sharedRide.driver = {
        id: sr.driver_id,
        firstName: sr.driver_first_name,
        lastName: sr.driver_last_name,
        vehicleMake: sr.vehicle_make,
        vehicleModel: sr.vehicle_model,
        vehicleColor: sr.vehicle_color,
        vehiclePlate: sr.vehicle_plate,
        rating: sr.driver_rating,
      };
    }

    sharedRide.participants = participantsResult.rows.map((p) => ({
      id: p.participant_id,
      passengerId: p.passenger_id,
      rideId: p.ride_id,
      firstName: p.first_name,
      lastName: p.last_name,
      avatarUrl: p.avatar_url,
      pickupLat: p.pickup_lat,
      pickupLng: p.pickup_lng,
      dropoffLat: p.dropoff_lat,
      dropoffLng: p.dropoff_lng,
      pickupOrder: p.pickup_order,
      dropoffOrder: p.dropoff_order,
      fareShare: p.fare_share,
      status: p.status,
      joinedAt: p.joined_at,
    }));

    return res.status(200).json(sharedRide);
  } catch (err) {
    console.error('[ridesharing] GET /:id error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred while fetching the shared ride',
    });
  }
});

// ---------------------------------------------------------------------------
// POST /:id/leave — Leave a shared ride
// ---------------------------------------------------------------------------
router.post('/:id/leave', authenticate, async (req, res) => {
  try {
    const { id: sharedRideId } = req.params;
    const userId = req.user.id;

    // Find the participant record
    const participantResult = await query(
      `SELECT srp.id, srp.ride_id, srp.status
       FROM shared_ride_participants srp
       WHERE srp.shared_ride_id = $1
         AND srp.passenger_id = $2
         AND srp.status NOT IN ('cancelled', 'dropped_off')`,
      [sharedRideId, userId]
    );

    if (participantResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: 'You are not an active participant of this shared ride',
      });
    }

    const participant = participantResult.rows[0];

    // Cancel the participant
    await query(
      `UPDATE shared_ride_participants
       SET status = 'cancelled'
       WHERE id = $1`,
      [participant.id]
    );

    // Cancel the associated ride
    await query(
      `UPDATE rides
       SET status = 'cancelled', cancelled_by = 'passenger',
           cancellation_reason = 'Left shared ride',
           cancelled_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [participant.ride_id]
    );

    // Decrement passenger count and reopen if needed
    const updateResult = await query(
      `UPDATE shared_rides
       SET current_passengers = GREATEST(current_passengers - 1, 0),
           status = CASE
             WHEN status = 'full' THEN 'open'
             ELSE status
           END,
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, driver_id, current_passengers, status`,
      [sharedRideId]
    );

    const updatedRide = updateResult.rows[0];

    // Notify the driver
    const io = getIO();
    if (io && updatedRide.driver_id) {
      io.to(`user:${updatedRide.driver_id}`).emit('shared_ride:passenger_left', {
        sharedRideId,
        passengerId: userId,
        currentPassengers: updatedRide.current_passengers,
      });
    }

    return res.status(200).json({
      message: 'Successfully left the shared ride',
      sharedRideId,
      currentPassengers: updatedRide.current_passengers,
    });
  } catch (err) {
    console.error('[ridesharing] POST /:id/leave error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred while leaving the shared ride',
    });
  }
});

// ---------------------------------------------------------------------------
// GET /:id/fare-split — Calculate fare split
// ---------------------------------------------------------------------------
router.get('/:id/fare-split', authenticate, async (req, res) => {
  try {
    const { id: sharedRideId } = req.params;

    const fareSplit = await calculateFareSplit(sharedRideId);

    return res.status(200).json(fareSplit);
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        error: err.statusCode === 404 ? 'Not found' : 'Error',
        message: err.message,
      });
    }
    console.error('[ridesharing] GET /:id/fare-split error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred while calculating the fare split',
    });
  }
});

export default router;
