import { query } from '../config/database.js';
import { getIO } from '../sockets/index.js';
import * as platformConfig from './platformConfig.js';

// ---------------------------------------------------------------------------
// executeProposal
// ---------------------------------------------------------------------------

/**
 * Execute a single governance proposal that has passed voting.
 *
 * Structured proposals (those with a `config_key` and `proposed_value`) are
 * applied automatically by updating the corresponding platform configuration.
 * Unstructured / policy proposals are recorded as pending manual
 * implementation.
 *
 * @param {string|number} proposalId - The ID of the proposal to execute
 * @returns {Promise<{success: boolean, configKey?: string, oldValue?: *,
 *   newValue?: *, requiresManual?: boolean}>}
 * @throws {Error} If the proposal does not exist or has not passed
 */
export async function executeProposal(proposalId) {
  try {
    // Fetch the proposal and verify its status
    const proposalResult = await query(
      'SELECT * FROM governance_proposals WHERE id = $1',
      [proposalId]
    );

    if (proposalResult.rows.length === 0) {
      throw new Error(`Proposal ${proposalId} not found`);
    }

    const proposal = proposalResult.rows[0];

    if (proposal.status !== 'passed') {
      throw new Error(
        `Proposal ${proposalId} cannot be executed: current status is "${proposal.status}", expected "passed"`
      );
    }

    const configKey = proposal.config_key;
    const proposedValue = proposal.proposed_value;

    // ------- Structured proposal (targets a config parameter) -------
    if (configKey && proposedValue !== undefined && proposedValue !== null) {
      // Read current value before mutation
      const currentValue = await platformConfig.getConfig(configKey);

      // Apply the change through the config service (validates
      // governability, updates DB, invalidates cache)
      const updateResult = await platformConfig.updateConfig(
        configKey,
        proposedValue,
        'governance'
      );

      // Record the execution
      await query(
        `INSERT INTO proposal_executions
           (proposal_id, config_key, old_value, new_value, status, executed_at)
         VALUES ($1, $2, $3, $4, 'executed', NOW())`,
        [
          proposalId,
          configKey,
          currentValue !== null && currentValue !== undefined ? String(currentValue) : null,
          String(proposedValue),
        ]
      );

      // Mark the proposal as implemented
      await query(
        "UPDATE governance_proposals SET status = 'implemented' WHERE id = $1",
        [proposalId]
      );

      // Broadcast a real-time event to all connected clients
      const io = getIO();
      if (io) {
        io.emit('governance:implemented', {
          proposalId: proposal.id,
          title: proposal.title,
          configKey,
          oldValue: updateResult.oldValue,
          newValue: updateResult.newValue,
        });
      }

      return {
        success: true,
        configKey,
        oldValue: updateResult.oldValue,
        newValue: updateResult.newValue,
      };
    }

    // ------- Unstructured / policy proposal (no config_key) -------
    await query(
      `INSERT INTO proposal_executions
         (proposal_id, status, executed_at)
       VALUES ($1, 'pending', NOW())`,
      [proposalId]
    );

    return { success: true, requiresManual: true };
  } catch (err) {
    console.error('[proposalExecution] Error executing proposal:', proposalId, err.message);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// executeAllPending
// ---------------------------------------------------------------------------

/**
 * Find every proposal that has passed voting but has not yet been executed
 * and attempt to execute each one.
 *
 * @returns {Promise<Array<{proposalId: *, result?: object, error?: string}>>}
 *   An array of result objects, one per proposal.
 */
export async function executeAllPending() {
  try {
    const pendingResult = await query(
      `SELECT id FROM governance_proposals
       WHERE status = 'passed'
         AND id NOT IN (SELECT proposal_id FROM proposal_executions)`
    );

    const results = [];

    for (const row of pendingResult.rows) {
      try {
        const result = await executeProposal(row.id);
        results.push({ proposalId: row.id, result });
      } catch (err) {
        console.error(
          '[proposalExecution] Failed to execute proposal:',
          row.id,
          err.message
        );
        results.push({ proposalId: row.id, error: err.message });
      }
    }

    return results;
  } catch (err) {
    console.error('[proposalExecution] Error executing all pending:', err.message);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// rollbackExecution
// ---------------------------------------------------------------------------

/**
 * Roll back a previously executed config change, restoring the old value
 * and resetting the proposal back to "passed" status.
 *
 * @param {string|number} executionId - The ID of the execution record
 * @returns {Promise<{success: boolean, configKey: string, restoredValue: *}>}
 * @throws {Error} If the execution record does not exist or has no
 *   old_value to restore
 */
export async function rollbackExecution(executionId) {
  try {
    // Fetch the execution record
    const execResult = await query(
      'SELECT * FROM proposal_executions WHERE id = $1',
      [executionId]
    );

    if (execResult.rows.length === 0) {
      throw new Error(`Execution record ${executionId} not found`);
    }

    const execution = execResult.rows[0];

    if (execution.status === 'rolled_back') {
      throw new Error(`Execution ${executionId} has already been rolled back`);
    }

    if (!execution.config_key || execution.old_value === null || execution.old_value === undefined) {
      throw new Error(
        `Execution ${executionId} has no config_key or old_value to restore`
      );
    }

    // Restore the previous value through the config service
    await platformConfig.updateConfig(
      execution.config_key,
      execution.old_value,
      'governance_rollback'
    );

    // Mark the execution as rolled back
    await query(
      "UPDATE proposal_executions SET status = 'rolled_back' WHERE id = $1",
      [executionId]
    );

    // Reset the parent proposal back to "passed" so it can be re-executed
    // or reconsidered
    await query(
      "UPDATE governance_proposals SET status = 'passed' WHERE id = $1",
      [execution.proposal_id]
    );

    return {
      success: true,
      configKey: execution.config_key,
      restoredValue: execution.old_value,
    };
  } catch (err) {
    console.error('[proposalExecution] Error rolling back execution:', executionId, err.message);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// getExecutionHistory
// ---------------------------------------------------------------------------

/**
 * Retrieve proposal execution history, optionally scoped to a single
 * proposal.  Results are joined with governance_proposals to include the
 * proposal title and ordered most-recent first.
 *
 * @param {string|number|null} [proposalId=null] - If provided, only return
 *   executions for this proposal.
 * @returns {Promise<Array<{id: *, proposalId: *, proposalTitle: string,
 *   configKey: string|null, oldValue: string|null, newValue: string|null,
 *   status: string, executedAt: Date}>>}
 */
export async function getExecutionHistory(proposalId = null) {
  try {
    let result;

    if (proposalId) {
      result = await query(
        `SELECT pe.id,
                pe.proposal_id,
                gp.title AS proposal_title,
                pe.config_key,
                pe.old_value,
                pe.new_value,
                pe.status,
                pe.executed_at
         FROM proposal_executions pe
         JOIN governance_proposals gp ON gp.id = pe.proposal_id
         WHERE pe.proposal_id = $1
         ORDER BY pe.executed_at DESC`,
        [proposalId]
      );
    } else {
      result = await query(
        `SELECT pe.id,
                pe.proposal_id,
                gp.title AS proposal_title,
                pe.config_key,
                pe.old_value,
                pe.new_value,
                pe.status,
                pe.executed_at
         FROM proposal_executions pe
         JOIN governance_proposals gp ON gp.id = pe.proposal_id
         ORDER BY pe.executed_at DESC`
      );
    }

    return result.rows.map((row) => ({
      id: row.id,
      proposalId: row.proposal_id,
      proposalTitle: row.proposal_title,
      configKey: row.config_key,
      oldValue: row.old_value,
      newValue: row.new_value,
      status: row.status,
      executedAt: row.executed_at,
    }));
  } catch (err) {
    console.error('[proposalExecution] Error fetching execution history:', err.message);
    throw err;
  }
}
