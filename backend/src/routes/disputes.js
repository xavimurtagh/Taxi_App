import { Router } from 'express';
import { query } from '../config/database.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import {
  createDisputeSchema,
  disputeEvidenceSchema,
  disputeReviewSchema,
  disputeAppealSchema,
} from '../utils/validators.js';
import * as disputes from '../services/disputes.js';

const router = Router();

// ---------------------------------------------------------------------------
// POST / — Create a new dispute
// ---------------------------------------------------------------------------
router.post('/', authenticate, validate(createDisputeSchema), async (req, res) => {
  try {
    const initiatorId = req.user.id;
    const { rideId, defendantId, disputeType, title, description } = req.body;

    // Verify the initiator cannot dispute themselves
    if (initiatorId === defendantId) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'You cannot file a dispute against yourself',
      });
    }

    // Verify the initiator was part of the ride
    const rideResult = await query(
      `SELECT id, passenger_id, driver_id, status
       FROM rides
       WHERE id = $1`,
      [rideId],
    );

    if (rideResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Ride not found',
      });
    }

    const ride = rideResult.rows[0];

    if (ride.passenger_id !== initiatorId && ride.driver_id !== initiatorId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You can only file disputes for rides you participated in',
      });
    }

    // Verify the defendant was also part of the ride
    if (ride.passenger_id !== defendantId && ride.driver_id !== defendantId) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'The defendant must be a participant of the ride',
      });
    }

    // Check for duplicate active disputes on the same ride by the same initiator
    const existingDispute = await query(
      `SELECT id FROM disputes
       WHERE initiator_id = $1
         AND ride_id = $2
         AND status NOT IN ('decision_made', 'closed')`,
      [initiatorId, rideId],
    );

    if (existingDispute.rows.length > 0) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'You already have an active dispute for this ride',
      });
    }

    // Create the dispute
    const dispute = await disputes.createDispute({
      initiatorId,
      defendantId,
      rideId,
      disputeType,
      title,
      description,
    });

    // Kick off panel assignment in the background (don't await)
    disputes.assignPanel(dispute.id).catch((err) => {
      console.error(`[disputes] Background panel assignment failed for dispute ${dispute.id}:`, err.message);
    });

    return res.status(201).json({
      dispute: {
        id: dispute.id,
        initiatorId: dispute.initiator_id,
        defendantId: dispute.defendant_id,
        rideId: dispute.ride_id,
        disputeType: dispute.dispute_type,
        title: dispute.title,
        description: dispute.description,
        status: dispute.status,
        createdAt: dispute.created_at,
      },
    });
  } catch (err) {
    console.error('[disputes] POST / error:', err);
    return res.status(err.statusCode || 500).json({
      error: err.statusCode ? 'Request failed' : 'Internal server error',
      message: err.statusCode
        ? err.message
        : 'An unexpected error occurred while creating the dispute',
    });
  }
});

// ---------------------------------------------------------------------------
// GET / — Get current user's disputes
// ---------------------------------------------------------------------------
router.get('/', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { status, role } = req.query;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;

    // Build WHERE clause
    const conditions = [];
    const params = [];
    let paramIdx = 1;

    // Filter by user participation role
    if (role === 'initiator') {
      conditions.push(`d.initiator_id = $${paramIdx++}`);
      params.push(userId);
    } else if (role === 'defendant') {
      conditions.push(`d.defendant_id = $${paramIdx++}`);
      params.push(userId);
    } else {
      conditions.push(`(d.initiator_id = $${paramIdx} OR d.defendant_id = $${paramIdx})`);
      paramIdx++;
      params.push(userId);
    }

    // Filter by status
    const validStatuses = ['submitted', 'panel_assigned', 'under_review', 'decision_made', 'appealed', 'closed'];
    if (status && validStatuses.includes(status)) {
      conditions.push(`d.status = $${paramIdx++}`);
      params.push(status);
    }

    const whereClause = conditions.length > 0
      ? `WHERE ${conditions.join(' AND ')}`
      : '';

    // Total count
    const countResult = await query(
      `SELECT COUNT(*) AS total
       FROM disputes d
       ${whereClause}`,
      params,
    );
    const total = parseInt(countResult.rows[0].total, 10);

    // Fetch disputes with pagination
    const disputesResult = await query(
      `SELECT d.id, d.ride_id, d.dispute_type, d.title, d.status,
              d.outcome, d.created_at, d.resolved_at,
              d.initiator_id, d.defendant_id,
              i.first_name AS initiator_first_name,
              i.last_name AS initiator_last_name,
              def.first_name AS defendant_first_name,
              def.last_name AS defendant_last_name
       FROM disputes d
       JOIN users i ON i.id = d.initiator_id
       JOIN users def ON def.id = d.defendant_id
       ${whereClause}
       ORDER BY d.created_at DESC
       LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
      [...params, limit, offset],
    );

    const disputesList = disputesResult.rows.map(row => ({
      id: row.id,
      rideId: row.ride_id,
      disputeType: row.dispute_type,
      title: row.title,
      status: row.status,
      outcome: row.outcome,
      createdAt: row.created_at,
      resolvedAt: row.resolved_at,
      initiator: {
        id: row.initiator_id,
        name: `${row.initiator_first_name} ${row.initiator_last_name}`,
      },
      defendant: {
        id: row.defendant_id,
        name: `${row.defendant_first_name} ${row.defendant_last_name}`,
      },
    }));

    return res.status(200).json({ disputes: disputesList, total, page, limit });
  } catch (err) {
    console.error('[disputes] GET / error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred while fetching disputes',
    });
  }
});

// ---------------------------------------------------------------------------
// GET /:id — Get dispute details
// ---------------------------------------------------------------------------
router.get('/:id', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const dispute = await disputes.getDispute(id);

    if (!dispute) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Dispute not found',
      });
    }

    // Verify user is a participant or panel member
    const isParticipant =
      dispute.initiator.id === userId || dispute.defendant.id === userId;
    const isPanelMember =
      dispute.panelMembers.some(m => m.userId === userId);

    if (!isParticipant && !isPanelMember) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have access to this dispute',
      });
    }

    // If not resolved yet, redact reviews for non-panel members
    const isResolved = ['decision_made', 'closed'].includes(dispute.status);
    if (!isResolved && !isPanelMember) {
      dispute.reviews = [];
    }

    return res.status(200).json({ dispute });
  } catch (err) {
    console.error('[disputes] GET /:id error:', err);
    return res.status(err.statusCode || 500).json({
      error: err.statusCode ? 'Request failed' : 'Internal server error',
      message: err.statusCode
        ? err.message
        : 'An unexpected error occurred while fetching the dispute',
    });
  }
});

// ---------------------------------------------------------------------------
// POST /:id/evidence — Add evidence to a dispute
// ---------------------------------------------------------------------------
router.post('/:id/evidence', authenticate, validate(disputeEvidenceSchema), async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { evidenceType, content, fileUrl } = req.body;

    const evidence = await disputes.addEvidence(
      id,
      userId,
      evidenceType,
      content,
      fileUrl || null,
    );

    return res.status(201).json({
      evidence: {
        id: evidence.id,
        disputeId: evidence.dispute_id,
        submittedBy: evidence.submitted_by,
        evidenceType: evidence.evidence_type,
        content: evidence.content,
        fileUrl: evidence.file_url,
        createdAt: evidence.created_at,
      },
    });
  } catch (err) {
    console.error('[disputes] POST /:id/evidence error:', err);
    return res.status(err.statusCode || 500).json({
      error: err.statusCode ? 'Request failed' : 'Internal server error',
      message: err.statusCode
        ? err.message
        : 'An unexpected error occurred while adding evidence',
    });
  }
});

// ---------------------------------------------------------------------------
// POST /:id/review — Submit a peer review
// ---------------------------------------------------------------------------
router.post('/:id/review', authenticate, validate(disputeReviewSchema), async (req, res) => {
  try {
    const reviewerId = req.user.id;
    const { id } = req.params;
    const { vote, reasoning } = req.body;

    const review = await disputes.submitReview(id, reviewerId, vote, reasoning);

    return res.status(201).json({
      review: {
        id: review.id,
        disputeId: review.dispute_id,
        reviewerId: review.reviewer_id,
        vote: review.vote,
        reasoning: review.reasoning,
        createdAt: review.created_at,
      },
    });
  } catch (err) {
    console.error('[disputes] POST /:id/review error:', err);
    return res.status(err.statusCode || 500).json({
      error: err.statusCode ? 'Request failed' : 'Internal server error',
      message: err.statusCode
        ? err.message
        : 'An unexpected error occurred while submitting the review',
    });
  }
});

// ---------------------------------------------------------------------------
// POST /:id/appeal — Appeal a dispute decision
// ---------------------------------------------------------------------------
router.post('/:id/appeal', authenticate, validate(disputeAppealSchema), async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { reason } = req.body;

    const dispute = await disputes.appealDispute(id, userId, reason);

    return res.status(200).json({
      dispute: {
        id: dispute.id,
        initiatorId: dispute.initiator_id,
        defendantId: dispute.defendant_id,
        rideId: dispute.ride_id,
        disputeType: dispute.dispute_type,
        title: dispute.title,
        status: dispute.status,
        appealReason: dispute.appeal_reason,
        appealCount: dispute.appeal_count,
        createdAt: dispute.created_at,
      },
    });
  } catch (err) {
    console.error('[disputes] POST /:id/appeal error:', err);
    return res.status(err.statusCode || 500).json({
      error: err.statusCode ? 'Request failed' : 'Internal server error',
      message: err.statusCode
        ? err.message
        : 'An unexpected error occurred while processing the appeal',
    });
  }
});

// ---------------------------------------------------------------------------
// GET /:id/reviews — Get all reviews for a dispute (only after resolution)
// ---------------------------------------------------------------------------
router.get('/:id/reviews', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    // Fetch the dispute to check status and access
    const disputeResult = await query(
      `SELECT d.id, d.status, d.initiator_id, d.defendant_id
       FROM disputes d
       WHERE d.id = $1`,
      [id],
    );

    if (disputeResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Dispute not found',
      });
    }

    const dispute = disputeResult.rows[0];

    // Verify user has access (participant or panel member)
    const isParticipant =
      dispute.initiator_id === userId || dispute.defendant_id === userId;

    const panelCheck = await query(
      `SELECT id FROM dispute_panel_members
       WHERE dispute_id = $1 AND user_id = $2`,
      [id, userId],
    );
    const isPanelMember = panelCheck.rows.length > 0;

    if (!isParticipant && !isPanelMember) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have access to this dispute',
      });
    }

    // Reviews are only visible after resolution (unless you're a panel member)
    const isResolved = ['decision_made', 'closed'].includes(dispute.status);
    if (!isResolved && !isPanelMember) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'Reviews are only visible after the dispute has been resolved',
      });
    }

    // Fetch reviews
    const reviewsResult = await query(
      `SELECT dr.id, dr.dispute_id, dr.reviewer_id, dr.vote, dr.reasoning,
              dr.created_at,
              u.first_name, u.last_name
       FROM dispute_reviews dr
       JOIN users u ON u.id = dr.reviewer_id
       WHERE dr.dispute_id = $1
       ORDER BY dr.created_at ASC`,
      [id],
    );

    const reviews = reviewsResult.rows.map(r => ({
      id: r.id,
      disputeId: r.dispute_id,
      reviewerId: r.reviewer_id,
      reviewerName: `${r.first_name} ${r.last_name}`,
      vote: r.vote,
      reasoning: r.reasoning,
      createdAt: r.created_at,
    }));

    return res.status(200).json({ reviews });
  } catch (err) {
    console.error('[disputes] GET /:id/reviews error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred while fetching reviews',
    });
  }
});

export default router;
