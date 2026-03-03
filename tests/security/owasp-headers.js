/**
 * OWASP Security Headers Check — k6 script
 *
 * Verifies that all major endpoints return the correct security headers
 * as recommended by OWASP Secure Headers Project:
 *   https://owasp.org/www-project-secure-headers/
 *
 * Checks:
 *   1. Required security headers are present and correctly configured
 *   2. No information disclosure (Server version, X-Powered-By, stack traces)
 *   3. Error responses do not leak implementation details
 *   4. Content-Type is correctly set for JSON responses
 *
 * Run:  k6 run tests/security/owasp-headers.js
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Counter } from 'k6/metrics';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const API_PREFIX = `${BASE_URL}/api/v1`;

const defaultHeaders = {
  'Content-Type': 'application/json',
  Accept: 'application/json',
};

// Custom metrics
const headerCheckFailures = new Counter('header_check_failures');
const infoDisclosureFindings = new Counter('info_disclosure_findings');
const totalChecks = new Counter('total_checks');

// ---------------------------------------------------------------------------
// k6 options — single VU, one pass through all endpoints
// ---------------------------------------------------------------------------
export const options = {
  vus: 1,
  iterations: 1,
  thresholds: {
    // All header checks should pass
    header_check_failures: ['count<1'],
    // No information disclosure
    info_disclosure_findings: ['count<1'],
  },
};

// ---------------------------------------------------------------------------
// Required security headers and expected values
// ---------------------------------------------------------------------------
const REQUIRED_HEADERS = {
  'x-content-type-options': {
    expected: 'nosniff',
    description: 'Prevents MIME-type sniffing',
    severity: 'high',
  },
  'x-frame-options': {
    expected: 'DENY',
    alternatives: ['SAMEORIGIN'],
    description: 'Prevents clickjacking attacks',
    severity: 'high',
  },
  'referrer-policy': {
    expected: 'strict-origin-when-cross-origin',
    alternatives: ['no-referrer', 'same-origin', 'strict-origin'],
    description: 'Controls referrer information',
    severity: 'medium',
  },
  'content-type': {
    contains: 'application/json',
    description: 'Response content type for API endpoints',
    severity: 'medium',
  },
};

/**
 * Headers that SHOULD be present (Helmet provides these).
 */
const RECOMMENDED_HEADERS = {
  'strict-transport-security': {
    description: 'Enforces HTTPS (HSTS)',
    severity: 'high',
    note: 'Only expected when served over HTTPS',
  },
  'permissions-policy': {
    description: 'Restricts browser features',
    severity: 'medium',
  },
};

/**
 * Headers that should NOT be present (information disclosure).
 */
const FORBIDDEN_HEADERS = {
  'x-powered-by': {
    description: 'Reveals backend technology (e.g. Express)',
    severity: 'medium',
  },
  'server': {
    description: 'Reveals server software and version',
    severity: 'low',
    note: 'May be set by reverse proxy — check in production',
  },
};

// ---------------------------------------------------------------------------
// Endpoints to check
// ---------------------------------------------------------------------------
const PUBLIC_ENDPOINTS = [
  { method: 'GET', path: '/health', name: 'Health Check' },
];

const API_ENDPOINTS = [
  { method: 'GET', path: '/api/v1/transparency/financials', name: 'Transparency' },
  { method: 'GET', path: '/api/v1/governance/config', name: 'Governance Config' },
];

const AUTH_ENDPOINTS = [
  { method: 'POST', path: '/api/v1/auth/login', name: 'Login', body: { email: 'test@test.com', password: 'test' } },
  { method: 'POST', path: '/api/v1/auth/register', name: 'Register', body: { email: 'headertest@test.com', password: 'Test1234!', firstName: 'Test', lastName: 'User', phone: '+15551234567', role: 'passenger' } },
];

const ERROR_ENDPOINTS = [
  { method: 'GET', path: '/api/v1/nonexistent-endpoint', name: '404 Not Found' },
  { method: 'GET', path: '/api/v1/rides/invalid-uuid', name: 'Invalid ID' },
  { method: 'POST', path: '/api/v1/auth/login', name: 'Bad Login', body: {} },
];

// ---------------------------------------------------------------------------
// Header verification helpers
// ---------------------------------------------------------------------------

/**
 * Check that all required security headers are present on a response.
 */
function verifySecurityHeaders(res, endpointName) {
  for (const [header, config] of Object.entries(REQUIRED_HEADERS)) {
    totalChecks.add(1);

    const headerValue = res.headers[header] || res.headers[header.charAt(0).toUpperCase() + header.slice(1)];

    if (!headerValue) {
      // content-type check: look for Content-Type with various casings
      if (header === 'content-type') {
        const ct = res.headers['Content-Type'] || res.headers['content-type'];
        if (ct && ct.includes(config.contains)) {
          continue; // Pass
        }
      }

      const passed = check(res, {
        [`${endpointName}: ${header} header present`]: () => false,
      });

      if (!passed) {
        headerCheckFailures.add(1);
        console.warn(
          `[FAIL] ${endpointName}: Missing header "${header}" — ${config.description} (severity: ${config.severity})`,
        );
      }
      continue;
    }

    // Check expected value
    if (config.expected) {
      const valueMatch =
        headerValue === config.expected ||
        (config.alternatives && config.alternatives.includes(headerValue));

      const passed = check(res, {
        [`${endpointName}: ${header} = ${config.expected}`]: () => valueMatch,
      });

      if (!passed) {
        headerCheckFailures.add(1);
        console.warn(
          `[FAIL] ${endpointName}: Header "${header}" is "${headerValue}", expected "${config.expected}" (severity: ${config.severity})`,
        );
      }
    } else if (config.contains) {
      const passed = check(res, {
        [`${endpointName}: ${header} contains ${config.contains}`]: () =>
          headerValue.includes(config.contains),
      });

      if (!passed) {
        headerCheckFailures.add(1);
      }
    }
  }
}

/**
 * Check that recommended headers are present.
 */
function verifyRecommendedHeaders(res, endpointName) {
  for (const [header, config] of Object.entries(RECOMMENDED_HEADERS)) {
    totalChecks.add(1);

    const headerValue = res.headers[header];

    check(res, {
      [`${endpointName}: ${header} (recommended)`]: () => !!headerValue,
    });

    if (!headerValue) {
      console.info(
        `[INFO] ${endpointName}: Recommended header "${header}" not found — ${config.description}${config.note ? ` (${config.note})` : ''}`,
      );
    }
  }
}

/**
 * Check that forbidden headers (information disclosure) are absent.
 */
function verifyNoForbiddenHeaders(res, endpointName) {
  for (const [header, config] of Object.entries(FORBIDDEN_HEADERS)) {
    totalChecks.add(1);

    const headerValue = res.headers[header];

    const passed = check(res, {
      [`${endpointName}: no ${header} header`]: () => !headerValue,
    });

    if (!passed) {
      infoDisclosureFindings.add(1);
      console.warn(
        `[DISCLOSURE] ${endpointName}: Header "${header}" is present with value "${headerValue}" — ${config.description} (severity: ${config.severity})`,
      );
    }
  }
}

/**
 * Check that error responses do not leak implementation details.
 */
function verifyErrorResponseSafety(res, endpointName) {
  totalChecks.add(1);

  if (res.status >= 400) {
    let body;
    try {
      body = res.json();
    } catch {
      body = res.body;
    }

    const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);

    // Check for stack traces
    const hasStackTrace = check(res, {
      [`${endpointName}: no stack trace in error`]: () =>
        !bodyStr.includes('at ') || !bodyStr.includes('.js:'),
    });
    if (!hasStackTrace) {
      infoDisclosureFindings.add(1);
      console.warn(`[DISCLOSURE] ${endpointName}: Stack trace found in error response`);
    }

    // Check for file paths
    const hasFilePath = check(res, {
      [`${endpointName}: no file paths in error`]: () =>
        !bodyStr.includes('/home/') &&
        !bodyStr.includes('/usr/') &&
        !bodyStr.includes('/var/') &&
        !bodyStr.includes('node_modules') &&
        !bodyStr.includes('C:\\'),
    });
    if (!hasFilePath) {
      infoDisclosureFindings.add(1);
      console.warn(`[DISCLOSURE] ${endpointName}: File path found in error response`);
    }

    // Check for technology disclosure
    const hasTechDisclose = check(res, {
      [`${endpointName}: no tech disclosure in error`]: () =>
        !bodyStr.includes('PostgreSQL') &&
        !bodyStr.includes('Redis') &&
        !bodyStr.includes('Express') &&
        !bodyStr.includes('pg_') &&
        !bodyStr.includes('ECONNREFUSED'),
    });
    if (!hasTechDisclose) {
      infoDisclosureFindings.add(1);
      console.warn(`[DISCLOSURE] ${endpointName}: Technology details found in error response`);
    }

    // Check for SQL error messages
    const hasSqlError = check(res, {
      [`${endpointName}: no SQL errors in response`]: () =>
        !bodyStr.includes('syntax error') &&
        !bodyStr.includes('relation "') &&
        !bodyStr.includes('column "') &&
        !bodyStr.includes('SQLSTATE'),
    });
    if (!hasSqlError) {
      infoDisclosureFindings.add(1);
      console.warn(`[DISCLOSURE] ${endpointName}: SQL error message found in error response`);
    }
  }
}

// ---------------------------------------------------------------------------
// Main test function
// ---------------------------------------------------------------------------
export default function () {
  // -----------------------------------------------------------------------
  // Group 1: Public endpoints
  // -----------------------------------------------------------------------
  group('Public Endpoints', () => {
    for (const endpoint of PUBLIC_ENDPOINTS) {
      const res = http.get(`${BASE_URL}${endpoint.path}`, {
        headers: defaultHeaders,
        tags: { name: `${endpoint.method} ${endpoint.path}` },
      });

      verifySecurityHeaders(res, endpoint.name);
      verifyRecommendedHeaders(res, endpoint.name);
      verifyNoForbiddenHeaders(res, endpoint.name);

      sleep(0.5);
    }
  });

  // -----------------------------------------------------------------------
  // Group 2: API endpoints (may require auth, but headers should still be set)
  // -----------------------------------------------------------------------
  group('API Endpoints', () => {
    for (const endpoint of API_ENDPOINTS) {
      const res = http.get(`${BASE_URL}${endpoint.path}`, {
        headers: defaultHeaders,
        tags: { name: `${endpoint.method} ${endpoint.path}` },
      });

      // Even 401/403 responses should have security headers
      verifySecurityHeaders(res, endpoint.name);
      verifyNoForbiddenHeaders(res, endpoint.name);

      sleep(0.5);
    }
  });

  // -----------------------------------------------------------------------
  // Group 3: Auth endpoints
  // -----------------------------------------------------------------------
  group('Auth Endpoints', () => {
    for (const endpoint of AUTH_ENDPOINTS) {
      const res = http.post(
        `${BASE_URL}${endpoint.path}`,
        JSON.stringify(endpoint.body),
        {
          headers: defaultHeaders,
          tags: { name: `${endpoint.method} ${endpoint.path}` },
        },
      );

      verifySecurityHeaders(res, endpoint.name);
      verifyNoForbiddenHeaders(res, endpoint.name);
      verifyErrorResponseSafety(res, endpoint.name);

      sleep(0.5);
    }
  });

  // -----------------------------------------------------------------------
  // Group 4: Error responses (verify no information leakage)
  // -----------------------------------------------------------------------
  group('Error Response Safety', () => {
    for (const endpoint of ERROR_ENDPOINTS) {
      let res;

      if (endpoint.method === 'GET') {
        res = http.get(`${BASE_URL}${endpoint.path}`, {
          headers: defaultHeaders,
          tags: { name: `${endpoint.method} ${endpoint.path}` },
        });
      } else {
        res = http.post(
          `${BASE_URL}${endpoint.path}`,
          JSON.stringify(endpoint.body || {}),
          {
            headers: defaultHeaders,
            tags: { name: `${endpoint.method} ${endpoint.path}` },
          },
        );
      }

      // Security headers should be present even on error responses
      verifySecurityHeaders(res, endpoint.name);
      verifyNoForbiddenHeaders(res, endpoint.name);

      // Verify error responses are safe
      verifyErrorResponseSafety(res, endpoint.name);

      sleep(0.5);
    }
  });

  // -----------------------------------------------------------------------
  // Group 5: CORS headers check
  // -----------------------------------------------------------------------
  group('CORS Headers', () => {
    // Preflight request
    const preflightRes = http.options(`${BASE_URL}/api/v1/auth/login`, null, {
      headers: {
        Origin: 'https://evil-site.com',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type, Authorization',
      },
      tags: { name: 'OPTIONS /api/v1/auth/login' },
    });

    totalChecks.add(1);

    // In production, CORS should not allow arbitrary origins
    const acaoHeader = preflightRes.headers['Access-Control-Allow-Origin'] ||
                       preflightRes.headers['access-control-allow-origin'];

    if (acaoHeader === '*') {
      // Acceptable in development but not production
      console.info(
        '[INFO] CORS allows all origins (*) — verify this is only for development',
      );
    }

    check(preflightRes, {
      'CORS: response is not 5xx': (r) => r.status < 500,
    });

    sleep(0.5);
  });

  // -----------------------------------------------------------------------
  // Group 6: Cache headers for sensitive endpoints
  // -----------------------------------------------------------------------
  group('Cache Control', () => {
    // Auth endpoints should not be cached
    const loginRes = http.post(
      `${BASE_URL}/api/v1/auth/login`,
      JSON.stringify({ email: 'cache@test.com', password: 'test' }),
      {
        headers: defaultHeaders,
        tags: { name: 'POST /api/v1/auth/login (cache check)' },
      },
    );

    totalChecks.add(1);

    const cacheControl = loginRes.headers['Cache-Control'] || loginRes.headers['cache-control'] || '';

    check(loginRes, {
      'Auth: Cache-Control includes no-store or private': () =>
        cacheControl.includes('no-store') || cacheControl.includes('private'),
    });

    if (!cacheControl.includes('no-store') && !cacheControl.includes('private')) {
      console.warn(
        '[WARN] Auth endpoint missing proper Cache-Control header. ' +
        'Sensitive responses may be cached by intermediaries.',
      );
    }

    sleep(0.5);
  });

  // -----------------------------------------------------------------------
  // Final summary
  // -----------------------------------------------------------------------
  console.log('\n=== OWASP Headers Check Complete ===');
  console.log('Review the k6 output above for any [FAIL], [DISCLOSURE], or [WARN] entries.');
  console.log('All FAIL items should be addressed before production deployment.\n');
}
