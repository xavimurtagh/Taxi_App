import { query } from '../config/database.js';
import redis from '../config/redis.js';
import { getIO } from '../sockets/index.js';
import { sendEmergencyAlert } from './sms.js';
import { haversineDistance } from '../utils/geoUtils.js';
import crypto from 'crypto';

/**
 * Trigger SOS emergency for an active ride
 */
export async function triggerSOS(userId, rideId) {
  // Get ride details
  const rideResult = await query(
    `SELECT r.*,
            u_p.first_name AS passenger_name, u_p.phone AS passenger_phone,
            u_d.first_name AS driver_name, u_d.phone AS driver_phone
     FROM rides r
     JOIN users u_p ON r.passenger_id = u_p.id
     LEFT JOIN users u_d ON r.driver_id = u_d.id
     WHERE r.id = $1 AND r.status IN ('matched', 'driver_arriving', 'in_progress')`,
    [rideId]
  );

  if (rideResult.rows.length === 0) {
    throw new Error('No active ride found');
  }

  const ride = rideResult.rows[0];

  // Get user's emergency contacts
  const contactsResult = await query(
    'SELECT name, phone, relationship FROM emergency_contacts WHERE user_id = $1',
    [userId]
  );

  // Determine current location from Redis
  const driverMeta = await redis.hgetall(`driver:meta:${ride.driver_id}`);
  const location = driverMeta.lat
    ? `${driverMeta.lat}, ${driverMeta.lng}`
    : 'Location unavailable';

  // Log the incident
  await query(
    `INSERT INTO safety_incidents (ride_id, reported_by, incident_type, description, status)
     VALUES ($1, $2, 'sos_triggered', $3, 'open')`,
    [rideId, userId, `SOS triggered during ride. Location: ${location}`]
  );

  // Send alerts to emergency contacts
  const userName = userId === ride.passenger_id ? ride.passenger_name : ride.driver_name;
  if (contactsResult.rows.length > 0) {
    await sendEmergencyAlert(contactsResult.rows, {
      userName,
      location,
      rideId,
    });
  }

  // Emit real-time alert to platform admins
  const io = getIO();
  if (io) {
    io.emit('safety:sos', {
      rideId,
      userId,
      location,
      timestamp: new Date().toISOString(),
    });
  }

  return {
    alertsSent: contactsResult.rows.length,
    incidentLogged: true,
    location,
  };
}

/**
 * Generate a trip share link
 */
export async function createTripShare(rideId, sharedWithPhone, sharedWithEmail) {
  const shareToken = crypto.randomBytes(32).toString('hex');

  // Expire 2 hours after creation
  const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000);

  const result = await query(
    `INSERT INTO trip_shares (ride_id, share_token, shared_with_phone, shared_with_email, expires_at)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, share_token, expires_at`,
    [rideId, shareToken, sharedWithPhone || null, sharedWithEmail || null, expiresAt]
  );

  return {
    shareToken: result.rows[0].share_token,
    shareUrl: `/trip/${result.rows[0].share_token}`,
    expiresAt: result.rows[0].expires_at,
  };
}

/**
 * Get shared trip info (public, no auth required)
 */
export async function getSharedTrip(shareToken) {
  const result = await query(
    `SELECT ts.*, r.status AS ride_status, r.pickup_address, r.dropoff_address,
            u_d.first_name AS driver_name, dp.vehicle_make, dp.vehicle_model,
            dp.vehicle_color, dp.vehicle_plate
     FROM trip_shares ts
     JOIN rides r ON ts.ride_id = r.id
     LEFT JOIN users u_d ON r.driver_id = u_d.id
     LEFT JOIN driver_profiles dp ON u_d.id = dp.user_id
     WHERE ts.share_token = $1 AND ts.expires_at > NOW()`,
    [shareToken]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const trip = result.rows[0];

  // Get current driver location from Redis if ride is active
  let driverLocation = null;
  if (trip.driver_id && ['matched', 'driver_arriving', 'in_progress'].includes(trip.ride_status)) {
    const meta = await redis.hgetall(`driver:meta:${trip.driver_id}`);
    if (meta.lat) {
      driverLocation = { lat: parseFloat(meta.lat), lng: parseFloat(meta.lng) };
    }
  }

  return {
    rideStatus: trip.ride_status,
    pickupAddress: trip.pickup_address,
    dropoffAddress: trip.dropoff_address,
    driver: trip.driver_name ? {
      firstName: trip.driver_name,
      vehicle: `${trip.vehicle_color} ${trip.vehicle_make} ${trip.vehicle_model}`,
      plate: trip.vehicle_plate,
    } : null,
    driverLocation,
  };
}

/**
 * Check if a ride is deviating from the expected route
 */
export async function checkRouteDeviation(rideId, currentLat, currentLng) {
  // Get ride route info
  const rideResult = await query(
    `SELECT ST_Y(pickup_location::geometry) AS pickup_lat,
            ST_X(pickup_location::geometry) AS pickup_lng,
            ST_Y(dropoff_location::geometry) AS dropoff_lat,
            ST_X(dropoff_location::geometry) AS dropoff_lng,
            estimated_distance_km
     FROM rides WHERE id = $1`,
    [rideId]
  );

  if (rideResult.rows.length === 0) return { deviated: false };

  const ride = rideResult.rows[0];

  // Simple deviation check: if current position is more than 2km from
  // the straight line between pickup and dropoff, flag it
  const distToPickup = haversineDistance(currentLat, currentLng, ride.pickup_lat, ride.pickup_lng);
  const distToDropoff = haversineDistance(currentLat, currentLng, ride.dropoff_lat, ride.dropoff_lng);
  const routeDistance = ride.estimated_distance_km ||
    haversineDistance(ride.pickup_lat, ride.pickup_lng, ride.dropoff_lat, ride.dropoff_lng);

  // If current position is further from both endpoints than the route length, likely deviated
  const maxExpectedDistance = routeDistance * 1.5 + 2; // 50% buffer + 2km
  const deviated = (distToPickup + distToDropoff) > maxExpectedDistance * 2;

  if (deviated) {
    // Log the deviation
    await query(
      `INSERT INTO safety_incidents (ride_id, incident_type, description, status)
       VALUES ($1, 'route_deviation', $2, 'open')
       ON CONFLICT DO NOTHING`,
      [rideId, `Driver deviated from expected route. Position: ${currentLat},${currentLng}. Expected route distance: ${routeDistance}km`]
    );
  }

  return {
    deviated,
    distanceFromPickup: Math.round(distToPickup * 10) / 10,
    distanceFromDropoff: Math.round(distToDropoff * 10) / 10,
  };
}

/**
 * Report a safety incident
 */
export async function reportIncident(rideId, reportedBy, incidentType, description) {
  const result = await query(
    `INSERT INTO safety_incidents (ride_id, reported_by, incident_type, description)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [rideId, reportedBy, incidentType, description]
  );

  // Alert admins
  const io = getIO();
  if (io) {
    io.emit('safety:incident', {
      incidentId: result.rows[0].id,
      rideId,
      type: incidentType,
      timestamp: new Date().toISOString(),
    });
  }

  return result.rows[0];
}
