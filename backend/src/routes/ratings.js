import { Router } from 'express';
import { query } from '../config/database.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import { ratingSchema } from '../utils/validators.js';

const router = Router();

// ---------------------------------------------------------------------------
// POST / — Submit a rating for a completed ride
// ---------------------------------------------------------------------------
router.post('/', authenticate, validate(ratingSchema), async (req, res) => {
  try {
    const { rideId, score, comment } = req.body;
    const userId = req.user.id;

    // 1. Verify ride exists and is completed
    const rideResult = await query(
      `SELECT id, passenger_id, driver_id, status
       FROM rides
       WHERE id = $1`,
      [rideId],
    );

    if (rideResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Ride not found',
      });
    }

    const ride = rideResult.rows[0];

    if (ride.status !== 'completed') {
      return res.status(400).json({
        error: 'Bad request',
        message: 'You can only rate completed rides',
      });
    }

    // 2. Verify current user is the passenger or driver of this ride
    const isPassenger = ride.passenger_id === userId;
    const isDriver = ride.driver_id === userId;

    if (!isPassenger && !isDriver) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You can only rate rides you participated in',
      });
    }

    // 3. Determine who is being rated
    const raterId = userId;
    const ratedId = isPassenger ? ride.driver_id : ride.passenger_id;

    // 4. Check if user has already rated this ride (unique constraint fallback)
    const existingRating = await query(
      `SELECT id FROM ratings
       WHERE ride_id = $1 AND rater_id = $2`,
      [rideId, raterId],
    );

    if (existingRating.rows.length > 0) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'You have already rated this ride',
      });
    }

    // 5. Insert the rating
    const ratingResult = await query(
      `INSERT INTO ratings (ride_id, rater_id, rated_id, score, comment)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, ride_id, rater_id, rated_id, score, comment, created_at`,
      [rideId, raterId, ratedId, score, comment || null],
    );

    const rating = ratingResult.rows[0];

    // 6. Update the rated user's rating_avg and rating_count
    //    new_avg = ((old_avg * old_count) + new_score) / (old_count + 1)
    await query(
      `UPDATE users
       SET rating_avg = ((rating_avg * rating_count) + $1) / (rating_count + 1),
           rating_count = rating_count + 1
       WHERE id = $2`,
      [score, ratedId],
    );

    return res.status(201).json({
      rating: {
        id: rating.id,
        rideId: rating.ride_id,
        raterId: rating.rater_id,
        ratedId: rating.rated_id,
        score: rating.score,
        comment: rating.comment,
        createdAt: rating.created_at,
      },
    });
  } catch (err) {
    // Handle unique constraint violation as a fallback
    if (err.code === '23505' && err.constraint === 'ratings_ride_id_rater_id_key') {
      return res.status(409).json({
        error: 'Conflict',
        message: 'You have already rated this ride',
      });
    }
    console.error('[ratings] POST / error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred while submitting the rating',
    });
  }
});

// ---------------------------------------------------------------------------
// GET /ride/:rideId — Get ratings for a specific ride
// ---------------------------------------------------------------------------
router.get('/ride/:rideId', authenticate, async (req, res) => {
  try {
    const { rideId } = req.params;
    const userId = req.user.id;

    // Verify the ride exists and the user is involved
    const rideResult = await query(
      `SELECT id, passenger_id, driver_id
       FROM rides
       WHERE id = $1`,
      [rideId],
    );

    if (rideResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Ride not found',
      });
    }

    const ride = rideResult.rows[0];

    if (ride.passenger_id !== userId && ride.driver_id !== userId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You can only view ratings for rides you participated in',
      });
    }

    // Get all ratings for this ride (up to 2: passenger's and driver's)
    const ratingsResult = await query(
      `SELECT r.id, r.ride_id, r.rater_id, r.rated_id, r.score, r.comment,
              r.created_at,
              u_rater.first_name AS rater_first_name,
              u_rater.last_name AS rater_last_name,
              u_rated.first_name AS rated_first_name,
              u_rated.last_name AS rated_last_name
       FROM ratings r
       JOIN users u_rater ON u_rater.id = r.rater_id
       JOIN users u_rated ON u_rated.id = r.rated_id
       WHERE r.ride_id = $1
       ORDER BY r.created_at ASC`,
      [rideId],
    );

    const ratings = ratingsResult.rows.map((row) => ({
      id: row.id,
      rideId: row.ride_id,
      raterId: row.rater_id,
      raterName: `${row.rater_first_name} ${row.rater_last_name}`,
      ratedId: row.rated_id,
      ratedName: `${row.rated_first_name} ${row.rated_last_name}`,
      score: row.score,
      comment: row.comment,
      createdAt: row.created_at,
    }));

    return res.status(200).json({ ratings });
  } catch (err) {
    console.error('[ratings] GET /ride/:rideId error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred while fetching ride ratings',
    });
  }
});

// ---------------------------------------------------------------------------
// GET /me — Get all ratings received by the current user
// ---------------------------------------------------------------------------
router.get('/me', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;

    // Get total count of ratings received
    const countResult = await query(
      `SELECT COUNT(*) AS total FROM ratings WHERE rated_id = $1`,
      [userId],
    );
    const totalCount = parseInt(countResult.rows[0].total, 10);

    // Get the current user's average rating
    const userResult = await query(
      `SELECT rating_avg FROM users WHERE id = $1`,
      [userId],
    );
    const averageRating = userResult.rows.length > 0
      ? parseFloat(userResult.rows[0].rating_avg)
      : null;

    // Get paginated ratings with ride info
    const ratingsResult = await query(
      `SELECT r.id, r.ride_id, r.rater_id, r.score, r.comment, r.created_at,
              u.first_name AS rater_first_name,
              u.last_name AS rater_last_name,
              ri.pickup_address,
              ri.dropoff_address,
              ri.dropoff_at AS ride_date
       FROM ratings r
       JOIN users u ON u.id = r.rater_id
       JOIN rides ri ON ri.id = r.ride_id
       WHERE r.rated_id = $1
       ORDER BY r.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset],
    );

    const ratings = ratingsResult.rows.map((row) => ({
      id: row.id,
      rideId: row.ride_id,
      raterId: row.rater_id,
      raterName: `${row.rater_first_name} ${row.rater_last_name}`,
      score: row.score,
      comment: row.comment,
      createdAt: row.created_at,
      ride: {
        date: row.ride_date,
        pickup: row.pickup_address,
        dropoff: row.dropoff_address,
      },
    }));

    return res.status(200).json({
      ratings,
      averageRating,
      totalCount,
      page,
      limit,
    });
  } catch (err) {
    console.error('[ratings] GET /me error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred while fetching your ratings',
    });
  }
});

export default router;
