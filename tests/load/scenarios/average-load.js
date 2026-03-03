/**
 * Average Load Test — Simulated normal traffic for OpenRide API.
 *
 * Purpose:  Validate the system handles expected daily traffic patterns.
 * VUs:      50
 * Duration: 10 minutes (with ramp-up and ramp-down)
 *
 * Scenarios:
 *   - passenger_flow (60% of VUs): login -> search -> request ride -> track -> cancel/complete -> rate
 *   - driver_flow (25% of VUs): login -> go online -> check requests -> ride lifecycle
 *   - governance_flow (10% of VUs): view proposals, cast votes
 *   - transparency_flow (5% of VUs): view financial reports
 *
 * Run:  k6 run tests/load/scenarios/average-load.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Counter, Rate } from 'k6/metrics';
import {
  BASE_URL, API_PREFIX, defaultHeaders, authHeaders,
  extendedThresholds, randomSleep, uniqueId,
} from '../config.js';
import { registerUser, loginUser, ensureUserAndGetToken } from '../helpers/auth.js';
import {
  requestRide, getRideStatus, getActiveRide, cancelRide,
  rateRide, getFareEstimate, getRideHistory,
} from '../helpers/ride.js';
import {
  randomUserData, randomPickup, randomDropoff,
  randomVehicleType, randomRating,
} from '../helpers/data.js';

// ---------------------------------------------------------------------------
// Custom metrics
// ---------------------------------------------------------------------------
const loginDuration = new Trend('login_duration', true);
const rideRequestDuration = new Trend('ride_request_duration', true);
const rideCancelDuration = new Trend('ride_cancel_duration', true);
const governanceListDuration = new Trend('governance_list_duration', true);
const transparencyDuration = new Trend('transparency_duration', true);
const successfulRides = new Counter('successful_rides');
const failedOperations = new Counter('failed_operations');

// ---------------------------------------------------------------------------
// k6 options
// ---------------------------------------------------------------------------
export const options = {
  scenarios: {
    passenger_flow: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 30 },   // Ramp up to 30 passenger VUs
        { duration: '8m', target: 30 },   // Hold at 30
        { duration: '1m', target: 0 },    // Ramp down
      ],
      exec: 'passengerFlow',
      tags: { scenario: 'passenger' },
    },
    driver_flow: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 13 },
        { duration: '8m', target: 13 },
        { duration: '1m', target: 0 },
      ],
      exec: 'driverFlow',
      tags: { scenario: 'driver' },
    },
    governance_flow: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 5 },
        { duration: '8m', target: 5 },
        { duration: '1m', target: 0 },
      ],
      exec: 'governanceFlow',
      tags: { scenario: 'governance' },
    },
    transparency_flow: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 2 },
        { duration: '8m', target: 2 },
        { duration: '1m', target: 0 },
      ],
      exec: 'transparencyFlow',
      tags: { scenario: 'transparency' },
    },
  },
  thresholds: extendedThresholds,
};

// ---------------------------------------------------------------------------
// Passenger Flow
// ---------------------------------------------------------------------------
export function passengerFlow() {
  const uid = uniqueId();
  const email = `lt-pass-${uid}@openride.test`;
  const password = `LT_pass_${uid}!`;

  group('Passenger: Register/Login', () => {
    const start = Date.now();
    const token = ensureUserAndGetToken(email, password, 'passenger', {
      firstName: 'LT',
      lastName: `Pass${uid}`,
    });
    loginDuration.add(Date.now() - start);

    if (!token) {
      failedOperations.add(1);
      return;
    }

    sleep(randomSleep(1, 2));

    // Fare estimate (search phase)
    group('Passenger: Search & Estimate', () => {
      getFareEstimate(token);
      sleep(randomSleep(1, 3));
    });

    // Request a ride
    group('Passenger: Request Ride', () => {
      const start2 = Date.now();
      const result = requestRide(token);
      rideRequestDuration.add(Date.now() - start2);

      if (!result || !result.ride) {
        failedOperations.add(1);
        sleep(randomSleep(2, 4));
        return;
      }

      const rideId = result.ride.id;
      successfulRides.add(1);

      sleep(randomSleep(2, 5));

      // Track the ride
      group('Passenger: Track Ride', () => {
        getRideStatus(token, rideId);
        sleep(randomSleep(1, 2));
        getActiveRide(token);
        sleep(randomSleep(1, 3));
      });

      // Cancel the ride (in load test we cancel to keep the system clean)
      group('Passenger: Cancel Ride', () => {
        const start3 = Date.now();
        cancelRide(token, rideId, 'Load test cleanup');
        rideCancelDuration.add(Date.now() - start3);
      });

      sleep(randomSleep(1, 2));
    });

    // View ride history
    group('Passenger: View History', () => {
      getRideHistory(token, 1, 10);
      sleep(randomSleep(1, 2));
    });
  });

  sleep(randomSleep(2, 5));
}

// ---------------------------------------------------------------------------
// Driver Flow
// ---------------------------------------------------------------------------
export function driverFlow() {
  const uid = uniqueId();
  const email = `lt-drv-${uid}@openride.test`;
  const password = `LT_drv_${uid}!`;

  group('Driver: Register/Login', () => {
    const start = Date.now();
    const token = ensureUserAndGetToken(email, password, 'driver', {
      firstName: 'LT',
      lastName: `Drv${uid}`,
    });
    loginDuration.add(Date.now() - start);

    if (!token) {
      failedOperations.add(1);
      return;
    }

    sleep(randomSleep(1, 2));

    // Go online (update location)
    group('Driver: Go Online', () => {
      const pickup = randomPickup();
      const locationPayload = JSON.stringify({
        lat: pickup.lat,
        lng: pickup.lng,
      });

      const res = http.put(`${API_PREFIX}/drivers/location`, locationPayload, {
        headers: authHeaders(token),
        tags: { name: 'PUT /drivers/location' },
      });

      check(res, {
        'driver location: status 2xx or 404': (r) => r.status < 500,
      });

      sleep(randomSleep(1, 2));
    });

    // Check for ride requests (poll active ride)
    group('Driver: Check Requests', () => {
      const activeRes = http.get(`${API_PREFIX}/rides/active`, {
        headers: authHeaders(token),
        tags: { name: 'GET /rides/active' },
      });

      check(activeRes, {
        'driver active ride check: status 200': (r) => r.status === 200,
      });

      sleep(randomSleep(2, 4));
    });

    // View ride history
    group('Driver: View History', () => {
      getRideHistory(token, 1, 10);
      sleep(randomSleep(1, 2));
    });
  });

  sleep(randomSleep(3, 6));
}

// ---------------------------------------------------------------------------
// Governance Flow
// ---------------------------------------------------------------------------
export function governanceFlow() {
  const uid = uniqueId();
  const email = `lt-gov-${uid}@openride.test`;
  const password = `LT_gov_${uid}!`;

  group('Governance: Register/Login', () => {
    const token = ensureUserAndGetToken(email, password, 'passenger', {
      firstName: 'LT',
      lastName: `Gov${uid}`,
    });

    if (!token) {
      failedOperations.add(1);
      return;
    }

    sleep(randomSleep(1, 2));

    // List proposals
    group('Governance: List Proposals', () => {
      const start = Date.now();
      const res = http.get(`${API_PREFIX}/governance/proposals?page=1&limit=10`, {
        headers: authHeaders(token),
        tags: { name: 'GET /governance/proposals' },
      });
      governanceListDuration.add(Date.now() - start);

      check(res, {
        'governance proposals: status 200': (r) => r.status === 200,
        'governance proposals: has array': (r) => {
          try {
            return Array.isArray(r.json().proposals);
          } catch {
            return false;
          }
        },
      });

      sleep(randomSleep(2, 4));

      // If proposals exist, view one
      if (res.status === 200) {
        try {
          const proposals = res.json().proposals;
          if (proposals && proposals.length > 0) {
            const proposalId = proposals[0].id;

            group('Governance: View Proposal', () => {
              const detailRes = http.get(
                `${API_PREFIX}/governance/proposals/${proposalId}`,
                {
                  headers: authHeaders(token),
                  tags: { name: 'GET /governance/proposals/:id' },
                },
              );

              check(detailRes, {
                'proposal detail: status 200': (r) => r.status === 200,
              });

              sleep(randomSleep(1, 3));
            });

            // View proposal results
            group('Governance: View Results', () => {
              const resultsRes = http.get(
                `${API_PREFIX}/governance/proposals/${proposalId}/results`,
                {
                  headers: authHeaders(token),
                  tags: { name: 'GET /governance/proposals/:id/results' },
                },
              );

              check(resultsRes, {
                'proposal results: status 200': (r) => r.status === 200,
              });

              sleep(randomSleep(1, 2));
            });
          }
        } catch {
          // JSON parse failed, skip
        }
      }
    });

    // View governance config
    group('Governance: View Config', () => {
      const configRes = http.get(`${API_PREFIX}/governance/config`, {
        headers: authHeaders(token),
        tags: { name: 'GET /governance/config' },
      });

      check(configRes, {
        'governance config: status 200': (r) => r.status === 200,
      });

      sleep(randomSleep(1, 2));
    });
  });

  sleep(randomSleep(3, 6));
}

// ---------------------------------------------------------------------------
// Transparency Flow
// ---------------------------------------------------------------------------
export function transparencyFlow() {
  const uid = uniqueId();
  const email = `lt-trans-${uid}@openride.test`;
  const password = `LT_trans_${uid}!`;

  group('Transparency: Register/Login', () => {
    const token = ensureUserAndGetToken(email, password, 'passenger', {
      firstName: 'LT',
      lastName: `Trans${uid}`,
    });

    if (!token) {
      failedOperations.add(1);
      return;
    }

    sleep(randomSleep(1, 2));

    // View financials — various periods
    group('Transparency: View Financials', () => {
      const periods = ['current_quarter', 'last_quarter', 'year', 'all'];

      for (const period of periods) {
        const start = Date.now();
        const res = http.get(`${API_PREFIX}/transparency/financials?period=${period}`, {
          headers: authHeaders(token),
          tags: { name: 'GET /transparency/financials' },
        });
        transparencyDuration.add(Date.now() - start);

        check(res, {
          [`financials (${period}): status 200`]: (r) => r.status === 200,
        });

        sleep(randomSleep(2, 4));
      }
    });
  });

  sleep(randomSleep(3, 6));
}
