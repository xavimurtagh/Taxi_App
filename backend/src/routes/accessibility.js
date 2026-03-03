import { Router } from 'express';
import Joi from 'joi';
import { query } from '../config/database.js';
import { authenticate, optionalAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import {
  getAccessibilityOptions,
  matchAccessibleDriver,
  updateDriverAccessibility,
  VALID_FEATURE_KEYS,
} from '../services/accessibility.js';

const router = Router();

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const nearbyDriversSchema = Joi.object({
  lat: Joi.number().min(-90).max(90).required()
    .messages({ 'any.required': 'Latitude is required' }),
  lng: Joi.number().min(-180).max(180).required()
    .messages({ 'any.required': 'Longitude is required' }),
  needs: Joi.alternatives()
    .try(
      Joi.array().items(Joi.string().valid(...VALID_FEATURE_KEYS)).min(1),
      Joi.string().valid(...VALID_FEATURE_KEYS),
    )
    .required()
    .messages({ 'any.required': 'At least one accessibility need is required' }),
});

const preferencesSchema = Joi.object({
  accessibilityNeeds: Joi.object()
    .pattern(
      Joi.string().valid(...VALID_FEATURE_KEYS),
      Joi.boolean(),
    )
    .min(1)
    .required()
    .messages({ 'any.required': 'Accessibility needs object is required' }),
});

const driverFeaturesSchema = Joi.object({
  features: Joi.object()
    .pattern(
      Joi.string().valid(...VALID_FEATURE_KEYS),
      Joi.boolean(),
    )
    .min(1)
    .required()
    .messages({ 'any.required': 'Features object is required' }),
});

// ---------------------------------------------------------------------------
// GET /options — List available accessibility options (public)
// ---------------------------------------------------------------------------
router.get('/options', optionalAuth, async (_req, res) => {
  try {
    const options = getAccessibilityOptions();

    // Group by category for convenient client rendering
    const grouped = {};
    for (const option of options) {
      if (!grouped[option.category]) {
        grouped[option.category] = [];
      }
      grouped[option.category].push(option);
    }

    return res.status(200).json({
      options,
      categories: grouped,
    });
  } catch (err) {
    console.error('[accessibility] GET /options error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred while fetching accessibility options',
    });
  }
});

// ---------------------------------------------------------------------------
// GET /drivers/nearby — Find accessible drivers nearby (auth required)
// ---------------------------------------------------------------------------
router.get(
  '/drivers/nearby',
  authenticate,
  validate(nearbyDriversSchema, 'query'),
  async (req, res) => {
    try {
      const { lat, lng, needs } = req.query;

      // Normalise needs to an array (query param can be a single string or array)
      const needsArray = Array.isArray(needs) ? needs : [needs];

      const drivers = await matchAccessibleDriver(
        parseFloat(lat),
        parseFloat(lng),
        needsArray,
      );

      return res.status(200).json({
        drivers,
        count: drivers.length,
        searchCriteria: {
          lat: parseFloat(lat),
          lng: parseFloat(lng),
          needs: needsArray,
        },
      });
    } catch (err) {
      console.error('[accessibility] GET /drivers/nearby error:', err);
      return res.status(500).json({
        error: 'Internal server error',
        message: 'An unexpected error occurred while searching for accessible drivers',
      });
    }
  },
);

// ---------------------------------------------------------------------------
// PUT /preferences — Update user's accessibility preferences (auth required)
// ---------------------------------------------------------------------------
router.put(
  '/preferences',
  authenticate,
  validate(preferencesSchema),
  async (req, res) => {
    try {
      const userId = req.user.id;
      const { accessibilityNeeds } = req.body;

      const result = await query(
        `UPDATE users
         SET accessibility_needs = $1,
             updated_at = NOW()
         WHERE id = $2
         RETURNING id, accessibility_needs`,
        [JSON.stringify(accessibilityNeeds), userId],
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: 'Not found',
          message: 'User not found',
        });
      }

      return res.status(200).json({
        message: 'Accessibility preferences updated',
        accessibilityNeeds: result.rows[0].accessibility_needs,
      });
    } catch (err) {
      console.error('[accessibility] PUT /preferences error:', err);
      return res.status(500).json({
        error: 'Internal server error',
        message: 'An unexpected error occurred while updating accessibility preferences',
      });
    }
  },
);

// ---------------------------------------------------------------------------
// PUT /driver-features — Update driver's accessibility features (driver role)
// ---------------------------------------------------------------------------
router.put(
  '/driver-features',
  authenticate,
  requireRole('driver', 'both'),
  validate(driverFeaturesSchema),
  async (req, res) => {
    try {
      const driverId = req.user.id;
      const { features } = req.body;

      // Verify the driver has a profile
      const profileResult = await query(
        `SELECT id FROM driver_profiles WHERE user_id = $1`,
        [driverId],
      );

      if (profileResult.rows.length === 0) {
        return res.status(404).json({
          error: 'Not found',
          message: 'Driver profile not found. Create a driver profile first.',
        });
      }

      const updatedFeatures = await updateDriverAccessibility(driverId, features);

      if (updatedFeatures === null) {
        return res.status(404).json({
          error: 'Not found',
          message: 'Driver profile not found',
        });
      }

      return res.status(200).json({
        message: 'Driver accessibility features updated',
        accessibilityFeatures: updatedFeatures,
      });
    } catch (err) {
      console.error('[accessibility] PUT /driver-features error:', err);
      return res.status(500).json({
        error: 'Internal server error',
        message: 'An unexpected error occurred while updating driver accessibility features',
      });
    }
  },
);

export default router;
