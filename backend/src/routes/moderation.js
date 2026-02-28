import { Router } from 'express';
import { query } from '../config/database.js';
import { authenticate } from '../middleware/auth.js';
import {
  createElection,
  nominate,
  voteForCandidate,
  finalizeElection,
  getActiveElection,
  getActiveModerators,
  performModAction,
  reverseAction,
  getModeratorActions,
} from '../services/moderation.js';

const router = Router();

// ---------------------------------------------------------------------------
// Middleware: require moderator access
// ---------------------------------------------------------------------------

/**
 * Middleware that verifies the authenticated user has moderator privileges.
 * Must be used after the `authenticate` middleware.
 *
 * A user is considered a moderator if their `is_moderator` flag is true
 * OR they have an active record in the moderators table with a term that
 * has not yet expired.
 */
async function requireModerator(req, res, next) {
  try {
    const result = await query(
      'SELECT is_moderator FROM users WHERE id = $1',
      [req.user.id]
    );

    if (!result.rows[0]?.is_moderator) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Moderator access required',
      });
    }

    next();
  } catch (err) {
    console.error('[moderation] requireModerator error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred while verifying moderator access',
    });
  }
}

// ---------------------------------------------------------------------------
// GET /elections — List all elections with pagination
// ---------------------------------------------------------------------------
router.get('/elections', authenticate, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;

    const countResult = await query(
      'SELECT COUNT(*) AS total FROM moderator_elections'
    );
    const total = parseInt(countResult.rows[0].total, 10);

    const electionsResult = await query(
      `SELECT id, title, description, seats_available, nominations_end,
              voting_ends, status, created_at
       FROM moderator_elections
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const elections = electionsResult.rows.map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      seatsAvailable: row.seats_available,
      nominationsEnd: row.nominations_end,
      votingEnds: row.voting_ends,
      status: row.status,
      createdAt: row.created_at,
    }));

    return res.status(200).json({ elections, total, page, limit });
  } catch (err) {
    console.error('[moderation] GET /elections error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred while fetching elections',
    });
  }
});

// ---------------------------------------------------------------------------
// GET /elections/active — Get the current active election
// ---------------------------------------------------------------------------
router.get('/elections/active', authenticate, async (req, res) => {
  try {
    const election = await getActiveElection();

    if (!election) {
      return res.status(200).json({ election: null });
    }

    return res.status(200).json({
      election: {
        id: election.id,
        title: election.title,
        description: election.description,
        seatsAvailable: election.seats_available,
        nominationsEnd: election.nominations_end,
        votingEnds: election.voting_ends,
        status: election.status,
        createdAt: election.created_at,
      },
    });
  } catch (err) {
    console.error('[moderation] GET /elections/active error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred while fetching the active election',
    });
  }
});

// ---------------------------------------------------------------------------
// POST /elections — Create a new election (moderator only)
// ---------------------------------------------------------------------------
router.post('/elections', authenticate, requireModerator, async (req, res) => {
  try {
    const { title, description, seatsAvailable, nominationDays, votingDays } = req.body;

    // Validate required fields
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Title is required',
      });
    }

    if (!description || typeof description !== 'string' || description.trim().length === 0) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Description is required',
      });
    }

    if (!seatsAvailable || typeof seatsAvailable !== 'number' || seatsAvailable < 1) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'seatsAvailable must be a positive integer',
      });
    }

    if (!nominationDays || typeof nominationDays !== 'number' || nominationDays < 1) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'nominationDays must be a positive integer',
      });
    }

    if (!votingDays || typeof votingDays !== 'number' || votingDays < 1) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'votingDays must be a positive integer',
      });
    }

    // Verify no active election is already running
    const activeElection = await getActiveElection();
    if (activeElection) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'An election is already in progress. Only one election can run at a time.',
      });
    }

    const election = await createElection({
      title: title.trim(),
      description: description.trim(),
      seatsAvailable,
      nominationDays,
      votingDays,
    });

    return res.status(201).json({
      election: {
        id: election.id,
        title: election.title,
        description: election.description,
        seatsAvailable: election.seats_available,
        nominationsEnd: election.nominations_end,
        votingEnds: election.voting_ends,
        status: election.status,
        createdAt: election.created_at,
      },
    });
  } catch (err) {
    console.error('[moderation] POST /elections error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred while creating the election',
    });
  }
});

// ---------------------------------------------------------------------------
// GET /elections/:id — Get election with candidates and vote counts
// ---------------------------------------------------------------------------
router.get('/elections/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const electionResult = await query(
      `SELECT id, title, description, seats_available, nominations_end,
              voting_ends, status, created_at
       FROM moderator_elections
       WHERE id = $1`,
      [id]
    );

    if (electionResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Election not found',
      });
    }

    const row = electionResult.rows[0];

    // Get candidates with user info
    const candidatesResult = await query(
      `SELECT mc.id, mc.user_id, mc.statement, mc.votes_received,
              mc.elected, mc.created_at,
              u.first_name, u.last_name, u.rating_avg
       FROM moderator_candidates mc
       JOIN users u ON u.id = mc.user_id
       WHERE mc.election_id = $1
       ORDER BY mc.votes_received DESC, mc.created_at ASC`,
      [id]
    );

    const election = {
      id: row.id,
      title: row.title,
      description: row.description,
      seatsAvailable: row.seats_available,
      nominationsEnd: row.nominations_end,
      votingEnds: row.voting_ends,
      status: row.status,
      createdAt: row.created_at,
    };

    const candidates = candidatesResult.rows.map((c) => ({
      id: c.id,
      userId: c.user_id,
      name: `${c.first_name} ${c.last_name}`,
      rating: c.rating_avg,
      statement: c.statement,
      votesReceived: c.votes_received,
      elected: c.elected,
      createdAt: c.created_at,
    }));

    return res.status(200).json({ election, candidates });
  } catch (err) {
    console.error('[moderation] GET /elections/:id error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred while fetching the election',
    });
  }
});

// ---------------------------------------------------------------------------
// POST /elections/:id/nominate — Self-nominate for an election
// ---------------------------------------------------------------------------
router.post('/elections/:id/nominate', authenticate, async (req, res) => {
  try {
    const { id: electionId } = req.params;
    const userId = req.user.id;
    const { statement } = req.body;

    if (!statement || typeof statement !== 'string' || statement.trim().length === 0) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'A candidate statement is required',
      });
    }

    const candidate = await nominate(electionId, userId, statement.trim());

    return res.status(201).json({
      candidate: {
        id: candidate.id,
        electionId: candidate.election_id,
        userId: candidate.user_id,
        statement: candidate.statement,
        votesReceived: candidate.votes_received,
        createdAt: candidate.created_at,
      },
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        error: err.statusCode === 409 ? 'Conflict'
          : err.statusCode === 404 ? 'Not found'
          : err.statusCode === 403 ? 'Forbidden'
          : 'Bad request',
        message: err.message,
      });
    }
    // Handle unique constraint violation as a fallback
    if (err.code === '23505') {
      return res.status(409).json({
        error: 'Conflict',
        message: 'You have already nominated yourself for this election',
      });
    }
    console.error('[moderation] POST /elections/:id/nominate error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred while processing your nomination',
    });
  }
});

// ---------------------------------------------------------------------------
// POST /elections/:id/vote — Vote for a candidate
// ---------------------------------------------------------------------------
router.post('/elections/:id/vote', authenticate, async (req, res) => {
  try {
    const { id: electionId } = req.params;
    const voterId = req.user.id;
    const { candidateId } = req.body;

    if (!candidateId) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'candidateId is required',
      });
    }

    const result = await voteForCandidate(electionId, voterId, candidateId);

    return res.status(200).json(result);
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        error: err.statusCode === 409 ? 'Conflict'
          : err.statusCode === 404 ? 'Not found'
          : err.statusCode === 403 ? 'Forbidden'
          : 'Bad request',
        message: err.message,
      });
    }
    if (err.code === '23505') {
      return res.status(409).json({
        error: 'Conflict',
        message: 'You have already voted in this election',
      });
    }
    console.error('[moderation] POST /elections/:id/vote error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred while recording your vote',
    });
  }
});

// ---------------------------------------------------------------------------
// POST /elections/:id/finalize — Finalize an election (moderator only)
// ---------------------------------------------------------------------------
router.post('/elections/:id/finalize', authenticate, requireModerator, async (req, res) => {
  try {
    const { id: electionId } = req.params;

    const result = await finalizeElection(electionId);

    return res.status(200).json({
      election: {
        id: result.election.id,
        title: result.election.title,
        description: result.election.description,
        seatsAvailable: result.election.seats_available,
        nominationsEnd: result.election.nominations_end,
        votingEnds: result.election.voting_ends,
        status: result.election.status,
        createdAt: result.election.created_at,
      },
      winners: result.winners,
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        error: err.statusCode === 404 ? 'Not found' : 'Bad request',
        message: err.message,
      });
    }
    console.error('[moderation] POST /elections/:id/finalize error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred while finalizing the election',
    });
  }
});

// ---------------------------------------------------------------------------
// GET /moderators — Get active moderators
// ---------------------------------------------------------------------------
router.get('/moderators', authenticate, async (req, res) => {
  try {
    const moderators = await getActiveModerators();
    return res.status(200).json({ moderators });
  } catch (err) {
    console.error('[moderation] GET /moderators error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred while fetching moderators',
    });
  }
});

// ---------------------------------------------------------------------------
// POST /actions — Perform a moderation action (moderator only)
// ---------------------------------------------------------------------------
router.post('/actions', authenticate, requireModerator, async (req, res) => {
  try {
    const { targetUserId, targetProposalId, actionType, reason, durationHours } = req.body;
    const moderatorId = req.user.id;

    // Validate required fields
    if (!actionType || typeof actionType !== 'string') {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'actionType is required',
      });
    }

    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'reason is required',
      });
    }

    const action = await performModAction({
      moderatorId,
      targetUserId: targetUserId || null,
      targetProposalId: targetProposalId || null,
      actionType,
      reason: reason.trim(),
      durationHours: durationHours || null,
    });

    return res.status(201).json({
      action: {
        id: action.id,
        moderatorId: action.moderator_id,
        targetUserId: action.target_user_id,
        targetProposalId: action.target_proposal_id,
        actionType: action.action_type,
        reason: action.reason,
        durationHours: action.duration_hours,
        reversed: action.reversed,
        createdAt: action.created_at,
      },
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        error: err.statusCode === 403 ? 'Forbidden'
          : err.statusCode === 404 ? 'Not found'
          : 'Bad request',
        message: err.message,
      });
    }
    console.error('[moderation] POST /actions error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred while performing the moderation action',
    });
  }
});

// ---------------------------------------------------------------------------
// POST /actions/:id/reverse — Reverse a moderation action (moderator only)
// ---------------------------------------------------------------------------
router.post('/actions/:id/reverse', authenticate, requireModerator, async (req, res) => {
  try {
    const { id: actionId } = req.params;
    const reversedByModeratorId = req.user.id;

    const action = await reverseAction(actionId, reversedByModeratorId);

    return res.status(200).json({
      action: {
        id: action.id,
        moderatorId: action.moderator_id,
        targetUserId: action.target_user_id,
        targetProposalId: action.target_proposal_id,
        actionType: action.action_type,
        reason: action.reason,
        durationHours: action.duration_hours,
        reversed: action.reversed,
        reversedAt: action.reversed_at,
        reversedBy: action.reversed_by,
        createdAt: action.created_at,
      },
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        error: err.statusCode === 404 ? 'Not found'
          : err.statusCode === 403 ? 'Forbidden'
          : 'Bad request',
        message: err.message,
      });
    }
    console.error('[moderation] POST /actions/:id/reverse error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred while reversing the action',
    });
  }
});

// ---------------------------------------------------------------------------
// GET /actions — Get moderation action history (moderator only)
// ---------------------------------------------------------------------------
router.get('/actions', authenticate, requireModerator, async (req, res) => {
  try {
    const moderatorId = req.query.moderatorId || null;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));

    const result = await getModeratorActions(moderatorId, page, limit);

    return res.status(200).json({
      actions: result.actions,
      total: result.total,
      page,
      limit,
    });
  } catch (err) {
    console.error('[moderation] GET /actions error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred while fetching moderation actions',
    });
  }
});

export default router;
