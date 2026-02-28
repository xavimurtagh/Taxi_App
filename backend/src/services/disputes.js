import { query } from '../config/database.js';
import { getIO } from '../sockets/index.js';
import { notifyUser } from './notifications.js';

/**
 * Number of peer reviewers selected for each dispute panel.
 */
const PANEL_SIZE = 5;

/**
 * Minimum number of reviews required to reach a majority decision.
 */
const MAJORITY_THRESHOLD = 3;

/**
 * Minimum completed rides required for a user to serve on a dispute panel.
 */
const REVIEWER_MIN_RIDES = 20;

// ---------------------------------------------------------------------------
// createDispute
// ---------------------------------------------------------------------------

/**
 * Create a new dispute between two users over a ride.
 *
 * @param {object} params
 * @param {string} params.initiatorId  - User who filed the dispute
 * @param {string} params.defendantId  - User the dispute is filed against
 * @param {string} params.rideId       - The ride in question
 * @param {string} params.disputeType  - Category of dispute
 * @param {string} params.title        - Short title
 * @param {string} params.description  - Full description
 * @returns {Promise<object>} The created dispute record
 */
export async function createDispute({ initiatorId, defendantId, rideId, disputeType, title, description }) {
  const result = await query(
    `INSERT INTO disputes
       (initiator_id, defendant_id, ride_id, dispute_type, title, description, status)
     VALUES ($1, $2, $3, $4, $5, $6, 'submitted')
     RETURNING *`,
    [initiatorId, defendantId, rideId, disputeType, title, description],
  );

  const dispute = result.rows[0];

  // Notify the defendant about the new dispute
  await notifyUser(defendantId, 'dispute:created', {
    disputeId: dispute.id,
    title: dispute.title,
    disputeType: dispute.dispute_type,
    message: 'A dispute has been filed against you. You may submit evidence to support your case.',
  });

  return dispute;
}

// ---------------------------------------------------------------------------
// assignPanel
// ---------------------------------------------------------------------------

/**
 * Randomly assign a panel of peer reviewers to a dispute.
 *
 * Eligible reviewers must be:
 *  - Verified users
 *  - Have at least REVIEWER_MIN_RIDES completed rides
 *  - NOT the initiator or defendant of this dispute
 *  - NOT currently serving on another active (unresolved) panel
 *
 * @param {string} disputeId
 * @returns {Promise<{ dispute: object, panelMembers: object[] }>}
 */
export async function assignPanel(disputeId) {
  // 1. Fetch the dispute
  const disputeResult = await query(
    'SELECT * FROM disputes WHERE id = $1',
    [disputeId],
  );

  if (disputeResult.rows.length === 0) {
    throw Object.assign(new Error('Dispute not found'), { statusCode: 404 });
  }

  const dispute = disputeResult.rows[0];

  // 2. Find eligible reviewers
  const eligibleResult = await query(
    `SELECT u.id
     FROM users u
     WHERE u.is_verified = true
       AND u.is_active = true
       AND u.id != $1
       AND u.id != $2
       AND (
         SELECT COUNT(*)
         FROM rides
         WHERE (passenger_id = u.id OR driver_id = u.id)
           AND status = 'completed'
       ) >= $3
       AND u.id NOT IN (
         SELECT dpm.user_id
         FROM dispute_panel_members dpm
         JOIN disputes d ON d.id = dpm.dispute_id
         WHERE d.status IN ('submitted', 'panel_assigned', 'under_review', 'appealed')
       )
     ORDER BY RANDOM()
     LIMIT $4`,
    [dispute.initiator_id, dispute.defendant_id, REVIEWER_MIN_RIDES, PANEL_SIZE],
  );

  if (eligibleResult.rows.length < PANEL_SIZE) {
    throw Object.assign(
      new Error(`Not enough eligible reviewers. Found ${eligibleResult.rows.length}, need ${PANEL_SIZE}.`),
      { statusCode: 422 },
    );
  }

  // 3. Insert panel members
  const panelMembers = [];
  for (const row of eligibleResult.rows) {
    const insertResult = await query(
      `INSERT INTO dispute_panel_members (dispute_id, user_id)
       VALUES ($1, $2)
       RETURNING *`,
      [disputeId, row.id],
    );
    panelMembers.push(insertResult.rows[0]);
  }

  // 4. Update dispute status
  await query(
    `UPDATE disputes SET status = 'panel_assigned' WHERE id = $1`,
    [disputeId],
  );

  dispute.status = 'panel_assigned';

  // 5. Notify each panel member via socket
  const io = getIO();
  for (const member of panelMembers) {
    await notifyUser(member.user_id, 'dispute:panel_assigned', {
      disputeId,
      title: dispute.title,
      disputeType: dispute.dispute_type,
      message: 'You have been selected as a peer reviewer for a dispute. Please review the evidence and submit your decision.',
    });

    // Also join them to a dispute-specific socket room if connected
    if (io) {
      io.to(`user:${member.user_id}`).socketsJoin(`dispute:${disputeId}`);
    }
  }

  return { dispute, panelMembers };
}

// ---------------------------------------------------------------------------
// submitReview
// ---------------------------------------------------------------------------

/**
 * Submit a peer review for a dispute.
 *
 * @param {string} disputeId
 * @param {string} reviewerId
 * @param {string} vote       - 'uphold' | 'dismiss' | 'partial'
 * @param {string} reasoning  - Explanation for the vote
 * @returns {Promise<object>} The review record
 */
export async function submitReview(disputeId, reviewerId, vote, reasoning) {
  // 1. Verify the reviewer is on this dispute's panel
  const memberResult = await query(
    `SELECT * FROM dispute_panel_members
     WHERE dispute_id = $1 AND user_id = $2`,
    [disputeId, reviewerId],
  );

  if (memberResult.rows.length === 0) {
    throw Object.assign(
      new Error('You are not a panel member for this dispute'),
      { statusCode: 403 },
    );
  }

  // 2. Verify they haven't already reviewed
  const existingReview = await query(
    `SELECT id FROM dispute_reviews
     WHERE dispute_id = $1 AND reviewer_id = $2`,
    [disputeId, reviewerId],
  );

  if (existingReview.rows.length > 0) {
    throw Object.assign(
      new Error('You have already submitted a review for this dispute'),
      { statusCode: 409 },
    );
  }

  // 3. Insert the review
  const reviewResult = await query(
    `INSERT INTO dispute_reviews (dispute_id, reviewer_id, vote, reasoning)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [disputeId, reviewerId, vote, reasoning],
  );

  const review = reviewResult.rows[0];

  // 4. Update dispute status to under_review if this is the first review
  await query(
    `UPDATE disputes SET status = 'under_review'
     WHERE id = $1 AND status = 'panel_assigned'`,
    [disputeId],
  );

  // 5. Check if enough reviews have been submitted for a majority decision
  const reviewCountResult = await query(
    `SELECT COUNT(*) AS total FROM dispute_reviews WHERE dispute_id = $1`,
    [disputeId],
  );

  const totalReviews = parseInt(reviewCountResult.rows[0].total, 10);

  if (totalReviews >= MAJORITY_THRESHOLD) {
    // Check if any vote has a clear majority
    const voteTallyResult = await query(
      `SELECT vote, COUNT(*) AS count
       FROM dispute_reviews
       WHERE dispute_id = $1
       GROUP BY vote
       ORDER BY count DESC`,
      [disputeId],
    );

    const topVote = voteTallyResult.rows[0];
    if (parseInt(topVote.count, 10) >= MAJORITY_THRESHOLD) {
      // Majority reached — resolve the dispute
      await resolveDispute(disputeId);
    }
  }

  return review;
}

// ---------------------------------------------------------------------------
// resolveDispute
// ---------------------------------------------------------------------------

/**
 * Resolve a dispute based on panel votes.
 *
 * @param {string} disputeId
 * @returns {Promise<{ dispute: object, voteSummary: object }>}
 */
export async function resolveDispute(disputeId) {
  // 1. Count votes
  const voteTallyResult = await query(
    `SELECT vote, COUNT(*) AS count
     FROM dispute_reviews
     WHERE dispute_id = $1
     GROUP BY vote
     ORDER BY count DESC`,
    [disputeId],
  );

  const voteSummary = {};
  for (const row of voteTallyResult.rows) {
    voteSummary[row.vote] = parseInt(row.count, 10);
  }

  // 2. Determine the outcome by majority
  const outcome = voteTallyResult.rows[0].vote; // The vote with the most count

  // 3. Build resolution text
  const upholdCount = voteSummary.uphold || 0;
  const dismissCount = voteSummary.dismiss || 0;
  const partialCount = voteSummary.partial || 0;
  const totalReviews = upholdCount + dismissCount + partialCount;

  let resolutionText = null;
  if (outcome === 'uphold') {
    resolutionText = `The dispute has been upheld by the peer review panel (${upholdCount} of ${totalReviews} votes). The panel found in favour of the initiator.`;
  } else if (outcome === 'dismiss') {
    resolutionText = `The dispute has been dismissed by the peer review panel (${dismissCount} of ${totalReviews} votes). The panel found in favour of the defendant.`;
  } else if (outcome === 'partial') {
    resolutionText = `The peer review panel reached a partial resolution (${partialCount} of ${totalReviews} votes). Both parties share some responsibility.`;
  }

  // 4. Update dispute
  const updateResult = await query(
    `UPDATE disputes
     SET status = 'decision_made',
         outcome = $2,
         resolution = $3,
         resolved_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [disputeId, outcome, resolutionText],
  );

  const dispute = updateResult.rows[0];

  // 5. Notify both parties
  await notifyUser(dispute.initiator_id, 'dispute:resolved', {
    disputeId: dispute.id,
    outcome,
    resolution: resolutionText,
    message: `Your dispute "${dispute.title}" has been resolved. Outcome: ${outcome}.`,
  });

  await notifyUser(dispute.defendant_id, 'dispute:resolved', {
    disputeId: dispute.id,
    outcome,
    resolution: resolutionText,
    message: `The dispute "${dispute.title}" has been resolved. Outcome: ${outcome}.`,
  });

  // 6. Handle deactivation appeal outcome for drivers
  if (dispute.dispute_type === 'deactivation_appeal') {
    if (outcome === 'dismiss') {
      // Appeal successful — the dismissal of the dispute means the driver stays active
      // No action needed: driver remains active
      console.log(`[disputes] Deactivation appeal for dispute ${disputeId} was successful (dismissed). Driver ${dispute.defendant_id} remains active.`);
    } else if (outcome === 'uphold') {
      // Appeal denied — deactivate the driver
      await query(
        `UPDATE users SET is_active = false WHERE id = $1`,
        [dispute.defendant_id],
      );

      await notifyUser(dispute.defendant_id, 'account:deactivated', {
        disputeId: dispute.id,
        message: 'Your deactivation appeal has been denied by the peer review panel. Your account has been deactivated.',
      });

      console.log(`[disputes] Deactivation appeal for dispute ${disputeId} was denied (upheld). Driver ${dispute.defendant_id} has been deactivated.`);
    }
  }

  return { dispute, voteSummary };
}

// ---------------------------------------------------------------------------
// appealDispute
// ---------------------------------------------------------------------------

/**
 * Appeal a dispute decision. Can only be done once by the defendant.
 *
 * @param {string} disputeId
 * @param {string} userId   - Must be the defendant
 * @param {string} reason   - Reason for the appeal
 * @returns {Promise<object>} Updated dispute record
 */
export async function appealDispute(disputeId, userId, reason) {
  // 1. Fetch the dispute
  const disputeResult = await query(
    'SELECT * FROM disputes WHERE id = $1',
    [disputeId],
  );

  if (disputeResult.rows.length === 0) {
    throw Object.assign(new Error('Dispute not found'), { statusCode: 404 });
  }

  const dispute = disputeResult.rows[0];

  // 2. Verify user is the defendant
  if (dispute.defendant_id !== userId) {
    throw Object.assign(
      new Error('Only the defendant can appeal a dispute decision'),
      { statusCode: 403 },
    );
  }

  // 3. Verify status is decision_made
  if (dispute.status !== 'decision_made') {
    throw Object.assign(
      new Error('Only disputes with a decision can be appealed'),
      { statusCode: 400 },
    );
  }

  // 4. Check for previous appeal
  if (dispute.appeal_count && dispute.appeal_count >= 1) {
    throw Object.assign(
      new Error('This dispute has already been appealed. Only one appeal is allowed.'),
      { statusCode: 400 },
    );
  }

  // 5. Update dispute status to appealed
  const updateResult = await query(
    `UPDATE disputes
     SET status = 'appealed',
         appeal_reason = $2,
         appeal_count = COALESCE(appeal_count, 0) + 1,
         outcome = NULL,
         resolution = NULL,
         resolved_at = NULL
     WHERE id = $1
     RETURNING *`,
    [disputeId, reason],
  );

  const updatedDispute = updateResult.rows[0];

  // 6. Remove old panel members so new ones can be assigned
  //    (keep old reviews for audit trail)

  // 7. Assign a new panel with different reviewers
  //    First, get the previous panel members to exclude them
  const previousPanelResult = await query(
    `SELECT user_id FROM dispute_panel_members WHERE dispute_id = $1`,
    [disputeId],
  );
  const previousPanelUserIds = previousPanelResult.rows.map(r => r.user_id);

  // Remove old panel assignments
  await query(
    `DELETE FROM dispute_panel_members WHERE dispute_id = $1`,
    [disputeId],
  );

  // Find new eligible reviewers excluding previous panel members
  const excludeIds = [dispute.initiator_id, dispute.defendant_id, ...previousPanelUserIds];
  const placeholders = excludeIds.map((_, i) => `$${i + 1}`).join(', ');

  const eligibleResult = await query(
    `SELECT u.id
     FROM users u
     WHERE u.is_verified = true
       AND u.is_active = true
       AND u.id NOT IN (${placeholders})
       AND (
         SELECT COUNT(*)
         FROM rides
         WHERE (passenger_id = u.id OR driver_id = u.id)
           AND status = 'completed'
       ) >= $${excludeIds.length + 1}
       AND u.id NOT IN (
         SELECT dpm.user_id
         FROM dispute_panel_members dpm
         JOIN disputes d ON d.id = dpm.dispute_id
         WHERE d.status IN ('submitted', 'panel_assigned', 'under_review', 'appealed')
       )
     ORDER BY RANDOM()
     LIMIT $${excludeIds.length + 2}`,
    [...excludeIds, REVIEWER_MIN_RIDES, PANEL_SIZE],
  );

  if (eligibleResult.rows.length < PANEL_SIZE) {
    // Revert status if we can't find enough reviewers
    await query(
      `UPDATE disputes SET status = 'decision_made' WHERE id = $1`,
      [disputeId],
    );
    throw Object.assign(
      new Error(`Not enough eligible reviewers for appeal panel. Found ${eligibleResult.rows.length}, need ${PANEL_SIZE}.`),
      { statusCode: 422 },
    );
  }

  // Insert new panel members
  for (const row of eligibleResult.rows) {
    await query(
      `INSERT INTO dispute_panel_members (dispute_id, user_id)
       VALUES ($1, $2)`,
      [disputeId, row.id],
    );

    await notifyUser(row.id, 'dispute:panel_assigned', {
      disputeId,
      title: updatedDispute.title,
      disputeType: updatedDispute.dispute_type,
      isAppeal: true,
      message: 'You have been selected as a peer reviewer for a dispute appeal. Please review the evidence and submit your decision.',
    });
  }

  // Update status to panel_assigned for the appeal
  await query(
    `UPDATE disputes SET status = 'panel_assigned' WHERE id = $1`,
    [disputeId],
  );

  updatedDispute.status = 'panel_assigned';

  // Notify the initiator about the appeal
  await notifyUser(dispute.initiator_id, 'dispute:appealed', {
    disputeId,
    title: dispute.title,
    message: 'The defendant has appealed the dispute decision. A new review panel has been assigned.',
  });

  return updatedDispute;
}

// ---------------------------------------------------------------------------
// getDispute
// ---------------------------------------------------------------------------

/**
 * Get a dispute with all related data: evidence, panel members, reviews.
 *
 * @param {string} disputeId
 * @returns {Promise<object>} Full dispute object with relations
 */
export async function getDispute(disputeId) {
  // Dispute with initiator and defendant names
  const disputeResult = await query(
    `SELECT d.*,
            i.first_name AS initiator_first_name,
            i.last_name AS initiator_last_name,
            i.email AS initiator_email,
            def.first_name AS defendant_first_name,
            def.last_name AS defendant_last_name,
            def.email AS defendant_email
     FROM disputes d
     JOIN users i ON i.id = d.initiator_id
     JOIN users def ON def.id = d.defendant_id
     WHERE d.id = $1`,
    [disputeId],
  );

  if (disputeResult.rows.length === 0) {
    return null;
  }

  const row = disputeResult.rows[0];

  // Evidence
  const evidenceResult = await query(
    `SELECT de.*, u.first_name, u.last_name
     FROM dispute_evidence de
     JOIN users u ON u.id = de.submitted_by
     WHERE de.dispute_id = $1
     ORDER BY de.created_at ASC`,
    [disputeId],
  );

  // Panel members
  const panelResult = await query(
    `SELECT dpm.*, u.first_name, u.last_name
     FROM dispute_panel_members dpm
     JOIN users u ON u.id = dpm.user_id
     WHERE dpm.dispute_id = $1
     ORDER BY dpm.created_at ASC`,
    [disputeId],
  );

  // Reviews
  const reviewsResult = await query(
    `SELECT dr.*, u.first_name, u.last_name
     FROM dispute_reviews dr
     JOIN users u ON u.id = dr.reviewer_id
     WHERE dr.dispute_id = $1
     ORDER BY dr.created_at ASC`,
    [disputeId],
  );

  return {
    id: row.id,
    rideId: row.ride_id,
    disputeType: row.dispute_type,
    title: row.title,
    description: row.description,
    status: row.status,
    outcome: row.outcome,
    resolution: row.resolution,
    appealReason: row.appeal_reason,
    appealCount: row.appeal_count,
    resolvedAt: row.resolved_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    initiator: {
      id: row.initiator_id,
      name: `${row.initiator_first_name} ${row.initiator_last_name}`,
      email: row.initiator_email,
    },
    defendant: {
      id: row.defendant_id,
      name: `${row.defendant_first_name} ${row.defendant_last_name}`,
      email: row.defendant_email,
    },
    evidence: evidenceResult.rows.map(e => ({
      id: e.id,
      evidenceType: e.evidence_type,
      content: e.content,
      fileUrl: e.file_url,
      submittedBy: {
        id: e.submitted_by,
        name: `${e.first_name} ${e.last_name}`,
      },
      createdAt: e.created_at,
    })),
    panelMembers: panelResult.rows.map(m => ({
      id: m.id,
      userId: m.user_id,
      name: `${m.first_name} ${m.last_name}`,
      createdAt: m.created_at,
    })),
    reviews: reviewsResult.rows.map(r => ({
      id: r.id,
      reviewerId: r.reviewer_id,
      reviewerName: `${r.first_name} ${r.last_name}`,
      vote: r.vote,
      reasoning: r.reasoning,
      createdAt: r.created_at,
    })),
  };
}

// ---------------------------------------------------------------------------
// getUserDisputes
// ---------------------------------------------------------------------------

/**
 * Get disputes where a user is the initiator or defendant.
 *
 * @param {string} userId
 * @param {'initiator'|'defendant'|'all'} role - Filter by participation role
 * @returns {Promise<object[]>}
 */
export async function getUserDisputes(userId, role = 'all') {
  let whereClause;
  const params = [userId];

  if (role === 'initiator') {
    whereClause = 'd.initiator_id = $1';
  } else if (role === 'defendant') {
    whereClause = 'd.defendant_id = $1';
  } else {
    whereClause = '(d.initiator_id = $1 OR d.defendant_id = $1)';
  }

  const result = await query(
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
     WHERE ${whereClause}
     ORDER BY d.created_at DESC`,
    params,
  );

  return result.rows.map(row => ({
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
}

// ---------------------------------------------------------------------------
// addEvidence
// ---------------------------------------------------------------------------

/**
 * Add evidence to a dispute.
 *
 * @param {string} disputeId
 * @param {string} userId       - Must be initiator or defendant
 * @param {string} evidenceType - e.g. 'text', 'image', 'screenshot', 'gps_log'
 * @param {string} content      - Text content or description
 * @param {string|null} fileUrl - URL to uploaded file (if any)
 * @returns {Promise<object>} The evidence record
 */
export async function addEvidence(disputeId, userId, evidenceType, content, fileUrl = null) {
  // 1. Verify dispute exists and user is a participant
  const disputeResult = await query(
    'SELECT * FROM disputes WHERE id = $1',
    [disputeId],
  );

  if (disputeResult.rows.length === 0) {
    throw Object.assign(new Error('Dispute not found'), { statusCode: 404 });
  }

  const dispute = disputeResult.rows[0];

  if (dispute.initiator_id !== userId && dispute.defendant_id !== userId) {
    throw Object.assign(
      new Error('Only the initiator or defendant can add evidence'),
      { statusCode: 403 },
    );
  }

  // 2. Verify dispute is not yet resolved
  if (['decision_made', 'closed'].includes(dispute.status)) {
    throw Object.assign(
      new Error('Cannot add evidence to a resolved dispute'),
      { statusCode: 400 },
    );
  }

  // 3. Insert evidence
  const result = await query(
    `INSERT INTO dispute_evidence (dispute_id, submitted_by, evidence_type, content, file_url)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [disputeId, userId, evidenceType, content, fileUrl],
  );

  return result.rows[0];
}
