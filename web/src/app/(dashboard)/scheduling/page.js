'use client';

import { useState, useEffect } from 'react';
import {
  fetchAPI,
  formatDateTime,
  isAuthenticated,
} from '../../../lib/api';

const STATUS_BADGE = {
  scheduled: 'badge-blue',
  matched: 'badge-green',
  cancelled: 'badge-red',
  completed: 'badge-green',
  pending: 'badge-yellow',
  in_progress: 'badge-blue',
  no_match: 'badge-yellow',
};

const VEHICLE_TYPES = [
  { value: 'standard', label: 'Standard' },
  { value: 'premium', label: 'Premium' },
  { value: 'xl', label: 'XL' },
  { value: 'pool', label: 'Pool' },
  { value: 'accessible', label: 'Accessible' },
];

const FILTER_TABS = ['all', 'scheduled', 'matched', 'cancelled'];

function statusLabel(s) {
  return (s ?? 'unknown')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function SchedulingPage() {
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [rides, setRides] = useState([]);
  const [activeTab, setActiveTab] = useState('all');
  const [selectedRide, setSelectedRide] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [form, setForm] = useState({
    pickup_address: '',
    dropoff_address: '',
    scheduled_time: '',
    vehicle_type: 'standard',
    notes: '',
    accessibility_required: false,
  });

  useEffect(() => {
    const isAuth = isAuthenticated();
    setAuthed(isAuth);
    if (isAuth) {
      loadScheduledRides();
    } else {
      setLoading(false);
    }
  }, []);

  async function loadScheduledRides() {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchAPI('/scheduling');
      setRides(
        Array.isArray(data) ? data : data?.rides ?? data?.scheduled_rides ?? data?.data ?? []
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      setSubmitting(true);
      await fetchAPI('/scheduling', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setForm({
        pickup_address: '',
        dropoff_address: '',
        scheduled_time: '',
        vehicle_type: 'standard',
        notes: '',
        accessibility_required: false,
      });
      setShowForm(false);
      await loadScheduledRides();
    } catch (err) {
      alert('Failed to schedule ride: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancel(rideId, e) {
    if (e) e.stopPropagation();
    if (!confirm('Are you sure you want to cancel this scheduled ride?')) return;
    try {
      await fetchAPI(`/scheduling/${rideId}/cancel`, { method: 'POST' });
      await loadScheduledRides();
    } catch (err) {
      alert('Failed to cancel ride: ' + err.message);
    }
  }

  async function loadRideDetail(id) {
    try {
      const data = await fetchAPI(`/scheduling/${id}`);
      setSelectedRide(data?.ride ?? data);
    } catch (err) {
      alert('Failed to load ride details: ' + err.message);
    }
  }

  const filteredRides =
    activeTab === 'all'
      ? rides
      : rides.filter((r) => r.status === activeTab);

  if (!authed) {
    return (
      <div className="page-container">
        <div className="page-header">
          <h1>Ride Scheduling</h1>
          <p>Schedule and manage upcoming rides</p>
        </div>
        <div className="card">
          <div className="card-body" style={{ textAlign: 'center', padding: 60 }}>
            <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }}>
              &#9888;
            </div>
            <h3 style={{ marginBottom: 8 }}>Authentication Required</h3>
            <p className="text-muted" style={{ maxWidth: 400, margin: '0 auto' }}>
              You need to be logged in to schedule and manage rides. Please
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
          <h1>Ride Scheduling</h1>
          <p>Schedule and manage upcoming rides</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? 'Cancel' : '+ Schedule New Ride'}
        </button>
      </div>

      {/* Schedule New Ride Form */}
      {showForm && (
        <div className="card mb-32">
          <div className="card-header">
            <h2>Schedule New Ride</h2>
          </div>
          <div className="card-body">
            <form onSubmit={handleSubmit}>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Pickup Address</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Enter pickup location"
                    value={form.pickup_address}
                    onChange={(e) =>
                      setForm({ ...form, pickup_address: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Dropoff Address</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Enter dropoff location"
                    value={form.dropoff_address}
                    onChange={(e) =>
                      setForm({ ...form, dropoff_address: e.target.value })
                    }
                    required
                  />
                </div>
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Date & Time</label>
                  <input
                    type="datetime-local"
                    className="form-input"
                    value={form.scheduled_time}
                    onChange={(e) =>
                      setForm({ ...form, scheduled_time: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Vehicle Type</label>
                  <select
                    className="form-select"
                    value={form.vehicle_type}
                    onChange={(e) =>
                      setForm({ ...form, vehicle_type: e.target.value })
                    }
                  >
                    {VEHICLE_TYPES.map((vt) => (
                      <option key={vt.value} value={vt.value}>
                        {vt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea
                  className="form-textarea"
                  placeholder="Any special instructions or notes (optional)"
                  value={form.notes}
                  onChange={(e) =>
                    setForm({ ...form, notes: e.target.value })
                  }
                  rows={3}
                />
              </div>

              <div className="form-group">
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    cursor: 'pointer',
                    fontSize: 14,
                    fontWeight: 500,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={form.accessibility_required}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        accessibility_required: e.target.checked,
                      })
                    }
                    style={{ width: 18, height: 18, accentColor: 'var(--primary)' }}
                  />
                  Accessibility features required
                </label>
              </div>

              <div className="btn-group">
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting}
                >
                  {submitting ? 'Scheduling...' : 'Schedule Ride'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowForm(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Ride Detail Modal */}
      {selectedRide && (
        <div
          className="modal-overlay"
          onClick={() => setSelectedRide(null)}
        >
          <div
            className="modal"
            style={{ maxWidth: 700 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2>Scheduled Ride #{selectedRide.id}</h2>
              <button
                className="modal-close"
                onClick={() => setSelectedRide(null)}
              >
                &times;
              </button>
            </div>
            <div className="modal-body">
              <div className="detail-grid mb-24">
                <dt>Pickup</dt>
                <dd>
                  {selectedRide.pickup_address ??
                    selectedRide.pickupAddress ??
                    selectedRide.pickup ??
                    '—'}
                </dd>
                <dt>Dropoff</dt>
                <dd>
                  {selectedRide.dropoff_address ??
                    selectedRide.dropoffAddress ??
                    selectedRide.dropoff ??
                    '—'}
                </dd>
                <dt>Scheduled Time</dt>
                <dd>
                  {formatDateTime(
                    selectedRide.scheduled_time ??
                      selectedRide.scheduledTime ??
                      selectedRide.scheduled_at
                  )}
                </dd>
                <dt>Vehicle Type</dt>
                <dd>
                  {statusLabel(
                    selectedRide.vehicle_type ??
                      selectedRide.vehicleType ??
                      ''
                  )}
                </dd>
                <dt>Status</dt>
                <dd>
                  <span
                    className={`badge ${
                      STATUS_BADGE[selectedRide.status] ?? 'badge-gray'
                    }`}
                  >
                    {statusLabel(selectedRide.status)}
                  </span>
                </dd>
                {selectedRide.driver_name && (
                  <>
                    <dt>Driver</dt>
                    <dd>
                      {selectedRide.driver_name ??
                        selectedRide.driverName ??
                        '—'}
                    </dd>
                  </>
                )}
                <dt>Created</dt>
                <dd>
                  {formatDateTime(
                    selectedRide.created_at ?? selectedRide.createdAt
                  )}
                </dd>
              </div>

              {(selectedRide.notes ?? selectedRide.special_instructions) && (
                <div>
                  <h3 style={{ marginBottom: 8, fontSize: 14, fontWeight: 600 }}>
                    Notes
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
                    {selectedRide.notes ?? selectedRide.special_instructions}
                  </div>
                </div>
              )}

              {selectedRide.accessibility_required && (
                <div className="notice notice-info mt-16">
                  <span className="notice-icon">&#9855;</span>
                  <div>Accessibility features are required for this ride.</div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              {selectedRide.status === 'scheduled' && (
                <button
                  className="btn btn-danger"
                  onClick={() => {
                    handleCancel(selectedRide.id);
                    setSelectedRide(null);
                  }}
                >
                  Cancel Ride
                </button>
              )}
              <button
                className="btn btn-secondary"
                onClick={() => setSelectedRide(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="tabs mb-24">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab}
            className={`tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {statusLabel(tab)}
            {tab !== 'all' && (
              <span style={{ marginLeft: 6, opacity: 0.6, fontSize: 12 }}>
                ({rides.filter((r) => r.status === tab).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Rides List */}
      {loading ? (
        <div className="loading-container">
          <div className="spinner" />
          <p>Loading scheduled rides...</p>
        </div>
      ) : error ? (
        <div className="error-message">
          <p>Failed to load scheduled rides: {error}</p>
          <button className="btn btn-primary" onClick={loadScheduledRides}>
            Retry
          </button>
        </div>
      ) : filteredRides.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">&#128197;</div>
          <h3>No scheduled rides</h3>
          <p>
            {activeTab === 'all'
              ? 'You have no scheduled rides yet. Click "Schedule New Ride" to get started.'
              : `No rides with status "${statusLabel(activeTab)}" found.`}
          </p>
        </div>
      ) : (
        <div className="card">
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Pickup</th>
                  <th>Dropoff</th>
                  <th>Scheduled Time</th>
                  <th>Vehicle Type</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRides.map((ride) => (
                  <tr
                    key={ride.id}
                    className="clickable"
                    onClick={() => loadRideDetail(ride.id)}
                  >
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>
                      #{ride.id}
                    </td>
                    <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {ride.pickup_address ??
                        ride.pickupAddress ??
                        ride.pickup ??
                        '—'}
                    </td>
                    <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {ride.dropoff_address ??
                        ride.dropoffAddress ??
                        ride.dropoff ??
                        '—'}
                    </td>
                    <td className="text-sm">
                      {formatDateTime(
                        ride.scheduled_time ??
                          ride.scheduledTime ??
                          ride.scheduled_at
                      )}
                    </td>
                    <td>
                      {statusLabel(
                        ride.vehicle_type ?? ride.vehicleType ?? ''
                      )}
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          STATUS_BADGE[ride.status] ?? 'badge-gray'
                        }`}
                      >
                        {statusLabel(ride.status)}
                      </span>
                    </td>
                    <td>
                      {ride.status === 'scheduled' ? (
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={(e) => handleCancel(ride.id, e)}
                        >
                          Cancel
                        </button>
                      ) : (
                        <button
                          className="btn btn-sm btn-outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            loadRideDetail(ride.id);
                          }}
                        >
                          View
                        </button>
                      )}
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
