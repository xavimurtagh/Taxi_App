import { Router } from 'express';
import Joi from 'joi';
import { authenticate, optionalAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import {
  generateReferralCode,
  applyReferralCode,
  getUserReferrals,
  getUserRewards,
  getReferralStats,
  getUserCredits,
} from '../services/referrals.js';

const router = Router();

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const applyCodeSchema = Joi.object({
  code: Joi.string()
    .trim()
    .alphanum()
    .min(6)
    .max(12)
    .required()
    .messages({
      'string.alphanum': 'Referral code must be alphanumeric',
      'string.min': 'Referral code must be at least 6 characters',
      'string.max': 'Referral code must not exceed 12 characters',
      'any.required': 'Referral code is required',
    }),
});

const paginationQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(50).default(20),
});

// ---------------------------------------------------------------------------
// GET /code — Get or generate the user's referral code
// ---------------------------------------------------------------------------
router.get('/code', authenticate, async (req, res) => {
  try {
    const code = await generateReferralCode(req.user.id);

    return res.status(200).json({
      referralCode: code,
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        error: err.statusCode === 404 ? 'Not found' : 'Error',
        message: err.message,
      });
    }
    console.error('[referrals] GET /code error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred while generating the referral code',
    });
  }
});

// ---------------------------------------------------------------------------
// POST /apply — Apply a referral code (optionalAuth for registration flow)
// ---------------------------------------------------------------------------
router.post(
  '/apply',
  optionalAuth,
  validate(applyCodeSchema),
  async (req, res) => {
    try {
      const userId = req.user ? req.user.id : null;

      if (!userId) {
        return res.status(401).json({
          error: 'Authentication required',
          message: 'You must be logged in to apply a referral code',
        });
      }

      const referral = await applyReferralCode(userId, req.body.code);

      return res.status(201).json({
        referral,
        message: `Referral code applied successfully! Complete ${referral.ridesNeeded} rides to qualify for your reward.`,
      });
    } catch (err) {
      if (err.statusCode) {
        const label =
          err.statusCode === 400 ? 'Validation failed'
            : err.statusCode === 409 ? 'Conflict'
              : 'Error';
        return res.status(err.statusCode).json({
          error: label,
          message: err.message,
        });
      }
      console.error('[referrals] POST /apply error:', err);
      return res.status(500).json({
        error: 'Internal server error',
        message: 'An unexpected error occurred while applying the referral code',
      });
    }
  }
);

// ---------------------------------------------------------------------------
// GET / — List user's referrals (people they referred)
// ---------------------------------------------------------------------------
router.get(
  '/',
  authenticate,
  validate(paginationQuerySchema, 'query'),
  async (req, res) => {
    try {
      const { page, limit } = req.query;

      const result = await getUserReferrals(req.user.id, { page, limit });

      return res.status(200).json(result);
    } catch (err) {
      console.error('[referrals] GET / error:', err);
      return res.status(500).json({
        error: 'Internal server error',
        message: 'An unexpected error occurred while fetching referrals',
      });
    }
  }
);

// ---------------------------------------------------------------------------
// GET /rewards — List user's referral rewards
// ---------------------------------------------------------------------------
router.get(
  '/rewards',
  authenticate,
  validate(paginationQuerySchema, 'query'),
  async (req, res) => {
    try {
      const { page, limit } = req.query;

      const result = await getUserRewards(req.user.id, { page, limit });

      return res.status(200).json(result);
    } catch (err) {
      console.error('[referrals] GET /rewards error:', err);
      return res.status(500).json({
        error: 'Internal server error',
        message: 'An unexpected error occurred while fetching rewards',
      });
    }
  }
);

// ---------------------------------------------------------------------------
// GET /stats — Referral stats (total referred, qualified, total earned)
// ---------------------------------------------------------------------------
router.get('/stats', authenticate, async (req, res) => {
  try {
    const stats = await getReferralStats(req.user.id);

    return res.status(200).json(stats);
  } catch (err) {
    console.error('[referrals] GET /stats error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred while fetching referral stats',
    });
  }
});

// ---------------------------------------------------------------------------
// GET /credits — Get available ride credits
// ---------------------------------------------------------------------------
router.get('/credits', authenticate, async (req, res) => {
  try {
    const result = await getUserCredits(req.user.id);

    return res.status(200).json(result);
  } catch (err) {
    console.error('[referrals] GET /credits error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred while fetching ride credits',
    });
  }
});

export default router;
