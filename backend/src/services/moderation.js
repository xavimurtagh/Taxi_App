import pool, { query } from '../config/database.js';
import { notifyUser } from '../services/notifications.js';
import { getConfig } from '../services/platformConfig.js';

// ---------------------------------------------------------------------------
// Allowed moderation action types
// ---------------------------------------------------------------------------
const VALID_ACTION_TYPES = [
  'warn_user',
  'suspend_user',
  'unsuspend_user',
  'remove_review',
  'flag_proposal',
  'remove_proposal',
  'escalate_dispute',
];

// ---------------------------------------------------------------------------
// createElection
// ---------------------------------------------------------------------------

/**
 * Create a new moderator election.
 *
 * @param {Object} params
 * @param {string} params.title           - Election title
 * @param {string} params.description     - Election description
 * @param {number} params.seatsAvailable  - Number of moderator seats
 * @param {number} params.nominationDays  - Days the nomination phase lasts
 * @param {number} params.votingDays      - Days the voting phase lasts
 * @returns {Promise<Object>} The created election record
 */
export async function createElection({ title, description, seatsAvailable, nominationDays, votingDays }) {
  const result = await query(
    `INSERT INTO moderator_elections
       (title, description, seats_available, nominations_end, voting_ends, status)
     VALUES ($1, $2, $3, NOW() + ($4 || ' days')::INTERVAL, NOW() + ($4 || ' days')::INTERVAL + ($5 || ' days')::INTERVAL, 'nominations')
     RETURNING id, title, description, seats_available, nominations_end, voting_ends, status, created_at`,
    [title, description, seatsAvailable, String(nominationDays), String(votingDays)]
  );

  return result.rows[0];
}

// ---------------------------------------------------------------------------
// nominate
// ---------------------------------------------------------------------------

/**
 * Self-nominate a user as a candidate in a moderator election.
 *
 * Requirements:
 *   - Election must be in 'nominations' phase
 *   - User must be verified
 *   - User must have 20+ completed rides
 *   - User must not currently be a moderator
 *
 * @param {string} electionId - The election to nominate for
 * @param {string} userId     - The user nominating themselves
 * @param {string} statement  - Candidate statement / platform
 * @returns {Promise<Object>} The candidate record
 */
export async function nominate(electionId, userId, statement) {
  // 1. Verify election is in 'nominations' phase
  const electionResult = await query(
    'SELECT id, status, nominations_end FROM moderator_elections WHERE id = $1',
    [electionId]
  );

  if (electionResult.rows.length === 0) {
    throw Object.assign(new Error('Election not found'), { statusCode: 404 });
  }

  const election = electionResult.rows[0];

  if (election.status !== 'nominations') {
    throw Object.assign(
      new Error('Election is not in the nominations phase'),
      { statusCode: 400 }
    );
  }

  if (new Date(election.nominations_end) < new Date()) {
    throw Object.assign(
      new Error('The nominations period has ended'),
      { statusCode: 400 }
    );
  }

  // 2. Verify user eligibility: verified, 20+ rides, not currently a moderator
  const userResult = await query(
    `SELECT u.is_verified, u.is_moderator,
            (SELECT COUNT(*) FROM rides
             WHERE (passenger_id = u.id OR driver_id = u.id)
               AND status = 'completed') AS ride_count
     FROM users u
     WHERE u.id = $1`,
    [userId]
  );

  if (userResult.rows.length === 0) {
    throw Object.assign(new Error('User not found'), { statusCode: 404 });
  }

  const user = userResult.rows[0];

  if (!user.is_verified) {
    throw Object.assign(
      new Error('You must have a verified account to nominate yourself'),
      { statusCode: 403 }
    );
  }

  if (parseInt(user.ride_count, 10) < 20) {
    throw Object.assign(
      new Error(`You need at least 20 completed rides to nominate yourself. You have ${user.ride_count}.`),
      { statusCode: 403 }
    );
  }

  if (user.is_moderator) {
    throw Object.assign(
      new Error('Current moderators cannot nominate themselves'),
      { statusCode: 403 }
    );
  }

  // 3. Check for duplicate nomination
  const existingResult = await query(
    'SELECT id FROM moderator_candidates WHERE election_id = $1 AND user_id = $2',
    [electionId, userId]
  );

  if (existingResult.rows.length > 0) {
    throw Object.assign(
      new Error('You have already nominated yourself for this election'),
      { statusCode: 409 }
    );
  }

  // 4. Insert candidate record
  const candidateResult = await query(
    `INSERT INTO moderator_candidates (election_id, user_id, statement)
     VALUES ($1, $2, $3)
     RETURNING id, election_id, user_id, statement, votes_received, created_at`,
    [electionId, userId, statement]
  );

  return candidateResult.rows[0];
}

// ---------------------------------------------------------------------------
// voteForCandidate
// ---------------------------------------------------------------------------

/**
 * Cast a vote for a candidate in a moderator election.
 *
 * Requirements:
 *   - Election must be in 'voting' phase
 *   - Voter must be verified with 10+ completed rides
 *   - Voter must not have already voted in this election (UNIQUE constraint)
 *
 * @param {string} electionId  - The election
 * @param {string} voterId     - The user voting
 * @param {string} candidateId - The candidate being voted for
 * @returns {Promise<{voted: boolean}>}
 */
export async function voteForCandidate(electionId, voterId, candidateId) {
  // 1. Verify election is in 'voting' phase
  const electionResult = await query(
    'SELECT id, status, voting_ends FROM moderator_elections WHERE id = $1',
    [electionId]
  );

  if (electionResult.rows.length === 0) {
    throw Object.assign(new Error('Election not found'), { statusCode: 404 });
  }

  const election = electionResult.rows[0];

  if (election.status !== 'voting') {
    throw Object.assign(
      new Error('Election is not in the voting phase'),
      { statusCode: 400 }
    );
  }

  if (new Date(election.voting_ends) < new Date()) {
    throw Object.assign(
      new Error('The voting period has ended'),
      { statusCode: 400 }
    );
  }

  // 2. Verify voter eligibility: verified, 10+ rides
  const voterResult = await query(
    `SELECT u.is_verified,
            (SELECT COUNT(*) FROM rides
             WHERE (passenger_id = u.id OR driver_id = u.id)
               AND status = 'completed') AS ride_count
     FROM users u
     WHERE u.id = $1`,
    [voterId]
  );

  if (voterResult.rows.length === 0) {
    throw Object.assign(new Error('User not found'), { statusCode: 404 });
  }

  const voter = voterResult.rows[0];

  if (!voter.is_verified) {
    throw Object.assign(
      new Error('You must have a verified account to vote'),
      { statusCode: 403 }
    );
  }

  if (parseInt(voter.ride_count, 10) < 10) {
    throw Object.assign(
      new Error(`You need at least 10 completed rides to vote. You have ${voter.ride_count}.`),
      { statusCode: 403 }
    );
  }

  // 3. Verify the candidate belongs to this election
  const candidateResult = await query(
    'SELECT id FROM moderator_candidates WHERE id = $1 AND election_id = $2',
    [candidateId, electionId]
  );

  if (candidateResult.rows.length === 0) {
    throw Object.assign(
      new Error('Candidate not found in this election'),
      { statusCode: 404 }
    );
  }

  // 4. Check for duplicate vote (also protected by UNIQUE constraint)
  const existingVote = await query(
    'SELECT id FROM moderator_election_votes WHERE election_id = $1 AND voter_id = $2',
    [electionId, voterId]
  );

  if (existingVote.rows.length > 0) {
    throw Object.assign(
      new Error('You have already voted in this election'),
      { statusCode: 409 }
    );
  }

  // 5. Insert vote and increment candidate votes in a transaction
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      `INSERT INTO moderator_election_votes (election_id, voter_id, candidate_id)
       VALUES ($1, $2, $3)`,
      [electionId, voterId, candidateId]
    );

    await client.query(
      `UPDATE moderator_candidates
       SET votes_received = votes_received + 1
       WHERE id = $1`,
      [candidateId]
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    // Handle unique constraint violation as a duplicate vote
    if (err.code === '23505') {
      throw Object.assign(
        new Error('You have already voted in this election'),
        { statusCode: 409 }
      );
    }
    throw err;
  } finally {
    client.release();
  }

  return { voted: true };
}

// ---------------------------------------------------------------------------
// finalizeElection
// ---------------------------------------------------------------------------

/**
 * Finalize a moderator election after the voting period has ended.
 *
 * Selects the top N candidates (N = seats_available) by votes_received,
 * marks them as elected, creates moderator records with configurable term
 * lengths, updates user records, and notifies winners.
 *
 * @param {string} electionId - The election to finalize
 * @returns {Promise<{election: Object, winners: Array}>}
 */
export async function finalizeElection(electionId) {
  // 1. Verify the election exists and voting has ended
  const electionResult = await query(
    'SELECT * FROM moderator_elections WHERE id = $1',
    [electionId]
  );

  if (electionResult.rows.length === 0) {
    throw Object.assign(new Error('Election not found'), { statusCode: 404 });
  }

  const election = electionResult.rows[0];

  if (election.status === 'completed') {
    throw Object.assign(
      new Error('This election has already been finalized'),
      { statusCode: 400 }
    );
  }

  if (new Date(election.voting_ends) > new Date()) {
    throw Object.assign(
      new Error('The voting period has not ended yet'),
      { statusCode: 400 }
    );
  }

  // 2. Get top N candidates by votes_received
  const seatsAvailable = election.seats_available;

  const candidatesResult = await query(
    `SELECT mc.id, mc.user_id, mc.statement, mc.votes_received,
            u.first_name, u.last_name, u.email
     FROM moderator_candidates mc
     JOIN users u ON u.id = mc.user_id
     WHERE mc.election_id = $1
     ORDER BY mc.votes_received DESC, mc.created_at ASC
     LIMIT $2`,
    [electionId, seatsAvailable]
  );

  const winners = candidatesResult.rows;

  // 3. Get moderator term length from platform config (default 6 months)
  let termMonths = await getConfig('moderator_term_months');
  if (termMonths === null || termMonths === undefined) {
    termMonths = 6;
  }

  // 4. Execute all updates within a transaction
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Mark winning candidates as elected
    for (const winner of winners) {
      await client.query(
        'UPDATE moderator_candidates SET elected = true WHERE id = $1',
        [winner.id]
      );

      // Insert into moderators table
      await client.query(
        `INSERT INTO moderators (user_id, election_id, term_start, term_end, is_active)
         VALUES ($1, $2, NOW(), NOW() + ($3 || ' months')::INTERVAL, true)`,
        [winner.user_id, electionId, String(termMonths)]
      );

      // Set is_moderator flag on user record
      await client.query(
        'UPDATE users SET is_moderator = true WHERE id = $1',
        [winner.user_id]
      );
    }

    // Update election status to 'completed'
    await client.query(
      "UPDATE moderator_elections SET status = 'completed' WHERE id = $1",
      [electionId]
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  // 5. Notify winners (outside transaction so notification failures don't roll back)
  for (const winner of winners) {
    try {
      await notifyUser(winner.user_id, 'moderation:elected', {
        electionId,
        electionTitle: election.title,
        message: `Congratulations! You have been elected as a community moderator in "${election.title}". Your term begins now and lasts ${termMonths} months.`,
      });
    } catch (err) {
      console.error(`[moderation] Failed to notify winner ${winner.user_id}:`, err.message);
    }
  }

  // 6. Fetch the updated election record
  const updatedElection = await query(
    'SELECT * FROM moderator_elections WHERE id = $1',
    [electionId]
  );

  return {
    election: updatedElection.rows[0],
    winners: winners.map((w) => ({
      candidateId: w.id,
      userId: w.user_id,
      name: `${w.first_name} ${w.last_name}`,
      votesReceived: w.votes_received,
      statement: w.statement,
    })),
  };
}

// ---------------------------------------------------------------------------
// getActiveElection
// ---------------------------------------------------------------------------

/**
 * Get the current active election (in nominations or voting phase), if any.
 *
 * @returns {Promise<Object|null>} The active election or null
 */
export async function getActiveElection() {
  const result = await query(
    `SELECT id, title, description, seats_available, nominations_end,
            voting_ends, status, created_at
     FROM moderator_elections
     WHERE status IN ('nominations', 'voting')
     ORDER BY created_at DESC
     LIMIT 1`
  );

  return result.rows.length > 0 ? result.rows[0] : null;
}

// ---------------------------------------------------------------------------
// getActiveModerators
// ---------------------------------------------------------------------------

/**
 * Get all currently active moderators whose terms have not expired.
 *
 * @returns {Promise<Array>} Array of moderator objects with user details
 */
export async function getActiveModerators() {
  const result = await query(
    `SELECT m.id AS moderator_id, m.user_id, m.election_id,
            m.term_start, m.term_end, m.is_active,
            u.first_name, u.last_name, u.email,
            u.rating_avg, u.rating_count
     FROM moderators m
     JOIN users u ON u.id = m.user_id
     WHERE m.is_active = true AND m.term_end > NOW()
     ORDER BY m.term_start ASC`
  );

  return result.rows.map((row) => ({
    moderatorId: row.moderator_id,
    userId: row.user_id,
    electionId: row.election_id,
    termStart: row.term_start,
    termEnd: row.term_end,
    name: `${row.first_name} ${row.last_name}`,
    rating: row.rating_avg,
    ratingCount: row.rating_count,
  }));
}

// ---------------------------------------------------------------------------
// expireModeratorTerms
// ---------------------------------------------------------------------------

/**
 * Find moderators whose terms have expired and deactivate them.
 * Sets is_active = false on the moderator record and is_moderator = false
 * on the user record.
 *
 * @returns {Promise<number>} The number of expired terms processed
 */
export async function expireModeratorTerms() {
  // Find moderators whose term has ended but are still marked active
  const expiredResult = await query(
    `SELECT m.id, m.user_id
     FROM moderators m
     WHERE m.term_end <= NOW() AND m.is_active = true`
  );

  if (expiredResult.rows.length === 0) {
    return 0;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const mod of expiredResult.rows) {
      // Deactivate the moderator record
      await client.query(
        'UPDATE moderators SET is_active = false WHERE id = $1',
        [mod.id]
      );

      // Only clear is_moderator if the user has no other active moderator terms
      const otherActiveResult = await client.query(
        `SELECT id FROM moderators
         WHERE user_id = $1 AND is_active = true AND id != $2 AND term_end > NOW()`,
        [mod.user_id, mod.id]
      );

      if (otherActiveResult.rows.length === 0) {
        await client.query(
          'UPDATE users SET is_moderator = false WHERE id = $1',
          [mod.user_id]
        );
      }
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  return expiredResult.rows.length;
}

// ---------------------------------------------------------------------------
// performModAction
// ---------------------------------------------------------------------------

/**
 * Perform a moderation action.
 *
 * Supported action types:
 *   - warn_user:        Send the user a warning notification
 *   - suspend_user:     Suspend the user for durationHours
 *   - unsuspend_user:   Lift a user's suspension
 *   - remove_review:    Soft-delete a rating (set is_hidden = true)
 *   - flag_proposal:    Flag a governance proposal with a moderator note
 *   - remove_proposal:  Reject a governance proposal with a reason
 *   - escalate_dispute: Mark a support ticket/dispute for admin review
 *
 * @param {Object} params
 * @param {string} params.moderatorId       - ID of the acting moderator
 * @param {string} [params.targetUserId]    - Target user (for user actions)
 * @param {string} [params.targetProposalId]- Target proposal (for proposal actions)
 * @param {string} params.actionType        - One of VALID_ACTION_TYPES
 * @param {string} params.reason            - Reason for the action
 * @param {number} [params.durationHours]   - Duration for time-limited actions
 * @returns {Promise<Object>} The moderation action record
 */
export async function performModAction({ moderatorId, targetUserId, targetProposalId, actionType, reason, durationHours }) {
  // 1. Validate action type
  if (!VALID_ACTION_TYPES.includes(actionType)) {
    throw Object.assign(
      new Error(`Invalid action type: ${actionType}. Must be one of: ${VALID_ACTION_TYPES.join(', ')}`),
      { statusCode: 400 }
    );
  }

  // 2. Verify the moderator is active
  const modResult = await query(
    `SELECT m.id FROM moderators m
     WHERE m.user_id = $1 AND m.is_active = true AND m.term_end > NOW()`,
    [moderatorId]
  );

  if (modResult.rows.length === 0) {
    throw Object.assign(
      new Error('You are not an active moderator'),
      { statusCode: 403 }
    );
  }

  // 3. Insert the moderation action record
  const actionResult = await query(
    `INSERT INTO moderation_actions
       (moderator_id, target_user_id, target_proposal_id, action_type, reason, duration_hours)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, moderator_id, target_user_id, target_proposal_id, action_type,
               reason, duration_hours, reversed, created_at`,
    [moderatorId, targetUserId || null, targetProposalId || null, actionType, reason, durationHours || null]
  );

  const action = actionResult.rows[0];

  // 4. Execute the specific action
  switch (actionType) {
    case 'warn_user': {
      if (!targetUserId) {
        throw Object.assign(new Error('targetUserId is required for warn_user'), { statusCode: 400 });
      }
      await notifyUser(targetUserId, 'moderation:warning', {
        actionId: action.id,
        reason,
        message: `You have received a warning from a community moderator: ${reason}`,
      });
      break;
    }

    case 'suspend_user': {
      if (!targetUserId) {
        throw Object.assign(new Error('targetUserId is required for suspend_user'), { statusCode: 400 });
      }
      if (!durationHours || durationHours <= 0) {
        throw Object.assign(new Error('durationHours is required and must be positive for suspend_user'), { statusCode: 400 });
      }
      await query(
        `UPDATE users
         SET suspended_until = NOW() + ($1 || ' hours')::INTERVAL,
             suspension_reason = $2
         WHERE id = $3`,
        [String(durationHours), reason, targetUserId]
      );
      await notifyUser(targetUserId, 'moderation:suspended', {
        actionId: action.id,
        reason,
        durationHours,
        message: `Your account has been suspended for ${durationHours} hours. Reason: ${reason}`,
      });
      break;
    }

    case 'unsuspend_user': {
      if (!targetUserId) {
        throw Object.assign(new Error('targetUserId is required for unsuspend_user'), { statusCode: 400 });
      }
      await query(
        `UPDATE users
         SET suspended_until = NULL,
             suspension_reason = NULL
         WHERE id = $1`,
        [targetUserId]
      );
      await notifyUser(targetUserId, 'moderation:unsuspended', {
        actionId: action.id,
        message: 'Your account suspension has been lifted.',
      });
      break;
    }

    case 'remove_review': {
      if (!targetUserId) {
        throw Object.assign(new Error('targetUserId is required for remove_review (as the rating id)'), { statusCode: 400 });
      }
      // targetUserId is used here to pass the rating ID; soft-delete by setting is_hidden = true
      await query(
        'UPDATE ratings SET is_hidden = true WHERE id = $1',
        [targetUserId]
      );
      break;
    }

    case 'flag_proposal': {
      if (!targetProposalId) {
        throw Object.assign(new Error('targetProposalId is required for flag_proposal'), { statusCode: 400 });
      }
      await query(
        `UPDATE governance_proposals
         SET description = description || E'\n\n[MODERATOR FLAG]: ' || $1
         WHERE id = $2`,
        [reason, targetProposalId]
      );
      break;
    }

    case 'remove_proposal': {
      if (!targetProposalId) {
        throw Object.assign(new Error('targetProposalId is required for remove_proposal'), { statusCode: 400 });
      }
      await query(
        `UPDATE governance_proposals
         SET status = 'rejected'
         WHERE id = $1`,
        [targetProposalId]
      );
      break;
    }

    case 'escalate_dispute': {
      if (!targetUserId) {
        throw Object.assign(new Error('targetUserId is required for escalate_dispute (as ticket id)'), { statusCode: 400 });
      }
      await query(
        `UPDATE support_tickets
         SET status = 'escalated'
         WHERE id = $1`,
        [targetUserId]
      );
      break;
    }

    default:
      break;
  }

  return action;
}

// ---------------------------------------------------------------------------
// reverseAction
// ---------------------------------------------------------------------------

/**
 * Reverse a previously performed moderation action.
 *
 * Undoes the effect of the action (e.g., unsuspends a suspended user)
 * and marks the action record as reversed.
 *
 * @param {string} actionId               - The action to reverse
 * @param {string} reversedByModeratorId  - The moderator performing the reversal
 * @returns {Promise<Object>} The updated action record
 */
export async function reverseAction(actionId, reversedByModeratorId) {
  // 1. Get the action
  const actionResult = await query(
    'SELECT * FROM moderation_actions WHERE id = $1',
    [actionId]
  );

  if (actionResult.rows.length === 0) {
    throw Object.assign(new Error('Moderation action not found'), { statusCode: 404 });
  }

  const action = actionResult.rows[0];

  if (action.reversed) {
    throw Object.assign(
      new Error('This action has already been reversed'),
      { statusCode: 400 }
    );
  }

  // 2. Verify the reverser is an active moderator
  const modResult = await query(
    `SELECT m.id FROM moderators m
     WHERE m.user_id = $1 AND m.is_active = true AND m.term_end > NOW()`,
    [reversedByModeratorId]
  );

  if (modResult.rows.length === 0) {
    throw Object.assign(
      new Error('You are not an active moderator'),
      { statusCode: 403 }
    );
  }

  // 3. Undo the action based on type
  switch (action.action_type) {
    case 'suspend_user': {
      if (action.target_user_id) {
        await query(
          `UPDATE users
           SET suspended_until = NULL, suspension_reason = NULL
           WHERE id = $1`,
          [action.target_user_id]
        );
        await notifyUser(action.target_user_id, 'moderation:unsuspended', {
          actionId: action.id,
          message: 'Your account suspension has been reversed by a moderator.',
        });
      }
      break;
    }

    case 'remove_review': {
      if (action.target_user_id) {
        await query(
          'UPDATE ratings SET is_hidden = false WHERE id = $1',
          [action.target_user_id]
        );
      }
      break;
    }

    case 'remove_proposal': {
      if (action.target_proposal_id) {
        await query(
          "UPDATE governance_proposals SET status = 'active' WHERE id = $1",
          [action.target_proposal_id]
        );
      }
      break;
    }

    case 'escalate_dispute': {
      if (action.target_user_id) {
        await query(
          "UPDATE support_tickets SET status = 'open' WHERE id = $1",
          [action.target_user_id]
        );
      }
      break;
    }

    // warn_user, unsuspend_user, flag_proposal: no reversible side-effects
    // (warnings are informational; unsuspend is already an undo; flag text is appended)
    default:
      break;
  }

  // 4. Mark the action as reversed
  const updatedResult = await query(
    `UPDATE moderation_actions
     SET reversed = true, reversed_at = NOW(), reversed_by = $1
     WHERE id = $2
     RETURNING id, moderator_id, target_user_id, target_proposal_id, action_type,
               reason, duration_hours, reversed, reversed_at, reversed_by, created_at`,
    [reversedByModeratorId, actionId]
  );

  return updatedResult.rows[0];
}

// ---------------------------------------------------------------------------
// getModeratorActions
// ---------------------------------------------------------------------------

/**
 * Get moderation action history, optionally filtered by moderator.
 *
 * @param {string|null} [moderatorId=null] - Filter by moderator user ID
 * @param {number}      [page=1]           - Page number
 * @param {number}      [limit=20]         - Results per page
 * @returns {Promise<{actions: Array, total: number}>}
 */
export async function getModeratorActions(moderatorId = null, page = 1, limit = 20) {
  const conditions = [];
  const params = [];
  let paramIdx = 1;

  if (moderatorId) {
    conditions.push(`ma.moderator_id = $${paramIdx++}`);
    params.push(moderatorId);
  }

  const whereClause = conditions.length > 0
    ? `WHERE ${conditions.join(' AND ')}`
    : '';

  // Total count
  const countResult = await query(
    `SELECT COUNT(*) AS total FROM moderation_actions ma ${whereClause}`,
    params
  );
  const total = parseInt(countResult.rows[0].total, 10);

  // Paginated results with moderator and target user names
  const offset = (page - 1) * limit;
  const actionsResult = await query(
    `SELECT ma.id, ma.moderator_id, ma.target_user_id, ma.target_proposal_id,
            ma.action_type, ma.reason, ma.duration_hours,
            ma.reversed, ma.reversed_at, ma.reversed_by, ma.created_at,
            mod_user.first_name AS mod_first_name,
            mod_user.last_name AS mod_last_name,
            target_user.first_name AS target_first_name,
            target_user.last_name AS target_last_name
     FROM moderation_actions ma
     JOIN users mod_user ON mod_user.id = ma.moderator_id
     LEFT JOIN users target_user ON target_user.id = ma.target_user_id
     ${whereClause}
     ORDER BY ma.created_at DESC
     LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
    [...params, limit, offset]
  );

  const actions = actionsResult.rows.map((row) => ({
    id: row.id,
    moderatorId: row.moderator_id,
    moderatorName: `${row.mod_first_name} ${row.mod_last_name}`,
    targetUserId: row.target_user_id,
    targetUserName: row.target_first_name
      ? `${row.target_first_name} ${row.target_last_name}`
      : null,
    targetProposalId: row.target_proposal_id,
    actionType: row.action_type,
    reason: row.reason,
    durationHours: row.duration_hours,
    reversed: row.reversed,
    reversedAt: row.reversed_at,
    reversedBy: row.reversed_by,
    createdAt: row.created_at,
  }));

  return { actions, total };
}
