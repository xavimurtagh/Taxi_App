'use client';

import { useState, useEffect } from 'react';
import {
  fetchAPI,
  formatCurrency,
  formatDate,
  formatDateTime,
  isAuthenticated,
} from '../../lib/api';

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(true);

  // Data
  const [pendingDocs, setPendingDocs] = useState({ count: 0, items: [] });
  const [tickets, setTickets] = useState({ count: 0, items: [] });
  const [moderators, setModerators] = useState([]);
  const [configs, setConfigs] = useState([]);
  const [surplus, setSurplus] = useState(null);
  const [elections, setElections] = useState([]);

  // Actions
  const [calculatingSurplus, setCalculatingSurplus] = useState(false);
  const [approvingDistribution, setApprovingDistribution] = useState(false);
  const [actionMessage, setActionMessage] = useState(null);

  useEffect(() => {
    const isAuth = isAuthenticated();
    setAuthed(isAuth);
    if (isAuth) {
      loadAdminData();
    } else {
      setLoading(false);
    }
  }, []);

  async function loadAdminData() {
    setLoading(true);
    try {
      const results = await Promise.allSettled([
        fetchAPI('/admin/documents/pending'),
        fetchAPI('/admin/tickets?status=open'),
        fetchAPI('/admin/moderators'),
        fetchAPI('/admin/config'),
        fetchAPI('/admin/surplus'),
        fetchAPI('/admin/elections?status=active'),
      ]);

      // Pending documents
      if (results[0].status === 'fulfilled') {
        const d = results[0].value;
        setPendingDocs({
          count: d?.count ?? d?.total ?? (Array.isArray(d) ? d.length : (d?.documents ?? d?.data ?? []).length),
          items: Array.isArray(d) ? d : d?.documents ?? d?.data ?? [],
        });
      }

      // Open tickets
      if (results[1].status === 'fulfilled') {
        const t = results[1].value;
        setTickets({
          count: t?.count ?? t?.total ?? (Array.isArray(t) ? t.length : (t?.tickets ?? t?.data ?? []).length),
          items: Array.isArray(t) ? t : t?.tickets ?? t?.data ?? [],
        });
      }

      // Moderators
      if (results[2].status === 'fulfilled') {
        const m = results[2].value;
        setModerators(
          Array.isArray(m) ? m : m?.moderators ?? m?.data ?? []
        );
      }

      // Config
      if (results[3].status === 'fulfilled') {
        const c = results[3].value;
        setConfigs(
          Array.isArray(c) ? c : c?.configs ?? c?.parameters ?? c?.data ?? []
        );
      }

      // Surplus
      if (results[4].status === 'fulfilled') {
        setSurplus(results[4].value);
      }

      // Elections
      if (results[5].status === 'fulfilled') {
        const e = results[5].value;
        setElections(
          Array.isArray(e) ? e : e?.elections ?? e?.data ?? []
        );
      }
    } catch (err) {
      console.error('Failed to load admin data:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCalculateSurplus() {
    try {
      setCalculatingSurplus(true);
      setActionMessage(null);
      const result = await fetchAPI('/admin/surplus/calculate', {
        method: 'POST',
      });
      setActionMessage({
        type: 'success',
        text: `Surplus calculated: ${formatCurrency(
          result?.surplus ?? result?.amount ?? 0
        )}`,
      });
      // Reload surplus data
      const updated = await fetchAPI('/admin/surplus').catch(() => null);
      if (updated) setSurplus(updated);
    } catch (err) {
      setActionMessage({ type: 'error', text: 'Failed: ' + err.message });
    } finally {
      setCalculatingSurplus(false);
    }
  }

  async function handleApproveDistribution() {
    try {
      setApprovingDistribution(true);
      setActionMessage(null);
      await fetchAPI('/admin/surplus/distribute', { method: 'POST' });
      setActionMessage({
        type: 'success',
        text: 'Surplus distribution has been approved and queued.',
      });
      const updated = await fetchAPI('/admin/surplus').catch(() => null);
      if (updated) setSurplus(updated);
    } catch (err) {
      setActionMessage({ type: 'error', text: 'Failed: ' + err.message });
    } finally {
      setApprovingDistribution(false);
    }
  }

  if (!authed) {
    return (
      <div className="page-container">
        <div className="page-header">
          <h1>Admin Panel</h1>
          <p>Platform administration and management</p>
        </div>
        <div className="card">
          <div className="card-body" style={{ textAlign: 'center', padding: 60 }}>
            <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }}>
              &#128274;
            </div>
            <h3 style={{ marginBottom: 8 }}>Admin Access Required</h3>
            <p className="text-muted" style={{ maxWidth: 400, margin: '0 auto' }}>
              This section is restricted to platform moderators and
              administrators. Please log in with appropriate credentials.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="page-container">
        <div className="loading-container">
          <div className="spinner" />
          <p>Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Admin Panel</h1>
        <p>Platform administration, moderation, and governance management</p>
      </div>

      {/* Summary Cards */}
      <div className="stats-grid mb-32">
        <div className="stat-card">
          <div className="stat-card-label">Pending Documents</div>
          <div className="stat-card-value" style={{ color: pendingDocs.count > 0 ? 'var(--warning)' : 'var(--primary)' }}>
            {pendingDocs.count}
          </div>
          <div className="stat-card-sub">Awaiting review</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Open Tickets</div>
          <div className="stat-card-value" style={{ color: tickets.count > 0 ? 'var(--warning)' : 'var(--primary)' }}>
            {tickets.count}
          </div>
          <div className="stat-card-sub">Support requests</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Active Moderators</div>
          <div className="stat-card-value primary">{moderators.length}</div>
          <div className="stat-card-sub">Community moderators</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Active Elections</div>
          <div className="stat-card-value">{elections.length}</div>
          <div className="stat-card-sub">Ongoing votes</div>
        </div>
      </div>

      {/* Moderators */}
      <section className="detail-section">
        <h2 className="section-title">Active Moderators</h2>
        {moderators.length > 0 ? (
          <div className="card">
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Role</th>
                    <th>Since</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {moderators.map((mod, i) => (
                    <tr key={mod.id ?? i}>
                      <td style={{ fontWeight: 500 }}>
                        {mod.name ??
                          mod.full_name ??
                          mod.fullName ??
                          `Moderator ${i + 1}`}
                      </td>
                      <td>
                        <span className="badge badge-purple">
                          {(mod.role ?? 'moderator')
                            .replace(/_/g, ' ')
                            .replace(/\b\w/g, (c) => c.toUpperCase())}
                        </span>
                      </td>
                      <td className="text-muted text-sm">
                        {formatDate(
                          mod.appointed_at ??
                            mod.appointedAt ??
                            mod.created_at ??
                            mod.createdAt
                        )}
                      </td>
                      <td>
                        <span className="badge badge-green">Active</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="card">
            <div className="card-body">
              <p className="text-muted">No moderators data available.</p>
            </div>
          </div>
        )}
      </section>

      {/* Platform Config */}
      <section className="detail-section">
        <h2 className="section-title">Platform Configuration</h2>
        <div className="notice notice-info mb-16">
          <span className="notice-icon">&#9432;</span>
          <div>
            These values can only be changed by community vote through the
            governance process.
          </div>
        </div>
        {configs.length > 0 ? (
          <div className="card">
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Key</th>
                    <th>Current Value</th>
                    <th>Category</th>
                    <th>Last Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {configs.map((cfg, i) => (
                    <tr key={cfg.key ?? cfg.id ?? i}>
                      <td>
                        <code
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: 13,
                            background: '#f0f0f4',
                            padding: '2px 8px',
                            borderRadius: 4,
                          }}
                        >
                          {cfg.key ?? cfg.name ?? `config_${i}`}
                        </code>
                      </td>
                      <td style={{ fontWeight: 600 }}>
                        {cfg.value ?? cfg.current_value ?? cfg.currentValue ?? '—'}
                      </td>
                      <td>
                        <span className="badge badge-gray">
                          {(
                            cfg.category ?? cfg.group ?? 'general'
                          )
                            .replace(/_/g, ' ')
                            .replace(/\b\w/g, (c) => c.toUpperCase())}
                        </span>
                      </td>
                      <td className="text-muted text-sm">
                        {formatDate(
                          cfg.updated_at ??
                            cfg.updatedAt ??
                            cfg.last_updated ??
                            cfg.lastUpdated
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="card">
            <div className="card-body">
              <p className="text-muted">No configuration parameters available.</p>
            </div>
          </div>
        )}
      </section>

      {/* Surplus Redistribution */}
      <section className="detail-section">
        <h2 className="section-title">Surplus Redistribution</h2>
        <div className="card">
          <div className="card-body">
            {surplus ? (
              <>
                <div className="stats-grid mb-24" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
                  <div className="stat-card" style={{ border: 'none', boxShadow: 'none', background: '#f8f9fb' }}>
                    <div className="stat-card-label">Current Quarter</div>
                    <div className="stat-card-value" style={{ fontSize: 20 }}>
                      {surplus.quarter ??
                        surplus.current_quarter ??
                        surplus.period ??
                        'Q? 20??'}
                    </div>
                  </div>
                  <div className="stat-card" style={{ border: 'none', boxShadow: 'none', background: '#f8f9fb' }}>
                    <div className="stat-card-label">Surplus Amount</div>
                    <div className="stat-card-value primary" style={{ fontSize: 20 }}>
                      {formatCurrency(
                        surplus.amount ??
                          surplus.surplus_amount ??
                          surplus.surplusAmount ??
                          0
                      )}
                    </div>
                  </div>
                  <div className="stat-card" style={{ border: 'none', boxShadow: 'none', background: '#f8f9fb' }}>
                    <div className="stat-card-label">Status</div>
                    <div className="stat-card-value" style={{ fontSize: 20 }}>
                      <span
                        className={`badge ${
                          (surplus.status ?? 'pending') === 'distributed'
                            ? 'badge-green'
                            : (surplus.status ?? 'pending') === 'approved'
                            ? 'badge-blue'
                            : 'badge-yellow'
                        }`}
                      >
                        {(surplus.status ?? 'pending')
                          .replace(/_/g, ' ')
                          .replace(/\b\w/g, (c) => c.toUpperCase())}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="btn-group">
                  <button
                    className="btn btn-primary"
                    onClick={handleCalculateSurplus}
                    disabled={calculatingSurplus}
                  >
                    {calculatingSurplus
                      ? 'Calculating...'
                      : 'Calculate Surplus'}
                  </button>
                  <button
                    className="btn btn-outline"
                    onClick={handleApproveDistribution}
                    disabled={approvingDistribution}
                  >
                    {approvingDistribution
                      ? 'Approving...'
                      : 'Approve Distribution'}
                  </button>
                </div>
              </>
            ) : (
              <div>
                <p className="text-muted mb-16">
                  No surplus data available for the current quarter. Calculate
                  surplus to see the current status.
                </p>
                <button
                  className="btn btn-primary"
                  onClick={handleCalculateSurplus}
                  disabled={calculatingSurplus}
                >
                  {calculatingSurplus ? 'Calculating...' : 'Calculate Surplus'}
                </button>
              </div>
            )}

            {actionMessage && (
              <div
                className={`notice mt-16 ${
                  actionMessage.type === 'success'
                    ? 'notice-success'
                    : 'notice-danger'
                }`}
              >
                <span className="notice-icon">
                  {actionMessage.type === 'success' ? '\u2713' : '!'}
                </span>
                <div>{actionMessage.text}</div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Active Elections */}
      <section className="detail-section">
        <h2 className="section-title">Active Elections</h2>
        {elections.length > 0 ? (
          <div className="card">
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Position</th>
                    <th>Candidates</th>
                    <th>Ends</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {elections.map((el, i) => (
                    <tr key={el.id ?? i}>
                      <td style={{ fontWeight: 500 }}>
                        {el.title ?? el.name ?? `Election ${i + 1}`}
                      </td>
                      <td>
                        {el.position ??
                          el.role ??
                          '—'}
                      </td>
                      <td>
                        {el.candidate_count ??
                          el.candidateCount ??
                          el.candidates?.length ??
                          '—'}
                      </td>
                      <td className="text-muted text-sm">
                        {formatDate(
                          el.ends_at ??
                            el.endsAt ??
                            el.end_date ??
                            el.endDate
                        )}
                      </td>
                      <td>
                        <span className="badge badge-blue">Active</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="card">
            <div className="card-body">
              <p className="text-muted">
                No active elections at this time. Elections are held periodically
                to choose community moderators and governance representatives.
              </p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
