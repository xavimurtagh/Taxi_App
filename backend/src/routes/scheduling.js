import { Router } from 'express';
import Joi from 'joi';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import {
  createScheduledRide,
  getScheduledRides,
  getScheduledRideById,
  updateScheduledRide,
  cancelScheduledRide,
  getUpcoming,
} from '../services/scheduling.js';

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
  recurring: Joi.boolean().default(false),
  recurrencePattern: Joi.object().optional().allow(null),
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

    return res.status(200).json({ rides });
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
      const result = await createScheduledRide(req.user.id, req.body);

      return res.status(201).json({
        scheduledRide: result,
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
          error: err.statusCode === 400 ? 'Validation failed' : 'Conflict',
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
      const { status, page, limit } = req.query;

      const result = await getScheduledRides(req.user.id, { status, page, limit });

      return res.status(200).json(result);
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
    const ride = await getScheduledRideById(req.params.id, req.user.id);

    return res.status(200).json(ride);
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        error: err.statusCode === 404 ? 'Not found' : 'Forbidden',
        message: err.message,
      });
    }
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
      const updated = await updateScheduledRide(
        req.params.id,
        req.user.id,
        req.body
      );

      return res.status(200).json(updated);
    } catch (err) {
      if (err.statusCode) {
        const label =
          err.statusCode === 404 ? 'Not found'
            : err.statusCode === 403 ? 'Forbidden'
              : err.statusCode === 409 ? 'Conflict'
                : 'Validation failed';
        return res.status(err.statusCode).json({
          error: label,
          message: err.message,
        });
      }
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
    const cancelled = await cancelScheduledRide(req.params.id, req.user.id);

    return res.status(200).json({
      message: 'Scheduled ride cancelled successfully',
      scheduledRide: cancelled,
    });
  } catch (err) {
    if (err.statusCode) {
      const label =
        err.statusCode === 404 ? 'Not found'
          : err.statusCode === 403 ? 'Forbidden'
            : 'Conflict';
      return res.status(err.statusCode).json({
        error: label,
        message: err.message,
      });
    }
    console.error('[scheduling] DELETE /:id error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred while cancelling the scheduled ride',
    });
  }
});

export default router;
