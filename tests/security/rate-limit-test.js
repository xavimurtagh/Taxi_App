/**
 * Rate Limit Verification Test — k6 script
 *
 * Verifies that the OpenRide API correctly enforces rate limiting:
 *
 *   1. Auth endpoint rate limits (stricter: 10 req / 15 min window)
 *   2. General API rate limits (100 req / 15 min window)
 *   3. Proper 429 responses with required headers
 *   4. Brute force protection (lockout after 5 failed login attempts)
 *
 * IMPORTANT: This test intentionally exceeds rate limits. Run against
 *            a test/staging environment — NOT production.
 *
 * Run:  k6 run tests/security/rate-limit-test.js
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Counter, Rate } from 'k6/metrics';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const API_PREFIX = `${BASE_URL}/api/v1`;

const defaultHeaders = {
  'Content-Type': 'application/json',
  Accept: 'application/json',
};

// Rate limit configuration from the codebase
const AUTH_RATE_LIMIT = 10;       // 10 requests per window
const GENERAL_RATE_LIMIT = 100;   // 100 requests per window
const BRUTE_FORCE_LIMIT = 5;      // 5 failed attempts before lockout

// Custom metrics
const rateLimitTriggered = new Counter('rate_limit_triggered');
const rateLimitMissed = new Counter('rate_limit_not_triggered');
const correctHeadersCount = new Counter('correct_429_headers');
const missingHeadersCount = new Counter('missing_429_headers');

// ---------------------------------------------------------------------------
// k6 options — single VU to test rate limiting per-IP behavior
// ---------------------------------------------------------------------------
export const options = {
  vus: 1,
  iterations: 1,
  // No request duration thresholds — we expect 429s which may be instant
  thresholds: {
    // At least one rate limit should be triggered during the test
    rate_limit_triggered: ['count>0'],
  },
  // Extend timeout since we make many sequential requests
  noConnectionReuse: false,
};

// ---------------------------------------------------------------------------
// Helper: make requests until rate limited or max attempts
// ---------------------------------------------------------------------------

/**
 * Send requests to an endpoint until we get a 429 or reach maxAttempts.
 *
 * @param {string} method — HTTP method
 * @param {string} url — full URL
 * @param {*} body — request body (for POST)
 * @param {object} headers — request headers
 * @param {number} maxAttempts — stop after this many requests
 * @param {string} label — label for logging
 * @returns {{ attempts: number, rateLimited: boolean, lastStatus: number, lastResponse: object }}
 */
function sendUntilRateLimited(method, url, body, headers, maxAttempts, label) {
  let attempts = 0;
  let rateLimited = false;
  let lastStatus = 0;
  let lastResponse = null;

  for (let i = 0; i < maxAttempts; i++) {
    attempts++;

    let res;
    if (method === 'GET') {
      res = http.get(url, { headers, tags: { name: label } });
    } else {
      res = http.post(url, body, { headers, tags: { name: label } });
    }

    lastStatus = res.status;
    lastResponse = res;

    if (res.status === 429) {
      rateLimited = true;
      rateLimitTriggered.add(1);
      break;
    }

    // Minimal sleep to avoid being too aggressive
    sleep(0.05);
  }

  return { attempts, rateLimited, lastStatus, lastResponse };
}

// ---------------------------------------------------------------------------
// Test: Auth endpoint rate limiting
// ---------------------------------------------------------------------------
function testAuthRateLimit() {
  group('Auth Endpoint Rate Limiting', () => {
    console.log(`\n[TEST] Auth rate limit — expecting 429 after ~${AUTH_RATE_LIMIT} requests`);

    // Use a unique email to avoid brute force protection interference
    const testEmail = `ratetest-${Date.now()}@openride.test`;
    const body = JSON.stringify({
      email: testEmail,
      password: 'RateTest_Pass1!',
    });

    const result = sendUntilRateLimited(
      'POST',
      `${API_PREFIX}/auth/login`,
      body,
      defaultHeaders,
      AUTH_RATE_LIMIT + 5,  // Give some headroom
      'POST /auth/login (rate limit test)',
    );

    console.log(`  Sent ${result.attempts} requests, last status: ${result.lastStatus}`);

    // Verify rate limiting was triggered
    const wasLimited = check(null, {
      'auth: rate limit triggered (429)': () => result.rateLimited,
      [`auth: limited within ${AUTH_RATE_LIMIT + 3} requests`]: () =>
        result.rateLimited && result.attempts <= AUTH_RATE_LIMIT + 3,
    });

    if (!wasLimited) {
      rateLimitMissed.add(1);
      console.warn(
        `[WARN] Auth rate limit NOT triggered after ${result.attempts} requests. ` +
        `Expected 429 after ~${AUTH_RATE_LIMIT} requests.`,
      );
    }

    // Verify 429 response details
    if (result.rateLimited && result.lastResponse) {
      verify429Response(result.lastResponse, 'Auth');
    }

    sleep(1);
  });
}

// ---------------------------------------------------------------------------
// Test: Auth registration rate limiting
// ---------------------------------------------------------------------------
function testRegistrationRateLimit() {
  group('Registration Rate Limiting', () => {
    console.log(`\n[TEST] Registration rate limit — expecting 429 after ~${AUTH_RATE_LIMIT} requests`);

    const results = [];

    for (let i = 0; i < AUTH_RATE_LIMIT + 5; i++) {
      const body = JSON.stringify({
        email: `ratereg-${Date.now()}-${i}@openride.test`,
        password: 'RateTest_Reg_Pass1!',
        firstName: 'Rate',
        lastName: 'Test',
        phone: `+1555${String(1000000 + i)}`,
        role: 'passenger',
      });

      const res = http.post(`${API_PREFIX}/auth/register`, body, {
        headers: defaultHeaders,
        tags: { name: 'POST /auth/register (rate limit test)' },
      });

      results.push(res.status);

      if (res.status === 429) {
        rateLimitTriggered.add(1);
        console.log(`  Rate limited after ${i + 1} registration attempts`);
        verify429Response(res, 'Registration');
        break;
      }

      sleep(0.05);
    }

    const was429 = results.includes(429);
    check(null, {
      'registration: rate limit triggered': () => was429,
    });

    if (!was429) {
      rateLimitMissed.add(1);
      console.warn('[WARN] Registration rate limit NOT triggered');
    }

    sleep(1);
  });
}

// ---------------------------------------------------------------------------
// Test: General API rate limiting
// ---------------------------------------------------------------------------
function testGeneralRateLimit() {
  group('General API Rate Limiting', () => {
    console.log(`\n[TEST] General rate limit — expecting 429 after ~${GENERAL_RATE_LIMIT} requests`);
    console.log('  (This may take a moment — sending many requests to /health)');

    const result = sendUntilRateLimited(
      'GET',
      `${BASE_URL}/health`,
      null,
      defaultHeaders,
      GENERAL_RATE_LIMIT + 10,
      'GET /health (rate limit test)',
    );

    console.log(`  Sent ${result.attempts} requests, last status: ${result.lastStatus}`);

    const wasLimited = check(null, {
      'general: rate limit triggered (429)': () => result.rateLimited,
    });

    if (result.rateLimited) {
      console.log(`  General rate limit triggered after ${result.attempts} requests`);
      verify429Response(result.lastResponse, 'General');
    } else {
      rateLimitMissed.add(1);
      console.warn(
        `[WARN] General rate limit NOT triggered after ${result.attempts} requests. ` +
        `Expected 429 after ~${GENERAL_RATE_LIMIT} requests.`,
      );
    }

    sleep(1);
  });
}

// ---------------------------------------------------------------------------
// Test: Brute force protection
// ---------------------------------------------------------------------------
function testBruteForceProtection() {
  group('Brute Force Protection', () => {
    console.log(`\n[TEST] Brute force protection — expecting lockout after ${BRUTE_FORCE_LIMIT} failed login attempts`);

    // Create a unique email for this test
    const targetEmail = `bruteforce-${Date.now()}@openride.test`;
    let lockedOut = false;
    let lockoutAttempt = 0;

    for (let i = 0; i < BRUTE_FORCE_LIMIT + 3; i++) {
      const body = JSON.stringify({
        email: targetEmail,
        password: `wrong_password_${i}`,
      });

      const res = http.post(`${API_PREFIX}/auth/login`, body, {
        headers: defaultHeaders,
        tags: { name: 'POST /auth/login (brute force test)' },
      });

      // Brute force protection returns 429 with a specific message
      if (res.status === 429) {
        lockedOut = true;
        lockoutAttempt = i + 1;
        rateLimitTriggered.add(1);

        console.log(`  Locked out after ${lockoutAttempt} failed attempts`);

        // Verify the lockout response
        check(res, {
          'brute force: returns 429': () => res.status === 429,
          'brute force: has retry info': () => {
            try {
              const body = res.json();
              return body.retryAfter > 0 || body.message.includes('locked') || body.message.includes('Too many');
            } catch {
              return false;
            }
          },
        });

        break;
      }

      // Regular 401 for wrong password — expected before lockout
      check(res, {
        [`brute force attempt ${i + 1}: status 401 (wrong password)`]: () =>
          res.status === 401 || res.status === 429,
      });

      sleep(0.1);
    }

    check(null, {
      'brute force: lockout triggered': () => lockedOut,
      [`brute force: locked within ${BRUTE_FORCE_LIMIT + 2} attempts`]: () =>
        lockedOut && lockoutAttempt <= BRUTE_FORCE_LIMIT + 2,
    });

    if (!lockedOut) {
      rateLimitMissed.add(1);
      console.warn(
        `[WARN] Brute force protection NOT triggered after ${BRUTE_FORCE_LIMIT + 3} failed attempts. ` +
        'Ensure bruteForceProtection middleware is applied to the login route.',
      );
    }

    // Verify the account stays locked on subsequent attempts
    if (lockedOut) {
      sleep(1);

      const retryRes = http.post(
        `${API_PREFIX}/auth/login`,
        JSON.stringify({ email: targetEmail, password: 'another_attempt' }),
        {
          headers: defaultHeaders,
          tags: { name: 'POST /auth/login (locked retry)' },
        },
      );

      check(retryRes, {
        'brute force: still locked on retry': () => retryRes.status === 429,
      });

      if (retryRes.status === 429) {
        console.log('  Account correctly remains locked on subsequent attempt');
      }
    }

    sleep(1);
  });
}

// ---------------------------------------------------------------------------
// Helper: Verify 429 response format and headers
// ---------------------------------------------------------------------------

/**
 * Check that a 429 response includes the expected headers and body format.
 */
function verify429Response(res, context) {
  // Check for standard rate limit headers
  const retryAfter = res.headers['Retry-After'] || res.headers['retry-after'];
  const rateLimitLimit = res.headers['X-RateLimit-Limit'] ||
    res.headers['x-ratelimit-limit'] ||
    res.headers['RateLimit-Limit'] ||
    res.headers['ratelimit-limit'];
  const rateLimitRemaining = res.headers['X-RateLimit-Remaining'] ||
    res.headers['x-ratelimit-remaining'] ||
    res.headers['RateLimit-Remaining'] ||
    res.headers['ratelimit-remaining'];
  const rateLimitReset = res.headers['X-RateLimit-Reset'] ||
    res.headers['x-ratelimit-reset'] ||
    res.headers['RateLimit-Reset'] ||
    res.headers['ratelimit-reset'];

  // Check Retry-After header
  const hasRetryAfter = check(res, {
    [`${context}: 429 has Retry-After header`]: () => !!retryAfter,
  });

  if (hasRetryAfter) {
    correctHeadersCount.add(1);
    console.log(`  ${context}: Retry-After = ${retryAfter}`);
  } else {
    missingHeadersCount.add(1);
    console.warn(`  [WARN] ${context}: 429 response missing Retry-After header`);
  }

  // Check RateLimit-* headers (standard headers from express-rate-limit)
  const hasRateLimitHeaders = check(res, {
    [`${context}: 429 has RateLimit-Limit header`]: () => !!rateLimitLimit,
    [`${context}: 429 has RateLimit-Remaining header`]: () => !!rateLimitRemaining,
    [`${context}: 429 has RateLimit-Reset header`]: () => !!rateLimitReset,
  });

  if (rateLimitLimit) {
    console.log(`  ${context}: RateLimit-Limit = ${rateLimitLimit}`);
    correctHeadersCount.add(1);
  } else {
    missingHeadersCount.add(1);
  }

  if (rateLimitRemaining !== undefined && rateLimitRemaining !== null) {
    console.log(`  ${context}: RateLimit-Remaining = ${rateLimitRemaining}`);

    // Remaining should be 0 when rate limited
    check(res, {
      [`${context}: RateLimit-Remaining is 0`]: () =>
        parseInt(rateLimitRemaining, 10) === 0,
    });
  }

  if (rateLimitReset) {
    console.log(`  ${context}: RateLimit-Reset = ${rateLimitReset}`);
  }

  // Check response body
  check(res, {
    [`${context}: 429 body has error message`]: () => {
      try {
        const body = res.json();
        return body.error || body.message;
      } catch {
        return false;
      }
    },
    [`${context}: 429 body is JSON`]: () => {
      try {
        res.json();
        return true;
      } catch {
        return false;
      }
    },
  });

  // Verify Content-Type is JSON
  const contentType = res.headers['Content-Type'] || res.headers['content-type'] || '';
  check(res, {
    [`${context}: 429 Content-Type is JSON`]: () => contentType.includes('application/json'),
  });
}

// ---------------------------------------------------------------------------
// Main test function
// ---------------------------------------------------------------------------
export default function () {
  console.log('=== OpenRide Rate Limit Verification ===\n');
  console.log('IMPORTANT: This test intentionally exceeds rate limits.');
  console.log('Run against a test/staging environment only.\n');

  // Test 1: Auth endpoint rate limiting
  testAuthRateLimit();

  // Brief pause between test groups
  sleep(2);

  // Test 2: Registration rate limiting
  testRegistrationRateLimit();

  sleep(2);

  // Test 3: General API rate limiting
  testGeneralRateLimit();

  sleep(2);

  // Test 4: Brute force protection
  testBruteForceProtection();

  // Summary
  console.log('\n=== Rate Limit Verification Complete ===');
  console.log('Review the results above for any [WARN] entries.');
  console.log('All rate limit and brute force protections should be active.\n');
}
