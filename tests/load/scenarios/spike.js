/**
 * Spike Test — Simulate a sudden surge in traffic for OpenRide API.
 *
 * Purpose:  Verify the system can handle sudden, dramatic traffic spikes
 *           (e.g., a concert ending, a sporting event, or a flash sale)
 *           and recover gracefully afterward.
 *
 * Stages:
 *   10 VUs for 2 minutes   (normal baseline)
 *   200 VUs for 1 minute   (sudden spike — 20x increase)
 *   10 VUs for 2 minutes   (recovery — monitor how quickly it normalizes)
 *   200 VUs for 1 minute   (second spike — test repeated surges)
 *   10 VUs for 2 minutes   (final recovery)
 *
 * Total: ~8 minutes
 *
 * Run:  k6 run tests/load/scenarios/spike.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Counter, Rate } from 'k6/metrics';
import {
  BASE_URL, API_PREFIX, authHeaders,
  randomSleep, uniqueId,
} from '../config.js';
import { ensureUserAndGetToken } from '../helpers/auth.js';
import {
  requestRide, getRideStatus, cancelRide, getFareEstimate,
} from '../helpers/ride.js';
import { randomPickup } from '../helpers/data.js';

// ---------------------------------------------------------------------------
// Custom metrics
// ---------------------------------------------------------------------------
const rideRequestDuration = new Trend('ride_request_duration', true);
const recoveryDuration = new Trend('recovery_response_time', true);
const spikeErrors = new Counter('spike_errors');
const spikeRequests = new Counter('spike_requests');

// ---------------------------------------------------------------------------
// k6 options
// ---------------------------------------------------------------------------
export const options = {
  stages: [
    // Baseline
    { duration: '2m', target: 10 },

    // First spike — sudden surge to 200 VUs
    { duration: '10s', target: 200 },  // Rapid ramp (10s)
    { duration: '50s', target: 200 },  // Hold spike for ~1 minute total

    // Recovery
    { duration: '10s', target: 10 },   // Rapid drop
    { duration: '1m50s', target: 10 }, // Monitor recovery for ~2 minutes

    // Second spike — test resilience to repeated surges
    { duration: '10s', target: 200 },
    { duration: '50s', target: 200 },

    // Final recovery
    { duration: '10s', target: 10 },
    { duration: '1m50s', target: 10 },
  ],
  thresholds: {
    // During spikes, some degradation is expected — but we still want bounds
    http_req_duration: ['p(95)<3000', 'p(99)<8000'],
    http_req_failed: ['rate<0.15'],
    // Recovery phase should return to near-normal latency
    recovery_response_time: ['p(95)<1000'],
  },
};

// ---------------------------------------------------------------------------
// Default function — fast-paced ride request flow
// ---------------------------------------------------------------------------
export default function () {
  const uid = uniqueId();
  const email = `lt-spike-${uid}@openride.test`;
  const password = `LT_spike_${uid}!`;

  spikeRequests.add(1);

  // Quick registration/login
  const token = ensureUserAndGetToken(email, password, 'passenger', {
    firstName: 'Spike',
    lastName: `U${uid}`,
  });

  if (!token) {
    spikeErrors.add(1);
    sleep(randomSleep(0.5, 1));
    return;
  }

  sleep(randomSleep(0.3, 0.8));

  // Health check — used to track recovery performance
  const healthStart = Date.now();
  const healthRes = http.get(`${BASE_URL}/health`, {
    tags: { name: 'GET /health' },
  });
  recoveryDuration.add(Date.now() - healthStart);

  check(healthRes, {
    'health: status 200': (r) => r.status === 200,
  });

  sleep(randomSleep(0.2, 0.5));

  // Fare estimate — common pre-ride action
  getFareEstimate(token);
  sleep(randomSleep(0.3, 0.8));

  // Request a ride
  const rideStart = Date.now();
  const result = requestRide(token);
  rideRequestDuration.add(Date.now() - rideStart);

  if (!result || !result.ride) {
    spikeErrors.add(1);
    sleep(randomSleep(0.5, 1));
    return;
  }

  const rideId = result.ride.id;
  sleep(randomSleep(0.3, 0.8));

  // Quick status check
  getRideStatus(token, rideId);
  sleep(randomSleep(0.2, 0.5));

  // Cancel to keep the system clean
  cancelRide(token, rideId, 'Spike test');
  sleep(randomSleep(0.5, 1.5));
}
