/**
 * Auth helper functions for k6 load tests.
 *
 * Provides user registration, login, and cached token management so that
 * multiple iterations within a single VU can reuse the same JWT.
 */

import http from 'k6/http';
import { check } from 'k6';
import { API_PREFIX, defaultHeaders, uniqueId } from '../config.js';

// ---------------------------------------------------------------------------
// In-VU token cache (survives across iterations within one VU)
// ---------------------------------------------------------------------------
const tokenCache = {};

/**
 * Register a new user.
 *
 * @param {string} email
 * @param {string} password
 * @param {string} role — 'passenger' | 'driver' | 'both'
 * @param {object} [extra] — optional fields: firstName, lastName, phone
 * @returns {{ user: object, accessToken: string, refreshToken: string } | null}
 */
export function registerUser(email, password, role, extra = {}) {
  const payload = JSON.stringify({
    email,
    password,
    role,
    firstName: extra.firstName || 'Test',
    lastName: extra.lastName || 'User',
    phone: extra.phone || `+1555${String(Date.now()).slice(-7)}`,
  });

  const res = http.post(`${API_PREFIX}/auth/register`, payload, {
    headers: defaultHeaders,
    tags: { name: 'POST /auth/register' },
  });

  const success = check(res, {
    'register: status is 201 or 409': (r) => r.status === 201 || r.status === 409,
  });

  if (res.status === 201) {
    const body = res.json();
    // Cache the token for this email
    tokenCache[email] = body.accessToken;
    return body;
  }

  // 409 = user already exists — attempt login instead
  if (res.status === 409) {
    return loginUser(email, password);
  }

  return null;
}

/**
 * Login an existing user.
 *
 * @param {string} email
 * @param {string} password
 * @returns {{ user: object, accessToken: string, refreshToken: string } | null}
 */
export function loginUser(email, password) {
  const payload = JSON.stringify({ email, password });

  const res = http.post(`${API_PREFIX}/auth/login`, payload, {
    headers: defaultHeaders,
    tags: { name: 'POST /auth/login' },
  });

  const success = check(res, {
    'login: status is 200': (r) => r.status === 200,
  });

  if (res.status === 200) {
    const body = res.json();
    tokenCache[email] = body.accessToken;
    return body;
  }

  return null;
}

/**
 * Get a cached access token for the given email.
 * If no cached token exists, attempt to login.
 *
 * @param {string} email
 * @param {string} password
 * @returns {string|null} — JWT access token or null on failure
 */
export function getToken(email, password) {
  if (tokenCache[email]) {
    return tokenCache[email];
  }

  const result = loginUser(email, password);
  return result ? result.accessToken : null;
}

/**
 * Register or login a user and return the access token.
 * Convenience wrapper that tries registration first, falls back to login.
 *
 * @param {string} email
 * @param {string} password
 * @param {string} role
 * @param {object} [extra]
 * @returns {string|null}
 */
export function ensureUserAndGetToken(email, password, role, extra = {}) {
  if (tokenCache[email]) {
    return tokenCache[email];
  }

  const result = registerUser(email, password, role, extra);
  return result ? (result.accessToken || tokenCache[email]) : null;
}

/**
 * Create a unique test user for this VU and return the access token.
 * Useful in high-concurrency tests where each VU needs its own user.
 *
 * @param {string} role — 'passenger' | 'driver'
 * @returns {{ email: string, token: string } | null}
 */
export function createUniqueUser(role) {
  const uid = uniqueId();
  const email = `loadtest-${role}-${uid}@openride.test`;
  const password = `LT_${uid}_Pass1!`;

  const result = registerUser(email, password, role, {
    firstName: `LT_${role}`,
    lastName: uid,
    phone: `+1555${String(Date.now()).slice(-7)}`,
  });

  if (result && (result.accessToken || tokenCache[email])) {
    return {
      email,
      token: result.accessToken || tokenCache[email],
    };
  }

  return null;
}

/**
 * Invalidate the cached token for a user (e.g. after logout).
 * @param {string} email
 */
export function clearToken(email) {
  delete tokenCache[email];
}
