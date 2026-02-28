import Stripe from 'stripe';
import env from '../config/env.js';
import pool, { query } from '../config/database.js';
import { getConfig } from './platformConfig.js';
import { notifyUser } from './notifications.js';
import { getIO } from '../sockets/index.js';

const stripe = new Stripe(env.STRIPE_SECRET_KEY);

/**
 * Log tag for console output.
 */
const TAG = '[redistribution]';

/**
 * Size of each batch when processing Stripe payouts.
 */
const PAYOUT_BATCH_SIZE = 10;

/**
 * Minimum rides in the period for a user to be eligible for surplus payout.
 */
const MIN_RIDES_FOR_PAYOUT = 5;

/**
 * If more than this fraction of payout items fail, the distribution is
 * marked as 'failed' rather than 'completed'.
 */
const FAILURE_THRESHOLD = 0.5;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Determine the calendar quarter label from a date.
 *
 * @param {Date|string} date
 * @returns {{ quarter: number, year: number }}
 */
function getQuarterLabel(date) {
  const d = new Date(date);
  const month = d.getMonth(); // 0-indexed
  const quarter = Math.floor(month / 3) + 1;
  return { quarter, year: d.getFullYear() };
}

/**
 * Convert a dollar amount (number) to Stripe-compatible integer cents.
 * Guards against floating-point drift by rounding.
 *
 * @param {number} dollars
 * @returns {number} cents (integer)
 */
function toCents(dollars) {
  return Math.round(Number(dollars) * 100);
}

/**
 * Process an array in sequential batches.
 *
 * @param {Array} items
 * @param {number} size
 * @param {(batch: Array) => Promise<void>} fn
 */
async function processInBatches(items, size, fn) {
  for (let i = 0; i < items.length; i += size) {
    const batch = items.slice(i, i + size);
    await fn(batch);
  }
}

// ---------------------------------------------------------------------------
// calculateDistribution
// ---------------------------------------------------------------------------

/**
 * Calculate the surplus redistribution for a given period.
 *
 * Queries total platform fees and operating costs, computes the surplus,
 * then proportionally allocates shares to eligible drivers and passengers
 * based on rides completed/taken during the period.
 *
 * @param {string|Date} periodStart - Start of the period (inclusive)
 * @param {string|Date} periodEnd   - End of the period (exclusive)
 * @returns {Promise<object>}
 */
export async function calculateDistribution(periodStart, periodEnd) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // ------------------------------------------------------------------
    // 1. Total platform fees collected from completed rides in period
    // ------------------------------------------------------------------
    const feesResult = await client.query(
      `SELECT COALESCE(SUM(platform_fee), 0) AS total_fees,
              COUNT(*)::int                   AS total_rides,
              COALESCE(SUM(fare_amount), 0)   AS total_fares
       FROM rides
       WHERE status = 'completed'
         AND dropoff_at >= $1
         AND dropoff_at < $2`,
      [periodStart, periodEnd],
    );

    const totalFees  = parseFloat(feesResult.rows[0].total_fees);
    const totalRides = feesResult.rows[0].total_rides;
    const totalFares = parseFloat(feesResult.rows[0].total_fares);

    // ------------------------------------------------------------------
    // 2. Get or create platform_financials record for the period
    // ------------------------------------------------------------------
    const finResult = await client.query(
      `SELECT * FROM platform_financials
       WHERE period_start = $1 AND period_end = $2`,
      [periodStart, periodEnd],
    );

    let financials;

    if (finResult.rows.length === 0) {
      // Create a draft record so an admin can fill in actual costs later
      const insertResult = await client.query(
        `INSERT INTO platform_financials
           (period_start, period_end, total_rides, total_fares,
            total_platform_fees, server_costs, payment_processing,
            insurance_costs, support_costs, surplus)
         VALUES ($1, $2, $3, $4, $5, 0, 0, 0, 0, 0)
         RETURNING *`,
        [periodStart, periodEnd, totalRides, totalFares, totalFees],
      );

      await client.query('COMMIT');

      return {
        surplus: 0,
        message:
          'Draft financials record created. An admin must enter actual operating costs before the surplus can be calculated.',
        financialsId: insertResult.rows[0].id,
        totalFees,
        totalRides,
        totalFares,
      };
    }

    financials = finResult.rows[0];

    // ------------------------------------------------------------------
    // 3. Calculate surplus
    // ------------------------------------------------------------------
    const operatingCosts =
      parseFloat(financials.server_costs     || 0) +
      parseFloat(financials.payment_processing || 0) +
      parseFloat(financials.insurance_costs  || 0) +
      parseFloat(financials.support_costs    || 0);

    const surplus = totalFees - operatingCosts;

    if (surplus <= 0) {
      // Update financials with latest ride data
      await client.query(
        `UPDATE platform_financials
         SET total_rides = $1, total_fares = $2,
             total_platform_fees = $3, surplus = $4
         WHERE id = $5`,
        [totalRides, totalFares, totalFees, surplus, financials.id],
      );

      await client.query('COMMIT');

      return {
        surplus: 0,
        message: 'No surplus to distribute',
        operatingCosts,
        totalFees,
        totalRides,
      };
    }

    // ------------------------------------------------------------------
    // 4. Get share percentages from platform_config
    // ------------------------------------------------------------------
    const driverSharePct   = (await getConfig('surplus_driver_share'))   ?? 70;
    const passengerSharePct = (await getConfig('surplus_passenger_share')) ?? 30;

    const driverPool   = Math.round(surplus * (driverSharePct / 100) * 100) / 100;
    const passengerPool = Math.round(surplus * (passengerSharePct / 100) * 100) / 100;

    // ------------------------------------------------------------------
    // 5. Eligible drivers (proportional to rides completed)
    //    - Verified, active, >= MIN_RIDES_FOR_PAYOUT rides in period
    // ------------------------------------------------------------------
    const driversResult = await client.query(
      `SELECT r.driver_id AS user_id, COUNT(*)::int AS rides
       FROM rides r
       JOIN users u ON u.id = r.driver_id
       WHERE r.status = 'completed'
         AND r.dropoff_at >= $1
         AND r.dropoff_at < $2
         AND u.is_verified = true
         AND u.is_active   = true
       GROUP BY r.driver_id
       HAVING COUNT(*) >= $3`,
      [periodStart, periodEnd, MIN_RIDES_FOR_PAYOUT],
    );

    const totalDriverRides = driversResult.rows.reduce(
      (sum, r) => sum + r.rides, 0,
    );

    const driverPayouts = driversResult.rows.map((r) => ({
      userId: r.user_id,
      userType: 'driver',
      rides: r.rides,
      amount:
        totalDriverRides > 0
          ? Math.round((r.rides / totalDriverRides) * driverPool * 100) / 100
          : 0,
    }));

    // ------------------------------------------------------------------
    // 6. Eligible passengers (proportional to rides taken)
    // ------------------------------------------------------------------
    const passengersResult = await client.query(
      `SELECT r.passenger_id AS user_id, COUNT(*)::int AS rides
       FROM rides r
       JOIN users u ON u.id = r.passenger_id
       WHERE r.status = 'completed'
         AND r.dropoff_at >= $1
         AND r.dropoff_at < $2
         AND u.is_verified = true
         AND u.is_active   = true
       GROUP BY r.passenger_id
       HAVING COUNT(*) >= $3`,
      [periodStart, periodEnd, MIN_RIDES_FOR_PAYOUT],
    );

    const totalPassengerRides = passengersResult.rows.reduce(
      (sum, r) => sum + r.rides, 0,
    );

    const passengerPayouts = passengersResult.rows.map((r) => ({
      userId: r.user_id,
      userType: 'passenger',
      rides: r.rides,
      amount:
        totalPassengerRides > 0
          ? Math.round((r.rides / totalPassengerRides) * passengerPool * 100) / 100
          : 0,
    }));

    // ------------------------------------------------------------------
    // 7. Persist distribution and individual payout items
    // ------------------------------------------------------------------

    // Update financials with latest ride totals and surplus
    await client.query(
      `UPDATE platform_financials
       SET total_rides = $1, total_fares = $2,
           total_platform_fees = $3, surplus = $4
       WHERE id = $5`,
      [totalRides, totalFares, totalFees, surplus, financials.id],
    );

    const distResult = await client.query(
      `INSERT INTO payout_distributions
         (period_start, period_end, financials_id, total_surplus,
          driver_pool, passenger_pool, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'calculated')
       RETURNING *`,
      [
        periodStart,
        periodEnd,
        financials.id,
        surplus,
        driverPool,
        passengerPool,
      ],
    );

    const distribution = distResult.rows[0];

    // Insert all payout items (drivers + passengers)
    const allPayouts = [...driverPayouts, ...passengerPayouts];

    for (const payout of allPayouts) {
      if (payout.amount <= 0) continue;

      await client.query(
        `INSERT INTO payout_items
           (distribution_id, user_id, user_type, rides_in_period, amount, status)
         VALUES ($1, $2, $3, $4, $5, 'pending')`,
        [
          distribution.id,
          payout.userId,
          payout.userType,
          payout.rides,
          payout.amount,
        ],
      );
    }

    await client.query('COMMIT');

    // ------------------------------------------------------------------
    // 8. Build response
    // ------------------------------------------------------------------
    const summary = {
      totalFees,
      operatingCosts,
      surplus,
      driverPool,
      passengerPool,
      driverSharePct,
      passengerSharePct,
      eligibleDrivers: driverPayouts.filter((p) => p.amount > 0).length,
      eligiblePassengers: passengerPayouts.filter((p) => p.amount > 0).length,
      totalRides,
    };

    return {
      distribution,
      driverPayouts: driverPayouts.filter((p) => p.amount > 0),
      passengerPayouts: passengerPayouts.filter((p) => p.amount > 0),
      summary,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(TAG, 'calculateDistribution error:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// approveDistribution
// ---------------------------------------------------------------------------

/**
 * Mark a calculated distribution as approved.
 *
 * @param {string} distributionId - UUID of the payout_distributions row
 * @param {string} approvedBy    - UUID of the approving admin / moderator
 * @returns {Promise<object>} The updated distribution record
 */
export async function approveDistribution(distributionId, approvedBy) {
  try {
    // Verify the distribution exists and is in the correct state
    const existing = await query(
      `SELECT id, status FROM payout_distributions WHERE id = $1`,
      [distributionId],
    );

    if (existing.rows.length === 0) {
      throw Object.assign(
        new Error(`Distribution ${distributionId} not found`),
        { statusCode: 404 },
      );
    }

    if (existing.rows[0].status !== 'calculated') {
      throw Object.assign(
        new Error(
          `Distribution cannot be approved: current status is "${existing.rows[0].status}", expected "calculated"`,
        ),
        { statusCode: 400 },
      );
    }

    const result = await query(
      `UPDATE payout_distributions
       SET status = 'approved',
           approved_by = $2,
           approved_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [distributionId, approvedBy],
    );

    console.log(TAG, `Distribution ${distributionId} approved by ${approvedBy}`);

    return result.rows[0];
  } catch (err) {
    console.error(TAG, 'approveDistribution error:', err.message);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// executeDistribution
// ---------------------------------------------------------------------------

/**
 * Execute an approved distribution by transferring funds via Stripe or
 * applying account credits.
 *
 * Drivers with a Stripe Connect account receive a Stripe Transfer.
 * Passengers (and drivers without Connect) receive an account credit.
 *
 * Processing happens in sequential batches of {@link PAYOUT_BATCH_SIZE} to
 * respect Stripe rate limits. Individual failures are logged but do not abort
 * the entire batch.
 *
 * @param {string} distributionId - UUID of the payout_distributions row
 * @returns {Promise<object>} Summary of processed, succeeded, and failed items
 */
export async function executeDistribution(distributionId) {
  try {
    // ------------------------------------------------------------------
    // 1. Verify the distribution is approved
    // ------------------------------------------------------------------
    const distResult = await query(
      `SELECT * FROM payout_distributions WHERE id = $1`,
      [distributionId],
    );

    if (distResult.rows.length === 0) {
      throw Object.assign(
        new Error(`Distribution ${distributionId} not found`),
        { statusCode: 404 },
      );
    }

    const distribution = distResult.rows[0];

    if (distribution.status !== 'approved') {
      throw Object.assign(
        new Error(
          `Distribution cannot be executed: current status is "${distribution.status}", expected "approved"`,
        ),
        { statusCode: 400 },
      );
    }

    // Mark as processing
    await query(
      `UPDATE payout_distributions SET status = 'processing' WHERE id = $1`,
      [distributionId],
    );

    // ------------------------------------------------------------------
    // 2. Fetch all pending payout items
    // ------------------------------------------------------------------
    const itemsResult = await query(
      `SELECT pi.*,
              u.stripe_connect_account_id,
              u.stripe_customer_id,
              u.first_name
       FROM payout_items pi
       JOIN users u ON u.id = pi.user_id
       WHERE pi.distribution_id = $1
         AND pi.status = 'pending'
       ORDER BY pi.created_at`,
      [distributionId],
    );

    const items = itemsResult.rows;

    if (items.length === 0) {
      await query(
        `UPDATE payout_distributions
         SET status = 'completed', completed_at = NOW()
         WHERE id = $1`,
        [distributionId],
      );
      return { distribution, processed: 0, succeeded: 0, failed: 0 };
    }

    // Determine quarter label for Stripe transfer descriptions
    const { quarter, year } = getQuarterLabel(distribution.period_start);

    let succeeded = 0;
    let failed = 0;

    // ------------------------------------------------------------------
    // 3. Process items in batches
    // ------------------------------------------------------------------
    await processInBatches(items, PAYOUT_BATCH_SIZE, async (batch) => {
      // Process each item in the batch concurrently (Promise.allSettled
      // ensures one failure does not affect the others in the batch)
      const results = await Promise.allSettled(
        batch.map((item) => processPayoutItem(item, quarter, year)),
      );

      for (const result of results) {
        if (result.status === 'fulfilled' && result.value.success) {
          succeeded++;
        } else {
          failed++;
        }
      }
    });

    const processed = succeeded + failed;

    // ------------------------------------------------------------------
    // 4. Determine final distribution status
    // ------------------------------------------------------------------
    const failureRate = processed > 0 ? failed / processed : 0;
    const finalStatus = failureRate > FAILURE_THRESHOLD ? 'failed' : 'completed';

    await query(
      `UPDATE payout_distributions
       SET status = $2, completed_at = NOW()
       WHERE id = $1`,
      [distributionId, finalStatus],
    );

    // Mark the financials record as redistributed
    if (distribution.financials_id) {
      await query(
        `UPDATE platform_financials
         SET redistributed = true
         WHERE id = $1`,
        [distribution.financials_id],
      );
    }

    // ------------------------------------------------------------------
    // 5. Emit socket event
    // ------------------------------------------------------------------
    const io = getIO();
    if (io) {
      io.emit('governance:redistribution_complete', {
        distributionId: distribution.id,
        periodStart: distribution.period_start,
        periodEnd: distribution.period_end,
        totalSurplus: parseFloat(distribution.total_surplus),
        status: finalStatus,
        processed,
        succeeded,
        failed,
      });
    }

    console.log(
      TAG,
      `Distribution ${distributionId} ${finalStatus}: ${succeeded} succeeded, ${failed} failed out of ${processed}`,
    );

    // Re-fetch to get the updated record
    const updatedDist = await query(
      `SELECT * FROM payout_distributions WHERE id = $1`,
      [distributionId],
    );

    return {
      distribution: updatedDist.rows[0],
      processed,
      succeeded,
      failed,
    };
  } catch (err) {
    // If an unexpected error occurs at the top level, mark the distribution
    // as failed so it can be retried after investigation.
    try {
      await query(
        `UPDATE payout_distributions
         SET status = 'failed'
         WHERE id = $1 AND status = 'processing'`,
        [distributionId],
      );
    } catch (updateErr) {
      console.error(TAG, 'Failed to mark distribution as failed:', updateErr.message);
    }

    console.error(TAG, 'executeDistribution error:', err.message);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// processPayoutItem  (internal)
// ---------------------------------------------------------------------------

/**
 * Process a single payout item — either via Stripe Transfer or account credit.
 *
 * @param {object} item          - Row from payout_items JOIN users
 * @param {number} quarter       - Calendar quarter (1–4)
 * @param {number} year          - Calendar year
 * @returns {Promise<{ success: boolean }>}
 */
async function processPayoutItem(item, quarter, year) {
  const amountCents = toCents(item.amount);

  // Guard: skip zero or negative amounts
  if (amountCents <= 0) {
    await query(
      `UPDATE payout_items
       SET status = 'completed', processed_at = NOW()
       WHERE id = $1`,
      [item.id],
    );
    return { success: true };
  }

  try {
    // Mark as processing
    await query(
      `UPDATE payout_items SET status = 'processing' WHERE id = $1`,
      [item.id],
    );

    // ----- Driver with Stripe Connect: create a Transfer -----
    if (item.user_type === 'driver' && item.stripe_connect_account_id) {
      const transfer = await stripe.transfers.create({
        amount: amountCents,
        currency: 'usd',
        destination: item.stripe_connect_account_id,
        description: `OpenRide surplus redistribution Q${quarter} ${year}`,
        metadata: {
          distributionId: item.distribution_id,
          payoutItemId: item.id,
          userId: item.user_id,
          userType: item.user_type,
        },
      });

      await query(
        `UPDATE payout_items
         SET status = 'completed',
             stripe_transfer_id = $2,
             processed_at = NOW()
         WHERE id = $1`,
        [item.id, transfer.id],
      );

      console.log(
        TAG,
        `Stripe transfer ${transfer.id} created for driver ${item.user_id}: $${item.amount}`,
      );
    } else {
      // ----- Passenger (or driver without Connect): account credit -----
      await query(
        `UPDATE users
         SET credit_balance = COALESCE(credit_balance, 0) + $2
         WHERE id = $1`,
        [item.user_id, item.amount],
      );

      await query(
        `UPDATE payout_items
         SET status = 'completed',
             processed_at = NOW()
         WHERE id = $1`,
        [item.id],
      );

      console.log(
        TAG,
        `Account credit of $${item.amount} applied for ${item.user_type} ${item.user_id}`,
      );
    }

    // Notify the user
    await notifyUser(item.user_id, 'payout:received', {
      amount: parseFloat(item.amount),
      userType: item.user_type,
      quarter,
      year,
      method:
        item.user_type === 'driver' && item.stripe_connect_account_id
          ? 'stripe_transfer'
          : 'account_credit',
      message:
        item.user_type === 'driver' && item.stripe_connect_account_id
          ? `You received a $${item.amount} surplus payout for Q${quarter} ${year} via Stripe.`
          : `You received a $${item.amount} surplus credit for Q${quarter} ${year}. It will be applied to your next ride.`,
    });

    return { success: true };
  } catch (err) {
    // ------- Handle failure gracefully -------
    const errorMessage =
      err.type && err.type.startsWith('Stripe')
        ? `Stripe error: ${err.message} (code: ${err.code || 'unknown'})`
        : err.message;

    console.error(
      TAG,
      `Failed to process payout item ${item.id} for user ${item.user_id}:`,
      errorMessage,
    );

    try {
      await query(
        `UPDATE payout_items
         SET status = 'failed',
             error_message = $2,
             processed_at = NOW()
         WHERE id = $1`,
        [item.id, errorMessage],
      );
    } catch (updateErr) {
      console.error(
        TAG,
        `Failed to update payout item ${item.id} to failed status:`,
        updateErr.message,
      );
    }

    // Notify user about the failure
    try {
      await notifyUser(item.user_id, 'payout:failed', {
        amount: parseFloat(item.amount),
        userType: item.user_type,
        quarter,
        year,
        message: `Your Q${quarter} ${year} surplus payout of $${item.amount} could not be processed. Our team has been notified and will retry.`,
      });
    } catch (notifyErr) {
      console.error(TAG, `Failed to notify user ${item.user_id} about payout failure:`, notifyErr.message);
    }

    return { success: false, error: errorMessage };
  }
}

// ---------------------------------------------------------------------------
// getDistributionHistory
// ---------------------------------------------------------------------------

/**
 * Retrieve a paginated list of past distributions, ordered most-recent first.
 *
 * @param {number} [page=1]  - Page number (1-based)
 * @param {number} [limit=10] - Items per page
 * @returns {Promise<{ distributions: object[], total: number }>}
 */
export async function getDistributionHistory(page = 1, limit = 10) {
  try {
    const pageNum  = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
    const offset   = (pageNum - 1) * limitNum;

    const countResult = await query(
      `SELECT COUNT(*)::int AS total FROM payout_distributions`,
    );
    const total = countResult.rows[0].total;

    const result = await query(
      `SELECT pd.*,
              (SELECT COUNT(*)::int FROM payout_items WHERE distribution_id = pd.id) AS total_items,
              (SELECT COUNT(*)::int FROM payout_items WHERE distribution_id = pd.id AND status = 'completed') AS completed_items,
              (SELECT COUNT(*)::int FROM payout_items WHERE distribution_id = pd.id AND status = 'failed') AS failed_items
       FROM payout_distributions pd
       ORDER BY pd.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limitNum, offset],
    );

    const distributions = result.rows.map((row) => ({
      id: row.id,
      periodStart: row.period_start,
      periodEnd: row.period_end,
      financialsId: row.financials_id,
      totalSurplus: parseFloat(row.total_surplus),
      driverPool: parseFloat(row.driver_pool),
      passengerPool: parseFloat(row.passenger_pool),
      status: row.status,
      approvedBy: row.approved_by,
      approvedAt: row.approved_at,
      completedAt: row.completed_at,
      createdAt: row.created_at,
      stats: {
        totalItems: row.total_items,
        completedItems: row.completed_items,
        failedItems: row.failed_items,
      },
    }));

    return { distributions, total };
  } catch (err) {
    console.error(TAG, 'getDistributionHistory error:', err.message);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// getUserPayouts
// ---------------------------------------------------------------------------

/**
 * Retrieve a paginated list of payout items for a specific user.
 *
 * @param {string} userId     - UUID of the user
 * @param {number} [page=1]   - Page number (1-based)
 * @param {number} [limit=10] - Items per page
 * @returns {Promise<{ payouts: object[], total: number }>}
 */
export async function getUserPayouts(userId, page = 1, limit = 10) {
  try {
    const pageNum  = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
    const offset   = (pageNum - 1) * limitNum;

    const countResult = await query(
      `SELECT COUNT(*)::int AS total
       FROM payout_items
       WHERE user_id = $1`,
      [userId],
    );
    const total = countResult.rows[0].total;

    const result = await query(
      `SELECT pi.*,
              pd.period_start,
              pd.period_end,
              pd.total_surplus,
              pd.status AS distribution_status
       FROM payout_items pi
       JOIN payout_distributions pd ON pd.id = pi.distribution_id
       WHERE pi.user_id = $1
       ORDER BY pi.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limitNum, offset],
    );

    const payouts = result.rows.map((row) => ({
      id: row.id,
      distributionId: row.distribution_id,
      userType: row.user_type,
      ridesInPeriod: row.rides_in_period,
      amount: parseFloat(row.amount),
      status: row.status,
      stripeTransferId: row.stripe_transfer_id,
      errorMessage: row.error_message,
      processedAt: row.processed_at,
      createdAt: row.created_at,
      period: {
        start: row.period_start,
        end: row.period_end,
        totalSurplus: parseFloat(row.total_surplus),
        distributionStatus: row.distribution_status,
      },
    }));

    return { payouts, total };
  } catch (err) {
    console.error(TAG, 'getUserPayouts error:', err.message);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// getDistributionDetails
// ---------------------------------------------------------------------------

/**
 * Retrieve full details for a single distribution, including all payout items
 * with user first names (for privacy) and summary statistics.
 *
 * @param {string} distributionId - UUID of the payout_distributions row
 * @returns {Promise<object|null>}
 */
export async function getDistributionDetails(distributionId) {
  try {
    // ------------------------------------------------------------------
    // 1. Fetch distribution
    // ------------------------------------------------------------------
    const distResult = await query(
      `SELECT pd.*,
              u.first_name AS approved_by_name
       FROM payout_distributions pd
       LEFT JOIN users u ON u.id = pd.approved_by
       WHERE pd.id = $1`,
      [distributionId],
    );

    if (distResult.rows.length === 0) {
      return null;
    }

    const row = distResult.rows[0];

    // ------------------------------------------------------------------
    // 2. Fetch all payout items with user first names
    // ------------------------------------------------------------------
    const itemsResult = await query(
      `SELECT pi.*,
              u.first_name
       FROM payout_items pi
       JOIN users u ON u.id = pi.user_id
       WHERE pi.distribution_id = $1
       ORDER BY pi.user_type ASC, pi.amount DESC`,
      [distributionId],
    );

    // ------------------------------------------------------------------
    // 3. Compute summary stats
    // ------------------------------------------------------------------
    const items = itemsResult.rows;
    const totalItems     = items.length;
    const completedItems = items.filter((i) => i.status === 'completed').length;
    const failedItems    = items.filter((i) => i.status === 'failed').length;
    const pendingItems   = items.filter((i) => i.status === 'pending').length;
    const processingItems = items.filter((i) => i.status === 'processing').length;

    const driverItems    = items.filter((i) => i.user_type === 'driver');
    const passengerItems = items.filter((i) => i.user_type === 'passenger');

    // ------------------------------------------------------------------
    // 4. Build response
    // ------------------------------------------------------------------
    return {
      id: row.id,
      periodStart: row.period_start,
      periodEnd: row.period_end,
      financialsId: row.financials_id,
      totalSurplus: parseFloat(row.total_surplus),
      driverPool: parseFloat(row.driver_pool),
      passengerPool: parseFloat(row.passenger_pool),
      status: row.status,
      approvedBy: row.approved_by,
      approvedByName: row.approved_by_name || null,
      approvedAt: row.approved_at,
      completedAt: row.completed_at,
      createdAt: row.created_at,
      summary: {
        totalItems,
        completedItems,
        failedItems,
        pendingItems,
        processingItems,
        driverCount: driverItems.length,
        passengerCount: passengerItems.length,
        totalDriverAmount: driverItems.reduce(
          (sum, i) => sum + parseFloat(i.amount), 0,
        ),
        totalPassengerAmount: passengerItems.reduce(
          (sum, i) => sum + parseFloat(i.amount), 0,
        ),
      },
      items: items.map((i) => ({
        id: i.id,
        userId: i.user_id,
        firstName: i.first_name,
        userType: i.user_type,
        ridesInPeriod: i.rides_in_period,
        amount: parseFloat(i.amount),
        status: i.status,
        stripeTransferId: i.stripe_transfer_id || null,
        errorMessage: i.error_message || null,
        processedAt: i.processed_at,
        createdAt: i.created_at,
      })),
    };
  } catch (err) {
    console.error(TAG, 'getDistributionDetails error:', err.message);
    throw err;
  }
}
