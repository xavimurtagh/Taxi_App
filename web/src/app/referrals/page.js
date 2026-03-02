'use client';

import { useState, useEffect } from 'react';
import {
  fetchAPI,
  formatCurrency,
  formatDate,
  formatNumber,
  isAuthenticated,
} from '../../lib/api';

const REFERRAL_STATUS_BADGE = {
  pending: 'badge-yellow',
  qualified: 'badge-green',
  active: 'badge-green',
  signed_up: 'badge-blue',
  expired: 'badge-gray',
  revoked: 'badge-red',
};

const REWARD_STATUS_BADGE = {
  pending: 'badge-yellow',
  credited: 'badge-green',
  paid: 'badge-green',
  available: 'badge-blue',
  redeemed: 'badge-green',
  expired: 'badge-gray',
};

function statusLabel(s) {
  return (s ?? 'unknown')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function ReferralsPage() {
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [referralCode, setReferralCode] = useState('');
  const [stats, setStats] = useState({
    total_referred: 0,
    qualified_referrals: 0,
    total_earned: 0,
    available_credits: 0,
  });
  const [referrals, setReferrals] = useState([]);
  const [rewards, setRewards] = useState([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const isAuth = isAuthenticated();
    setAuthed(isAuth);
    if (isAuth) {
      loadReferralData();
    } else {
      setLoading(false);
    }
  }, []);

  async function loadReferralData() {
    setLoading(true);
    try {
      const results = await Promise.allSettled([
        fetchAPI('/referrals/code'),
        fetchAPI('/referrals/stats'),
        fetchAPI('/referrals'),
        fetchAPI('/referrals/rewards'),
      ]);

      // Referral code
      if (results[0].status === 'fulfilled') {
        const d = results[0].value;
        setReferralCode(
          d?.code ?? d?.referral_code ?? d?.referralCode ?? ''
        );
      }

      // Stats
      if (results[1].status === 'fulfilled') {
        const s = results[1].value;
        setStats({
          total_referred:
            s?.total_referred ??
            s?.totalReferred ??
            s?.total ??
            0,
          qualified_referrals:
            s?.qualified_referrals ??
            s?.qualifiedReferrals ??
            s?.qualified ??
            0,
          total_earned:
            s?.total_earned ??
            s?.totalEarned ??
            s?.earnings ??
            0,
          available_credits:
            s?.available_credits ??
            s?.availableCredits ??
            s?.credits ??
            0,
        });
      }

      // Referrals list
      if (results[2].status === 'fulfilled') {
        const r = results[2].value;
        setReferrals(
          Array.isArray(r) ? r : r?.referrals ?? r?.data ?? []
        );
      }

      // Rewards list
      if (results[3].status === 'fulfilled') {
        const w = results[3].value;
        setRewards(
          Array.isArray(w) ? w : w?.rewards ?? w?.data ?? []
        );
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleCopyCode() {
    if (!referralCode) return;
    navigator.clipboard.writeText(referralCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = referralCode;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleCopyLink() {
    const link = `${typeof window !== 'undefined' ? window.location.origin : ''}/refer/${referralCode}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  }

  if (!authed) {
    return (
      <div className="page-container">
        <div className="page-header">
          <h1>Referrals</h1>
          <p>Invite friends and earn rewards</p>
        </div>
        <div className="card">
          <div className="card-body" style={{ textAlign: 'center', padding: 60 }}>
            <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }}>
              &#9888;
            </div>
            <h3 style={{ marginBottom: 8 }}>Authentication Required</h3>
            <p className="text-muted" style={{ maxWidth: 400, margin: '0 auto' }}>
              You need to be logged in to access your referral dashboard. Please
              authenticate through the mobile app or API to access this section.
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
          <p>Loading referral data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-container">
        <div className="page-header">
          <h1>Referrals</h1>
          <p>Invite friends and earn rewards</p>
        </div>
        <div className="error-message">
          <p>Failed to load referral data: {error}</p>
          <button className="btn btn-primary" onClick={loadReferralData}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  const referralLink = `${typeof window !== 'undefined' ? window.location.origin : ''}/refer/${referralCode}`;

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Referrals</h1>
        <p>Invite friends, earn rewards, and grow the community</p>
      </div>

      {/* Referral Code Display */}
      <div className="card mb-32">
        <div className="card-body">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              gap: 16,
              padding: '16px 0',
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Your Referral Code
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
              }}
            >
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 32,
                  fontWeight: 700,
                  letterSpacing: 4,
                  color: 'var(--primary)',
                  background: 'var(--primary-bg)',
                  padding: '12px 32px',
                  borderRadius: 'var(--radius)',
                  border: '2px dashed var(--primary)',
                }}
              >
                {referralCode || '------'}
              </div>
              <button
                className="btn btn-primary"
                onClick={handleCopyCode}
                disabled={!referralCode}
              >
                {copied ? 'Copied!' : 'Copy Code'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-grid mb-32">
        <div className="stat-card">
          <div className="stat-card-label">Total Referred</div>
          <div className="stat-card-value primary">
            {formatNumber(stats.total_referred)}
          </div>
          <div className="stat-card-sub">People you invited</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Qualified Referrals</div>
          <div className="stat-card-value">
            {formatNumber(stats.qualified_referrals)}
          </div>
          <div className="stat-card-sub">Completed requirements</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Total Earned</div>
          <div className="stat-card-value primary">
            {formatCurrency(stats.total_earned)}
          </div>
          <div className="stat-card-sub">Lifetime earnings</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Available Credits</div>
          <div className="stat-card-value">
            {formatCurrency(stats.available_credits)}
          </div>
          <div className="stat-card-sub">Ready to use</div>
        </div>
      </div>

      {/* Referrals Table */}
      <section className="detail-section">
        <h2 className="section-title">Your Referrals</h2>
        {referrals.length > 0 ? (
          <div className="card">
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Referred User</th>
                    <th>Status</th>
                    <th>Rides Completed</th>
                    <th>Date Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {referrals.map((ref, i) => (
                    <tr key={ref.id ?? i}>
                      <td style={{ fontWeight: 500 }}>
                        {ref.referred_user ??
                          ref.referredUser ??
                          ref.user_name ??
                          ref.userName ??
                          ref.name ??
                          `User ***${String(ref.id ?? i).slice(-4)}`}
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            REFERRAL_STATUS_BADGE[ref.status] ?? 'badge-gray'
                          }`}
                        >
                          {statusLabel(ref.status)}
                        </span>
                      </td>
                      <td>
                        {ref.rides_completed ??
                          ref.ridesCompleted ??
                          ref.ride_count ??
                          ref.rideCount ??
                          0}
                      </td>
                      <td className="text-muted text-sm">
                        {formatDate(
                          ref.joined_at ??
                            ref.joinedAt ??
                            ref.created_at ??
                            ref.createdAt ??
                            ref.date
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
              <div className="empty-state" style={{ padding: 40 }}>
                <div className="empty-state-icon">&#128101;</div>
                <h3>No referrals yet</h3>
                <p>Share your referral code with friends to start earning rewards.</p>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Rewards Table */}
      <section className="detail-section">
        <h2 className="section-title">Rewards History</h2>
        {rewards.length > 0 ? (
          <div className="card">
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {rewards.map((rw, i) => (
                    <tr key={rw.id ?? i}>
                      <td style={{ fontWeight: 500 }}>
                        {statusLabel(
                          rw.type ??
                            rw.reward_type ??
                            rw.rewardType ??
                            'referral'
                        )}
                      </td>
                      <td style={{ fontWeight: 600, color: 'var(--primary)' }}>
                        {formatCurrency(
                          rw.amount ?? rw.value ?? rw.credit ?? 0
                        )}
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            REWARD_STATUS_BADGE[rw.status] ?? 'badge-gray'
                          }`}
                        >
                          {statusLabel(rw.status)}
                        </span>
                      </td>
                      <td className="text-muted text-sm">
                        {formatDate(
                          rw.created_at ??
                            rw.createdAt ??
                            rw.date ??
                            rw.awarded_at ??
                            rw.awardedAt
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
              <div className="empty-state" style={{ padding: 40 }}>
                <div className="empty-state-icon">&#127873;</div>
                <h3>No rewards yet</h3>
                <p>Rewards will appear here when your referrals qualify.</p>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Share Referral Link */}
      <section className="detail-section">
        <h2 className="section-title">Share Referral Link</h2>
        <div className="card">
          <div className="card-body">
            <p className="text-muted mb-16">
              Share this link with friends. When they sign up and complete their
              first qualifying ride, you both earn rewards!
            </p>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <div
                style={{
                  flex: 1,
                  fontFamily: 'var(--font-mono)',
                  fontSize: 14,
                  background: '#f8f9fb',
                  padding: '12px 16px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  color: 'var(--primary)',
                }}
              >
                {referralLink}
              </div>
              <button
                className="btn btn-primary"
                onClick={handleCopyLink}
                disabled={!referralCode}
              >
                Copy Link
              </button>
            </div>
            {copied && (
              <div className="notice notice-success mt-16">
                <span className="notice-icon">&#10003;</span>
                <div>Copied to clipboard!</div>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
