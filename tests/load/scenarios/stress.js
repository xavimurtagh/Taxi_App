/**
 * Stress Test — Find the breaking point of the OpenRide API.
 *
 * Purpose:  Determine maximum throughput and identify failure modes under
 *           heavy load. Ramps up to 200 VUs to push past normal capacity.
 *
 * Stages:
 *   0  -> 50  VUs  over 2 minutes  (warm-up)
 *   50 -> 100 VUs  over 3 minutes  (moderate stress)
 *   100-> 200 VUs  over 5 minutes  (high stress)
 *   200 VUs        hold 5 minutes  (sustained peak)
 *   200-> 0  VUs   over 5 minutes  (cooldown / recovery)
 *
 * Total: ~20 minutes
 *
 * Run:  k6 run tests/load/scenarios/stress.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Counter, Rate } from 'k6/metrics';
import {
  BASE_URL, API_PREFIX, defaultHeaders, authHeaders,
  standardThresholds, randomSleep, uniqueId,
} from '../config.js';
import { ensureUserAndGetToken } from '../helpers/auth.js';
import {
  requestRide, getRideStatus, getActiveRide, cancelRide,
  getFareEstimate, getRideHistory,
} from '../helpers/ride.js';
import { randomPickup, randomDropoff, randomVehicleType } from '../helpers/data.js';

// ---------------------------------------------------------------------------
// Custom metrics
// ---------------------------------------------------------------------------
const loginDuration = new Trend('login_duration', true);
const rideRequestDuration = new Trend('ride_request_duration', true);
const healthCheckDuration = new Trend('health_check_duration', true);
const errorRate = new Rate('errors');
const requestCount = new Counter('total_requests');

// ---------------------------------------------------------------------------
// k6 options
// ---------------------------------------------------------------------------
export const options = {
  stages: [
    { duration: '2m', target: 50 },    // Warm-up: ramp to 50 VUs
    { duration: '3m', target: 100 },   // Moderate stress: ramp to 100 VUs
    { duration: '5m', target: 200 },   // High stress: ramp to 200 VUs
    { duration: '5m', target: 200 },   // Sustained peak: hold at 200
    { duration: '5m', target: 0 },     // Cooldown: ramp down to 0
  ],
  thresholds: {
    // Relaxed thresholds for stress testing — we expect degradation
    http_req_duration: ['p(95)<2000', 'p(99)<5000'],
    http_req_failed: ['rate<0.10'],  // Up to 10% error rate tolerated
    errors: ['rate<0.15'],
    health_check_duration: ['p(95)<1000'],
  },
};

// ---------------------------------------------------------------------------
// Default function — mixed traffic pattern
// ---------------------------------------------------------------------------
export default function () {
  const uid = uniqueId();
  const roll = Math.random();

  // Weight distribution:
  //   50% passenger flow (heaviest)
  //   20% driver flow
  //   15% governance browsing
  //   10% transparency viewing
  //   5%  health check only
  if (roll < 0.50) {
    stressPassengerFlow(uid);
  } else if (roll < 0.70) {
    stressDriverFlow(uid);
  } else if (roll < 0.85) {
    stressGovernanceFlow(uid);
  } else if (roll < 0.95) {
    stressTransparencyFlow(uid);
  } else {
    stressHealthCheck();
  }
}

// ---------------------------------------------------------------------------
// Passenger flow under stress
// ---------------------------------------------------------------------------
function stressPassengerFlow(uid) {
  const email = `lt-stress-pass-${uid}@openride.test`;
  const password = `LT_SP_${uid}!`;

  // Login
  const loginStart = Date.now();
  const token = ensureUserAndGetToken(email, password, 'passenger', {
    firstName: 'Stress',
    lastName: `P${uid}`,
  });
  loginDuration.add(Date.now() - loginStart);
  requestCount.add(1);

  if (!token) {
    errorRate.add(1);
    sleep(randomSleep(1, 2));
    return;
  }
  errorRate.add(0);

  sleep(randomSleep(0.5, 1));

  // Fare estimate
  getFareEstimate(token);
  requestCount.add(1);
  sleep(randomSleep(0.5, 1));

  // Request ride
  const rideStart = Date.now();
  const result = requestRide(token);
  rideRequestDuration.add(Date.now() - rideStart);
  requestCount.add(1);

  if (!result || !result.ride) {
    errorRate.add(1);
    sleep(randomSleep(1, 2));
    return;
  }
  errorRate.add(0);

  const rideId = result.ride.id;
  sleep(randomSleep(0.5, 1.5));

  // Check status
  getRideStatus(token, rideId);
  requestCount.add(1);
  sleep(randomSleep(0.3, 0.8));

  // Cancel to clean up
  cancelRide(token, rideId, 'Stress test');
  requestCount.add(1);
  sleep(randomSleep(0.5, 1));

  // History
  getRideHistory(token, 1, 5);
  requestCount.add(1);
  sleep(randomSleep(0.5, 1.5));
}

// ---------------------------------------------------------------------------
// Driver flow under stress
// ---------------------------------------------------------------------------
function stressDriverFlow(uid) {
  const email = `lt-stress-drv-${uid}@openride.test`;
  const password = `LT_SD_${uid}!`;

  const loginStart = Date.now();
  const token = ensureUserAndGetToken(email, password, 'driver', {
    firstName: 'Stress',
    lastName: `D${uid}`,
  });
  loginDuration.add(Date.now() - loginStart);
  requestCount.add(1);

  if (!token) {
    errorRate.add(1);
    sleep(randomSleep(1, 2));
    return;
  }
  errorRate.add(0);

  sleep(randomSleep(0.5, 1));

  // Update location
  const pickup = randomPickup();
  const locRes = http.put(
    `${API_PREFIX}/drivers/location`,
    JSON.stringify({ lat: pickup.lat, lng: pickup.lng }),
    {
      headers: authHeaders(token),
      tags: { name: 'PUT /drivers/location' },
    },
  );
  requestCount.add(1);
  check(locRes, { 'driver location: not 5xx': (r) => r.status < 500 });

  sleep(randomSleep(0.5, 1));

  // Check for active rides
  getActiveRide(token);
  requestCount.add(1);
  sleep(randomSleep(0.5, 1.5));

  // History
  getRideHistory(token, 1, 5);
  requestCount.add(1);
  sleep(randomSleep(0.5, 1));
}

// ---------------------------------------------------------------------------
// Governance browsing under stress
// ---------------------------------------------------------------------------
function stressGovernanceFlow(uid) {
  const email = `lt-stress-gov-${uid}@openride.test`;
  const password = `LT_SG_${uid}!`;

  const token = ensureUserAndGetToken(email, password, 'passenger', {
    firstName: 'Stress',
    lastName: `G${uid}`,
  });
  requestCount.add(1);

  if (!token) {
    errorRate.add(1);
    sleep(randomSleep(1, 2));
    return;
  }
  errorRate.add(0);

  sleep(randomSleep(0.5, 1));

  // List proposals
  const start = Date.now();
  const res = http.get(`${API_PREFIX}/governance/proposals?page=1&limit=20`, {
    headers: authHeaders(token),
    tags: { name: 'GET /governance/proposals' },
  });
  requestCount.add(1);

  check(res, {
    'governance list: not 5xx': (r) => r.status < 500,
  });

  sleep(randomSleep(0.5, 1.5));

  // View config
  const configRes = http.get(`${API_PREFIX}/governance/config`, {
    headers: authHeaders(token),
    tags: { name: 'GET /governance/config' },
  });
  requestCount.add(1);
  check(configRes, {
    'governance config: not 5xx': (r) => r.status < 500,
  });

  sleep(randomSleep(0.5, 1));
}

// ---------------------------------------------------------------------------
// Transparency viewing under stress
// ---------------------------------------------------------------------------
function stressTransparencyFlow(uid) {
  const email = `lt-stress-trans-${uid}@openride.test`;
  const password = `LT_ST_${uid}!`;

  const token = ensureUserAndGetToken(email, password, 'passenger', {
    firstName: 'Stress',
    lastName: `T${uid}`,
  });
  requestCount.add(1);

  if (!token) {
    errorRate.add(1);
    sleep(randomSleep(1, 2));
    return;
  }
  errorRate.add(0);

  sleep(randomSleep(0.5, 1));

  const res = http.get(`${API_PREFIX}/transparency/financials?period=current_quarter`, {
    headers: authHeaders(token),
    tags: { name: 'GET /transparency/financials' },
  });
  requestCount.add(1);
  check(res, {
    'transparency: not 5xx': (r) => r.status < 500,
  });

  sleep(randomSleep(0.5, 1.5));
}

// ---------------------------------------------------------------------------
// Health check — lightweight canary
// ---------------------------------------------------------------------------
function stressHealthCheck() {
  const start = Date.now();
  const res = http.get(`${BASE_URL}/health`, {
    tags: { name: 'GET /health' },
  });
  healthCheckDuration.add(Date.now() - start);
  requestCount.add(1);

  check(res, {
    'health: status 200': (r) => r.status === 200,
  });

  sleep(randomSleep(1, 3));
}
