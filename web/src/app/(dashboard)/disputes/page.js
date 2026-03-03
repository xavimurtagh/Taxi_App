'use client';

import { useState, useEffect } from 'react';
import {
  fetchAPI,
  formatDate,
  formatDateTime,
  isAuthenticated,
} from '../../../lib/api';

const STATUS_BADGE = {
  submitted: 'badge-yellow',
  under_review: 'badge-blue',
  reviewing: 'badge-blue',
  in_progress: 'badge-blue',
  decision_made: 'badge-green',
  resolved: 'badge-green',
  closed: 'badge-gray',
  appealed: 'badge-yellow',
  escalated: 'badge-red',
};

function statusLabel(s) {
  return (s ?? 'unknown')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function DisputesPage() {
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [authed, setAuthed] = useState(false);
  const [selectedDispute, setSelectedDispute] = useState(null);

  useEffect(() => {
    setAuthed(isAuthenticated());
    if (isAuthenticated()) {
      loadDisputes();
    } else {
      setLoading(false);
    }
  }, []);

  async function loadDisputes() {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchAPI('/disputes');
      setDisputes(
        Array.isArray(data) ? data : data?.disputes ?? data?.data ?? []
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadDisputeDetail(id) {
    try {
      const data = await fetchAPI(`/disputes/${id}`);
      setSelectedDispute(data?.dispute ?? data);
    } catch (err) {
      alert('Failed to load dispute details: ' + err.message);
    }
  }

  if (!authed) {
    return (
      <div className="page-container">
        <div className="page-header">
          <h1>Disputes</h1>
          <p>Manage and review platform disputes</p>
        </div>
        <div className="card">
          <div className="card-body" style={{ textAlign: 'center', padding: 60 }}>
            <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }}>
              &#9888;
            </div>
            <h3 style={{ marginBottom: 8 }}>Authentication Required</h3>
            <p className="text-muted" style={{ maxWidth: 400, margin: '0 auto' }}>
              You need to be logged in to view and manage disputes. Please
              authenticate through the mobile app or API to access this section.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="flex-between mb-24">
        <div className="page-header" style={{ marginBottom: 0 }}>
          <h1>Disputes</h1>
          <p>View and manage your platform disputes</p>
        </div>
        <a href="/disputes/file" className="btn btn-primary">
          + File Dispute
        </a>
      </div>

      {/* Dispute Detail Modal */}
      {selectedDispute && (
        <div
          className="modal-overlay"
          onClick={() => setSelectedDispute(null)}
        >
          <div
            className="modal"
            style={{ maxWidth: 700 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2>Dispute #{selectedDispute.id}</h2>
              <button
                className="modal-close"
                onClick={() => setSelectedDispute(null)}
              >
                &times;
              </button>
            </div>
            <div className="modal-body">
              <div className="detail-grid mb-24">
                <dt>Type</dt>
                <dd>
                  {statusLabel(
                    selectedDispute.type ?? selectedDispute.dispute_type ?? ''
                  )}
                </dd>
                <dt>Status</dt>
                <dd>
                  <span
                    className={`badge ${
                      STATUS_BADGE[selectedDispute.status] ?? 'badge-gray'
                    }`}
                  >
                    {statusLabel(selectedDispute.status)}
                  </span>
                </dd>
                <dt>Title</dt>
                <dd>{selectedDispute.title ?? selectedDispute.subject ?? '—'}</dd>
                <dt>Initiator</dt>
                <dd>
                  {selectedDispute.initiator_name ??
                    selectedDispute.initiatorName ??
                    selectedDispute.initiator ??
                    '—'}
                </dd>
                <dt>Defendant</dt>
                <dd>
                  {selectedDispute.defendant_name ??
                    selectedDispute.defendantName ??
                    selectedDispute.defendant ??
                    '—'}
                </dd>
                <dt>Created</dt>
                <dd>
                  {formatDateTime(
                    selectedDispute.created_at ?? selectedDispute.createdAt
                  )}
                </dd>
                <dt>Updated</dt>
                <dd>
                  {formatDateTime(
                    selectedDispute.updated_at ?? selectedDispute.updatedAt
                  )}
                </dd>
              </div>

              {(selectedDispute.description ?? selectedDispute.body) && (
                <div>
                  <h3 style={{ marginBottom: 8, fontSize: 14, fontWeight: 600 }}>
                    Description
                  </h3>
                  <div
                    style={{
                      whiteSpace: 'pre-wrap',
                      background: '#f8f9fb',
                      padding: 16,
                      borderRadius: 8,
                      border: '1px solid var(--border)',
                      fontSize: 14,
                      lineHeight: 1.6,
                    }}
                  >
                    {selectedDispute.description ?? selectedDispute.body}
                  </div>
                </div>
              )}

              {(selectedDispute.resolution ?? selectedDispute.decision) && (
                <div style={{ marginTop: 20 }}>
                  <h3 style={{ marginBottom: 8, fontSize: 14, fontWeight: 600 }}>
                    Resolution / Decision
                  </h3>
                  <div className="notice notice-success">
                    <div>
                      {selectedDispute.resolution ?? selectedDispute.decision}
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setSelectedDispute(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="loading-container">
          <div className="spinner" />
          <p>Loading disputes...</p>
        </div>
      ) : error ? (
        <div className="error-message">
          <p>Failed to load disputes: {error}</p>
          <button className="btn btn-primary" onClick={loadDisputes}>
            Retry
          </button>
        </div>
      ) : disputes.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">&#9878;</div>
          <h3>No disputes found</h3>
          <p>You have no disputes at this time. If you need to report an issue, click &quot;File Dispute&quot; above.</p>
        </div>
      ) : (
        <div className="card">
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Type</th>
                  <th>Title</th>
                  <th>Status</th>
                  <th>Initiator</th>
                  <th>Defendant</th>
                  <th>Created</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {disputes.map((d) => (
                  <tr
                    key={d.id}
                    className="clickable"
                    onClick={() => loadDisputeDetail(d.id)}
                  >
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>
                      #{d.id}
                    </td>
                    <td>
                      {statusLabel(d.type ?? d.dispute_type ?? '')}
                    </td>
                    <td style={{ fontWeight: 500 }}>
                      {d.title ?? d.subject ?? '—'}
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          STATUS_BADGE[d.status] ?? 'badge-gray'
                        }`}
                      >
                        {statusLabel(d.status)}
                      </span>
                    </td>
                    <td>
                      {d.initiator_name ??
                        d.initiatorName ??
                        d.initiator ??
                        '—'}
                    </td>
                    <td>
                      {d.defendant_name ??
                        d.defendantName ??
                        d.defendant ??
                        '—'}
                    </td>
                    <td className="text-muted text-sm">
                      {formatDate(d.created_at ?? d.createdAt)}
                    </td>
                    <td>
                      <button
                        className="btn btn-sm btn-outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          loadDisputeDetail(d.id);
                        }}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
