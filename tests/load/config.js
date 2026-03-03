/**
 * Shared k6 load test configuration for OpenRide API.
 *
 * Environment variables:
 *   BASE_URL  — API base URL (default: http://localhost:3000)
 *   TEST_USER_EMAIL — pre-seeded test passenger email
 *   TEST_USER_PASSWORD — pre-seeded test passenger password
 *   TEST_DRIVER_EMAIL — pre-seeded test driver email
 *   TEST_DRIVER_PASSWORD — pre-seeded test driver password
 */

// ---------------------------------------------------------------------------
// Base URL
// ---------------------------------------------------------------------------
export const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
export const API_PREFIX = `${BASE_URL}/api/v1`;

// ---------------------------------------------------------------------------
// Default headers
// ---------------------------------------------------------------------------
export const defaultHeaders = {
  'Content-Type': 'application/json',
  Accept: 'application/json',
};

/**
 * Build an Authorization header object from a Bearer token.
 * @param {string} token — JWT access token
 * @returns {object} headers including Authorization
 */
export function authHeaders(token) {
  return {
    ...defaultHeaders,
    Authorization: `Bearer ${token}`,
  };
}

// ---------------------------------------------------------------------------
// Test user credentials (should be pre-seeded in test environment)
// ---------------------------------------------------------------------------
export const TEST_PASSENGER = {
  email: __ENV.TEST_USER_EMAIL || 'loadtest-passenger@openride.test',
  password: __ENV.TEST_USER_PASSWORD || 'LoadTest_P@ss1',
  firstName: 'Load',
  lastName: 'Passenger',
  phone: '+15550100000',
  role: 'passenger',
};

export const TEST_DRIVER = {
  email: __ENV.TEST_DRIVER_EMAIL || 'loadtest-driver@openride.test',
  password: __ENV.TEST_DRIVER_PASSWORD || 'LoadTest_D@ss1',
  firstName: 'Load',
  lastName: 'Driver',
  phone: '+15550200000',
  role: 'driver',
};

// ---------------------------------------------------------------------------
// Standard thresholds (shared across scenarios)
// ---------------------------------------------------------------------------
export const standardThresholds = {
  // HTTP request duration: p95 under 500ms, p99 under 1500ms
  http_req_duration: ['p(95)<500', 'p(99)<1500'],
  // Error rate below 1%
  http_req_failed: ['rate<0.01'],
  // Iteration duration — generous upper limit
  iteration_duration: ['p(95)<10000'],
};

// ---------------------------------------------------------------------------
// Extended thresholds (for scenarios with custom metrics)
// ---------------------------------------------------------------------------
export const extendedThresholds = {
  ...standardThresholds,
  // Custom business metrics thresholds (defined via k6 Trend/Counter/Rate)
  login_duration: ['p(95)<800'],
  ride_request_duration: ['p(95)<1000'],
  ride_cancel_duration: ['p(95)<800'],
  governance_list_duration: ['p(95)<600'],
  transparency_duration: ['p(95)<600'],
};

// ---------------------------------------------------------------------------
// Helper: sleep with jitter to avoid thundering-herd
// ---------------------------------------------------------------------------
/**
 * Return a random duration between min and max (seconds) for use with k6 sleep().
 * @param {number} min — minimum seconds
 * @param {number} max — maximum seconds
 * @returns {number}
 */
export function randomSleep(min = 0.5, max = 2.0) {
  return min + Math.random() * (max - min);
}

// ---------------------------------------------------------------------------
// Helper: unique identifier for this VU + iteration
// ---------------------------------------------------------------------------
/**
 * Generate a unique string based on VU id and iteration count.
 * Useful for creating unique test user emails.
 * @returns {string}
 */
export function uniqueId() {
  return `${__VU}-${__ITER}-${Date.now()}`;
}
