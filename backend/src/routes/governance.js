import { Router } from 'express';
import { query } from '../config/database.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import { proposalSchema, voteSchema } from '../utils/validators.js';

const router = Router();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Minimum number of completed rides (as passenger or driver) required
 * for a user to be eligible to create proposals or vote.
 */
const ELIGIBILITY_THRESHOLD = 10;

/**
 * Check whether a user is eligible to participate in governance.
 * Eligible = is_verified AND has at least ELIGIBILITY_THRESHOLD completed rides
 * (as passenger or driver).
 *
 * @param {string} userId
 * @returns {Promise<boolean>}
 */
async function isEligible(userId) {
  const result = await query(
    `SELECT u.is_verified,
            (
              SELECT COUNT(*)
              FROM rides
              WHERE (passenger_id = u.id OR driver_id = u.id)
                AND status = 'completed'
            ) AS ride_count
     FROM users u
     WHERE u.id = $1`,
    [userId],
  );

  if (result.rows.length === 0) return false;

  const { is_verified, ride_count } = result.rows[0];
  return is_verified && parseInt(ride_count, 10) >= ELIGIBILITY_THRESHOLD;
}

/**
 * Count the number of eligible voters on the platform.
 * Eligible = is_verified AND has at least ELIGIBILITY_THRESHOLD completed rides.
 *
 * @returns {Promise<number>}
 */
async function countEligibleVoters() {
  const result = await query(
    `SELECT COUNT(*) AS total
     FROM users u
     WHERE u.is_verified = true
       AND (
         SELECT COUNT(*)
         FROM rides
         WHERE (passenger_id = u.id OR driver_id = u.id)
           AND status = 'completed'
       ) >= $1`,
    [ELIGIBILITY_THRESHOLD],
  );
  return parseInt(result.rows[0].total, 10);
}

// ---------------------------------------------------------------------------
// GET /proposals — List governance proposals
// ---------------------------------------------------------------------------
router.get('/proposals', authenticate, async (req, res) => {
  try {
    const { status } = req.query;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;

    // Build WHERE clause
    const conditions = [];
    const params = [];
    let paramIdx = 1;

    if (status && ['active', 'passed', 'rejected', 'implemented'].includes(status)) {
      conditions.push(`gp.status = $${paramIdx++}`);
      params.push(status);
    }

    const whereClause = conditions.length > 0
      ? `WHERE ${conditions.join(' AND ')}`
      : '';

    // Total count
    const countResult = await query(
      `SELECT COUNT(*) AS total
       FROM governance_proposals gp
       ${whereClause}`,
      params,
    );
    const total = parseInt(countResult.rows[0].total, 10);

    // Proposals with author name
    const proposalsResult = await query(
      `SELECT gp.id, gp.title, gp.description, gp.category, gp.status,
              gp.votes_for, gp.votes_against, gp.quorum_needed,
              gp.voting_ends_at, gp.created_at,
              u.first_name AS author_first_name,
              u.last_name AS author_last_name,
              u.id AS author_id
       FROM governance_proposals gp
       JOIN users u ON u.id = gp.author_id
       ${whereClause}
       ORDER BY gp.created_at DESC
       LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
      [...params, limit, offset],
    );

    const proposals = proposalsResult.rows.map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      category: row.category,
      status: row.status,
      votesFor: row.votes_for,
      votesAgainst: row.votes_against,
      quorumNeeded: row.quorum_needed,
      votingEndsAt: row.voting_ends_at,
      createdAt: row.created_at,
      author: {
        id: row.author_id,
        name: `${row.author_first_name} ${row.author_last_name}`,
      },
    }));

    return res.status(200).json({ proposals, total, page, limit });
  } catch (err) {
    console.error('[governance] GET /proposals error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred while fetching proposals',
    });
  }
});

// ---------------------------------------------------------------------------
// GET /proposals/:id — Get a single proposal with details
// ---------------------------------------------------------------------------
router.get('/proposals/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const proposalResult = await query(
      `SELECT gp.id, gp.title, gp.description, gp.category, gp.status,
              gp.votes_for, gp.votes_against, gp.quorum_needed,
              gp.voting_ends_at, gp.created_at,
              u.id AS author_id,
              u.first_name AS author_first_name,
              u.last_name AS author_last_name,
              u.avatar_url AS author_avatar
       FROM governance_proposals gp
       JOIN users u ON u.id = gp.author_id
       WHERE gp.id = $1`,
      [id],
    );

    if (proposalResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Proposal not found',
      });
    }

    const row = proposalResult.rows[0];

    // Check if the current user has voted on this proposal
    const voteResult = await query(
      `SELECT id, vote, created_at FROM votes
       WHERE proposal_id = $1 AND user_id = $2`,
      [id, userId],
    );

    const userVote = voteResult.rows.length > 0
      ? {
          id: voteResult.rows[0].id,
          vote: voteResult.rows[0].vote,
          createdAt: voteResult.rows[0].created_at,
        }
      : null;

    const proposal = {
      id: row.id,
      title: row.title,
      description: row.description,
      category: row.category,
      status: row.status,
      votesFor: row.votes_for,
      votesAgainst: row.votes_against,
      quorumNeeded: row.quorum_needed,
      votingEndsAt: row.voting_ends_at,
      createdAt: row.created_at,
      author: {
        id: row.author_id,
        name: `${row.author_first_name} ${row.author_last_name}`,
        avatarUrl: row.author_avatar,
      },
    };

    return res.status(200).json({ proposal, userVote });
  } catch (err) {
    console.error('[governance] GET /proposals/:id error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred while fetching the proposal',
    });
  }
});

// ---------------------------------------------------------------------------
// POST /proposals — Create a new governance proposal
// ---------------------------------------------------------------------------
router.post('/proposals', authenticate, validate(proposalSchema), async (req, res) => {
  try {
    const userId = req.user.id;
    const { title, description, category } = req.body;

    // Verify the user is eligible (verified + 10+ rides)
    const eligible = await isEligible(userId);
    if (!eligible) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You must be verified and have at least 10 completed rides to create proposals',
      });
    }

    // Calculate quorum: 10% of eligible voters (minimum 1)
    const eligibleVoters = await countEligibleVoters();
    const quorumNeeded = Math.max(1, Math.ceil(eligibleVoters * 0.1));

    // Voting period: 7 days from now
    const votingEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const result = await query(
      `INSERT INTO governance_proposals
         (author_id, title, description, category, quorum_needed, voting_ends_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, author_id, title, description, category, status,
                 votes_for, votes_against, quorum_needed, voting_ends_at, created_at`,
      [userId, title, description, category, quorumNeeded, votingEndsAt],
    );

    const proposal = result.rows[0];

    return res.status(201).json({
      proposal: {
        id: proposal.id,
        authorId: proposal.author_id,
        title: proposal.title,
        description: proposal.description,
        category: proposal.category,
        status: proposal.status,
        votesFor: proposal.votes_for,
        votesAgainst: proposal.votes_against,
        quorumNeeded: proposal.quorum_needed,
        votingEndsAt: proposal.voting_ends_at,
        createdAt: proposal.created_at,
      },
    });
  } catch (err) {
    console.error('[governance] POST /proposals error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred while creating the proposal',
    });
  }
});

// ---------------------------------------------------------------------------
// POST /proposals/:id/vote — Vote on a governance proposal
// ---------------------------------------------------------------------------
router.post('/proposals/:id/vote', authenticate, validate(voteSchema), async (req, res) => {
  try {
    const proposalId = req.params.id;
    const userId = req.user.id;
    const { vote } = req.body;

    // 1. Verify user is eligible to vote
    const eligible = await isEligible(userId);
    if (!eligible) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You must be verified and have at least 10 completed rides to vote',
      });
    }

    // 2. Verify proposal is active and voting hasn't ended
    const proposalResult = await query(
      `SELECT id, status, voting_ends_at
       FROM governance_proposals
       WHERE id = $1`,
      [proposalId],
    );

    if (proposalResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Proposal not found',
      });
    }

    const proposal = proposalResult.rows[0];

    if (proposal.status !== 'active') {
      return res.status(400).json({
        error: 'Bad request',
        message: 'This proposal is no longer active',
      });
    }

    if (new Date(proposal.voting_ends_at) < new Date()) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'The voting period for this proposal has ended',
      });
    }

    // 3. Check if user has already voted
    const existingVote = await query(
      `SELECT id FROM votes
       WHERE proposal_id = $1 AND user_id = $2`,
      [proposalId, userId],
    );

    if (existingVote.rows.length > 0) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'You have already voted on this proposal',
      });
    }

    // 4. Insert the vote
    const voteResult = await query(
      `INSERT INTO votes (proposal_id, user_id, vote)
       VALUES ($1, $2, $3)
       RETURNING id, proposal_id, user_id, vote, created_at`,
      [proposalId, userId, vote],
    );

    // 5. Update proposal vote counts
    if (vote === 'for') {
      await query(
        `UPDATE governance_proposals
         SET votes_for = votes_for + 1
         WHERE id = $1`,
        [proposalId],
      );
    } else if (vote === 'against') {
      await query(
        `UPDATE governance_proposals
         SET votes_against = votes_against + 1
         WHERE id = $1`,
        [proposalId],
      );
    }
    // 'abstain' votes don't increment for or against but are recorded

    // 6. Check if voting period has ended and quorum met, then auto-resolve
    const updatedProposal = await query(
      `SELECT votes_for, votes_against, quorum_needed, voting_ends_at
       FROM governance_proposals
       WHERE id = $1`,
      [proposalId],
    );

    if (updatedProposal.rows.length > 0) {
      const p = updatedProposal.rows[0];
      const totalDirectionalVotes = p.votes_for + p.votes_against;

      // Auto-close if voting has ended and quorum is met
      if (new Date(p.voting_ends_at) <= new Date() && totalDirectionalVotes >= p.quorum_needed) {
        const newStatus = p.votes_for > p.votes_against ? 'passed' : 'rejected';
        await query(
          `UPDATE governance_proposals SET status = $1 WHERE id = $2`,
          [newStatus, proposalId],
        );
      }
    }

    const insertedVote = voteResult.rows[0];

    return res.status(201).json({
      vote: {
        id: insertedVote.id,
        proposalId: insertedVote.proposal_id,
        userId: insertedVote.user_id,
        vote: insertedVote.vote,
        createdAt: insertedVote.created_at,
      },
    });
  } catch (err) {
    // Handle unique constraint violation as a fallback
    if (err.code === '23505') {
      return res.status(409).json({
        error: 'Conflict',
        message: 'You have already voted on this proposal',
      });
    }
    console.error('[governance] POST /proposals/:id/vote error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred while recording your vote',
    });
  }
});

// ---------------------------------------------------------------------------
// GET /proposals/:id/results — Get proposal results with vote breakdown
// ---------------------------------------------------------------------------
router.get('/proposals/:id/results', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    // Fetch the proposal
    const proposalResult = await query(
      `SELECT gp.id, gp.title, gp.description, gp.category, gp.status,
              gp.votes_for, gp.votes_against, gp.quorum_needed,
              gp.voting_ends_at, gp.created_at,
              u.first_name AS author_first_name,
              u.last_name AS author_last_name,
              u.id AS author_id
       FROM governance_proposals gp
       JOIN users u ON u.id = gp.author_id
       WHERE gp.id = $1`,
      [id],
    );

    if (proposalResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Proposal not found',
      });
    }

    const row = proposalResult.rows[0];

    // Count abstentions from the votes table
    const abstainResult = await query(
      `SELECT COUNT(*) AS abstentions
       FROM votes
       WHERE proposal_id = $1 AND vote = 'abstain'`,
      [id],
    );
    const abstentions = parseInt(abstainResult.rows[0].abstentions, 10);

    const votesFor = row.votes_for;
    const votesAgainst = row.votes_against;
    const totalVotes = votesFor + votesAgainst + abstentions;
    const quorumNeeded = row.quorum_needed;
    const quorumMet = (votesFor + votesAgainst) >= quorumNeeded;
    const passed = quorumMet && votesFor > votesAgainst;

    const proposal = {
      id: row.id,
      title: row.title,
      description: row.description,
      category: row.category,
      status: row.status,
      votingEndsAt: row.voting_ends_at,
      createdAt: row.created_at,
      author: {
        id: row.author_id,
        name: `${row.author_first_name} ${row.author_last_name}`,
      },
    };

    const results = {
      votesFor,
      votesAgainst,
      abstentions,
      totalVotes,
      quorumNeeded,
      quorumMet,
      passed,
    };

    return res.status(200).json({ proposal, results });
  } catch (err) {
    console.error('[governance] GET /proposals/:id/results error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred while fetching proposal results',
    });
  }
});

// ---------------------------------------------------------------------------
// POST /proposals/:id/close — Close voting on a proposal (admin or auto)
// ---------------------------------------------------------------------------
router.post('/proposals/:id/close', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    // Fetch the proposal
    const proposalResult = await query(
      `SELECT gp.id, gp.status, gp.votes_for, gp.votes_against,
              gp.quorum_needed, gp.voting_ends_at,
              gp.title, gp.description, gp.category, gp.created_at,
              u.first_name AS author_first_name,
              u.last_name AS author_last_name,
              u.id AS author_id
       FROM governance_proposals gp
       JOIN users u ON u.id = gp.author_id
       WHERE gp.id = $1`,
      [id],
    );

    if (proposalResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Proposal not found',
      });
    }

    const row = proposalResult.rows[0];

    if (row.status !== 'active') {
      return res.status(400).json({
        error: 'Bad request',
        message: 'This proposal is already closed',
      });
    }

    // Check if voting period has ended
    if (new Date(row.voting_ends_at) > new Date()) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'The voting period has not yet ended',
      });
    }

    // Calculate results
    const votesFor = row.votes_for;
    const votesAgainst = row.votes_against;
    const totalDirectionalVotes = votesFor + votesAgainst;
    const quorumMet = totalDirectionalVotes >= row.quorum_needed;
    const passed = quorumMet && votesFor > votesAgainst;
    const newStatus = passed ? 'passed' : 'rejected';

    // Update the proposal status
    const updateResult = await query(
      `UPDATE governance_proposals
       SET status = $1
       WHERE id = $2
       RETURNING id, title, description, category, status,
                 votes_for, votes_against, quorum_needed,
                 voting_ends_at, created_at`,
      [newStatus, id],
    );

    const updatedRow = updateResult.rows[0];

    const proposal = {
      id: updatedRow.id,
      title: updatedRow.title,
      description: updatedRow.description,
      category: updatedRow.category,
      status: updatedRow.status,
      votesFor: updatedRow.votes_for,
      votesAgainst: updatedRow.votes_against,
      quorumNeeded: updatedRow.quorum_needed,
      votingEndsAt: updatedRow.voting_ends_at,
      createdAt: updatedRow.created_at,
      author: {
        id: row.author_id,
        name: `${row.author_first_name} ${row.author_last_name}`,
      },
    };

    const outcome = {
      quorumMet,
      passed,
      finalStatus: newStatus,
    };

    return res.status(200).json({ proposal, outcome });
  } catch (err) {
    console.error('[governance] POST /proposals/:id/close error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred while closing the proposal',
    });
  }
});

export default router;
