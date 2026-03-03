import { Router } from 'express';
import { query } from '../config/database.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// ---------------------------------------------------------------------------
// POST / — Submit feedback (authenticated user)
// ---------------------------------------------------------------------------
router.post('/', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      type,
      title,
      description,
      severity,
      app_version,
      platform,
      device_info,
      screenshot_urls,
      metadata,
    } = req.body;

    // Validate required fields
    if (!type || typeof type !== 'string' || type.trim().length === 0) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Type is required',
      });
    }

    const validTypes = ['bug', 'feature_request', 'ux_feedback', 'general'];
    if (!validTypes.includes(type.trim())) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Type must be one of: bug, feature_request, ux_feedback, general',
      });
    }

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

    // Validate severity if provided
    const validSeverities = ['critical', 'high', 'medium', 'low'];
    const safeSeverity = severity && validSeverities.includes(severity) ? severity : 'medium';

    // Validate platform if provided
    const validPlatforms = ['ios', 'android', 'web'];
    const safePlatform = platform && validPlatforms.includes(platform) ? platform : null;

    const result = await query(
      `INSERT INTO beta_feedback
         (user_id, type, title, description, severity, app_version, platform, device_info, screenshot_urls, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, user_id, type, title, description, severity, status, app_version,
                 platform, device_info, screenshot_urls, metadata, created_at`,
      [
        userId,
        type.trim(),
        title.trim(),
        description.trim(),
        safeSeverity,
        app_version || null,
        safePlatform,
        device_info ? JSON.stringify(device_info) : '{}',
        screenshot_urls || null,
        metadata ? JSON.stringify(metadata) : '{}',
      ],
    );

    const feedback = result.rows[0];

    return res.status(201).json({
      feedback: {
        id: feedback.id,
        userId: feedback.user_id,
        type: feedback.type,
        title: feedback.title,
        description: feedback.description,
        severity: feedback.severity,
        status: feedback.status,
        appVersion: feedback.app_version,
        platform: feedback.platform,
        deviceInfo: feedback.device_info,
        screenshotUrls: feedback.screenshot_urls,
        metadata: feedback.metadata,
        createdAt: feedback.created_at,
      },
    });
  } catch (err) {
    console.error('[feedback] POST / error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred while submitting feedback',
    });
  }
});

// ---------------------------------------------------------------------------
// GET / — Get current user's feedback submissions (paginated)
// ---------------------------------------------------------------------------
router.get('/', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;

    const countResult = await query(
      `SELECT COUNT(*) AS total FROM beta_feedback WHERE user_id = $1`,
      [userId],
    );
    const total = parseInt(countResult.rows[0].total, 10);

    const result = await query(
      `SELECT id, user_id, type, title, description, severity, status,
              app_version, platform, device_info, screenshot_urls, metadata,
              admin_notes, resolved_at, created_at, updated_at
       FROM beta_feedback
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset],
    );

    const feedback = result.rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      type: row.type,
      title: row.title,
      description: row.description,
      severity: row.severity,
      status: row.status,
      appVersion: row.app_version,
      platform: row.platform,
      deviceInfo: row.device_info,
      screenshotUrls: row.screenshot_urls,
      metadata: row.metadata,
      adminNotes: row.admin_notes,
      resolvedAt: row.resolved_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return res.status(200).json({
      feedback,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error('[feedback] GET / error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred while fetching feedback',
    });
  }
});

// ---------------------------------------------------------------------------
// GET /stats — Public aggregate stats (transparency)
// ---------------------------------------------------------------------------
router.get('/stats', async (req, res) => {
  try {
    const totalResult = await query(`SELECT COUNT(*) AS total FROM beta_feedback`);

    const byTypeResult = await query(
      `SELECT type, COUNT(*) AS count FROM beta_feedback GROUP BY type ORDER BY count DESC`,
    );

    const byStatusResult = await query(
      `SELECT status, COUNT(*) AS count FROM beta_feedback GROUP BY status ORDER BY count DESC`,
    );

    const bySeverityResult = await query(
      `SELECT severity, COUNT(*) AS count FROM beta_feedback GROUP BY severity ORDER BY count DESC`,
    );

    const total = parseInt(totalResult.rows[0].total, 10);

    const byType = {};
    byTypeResult.rows.forEach((row) => {
      byType[row.type] = parseInt(row.count, 10);
    });

    const byStatus = {};
    byStatusResult.rows.forEach((row) => {
      byStatus[row.status] = parseInt(row.count, 10);
    });

    const bySeverity = {};
    bySeverityResult.rows.forEach((row) => {
      bySeverity[row.severity] = parseInt(row.count, 10);
    });

    return res.status(200).json({
      stats: {
        total,
        byType,
        byStatus,
        bySeverity,
      },
    });
  } catch (err) {
    console.error('[feedback] GET /stats error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred while fetching feedback stats',
    });
  }
});

// ---------------------------------------------------------------------------
// GET /admin — Admin-only: get ALL feedback with filtering (paginated)
// ---------------------------------------------------------------------------
router.get('/admin', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Only admins can access this endpoint',
      });
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;

    // Build dynamic WHERE clauses for filtering
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (req.query.type) {
      conditions.push(`type = $${paramIndex}`);
      params.push(req.query.type);
      paramIndex++;
    }

    if (req.query.status) {
      conditions.push(`status = $${paramIndex}`);
      params.push(req.query.status);
      paramIndex++;
    }

    if (req.query.severity) {
      conditions.push(`severity = $${paramIndex}`);
      params.push(req.query.severity);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await query(
      `SELECT COUNT(*) AS total FROM beta_feedback ${whereClause}`,
      params,
    );
    const total = parseInt(countResult.rows[0].total, 10);

    const dataParams = [...params, limit, offset];
    const result = await query(
      `SELECT bf.id, bf.user_id, bf.type, bf.title, bf.description, bf.severity,
              bf.status, bf.app_version, bf.platform, bf.device_info,
              bf.screenshot_urls, bf.metadata, bf.admin_notes,
              bf.resolved_at, bf.created_at, bf.updated_at,
              u.first_name, u.last_name, u.email
       FROM beta_feedback bf
       JOIN users u ON u.id = bf.user_id
       ${whereClause}
       ORDER BY bf.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      dataParams,
    );

    const feedback = result.rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      userName: `${row.first_name} ${row.last_name}`,
      userEmail: row.email,
      type: row.type,
      title: row.title,
      description: row.description,
      severity: row.severity,
      status: row.status,
      appVersion: row.app_version,
      platform: row.platform,
      deviceInfo: row.device_info,
      screenshotUrls: row.screenshot_urls,
      metadata: row.metadata,
      adminNotes: row.admin_notes,
      resolvedAt: row.resolved_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return res.status(200).json({
      feedback,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error('[feedback] GET /admin error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred while fetching feedback',
    });
  }
});

// ---------------------------------------------------------------------------
// PATCH /:id — Admin-only: update feedback status and admin_notes
// ---------------------------------------------------------------------------
router.patch('/:id', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Only admins can update feedback',
      });
    }

    const { id } = req.params;
    const { status, admin_notes } = req.body;

    // Verify the feedback exists
    const existing = await query(
      `SELECT id, status FROM beta_feedback WHERE id = $1`,
      [id],
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Feedback not found',
      });
    }

    // Build dynamic SET clause
    const setClauses = [];
    const params = [];
    let paramIndex = 1;

    if (status) {
      const validStatuses = ['new', 'acknowledged', 'in_progress', 'resolved', 'wont_fix'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          error: 'Validation failed',
          message: 'Status must be one of: new, acknowledged, in_progress, resolved, wont_fix',
        });
      }
      setClauses.push(`status = $${paramIndex}`);
      params.push(status);
      paramIndex++;

      // Auto-set resolved_at when status becomes resolved
      if (status === 'resolved' || status === 'wont_fix') {
        setClauses.push(`resolved_at = NOW()`);
      } else {
        setClauses.push(`resolved_at = NULL`);
      }
    }

    if (admin_notes !== undefined) {
      setClauses.push(`admin_notes = $${paramIndex}`);
      params.push(admin_notes);
      paramIndex++;
    }

    if (setClauses.length === 0) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'At least one of status or admin_notes must be provided',
      });
    }

    params.push(id);

    const result = await query(
      `UPDATE beta_feedback
       SET ${setClauses.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING id, user_id, type, title, description, severity, status,
                 app_version, platform, device_info, screenshot_urls, metadata,
                 admin_notes, resolved_at, created_at, updated_at`,
      params,
    );

    const feedback = result.rows[0];

    return res.status(200).json({
      feedback: {
        id: feedback.id,
        userId: feedback.user_id,
        type: feedback.type,
        title: feedback.title,
        description: feedback.description,
        severity: feedback.severity,
        status: feedback.status,
        appVersion: feedback.app_version,
        platform: feedback.platform,
        deviceInfo: feedback.device_info,
        screenshotUrls: feedback.screenshot_urls,
        metadata: feedback.metadata,
        adminNotes: feedback.admin_notes,
        resolvedAt: feedback.resolved_at,
        createdAt: feedback.created_at,
        updatedAt: feedback.updated_at,
      },
    });
  } catch (err) {
    console.error('[feedback] PATCH /:id error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred while updating feedback',
    });
  }
});

// ---------------------------------------------------------------------------
// POST /:id/vote — Authenticated users can upvote feature requests
// ---------------------------------------------------------------------------
router.post('/:id/vote', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Fetch the feedback
    const existing = await query(
      `SELECT id, type, metadata FROM beta_feedback WHERE id = $1`,
      [id],
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Feedback not found',
      });
    }

    const feedback = existing.rows[0];

    if (feedback.type !== 'feature_request') {
      return res.status(400).json({
        error: 'Bad request',
        message: 'Only feature requests can be voted on',
      });
    }

    // Check for duplicate vote
    const meta = feedback.metadata || {};
    const votes = Array.isArray(meta.votes) ? meta.votes : [];

    if (votes.includes(userId)) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'You have already voted on this feature request',
      });
    }

    // Add the vote
    votes.push(userId);
    meta.votes = votes;
    meta.voteCount = votes.length;

    const result = await query(
      `UPDATE beta_feedback
       SET metadata = $1
       WHERE id = $2
       RETURNING id, type, title, metadata`,
      [JSON.stringify(meta), id],
    );

    const updated = result.rows[0];

    return res.status(200).json({
      feedback: {
        id: updated.id,
        type: updated.type,
        title: updated.title,
        voteCount: updated.metadata.voteCount || 0,
        hasVoted: true,
      },
    });
  } catch (err) {
    console.error('[feedback] POST /:id/vote error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred while voting',
    });
  }
});

export default router;
