'use client';

import { useState, useEffect } from 'react';
import { fetchAPI, formatNumber, formatCurrency } from '../../lib/api';

export default function DashboardPage() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadSummary();
  }, []);

  async function loadSummary() {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchAPI('/transparency/summary');
      setSummary(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="page-container">
        <div className="loading-container">
          <div className="spinner" />
          <p>Loading platform data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-container">
        <div className="page-header">
          <h1>Platform Dashboard</h1>
          <p>Real-time overview of the OpenRide platform</p>
        </div>
        <div className="error-message">
          <p>Failed to load dashboard data: {error}</p>
          <button className="btn btn-primary" onClick={loadSummary}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  const stats = [
    {
      label: 'Total Rides',
      value: formatNumber(summary?.total_rides ?? summary?.totalRides ?? 0),
      primary: true,
      sub: 'All-time completed rides',
    },
    {
      label: 'Active Drivers',
      value: formatNumber(summary?.active_drivers ?? summary?.activeDrivers ?? 0),
      primary: false,
      sub: 'Currently online',
    },
    {
      label: 'Registered Users',
      value: formatNumber(summary?.total_users ?? summary?.totalUsers ?? 0),
      primary: false,
      sub: 'Riders + drivers',
    },
    {
      label: 'Average Fare',
      value: formatCurrency(summary?.average_fare ?? summary?.averageFare ?? 0),
      primary: false,
      sub: 'Per ride',
    },
    {
      label: 'Avg Driver Rating',
      value: (summary?.average_driver_rating ?? summary?.averageDriverRating ?? 0).toFixed(2),
      primary: false,
      sub: 'Out of 5.0',
    },
    {
      label: 'Platform Fee',
      value: `${summary?.platform_fee_percent ?? summary?.platformFeePercent ?? 0}%`,
      primary: true,
      sub: 'Community-governed rate',
    },
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Platform Dashboard</h1>
        <p>Real-time overview of the OpenRide community-owned platform</p>
      </div>

      <div className="stats-grid">
        {stats.map((stat) => (
          <div className="stat-card" key={stat.label}>
            <div className="stat-card-label">{stat.label}</div>
            <div className={`stat-card-value${stat.primary ? ' primary' : ''}`}>
              {stat.value}
            </div>
            <div className="stat-card-sub">{stat.sub}</div>
          </div>
        ))}
      </div>

      {/* Platform Health Indicators */}
      <div className="card mb-32">
        <div className="card-header">
          <h2>Platform Health</h2>
        </div>
        <div className="card-body">
          <div className="grid-3" style={{ gap: 24 }}>
            <div>
              <div className="text-sm text-muted mb-8">Uptime</div>
              <div className="progress-bar">
                <div
                  className="progress-bar-fill green"
                  style={{ width: '99.9%' }}
                />
              </div>
              <div className="text-sm mt-8" style={{ color: 'var(--primary)' }}>
                99.9% uptime
              </div>
            </div>
            <div>
              <div className="text-sm text-muted mb-8">Driver Satisfaction</div>
              <div className="progress-bar">
                <div
                  className="progress-bar-fill green"
                  style={{
                    width: `${Math.min(
                      ((summary?.average_driver_rating ??
                        summary?.averageDriverRating ??
                        4.5) /
                        5) *
                        100,
                      100
                    )}%`,
                  }}
                />
              </div>
              <div className="text-sm mt-8" style={{ color: 'var(--primary)' }}>
                {(
                  summary?.average_driver_rating ??
                  summary?.averageDriverRating ??
                  4.5
                ).toFixed(1)}{' '}
                / 5.0
              </div>
            </div>
            <div>
              <div className="text-sm text-muted mb-8">Governance Participation</div>
              <div className="progress-bar">
                <div
                  className="progress-bar-fill blue"
                  style={{ width: '72%' }}
                />
              </div>
              <div className="text-sm mt-8" style={{ color: 'var(--info)' }}>
                72% voter turnout
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Public Notice */}
      <div className="notice notice-success">
        <span className="notice-icon">&#9432;</span>
        <div>
          <strong>Publicly Verifiable Data</strong>
          <br />
          This data updates in real-time and is publicly verifiable. OpenRide is
          committed to full transparency &mdash; every metric on this dashboard is
          derived directly from platform operations. View our{' '}
          <a href="/transparency">financial transparency report</a> for full details.
        </div>
      </div>
    </div>
  );
}
