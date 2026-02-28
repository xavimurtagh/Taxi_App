/**
 * Earth's mean radius in kilometres.
 */
const EARTH_RADIUS_KM = 6371;

/**
 * Convert degrees to radians.
 *
 * @param {number} deg - Angle in degrees
 * @returns {number} Angle in radians
 */
function toRadians(deg) {
  return (deg * Math.PI) / 180;
}

/**
 * Calculate the great-circle distance between two points on the Earth's
 * surface using the Haversine formula.
 *
 * @param {number} lat1 - Latitude of point 1 (degrees)
 * @param {number} lng1 - Longitude of point 1 (degrees)
 * @param {number} lat2 - Latitude of point 2 (degrees)
 * @param {number} lng2 - Longitude of point 2 (degrees)
 * @returns {number} Distance in kilometres
 */
export function haversineDistance(lat1, lng1, lat2, lng2) {
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_KM * c;
}

/**
 * Compute an axis-aligned bounding box around a centre point for a given
 * radius.  Useful for fast SQL pre-filtering before applying precise
 * distance checks.
 *
 * @param {number} lat       - Centre latitude (degrees)
 * @param {number} lng       - Centre longitude (degrees)
 * @param {number} radiusKm  - Radius in kilometres
 * @returns {{ minLat: number, maxLat: number, minLng: number, maxLng: number }}
 */
export function boundingBox(lat, lng, radiusKm) {
  // Angular distance in radians on a great circle
  const angularRadius = radiusKm / EARTH_RADIUS_KM;

  const latRad = toRadians(lat);

  const deltaLat = angularRadius;
  // Longitude delta varies with latitude
  const deltaLng = Math.asin(Math.sin(angularRadius) / Math.cos(latRad));

  const toDeg = (rad) => (rad * 180) / Math.PI;

  return {
    minLat: lat - toDeg(deltaLat),
    maxLat: lat + toDeg(deltaLat),
    minLng: lng - toDeg(deltaLng),
    maxLng: lng + toDeg(deltaLng),
  };
}

/**
 * Check whether two geographic points are within a given radius of each other.
 *
 * @param {number} lat1      - Latitude of point 1 (degrees)
 * @param {number} lng1      - Longitude of point 1 (degrees)
 * @param {number} lat2      - Latitude of point 2 (degrees)
 * @param {number} lng2      - Longitude of point 2 (degrees)
 * @param {number} radiusKm  - Maximum allowed distance in kilometres
 * @returns {boolean} true if the points are within the specified radius
 */
export function isWithinRadius(lat1, lng1, lat2, lng2, radiusKm) {
  return haversineDistance(lat1, lng1, lat2, lng2) <= radiusKm;
}
