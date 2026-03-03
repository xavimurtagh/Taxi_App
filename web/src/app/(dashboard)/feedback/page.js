'use client';

import { useState, useEffect } from 'react';
import { fetchAPI, formatDateTime, isAuthenticated } from '../../../lib/api';

const STATUS_BADGE = {
  new: 'badge-blue',
  acknowledged: 'badge-yellow',
  in_progress: 'badge-blue',
  resolved: 'badge-green',
  wont_fix: 'badge-gray',
};

const SEVERITY_BADGE = {
  critical: 'badge-red',
  high: 'badge-yellow',
  medium: 'badge-blue',
  low: 'badge-gray',
};

function statusLabel(s) {
  return (s ?? 'unknown').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function FeedbackPage() {
  const [feedback, setFeedback] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [authed, setAuthed] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterSeverity, setFilterSeverity] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [newStatus, setNewStatus] = useState('');
  const [updating, setUpdating] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    setAuthed(isAuthenticated());
    if (isAuthenticated()) {
      loadStats();
      loadFeedback();
    } else {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authed) {
      setPage(1);
      loadFeedback(1);
    }
  }, [filterType, filterStatus, filterSeverity]);

  async function loadStats() {
    try {
      const data = await fetchAPI('/feedback/stats');
      setStats(data.stats || data);
    } catch (err) {
      // Non-critical — stats can fail silently
    }
  }

  async function loadFeedback(p = page) {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({ page: p, limit: 20 });
      if (filterType) params.set('type', filterType);
      if (filterStatus) params.set('status', filterStatus);
      if (filterSeverity) params.set('severity', filterSeverity);

      const data = await fetchAPI(`/feedback/admin?${params}`);
      setFeedback(data.feedback || []);
      setTotalPages(data.pagination?.totalPages || 1);
      setPage(p);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdate() {
    if (!selectedItem) return;
    setUpdating(true);
    try {
      const body = {};
      if (newStatus) body.status = newStatus;
      if (adminNotes.trim()) body.admin_notes = adminNotes.trim();

      const data = await fetchAPI(`/feedback/${selectedItem.id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });

      const updated = data.feedback || data;
      setFeedback((prev) =>
        prev.map((f) => (f.id === updated.id ? { ...f, ...updated } : f))
      );
      setSelectedItem({ ...selectedItem, ...updated });
      setNewStatus('');
    } catch (err) {
      alert('Failed to update: ' + err.message);
    } finally {
      setUpdating(false);
    }
  }

  function selectItem(item) {
    setSelectedItem(item);
    setAdminNotes(item.adminNotes || '');
    setNewStatus('');
  }

  if (!authed) {
    return (
      <div className="page-container">
        <div className="page-header">
          <h1>Beta Feedback</h1>
          <p>Review and manage user feedback</p>
        </div>
        <div className="card">
          <div className="card-body" style={{ textAlign: 'center', padding: 60 }}>
            <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }}>&#9993;</div>
            <h3>Authentication Required</h3>
            <p style={{ color: '#666' }}>Sign in to view and manage feedback.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Beta Feedback</h1>
        <p>Review and manage user bug reports, feature requests, and feedback</p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginBottom: 24 }}>
          <div className="card">
            <div className="card-body" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 700 }}>{stats.total || 0}</div>
              <div style={{ color: '#666', fontSize: 13 }}>Total Feedback</div>
            </div>
          </div>
          {['bug', 'feature_request', 'ux_feedback', 'general'].map((t) => (
            <div className="card" key={t}>
              <div className="card-body" style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 700 }}>{stats.byType?.[t] || 0}</div>
                <div style={{ color: '#666', fontSize: 13 }}>{statusLabel(t)}</div>
              </div>
            </div>
          ))}
          <div className="card">
            <div className="card-body" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#f44336' }}>{stats.bySeverity?.critical || 0}</div>
              <div style={{ color: '#666', fontSize: 13 }}>Critical</div>
            </div>
          </div>
          <div className="card">
            <div className="card-body" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#4caf50' }}>{stats.byStatus?.resolved || 0}</div>
              <div style={{ color: '#666', fontSize: 13 }}>Resolved</div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-body" style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ fontSize: 13, fontWeight: 600 }}>Filters:</label>
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)} style={selectStyle}>
            <option value="">All Types</option>
            <option value="bug">Bug</option>
            <option value="feature_request">Feature Request</option>
            <option value="ux_feedback">UX Feedback</option>
            <option value="general">General</option>
          </select>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={selectStyle}>
            <option value="">All Statuses</option>
            <option value="new">New</option>
            <option value="acknowledged">Acknowledged</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
            <option value="wont_fix">Won't Fix</option>
          </select>
          <select value={filterSeverity} onChange={(e) => setFilterSeverity(e.target.value)} style={selectStyle}>
            <option value="">All Severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="card" style={{ marginBottom: 16, borderLeft: '4px solid #f44336' }}>
          <div className="card-body">
            <p style={{ color: '#f44336', margin: 0 }}>{error}</p>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: selectedItem ? '1fr 400px' : '1fr', gap: 16 }}>
        {/* Feedback Table */}
        <div className="card">
          <div className="card-body" style={{ padding: 0 }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: 40 }}>Loading...</div>
            ) : feedback.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
                No feedback found matching filters
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e0e0e0' }}>
                    <th style={thStyle}>Type</th>
                    <th style={thStyle}>Title</th>
                    <th style={thStyle}>Severity</th>
                    <th style={thStyle}>Status</th>
                    <th style={thStyle}>User</th>
                    <th style={thStyle}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {feedback.map((item) => (
                    <tr
                      key={item.id}
                      onClick={() => selectItem(item)}
                      style={{
                        cursor: 'pointer',
                        borderBottom: '1px solid #f0f0f0',
                        backgroundColor: selectedItem?.id === item.id ? '#f5f5ff' : 'transparent',
                      }}
                    >
                      <td style={tdStyle}>
                        <span className={`badge ${STATUS_BADGE[item.type] || 'badge-gray'}`}>
                          {statusLabel(item.type)}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.title}
                      </td>
                      <td style={tdStyle}>
                        <span className={`badge ${SEVERITY_BADGE[item.severity] || 'badge-gray'}`}>
                          {item.severity}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        <span className={`badge ${STATUS_BADGE[item.status] || 'badge-gray'}`}>
                          {statusLabel(item.status)}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, fontSize: 12, color: '#666' }}>{item.userName || 'Unknown'}</td>
                      <td style={{ ...tdStyle, fontSize: 12, color: '#666' }}>{formatDateTime(item.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: 8, padding: 16 }}>
                <button
                  disabled={page <= 1}
                  onClick={() => loadFeedback(page - 1)}
                  style={paginationBtnStyle}
                >
                  Previous
                </button>
                <span style={{ lineHeight: '32px', fontSize: 13 }}>Page {page} of {totalPages}</span>
                <button
                  disabled={page >= totalPages}
                  onClick={() => loadFeedback(page + 1)}
                  style={paginationBtnStyle}
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Detail Panel */}
        {selectedItem && (
          <div className="card">
            <div className="card-body">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ margin: 0, fontSize: 16 }}>Feedback Detail</h3>
                <button onClick={() => setSelectedItem(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 18 }}>
                  &times;
                </button>
              </div>

              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 13, color: '#666', marginBottom: 2 }}>Title</div>
                <div style={{ fontWeight: 600 }}>{selectedItem.title}</div>
              </div>

              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <span className={`badge ${STATUS_BADGE[selectedItem.type] || 'badge-gray'}`}>{statusLabel(selectedItem.type)}</span>
                <span className={`badge ${SEVERITY_BADGE[selectedItem.severity] || 'badge-gray'}`}>{selectedItem.severity}</span>
                <span className={`badge ${STATUS_BADGE[selectedItem.status] || 'badge-gray'}`}>{statusLabel(selectedItem.status)}</span>
              </div>

              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 13, color: '#666', marginBottom: 2 }}>Description</div>
                <div style={{ fontSize: 14, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{selectedItem.description}</div>
              </div>

              <div style={{ marginBottom: 12, fontSize: 13 }}>
                <div style={{ color: '#666' }}>
                  <strong>User:</strong> {selectedItem.userName} ({selectedItem.userEmail})
                </div>
                <div style={{ color: '#666' }}>
                  <strong>Platform:</strong> {selectedItem.platform || 'N/A'} | <strong>Version:</strong> {selectedItem.appVersion || 'N/A'}
                </div>
                <div style={{ color: '#666' }}>
                  <strong>Submitted:</strong> {formatDateTime(selectedItem.createdAt)}
                </div>
                {selectedItem.metadata?.voteCount > 0 && (
                  <div style={{ color: '#666' }}>
                    <strong>Votes:</strong> {selectedItem.metadata.voteCount}
                  </div>
                )}
              </div>

              {selectedItem.deviceInfo && Object.keys(selectedItem.deviceInfo).length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 13, color: '#666', marginBottom: 2 }}>Device Info</div>
                  <pre style={{ fontSize: 11, backgroundColor: '#f5f5f5', padding: 8, borderRadius: 4, overflow: 'auto' }}>
                    {JSON.stringify(selectedItem.deviceInfo, null, 2)}
                  </pre>
                </div>
              )}

              <hr style={{ margin: '16px 0', borderColor: '#e0e0e0' }} />

              {/* Admin Actions */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Update Status</div>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  style={{ ...selectStyle, width: '100%' }}
                >
                  <option value="">-- Keep Current --</option>
                  <option value="new">New</option>
                  <option value="acknowledged">Acknowledged</option>
                  <option value="in_progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                  <option value="wont_fix">Won't Fix</option>
                </select>
              </div>

              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Admin Notes</div>
                <textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  rows={4}
                  style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ddd', fontSize: 13, resize: 'vertical' }}
                  placeholder="Notes visible to the user..."
                />
              </div>

              <button
                onClick={handleUpdate}
                disabled={updating || (!newStatus && !adminNotes.trim())}
                style={{
                  width: '100%',
                  padding: '10px 16px',
                  backgroundColor: '#2e7d32',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontWeight: 600,
                  opacity: updating ? 0.6 : 1,
                }}
              >
                {updating ? 'Updating...' : 'Save Changes'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const thStyle = { textAlign: 'left', padding: '10px 12px', fontSize: 12, fontWeight: 600, color: '#666' };
const tdStyle = { padding: '10px 12px', fontSize: 13 };
const selectStyle = { padding: '6px 10px', borderRadius: 4, border: '1px solid #ddd', fontSize: 13 };
const paginationBtnStyle = { padding: '6px 16px', borderRadius: 4, border: '1px solid #ddd', background: '#fff', cursor: 'pointer', fontSize: 13 };
