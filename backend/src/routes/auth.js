import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import { query } from '../config/database.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import { registerSchema, loginSchema } from '../utils/validators.js';
import { authLimiter } from '../middleware/rateLimit.js';

const router = Router();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Generate a signed JWT access token.
 * @param {{ id: string, email: string, role: string }} user
 * @returns {string}
 */
function generateAccessToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRY },
  );
}

/**
 * Generate a signed JWT refresh token.
 * @param {{ id: string }} user
 * @returns {string}
 */
function generateRefreshToken(user) {
  return jwt.sign(
    { id: user.id },
    env.JWT_REFRESH_SECRET,
    { expiresIn: env.JWT_REFRESH_EXPIRY },
  );
}

/**
 * Persist a refresh token in the database.
 * @param {string} userId
 * @param {string} token
 */
async function storeRefreshToken(userId, token) {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  await query(
    `INSERT INTO refresh_tokens (user_id, token, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, token, expiresAt],
  );
}

/**
 * Shape a user row into the public user object returned by the API.
 */
function sanitizeUser(row) {
  return {
    id: row.id,
    email: row.email,
    phone: row.phone,
    firstName: row.first_name,
    lastName: row.last_name,
    role: row.role,
    isVerified: row.is_verified,
  };
}

// ---------------------------------------------------------------------------
// POST /register
// ---------------------------------------------------------------------------
router.post(
  '/register',
  authLimiter,
  validate(registerSchema),
  async (req, res) => {
    try {
      const { email, phone, password, firstName, lastName, role } = req.body;

      // Check if email or phone already exists
      const existing = await query(
        `SELECT id FROM users WHERE email = $1 OR phone = $2 LIMIT 1`,
        [email, phone],
      );

      if (existing.rows.length > 0) {
        return res.status(409).json({
          error: 'Conflict',
          message: 'A user with this email or phone number already exists',
        });
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 10);

      // Insert user
      const result = await query(
        `INSERT INTO users (email, phone, password_hash, first_name, last_name, role)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, email, phone, first_name, last_name, role, is_verified`,
        [email, phone, passwordHash, firstName, lastName, role],
      );

      const user = result.rows[0];

      // If role includes 'driver', create an empty driver_profiles row
      if (role === 'driver' || role === 'both') {
        await query(
          `INSERT INTO driver_profiles
             (user_id, license_number, license_expiry, vehicle_make, vehicle_model,
              vehicle_year, vehicle_color, vehicle_plate, vehicle_type)
           VALUES ($1, '', NOW()::date, '', '', 0, '', '', 'economy')`,
          [user.id],
        );
      }

      // Generate tokens
      const accessToken = generateAccessToken(user);
      const refreshToken = generateRefreshToken(user);
      await storeRefreshToken(user.id, refreshToken);

      return res.status(201).json({
        user: sanitizeUser(user),
        accessToken,
        refreshToken,
      });
    } catch (err) {
      console.error('[auth] Registration error:', err);
      return res.status(500).json({
        error: 'Internal server error',
        message: 'An unexpected error occurred during registration',
      });
    }
  },
);

// ---------------------------------------------------------------------------
// POST /login
// ---------------------------------------------------------------------------
router.post(
  '/login',
  authLimiter,
  validate(loginSchema),
  async (req, res) => {
    try {
      const { email, password } = req.body;

      // Find user by email
      const result = await query(
        `SELECT id, email, phone, password_hash, first_name, last_name,
                role, is_verified, is_active
         FROM users
         WHERE email = $1`,
        [email],
      );

      if (result.rows.length === 0) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Invalid credentials',
        });
      }

      const user = result.rows[0];

      // Compare password
      const passwordValid = await bcrypt.compare(password, user.password_hash);
      if (!passwordValid) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Invalid credentials',
        });
      }

      // Check if account is active
      if (!user.is_active) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Account deactivated',
        });
      }

      // Generate tokens
      const accessToken = generateAccessToken(user);
      const refreshToken = generateRefreshToken(user);
      await storeRefreshToken(user.id, refreshToken);

      return res.status(200).json({
        user: sanitizeUser(user),
        accessToken,
        refreshToken,
      });
    } catch (err) {
      console.error('[auth] Login error:', err);
      return res.status(500).json({
        error: 'Internal server error',
        message: 'An unexpected error occurred during login',
      });
    }
  },
);

// ---------------------------------------------------------------------------
// POST /refresh
// ---------------------------------------------------------------------------
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'Refresh token is required',
      });
    }

    // Verify the JWT signature and decode
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET);
    } catch (err) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or expired refresh token',
      });
    }

    // Look up the token in the database
    const tokenResult = await query(
      `SELECT id, user_id, expires_at
       FROM refresh_tokens
       WHERE token = $1`,
      [refreshToken],
    );

    if (tokenResult.rows.length === 0) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Refresh token not found or already used',
      });
    }

    const storedToken = tokenResult.rows[0];

    // Check expiry
    if (new Date(storedToken.expires_at) < new Date()) {
      // Clean up expired token
      await query(`DELETE FROM refresh_tokens WHERE id = $1`, [storedToken.id]);
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Refresh token has expired',
      });
    }

    // Delete the used refresh token (token rotation)
    await query(`DELETE FROM refresh_tokens WHERE id = $1`, [storedToken.id]);

    // Fetch current user data for the new access token
    const userResult = await query(
      `SELECT id, email, role FROM users WHERE id = $1`,
      [decoded.id],
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User not found',
      });
    }

    const user = userResult.rows[0];

    // Generate new token pair
    const newAccessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user);
    await storeRefreshToken(user.id, newRefreshToken);

    return res.status(200).json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });
  } catch (err) {
    console.error('[auth] Token refresh error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred during token refresh',
    });
  }
});

// ---------------------------------------------------------------------------
// POST /logout
// ---------------------------------------------------------------------------
router.post('/logout', authenticate, async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (refreshToken) {
      await query(
        `DELETE FROM refresh_tokens WHERE token = $1 AND user_id = $2`,
        [refreshToken, req.user.id],
      );
    }

    return res.status(200).json({ message: 'Logged out' });
  } catch (err) {
    console.error('[auth] Logout error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred during logout',
    });
  }
});

// ---------------------------------------------------------------------------
// POST /verify-phone
// ---------------------------------------------------------------------------
router.post('/verify-phone', authenticate, async (req, res) => {
  try {
    const { code } = req.body;

    if (!code || !/^\d{6}$/.test(code)) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'A valid 6-digit verification code is required',
      });
    }

    // Placeholder: accept any 6-digit code for now
    await query(
      `UPDATE users SET is_verified = true WHERE id = $1`,
      [req.user.id],
    );

    return res.status(200).json({ message: 'Phone verified' });
  } catch (err) {
    console.error('[auth] Phone verification error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred during phone verification',
    });
  }
});

// ---------------------------------------------------------------------------
// POST /send-verification
// ---------------------------------------------------------------------------
router.post('/send-verification', authenticate, async (req, res) => {
  try {
    // TODO: Integrate Twilio SMS in production
    // In production, generate a random 6-digit code, store it in Redis with
    // a TTL, and send it via Twilio to the user's phone number.

    return res.status(200).json({
      message: 'Verification code sent',
      code: '123456', // Dev placeholder — remove in production
    });
  } catch (err) {
    console.error('[auth] Send verification error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred while sending the verification code',
    });
  }
});

export default router;
