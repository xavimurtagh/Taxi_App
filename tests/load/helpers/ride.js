/**
 * Ride helper functions for k6 load tests.
 *
 * Wraps the /api/v1/rides endpoints with proper checks and tagging so
 * that k6 metrics are clean and easy to interpret.
 */

import http from 'k6/http';
import { check } from 'k6';
import { API_PREFIX, authHeaders } from '../config.js';
import { randomPickup, randomDropoff } from './data.js';

/**
 * Request a new ride as a passenger.
 *
 * @param {string} token — JWT access token
 * @param {object} [pickup] — { lat, lng, address } or auto-generated
 * @param {object} [dropoff] — { lat, lng, address } or auto-generated
 * @param {string} [vehicleType] — 'economy' | 'comfort' | 'premium'
 * @returns {{ ride: object, fareEstimate: object } | null}
 */
export function requestRide(token, pickup, dropoff, vehicleType) {
  const p = pickup || randomPickup();
  const d = dropoff || randomDropoff();

  const payload = JSON.stringify({
    pickupLat: p.lat,
    pickupLng: p.lng,
    pickupAddress: p.address,
    dropoffLat: d.lat,
    dropoffLng: d.lng,
    dropoffAddress: d.address,
    vehicleType: vehicleType || 'economy',
  });

  const res = http.post(`${API_PREFIX}/rides`, payload, {
    headers: authHeaders(token),
    tags: { name: 'POST /rides' },
  });

  check(res, {
    'request ride: status is 201': (r) => r.status === 201,
    'request ride: has ride id': (r) => {
      try {
        return !!r.json().ride.id;
      } catch {
        return false;
      }
    },
  });

  if (res.status === 201) {
    return res.json();
  }

  return null;
}

/**
 * Get the status of a specific ride.
 *
 * @param {string} token — JWT access token
 * @param {string} rideId — UUID of the ride
 * @returns {object|null} ride details
 */
export function getRideStatus(token, rideId) {
  const res = http.get(`${API_PREFIX}/rides/${rideId}`, {
    headers: authHeaders(token),
    tags: { name: 'GET /rides/:id' },
  });

  check(res, {
    'get ride: status is 200': (r) => r.status === 200,
  });

  if (res.status === 200) {
    return res.json();
  }

  return null;
}

/**
 * Get the current user's active ride.
 *
 * @param {string} token — JWT access token
 * @returns {object|null}
 */
export function getActiveRide(token) {
  const res = http.get(`${API_PREFIX}/rides/active`, {
    headers: authHeaders(token),
    tags: { name: 'GET /rides/active' },
  });

  check(res, {
    'active ride: status is 200': (r) => r.status === 200,
  });

  if (res.status === 200) {
    return res.json();
  }

  return null;
}

/**
 * Cancel an existing ride.
 *
 * @param {string} token — JWT access token
 * @param {string} rideId — UUID of the ride
 * @param {string} [reason] — optional cancellation reason
 * @returns {object|null}
 */
export function cancelRide(token, rideId, reason) {
  const payload = JSON.stringify({
    reason: reason || 'Load test cancellation',
  });

  const res = http.post(`${API_PREFIX}/rides/${rideId}/cancel`, payload, {
    headers: authHeaders(token),
    tags: { name: 'POST /rides/:id/cancel' },
  });

  check(res, {
    'cancel ride: status is 200': (r) => r.status === 200,
  });

  if (res.status === 200) {
    return res.json();
  }

  return null;
}

/**
 * Rate a completed ride.
 *
 * @param {string} token — JWT access token
 * @param {string} rideId — UUID of the ride
 * @param {number} score — rating 1-5
 * @param {string} [comment] — optional comment
 * @returns {object|null}
 */
export function rateRide(token, rideId, score, comment) {
  const payload = JSON.stringify({
    rideId,
    score: score || Math.floor(Math.random() * 3) + 3, // 3-5 star
    comment: comment || 'Load test rating',
  });

  const res = http.post(`${API_PREFIX}/ratings`, payload, {
    headers: authHeaders(token),
    tags: { name: 'POST /ratings' },
  });

  check(res, {
    'rate ride: status is 201 or 400': (r) => r.status === 201 || r.status === 400,
  });

  if (res.status === 201) {
    return res.json();
  }

  return null;
}

/**
 * Get a fare estimate without creating a ride.
 *
 * @param {string} token — JWT access token
 * @param {object} [pickup] — { lat, lng }
 * @param {object} [dropoff] — { lat, lng }
 * @param {string} [vehicleType]
 * @returns {object|null}
 */
export function getFareEstimate(token, pickup, dropoff, vehicleType) {
  const p = pickup || randomPickup();
  const d = dropoff || randomDropoff();

  const url =
    `${API_PREFIX}/rides/estimate` +
    `?pickupLat=${p.lat}&pickupLng=${p.lng}` +
    `&dropoffLat=${d.lat}&dropoffLng=${d.lng}` +
    `&vehicleType=${vehicleType || 'economy'}`;

  const res = http.get(url, {
    headers: authHeaders(token),
    tags: { name: 'GET /rides/estimate' },
  });

  check(res, {
    'fare estimate: status is 200': (r) => r.status === 200,
  });

  if (res.status === 200) {
    return res.json();
  }

  return null;
}

/**
 * Get ride history for the current user.
 *
 * @param {string} token — JWT access token
 * @param {number} [page]
 * @param {number} [limit]
 * @returns {object|null}
 */
export function getRideHistory(token, page, limit) {
  const url = `${API_PREFIX}/rides/history?page=${page || 1}&limit=${limit || 10}`;

  const res = http.get(url, {
    headers: authHeaders(token),
    tags: { name: 'GET /rides/history' },
  });

  check(res, {
    'ride history: status is 200': (r) => r.status === 200,
  });

  if (res.status === 200) {
    return res.json();
  }

  return null;
}

/**
 * Driver accepts a ride.
 *
 * @param {string} token — driver JWT access token
 * @param {string} rideId
 * @returns {object|null}
 */
export function acceptRide(token, rideId) {
  const res = http.post(`${API_PREFIX}/rides/${rideId}/accept`, null, {
    headers: authHeaders(token),
    tags: { name: 'POST /rides/:id/accept' },
  });

  check(res, {
    'accept ride: status is 200': (r) => r.status === 200,
  });

  if (res.status === 200) {
    return res.json();
  }

  return null;
}

/**
 * Driver marks as arriving to pickup.
 *
 * @param {string} token — driver JWT access token
 * @param {string} rideId
 * @returns {object|null}
 */
export function markArriving(token, rideId) {
  const res = http.post(`${API_PREFIX}/rides/${rideId}/arriving`, null, {
    headers: authHeaders(token),
    tags: { name: 'POST /rides/:id/arriving' },
  });

  check(res, {
    'arriving: status is 200': (r) => r.status === 200,
  });

  if (res.status === 200) {
    return res.json();
  }

  return null;
}

/**
 * Driver picks up the passenger (start ride).
 *
 * @param {string} token — driver JWT access token
 * @param {string} rideId
 * @returns {object|null}
 */
export function pickupPassenger(token, rideId) {
  const res = http.post(`${API_PREFIX}/rides/${rideId}/pickup`, null, {
    headers: authHeaders(token),
    tags: { name: 'POST /rides/:id/pickup' },
  });

  check(res, {
    'pickup: status is 200': (r) => r.status === 200,
  });

  if (res.status === 200) {
    return res.json();
  }

  return null;
}

/**
 * Driver completes the ride.
 *
 * @param {string} token — driver JWT access token
 * @param {string} rideId
 * @param {number} [distanceKm]
 * @param {number} [durationMin]
 * @returns {object|null}
 */
export function completeRide(token, rideId, distanceKm, durationMin) {
  const payload = JSON.stringify({
    actualDistanceKm: distanceKm || (3 + Math.random() * 15).toFixed(1),
    actualDurationMin: durationMin || (5 + Math.random() * 30).toFixed(0),
  });

  const res = http.post(`${API_PREFIX}/rides/${rideId}/complete`, payload, {
    headers: authHeaders(token),
    tags: { name: 'POST /rides/:id/complete' },
  });

  check(res, {
    'complete ride: status is 200': (r) => r.status === 200,
  });

  if (res.status === 200) {
    return res.json();
  }

  return null;
}
