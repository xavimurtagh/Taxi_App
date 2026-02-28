import env from '../config/env.js';

/**
 * Vehicle type multipliers applied to the base fare calculation.
 */
const VEHICLE_MULTIPLIERS = {
  economy: 1.0,
  comfort: 1.3,
  xl: 1.5,
  accessible: 1.0,
};

/**
 * Calculate the fare for a ride.
 *
 * Formula:
 *   rawFare = (BASE_FARE + distanceKm * PER_KM_RATE + durationMinutes * PER_MINUTE_RATE)
 *             * vehicleMultiplier
 *   fare    = max(MINIMUM_FARE, rawFare) * min(surgeMultiplier, SURGE_CAP)
 *
 * @param {Object} params
 * @param {number} params.distanceKm       - Trip distance in kilometres
 * @param {number} params.durationMinutes  - Estimated trip duration in minutes
 * @param {number} [params.surgeMultiplier=1.0] - Current surge pricing multiplier
 * @param {string} [params.vehicleType='economy'] - Vehicle class
 * @returns {{
 *   fare: number,
 *   platformFee: number,
 *   driverPayout: number,
 *   surgeMultiplier: number,
 *   breakdown: {
 *     baseFare: number,
 *     distanceCharge: number,
 *     timeCharge: number,
 *     vehicleMultiplier: number,
 *     surgeApplied: number
 *   }
 * }}
 */
export function calculateFare({
  distanceKm,
  durationMinutes,
  surgeMultiplier = 1.0,
  vehicleType = 'economy',
}) {
  const {
    BASE_FARE,
    PER_KM_RATE,
    PER_MINUTE_RATE,
    MINIMUM_FARE,
    SURGE_CAP,
    PLATFORM_FEE_PERCENT,
  } = env;

  // Resolve vehicle multiplier (default to economy if unknown type)
  const vehicleMultiplier = VEHICLE_MULTIPLIERS[vehicleType] ?? VEHICLE_MULTIPLIERS.economy;

  // Cap the surge multiplier
  const surgeApplied = Math.min(surgeMultiplier, SURGE_CAP);

  // Calculate individual fare components
  const baseFare = BASE_FARE;
  const distanceCharge = distanceKm * PER_KM_RATE;
  const timeCharge = durationMinutes * PER_MINUTE_RATE;

  // Apply formula: max(minimum, (base + distance + time) * vehicleMultiplier) * surge
  const subtotal = (baseFare + distanceCharge + timeCharge) * vehicleMultiplier;
  const fare = round(Math.max(MINIMUM_FARE, subtotal) * surgeApplied);

  // Platform fee and driver payout
  const platformFee = round(fare * PLATFORM_FEE_PERCENT / 100);
  const driverPayout = round(fare - platformFee);

  return {
    fare,
    platformFee,
    driverPayout,
    surgeMultiplier: surgeApplied,
    breakdown: {
      baseFare: round(baseFare),
      distanceCharge: round(distanceCharge),
      timeCharge: round(timeCharge),
      vehicleMultiplier,
      surgeApplied,
    },
  };
}

/**
 * Round a number to two decimal places (currency precision).
 *
 * @param {number} value
 * @returns {number}
 */
function round(value) {
  return Math.round(value * 100) / 100;
}
