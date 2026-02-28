import cron from 'node-cron';
import { query } from '../config/database.js';
import { finalizeExpiredProposals } from '../services/governance.js';
import { expireModeratorTerms } from '../services/moderation.js';
import { executeAllPending } from '../services/proposalExecution.js';

/**
 * Start all scheduled background jobs
 */
export function startScheduler() {
  console.log('[Scheduler] Starting background jobs...');

  // Check for expired governance proposals every hour, then auto-execute passed ones
  cron.schedule('0 * * * *', async () => {
    try {
      const results = await finalizeExpiredProposals();
      if (results.length > 0) {
        console.log(`[Scheduler] Finalized ${results.length} expired proposals:`,
          results.map(r => `${r.title} → ${r.outcome}`).join(', '));
      }
      // Auto-execute any newly passed proposals
      const executed = await executeAllPending();
      if (executed.length > 0) {
        console.log(`[Scheduler] Auto-executed ${executed.length} passed proposals`);
      }
    } catch (error) {
      console.error('[Scheduler] Proposal finalization failed:', error.message);
    }
  });

  // Check for expiring driver documents daily at 9am
  cron.schedule('0 9 * * *', async () => {
    try {
      // Find documents expiring in 30, 14, or 7 days
      const expiringResult = await query(
        `SELECT dd.*, dp.user_id, u.email, u.first_name
         FROM driver_documents dd
         JOIN driver_profiles dp ON dd.driver_id = dp.id
         JOIN users u ON dp.user_id = u.id
         WHERE dd.status = 'approved'
         AND dd.expires_at IS NOT NULL
         AND dd.expires_at IN (
           CURRENT_DATE + INTERVAL '30 days',
           CURRENT_DATE + INTERVAL '14 days',
           CURRENT_DATE + INTERVAL '7 days'
         )`
      );

      for (const doc of expiringResult.rows) {
        const daysLeft = Math.ceil((new Date(doc.expires_at) - new Date()) / (1000 * 60 * 60 * 24));
        console.log(`[Scheduler] Document expiry warning: ${doc.first_name} - ${doc.document_type} expires in ${daysLeft} days`);
        // TODO: Send notification email/push to driver
      }

      // Disable drivers with expired documents
      const expiredResult = await query(
        `UPDATE driver_profiles dp
         SET documents_verified = false
         FROM driver_documents dd
         WHERE dd.driver_id = dp.id
         AND dd.status = 'approved'
         AND dd.expires_at < CURRENT_DATE
         AND dp.documents_verified = true
         RETURNING dp.user_id`
      );

      if (expiredResult.rows.length > 0) {
        console.log(`[Scheduler] Disabled ${expiredResult.rows.length} drivers with expired documents`);
      }
    } catch (error) {
      console.error('[Scheduler] Document expiry check failed:', error.message);
    }
  });

  // Clean up expired refresh tokens daily at 3am
  cron.schedule('0 3 * * *', async () => {
    try {
      const result = await query(
        'DELETE FROM refresh_tokens WHERE expires_at < NOW()'
      );
      if (result.rowCount > 0) {
        console.log(`[Scheduler] Cleaned up ${result.rowCount} expired refresh tokens`);
      }
    } catch (error) {
      console.error('[Scheduler] Token cleanup failed:', error.message);
    }
  });

  // Clean up expired trip shares daily
  cron.schedule('0 4 * * *', async () => {
    try {
      const result = await query(
        'DELETE FROM trip_shares WHERE expires_at < NOW()'
      );
      if (result.rowCount > 0) {
        console.log(`[Scheduler] Cleaned up ${result.rowCount} expired trip shares`);
      }
    } catch (error) {
      console.error('[Scheduler] Trip share cleanup failed:', error.message);
    }
  });

  // Auto-cancel stale ride requests (older than 10 minutes without a match)
  cron.schedule('*/5 * * * *', async () => {
    try {
      const result = await query(
        `UPDATE rides
         SET status = 'cancelled', cancelled_at = NOW(), cancellation_reason = 'No driver available'
         WHERE status = 'requested'
         AND requested_at < NOW() - INTERVAL '10 minutes'
         RETURNING id, passenger_id`
      );

      if (result.rows.length > 0) {
        console.log(`[Scheduler] Auto-cancelled ${result.rows.length} stale ride requests`);
      }
    } catch (error) {
      console.error('[Scheduler] Stale ride cleanup failed:', error.message);
    }
  });

  // Transition moderator elections from nominations to voting phase every hour
  cron.schedule('30 * * * *', async () => {
    try {
      const result = await query(
        `UPDATE moderator_elections
         SET status = 'voting'
         WHERE status = 'nominations'
           AND nominations_end <= NOW()
         RETURNING id, title`
      );

      if (result.rows.length > 0) {
        console.log(
          `[Scheduler] Transitioned ${result.rows.length} election(s) to voting phase:`,
          result.rows.map((r) => r.title).join(', ')
        );
      }
    } catch (error) {
      console.error('[Scheduler] Election phase transition failed:', error.message);
    }
  });

  // Expire moderator terms daily at 1am
  cron.schedule('0 1 * * *', async () => {
    try {
      const count = await expireModeratorTerms();
      if (count > 0) {
        console.log(`[Scheduler] Expired ${count} moderator term(s)`);
      }
    } catch (error) {
      console.error('[Scheduler] Moderator term expiry check failed:', error.message);
    }
  });

  console.log('[Scheduler] All background jobs registered');
}
