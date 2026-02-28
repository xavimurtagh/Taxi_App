import { Router } from 'express';
import { query } from '../config/database.js';
import { optionalAuth } from '../middleware/auth.js';
import env from '../config/env.js';

const router = Router();

// ---------------------------------------------------------------------------
// GET /financials — Platform financial records
// ---------------------------------------------------------------------------
router.get('/financials', optionalAuth, async (req, res) => {
  try {
    const { period } = req.query;

    let dateFilter = '';
    const params = [];

    if (period === 'current_quarter') {
      // Current quarter: from the start of the current quarter to now
      dateFilter = `WHERE pf.period_start >= DATE_TRUNC('quarter', NOW())`;
    } else if (period === 'last_quarter') {
      // Last quarter
      dateFilter = `WHERE pf.period_start >= DATE_TRUNC('quarter', NOW() - INTERVAL '3 months')
                    AND pf.period_end < DATE_TRUNC('quarter', NOW())`;
    } else if (period === 'year') {
      // Current year
      dateFilter = `WHERE pf.period_start >= DATE_TRUNC('year', NOW())`;
    }
    // If period is 'all' or not specified, return everything (no filter)

    const result = await query(
      `SELECT pf.id, pf.period_start, pf.period_end, pf.total_rides,
              pf.total_fares, pf.total_platform_fees, pf.server_costs,
              pf.payment_processing, pf.insurance_costs, pf.support_costs,
              pf.surplus, pf.redistributed, pf.created_at
       FROM platform_financials pf
       ${dateFilter}
       ORDER BY pf.period_start DESC`,
      params,
    );

    const financials = result.rows.map((row) => ({
      id: row.id,
      periodStart: row.period_start,
      periodEnd: row.period_end,
      totalRides: row.total_rides,
      totalFares: parseFloat(row.total_fares),
      totalPlatformFees: parseFloat(row.total_platform_fees),
      serverCosts: parseFloat(row.server_costs),
      paymentProcessing: parseFloat(row.payment_processing),
      insuranceCosts: parseFloat(row.insurance_costs),
      supportCosts: parseFloat(row.support_costs),
      surplus: parseFloat(row.surplus),
      redistributed: row.redistributed,
      createdAt: row.created_at,
    }));

    return res.status(200).json({ financials });
  } catch (err) {
    console.error('[transparency] GET /financials error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred while fetching financial data',
    });
  }
});

// ---------------------------------------------------------------------------
// GET /summary — Current platform summary
// ---------------------------------------------------------------------------
router.get('/summary', optionalAuth, async (req, res) => {
  try {
    // Total rides (completed)
    const totalRidesResult = await query(
      `SELECT COUNT(*) AS total FROM rides WHERE status = 'completed'`,
    );
    const totalRides = parseInt(totalRidesResult.rows[0].total, 10);

    // Total active drivers (is_online = true)
    const activeDriversResult = await query(
      `SELECT COUNT(*) AS total FROM driver_profiles WHERE is_online = true`,
    );
    const totalActiveDrivers = parseInt(activeDriversResult.rows[0].total, 10);

    // Total users
    const totalUsersResult = await query(
      `SELECT COUNT(*) AS total FROM users`,
    );
    const totalUsers = parseInt(totalUsersResult.rows[0].total, 10);

    // Average fare (from completed rides)
    const avgFareResult = await query(
      `SELECT COALESCE(AVG(fare_amount), 0) AS avg_fare
       FROM rides
       WHERE status = 'completed'`,
    );
    const averageFare = parseFloat(parseFloat(avgFareResult.rows[0].avg_fare).toFixed(2));

    // Average driver rating
    const avgDriverRatingResult = await query(
      `SELECT COALESCE(AVG(u.rating_avg), 0) AS avg_rating
       FROM users u
       WHERE u.role IN ('driver', 'both')
         AND u.rating_count > 0`,
    );
    const averageDriverRating = parseFloat(
      parseFloat(avgDriverRatingResult.rows[0].avg_rating).toFixed(2),
    );

    // Platform fee percentage (from env config)
    const platformFeePercent = env.PLATFORM_FEE_PERCENT;

    // Current quarter financials (if available)
    const quarterFinancialsResult = await query(
      `SELECT id, period_start, period_end, total_rides, total_fares,
              total_platform_fees, server_costs, payment_processing,
              insurance_costs, support_costs, surplus, redistributed
       FROM platform_financials
       WHERE period_start >= DATE_TRUNC('quarter', NOW())
       ORDER BY period_start DESC
       LIMIT 1`,
    );

    const currentQuarterFinancials = quarterFinancialsResult.rows.length > 0
      ? {
          periodStart: quarterFinancialsResult.rows[0].period_start,
          periodEnd: quarterFinancialsResult.rows[0].period_end,
          totalRides: quarterFinancialsResult.rows[0].total_rides,
          totalFares: parseFloat(quarterFinancialsResult.rows[0].total_fares),
          totalPlatformFees: parseFloat(quarterFinancialsResult.rows[0].total_platform_fees),
          surplus: parseFloat(quarterFinancialsResult.rows[0].surplus),
          redistributed: quarterFinancialsResult.rows[0].redistributed,
        }
      : null;

    return res.status(200).json({
      summary: {
        totalRides,
        totalActiveDrivers,
        totalUsers,
        averageFare,
        averageDriverRating,
        platformFeePercent,
        currentQuarterFinancials,
      },
    });
  } catch (err) {
    console.error('[transparency] GET /summary error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred while fetching the platform summary',
    });
  }
});

// ---------------------------------------------------------------------------
// GET /driver-stats — Anonymized driver earnings statistics
// ---------------------------------------------------------------------------
router.get('/driver-stats', optionalAuth, async (req, res) => {
  try {
    // Average earnings per ride for drivers
    const avgEarningsResult = await query(
      `SELECT COALESCE(AVG(driver_payout), 0) AS avg_earnings
       FROM rides
       WHERE status = 'completed' AND driver_payout IS NOT NULL`,
    );
    const averageEarningsPerRide = parseFloat(
      parseFloat(avgEarningsResult.rows[0].avg_earnings).toFixed(2),
    );

    // Median earnings per ride (using PERCENTILE_CONT)
    const medianResult = await query(
      `SELECT COALESCE(
         PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY driver_payout), 0
       ) AS median_earnings
       FROM rides
       WHERE status = 'completed' AND driver_payout IS NOT NULL`,
    );
    const medianEarningsPerRide = parseFloat(
      parseFloat(medianResult.rows[0].median_earnings).toFixed(2),
    );

    // Total paid to drivers all time
    const totalPaidResult = await query(
      `SELECT COALESCE(SUM(driver_payout), 0) AS total_paid
       FROM rides
       WHERE status = 'completed' AND driver_payout IS NOT NULL`,
    );
    const totalPaidToDrivers = parseFloat(
      parseFloat(totalPaidResult.rows[0].total_paid).toFixed(2),
    );

    // Average driver rating
    const avgRatingResult = await query(
      `SELECT COALESCE(AVG(u.rating_avg), 0) AS avg_rating
       FROM users u
       WHERE u.role IN ('driver', 'both')
         AND u.rating_count > 0`,
    );
    const averageDriverRating = parseFloat(
      parseFloat(avgRatingResult.rows[0].avg_rating).toFixed(2),
    );

    return res.status(200).json({
      driverStats: {
        medianEarningsPerRide,
        averageEarningsPerRide,
        totalPaidToDrivers,
        averageDriverRating,
      },
    });
  } catch (err) {
    console.error('[transparency] GET /driver-stats error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred while fetching driver statistics',
    });
  }
});

// ---------------------------------------------------------------------------
// GET /governance-stats — Governance participation statistics
// ---------------------------------------------------------------------------
router.get('/governance-stats', optionalAuth, async (req, res) => {
  try {
    // Total proposals
    const totalProposalsResult = await query(
      `SELECT COUNT(*) AS total FROM governance_proposals`,
    );
    const totalProposals = parseInt(totalProposalsResult.rows[0].total, 10);

    // Passed proposals
    const passedResult = await query(
      `SELECT COUNT(*) AS total FROM governance_proposals WHERE status = 'passed'`,
    );
    const passedProposals = parseInt(passedResult.rows[0].total, 10);

    // Active proposals
    const activeResult = await query(
      `SELECT COUNT(*) AS total FROM governance_proposals WHERE status = 'active'`,
    );
    const activeProposals = parseInt(activeResult.rows[0].total, 10);

    // Total votes cast
    const totalVotesResult = await query(
      `SELECT COUNT(*) AS total FROM votes`,
    );
    const totalVotesCast = parseInt(totalVotesResult.rows[0].total, 10);

    // Participation rate: unique voters / eligible users
    const uniqueVotersResult = await query(
      `SELECT COUNT(DISTINCT user_id) AS total FROM votes`,
    );
    const uniqueVoters = parseInt(uniqueVotersResult.rows[0].total, 10);

    const totalUsersResult = await query(
      `SELECT COUNT(*) AS total FROM users WHERE is_verified = true`,
    );
    const totalVerifiedUsers = parseInt(totalUsersResult.rows[0].total, 10);

    const participationRate = totalVerifiedUsers > 0
      ? parseFloat(((uniqueVoters / totalVerifiedUsers) * 100).toFixed(1))
      : 0;

    return res.status(200).json({
      governanceStats: {
        totalProposals,
        passedProposals,
        activeProposals,
        totalVotesCast,
        uniqueVoters,
        participationRate,
      },
    });
  } catch (err) {
    console.error('[transparency] GET /governance-stats error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred while fetching governance statistics',
    });
  }
});

export default router;
