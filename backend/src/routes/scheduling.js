import { Router } from 'express';
import Joi from 'joi';
import { query } from '../config/database.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import { createScheduledRide, getUpcoming } from '../services/scheduling.js';

const router = Router();

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const scheduleRideSchema = Joi.object({
  pickupLat: Joi.number().min(-90).max(90).required().messages({
    'number.min': 'Pickup latitude must be between -90 and 90',
    'number.max': 'Pickup latitude must be between -90 and 90',
    'any.required': 'Pickup latitude is required',
  }),
  pickupLng: Joi.number().min(-180).max(180).required().messages({
    'number.min': 'Pickup longitude must be between -180 and 180',
    'number.max': 'Pickup longitude must be between -180 and 180',
    'any.required': 'Pickup longitude is required',
  }),
  pickupAddress: Joi.string().trim().min(1).max(500).required().messages({
    'any.required': 'Pickup address is required',
  }),
  dropoffLat: Joi.number().min(-90).max(90).required().messages({
    'number.min': 'Dropoff latitude must be between -90 and 90',
    'number.max': 'Dropoff latitude must be between -90 and 90',
    'any.required': 'Dropoff latitude is required',
  }),
  dropoffLng: Joi.number().min(-180).max(180).required().messages({
    'number.min': 'Dropoff longitude must be between -180 and 180',
    'number.max': 'Dropoff longitude must be between -180 and 180',
    'any.required': 'Dropoff longitude is required',
  }),
  dropoffAddress: Joi.string().trim().min(1).max(500).required().messages({
    'any.required': 'Dropoff address is required',
  }),
  vehicleType: Joi.string()
    .valid('economy', 'comfort', 'xl', 'accessible')
    .default('economy')
    .messages({
      'any.only': 'Vehicle type must be one of: economy, comfort, xl, accessible',
    }),
  scheduledTime: Joi.date().iso().required().messages({
    'date.format': 'Scheduled time must be a valid ISO 8601 date',
    'any.required': 'Scheduled time is required',
  }),
  notes: Joi.string().trim().max(1000).optional().allow('', null),
  accessibilityNeeded: Joi.boolean().default(false),
});

const updateScheduleSchema = Joi.object({
  pickupLat: Joi.number().min(-90).max(90).optional(),
  pickupLng: Joi.number().min(-180).max(180).optional(),
  pickupAddress: Joi.string().trim().min(1).max(500).optional(),
  dropoffLat: Joi.number().min(-90).max(90).optional(),
  dropoffLng: Joi.number().min(-180).max(180).optional(),
  dropoffAddress: Joi.string().trim().min(1).max(500).optional(),
  vehicleType: Joi.string()
    .valid('economy', 'comfort', 'xl', 'accessible')
    .optional(),
  scheduledTime: Joi.date().iso().optional(),
  notes: Joi.string().trim().max(1000).optional().allow('', null),
  accessibilityNeeded: Joi.boolean().optional(),
});

const listScheduleQuerySchema = Joi.object({
  status: Joi.string()
    .valid('scheduled', 'reminder_sent', 'dispatching', 'matched', 'cancelled', 'expired')
    .optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(50).default(20),
});

// ---------------------------------------------------------------------------
// GET /upcoming — Upcoming rides within next 24 hours
// Must be defined before /:id to avoid route collision
// ---------------------------------------------------------------------------
router.get('/upcoming', authenticate, async (req, res) => {
  try {
    const rides = await getUpcoming(req.user.id);

    return res.status(200).json({
      rides: rides.map(formatScheduledRide),
    });
  } catch (err) {
    console.error('[scheduling] GET /upcoming error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred while fetching upcoming rides',
    });
  }
});

// ---------------------------------------------------------------------------
// POST / — Schedule a new ride
// ---------------------------------------------------------------------------
router.post(
  '/',
  authenticate,
  validate(scheduleRideSchema),
  async (req, res) => {
    try {
      const result = await createScheduledRide({
        passengerId: req.user.id,
        ...req.body,
      });

      return res.status(201).json({
        scheduledRide: formatScheduledRide(result),
        fareEstimate: result.fareEstimate
          ? {
              fare: result.fareEstimate.fare,
              estimatedDistance: result.fareEstimate.estimatedDistance,
              estimatedDuration: result.fareEstimate.estimatedDuration,
              surgeMultiplier: result.fareEstimate.surgeMultiplier,
              breakdown: result.fareEstimate.breakdown,
            }
          : undefined,
      });
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({
          error: 'Validation failed',
          message: err.message,
        });
      }
      console.error('[scheduling] POST / error:', err);
      return res.status(500).json({
        error: 'Internal server error',
        message: 'An unexpected error occurred while scheduling the ride',
      });
    }
  }
);

// ---------------------------------------------------------------------------
// GET / — List user's scheduled rides
// ---------------------------------------------------------------------------
router.get(
  '/',
  authenticate,
  validate(listScheduleQuerySchema, 'query'),
  async (req, res) => {
    try {
      const userId = req.user.id;
      const { status, page, limit } = req.query;
      const offset = (page - 1) * limit;

      // Build the query dynamically based on optional status filter
      const conditions = ['passenger_id = $1'];
      const params = [userId];
      let paramIndex = 2;

      if (status) {
        conditions.push(`status = $${paramIndex}`);
        params.push(status);
        paramIndex++;
      }

      const whereClause = conditions.join(' AND ');

      // Count total
      const countResult = await query(
        `SELECT COUNT(*)::int AS total FROM scheduled_rides WHERE ${whereClause}`,
        params
      );

      const total = countResult.rows[0].total;

      // Fetch paginated results
      const ridesResult = await query(
        `SELECT id, passenger_id, status,
                ST_Y(pickup_location::geometry)  AS pickup_lat,
                ST_X(pickup_location::geometry)  AS pickup_lng,
                pickup_address,
                ST_Y(dropoff_location::geometry) AS dropoff_lat,
                ST_X(dropoff_location::geometry) AS dropoff_lng,
                dropoff_address,
                vehicle_type, scheduled_time, estimated_fare,
                notes, accessibility_needed, ride_id, created_at, updated_at
         FROM scheduled_rides
         WHERE ${whereClause}
         ORDER BY scheduled_time DESC
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...params, limit, offset]
      );

      return res.status(200).json({
        rides: ridesResult.rows.map(formatScheduledRide),
        total,
        page,
        limit,
      });
    } catch (err) {
      console.error('[scheduling] GET / error:', err);
      return res.status(500).json({
        error: 'Internal server error',
        message: 'An unexpected error occurred while fetching scheduled rides',
      });
    }
  }
);

// ---------------------------------------------------------------------------
// GET /:id — Get a single scheduled ride
// ---------------------------------------------------------------------------
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const result = await query(
      `SELECT id, passenger_id, status,
              ST_Y(pickup_location::geometry)  AS pickup_lat,
              ST_X(pickup_location::geometry)  AS pickup_lng,
              pickup_address,
              ST_Y(dropoff_location::geometry) AS dropoff_lat,
              ST_X(dropoff_location::geometry) AS dropoff_lng,
              dropoff_address,
              vehicle_type, scheduled_time, estimated_fare,
              notes, accessibility_needed, ride_id,
              recurring, recurrence_pattern,
              created_at, updated_at
       FROM scheduled_rides
       WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Scheduled ride not found',
      });
    }

    const ride = result.rows[0];

    if (ride.passenger_id !== userId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You are not authorized to view this scheduled ride',
      });
    }

    return res.status(200).json(formatScheduledRide(ride));
  } catch (err) {
    console.error('[scheduling] GET /:id error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred while fetching the scheduled ride',
    });
  }
});

// ---------------------------------------------------------------------------
// PUT /:id — Update a scheduled ride
// ---------------------------------------------------------------------------
router.put(
  '/:id',
  authenticate,
  validate(updateScheduleSchema),
  async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      // Fetch the existing scheduled ride
      const existing = await query(
        `SELECT id, passenger_id, status, scheduled_time
         FROM scheduled_rides
         WHERE id = $1`,
        [id]
      );

      if (existing.rows.length === 0) {
        return res.status(404).json({
          error: 'Not found',
          message: 'Scheduled ride not found',
        });
      }

      const ride = existing.rows[0];

      if (ride.passenger_id !== userId) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'You are not authorized to update this scheduled ride',
        });
      }

      if (ride.status !== 'scheduled') {
        return res.status(409).json({
          error: 'Conflict',
          message: `Cannot update a scheduled ride with status '${ride.status}'. Only rides in 'scheduled' status can be modified.`,
        });
      }

      // Must be at least 30 min before the current scheduled pickup
      const currentScheduledTime = new Date(ride.scheduled_time);
      const minutesBefore = (currentScheduledTime.getTime() - Date.now()) / 60_000;

      if (minutesBefore < 30) {
        return res.status(409).json({
          error: 'Conflict',
          message: 'Cannot update a scheduled ride less than 30 minutes before the pickup time',
        });
      }

      // If a new scheduledTime is provided, validate it
      if (req.body.scheduledTime) {
        const newDate = new Date(req.body.scheduledTime);
        const diffMinutes = (newDate.getTime() - Date.now()) / 60_000;

        if (diffMinutes < 30) {
          return res.status(400).json({
            error: 'Validation failed',
            message: 'New scheduled time must be at least 30 minutes in the future',
          });
        }
      }

      // Build dynamic SET clause
      const setClauses = [];
      const params = [];
      let paramIndex = 1;

      const {
        pickupLat,
        pickupLng,
        pickupAddress,
        dropoffLat,
        dropoffLng,
        dropoffAddress,
        vehicleType,
        scheduledTime,
        notes,
        accessibilityNeeded,
      } = req.body;

      if (pickupLat !== undefined && pickupLng !== undefined) {
        setClauses.push(`pickup_location = ST_MakePoint($${paramIndex}, $${paramIndex + 1})::geography`);
        params.push(pickupLng, pickupLat);
        paramIndex += 2;
      }

      if (pickupAddress !== undefined) {
        setClauses.push(`pickup_address = $${paramIndex}`);
        params.push(pickupAddress);
        paramIndex++;
      }

      if (dropoffLat !== undefined && dropoffLng !== undefined) {
        setClauses.push(`dropoff_location = ST_MakePoint($${paramIndex}, $${paramIndex + 1})::geography`);
        params.push(dropoffLng, dropoffLat);
        paramIndex += 2;
      }

      if (dropoffAddress !== undefined) {
        setClauses.push(`dropoff_address = $${paramIndex}`);
        params.push(dropoffAddress);
        paramIndex++;
      }

      if (vehicleType !== undefined) {
        setClauses.push(`vehicle_type = $${paramIndex}`);
        params.push(vehicleType);
        paramIndex++;
      }

      if (scheduledTime !== undefined) {
        setClauses.push(`scheduled_time = $${paramIndex}`);
        params.push(new Date(scheduledTime));
        paramIndex++;
      }

      if (notes !== undefined) {
        setClauses.push(`notes = $${paramIndex}`);
        params.push(notes || null);
        paramIndex++;
      }

      if (accessibilityNeeded !== undefined) {
        setClauses.push(`accessibility_needed = $${paramIndex}`);
        params.push(accessibilityNeeded);
        paramIndex++;
      }

      if (setClauses.length === 0) {
        return res.status(400).json({
          error: 'Validation failed',
          message: 'No fields provided to update',
        });
      }

      setClauses.push('updated_at = NOW()');
      params.push(id);

      const updateResult = await query(
        `UPDATE scheduled_rides
         SET ${setClauses.join(', ')}
         WHERE id = $${paramIndex}
         RETURNING
           id, passenger_id, status,
           ST_Y(pickup_location::geometry)  AS pickup_lat,
           ST_X(pickup_location::geometry)  AS pickup_lng,
           pickup_address,
           ST_Y(dropoff_location::geometry) AS dropoff_lat,
           ST_X(dropoff_location::geometry) AS dropoff_lng,
           dropoff_address,
           vehicle_type, scheduled_time, estimated_fare,
           notes, accessibility_needed, ride_id, created_at, updated_at`,
        params
      );

      return res.status(200).json(formatScheduledRide(updateResult.rows[0]));
    } catch (err) {
      console.error('[scheduling] PUT /:id error:', err);
      return res.status(500).json({
        error: 'Internal server error',
        message: 'An unexpected error occurred while updating the scheduled ride',
      });
    }
  }
);

// ---------------------------------------------------------------------------
// DELETE /:id — Cancel a scheduled ride
// ---------------------------------------------------------------------------
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const existing = await query(
      `SELECT id, passenger_id, status FROM scheduled_rides WHERE id = $1`,
      [id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Scheduled ride not found',
      });
    }

    const ride = existing.rows[0];

    if (ride.passenger_id !== userId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You are not authorized to cancel this scheduled ride',
      });
    }

    if (ride.status === 'cancelled' || ride.status === 'expired') {
      return res.status(409).json({
        error: 'Conflict',
        message: `This scheduled ride is already '${ride.status}'`,
      });
    }

    await query(
      `UPDATE scheduled_rides
       SET status = 'cancelled', updated_at = NOW()
       WHERE id = $1`,
      [id]
    );

    return res.status(200).json({
      message: 'Scheduled ride cancelled successfully',
      scheduledRideId: id,
    });
  } catch (err) {
    console.error('[scheduling] DELETE /:id error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred while cancelling the scheduled ride',
    });
  }
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Transform a database row into the API response shape.
 */
function formatScheduledRide(row) {
  return {
    id: row.id,
    passengerId: row.passenger_id,
    status: row.status,
    pickupLat: row.pickup_lat,
    pickupLng: row.pickup_lng,
    pickupAddress: row.pickup_address,
    dropoffLat: row.dropoff_lat,
    dropoffLng: row.dropoff_lng,
    dropoffAddress: row.dropoff_address,
    vehicleType: row.vehicle_type,
    scheduledTime: row.scheduled_time,
    estimatedFare: row.estimated_fare,
    notes: row.notes,
    accessibilityNeeded: row.accessibility_needed,
    rideId: row.ride_id || null,
    recurring: row.recurring || false,
    recurrencePattern: row.recurrence_pattern || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export default router;
