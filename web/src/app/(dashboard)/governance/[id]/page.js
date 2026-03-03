'use client';

import { useState, useEffect } from 'react';
import {
  fetchAPI,
  formatNumber,
  formatCurrency,
  formatDate,
  formatDateTime,
  timeRemaining,
  isAuthenticated,
  getToken,
} from '../../../../lib/api';

const CATEGORY_COLORS = {
  fee_structure: 'badge-blue',
  safety: 'badge-red',
  compensation: 'badge-green',
  platform_rules: 'badge-purple',
  feature_request: 'badge-yellow',
  policy: 'badge-blue',
  operational: 'badge-gray',
  default: 'badge-gray',
};

export default function ProposalDetailPage({ params }) {
  const { id } = params;
  const [proposal, setProposal] = useState(null);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [votingAs, setVotingAs] = useState(null);
  const [voteSubmitted, setVoteSubmitted] = useState(false);
  const [voteError, setVoteError] = useState(null);

  useEffect(() => {
    loadProposal();
    loadComments();
  }, [id]);

  async function loadProposal() {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchAPI(`/governance/proposals/${id}`);
      setProposal(data?.proposal ?? data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadComments() {
    try {
      const data = await fetchAPI(`/governance/proposals/${id}/comments`);
      setComments(
        Array.isArray(data) ? data : data?.comments ?? data?.data ?? []
      );
    } catch {
      // Comments endpoint may not exist
      setComments([]);
    }
  }

  async function submitComment(e) {
    e.preventDefault();
    if (!commentText.trim()) return;
    try {
      setSubmittingComment(true);
      await fetchAPI(`/governance/proposals/${id}/comments`, {
        method: 'POST',
        body: JSON.stringify({ content: commentText.trim() }),
      });
      setCommentText('');
      await loadComments();
    } catch (err) {
      alert('Failed to submit comment: ' + err.message);
    } finally {
      setSubmittingComment(false);
    }
  }

  async function submitVote(voteType) {
    try {
      setVotingAs(voteType);
      setVoteError(null);
      await fetchAPI(`/governance/proposals/${id}/vote`, {
        method: 'POST',
        body: JSON.stringify({ vote: voteType }),
      });
      setVoteSubmitted(true);
      await loadProposal();
    } catch (err) {
      setVoteError(err.message);
    } finally {
      setVotingAs(null);
    }
  }

  function getVal(snakeKey, camelKey, fallback = 0) {
    if (!proposal) return fallback;
    return proposal[snakeKey] ?? proposal[camelKey] ?? fallback;
  }

  if (loading) {
    return (
      <div className="page-container">
        <div className="loading-container">
          <div className="spinner" />
          <p>Loading proposal...</p>
        </div>
      </div>
    );
  }

  if (error || !proposal) {
    return (
      <div className="page-container">
        <div className="error-message">
          <p>Failed to load proposal: {error ?? 'Not found'}</p>
          <a href="/governance" className="btn btn-primary">
            Back to Governance
          </a>
        </div>
      </div>
    );
  }

  const votesFor = getVal('votes_for', 'votesFor');
  const votesAgainst = getVal('votes_against', 'votesAgainst');
  const votesAbstain = getVal('votes_abstain', 'votesAbstain');
  const totalVotes = votesFor + votesAgainst + votesAbstain;
  const forPct = totalVotes > 0 ? ((votesFor / totalVotes) * 100).toFixed(1) : 0;
  const againstPct = totalVotes > 0 ? ((votesAgainst / totalVotes) * 100).toFixed(1) : 0;
  const abstainPct = totalVotes > 0 ? ((votesAbstain / totalVotes) * 100).toFixed(1) : 0;

  const configKey = proposal.config_key ?? proposal.configKey ?? null;
  const currentValue = proposal.current_value ?? proposal.currentValue ?? null;
  const proposedValue = proposal.proposed_value ?? proposal.proposedValue ?? null;

  const status = proposal.status ?? 'active';
  const endDate =
    proposal.voting_ends_at ?? proposal.votingEndsAt ?? proposal.end_date ?? null;
  const category = proposal.category ?? 'general';
  const categoryClass = CATEGORY_COLORS[category] ?? CATEGORY_COLORS.default;
  const categoryLabel = (category ?? 'general')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

  const quorumReached = proposal.quorum_reached ?? proposal.quorumReached ?? null;
  const quorumRequired = proposal.quorum_required ?? proposal.quorumRequired ?? proposal.quorum ?? 0;
  const quorumPct =
    quorumRequired > 0
      ? Math.min(Math.round((totalVotes / quorumRequired) * 100), 100)
      : 100;

  const isActive = status === 'active' || status === 'voting';
  const implementedAt =
    proposal.implemented_at ?? proposal.implementedAt ?? null;
  const executionResult =
    proposal.execution_result ?? proposal.executionResult ?? null;

  return (
    <div className="page-container">
      {/* Breadcrumb */}
      <div className="mb-24">
        <a href="/governance" style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
          &larr; Back to Governance
        </a>
      </div>

      {/* Header */}
      <div className="page-header">
        <div className="flex gap-12 mb-8" style={{ alignItems: 'center' }}>
          <span className={`badge ${categoryClass}`}>{categoryLabel}</span>
          <span
            className={`badge ${
              status === 'active' || status === 'voting'
                ? 'badge-blue'
                : status === 'passed' || status === 'implemented'
                ? 'badge-green'
                : status === 'rejected'
                ? 'badge-red'
                : 'badge-gray'
            }`}
          >
            {status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
          </span>
        </div>
        <h1>{proposal.title}</h1>
      </div>

      {/* Metadata */}
      <div className="card mb-24">
        <div className="card-body">
          <div className="detail-grid">
            <dt>Author</dt>
            <dd>
              {proposal.author_name ??
                proposal.authorName ??
                proposal.author ??
                'Anonymous'}
            </dd>
            <dt>Category</dt>
            <dd>{categoryLabel}</dd>
            <dt>Created</dt>
            <dd>
              {formatDateTime(
                proposal.created_at ?? proposal.createdAt ?? null
              )}
            </dd>
            <dt>Voting Ends</dt>
            <dd>
              {endDate
                ? `${formatDateTime(endDate)} (${timeRemaining(endDate)})`
                : 'N/A'}
            </dd>
            <dt>Status</dt>
            <dd>
              {status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
            </dd>
          </div>
        </div>
      </div>

      {/* Config Change (if structured) */}
      {configKey && (
        <div className="detail-section">
          <h2>Proposed Configuration Change</h2>
          <div className="config-change-box">
            <div className="config-change-value" style={{ flex: 1 }}>
              <div className="label">Current Value</div>
              <div className="value" style={{ color: 'var(--text-secondary)' }}>
                {currentValue ?? '—'}
              </div>
              <div className="text-sm text-muted mt-8 font-mono">{configKey}</div>
            </div>
            <div className="config-change-arrow">&rarr;</div>
            <div className="config-change-value" style={{ flex: 1 }}>
              <div className="label">Proposed Value</div>
              <div className="value" style={{ color: 'var(--primary)' }}>
                {proposedValue ?? '—'}
              </div>
              <div className="text-sm text-muted mt-8 font-mono">{configKey}</div>
            </div>
          </div>
        </div>
      )}

      {/* Description */}
      <div className="detail-section">
        <h2>Description</h2>
        <div className="card">
          <div className="card-body">
            <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
              {proposal.description ?? proposal.body ?? 'No description provided.'}
            </div>
          </div>
        </div>
      </div>

      {/* Voting Section */}
      <div className="detail-section">
        <h2>Vote Results</h2>
        <div className="card">
          <div className="card-body">
            {/* Vote Bar */}
            <div className="mb-16">
              <div className="vote-bar" style={{ height: 14 }}>
                <div
                  className="vote-bar-for"
                  style={{ width: `${forPct}%` }}
                />
                <div
                  className="vote-bar-against"
                  style={{ width: `${againstPct}%` }}
                />
              </div>
            </div>

            {/* Vote Breakdown */}
            <div className="grid-3 mb-24">
              <div style={{ textAlign: 'center' }}>
                <div
                  style={{
                    fontSize: 28,
                    fontWeight: 700,
                    color: 'var(--primary)',
                  }}
                >
                  {formatNumber(votesFor)}
                </div>
                <div className="text-sm text-muted">For ({forPct}%)</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div
                  style={{
                    fontSize: 28,
                    fontWeight: 700,
                    color: 'var(--danger)',
                  }}
                >
                  {formatNumber(votesAgainst)}
                </div>
                <div className="text-sm text-muted">Against ({againstPct}%)</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div
                  style={{
                    fontSize: 28,
                    fontWeight: 700,
                    color: 'var(--text-muted)',
                  }}
                >
                  {formatNumber(votesAbstain)}
                </div>
                <div className="text-sm text-muted">Abstain ({abstainPct}%)</div>
              </div>
            </div>

            {/* Quorum */}
            <div className="mb-24">
              <div className="flex-between mb-8">
                <span className="text-sm" style={{ fontWeight: 600 }}>
                  Quorum Progress
                </span>
                <span className="text-sm text-muted">
                  {totalVotes} / {quorumRequired || '?'} votes ({quorumPct}%)
                </span>
              </div>
              <div className="progress-bar">
                <div
                  className={`progress-bar-fill ${
                    quorumReached || quorumPct >= 100 ? 'green' : 'blue'
                  }`}
                  style={{ width: `${quorumPct}%` }}
                />
              </div>
              {(quorumReached || quorumPct >= 100) && (
                <div
                  className="text-sm mt-8"
                  style={{ color: 'var(--primary)', fontWeight: 600 }}
                >
                  Quorum has been reached
                </div>
              )}
            </div>

            {/* Vote Buttons (active only) */}
            {isActive && (
              <div>
                {voteSubmitted ? (
                  <div className="notice notice-success">
                    <span className="notice-icon">&#10003;</span>
                    <div>Your vote has been recorded. Thank you for participating in governance.</div>
                  </div>
                ) : isAuthenticated() ? (
                  <>
                    <div
                      className="text-sm mb-16"
                      style={{ fontWeight: 600, color: 'var(--text-secondary)' }}
                    >
                      Cast Your Vote
                    </div>
                    <div className="btn-group">
                      <button
                        className="btn btn-primary"
                        onClick={() => submitVote('for')}
                        disabled={votingAs !== null}
                      >
                        {votingAs === 'for' ? 'Submitting...' : 'Vote For'}
                      </button>
                      <button
                        className="btn btn-danger"
                        onClick={() => submitVote('against')}
                        disabled={votingAs !== null}
                      >
                        {votingAs === 'against'
                          ? 'Submitting...'
                          : 'Vote Against'}
                      </button>
                      <button
                        className="btn btn-secondary"
                        onClick={() => submitVote('abstain')}
                        disabled={votingAs !== null}
                      >
                        {votingAs === 'abstain' ? 'Submitting...' : 'Abstain'}
                      </button>
                    </div>
                    {voteError && (
                      <div className="notice notice-danger mt-16">
                        <span className="notice-icon">!</span>
                        <div>{voteError}</div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="notice notice-info">
                    <span className="notice-icon">&#9432;</span>
                    <div>
                      You must be logged in to vote. Please authenticate through
                      the mobile app or API.
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Outcome (if not active) */}
      {!isActive && (
        <div className="detail-section">
          <h2>Outcome</h2>
          <div className="card">
            <div className="card-body">
              <div
                className={`notice ${
                  status === 'passed' || status === 'implemented'
                    ? 'notice-success'
                    : 'notice-danger'
                }`}
                style={{ marginBottom: 16 }}
              >
                <span className="notice-icon">
                  {status === 'passed' || status === 'implemented'
                    ? '\u2713'
                    : '\u2717'}
                </span>
                <div>
                  <strong>
                    This proposal was{' '}
                    {status === 'passed' || status === 'implemented'
                      ? 'approved'
                      : 'rejected'}
                  </strong>
                  {(quorumReached || quorumPct >= 100) && (
                    <span> with quorum met.</span>
                  )}
                </div>
              </div>

              {status === 'implemented' && (
                <div style={{ marginTop: 16 }}>
                  <div className="text-sm" style={{ fontWeight: 600 }}>
                    Implementation Details
                  </div>
                  {implementedAt && (
                    <p className="text-sm text-muted mt-8">
                      Implemented on {formatDateTime(implementedAt)}
                    </p>
                  )}
                  {executionResult && (
                    <div
                      className="font-mono text-sm mt-8"
                      style={{
                        background: '#f8f9fb',
                        padding: 12,
                        borderRadius: 8,
                        border: '1px solid var(--border)',
                      }}
                    >
                      {typeof executionResult === 'string'
                        ? executionResult
                        : JSON.stringify(executionResult, null, 2)}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Discussion */}
      <div className="detail-section">
        <h2>Discussion ({comments.length})</h2>
        {comments.length > 0 ? (
          <div className="comment-list mb-24">
            {comments.map((c, i) => (
              <div className="comment-item" key={c.id ?? i}>
                <div className="comment-item-header">
                  <span className="comment-item-author">
                    {c.author_name ?? c.authorName ?? c.author ?? 'User'}
                  </span>
                  <span className="comment-item-date">
                    {formatDateTime(c.created_at ?? c.createdAt)}
                  </span>
                </div>
                <div className="comment-item-body">
                  {c.content ?? c.body ?? c.text ?? ''}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="card mb-24">
            <div className="card-body">
              <p className="text-muted text-sm">
                No comments yet. Be the first to share your thoughts.
              </p>
            </div>
          </div>
        )}

        {/* Comment Form */}
        {isAuthenticated() ? (
          <div className="card">
            <div className="card-body">
              <form onSubmit={submitComment}>
                <div className="form-group" style={{ marginBottom: 12 }}>
                  <label className="form-label">Add a Comment</label>
                  <textarea
                    className="form-textarea"
                    placeholder="Share your thoughts on this proposal..."
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    rows={3}
                  />
                </div>
                <button
                  className="btn btn-primary btn-sm"
                  type="submit"
                  disabled={!commentText.trim() || submittingComment}
                >
                  {submittingComment ? 'Posting...' : 'Post Comment'}
                </button>
              </form>
            </div>
          </div>
        ) : (
          <div className="notice notice-info">
            <span className="notice-icon">&#9432;</span>
            <div>Log in to participate in the discussion.</div>
          </div>
        )}
      </div>
    </div>
  );
}
