'use client';

import { useState, useEffect } from 'react';
import { fetchAPI, formatNumber, timeRemaining, formatDate, isAuthenticated } from '../../../lib/api';

const TABS = [
  { key: 'active', label: 'Active Proposals' },
  { key: 'passed', label: 'Passed' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'implemented', label: 'Implemented' },
];

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

function getCategoryBadge(category) {
  const colorClass = CATEGORY_COLORS[category] ?? CATEGORY_COLORS.default;
  const label = (category ?? 'general')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
  return <span className={`badge ${colorClass}`}>{label}</span>;
}

function VoteBar({ votesFor, votesAgainst, abstain }) {
  const total = (votesFor || 0) + (votesAgainst || 0) + (abstain || 0);
  if (total === 0) {
    return (
      <div className="vote-bar">
        <div className="vote-bar-for" style={{ width: '0%' }} />
      </div>
    );
  }
  const forPct = ((votesFor || 0) / total) * 100;
  const againstPct = ((votesAgainst || 0) / total) * 100;
  return (
    <div className="vote-bar">
      <div className="vote-bar-for" style={{ width: `${forPct}%` }} />
      <div className="vote-bar-against" style={{ width: `${againstPct}%` }} />
    </div>
  );
}

export default function GovernancePage() {
  const [activeTab, setActiveTab] = useState('active');
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showLoginMsg, setShowLoginMsg] = useState(false);

  useEffect(() => {
    loadProposals();
  }, [activeTab]);

  async function loadProposals() {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchAPI(`/governance/proposals?status=${activeTab}`);
      setProposals(Array.isArray(data) ? data : data?.proposals ?? data?.data ?? []);
    } catch (err) {
      setError(err.message);
      setProposals([]);
    } finally {
      setLoading(false);
    }
  }

  function handleCreateProposal() {
    if (!isAuthenticated()) {
      setShowLoginMsg(true);
      return;
    }
    window.location.href = '/governance/create';
  }

  function getVotesFor(p) {
    return p.votes_for ?? p.votesFor ?? p.for_votes ?? 0;
  }
  function getVotesAgainst(p) {
    return p.votes_against ?? p.votesAgainst ?? p.against_votes ?? 0;
  }
  function getAbstain(p) {
    return p.votes_abstain ?? p.votesAbstain ?? p.abstain_votes ?? 0;
  }
  function getQuorum(p) {
    return p.quorum_reached ?? p.quorumReached ?? null;
  }
  function getQuorumPct(p) {
    const required = p.quorum_required ?? p.quorumRequired ?? p.quorum ?? 0;
    const total = getVotesFor(p) + getVotesAgainst(p) + getAbstain(p);
    if (!required || required === 0) return 100;
    return Math.min(Math.round((total / required) * 100), 100);
  }

  return (
    <div className="page-container">
      <div className="flex-between mb-24">
        <div className="page-header" style={{ marginBottom: 0 }}>
          <h1>Governance</h1>
          <p>Community proposals and voting on platform decisions</p>
        </div>
        <button className="btn btn-primary" onClick={handleCreateProposal}>
          + Create Proposal
        </button>
      </div>

      {/* Login Required Modal */}
      {showLoginMsg && (
        <div className="modal-overlay" onClick={() => setShowLoginMsg(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Authentication Required</h2>
              <button
                className="modal-close"
                onClick={() => setShowLoginMsg(false)}
              >
                &times;
              </button>
            </div>
            <div className="modal-body">
              <p>
                You need to be logged in to create a proposal or vote. Please log in
                through the mobile app or API to participate in governance.
              </p>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setShowLoginMsg(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="tabs">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            className={`tab${activeTab === tab.key ? ' active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="loading-container">
          <div className="spinner" />
          <p>Loading proposals...</p>
        </div>
      ) : error ? (
        <div className="error-message">
          <p>Failed to load proposals: {error}</p>
          <button className="btn btn-primary" onClick={loadProposals}>
            Retry
          </button>
        </div>
      ) : proposals.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">&#9745;</div>
          <h3>No {activeTab} proposals</h3>
          <p>
            {activeTab === 'active'
              ? 'There are no active proposals right now. Be the first to create one!'
              : `No proposals with status "${activeTab}" found.`}
          </p>
        </div>
      ) : (
        <div className="proposals-list">
          {proposals.map((proposal) => {
            const vFor = getVotesFor(proposal);
            const vAgainst = getVotesAgainst(proposal);
            const vAbstain = getAbstain(proposal);
            const configKey =
              proposal.config_key ?? proposal.configKey ?? null;
            const endDate =
              proposal.voting_ends_at ??
              proposal.votingEndsAt ??
              proposal.end_date ??
              null;

            return (
              <a
                key={proposal.id}
                href={`/governance/${proposal.id}`}
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <div className="proposal-card">
                  <div className="proposal-card-header">
                    <span className="proposal-card-title">
                      {proposal.title}
                    </span>
                    {getCategoryBadge(proposal.category)}
                  </div>

                  <div className="proposal-card-meta">
                    {activeTab === 'active' && endDate && (
                      <span style={{ color: 'var(--warning)' }}>
                        {timeRemaining(endDate)}
                      </span>
                    )}
                    {(activeTab === 'passed' || activeTab === 'rejected') && (
                      <span>
                        Outcome:{' '}
                        <strong
                          style={{
                            color:
                              activeTab === 'passed'
                                ? 'var(--primary)'
                                : 'var(--danger)',
                          }}
                        >
                          {activeTab === 'passed' ? 'Passed' : 'Rejected'}
                        </strong>
                      </span>
                    )}
                    {activeTab === 'implemented' && (
                      <span className="badge badge-green">Implemented</span>
                    )}
                    <span>
                      Quorum: {getQuorumPct(proposal)}%
                      {getQuorum(proposal) === true && (
                        <span style={{ color: 'var(--primary)', marginLeft: 4 }}>
                          (met)
                        </span>
                      )}
                    </span>
                  </div>

                  {/* Vote bar */}
                  <VoteBar
                    votesFor={vFor}
                    votesAgainst={vAgainst}
                    abstain={vAbstain}
                  />

                  <div className="proposal-card-votes">
                    <span className="for">
                      {formatNumber(vFor)} For
                    </span>
                    <span className="against">
                      {formatNumber(vAgainst)} Against
                    </span>
                    <span className="abstain">
                      {formatNumber(vAbstain)} Abstain
                    </span>
                  </div>

                  {configKey && (
                    <div className="proposal-config-change">
                      Proposes changing{' '}
                      <code>{configKey}</code> from{' '}
                      <code>
                        {proposal.current_value ??
                          proposal.currentValue ??
                          '?'}
                      </code>{' '}
                      to{' '}
                      <code>
                        {proposal.proposed_value ??
                          proposal.proposedValue ??
                          '?'}
                      </code>
                    </div>
                  )}
                </div>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
