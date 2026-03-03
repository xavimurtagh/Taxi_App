import { Router } from 'express';
import Joi from 'joi';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import {
  requestSharedRide,
  getAvailableSharedRides,
  getSharedRideById,
  joinSharedRide,
  leaveSharedRide,
  getActiveSharedRide,
  calculateFareShare,
} from '../services/ridesharing.js';

const router = Router();

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const sharedRideRequestSchema = Joi.object({
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
});

const joinSharedRideSchema = Joi.object({
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
});

const availableQuerySchema = Joi.object({
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
  radius: Joi.number().min(500).max(20000).default(5000).messages({
    'number.min': 'Search radius must be at least 500 metres',
    'number.max': 'Search radius cannot exceed 20000 metres',
  }),
});

// ---------------------------------------------------------------------------
// POST /request — Request a shared ride (find match or create new)
// ---------------------------------------------------------------------------
router.post(
  '/request',
  authenticate,
  validate(sharedRideRequestSchema),
  async (req, res) => {
    try {
      const result = await requestSharedRide(req.user.id, req.body);

      return res.status(201).json({
        matched: result.matched,
        sharedRideId: result.sharedRideId,
        ride: result.ride,
        discountedFare: result.discountedFare,
        originalFare: result.originalFare,
        discountPercent: result.discountPercent,
        fareEstimate: result.fareEstimate || undefined,
        participant: result.participant || undefined,
      });
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({
          error: err.statusCode === 409 ? 'Conflict' : 'Error',
          message: err.message,
        });
      }
      console.error('[ridesharing] POST /request error:', err);
      return res.status(500).json({
        error: 'Internal server error',
        message: 'An unexpected error occurred while requesting a shared ride',
      });
    }
  }
);

// ---------------------------------------------------------------------------
// GET /available — List available shared rides near a route
// ---------------------------------------------------------------------------
router.get(
  '/available',
  authenticate,
  validate(availableQuerySchema, 'query'),
  async (req, res) => {
    try {
      const { pickupLat, pickupLng, dropoffLat, dropoffLng, radius } = req.query;

      const rides = await getAvailableSharedRides(
        parseFloat(pickupLat),
        parseFloat(pickupLng),
        parseFloat(dropoffLat),
        parseFloat(dropoffLng),
        parseFloat(radius)
      );

      return res.status(200).json({ rides, total: rides.length });
    } catch (err) {
      console.error('[ridesharing] GET /available error:', err);
      return res.status(500).json({
        error: 'Internal server error',
        message: 'An unexpected error occurred while fetching available shared rides',
      });
    }
  }
);

// ---------------------------------------------------------------------------
// GET /active — Get user's active shared ride
// Must be defined before /:id to avoid route collision
// ---------------------------------------------------------------------------
router.get('/active', authenticate, async (req, res) => {
  try {
    const sharedRide = await getActiveSharedRide(req.user.id);

    return res.status(200).json({ sharedRide });
  } catch (err) {
    console.error('[ridesharing] GET /active error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred while fetching your active shared ride',
    });
  }
});

// ---------------------------------------------------------------------------
// GET /:id — Get shared ride details with participants
// ---------------------------------------------------------------------------
router.get('/:id', authenticate, async (req, res) => {
  try {
    const sharedRide = await getSharedRideById(req.params.id);

    return res.status(200).json(sharedRide);
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        error: err.statusCode === 404 ? 'Not found' : 'Error',
        message: err.message,
      });
    }
    console.error('[ridesharing] GET /:id error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred while fetching the shared ride',
    });
  }
});

// ---------------------------------------------------------------------------
// POST /:id/join — Join an existing shared ride
// ---------------------------------------------------------------------------
router.post(
  '/:id/join',
  authenticate,
  validate(joinSharedRideSchema),
  async (req, res) => {
    try {
      const { pickupLat, pickupLng, pickupAddress, dropoffLat, dropoffLng, dropoffAddress } =
        req.body;

      const result = await joinSharedRide(
        req.params.id,
        req.user.id,
        { lat: pickupLat, lng: pickupLng, address: pickupAddress },
        { lat: dropoffLat, lng: dropoffLng, address: dropoffAddress }
      );

      return res.status(200).json({
        participant: result.participant,
        ride: result.ride,
        discountedFare: result.discountedFare,
        originalFare: result.originalFare,
        discountPercent: result.discountPercent,
      });
    } catch (err) {
      if (err.statusCode) {
        const label =
          err.statusCode === 404 ? 'Not found'
            : err.statusCode === 409 ? 'Conflict'
              : 'Error';
        return res.status(err.statusCode).json({
          error: label,
          message: err.message,
        });
      }
      console.error('[ridesharing] POST /:id/join error:', err);
      return res.status(500).json({
        error: 'Internal server error',
        message: 'An unexpected error occurred while joining the shared ride',
      });
    }
  }
);

// ---------------------------------------------------------------------------
// POST /:id/leave — Leave a shared ride
// ---------------------------------------------------------------------------
router.post('/:id/leave', authenticate, async (req, res) => {
  try {
    const result = await leaveSharedRide(req.params.id, req.user.id);

    return res.status(200).json({
      message: 'You have left the shared ride',
      sharedRideId: result.sharedRideId,
      currentPassengers: result.currentPassengers,
      status: result.status,
    });
  } catch (err) {
    if (err.statusCode) {
      const label =
        err.statusCode === 404 ? 'Not found'
          : err.statusCode === 409 ? 'Conflict'
            : 'Error';
      return res.status(err.statusCode).json({
        error: label,
        message: err.message,
      });
    }
    console.error('[ridesharing] POST /:id/leave error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred while leaving the shared ride',
    });
  }
});

// ---------------------------------------------------------------------------
// GET /:id/fare-split — Calculate fare split for a shared ride
// ---------------------------------------------------------------------------
router.get('/:id/fare-split', authenticate, async (req, res) => {
  try {
    const fareSplit = await calculateFareShare(req.params.id);

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
