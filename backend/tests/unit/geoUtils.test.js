/**
 * Unit tests for src/utils/geoUtils.js
 *
 * These functions are pure math with no external dependencies,
 * so they can be tested directly.
 */

const { haversineDistance, boundingBox, isWithinRadius } = await import(
  '../../src/utils/geoUtils.js'
);

describe('haversineDistance', () => {
  test('returns 0 for the same point', () => {
    const d = haversineDistance(40.7128, -74.006, 40.7128, -74.006);
    expect(d).toBe(0);
  });

  test('calculates distance between New York and Los Angeles (~3940 km)', () => {
    // NYC: 40.7128 N, 74.0060 W
    // LAX: 33.9425 N, 118.4081 W
    const d = haversineDistance(40.7128, -74.006, 33.9425, -118.4081);
    // Accepted range: roughly 3940 km (actual great-circle ~ 3944 km)
    expect(d).toBeGreaterThan(3900);
    expect(d).toBeLessThan(4000);
  });

  test('calculates distance between London and Paris (~344 km)', () => {
    // London: 51.5074 N, 0.1278 W
    // Paris: 48.8566 N, 2.3522 E
    const d = haversineDistance(51.5074, -0.1278, 48.8566, 2.3522);
    expect(d).toBeGreaterThan(330);
    expect(d).toBeLessThan(360);
  });

  test('calculates distance between North Pole and South Pole (~20015 km)', () => {
    const d = haversineDistance(90, 0, -90, 0);
    // Half circumference of Earth ~ 20015 km
    expect(d).toBeGreaterThan(19900);
    expect(d).toBeLessThan(20100);
  });

  test('short distance (within a city) is accurate', () => {
    // Times Square to Central Park South (~1 km)
    // Times Square: 40.758, -73.9855
    // Central Park South: 40.7648, -73.9773
    const d = haversineDistance(40.758, -73.9855, 40.7648, -73.9773);
    expect(d).toBeGreaterThan(0.5);
    expect(d).toBeLessThan(1.5);
  });

  test('distance is symmetric', () => {
    const d1 = haversineDistance(40.7128, -74.006, 51.5074, -0.1278);
    const d2 = haversineDistance(51.5074, -0.1278, 40.7128, -74.006);
    expect(d1).toBeCloseTo(d2, 10);
  });

  test('handles crossing the antimeridian', () => {
    // Tokyo (35.6762, 139.6503) to Honolulu (21.3069, -157.8583)
    const d = haversineDistance(35.6762, 139.6503, 21.3069, -157.8583);
    // Roughly 6200 km
    expect(d).toBeGreaterThan(6000);
    expect(d).toBeLessThan(6500);
  });

  test('equatorial points separated by 1 degree of longitude (~111 km)', () => {
    const d = haversineDistance(0, 0, 0, 1);
    expect(d).toBeGreaterThan(110);
    expect(d).toBeLessThan(112);
  });
});

describe('boundingBox', () => {
  test('produces a box centered on the given point', () => {
    const box = boundingBox(40.7128, -74.006, 10);

    expect(box.minLat).toBeLessThan(40.7128);
    expect(box.maxLat).toBeGreaterThan(40.7128);
    expect(box.minLng).toBeLessThan(-74.006);
    expect(box.maxLng).toBeGreaterThan(-74.006);
  });

  test('box is symmetric around the center latitude', () => {
    const box = boundingBox(40.7128, -74.006, 10);

    const latDeltaLow = 40.7128 - box.minLat;
    const latDeltaHigh = box.maxLat - 40.7128;
    expect(latDeltaLow).toBeCloseTo(latDeltaHigh, 6);
  });

  test('box is symmetric around the center longitude', () => {
    const box = boundingBox(40.7128, -74.006, 10);

    const lngDeltaLow = -74.006 - box.minLng;
    const lngDeltaHigh = box.maxLng - (-74.006);
    expect(lngDeltaLow).toBeCloseTo(lngDeltaHigh, 6);
  });

  test('larger radius produces larger box', () => {
    const small = boundingBox(40.7128, -74.006, 5);
    const large = boundingBox(40.7128, -74.006, 50);

    expect(large.maxLat - large.minLat).toBeGreaterThan(
      small.maxLat - small.minLat
    );
    expect(large.maxLng - large.minLng).toBeGreaterThan(
      small.maxLng - small.minLng
    );
  });

  test('zero radius returns a degenerate box (point)', () => {
    const box = boundingBox(40.7128, -74.006, 0);

    expect(box.minLat).toBeCloseTo(40.7128, 6);
    expect(box.maxLat).toBeCloseTo(40.7128, 6);
    expect(box.minLng).toBeCloseTo(-74.006, 6);
    expect(box.maxLng).toBeCloseTo(-74.006, 6);
  });

  test('10km bounding box has lat range of roughly 0.18 degrees', () => {
    // 10 km / 6371 km * (180/PI) ~ 0.0899 degrees each side
    const box = boundingBox(40.7128, -74.006, 10);
    const latRange = box.maxLat - box.minLat;
    // Total range should be about 0.18 degrees
    expect(latRange).toBeGreaterThan(0.15);
    expect(latRange).toBeLessThan(0.2);
  });

  test('returns all expected properties', () => {
    const box = boundingBox(0, 0, 100);

    expect(box).toHaveProperty('minLat');
    expect(box).toHaveProperty('maxLat');
    expect(box).toHaveProperty('minLng');
    expect(box).toHaveProperty('maxLng');
    expect(typeof box.minLat).toBe('number');
    expect(typeof box.maxLat).toBe('number');
    expect(typeof box.minLng).toBe('number');
    expect(typeof box.maxLng).toBe('number');
  });
});

describe('isWithinRadius', () => {
  test('same point is within any positive radius', () => {
    expect(isWithinRadius(40.7128, -74.006, 40.7128, -74.006, 0.001)).toBe(
      true
    );
  });

  test('nearby points within radius return true', () => {
    // Two points about 1 km apart within a 5 km radius
    expect(isWithinRadius(40.758, -73.9855, 40.7648, -73.9773, 5)).toBe(true);
  });

  test('distant points outside radius return false', () => {
    // NYC to LAX (~3940 km) within 100 km radius
    expect(isWithinRadius(40.7128, -74.006, 33.9425, -118.4081, 100)).toBe(
      false
    );
  });

  test('boundary case: exactly at the radius edge', () => {
    // Calculate exact distance first, then use that as the radius
    const d = haversineDistance(40.7128, -74.006, 40.758, -73.9855);
    expect(isWithinRadius(40.7128, -74.006, 40.758, -73.9855, d)).toBe(true);
    // Slightly less than the distance should be false
    expect(
      isWithinRadius(40.7128, -74.006, 40.758, -73.9855, d - 0.001)
    ).toBe(false);
  });

  test('zero radius only includes the exact same point', () => {
    expect(isWithinRadius(40.7128, -74.006, 40.7128, -74.006, 0)).toBe(true);
    expect(isWithinRadius(40.7128, -74.006, 40.7129, -74.006, 0)).toBe(false);
  });
});
