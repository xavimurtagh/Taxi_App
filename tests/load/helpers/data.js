/**
 * Test data generators for k6 load tests.
 *
 * Generates realistic random coordinates, user data, and ride parameters
 * centred around a configurable city. The default city is San Francisco.
 */

// ---------------------------------------------------------------------------
// City bounding box (San Francisco, CA)
// ---------------------------------------------------------------------------
const CITY = {
  name: 'San Francisco',
  center: { lat: 37.7749, lng: -122.4194 },
  bounds: {
    minLat: 37.7080,
    maxLat: 37.8120,
    minLng: -122.5150,
    maxLng: -122.3550,
  },
};

// ---------------------------------------------------------------------------
// Well-known landmarks for realistic addresses
// ---------------------------------------------------------------------------
const LANDMARKS = [
  { name: 'Union Square',          lat: 37.7880, lng: -122.4075 },
  { name: 'Fisherman\'s Wharf',    lat: 37.8080, lng: -122.4177 },
  { name: 'Golden Gate Park',      lat: 37.7694, lng: -122.4862 },
  { name: 'Mission District',      lat: 37.7599, lng: -122.4148 },
  { name: 'SOMA',                  lat: 37.7785, lng: -122.3950 },
  { name: 'Chinatown',             lat: 37.7941, lng: -122.4078 },
  { name: 'Embarcadero',           lat: 37.7936, lng: -122.3930 },
  { name: 'Haight-Ashbury',        lat: 37.7692, lng: -122.4481 },
  { name: 'Nob Hill',              lat: 37.7930, lng: -122.4161 },
  { name: 'Pacific Heights',       lat: 37.7925, lng: -122.4382 },
  { name: 'Castro',                lat: 37.7609, lng: -122.4350 },
  { name: 'Marina District',       lat: 37.8012, lng: -122.4364 },
  { name: 'Potrero Hill',          lat: 37.7580, lng: -122.3986 },
  { name: 'Sunset District',       lat: 37.7530, lng: -122.4940 },
  { name: 'Richmond District',     lat: 37.7800, lng: -122.4780 },
  { name: 'SFO Airport',           lat: 37.6213, lng: -122.3790 },
  { name: 'Caltrain Station',      lat: 37.7765, lng: -122.3943 },
  { name: 'AT&T Park',             lat: 37.7786, lng: -122.3893 },
  { name: 'Civic Center',          lat: 37.7792, lng: -122.4191 },
  { name: 'North Beach',           lat: 37.8060, lng: -122.4103 },
];

// ---------------------------------------------------------------------------
// Street names for generated addresses
// ---------------------------------------------------------------------------
const STREETS = [
  'Market St', 'Mission St', 'Valencia St', 'Folsom St', 'Howard St',
  'Geary Blvd', 'Van Ness Ave', 'Columbus Ave', 'Lombard St', 'Hayes St',
  'Divisadero St', 'Fillmore St', 'Castro St', 'Haight St', 'Irving St',
  'Judah St', 'Taraval St', 'Clement St', 'Balboa St', 'Fulton St',
];

// ---------------------------------------------------------------------------
// Coordinate generators
// ---------------------------------------------------------------------------

/**
 * Generate a random latitude within the city bounds.
 * @returns {number}
 */
function randomLat() {
  return CITY.bounds.minLat + Math.random() * (CITY.bounds.maxLat - CITY.bounds.minLat);
}

/**
 * Generate a random longitude within the city bounds.
 * @returns {number}
 */
function randomLng() {
  return CITY.bounds.minLng + Math.random() * (CITY.bounds.maxLng - CITY.bounds.minLng);
}

/**
 * Generate a random pickup point.
 * 50% chance of using a known landmark, 50% chance of a random coordinate.
 *
 * @returns {{ lat: number, lng: number, address: string }}
 */
export function randomPickup() {
  if (Math.random() < 0.5) {
    const landmark = LANDMARKS[Math.floor(Math.random() * LANDMARKS.length)];
    // Add small jitter (±0.001 degrees ≈ 100m)
    return {
      lat: parseFloat((landmark.lat + (Math.random() - 0.5) * 0.002).toFixed(6)),
      lng: parseFloat((landmark.lng + (Math.random() - 0.5) * 0.002).toFixed(6)),
      address: `Near ${landmark.name}, San Francisco, CA`,
    };
  }

  const streetNum = Math.floor(Math.random() * 2000) + 1;
  const street = STREETS[Math.floor(Math.random() * STREETS.length)];

  return {
    lat: parseFloat(randomLat().toFixed(6)),
    lng: parseFloat(randomLng().toFixed(6)),
    address: `${streetNum} ${street}, San Francisco, CA`,
  };
}

/**
 * Generate a random dropoff point that is distinct from the pickup.
 * Ensures a minimum distance to avoid trivial trips.
 *
 * @returns {{ lat: number, lng: number, address: string }}
 */
export function randomDropoff() {
  const landmark = LANDMARKS[Math.floor(Math.random() * LANDMARKS.length)];

  // Add jitter
  return {
    lat: parseFloat((landmark.lat + (Math.random() - 0.5) * 0.004).toFixed(6)),
    lng: parseFloat((landmark.lng + (Math.random() - 0.5) * 0.004).toFixed(6)),
    address: `Near ${landmark.name}, San Francisco, CA`,
  };
}

// ---------------------------------------------------------------------------
// User data generators
// ---------------------------------------------------------------------------

const FIRST_NAMES = [
  'Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Hank',
  'Ivy', 'Jack', 'Kate', 'Liam', 'Mia', 'Noah', 'Olivia', 'Pete',
  'Quinn', 'Rosa', 'Sam', 'Tina', 'Uma', 'Vic', 'Wendy', 'Xander',
];

const LAST_NAMES = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller',
  'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez',
  'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin',
];

/**
 * Generate random user registration data.
 *
 * @param {string} role — 'passenger' | 'driver' | 'both'
 * @param {string} [suffix] — optional suffix for uniqueness
 * @returns {{ email: string, password: string, firstName: string, lastName: string, phone: string, role: string }}
 */
export function randomUserData(role, suffix) {
  const id = suffix || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const firstName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
  const lastName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];

  return {
    email: `lt-${role}-${id}@openride.test`,
    password: `LT_${id}_Pass1!`,
    firstName,
    lastName,
    phone: `+1555${String(Math.floor(Math.random() * 9000000) + 1000000)}`,
    role,
  };
}

// ---------------------------------------------------------------------------
// Ride parameter generators
// ---------------------------------------------------------------------------

const VEHICLE_TYPES = ['economy', 'comfort', 'premium'];

/**
 * Pick a random vehicle type with a realistic distribution:
 *   economy: 60%, comfort: 30%, premium: 10%
 *
 * @returns {string}
 */
export function randomVehicleType() {
  const roll = Math.random();
  if (roll < 0.6) return 'economy';
  if (roll < 0.9) return 'comfort';
  return 'premium';
}

/**
 * Generate a complete set of random ride request parameters.
 *
 * @returns {object} — ready to JSON.stringify and POST to /rides
 */
export function randomRideParams() {
  const pickup = randomPickup();
  const dropoff = randomDropoff();

  return {
    pickupLat: pickup.lat,
    pickupLng: pickup.lng,
    pickupAddress: pickup.address,
    dropoffLat: dropoff.lat,
    dropoffLng: dropoff.lng,
    dropoffAddress: dropoff.address,
    vehicleType: randomVehicleType(),
  };
}

/**
 * Generate random ride completion data (actual distance and duration).
 *
 * @returns {{ actualDistanceKm: string, actualDurationMin: string }}
 */
export function randomCompletionData() {
  return {
    actualDistanceKm: (2 + Math.random() * 20).toFixed(1),
    actualDurationMin: String(Math.floor(5 + Math.random() * 40)),
  };
}

/**
 * Generate a random rating (1-5) with a realistic bell-curve distribution.
 * Most ratings cluster around 4-5 stars.
 *
 * @returns {number}
 */
export function randomRating() {
  const roll = Math.random();
  if (roll < 0.05) return 1;
  if (roll < 0.10) return 2;
  if (roll < 0.20) return 3;
  if (roll < 0.55) return 4;
  return 5;
}
