import { query } from '../config/database.js';
import { getConfig } from './platformConfig.js';
import { notifyUser } from './notifications.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CODE_LENGTH = 8;
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No ambiguous chars (0,O,1,I)
const DEFAULT_RIDES_NEEDED = 5;
const DEFAULT_REWARD_AMOUNT = 10.0;
const DEFAULT_REWARD_TYPE = 'ride_credit';

// ---------------------------------------------------------------------------
// generateReferralCode
// ---------------------------------------------------------------------------

/**
 * Generate a unique, human-friendly referral code for a user.
 *
 * If the user already has a referral code, returns the existing one.
 * Otherwise, generates an 8-character alphanumeric code, saves it to
 * users.referral_code, and returns it.
 *
 * @param {string} userId - User UUID
 * @returns {Promise<string>} The referral code
 */
export async function generateReferralCode(userId) {
  // Check if user already has a code
  const existing = await query(
    `SELECT referral_code FROM users WHERE id = $1`,
    [userId]
  );

  if (existing.rows.length === 0) {
    throw Object.assign(new Error('User not found'), { statusCode: 404 });
  }

  if (existing.rows[0].referral_code) {
    return existing.rows[0].referral_code;
  }

  // Generate a unique code with retry logic
  let code;
  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
    code = generateCode(CODE_LENGTH);

    try {
      await query(
        `UPDATE users SET referral_code = $1 WHERE id = $2 AND referral_code IS NULL`,
        [code, userId]
      );

      // Verify it was actually set (no conflict)
      const verify = await query(
        `SELECT referral_code FROM users WHERE id = $1`,
        [userId]
      );

      if (verify.rows[0].referral_code === code) {
        return code;
      }

      // Another code was already set (race condition), return that one
      if (verify.rows[0].referral_code) {
        return verify.rows[0].referral_code;
      }
    } catch (err) {
      // Unique constraint violation -- try another code
      if (err.code === '23505') {
        attempts++;
        continue;
      }
      throw err;
    }

    attempts++;
  }

  throw new Error('Failed to generate a unique referral code after multiple attempts');
}

// ---------------------------------------------------------------------------
// applyReferralCode
// ---------------------------------------------------------------------------

/**
 * Apply a referral code to establish a referrer/referred relationship.
 *
 * Validates that:
 * - The code exists and belongs to another user
 * - The user has not already been referred
 * - The user is not trying to refer themselves
 *
 * @param {string} referredUserId - The user applying the code (referred user)
 * @param {string} code           - The referral code to apply
 * @returns {Promise<Object>} The created referral record
 */
export async function applyReferralCode(referredUserId, code) {
  // Look up the referrer by code
  const referrerResult = await query(
    `SELECT id, first_name FROM users WHERE referral_code = $1`,
    [code.toUpperCase()]
  );

  if (referrerResult.rows.length === 0) {
    throw Object.assign(new Error('Invalid referral code'), { statusCode: 400 });
  }

  const referrer = referrerResult.rows[0];

  // Cannot refer yourself
  if (referredUserId && referrer.id === referredUserId) {
    throw Object.assign(new Error('You cannot use your own referral code'), { statusCode: 400 });
  }

  // Check if this user has already been referred (only if we have a userId)
  if (referredUserId) {
    const existingReferral = await query(
      `SELECT id FROM referrals WHERE referred_id = $1`,
      [referredUserId]
    );

    if (existingReferral.rows.length > 0) {
      throw Object.assign(new Error('You have already applied a referral code'), { statusCode: 409 });
    }
  }

  // Get configurable rides needed
  const ridesNeeded = (await getConfig('referral_rides_needed')) || DEFAULT_RIDES_NEEDED;

  // Create the referral record
  const result = await query(
    `INSERT INTO referrals (referrer_id, referred_id, referral_code, status, rides_completed, rides_needed)
     VALUES ($1, $2, $3, 'pending', 0, $4)
     RETURNING id, referrer_id, referred_id, referral_code, status,
               rides_completed, rides_needed, created_at`,
    [referrer.id, referredUserId, code.toUpperCase(), ridesNeeded]
  );

  const referral = result.rows[0];

  // Notify the referrer
  await notifyUser(referrer.id, 'referral:applied', {
    referralId: referral.id,
    referredUserId,
    message: 'Someone has used your referral code! They need to complete rides to qualify.',
  });

  return {
    id: referral.id,
    referrerId: referral.referrer_id,
    referredId: referral.referred_id,
    referralCode: referral.referral_code,
    status: referral.status,
    ridesCompleted: referral.rides_completed,
    ridesNeeded: referral.rides_needed,
    createdAt: referral.created_at,
  };
}

// ---------------------------------------------------------------------------
// checkReferralProgress
// ---------------------------------------------------------------------------

/**
 * Called after a referred user completes a ride. Increments the ride counter
 * and checks if the referral qualifies for a reward.
 *
 * @param {string} referredUserId - The referred user who just completed a ride
 * @returns {Promise<Object|null>} The referral if it qualified, null otherwise
 */
export async function checkReferralProgress(referredUserId) {
  // Find a pending referral for this user
  const referralResult = await query(
    `SELECT id, referrer_id, referred_id, rides_completed, rides_needed
     FROM referrals
     WHERE referred_id = $1
       AND status = 'pending'`,
    [referredUserId]
  );

  if (referralResult.rows.length === 0) {
    return null; // No pending referral
  }

  const referral = referralResult.rows[0];
  const newRidesCompleted = referral.rides_completed + 1;

  if (newRidesCompleted >= referral.rides_needed) {
    // Qualify the referral
    const updated = await query(
      `UPDATE referrals
       SET rides_completed = $1,
           status = 'qualified',
           updated_at = NOW()
       WHERE id = $2
       RETURNING id, referrer_id, referred_id, status, rides_completed, rides_needed`,
      [newRidesCompleted, referral.id]
    );

    const qualifiedReferral = updated.rows[0];

    // Automatically issue rewards
    try {
      await issueReward(qualifiedReferral.id);
    } catch (err) {
      console.error(`[referrals] Failed to auto-issue reward for referral ${qualifiedReferral.id}:`, err.message);
    }

    // Notify both users
    await notifyUser(referral.referrer_id, 'referral:qualified', {
      referralId: qualifiedReferral.id,
      message: 'Your referral has completed enough rides. You have earned a reward!',
    });

    await notifyUser(referral.referred_id, 'referral:qualified', {
      referralId: qualifiedReferral.id,
      message: 'Congratulations! You have qualified your referral and earned a reward!',
    });

    return qualifiedReferral;
  }

  // Not yet qualified -- just increment the counter
  await query(
    `UPDATE referrals SET rides_completed = $1, updated_at = NOW() WHERE id = $2`,
    [newRidesCompleted, referral.id]
  );

  return null;
}

// ---------------------------------------------------------------------------
// issueReward
// ---------------------------------------------------------------------------

/**
 * Create ride_credit entries for both the referrer and the referred user.
 *
 * @param {string} referralId - UUID of the qualified referral
 * @returns {Promise<Array>} Array of two reward records [referrerReward, referredReward]
 */
export async function issueReward(referralId) {
  // Get the referral
  const referralResult = await query(
    `SELECT id, referrer_id, referred_id, status
     FROM referrals
     WHERE id = $1`,
    [referralId]
  );

  if (referralResult.rows.length === 0) {
    throw Object.assign(new Error('Referral not found'), { statusCode: 404 });
  }

  const referral = referralResult.rows[0];

  if (referral.status !== 'qualified') {
    throw Object.assign(
      new Error(`Cannot issue rewards for a referral with status '${referral.status}'`),
      { statusCode: 409 }
    );
  }

  // Check if rewards have already been issued
  const existingRewards = await query(
    `SELECT id FROM referral_rewards WHERE referral_id = $1`,
    [referralId]
  );

  if (existingRewards.rows.length > 0) {
    throw Object.assign(new Error('Rewards have already been issued for this referral'), { statusCode: 409 });
  }

  const rewardAmount = (await getConfig('referral_reward_amount')) || DEFAULT_REWARD_AMOUNT;
  const rewardType = (await getConfig('referral_reward_type')) || DEFAULT_REWARD_TYPE;
  const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000); // 90 days

  const rewards = [];

  // Create reward and ride credit for referrer
  const referrerReward = await query(
    `INSERT INTO referral_rewards (referral_id, user_id, reward_type, amount, status, expires_at)
     VALUES ($1, $2, $3, $4, 'credited', $5)
     RETURNING id, referral_id, user_id, reward_type, amount, status, created_at, expires_at`,
    [referralId, referral.referrer_id, rewardType, rewardAmount, expiresAt]
  );
  rewards.push(referrerReward.rows[0]);

  // Create ride credit for referrer
  await query(
    `INSERT INTO ride_credits (user_id, amount, remaining, source, source_id, expires_at)
     VALUES ($1, $2, $2, 'referral', $3, $4)`,
    [referral.referrer_id, rewardAmount, referrerReward.rows[0].id, expiresAt]
  );

  // Create reward and ride credit for referred user
  const referredReward = await query(
    `INSERT INTO referral_rewards (referral_id, user_id, reward_type, amount, status, expires_at)
     VALUES ($1, $2, $3, $4, 'credited', $5)
     RETURNING id, referral_id, user_id, reward_type, amount, status, created_at, expires_at`,
    [referralId, referral.referred_id, rewardType, rewardAmount, expiresAt]
  );
  rewards.push(referredReward.rows[0]);

  // Create ride credit for referred user
  await query(
    `INSERT INTO ride_credits (user_id, amount, remaining, source, source_id, expires_at)
     VALUES ($1, $2, $2, 'referral', $3, $4)`,
    [referral.referred_id, rewardAmount, referredReward.rows[0].id, expiresAt]
  );

  // Update the referral status to 'rewarded'
  await query(
    `UPDATE referrals SET status = 'rewarded', updated_at = NOW() WHERE id = $1`,
    [referralId]
  );

  return rewards;
}

// ---------------------------------------------------------------------------
// getUserReferrals
// ---------------------------------------------------------------------------

/**
 * Get paginated list of a user's referrals (people they referred).
 *
 * @param {string} userId   - User UUID
 * @param {Object} [opts]
 * @param {number} [opts.page=1]
 * @param {number} [opts.limit=20]
 * @returns {Promise<{ referrals: Object[], total: number, page: number, limit: number }>}
 */
export async function getUserReferrals(userId, opts = {}) {
  const page = Math.max(1, parseInt(opts.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(opts.limit, 10) || 20));
  const offset = (page - 1) * limit;

  const countResult = await query(
    `SELECT COUNT(*)::int AS total FROM referrals WHERE referrer_id = $1`,
    [userId]
  );

  const total = countResult.rows[0].total;

  const result = await query(
    `SELECT r.id, r.referrer_id, r.referred_id, r.referral_code,
            r.status, r.rides_completed, r.rides_needed,
            r.created_at, r.updated_at,
            u.first_name AS referred_first_name,
            u.last_name AS referred_last_name,
            u.avatar_url AS referred_avatar_url
     FROM referrals r
     JOIN users u ON u.id = r.referred_id
     WHERE r.referrer_id = $1
     ORDER BY r.created_at DESC
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );

  const referrals = result.rows.map((row) => ({
    id: row.id,
    referrerId: row.referrer_id,
    referredId: row.referred_id,
    referralCode: row.referral_code,
    status: row.status,
    ridesCompleted: row.rides_completed,
    ridesNeeded: row.rides_needed,
    referredUser: {
      id: row.referred_id,
      firstName: row.referred_first_name,
      lastName: row.referred_last_name,
      avatarUrl: row.referred_avatar_url,
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));

  return { referrals, total, page, limit };
}

// ---------------------------------------------------------------------------
// getUserRewards
// ---------------------------------------------------------------------------

/**
 * Get paginated list of a user's referral rewards.
 *
 * @param {string} userId   - User UUID
 * @param {Object} [opts]
 * @param {number} [opts.page=1]
 * @param {number} [opts.limit=20]
 * @returns {Promise<{ rewards: Object[], total: number, page: number, limit: number }>}
 */
export async function getUserRewards(userId, opts = {}) {
  const page = Math.max(1, parseInt(opts.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(opts.limit, 10) || 20));
  const offset = (page - 1) * limit;

  const countResult = await query(
    `SELECT COUNT(*)::int AS total FROM referral_rewards WHERE user_id = $1`,
    [userId]
  );

  const total = countResult.rows[0].total;

  const result = await query(
    `SELECT rr.id, rr.referral_id, rr.user_id, rr.reward_type,
            rr.amount, rr.status, rr.stripe_transfer_id,
            rr.created_at, rr.expires_at,
            ref.referral_code, ref.referrer_id, ref.referred_id
     FROM referral_rewards rr
     LEFT JOIN referrals ref ON ref.id = rr.referral_id
     WHERE rr.user_id = $1
     ORDER BY rr.created_at DESC
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );

  const rewards = result.rows.map((row) => ({
    id: row.id,
    referralId: row.referral_id,
    userId: row.user_id,
    rewardType: row.reward_type,
    amount: row.amount,
    status: row.status,
    stripeTransferId: row.stripe_transfer_id,
    referralCode: row.referral_code,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  }));

  return { rewards, total, page, limit };
}

// ---------------------------------------------------------------------------
// getReferralStats
// ---------------------------------------------------------------------------

/**
 * Get aggregated referral statistics for a user.
 *
 * @param {string} userId - User UUID
 * @returns {Promise<Object>} Referral statistics
 */
export async function getReferralStats(userId) {
  // Get the user's referral code
  const userResult = await query(
    `SELECT referral_code FROM users WHERE id = $1`,
    [userId]
  );

  const referralCode = userResult.rows.length > 0 ? userResult.rows[0].referral_code : null;

  // Aggregate referral counts
  const referralCounts = await query(
    `SELECT
       COUNT(*)::int AS total_referred,
       COUNT(*) FILTER (WHERE status IN ('qualified', 'rewarded'))::int AS qualified,
       COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
       COUNT(*) FILTER (WHERE status = 'expired')::int AS expired
     FROM referrals
     WHERE referrer_id = $1`,
    [userId]
  );

  const counts = referralCounts.rows[0];

  // Total rewards earned (both as referrer and referred)
  const rewardsResult = await query(
    `SELECT
       COUNT(*)::int AS total_rewards,
       COALESCE(SUM(amount), 0)::decimal AS total_earned,
       COUNT(*) FILTER (WHERE status = 'credited')::int AS credited_count,
       COALESCE(SUM(amount) FILTER (WHERE status = 'credited'), 0)::decimal AS credited_amount,
       COUNT(*) FILTER (WHERE status = 'pending')::int AS pending_count,
       COALESCE(SUM(amount) FILTER (WHERE status = 'pending'), 0)::decimal AS pending_amount
     FROM referral_rewards
     WHERE user_id = $1`,
    [userId]
  );

  const rewards = rewardsResult.rows[0];

  // Available ride credits
  const creditsResult = await query(
    `SELECT COALESCE(SUM(remaining), 0)::decimal AS available_credits
     FROM ride_credits
     WHERE user_id = $1
       AND remaining > 0
       AND (expires_at IS NULL OR expires_at > NOW())`,
    [userId]
  );

  return {
    referralCode,
    totalReferred: counts.total_referred,
    qualifiedReferrals: counts.qualified,
    pendingReferrals: counts.pending,
    expiredReferrals: counts.expired,
    totalEarned: parseFloat(rewards.total_earned),
    rewards: {
      total: rewards.total_rewards,
      credited: rewards.credited_count,
      creditedAmount: parseFloat(rewards.credited_amount),
      pending: rewards.pending_count,
      pendingAmount: parseFloat(rewards.pending_amount),
    },
    availableCredits: parseFloat(creditsResult.rows[0].available_credits),
  };
}

// ---------------------------------------------------------------------------
// getUserCredits
// ---------------------------------------------------------------------------

/**
 * Get available ride credits for a user.
 *
 * @param {string} userId - User UUID
 * @returns {Promise<{ credits: Object[], totalAvailable: number }>}
 */
export async function getUserCredits(userId) {
  const result = await query(
    `SELECT id, user_id, amount, remaining, source, source_id,
            expires_at, created_at
     FROM ride_credits
     WHERE user_id = $1
       AND remaining > 0
       AND (expires_at IS NULL OR expires_at > NOW())
     ORDER BY expires_at ASC NULLS LAST`,
    [userId]
  );

  const credits = result.rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    amount: row.amount,
    remaining: row.remaining,
    source: row.source,
    sourceId: row.source_id,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  }));

  const totalAvailable = credits.reduce(
    (sum, c) => sum + parseFloat(c.remaining),
    0
  );

  return {
    credits,
    totalAvailable: Math.round(totalAvailable * 100) / 100,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Generate a random alphanumeric code of the specified length.
 *
 * @param {number} length
 * @returns {string}
 */
function generateCode(length) {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += CODE_CHARS.charAt(Math.floor(Math.random() * CODE_CHARS.length));
  }
  return code;
}
