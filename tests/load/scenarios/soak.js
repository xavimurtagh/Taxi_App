/**
 * Soak / Endurance Test — Sustained load over an extended period.
 *
 * Purpose:  Detect problems that emerge over time, such as:
 *           - Memory leaks
 *           - Connection pool exhaustion
 *           - Gradual performance degradation
 *           - Resource accumulation (temp files, cache bloat)
 *           - Database connection leaks
 *
 * VUs:      30
 * Duration: 30 minutes (with 2-minute ramp-up and ramp-down)
 *
 * Run:  k6 run tests/load/scenarios/soak.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Counter, Rate, Gauge } from 'k6/metrics';
import {
  BASE_URL, API_PREFIX, defaultHeaders, authHeaders,
  standardThresholds, randomSleep, uniqueId,
} from '../config.js';
import { ensureUserAndGetToken } from '../helpers/auth.js';
import {
  requestRide, getRideStatus, getActiveRide, cancelRide,
  getFareEstimate, getRideHistory,
} from '../helpers/ride.js';
import { randomPickup } from '../helpers/data.js';

// ---------------------------------------------------------------------------
// Custom metrics — focused on detecting degradation over time
// ---------------------------------------------------------------------------
const healthLatency = new Trend('health_latency', true);
const rideLatency = new Trend('ride_request_latency', true);
const loginLatency = new Trend('login_latency', true);
const iterationErrors = new Counter('iteration_errors');
const totalIterations = new Counter('total_iterations');
const snapshotHealthLatency = new Gauge('snapshot_health_latency_p95');

// ---------------------------------------------------------------------------
// k6 options
// ---------------------------------------------------------------------------
export const options = {
  stages: [
    { duration: '2m', target: 30 },    // Ramp up to 30 VUs
    { duration: '26m', target: 30 },   // Sustained load for 26 minutes
    { duration: '2m', target: 0 },     // Ramp down
  ],
  thresholds: {
    // Standard performance thresholds — should hold even after 30 minutes
    http_req_duration: ['p(95)<800', 'p(99)<2000'],
    http_req_failed: ['rate<0.02'],
    // Health endpoint should remain consistently fast
    health_latency: ['p(95)<300', 'p(99)<800'],
    // Login should not degrade over time
    login_latency: ['p(95)<1000'],
    // Ride requests should remain responsive
    ride_request_latency: ['p(95)<1200'],
  },
};

// ---------------------------------------------------------------------------
// Periodic metrics snapshot — logs health check latency at intervals
// so you can visually detect degradation trends in the k6 output.
// ---------------------------------------------------------------------------
let lastSnapshotTime = 0;
const SNAPSHOT_INTERVAL_MS = 60_000; // Every 60 seconds

function maybeSnapshot() {
  const now = Date.now();
  if (now - lastSnapshotTime >= SNAPSHOT_INTERVAL_MS) {
    lastSnapshotTime = now;

    const start = Date.now();
    const res = http.get(`${BASE_URL}/health`, {
      tags: { name: 'GET /health (snapshot)' },
    });
    const elapsed = Date.now() - start;

    snapshotHealthLatency.add(elapsed);

    check(res, {
      'snapshot health: status 200': (r) => r.status === 200,
      'snapshot health: db ok': (r) => {
        try {
          return r.json().services.database === 'ok';
        } catch {
          return false;
        }
      },
    });
  }
}

// ---------------------------------------------------------------------------
// Default function — realistic mixed traffic at moderate load
// ---------------------------------------------------------------------------
export default function () {
  totalIterations.add(1);

  // Periodic health snapshot for trend analysis
  maybeSnapshot();

  const uid = uniqueId();
  const roll = Math.random();

  // Distribution: 55% passenger, 25% driver, 10% governance, 10% read-only
  if (roll < 0.55) {
    soakPassengerFlow(uid);
  } else if (roll < 0.80) {
    soakDriverFlow(uid);
  } else if (roll < 0.90) {
    soakGovernanceFlow(uid);
  } else {
    soakReadOnlyFlow(uid);
  }
}

// ---------------------------------------------------------------------------
// Passenger flow — soak version with extra timing
// ---------------------------------------------------------------------------
function soakPassengerFlow(uid) {
  const email = `lt-soak-pass-${uid}@openride.test`;
  const password = `LT_soak_p_${uid}!`;

  // Login
  const loginStart = Date.now();
  const token = ensureUserAndGetToken(email, password, 'passenger', {
    firstName: 'Soak',
    lastName: `P${uid}`,
  });
  loginLatency.add(Date.now() - loginStart);

  if (!token) {
    iterationErrors.add(1);
    sleep(randomSleep(1, 3));
    return;
  }

  sleep(randomSleep(1, 2));

  // Fare estimate
  getFareEstimate(token);
  sleep(randomSleep(1, 2));

  // Request ride
  const rideStart = Date.now();
  const result = requestRide(token);
  rideLatency.add(Date.now() - rideStart);

  if (!result || !result.ride) {
    iterationErrors.add(1);
    sleep(randomSleep(1, 3));
    return;
  }

  const rideId = result.ride.id;
  sleep(randomSleep(1, 3));

  // Poll status a couple of times (simulating user watching the app)
  for (let i = 0; i < 2; i++) {
    getRideStatus(token, rideId);
    sleep(randomSleep(1, 2));
  }

  // Cancel
  cancelRide(token, rideId, 'Soak test cleanup');
  sleep(randomSleep(1, 2));

  // History
  getRideHistory(token, 1, 10);
  sleep(randomSleep(1, 3));

  // Health check
  const hStart = Date.now();
  http.get(`${BASE_URL}/health`, { tags: { name: 'GET /health' } });
  healthLatency.add(Date.now() - hStart);

  sleep(randomSleep(2, 5));
}

// ---------------------------------------------------------------------------
// Driver flow — soak version
// ---------------------------------------------------------------------------
function soakDriverFlow(uid) {
  const email = `lt-soak-drv-${uid}@openride.test`;
  const password = `LT_soak_d_${uid}!`;

  const loginStart = Date.now();
  const token = ensureUserAndGetToken(email, password, 'driver', {
    firstName: 'Soak',
    lastName: `D${uid}`,
  });
  loginLatency.add(Date.now() - loginStart);

  if (!token) {
    iterationErrors.add(1);
    sleep(randomSleep(1, 3));
    return;
  }

  sleep(randomSleep(1, 2));

  // Update location
  const pickup = randomPickup();
  http.put(
    `${API_PREFIX}/drivers/location`,
    JSON.stringify({ lat: pickup.lat, lng: pickup.lng }),
    {
      headers: authHeaders(token),
      tags: { name: 'PUT /drivers/location' },
    },
  );
  sleep(randomSleep(1, 2));

  // Check active ride
  getActiveRide(token);
  sleep(randomSleep(1, 2));

  // History
  getRideHistory(token, 1, 10);
  sleep(randomSleep(1, 3));

  // Health check
  const hStart = Date.now();
  http.get(`${BASE_URL}/health`, { tags: { name: 'GET /health' } });
  healthLatency.add(Date.now() - hStart);

  sleep(randomSleep(2, 5));
}

// ---------------------------------------------------------------------------
// Governance flow — soak version
// ---------------------------------------------------------------------------
function soakGovernanceFlow(uid) {
  const email = `lt-soak-gov-${uid}@openride.test`;
  const password = `LT_soak_g_${uid}!`;

  const token = ensureUserAndGetToken(email, password, 'passenger', {
    firstName: 'Soak',
    lastName: `G${uid}`,
  });

  if (!token) {
    iterationErrors.add(1);
    sleep(randomSleep(1, 3));
    return;
  }

  sleep(randomSleep(1, 2));

  // List proposals
  http.get(`${API_PREFIX}/governance/proposals?page=1&limit=10`, {
    headers: authHeaders(token),
    tags: { name: 'GET /governance/proposals' },
  });
  sleep(randomSleep(2, 4));

  // Config
  http.get(`${API_PREFIX}/governance/config`, {
    headers: authHeaders(token),
    tags: { name: 'GET /governance/config' },
  });
  sleep(randomSleep(1, 3));

  // Health check
  const hStart = Date.now();
  http.get(`${BASE_URL}/health`, { tags: { name: 'GET /health' } });
  healthLatency.add(Date.now() - hStart);

  sleep(randomSleep(2, 5));
}

// ---------------------------------------------------------------------------
// Read-only flow — lightweight requests to detect connection pool issues
// ---------------------------------------------------------------------------
function soakReadOnlyFlow(uid) {
  const email = `lt-soak-ro-${uid}@openride.test`;
  const password = `LT_soak_r_${uid}!`;

  const token = ensureUserAndGetToken(email, password, 'passenger', {
    firstName: 'Soak',
    lastName: `R${uid}`,
  });

  if (!token) {
    iterationErrors.add(1);
    sleep(randomSleep(1, 3));
    return;
  }

  sleep(randomSleep(1, 2));

  // Multiple health checks in sequence (connection pool stress)
  for (let i = 0; i < 3; i++) {
    const hStart = Date.now();
    const res = http.get(`${BASE_URL}/health`, { tags: { name: 'GET /health' } });
    healthLatency.add(Date.now() - hStart);

    check(res, {
      'soak health: status 200': (r) => r.status === 200,
    });

    sleep(randomSleep(1, 2));
  }

  // Financials
  http.get(`${API_PREFIX}/transparency/financials?period=current_quarter`, {
    headers: authHeaders(token),
    tags: { name: 'GET /transparency/financials' },
  });
  sleep(randomSleep(1, 3));

  // Fare estimate
  getFareEstimate(token);
  sleep(randomSleep(2, 4));
}
