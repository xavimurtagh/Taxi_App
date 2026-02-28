import { Router } from 'express';
import { query } from '../config/database.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// All user routes require authentication
router.use(authenticate);

// ---------------------------------------------------------------------------
// GET /me — Current user profile
// ---------------------------------------------------------------------------
router.get('/me', async (req, res) => {
  try {
    const userResult = await query(
      `SELECT id, email, phone, first_name, last_name, role,
              is_verified, is_active, avatar_url, created_at, updated_at
       FROM users
       WHERE id = $1`,
      [req.user.id],
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: 'User not found',
      });
    }

    const user = userResult.rows[0];
    const profile = {
      id: user.id,
      email: user.email,
      phone: user.phone,
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role,
      isVerified: user.is_verified,
      isActive: user.is_active,
      avatarUrl: user.avatar_url,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    };

    // If the user is a driver or both, join with driver_profiles
    if (user.role === 'driver' || user.role === 'both') {
      const driverResult = await query(
        `SELECT license_number, license_expiry, vehicle_make, vehicle_model,
                vehicle_year, vehicle_color, vehicle_plate, vehicle_type,
                is_approved, rating, total_rides
         FROM driver_profiles
         WHERE user_id = $1`,
        [req.user.id],
      );

      if (driverResult.rows.length > 0) {
        const dp = driverResult.rows[0];
        profile.driverProfile = {
          licenseNumber: dp.license_number,
          licenseExpiry: dp.license_expiry,
          vehicleMake: dp.vehicle_make,
          vehicleModel: dp.vehicle_model,
          vehicleYear: dp.vehicle_year,
          vehicleColor: dp.vehicle_color,
          vehiclePlate: dp.vehicle_plate,
          vehicleType: dp.vehicle_type,
          isApproved: dp.is_approved,
          rating: dp.rating,
          totalRides: dp.total_rides,
        };
      }
    }

    return res.status(200).json(profile);
  } catch (err) {
    console.error('[users] GET /me error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred while fetching your profile',
    });
  }
});

// ---------------------------------------------------------------------------
// PUT /me — Update current user profile
// ---------------------------------------------------------------------------
router.put('/me', async (req, res) => {
  try {
    const { firstName, lastName, avatarUrl, phone } = req.body;

    // Build dynamic SET clause based on provided fields
    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (firstName !== undefined) {
      fields.push(`first_name = $${paramIndex++}`);
      values.push(firstName);
    }

    if (lastName !== undefined) {
      fields.push(`last_name = $${paramIndex++}`);
      values.push(lastName);
    }

    if (avatarUrl !== undefined) {
      fields.push(`avatar_url = $${paramIndex++}`);
      values.push(avatarUrl);
    }

    if (phone !== undefined) {
      // Check if phone is actually changing
      const currentUser = await query(
        `SELECT phone FROM users WHERE id = $1`,
        [req.user.id],
      );

      if (currentUser.rows.length > 0 && currentUser.rows[0].phone !== phone) {
        // Check if new phone is already taken by another user
        const phoneExists = await query(
          `SELECT id FROM users WHERE phone = $1 AND id != $2 LIMIT 1`,
          [phone, req.user.id],
        );

        if (phoneExists.rows.length > 0) {
          return res.status(409).json({
            error: 'Conflict',
            message: 'This phone number is already in use by another account',
          });
        }

        fields.push(`phone = $${paramIndex++}`);
        values.push(phone);

        // Phone changed — require re-verification
        fields.push(`is_verified = false`);
      }
    }

    if (fields.length === 0) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'No valid fields provided for update',
      });
    }

    fields.push(`updated_at = NOW()`);
    values.push(req.user.id);

    const result = await query(
      `UPDATE users
       SET ${fields.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING id, email, phone, first_name, last_name, role,
                 is_verified, is_active, avatar_url, created_at, updated_at`,
      values,
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: 'User not found',
      });
    }

    const user = result.rows[0];

    return res.status(200).json({
      id: user.id,
      email: user.email,
      phone: user.phone,
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role,
      isVerified: user.is_verified,
      isActive: user.is_active,
      avatarUrl: user.avatar_url,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    });
  } catch (err) {
    console.error('[users] PUT /me error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred while updating your profile',
    });
  }
});

// ---------------------------------------------------------------------------
// GET /me/saved-places — List saved places
// ---------------------------------------------------------------------------
router.get('/me/saved-places', async (req, res) => {
  try {
    const result = await query(
      `SELECT id, label, address,
              ST_Y(location::geometry) AS lat,
              ST_X(location::geometry) AS lng,
              created_at
       FROM saved_places
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [req.user.id],
    );

    return res.status(200).json(result.rows.map((row) => ({
      id: row.id,
      label: row.label,
      address: row.address,
      lat: row.lat,
      lng: row.lng,
      createdAt: row.created_at,
    })));
  } catch (err) {
    console.error('[users] GET /me/saved-places error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred while fetching saved places',
    });
  }
});

// ---------------------------------------------------------------------------
// POST /me/saved-places — Create a saved place
// ---------------------------------------------------------------------------
router.post('/me/saved-places', async (req, res) => {
  try {
    const { label, address, lat, lng } = req.body;

    // Validate required fields
    if (!label || typeof label !== 'string' || label.trim().length === 0) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Label is required',
      });
    }

    if (!address || typeof address !== 'string' || address.trim().length === 0) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Address is required',
      });
    }

    if (lat === undefined || lat === null || typeof lat !== 'number' || lat < -90 || lat > 90) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Latitude is required and must be between -90 and 90',
      });
    }

    if (lng === undefined || lng === null || typeof lng !== 'number' || lng < -180 || lng > 180) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Longitude is required and must be between -180 and 180',
      });
    }

    const result = await query(
      `INSERT INTO saved_places (user_id, label, address, location)
       VALUES ($1, $2, $3, ST_MakePoint($4, $5)::geography)
       RETURNING id, label, address,
                 ST_Y(location::geometry) AS lat,
                 ST_X(location::geometry) AS lng,
                 created_at`,
      [req.user.id, label.trim(), address.trim(), lng, lat],
    );

    const place = result.rows[0];

    return res.status(201).json({
      id: place.id,
      label: place.label,
      address: place.address,
      lat: place.lat,
      lng: place.lng,
      createdAt: place.created_at,
    });
  } catch (err) {
    console.error('[users] POST /me/saved-places error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred while creating the saved place',
    });
  }
});

// ---------------------------------------------------------------------------
// DELETE /me/saved-places/:id — Delete a saved place
// ---------------------------------------------------------------------------
router.delete('/me/saved-places/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      `DELETE FROM saved_places
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [id, req.user.id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Saved place not found or you do not have permission to delete it',
      });
    }

    return res.status(204).send();
  } catch (err) {
    console.error('[users] DELETE /me/saved-places/:id error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred while deleting the saved place',
    });
  }
});

// ---------------------------------------------------------------------------
// GET /me/emergency-contacts — List emergency contacts
// ---------------------------------------------------------------------------
router.get('/me/emergency-contacts', async (req, res) => {
  try {
    const result = await query(
      `SELECT id, name, phone, relationship, created_at
       FROM emergency_contacts
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [req.user.id],
    );

    return res.status(200).json(result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      phone: row.phone,
      relationship: row.relationship,
      createdAt: row.created_at,
    })));
  } catch (err) {
    console.error('[users] GET /me/emergency-contacts error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred while fetching emergency contacts',
    });
  }
});

// ---------------------------------------------------------------------------
// POST /me/emergency-contacts — Create an emergency contact
// ---------------------------------------------------------------------------
router.post('/me/emergency-contacts', async (req, res) => {
  try {
    const { name, phone, relationship } = req.body;

    // Validate required fields
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Contact name is required',
      });
    }

    if (!phone || typeof phone !== 'string' || phone.trim().length === 0) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Contact phone number is required',
      });
    }

    if (!relationship || typeof relationship !== 'string' || relationship.trim().length === 0) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Relationship is required',
      });
    }

    const result = await query(
      `INSERT INTO emergency_contacts (user_id, name, phone, relationship)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, phone, relationship, created_at`,
      [req.user.id, name.trim(), phone.trim(), relationship.trim()],
    );

    const contact = result.rows[0];

    return res.status(201).json({
      id: contact.id,
      name: contact.name,
      phone: contact.phone,
      relationship: contact.relationship,
      createdAt: contact.created_at,
    });
  } catch (err) {
    console.error('[users] POST /me/emergency-contacts error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred while creating the emergency contact',
    });
  }
});

// ---------------------------------------------------------------------------
// DELETE /me/emergency-contacts/:id — Delete an emergency contact
// ---------------------------------------------------------------------------
router.delete('/me/emergency-contacts/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      `DELETE FROM emergency_contacts
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [id, req.user.id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Emergency contact not found or you do not have permission to delete it',
      });
    }

    return res.status(204).send();
  } catch (err) {
    console.error('[users] DELETE /me/emergency-contacts/:id error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred while deleting the emergency contact',
    });
  }
});

// ---------------------------------------------------------------------------
// GET /me/payment-methods — List payment methods (masked)
// ---------------------------------------------------------------------------
router.get('/me/payment-methods', async (req, res) => {
  try {
    const result = await query(
      `SELECT id, type, last_four, brand, is_default, created_at
       FROM payment_methods
       WHERE user_id = $1
       ORDER BY is_default DESC, created_at DESC`,
      [req.user.id],
    );

    return res.status(200).json(result.rows.map((row) => ({
      id: row.id,
      type: row.type,
      lastFour: row.last_four,
      brand: row.brand,
      isDefault: row.is_default,
      createdAt: row.created_at,
    })));
  } catch (err) {
    console.error('[users] GET /me/payment-methods error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred while fetching payment methods',
    });
  }
});

export default router;
