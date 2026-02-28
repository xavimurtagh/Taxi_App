import { Router } from 'express';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import env from '../config/env.js';
import { query } from '../config/database.js';
import redis from '../config/redis.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import { driverProfileSchema, updateLocationSchema } from '../utils/validators.js';
import { getIO } from '../sockets/index.js';

const router = Router();

// ---------------------------------------------------------------------------
// S3 client for document uploads
// ---------------------------------------------------------------------------
const s3 = new S3Client({
  region: env.S3_REGION,
  endpoint: env.S3_ENDPOINT || undefined,
  credentials: {
    accessKeyId: env.S3_ACCESS_KEY,
    secretAccessKey: env.S3_SECRET_KEY,
  },
  forcePathStyle: true,
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Fetch the driver profile for a given user ID.
 * Returns the row or null.
 */
async function getDriverProfile(userId) {
  const result = await query(
    `SELECT id, user_id, license_number, license_expiry,
            vehicle_make, vehicle_model, vehicle_year, vehicle_color,
            vehicle_plate, vehicle_type, is_online,
            ST_Y(current_location::geometry) AS lat,
            ST_X(current_location::geometry) AS lng,
            documents_verified, background_check_status,
            total_rides, total_earnings, max_pickup_distance_km, created_at
     FROM driver_profiles
     WHERE user_id = $1`,
    [userId],
  );
  return result.rows.length > 0 ? result.rows[0] : null;
}

// ---------------------------------------------------------------------------
// POST /profile — Create driver profile
// ---------------------------------------------------------------------------
router.post(
  '/profile',
  authenticate,
  requireRole('driver', 'both'),
  validate(driverProfileSchema),
  async (req, res) => {
    try {
      const userId = req.user.id;
      const {
        licenseNumber,
        licenseExpiry,
        vehicleMake,
        vehicleModel,
        vehicleYear,
        vehicleColor,
        vehiclePlate,
        vehicleType,
      } = req.body;

      // Check if a profile already exists
      const existing = await query(
        `SELECT id FROM driver_profiles WHERE user_id = $1`,
        [userId],
      );

      if (existing.rows.length > 0) {
        return res.status(409).json({
          error: 'Conflict',
          message: 'Driver profile already exists for this user',
        });
      }

      const result = await query(
        `INSERT INTO driver_profiles
           (user_id, license_number, license_expiry, vehicle_make, vehicle_model,
            vehicle_year, vehicle_color, vehicle_plate, vehicle_type)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id, user_id, license_number, license_expiry,
                   vehicle_make, vehicle_model, vehicle_year, vehicle_color,
                   vehicle_plate, vehicle_type, is_online, documents_verified,
                   background_check_status, total_rides, total_earnings,
                   max_pickup_distance_km, created_at`,
        [
          userId,
          licenseNumber,
          licenseExpiry,
          vehicleMake,
          vehicleModel,
          vehicleYear,
          vehicleColor,
          vehiclePlate,
          vehicleType,
        ],
      );

      const profile = result.rows[0];

      return res.status(201).json({
        driverProfile: {
          id: profile.id,
          userId: profile.user_id,
          licenseNumber: profile.license_number,
          licenseExpiry: profile.license_expiry,
          vehicleMake: profile.vehicle_make,
          vehicleModel: profile.vehicle_model,
          vehicleYear: profile.vehicle_year,
          vehicleColor: profile.vehicle_color,
          vehiclePlate: profile.vehicle_plate,
          vehicleType: profile.vehicle_type,
          isOnline: profile.is_online,
          documentsVerified: profile.documents_verified,
          backgroundCheckStatus: profile.background_check_status,
          totalRides: profile.total_rides,
          totalEarnings: parseFloat(profile.total_earnings),
          maxPickupDistanceKm: parseFloat(profile.max_pickup_distance_km),
          createdAt: profile.created_at,
        },
      });
    } catch (err) {
      console.error('[drivers] POST /profile error:', err);
      return res.status(500).json({
        error: 'Internal server error',
        message: 'An unexpected error occurred while creating the driver profile',
      });
    }
  },
);

// ---------------------------------------------------------------------------
// PUT /profile — Update driver profile
// ---------------------------------------------------------------------------
router.put(
  '/profile',
  authenticate,
  requireRole('driver', 'both'),
  async (req, res) => {
    try {
      const userId = req.user.id;
      const {
        licenseNumber,
        licenseExpiry,
        vehicleMake,
        vehicleModel,
        vehicleYear,
        vehicleColor,
        vehiclePlate,
        vehicleType,
        maxPickupDistanceKm,
      } = req.body;

      // Build dynamic SET clause based on provided fields
      const fields = [];
      const values = [];
      let paramIndex = 1;

      if (licenseNumber !== undefined) {
        fields.push(`license_number = $${paramIndex++}`);
        values.push(licenseNumber);
      }
      if (licenseExpiry !== undefined) {
        fields.push(`license_expiry = $${paramIndex++}`);
        values.push(licenseExpiry);
      }
      if (vehicleMake !== undefined) {
        fields.push(`vehicle_make = $${paramIndex++}`);
        values.push(vehicleMake);
      }
      if (vehicleModel !== undefined) {
        fields.push(`vehicle_model = $${paramIndex++}`);
        values.push(vehicleModel);
      }
      if (vehicleYear !== undefined) {
        fields.push(`vehicle_year = $${paramIndex++}`);
        values.push(vehicleYear);
      }
      if (vehicleColor !== undefined) {
        fields.push(`vehicle_color = $${paramIndex++}`);
        values.push(vehicleColor);
      }
      if (vehiclePlate !== undefined) {
        fields.push(`vehicle_plate = $${paramIndex++}`);
        values.push(vehiclePlate);
      }
      if (vehicleType !== undefined) {
        fields.push(`vehicle_type = $${paramIndex++}`);
        values.push(vehicleType);
      }
      if (maxPickupDistanceKm !== undefined) {
        fields.push(`max_pickup_distance_km = $${paramIndex++}`);
        values.push(maxPickupDistanceKm);
      }

      if (fields.length === 0) {
        return res.status(400).json({
          error: 'Bad request',
          message: 'No valid fields provided for update',
        });
      }

      values.push(userId);

      const result = await query(
        `UPDATE driver_profiles
         SET ${fields.join(', ')}
         WHERE user_id = $${paramIndex}
         RETURNING id, user_id, license_number, license_expiry,
                   vehicle_make, vehicle_model, vehicle_year, vehicle_color,
                   vehicle_plate, vehicle_type, is_online,
                   ST_Y(current_location::geometry) AS lat,
                   ST_X(current_location::geometry) AS lng,
                   documents_verified, background_check_status,
                   total_rides, total_earnings, max_pickup_distance_km, created_at`,
        values,
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: 'Not found',
          message: 'Driver profile not found',
        });
      }

      const profile = result.rows[0];

      return res.status(200).json({
        driverProfile: {
          id: profile.id,
          userId: profile.user_id,
          licenseNumber: profile.license_number,
          licenseExpiry: profile.license_expiry,
          vehicleMake: profile.vehicle_make,
          vehicleModel: profile.vehicle_model,
          vehicleYear: profile.vehicle_year,
          vehicleColor: profile.vehicle_color,
          vehiclePlate: profile.vehicle_plate,
          vehicleType: profile.vehicle_type,
          isOnline: profile.is_online,
          lat: profile.lat,
          lng: profile.lng,
          documentsVerified: profile.documents_verified,
          backgroundCheckStatus: profile.background_check_status,
          totalRides: profile.total_rides,
          totalEarnings: parseFloat(profile.total_earnings),
          maxPickupDistanceKm: parseFloat(profile.max_pickup_distance_km),
          createdAt: profile.created_at,
        },
      });
    } catch (err) {
      console.error('[drivers] PUT /profile error:', err);
      return res.status(500).json({
        error: 'Internal server error',
        message: 'An unexpected error occurred while updating the driver profile',
      });
    }
  },
);

// ---------------------------------------------------------------------------
// GET /profile — Get current driver's profile
// ---------------------------------------------------------------------------
router.get(
  '/profile',
  authenticate,
  requireRole('driver', 'both'),
  async (req, res) => {
    try {
      const result = await query(
        `SELECT dp.id, dp.user_id, dp.license_number, dp.license_expiry,
                dp.vehicle_make, dp.vehicle_model, dp.vehicle_year,
                dp.vehicle_color, dp.vehicle_plate, dp.vehicle_type,
                dp.is_online,
                ST_Y(dp.current_location::geometry) AS lat,
                ST_X(dp.current_location::geometry) AS lng,
                dp.documents_verified, dp.background_check_status,
                dp.total_rides, dp.total_earnings, dp.max_pickup_distance_km,
                dp.created_at,
                u.email, u.phone, u.first_name, u.last_name,
                u.avatar_url, u.rating_avg, u.rating_count
         FROM driver_profiles dp
         JOIN users u ON u.id = dp.user_id
         WHERE dp.user_id = $1`,
        [req.user.id],
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: 'Not found',
          message: 'Driver profile not found',
        });
      }

      const p = result.rows[0];

      return res.status(200).json({
        id: p.id,
        userId: p.user_id,
        licenseNumber: p.license_number,
        licenseExpiry: p.license_expiry,
        vehicleMake: p.vehicle_make,
        vehicleModel: p.vehicle_model,
        vehicleYear: p.vehicle_year,
        vehicleColor: p.vehicle_color,
        vehiclePlate: p.vehicle_plate,
        vehicleType: p.vehicle_type,
        isOnline: p.is_online,
        lat: p.lat,
        lng: p.lng,
        documentsVerified: p.documents_verified,
        backgroundCheckStatus: p.background_check_status,
        totalRides: p.total_rides,
        totalEarnings: parseFloat(p.total_earnings),
        maxPickupDistanceKm: parseFloat(p.max_pickup_distance_km),
        rating: parseFloat(p.rating_avg),
        ratingCount: p.rating_count,
        createdAt: p.created_at,
        user: {
          email: p.email,
          phone: p.phone,
          firstName: p.first_name,
          lastName: p.last_name,
          avatarUrl: p.avatar_url,
        },
      });
    } catch (err) {
      console.error('[drivers] GET /profile error:', err);
      return res.status(500).json({
        error: 'Internal server error',
        message: 'An unexpected error occurred while fetching the driver profile',
      });
    }
  },
);

// ---------------------------------------------------------------------------
// POST /documents — Upload a driver document (get presigned S3 URL)
// ---------------------------------------------------------------------------
router.post(
  '/documents',
  authenticate,
  requireRole('driver', 'both'),
  async (req, res) => {
    try {
      const userId = req.user.id;
      const { documentType, fileName, contentType } = req.body;

      if (!documentType || !fileName || !contentType) {
        return res.status(400).json({
          error: 'Validation failed',
          message: 'documentType, fileName, and contentType are required',
        });
      }

      const validTypes = [
        'license_front',
        'license_back',
        'vehicle_registration',
        'insurance',
        'inspection',
        'profile_photo',
        'background_check',
      ];

      if (!validTypes.includes(documentType)) {
        return res.status(400).json({
          error: 'Validation failed',
          message: `documentType must be one of: ${validTypes.join(', ')}`,
        });
      }

      // Ensure user has a driver profile
      const profileResult = await query(
        `SELECT id FROM driver_profiles WHERE user_id = $1`,
        [userId],
      );

      if (profileResult.rows.length === 0) {
        return res.status(404).json({
          error: 'Not found',
          message: 'Driver profile not found. Create a driver profile first.',
        });
      }

      const driverProfileId = profileResult.rows[0].id;

      // Generate S3 key
      const timestamp = Date.now();
      const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
      const s3Key = `drivers/${userId}/${documentType}/${timestamp}-${sanitizedFileName}`;

      // Generate presigned upload URL
      const command = new PutObjectCommand({
        Bucket: env.S3_BUCKET,
        Key: s3Key,
        ContentType: contentType,
      });

      const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });

      // The file_url stored is the final location (without query params)
      const fileUrl = env.S3_ENDPOINT
        ? `${env.S3_ENDPOINT}/${env.S3_BUCKET}/${s3Key}`
        : `https://${env.S3_BUCKET}.s3.${env.S3_REGION}.amazonaws.com/${s3Key}`;

      // Insert document record
      const docResult = await query(
        `INSERT INTO driver_documents (driver_id, document_type, file_url, status)
         VALUES ($1, $2, $3, 'pending')
         RETURNING id, driver_id, document_type, file_url, status, uploaded_at`,
        [driverProfileId, documentType, fileUrl],
      );

      const doc = docResult.rows[0];

      return res.status(201).json({
        uploadUrl,
        documentId: doc.id,
      });
    } catch (err) {
      console.error('[drivers] POST /documents error:', err);
      return res.status(500).json({
        error: 'Internal server error',
        message: 'An unexpected error occurred while generating the upload URL',
      });
    }
  },
);

// ---------------------------------------------------------------------------
// GET /documents — List driver documents
// ---------------------------------------------------------------------------
router.get(
  '/documents',
  authenticate,
  requireRole('driver', 'both'),
  async (req, res) => {
    try {
      const result = await query(
        `SELECT dd.id, dd.document_type, dd.file_url, dd.status,
                dd.rejection_reason, dd.expires_at, dd.uploaded_at
         FROM driver_documents dd
         JOIN driver_profiles dp ON dp.id = dd.driver_id
         WHERE dp.user_id = $1
         ORDER BY dd.uploaded_at DESC`,
        [req.user.id],
      );

      const documents = result.rows.map((row) => ({
        id: row.id,
        documentType: row.document_type,
        fileUrl: row.file_url,
        status: row.status,
        rejectionReason: row.rejection_reason,
        expiresAt: row.expires_at,
        uploadedAt: row.uploaded_at,
      }));

      return res.status(200).json({ documents });
    } catch (err) {
      console.error('[drivers] GET /documents error:', err);
      return res.status(500).json({
        error: 'Internal server error',
        message: 'An unexpected error occurred while fetching documents',
      });
    }
  },
);

// ---------------------------------------------------------------------------
// POST /online — Go online
// ---------------------------------------------------------------------------
router.post(
  '/online',
  authenticate,
  requireRole('driver', 'both'),
  async (req, res) => {
    try {
      const userId = req.user.id;
      const profile = await getDriverProfile(userId);

      if (!profile) {
        return res.status(404).json({
          error: 'Not found',
          message: 'Driver profile not found',
        });
      }

      // Verify the driver is eligible to go online
      const issues = [];
      if (!profile.documents_verified) {
        issues.push('Documents have not been verified');
      }
      if (profile.background_check_status !== 'passed') {
        issues.push(`Background check status is '${profile.background_check_status}'`);
      }

      if (issues.length > 0) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'You cannot go online until all requirements are met',
          issues,
        });
      }

      // Set online in database
      await query(
        `UPDATE driver_profiles SET is_online = true WHERE user_id = $1`,
        [userId],
      );

      // Add location to Redis geo index (if we have a location)
      if (profile.lat != null && profile.lng != null) {
        await redis.geoadd(
          'driver:locations',
          profile.lng,
          profile.lat,
          userId,
        );
      }

      // Store driver metadata in Redis for fast lookups
      await redis.hset(`driver:meta:${userId}`, {
        vehicleType: profile.vehicle_type,
        vehicleMake: profile.vehicle_make,
        vehicleModel: profile.vehicle_model,
        vehicleColor: profile.vehicle_color,
        vehiclePlate: profile.vehicle_plate,
        rating: String(profile.total_rides > 0 ? profile.total_earnings : 5.0),
        maxPickupDistanceKm: String(profile.max_pickup_distance_km),
      });

      // Fetch user rating for metadata
      const userResult = await query(
        `SELECT rating_avg FROM users WHERE id = $1`,
        [userId],
      );
      if (userResult.rows.length > 0) {
        await redis.hset(`driver:meta:${userId}`, 'rating', String(userResult.rows[0].rating_avg));
      }

      // Emit socket event
      const io = getIO();
      if (io) {
        io.emit('driver:online', {
          driverId: userId,
          lat: profile.lat,
          lng: profile.lng,
          vehicleType: profile.vehicle_type,
        });
      }

      return res.status(200).json({ status: 'online' });
    } catch (err) {
      console.error('[drivers] POST /online error:', err);
      return res.status(500).json({
        error: 'Internal server error',
        message: 'An unexpected error occurred while going online',
      });
    }
  },
);

// ---------------------------------------------------------------------------
// POST /offline — Go offline
// ---------------------------------------------------------------------------
router.post(
  '/offline',
  authenticate,
  requireRole('driver', 'both'),
  async (req, res) => {
    try {
      const userId = req.user.id;

      // Set offline in database
      await query(
        `UPDATE driver_profiles SET is_online = false WHERE user_id = $1`,
        [userId],
      );

      // Remove from Redis
      await redis.zrem('driver:locations', userId);
      await redis.del(`driver:meta:${userId}`);

      // Emit socket event
      const io = getIO();
      if (io) {
        io.emit('driver:offline', { driverId: userId });
      }

      return res.status(200).json({ status: 'offline' });
    } catch (err) {
      console.error('[drivers] POST /offline error:', err);
      return res.status(500).json({
        error: 'Internal server error',
        message: 'An unexpected error occurred while going offline',
      });
    }
  },
);

// ---------------------------------------------------------------------------
// POST /location — Update driver location
// ---------------------------------------------------------------------------
router.post(
  '/location',
  authenticate,
  requireRole('driver', 'both'),
  validate(updateLocationSchema),
  async (req, res) => {
    try {
      const userId = req.user.id;
      const { lat, lng } = req.body;

      // Update location in database
      await query(
        `UPDATE driver_profiles
         SET current_location = ST_MakePoint($1, $2)::geography
         WHERE user_id = $3`,
        [lng, lat, userId],
      );

      // Update Redis geo index
      await redis.geoadd('driver:locations', lng, lat, userId);

      // Update lat/lng in driver metadata
      await redis.hset(`driver:meta:${userId}`, {
        lat: String(lat),
        lng: String(lng),
      });

      // If the driver has an active ride, emit location update to the ride room
      const activeRide = await query(
        `SELECT id FROM rides
         WHERE driver_id = $1
           AND status IN ('matched', 'driver_arriving', 'in_progress')
         LIMIT 1`,
        [userId],
      );

      if (activeRide.rows.length > 0) {
        const io = getIO();
        if (io) {
          io.to(`ride:${activeRide.rows[0].id}`).emit('driver:location', {
            driverId: userId,
            lat,
            lng,
            timestamp: new Date().toISOString(),
          });
        }
      }

      return res.status(200).json({ updated: true });
    } catch (err) {
      console.error('[drivers] POST /location error:', err);
      return res.status(500).json({
        error: 'Internal server error',
        message: 'An unexpected error occurred while updating location',
      });
    }
  },
);

// ---------------------------------------------------------------------------
// GET /earnings — Get driver earnings
// ---------------------------------------------------------------------------
router.get(
  '/earnings',
  authenticate,
  requireRole('driver', 'both'),
  async (req, res) => {
    try {
      const userId = req.user.id;
      const { period = 'all', page = '1', limit = '20' } = req.query;

      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
      const offset = (pageNum - 1) * limitNum;

      // Calculate date range based on period
      let dateFilter = '';
      const params = [userId];
      let paramIdx = 2;

      const now = new Date();

      if (period === 'today') {
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        dateFilter = ` AND r.dropoff_at >= $${paramIdx++}`;
        params.push(startOfDay.toISOString());
      } else if (period === 'week') {
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        startOfWeek.setHours(0, 0, 0, 0);
        dateFilter = ` AND r.dropoff_at >= $${paramIdx++}`;
        params.push(startOfWeek.toISOString());
      } else if (period === 'month') {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        dateFilter = ` AND r.dropoff_at >= $${paramIdx++}`;
        params.push(startOfMonth.toISOString());
      }
      // 'all' — no date filter

      // Get totals
      const totalsResult = await query(
        `SELECT COALESCE(SUM(r.driver_payout), 0) AS total_earnings,
                COUNT(*)::int AS total_rides
         FROM rides r
         WHERE r.driver_id = $1
           AND r.status = 'completed'${dateFilter}`,
        params,
      );

      const { total_earnings, total_rides } = totalsResult.rows[0];

      // Get paginated rides
      const ridesParams = [...params, limitNum, offset];

      const ridesResult = await query(
        `SELECT r.id, r.pickup_address, r.dropoff_address,
                r.fare_amount, r.driver_payout, r.platform_fee,
                r.surge_multiplier, r.vehicle_type,
                r.actual_distance_km, r.actual_duration_min,
                r.dropoff_at
         FROM rides r
         WHERE r.driver_id = $1
           AND r.status = 'completed'${dateFilter}
         ORDER BY r.dropoff_at DESC
         LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
        ridesParams,
      );

      const rides = ridesResult.rows.map((row) => ({
        id: row.id,
        pickupAddress: row.pickup_address,
        dropoffAddress: row.dropoff_address,
        fareAmount: parseFloat(row.fare_amount),
        driverPayout: parseFloat(row.driver_payout),
        platformFee: parseFloat(row.platform_fee),
        surgeMultiplier: parseFloat(row.surge_multiplier),
        vehicleType: row.vehicle_type,
        actualDistanceKm: row.actual_distance_km ? parseFloat(row.actual_distance_km) : null,
        actualDurationMin: row.actual_duration_min,
        completedAt: row.dropoff_at,
      }));

      return res.status(200).json({
        totalEarnings: parseFloat(total_earnings),
        totalRides: total_rides,
        rides,
        period,
        page: pageNum,
        limit: limitNum,
      });
    } catch (err) {
      console.error('[drivers] GET /earnings error:', err);
      return res.status(500).json({
        error: 'Internal server error',
        message: 'An unexpected error occurred while fetching earnings',
      });
    }
  },
);

// ---------------------------------------------------------------------------
// GET /earnings/summary — Get earnings summary across all periods
// ---------------------------------------------------------------------------
router.get(
  '/earnings/summary',
  authenticate,
  requireRole('driver', 'both'),
  async (req, res) => {
    try {
      const userId = req.user.id;
      const now = new Date();

      // Start of today
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      // Start of this week (Sunday)
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);

      // Start of this month
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const summaryResult = await query(
        `SELECT
           COALESCE(SUM(CASE WHEN r.dropoff_at >= $2 THEN r.driver_payout ELSE 0 END), 0) AS today_earnings,
           COUNT(CASE WHEN r.dropoff_at >= $2 THEN 1 END)::int AS today_rides,
           COALESCE(SUM(CASE WHEN r.dropoff_at >= $3 THEN r.driver_payout ELSE 0 END), 0) AS week_earnings,
           COUNT(CASE WHEN r.dropoff_at >= $3 THEN 1 END)::int AS week_rides,
           COALESCE(SUM(CASE WHEN r.dropoff_at >= $4 THEN r.driver_payout ELSE 0 END), 0) AS month_earnings,
           COUNT(CASE WHEN r.dropoff_at >= $4 THEN 1 END)::int AS month_rides,
           COALESCE(SUM(r.driver_payout), 0) AS all_time_earnings,
           COUNT(*)::int AS all_time_rides
         FROM rides r
         WHERE r.driver_id = $1
           AND r.status = 'completed'`,
        [userId, startOfDay.toISOString(), startOfWeek.toISOString(), startOfMonth.toISOString()],
      );

      const s = summaryResult.rows[0];

      return res.status(200).json({
        today: {
          earnings: parseFloat(s.today_earnings),
          rides: s.today_rides,
        },
        week: {
          earnings: parseFloat(s.week_earnings),
          rides: s.week_rides,
        },
        month: {
          earnings: parseFloat(s.month_earnings),
          rides: s.month_rides,
        },
        allTime: {
          earnings: parseFloat(s.all_time_earnings),
          rides: s.all_time_rides,
        },
      });
    } catch (err) {
      console.error('[drivers] GET /earnings/summary error:', err);
      return res.status(500).json({
        error: 'Internal server error',
        message: 'An unexpected error occurred while fetching earnings summary',
      });
    }
  },
);

// ---------------------------------------------------------------------------
// GET /nearby — Find nearby online drivers (for passengers)
// ---------------------------------------------------------------------------
router.get(
  '/nearby',
  authenticate,
  async (req, res) => {
    try {
      const { lat, lng, radius = '5', vehicleType } = req.query;

      if (!lat || !lng) {
        return res.status(400).json({
          error: 'Validation failed',
          message: 'lat and lng query parameters are required',
        });
      }

      const latitude = parseFloat(lat);
      const longitude = parseFloat(lng);
      const radiusKm = parseFloat(radius);

      if (
        Number.isNaN(latitude) || latitude < -90 || latitude > 90 ||
        Number.isNaN(longitude) || longitude < -180 || longitude > 180
      ) {
        return res.status(400).json({
          error: 'Validation failed',
          message: 'Invalid latitude or longitude values',
        });
      }

      if (Number.isNaN(radiusKm) || radiusKm <= 0 || radiusKm > 50) {
        return res.status(400).json({
          error: 'Validation failed',
          message: 'Radius must be between 0 and 50 km',
        });
      }

      // GEORADIUS returns members within the given radius (in km)
      const radiusMeters = radiusKm * 1000;
      const nearbyDrivers = await redis.georadius(
        'driver:locations',
        longitude,
        latitude,
        radiusMeters,
        'm',
        'WITHCOORD',
        'WITHDIST',
        'ASC',
        'COUNT',
        100,
      );

      // nearbyDrivers format: [[memberId, distance, [lng, lat]], ...]
      const drivers = [];

      for (const entry of nearbyDrivers) {
        const driverId = entry[0];
        const distanceMeters = parseFloat(entry[1]);
        const [driverLng, driverLat] = entry[2].map(parseFloat);

        // Get driver metadata from Redis
        const meta = await redis.hgetall(`driver:meta:${driverId}`);

        if (!meta || Object.keys(meta).length === 0) {
          continue;
        }

        // Filter by vehicle type if specified
        if (vehicleType && meta.vehicleType !== vehicleType) {
          continue;
        }

        drivers.push({
          driverId,
          lat: driverLat,
          lng: driverLng,
          vehicleType: meta.vehicleType,
          vehicleMake: meta.vehicleMake,
          vehicleModel: meta.vehicleModel,
          vehicleColor: meta.vehicleColor,
          rating: meta.rating ? parseFloat(meta.rating) : null,
          distanceKm: Math.round((distanceMeters / 1000) * 100) / 100,
        });
      }

      return res.status(200).json({ drivers });
    } catch (err) {
      console.error('[drivers] GET /nearby error:', err);
      return res.status(500).json({
        error: 'Internal server error',
        message: 'An unexpected error occurred while finding nearby drivers',
      });
    }
  },
);

export default router;
