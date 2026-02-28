import { query } from '../config/database.js';

/**
 * Check if a user is eligible to participate in governance
 * Requires: verified account + 10 or more rides (as passenger or driver)
 */
export async function isEligibleVoter(userId) {
  const result = await query(
    `SELECT u.is_verified,
            (SELECT COUNT(*) FROM rides WHERE (passenger_id = u.id OR driver_id = u.id) AND status = 'completed') AS ride_count
     FROM users u WHERE u.id = $1`,
    [userId]
  );

  if (result.rows.length === 0) return { eligible: false, reason: 'User not found' };

  const { is_verified, ride_count } = result.rows[0];

  if (!is_verified) return { eligible: false, reason: 'Account not verified. Please verify your phone number.' };
  if (parseInt(ride_count) < 10) return { eligible: false, reason: `Need 10 completed rides to participate. You have ${ride_count}.` };

  return { eligible: true };
}

/**
 * Count eligible voters for quorum calculation
 */
export async function countEligibleVoters() {
  const result = await query(
    `SELECT COUNT(*) AS count FROM users u
     WHERE u.is_verified = true
     AND u.is_active = true
     AND (
       SELECT COUNT(*) FROM rides
       WHERE (passenger_id = u.id OR driver_id = u.id) AND status = 'completed'
     ) >= 10`
  );

  return parseInt(result.rows[0].count);
}

/**
 * Check and finalize proposals whose voting period has ended
 */
export async function finalizeExpiredProposals() {
  const expiredResult = await query(
    `SELECT * FROM governance_proposals
     WHERE status = 'active' AND voting_ends_at <= NOW()`
  );

  const results = [];

  for (const proposal of expiredResult.rows) {
    const totalVotes = proposal.votes_for + proposal.votes_against;
    const quorumMet = totalVotes >= proposal.quorum_needed;

    // Count abstentions separately
    const abstainResult = await query(
      `SELECT COUNT(*) AS count FROM votes
       WHERE proposal_id = $1 AND vote = 'abstain'`,
      [proposal.id]
    );
    const abstentions = parseInt(abstainResult.rows[0].count);

    let newStatus;
    if (!quorumMet) {
      newStatus = 'rejected'; // Failed to meet quorum
    } else if (proposal.votes_for > proposal.votes_against) {
      newStatus = 'passed';
    } else {
      newStatus = 'rejected';
    }

    await query(
      'UPDATE governance_proposals SET status = $1 WHERE id = $2',
      [newStatus, proposal.id]
    );

    results.push({
      proposalId: proposal.id,
      title: proposal.title,
      outcome: newStatus,
      votesFor: proposal.votes_for,
      votesAgainst: proposal.votes_against,
      abstentions,
      quorumNeeded: proposal.quorum_needed,
      quorumMet,
    });
  }

  return results;
}

/**
 * Calculate and distribute quarterly surplus
 */
export async function calculateSurplus(periodStart, periodEnd) {
  // Get total platform fees collected in period
  const feesResult = await query(
    `SELECT COALESCE(SUM(platform_fee), 0) AS total_fees,
            COUNT(*) AS total_rides,
            COALESCE(SUM(fare_amount), 0) AS total_fares
     FROM rides
     WHERE status = 'completed'
     AND dropoff_at >= $1 AND dropoff_at < $2`,
    [periodStart, periodEnd]
  );

  const { total_fees, total_rides, total_fares } = feesResult.rows[0];

  // Get the financials record for this period (must be created by admin with actual costs)
  const financialsResult = await query(
    `SELECT * FROM platform_financials
     WHERE period_start = $1 AND period_end = $2`,
    [periodStart, periodEnd]
  );

  if (financialsResult.rows.length === 0) {
    // Create a draft record
    await query(
      `INSERT INTO platform_financials (period_start, period_end, total_rides, total_fares, total_platform_fees)
       VALUES ($1, $2, $3, $4, $5)`,
      [periodStart, periodEnd, parseInt(total_rides), parseFloat(total_fares), parseFloat(total_fees)]
    );

    return {
      totalFees: parseFloat(total_fees),
      totalRides: parseInt(total_rides),
      totalFares: parseFloat(total_fares),
      surplus: null,
      message: 'Draft financials created. Admin must enter actual costs before surplus can be calculated.',
    };
  }

  const fin = financialsResult.rows[0];
  const operatingCosts =
    parseFloat(fin.server_costs || 0) +
    parseFloat(fin.payment_processing || 0) +
    parseFloat(fin.insurance_costs || 0) +
    parseFloat(fin.support_costs || 0);

  const surplus = parseFloat(total_fees) - operatingCosts;

  // Update the record
  await query(
    `UPDATE platform_financials
     SET total_rides = $1, total_fares = $2, total_platform_fees = $3, surplus = $4
     WHERE id = $5`,
    [parseInt(total_rides), parseFloat(total_fares), parseFloat(total_fees), surplus, fin.id]
  );

  return {
    totalFees: parseFloat(total_fees),
    operatingCosts,
    surplus: Math.max(0, surplus),
    totalRides: parseInt(total_rides),
    totalFares: parseFloat(total_fares),
    breakdown: {
      serverCosts: parseFloat(fin.server_costs || 0),
      paymentProcessing: parseFloat(fin.payment_processing || 0),
      insuranceCosts: parseFloat(fin.insurance_costs || 0),
      supportCosts: parseFloat(fin.support_costs || 0),
    },
  };
}

/**
 * Calculate redistribution amounts per driver and passenger
 * 70% of surplus to drivers (by rides completed), 30% to passengers (by rides taken)
 */
export async function calculateRedistribution(periodStart, periodEnd, surplusAmount) {
  if (surplusAmount <= 0) return { drivers: [], passengers: [] };

  const driverShare = surplusAmount * 0.7;
  const passengerShare = surplusAmount * 0.3;

  // Get driver ride counts in period
  const driversResult = await query(
    `SELECT driver_id, COUNT(*) AS rides
     FROM rides
     WHERE status = 'completed' AND dropoff_at >= $1 AND dropoff_at < $2
     GROUP BY driver_id`,
    [periodStart, periodEnd]
  );

  const totalDriverRides = driversResult.rows.reduce((sum, r) => sum + parseInt(r.rides), 0);

  const driverPayouts = driversResult.rows.map(r => ({
    userId: r.driver_id,
    rides: parseInt(r.rides),
    amount: Math.round((parseInt(r.rides) / totalDriverRides) * driverShare * 100) / 100,
  }));

  // Get passenger ride counts in period
  const passengersResult = await query(
    `SELECT passenger_id, COUNT(*) AS rides
     FROM rides
     WHERE status = 'completed' AND dropoff_at >= $1 AND dropoff_at < $2
     GROUP BY passenger_id`,
    [periodStart, periodEnd]
  );

  const totalPassengerRides = passengersResult.rows.reduce((sum, r) => sum + parseInt(r.rides), 0);

  const passengerPayouts = passengersResult.rows.map(r => ({
    userId: r.passenger_id,
    rides: parseInt(r.rides),
    amount: Math.round((parseInt(r.rides) / totalPassengerRides) * passengerShare * 100) / 100,
  }));

  return {
    driverTotal: driverShare,
    passengerTotal: passengerShare,
    drivers: driverPayouts,
    passengers: passengerPayouts,
  };
}
