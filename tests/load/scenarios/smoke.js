/**
 * Smoke Test — Quick sanity check for OpenRide API.
 *
 * Purpose:  Verify core endpoints are functional with minimal load.
 * VUs:      1
 * Duration: 1 minute
 *
 * Run:  k6 run tests/load/scenarios/smoke.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, API_PREFIX, defaultHeaders, authHeaders, standardThresholds, randomSleep } from '../config.js';
import { registerUser, loginUser } from '../helpers/auth.js';
import { requestRide, getRideStatus, cancelRide } from '../helpers/ride.js';
import { randomUserData, randomPickup, randomDropoff } from '../helpers/data.js';

// ---------------------------------------------------------------------------
// k6 options
// ---------------------------------------------------------------------------
export const options = {
  vus: 1,
  duration: '1m',
  thresholds: standardThresholds,
};

// ---------------------------------------------------------------------------
// Default function — executed once per iteration per VU
// ---------------------------------------------------------------------------
export default function () {
  // -----------------------------------------------------------------------
  // Step 1: Health check
  // -----------------------------------------------------------------------
  const healthRes = http.get(`${BASE_URL}/health`, {
    tags: { name: 'GET /health' },
  });

  check(healthRes, {
    'health: status is 200': (r) => r.status === 200,
    'health: status field is ok': (r) => {
      try {
        return r.json().status === 'ok';
      } catch {
        return false;
      }
    },
    'health: has services info': (r) => {
      try {
        const body = r.json();
        return body.services && body.services.database === 'ok';
      } catch {
        return false;
      }
    },
  });

  sleep(randomSleep(0.5, 1));

  // -----------------------------------------------------------------------
  // Step 2: Register a unique user
  // -----------------------------------------------------------------------
  const userData = randomUserData('passenger', `smoke-${__VU}-${__ITER}`);
  const regResult = registerUser(
    userData.email,
    userData.password,
    'passenger',
    { firstName: userData.firstName, lastName: userData.lastName, phone: userData.phone },
  );

  check(regResult, {
    'register: got result': (r) => r !== null,
    'register: has access token': (r) => r && !!r.accessToken,
  });

  if (!regResult || !regResult.accessToken) {
    console.warn(`[smoke] Registration failed for ${userData.email}, skipping remaining steps`);
    return;
  }

  sleep(randomSleep(0.5, 1));

  // -----------------------------------------------------------------------
  // Step 3: Login with the same user
  // -----------------------------------------------------------------------
  const loginResult = loginUser(userData.email, userData.password);

  check(loginResult, {
    'login: got result': (r) => r !== null,
    'login: has access token': (r) => r && !!r.accessToken,
    'login: user email matches': (r) => r && r.user && r.user.email === userData.email,
  });

  const token = loginResult ? loginResult.accessToken : regResult.accessToken;

  sleep(randomSleep(0.5, 1));

  // -----------------------------------------------------------------------
  // Step 4: Request a ride
  // -----------------------------------------------------------------------
  const rideResult = requestRide(token);

  check(rideResult, {
    'ride request: got result': (r) => r !== null,
    'ride request: has ride object': (r) => r && r.ride && !!r.ride.id,
    'ride request: status is requested': (r) => r && r.ride && r.ride.status === 'requested',
    'ride request: has fare estimate': (r) => r && r.fareEstimate && r.fareEstimate.fare > 0,
  });

  if (!rideResult || !rideResult.ride) {
    console.warn('[smoke] Ride request failed, skipping remaining steps');
    return;
  }

  const rideId = rideResult.ride.id;

  sleep(randomSleep(0.5, 1));

  // -----------------------------------------------------------------------
  // Step 5: Check ride status
  // -----------------------------------------------------------------------
  const statusResult = getRideStatus(token, rideId);

  check(statusResult, {
    'ride status: got result': (r) => r !== null,
    'ride status: id matches': (r) => r && r.id === rideId,
  });

  sleep(randomSleep(0.5, 1));

  // -----------------------------------------------------------------------
  // Step 6: Cancel the ride
  // -----------------------------------------------------------------------
  const cancelResult = cancelRide(token, rideId, 'Smoke test cleanup');

  check(cancelResult, {
    'cancel ride: got result': (r) => r !== null,
    'cancel ride: status is cancelled': (r) => {
      try {
        return r.ride.status === 'cancelled';
      } catch {
        return false;
      }
    },
  });

  sleep(randomSleep(0.5, 1));

  // -----------------------------------------------------------------------
  // Step 7: Verify health endpoint is still responding
  // -----------------------------------------------------------------------
  const healthRes2 = http.get(`${BASE_URL}/health`, {
    tags: { name: 'GET /health' },
  });

  check(healthRes2, {
    'final health: status is 200': (r) => r.status === 200,
  });

  sleep(randomSleep(1, 2));
}
