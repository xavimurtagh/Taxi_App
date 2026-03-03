import { Router } from 'express';
import Joi from 'joi';
import { query } from '../config/database.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import {
  generateReferralCode,
  applyReferralCode,
  claimReward,
  getReferralStats,
} from '../services/referrals.js';

const router = Router();

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const applyCodeSchema = Joi.object({
  code: Joi.string()
    .trim()
    .alphanum()
    .length(6)
    .required()
    .messages({
      'string.alphanum': 'Referral code must be alphanumeric',
      'string.length': 'Referral code must be exactly 6 characters',
      'any.required': 'Referral code is required',
    }),
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
// POST /apply — Apply a referral code
// ---------------------------------------------------------------------------
router.post(
  '/apply',
  authenticate,
  validate(applyCodeSchema),
  async (req, res) => {
    try {
      const referral = await applyReferralCode(req.user.id, req.body.code);

      return res.status(201).json({
        referral: {
          id: referral.id,
          referrerId: referral.referrer_id,
          referredId: referral.referred_id,
          referralCode: referral.referral_code,
          status: referral.status,
          ridesCompleted: referral.rides_completed,
          ridesNeeded: referral.rides_needed,
          createdAt: referral.created_at,
        },
        message: `Referral code applied successfully! Complete ${referral.rides_needed} rides to qualify for your reward.`,
      });
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({
          error: err.statusCode === 400 ? 'Validation failed' : 'Conflict',
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
// GET /status — Get user's referral stats
// ---------------------------------------------------------------------------
router.get('/status', authenticate, async (req, res) => {
  try {
    const stats = await getReferralStats(req.user.id);

    return res.status(200).json(stats);
  } catch (err) {
    console.error('[referrals] GET /status error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred while fetching referral stats',
    });
  }
});

// ---------------------------------------------------------------------------
// GET /list — List all user's referrals
// ---------------------------------------------------------------------------
router.get('/list', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await query(
      `SELECT
         r.id,
         r.referrer_id,
         r.referred_id,
         r.referral_code,
         r.status,
         r.rides_completed,
         r.rides_needed,
         r.created_at,
         r.qualified_at,
         u.first_name AS referred_first_name,
         u.last_name AS referred_last_name,
         u.avatar_url AS referred_avatar_url
       FROM referrals r
       JOIN users u ON u.id = r.referred_id
       WHERE r.referrer_id = $1
       ORDER BY r.created_at DESC`,
      [userId]
    );

    const referrals = result.rows.map((row) => ({
      id: row.id,
      referrerId: row.referrer_id,
      referredId: row.referred_id,
      referralCode: row.referral_code,
      status: row.status,
      ridesCompleted: row.rides_completed,
      ridesNeeded: row.rides_needed,
      createdAt: row.created_at,
      qualifiedAt: row.qualified_at,
      referredUser: {
        id: row.referred_id,
        firstName: row.referred_first_name,
        lastName: row.referred_last_name,
        avatarUrl: row.referred_avatar_url,
      },
    }));

    return res.status(200).json({
      referrals,
      total: referrals.length,
    });
  } catch (err) {
    console.error('[referrals] GET /list error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred while fetching referrals',
    });
  }
});

// ---------------------------------------------------------------------------
// GET /rewards — List user's earned rewards
// ---------------------------------------------------------------------------
router.get('/rewards', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await query(
      `SELECT
         rr.id,
         rr.referral_id,
         rr.user_id,
         rr.reward_type,
         rr.amount,
         rr.status,
         rr.created_at,
         rr.credited_at,
         rr.expires_at,
         ref.referral_code,
         ref.referrer_id,
         ref.referred_id,
         -- Get the other user's name for context
         CASE
           WHEN ref.referrer_id = $1 THEN ru.first_name
           ELSE rfu.first_name
         END AS related_first_name,
         CASE
           WHEN ref.referrer_id = $1 THEN ru.last_name
           ELSE rfu.last_name
         END AS related_last_name
       FROM referral_rewards rr
       JOIN referrals ref ON ref.id = rr.referral_id
       LEFT JOIN users ru ON ru.id = ref.referred_id
       LEFT JOIN users rfu ON rfu.id = ref.referrer_id
       WHERE rr.user_id = $1
       ORDER BY rr.created_at DESC`,
      [userId]
    );

    const rewards = result.rows.map((row) => ({
      id: row.id,
      referralId: row.referral_id,
      rewardType: row.reward_type,
      amount: row.amount,
      status: row.status,
      createdAt: row.created_at,
      creditedAt: row.credited_at,
      expiresAt: row.expires_at,
      referralCode: row.referral_code,
      relatedUser: {
        firstName: row.related_first_name,
        lastName: row.related_last_name,
      },
    }));

    return res.status(200).json({
      rewards,
      total: rewards.length,
    });
  } catch (err) {
    console.error('[referrals] GET /rewards error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred while fetching rewards',
    });
  }
});

// ---------------------------------------------------------------------------
// POST /rewards/:id/claim — Claim a reward
// ---------------------------------------------------------------------------
router.post('/rewards/:id/claim', authenticate, async (req, res) => {
  try {
    const { id: rewardId } = req.params;
    const userId = req.user.id;

    const credit = await claimReward(rewardId, userId);

    return res.status(200).json({
      message: 'Reward claimed successfully and converted to ride credit',
      credit: {
        id: credit.id,
        amount: credit.amount,
        remaining: credit.remaining,
        source: credit.source,
        expiresAt: credit.expires_at,
        createdAt: credit.created_at,
      },
    });
  } catch (err) {
    if (err.statusCode) {
      const errorType =
        err.statusCode === 404 ? 'Not found' :
        err.statusCode === 403 ? 'Forbidden' : 'Conflict';
      return res.status(err.statusCode).json({
        error: errorType,
        message: err.message,
      });
    }
    console.error('[referrals] POST /rewards/:id/claim error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred while claiming the reward',
    });
  }
});

export default router;
