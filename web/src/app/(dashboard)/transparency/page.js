'use client';

import { useState, useEffect } from 'react';
import { fetchAPI, formatCurrency, formatNumber } from '../../../lib/api';

const PERIODS = [
  { key: 'current_quarter', label: 'Current Quarter' },
  { key: 'last_quarter', label: 'Last Quarter' },
  { key: 'this_year', label: 'This Year' },
];

const COST_COLORS = ['#1976D2', '#7B1FA2', '#F57C00', '#00897B', '#C62828'];
const COST_LABELS = {
  server_costs: 'Server & Infrastructure',
  serverCosts: 'Server & Infrastructure',
  payment_processing: 'Payment Processing',
  paymentProcessing: 'Payment Processing',
  insurance: 'Insurance',
  support: 'Support & Operations',
  other: 'Other',
};

export default function TransparencyPage() {
  const [period, setPeriod] = useState('current_quarter');
  const [financials, setFinancials] = useState(null);
  const [driverStats, setDriverStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadData();
  }, [period]);

  async function loadData() {
    try {
      setLoading(true);
      setError(null);
      const [finData, drvData] = await Promise.all([
        fetchAPI(`/transparency/financials?period=${period}`).catch(() => null),
        fetchAPI(`/transparency/driver-stats?period=${period}`).catch(() => null),
      ]);
      setFinancials(finData);
      setDriverStats(drvData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function getCostBreakdown() {
    const costs = financials?.cost_breakdown ?? financials?.costBreakdown ?? financials?.costs ?? {};
    const entries = Object.entries(costs).filter(([, v]) => v > 0);
    const total = entries.reduce((sum, [, v]) => sum + v, 0);
    return entries.map(([key, value], i) => ({
      key,
      label: COST_LABELS[key] || key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      value,
      percent: total > 0 ? ((value / total) * 100).toFixed(1) : 0,
      color: COST_COLORS[i % COST_COLORS.length],
    }));
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Financial Transparency</h1>
        <p>
          Complete financial reporting for the OpenRide platform. Every dollar is
          accounted for.
        </p>
      </div>

      {/* Period Selector */}
      <div className="tabs">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            className={`tab${period === p.key ? ' active' : ''}`}
            onClick={() => setPeriod(p.key)}
          >
            {p.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading-container">
          <div className="spinner" />
          <p>Loading financial data...</p>
        </div>
      ) : error ? (
        <div className="error-message">
          <p>Failed to load data: {error}</p>
          <button className="btn btn-primary" onClick={loadData}>
            Retry
          </button>
        </div>
      ) : (
        <>
          {/* Revenue Section */}
          <section className="detail-section">
            <h2 className="section-title">Revenue</h2>
            <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
              <div className="stat-card">
                <div className="stat-card-label">Total Fares Collected</div>
                <div className="stat-card-value primary">
                  {formatCurrency(
                    financials?.total_fares ?? financials?.totalFares ?? 0
                  )}
                </div>
                <div className="stat-card-sub">Gross fare revenue for period</div>
              </div>
              <div className="stat-card">
                <div className="stat-card-label">Platform Fees Collected</div>
                <div className="stat-card-value">
                  {formatCurrency(
                    financials?.platform_fees ?? financials?.platformFees ?? 0
                  )}
                </div>
                <div className="stat-card-sub">
                  {financials?.fee_percent ?? financials?.feePercent ?? '—'}% of fares
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-card-label">Total Rides</div>
                <div className="stat-card-value">
                  {formatNumber(
                    financials?.total_rides ?? financials?.totalRides ?? 0
                  )}
                </div>
                <div className="stat-card-sub">Completed rides this period</div>
              </div>
            </div>
          </section>

          {/* Cost Breakdown */}
          <section className="detail-section">
            <h2 className="section-title">Cost Breakdown</h2>
            <div className="card">
              <div className="card-body">
                {getCostBreakdown().length > 0 ? (
                  <>
                    {/* Stacked Bar */}
                    <div className="stacked-bar mb-24">
                      {getCostBreakdown().map((item) => (
                        <div
                          key={item.key}
                          className="stacked-bar-segment"
                          style={{
                            width: `${item.percent}%`,
                            backgroundColor: item.color,
                          }}
                          title={`${item.label}: ${formatCurrency(item.value)} (${item.percent}%)`}
                        >
                          {parseFloat(item.percent) > 10
                            ? `${item.percent}%`
                            : ''}
                        </div>
                      ))}
                    </div>

                    {/* Legend */}
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '16px 32px',
                      }}
                    >
                      {getCostBreakdown().map((item) => (
                        <div
                          key={item.key}
                          style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                        >
                          <div
                            style={{
                              width: 12,
                              height: 12,
                              borderRadius: 3,
                              background: item.color,
                              flexShrink: 0,
                            }}
                          />
                          <span className="text-sm">
                            {item.label}:{' '}
                            <strong>{formatCurrency(item.value)}</strong>{' '}
                            <span className="text-muted">({item.percent}%)</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="empty-state">
                    <p>No cost data available for this period.</p>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Surplus Section */}
          <section className="detail-section">
            <h2 className="section-title">Surplus &amp; Redistribution</h2>
            <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
              <div className="stat-card">
                <div className="stat-card-label">Surplus Available</div>
                <div className="stat-card-value primary">
                  {formatCurrency(
                    financials?.surplus_amount ??
                      financials?.surplusAmount ??
                      financials?.surplus ??
                      0
                  )}
                </div>
                <div className="stat-card-sub">Revenue minus all costs</div>
              </div>
              <div className="stat-card">
                <div className="stat-card-label">Redistribution Status</div>
                <div className="stat-card-value" style={{ fontSize: 20 }}>
                  <span
                    className={`badge ${
                      (financials?.redistribution_status ??
                        financials?.redistributionStatus) === 'distributed'
                        ? 'badge-green'
                        : (financials?.redistribution_status ??
                            financials?.redistributionStatus) === 'pending'
                        ? 'badge-yellow'
                        : 'badge-gray'
                    }`}
                  >
                    {(
                      financials?.redistribution_status ??
                      financials?.redistributionStatus ??
                      'Pending'
                    )
                      .replace(/_/g, ' ')
                      .replace(/\b\w/g, (c) => c.toUpperCase())}
                  </span>
                </div>
                <div className="stat-card-sub">
                  Surplus is returned to drivers and community
                </div>
              </div>
            </div>
          </section>

          {/* Driver Stats */}
          <section className="detail-section">
            <h2 className="section-title">Driver Earnings (Anonymized)</h2>
            <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
              <div className="stat-card">
                <div className="stat-card-label">Median Earnings / Ride</div>
                <div className="stat-card-value">
                  {formatCurrency(
                    driverStats?.median_earnings_per_ride ??
                      driverStats?.medianEarningsPerRide ??
                      0
                  )}
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-card-label">Average Earnings / Ride</div>
                <div className="stat-card-value">
                  {formatCurrency(
                    driverStats?.average_earnings_per_ride ??
                      driverStats?.averageEarningsPerRide ??
                      0
                  )}
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-card-label">Total Paid to Drivers</div>
                <div className="stat-card-value primary">
                  {formatCurrency(
                    driverStats?.total_paid_to_drivers ??
                      driverStats?.totalPaidToDrivers ??
                      0
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Transparency Notice */}
          <div className="notice notice-success">
            <span className="notice-icon">&#9432;</span>
            <div>
              <strong>Every dollar is accounted for.</strong>
              <br />
              OpenRide operates with full financial transparency. All platform fees,
              operational costs, and surplus distributions are publicly reported.{' '}
              <a
                href="https://github.com/openride"
                target="_blank"
                rel="noopener noreferrer"
              >
                View the source code
              </a>{' '}
              to verify our reporting mechanisms.
            </div>
          </div>
        </>
      )}
    </div>
  );
}
