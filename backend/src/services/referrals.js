import { query } from '../config/database.js';
import { getConfig } from './platformConfig.js';
import { notifyUser } from './notifications.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CODE_LENGTH = 6;
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
 * Otherwise, generates a 6-character alphanumeric code, saves it to
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
      // Unique constraint violation — try another code
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
 * @param {string} userId - The user applying the code (referred user)
 * @param {string} code   - The referral code to apply
 * @returns {Promise<Object>} The created referral record
 */
export async function applyReferralCode(userId, code) {
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
  if (referrer.id === userId) {
    throw Object.assign(new Error('You cannot use your own referral code'), { statusCode: 400 });
  }

  // Check if this user has already been referred
  const existingReferral = await query(
    `SELECT id FROM referrals WHERE referred_id = $1`,
    [userId]
  );

  if (existingReferral.rows.length > 0) {
    throw Object.assign(new Error('You have already applied a referral code'), { statusCode: 409 });
  }

  // Get configurable rides needed
  const ridesNeeded = (await getConfig('referral_rides_needed')) || DEFAULT_RIDES_NEEDED;

  // Create the referral record
  const result = await query(
    `INSERT INTO referrals (referrer_id, referred_id, referral_code, status, rides_completed, rides_needed)
     VALUES ($1, $2, $3, 'pending', 0, $4)
     RETURNING id, referrer_id, referred_id, referral_code, status,
               rides_completed, rides_needed, created_at`,
    [referrer.id, userId, code.toUpperCase(), ridesNeeded]
  );

  const referral = result.rows[0];

  // Notify the referrer
  await notifyUser(referrer.id, 'referral:applied', {
    referralId: referral.id,
    referredUserId: userId,
    message: 'Someone has used your referral code! They need to complete rides to qualify.',
  });

  return referral;
}

// ---------------------------------------------------------------------------
// checkAndQualifyReferral
// ---------------------------------------------------------------------------

/**
 * Called after a referred user completes a ride. Increments the ride counter
 * and checks if the referral qualifies for a reward.
 *
 * @param {string} referredUserId - The referred user who just completed a ride
 * @returns {Promise<Object|null>} The referral if it qualified, null otherwise
 */
export async function checkAndQualifyReferral(referredUserId) {
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
           qualified_at = NOW()
       WHERE id = $2
       RETURNING id, referrer_id, referred_id, status, rides_completed, rides_needed, qualified_at`,
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

  // Not yet qualified — just increment the counter
  await query(
    `UPDATE referrals SET rides_completed = $1 WHERE id = $2`,
    [newRidesCompleted, referral.id]
  );

  return null;
}

// ---------------------------------------------------------------------------
// issueReward
// ---------------------------------------------------------------------------

/**
 * Create referral rewards for both the referrer and the referred user.
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

  // Create reward for referrer
  const referrerReward = await query(
    `INSERT INTO referral_rewards (referral_id, user_id, reward_type, amount, status, expires_at)
     VALUES ($1, $2, $3, $4, 'pending', $5)
     RETURNING id, referral_id, user_id, reward_type, amount, status, created_at, expires_at`,
    [referralId, referral.referrer_id, rewardType, rewardAmount, expiresAt]
  );

  // Create reward for referred user
  const referredReward = await query(
    `INSERT INTO referral_rewards (referral_id, user_id, reward_type, amount, status, expires_at)
     VALUES ($1, $2, $3, $4, 'pending', $5)
     RETURNING id, referral_id, user_id, reward_type, amount, status, created_at, expires_at`,
    [referralId, referral.referred_id, rewardType, rewardAmount, expiresAt]
  );

  // Update the referral status to 'rewarded'
  await query(
    `UPDATE referrals SET status = 'rewarded' WHERE id = $1`,
    [referralId]
  );

  return [referrerReward.rows[0], referredReward.rows[0]];
}

// ---------------------------------------------------------------------------
// claimReward
// ---------------------------------------------------------------------------

/**
 * Claim a referral reward by converting it into a ride credit.
 *
 * @param {string} rewardId - UUID of the reward to claim
 * @param {string} userId   - UUID of the user claiming the reward
 * @returns {Promise<Object>} The ride credit record
 */
export async function claimReward(rewardId, userId) {
  // Fetch the reward
  const rewardResult = await query(
    `SELECT id, referral_id, user_id, reward_type, amount, status, expires_at
     FROM referral_rewards
     WHERE id = $1`,
    [rewardId]
  );

  if (rewardResult.rows.length === 0) {
    throw Object.assign(new Error('Reward not found'), { statusCode: 404 });
  }

  const reward = rewardResult.rows[0];

  // Verify ownership
  if (reward.user_id !== userId) {
    throw Object.assign(new Error('You are not authorized to claim this reward'), { statusCode: 403 });
  }

  // Check status
  if (reward.status !== 'pending') {
    throw Object.assign(
      new Error(`This reward has already been ${reward.status}`),
      { statusCode: 409 }
    );
  }

  // Check expiry
  if (reward.expires_at && new Date(reward.expires_at) < new Date()) {
    // Mark as expired
    await query(
      `UPDATE referral_rewards SET status = 'expired' WHERE id = $1`,
      [rewardId]
    );
    throw Object.assign(new Error('This reward has expired'), { statusCode: 409 });
  }

  // Create a ride credit
  const creditExpiry = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000); // 180 days

  const creditResult = await query(
    `INSERT INTO ride_credits (user_id, amount, remaining, source, source_id, expires_at)
     VALUES ($1, $2, $2, 'referral', $3, $4)
     RETURNING id, user_id, amount, remaining, source, source_id, expires_at, created_at`,
    [userId, reward.amount, rewardId, creditExpiry]
  );

  // Mark the reward as credited
  await query(
    `UPDATE referral_rewards SET status = 'credited', credited_at = NOW() WHERE id = $1`,
    [rewardId]
  );

  return creditResult.rows[0];
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

  // Total referred users
  const totalResult = await query(
    `SELECT COUNT(*)::int AS total FROM referrals WHERE referrer_id = $1`,
    [userId]
  );

  // Qualified referrals
  const qualifiedResult = await query(
    `SELECT COUNT(*)::int AS total FROM referrals
     WHERE referrer_id = $1 AND status IN ('qualified', 'rewarded')`,
    [userId]
  );

  // Pending referrals
  const pendingResult = await query(
    `SELECT COUNT(*)::int AS total FROM referrals
     WHERE referrer_id = $1 AND status = 'pending'`,
    [userId]
  );

  // Total rewards earned (both as referrer and referred)
  const rewardsResult = await query(
    `SELECT
       COUNT(*)::int AS total_rewards,
       COALESCE(SUM(amount), 0)::decimal AS total_amount,
       COUNT(*) FILTER (WHERE status = 'credited')::int AS claimed_rewards,
       COALESCE(SUM(amount) FILTER (WHERE status = 'credited'), 0)::decimal AS claimed_amount,
       COUNT(*) FILTER (WHERE status = 'pending')::int AS pending_rewards,
       COALESCE(SUM(amount) FILTER (WHERE status = 'pending'), 0)::decimal AS pending_amount
     FROM referral_rewards
     WHERE user_id = $1`,
    [userId]
  );

  const rewards = rewardsResult.rows[0];

  return {
    referralCode,
    totalReferred: totalResult.rows[0].total,
    qualifiedReferrals: qualifiedResult.rows[0].total,
    pendingReferrals: pendingResult.rows[0].total,
    rewards: {
      total: rewards.total_rewards,
      totalAmount: parseFloat(rewards.total_amount),
      claimed: rewards.claimed_rewards,
      claimedAmount: parseFloat(rewards.claimed_amount),
      pending: rewards.pending_rewards,
      pendingAmount: parseFloat(rewards.pending_amount),
    },
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
