import { Router } from 'express';
import { query } from '../config/database.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// All support routes require authentication
router.use(authenticate);

// ---------------------------------------------------------------------------
// POST /tickets — Create a support ticket
// ---------------------------------------------------------------------------
router.post('/tickets', async (req, res) => {
  try {
    const userId = req.user.id;
    const { category, subject, description, rideId } = req.body;

    // Validate required fields
    if (!category || typeof category !== 'string' || category.trim().length === 0) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Category is required',
      });
    }

    if (!subject || typeof subject !== 'string' || subject.trim().length === 0) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Subject is required',
      });
    }

    if (!description || typeof description !== 'string' || description.trim().length === 0) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Description is required',
      });
    }

    // If rideId is provided, verify the ride exists and user is involved
    if (rideId) {
      const rideResult = await query(
        `SELECT id FROM rides
         WHERE id = $1 AND (passenger_id = $2 OR driver_id = $2)`,
        [rideId, userId],
      );

      if (rideResult.rows.length === 0) {
        return res.status(404).json({
          error: 'Not found',
          message: 'Ride not found or you are not associated with this ride',
        });
      }
    }

    const result = await query(
      `INSERT INTO support_tickets (user_id, ride_id, category, subject, description)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, user_id, ride_id, category, subject, description, status, created_at`,
      [userId, rideId || null, category.trim(), subject.trim(), description.trim()],
    );

    const ticket = result.rows[0];

    return res.status(201).json({
      ticket: {
        id: ticket.id,
        userId: ticket.user_id,
        rideId: ticket.ride_id,
        category: ticket.category,
        subject: ticket.subject,
        description: ticket.description,
        status: ticket.status,
        createdAt: ticket.created_at,
      },
    });
  } catch (err) {
    console.error('[support] POST /tickets error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred while creating the support ticket',
    });
  }
});

// ---------------------------------------------------------------------------
// GET /tickets — Get current user's support tickets
// ---------------------------------------------------------------------------
router.get('/tickets', async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await query(
      `SELECT st.id, st.ride_id, st.category, st.subject, st.description,
              st.status, st.assigned_to, st.resolved_at, st.created_at
       FROM support_tickets st
       WHERE st.user_id = $1
       ORDER BY st.created_at DESC`,
      [userId],
    );

    const tickets = result.rows.map((row) => ({
      id: row.id,
      rideId: row.ride_id,
      category: row.category,
      subject: row.subject,
      description: row.description,
      status: row.status,
      assignedTo: row.assigned_to,
      resolvedAt: row.resolved_at,
      createdAt: row.created_at,
    }));

    return res.status(200).json({ tickets });
  } catch (err) {
    console.error('[support] GET /tickets error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred while fetching support tickets',
    });
  }
});

// ---------------------------------------------------------------------------
// GET /tickets/:id — Get a single ticket with all messages
// ---------------------------------------------------------------------------
router.get('/tickets/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Fetch the ticket — allow the owner or an admin (role check via user table)
    const ticketResult = await query(
      `SELECT st.id, st.user_id, st.ride_id, st.category, st.subject,
              st.description, st.status, st.assigned_to, st.resolved_at,
              st.created_at
       FROM support_tickets st
       WHERE st.id = $1`,
      [id],
    );

    if (ticketResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Support ticket not found',
      });
    }

    const ticket = ticketResult.rows[0];

    // Verify ownership or admin role
    if (ticket.user_id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to view this ticket',
      });
    }

    // Fetch all messages for this ticket
    const messagesResult = await query(
      `SELECT sm.id, sm.sender_id, sm.message, sm.is_internal, sm.created_at,
              u.first_name AS sender_first_name,
              u.last_name AS sender_last_name
       FROM support_messages sm
       JOIN users u ON u.id = sm.sender_id
       WHERE sm.ticket_id = $1
       ORDER BY sm.created_at ASC`,
      [id],
    );

    const messages = messagesResult.rows
      // Hide internal messages from non-admin users
      .filter((row) => !row.is_internal || req.user.role === 'admin')
      .map((row) => ({
        id: row.id,
        senderId: row.sender_id,
        senderName: `${row.sender_first_name} ${row.sender_last_name}`,
        message: row.message,
        isInternal: row.is_internal,
        createdAt: row.created_at,
      }));

    return res.status(200).json({
      ticket: {
        id: ticket.id,
        userId: ticket.user_id,
        rideId: ticket.ride_id,
        category: ticket.category,
        subject: ticket.subject,
        description: ticket.description,
        status: ticket.status,
        assignedTo: ticket.assigned_to,
        resolvedAt: ticket.resolved_at,
        createdAt: ticket.created_at,
      },
      messages,
    });
  } catch (err) {
    console.error('[support] GET /tickets/:id error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred while fetching the support ticket',
    });
  }
});

// ---------------------------------------------------------------------------
// POST /tickets/:id/messages — Add a message to a ticket
// ---------------------------------------------------------------------------
router.post('/tickets/:id/messages', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { message } = req.body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Message is required',
      });
    }

    // Verify the ticket exists and user is the owner
    const ticketResult = await query(
      `SELECT id, user_id, status FROM support_tickets WHERE id = $1`,
      [id],
    );

    if (ticketResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Support ticket not found',
      });
    }

    const ticket = ticketResult.rows[0];

    if (ticket.user_id !== userId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You can only add messages to your own tickets',
      });
    }

    if (ticket.status === 'closed') {
      return res.status(400).json({
        error: 'Bad request',
        message: 'Cannot add messages to a closed ticket',
      });
    }

    const result = await query(
      `INSERT INTO support_messages (ticket_id, sender_id, message)
       VALUES ($1, $2, $3)
       RETURNING id, ticket_id, sender_id, message, is_internal, created_at`,
      [id, userId, message.trim()],
    );

    const msg = result.rows[0];

    return res.status(201).json({
      message: {
        id: msg.id,
        ticketId: msg.ticket_id,
        senderId: msg.sender_id,
        message: msg.message,
        isInternal: msg.is_internal,
        createdAt: msg.created_at,
      },
    });
  } catch (err) {
    console.error('[support] POST /tickets/:id/messages error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred while adding the message',
    });
  }
});

// ---------------------------------------------------------------------------
// PUT /tickets/:id/close — Close a support ticket
// ---------------------------------------------------------------------------
router.put('/tickets/:id/close', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Verify the ticket exists and user is the owner
    const ticketResult = await query(
      `SELECT id, user_id, status FROM support_tickets WHERE id = $1`,
      [id],
    );

    if (ticketResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Support ticket not found',
      });
    }

    const ticket = ticketResult.rows[0];

    if (ticket.user_id !== userId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You can only close your own tickets',
      });
    }

    if (ticket.status === 'closed') {
      return res.status(400).json({
        error: 'Bad request',
        message: 'This ticket is already closed',
      });
    }

    const result = await query(
      `UPDATE support_tickets
       SET status = 'closed', resolved_at = NOW()
       WHERE id = $1
       RETURNING id, user_id, ride_id, category, subject, description,
                 status, assigned_to, resolved_at, created_at`,
      [id],
    );

    const updated = result.rows[0];

    return res.status(200).json({
      ticket: {
        id: updated.id,
        userId: updated.user_id,
        rideId: updated.ride_id,
        category: updated.category,
        subject: updated.subject,
        description: updated.description,
        status: updated.status,
        assignedTo: updated.assigned_to,
        resolvedAt: updated.resolved_at,
        createdAt: updated.created_at,
      },
    });
  } catch (err) {
    console.error('[support] PUT /tickets/:id/close error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred while closing the ticket',
    });
  }
});

export default router;
