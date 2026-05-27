import { calculateFare } from '../../src/utils/fareCalculator.js';

describe('calculateFare', () => {
  const r = (n) => Math.round(n * 100) / 100;

  describe('basic fare calculation', () => {
    test('calculates fare for a typical ride', () => {
      const result = calculateFare({
        distanceKm: 10,
        durationMinutes: 15,
      });

      // baseFare=2.5, distance=10*1.2=12, time=15*0.2=3
      // subtotal = (2.5 + 12 + 3) * 1.0 = 17.5
      expect(result.fare).toBe(17.5);
      expect(result.breakdown.baseFare).toBe(2.5);
      expect(result.breakdown.distanceCharge).toBe(12);
      expect(result.breakdown.timeCharge).toBe(3);
      expect(result.breakdown.vehicleMultiplier).toBe(1.0);
      expect(result.breakdown.surgeApplied).toBe(1.0);
    });

    test('calculates platform fee and driver payout', () => {
      const result = calculateFare({
        distanceKm: 10,
        durationMinutes: 15,
      });

      // fare = 17.5, platformFee = 17.5 * 7/100 = 1.225 -> 1.23
      expect(result.platformFee).toBe(r(17.5 * 7 / 100));
      expect(result.driverPayout).toBe(r(17.5 - result.platformFee));
      expect(result.fare).toBe(result.platformFee + result.driverPayout);
    });
  });

  describe('minimum fare enforcement', () => {
    test('enforces minimum fare for very short rides', () => {
      const result = calculateFare({
        distanceKm: 0.5,
        durationMinutes: 2,
      });

      // subtotal = (2.5 + 0.6 + 0.4) * 1.0 = 3.5 < 5.0 minimum
      expect(result.fare).toBe(5.0);
    });

    test('does not apply minimum when fare exceeds it', () => {
      const result = calculateFare({
        distanceKm: 20,
        durationMinutes: 30,
      });

      // subtotal = (2.5 + 24 + 6) * 1.0 = 32.5 > 5.0
      expect(result.fare).toBe(32.5);
    });
  });

  describe('surge pricing', () => {
    test('applies surge multiplier', () => {
      const result = calculateFare({
        distanceKm: 10,
        durationMinutes: 15,
        surgeMultiplier: 1.3,
      });

      // subtotal = 17.5, fare = 17.5 * 1.3 = 22.75
      expect(result.fare).toBe(22.75);
      expect(result.surgeMultiplier).toBe(1.3);
      expect(result.breakdown.surgeApplied).toBe(1.3);
    });

    test('caps surge at SURGE_CAP (1.5)', () => {
      const result = calculateFare({
        distanceKm: 10,
        durationMinutes: 15,
        surgeMultiplier: 3.0,
      });

      // surge capped at 1.5, fare = 17.5 * 1.5 = 26.25
      expect(result.fare).toBe(26.25);
      expect(result.surgeMultiplier).toBe(1.5);
      expect(result.breakdown.surgeApplied).toBe(1.5);
    });

    test('surge of 1.0 has no effect', () => {
      const result = calculateFare({
        distanceKm: 10,
        durationMinutes: 15,
        surgeMultiplier: 1.0,
      });

      expect(result.fare).toBe(17.5);
    });

    test('surge applies AFTER minimum fare', () => {
      const result = calculateFare({
        distanceKm: 0.5,
        durationMinutes: 2,
        surgeMultiplier: 1.5,
      });

      // subtotal = 3.5, min = 5.0, fare = max(5.0, 3.5) * 1.5 = 7.5
      expect(result.fare).toBe(7.5);
    });
  });

  describe('vehicle type multipliers', () => {
    test('economy has 1.0x multiplier', () => {
      const result = calculateFare({
        distanceKm: 10,
        durationMinutes: 15,
        vehicleType: 'economy',
      });

      expect(result.breakdown.vehicleMultiplier).toBe(1.0);
      expect(result.fare).toBe(17.5);
    });

    test('comfort has 1.3x multiplier', () => {
      const result = calculateFare({
        distanceKm: 10,
        durationMinutes: 15,
        vehicleType: 'comfort',
      });

      // subtotal = (2.5 + 12 + 3) * 1.3 = 22.75
      expect(result.breakdown.vehicleMultiplier).toBe(1.3);
      expect(result.fare).toBe(22.75);
    });

    test('xl has 1.5x multiplier', () => {
      const result = calculateFare({
        distanceKm: 10,
        durationMinutes: 15,
        vehicleType: 'xl',
      });

      // subtotal = (2.5 + 12 + 3) * 1.5 = 26.25
      expect(result.breakdown.vehicleMultiplier).toBe(1.5);
      expect(result.fare).toBe(26.25);
    });

    test('accessible has 1.0x multiplier', () => {
      const result = calculateFare({
        distanceKm: 10,
        durationMinutes: 15,
        vehicleType: 'accessible',
      });

      expect(result.breakdown.vehicleMultiplier).toBe(1.0);
      expect(result.fare).toBe(17.5);
    });

    test('unknown vehicle type falls back to economy', () => {
      const result = calculateFare({
        distanceKm: 10,
        durationMinutes: 15,
        vehicleType: 'helicopter',
      });

      expect(result.breakdown.vehicleMultiplier).toBe(1.0);
      expect(result.fare).toBe(17.5);
    });
  });

  describe('edge cases', () => {
    test('zero distance with some duration', () => {
      const result = calculateFare({
        distanceKm: 0,
        durationMinutes: 10,
      });

      // subtotal = (2.5 + 0 + 2) * 1.0 = 4.5 < 5.0 minimum
      expect(result.fare).toBe(5.0);
    });

    test('zero duration with some distance', () => {
      const result = calculateFare({
        distanceKm: 5,
        durationMinutes: 0,
      });

      // subtotal = (2.5 + 6 + 0) * 1.0 = 8.5
      expect(result.fare).toBe(8.5);
    });

    test('zero distance and zero duration returns minimum fare', () => {
      const result = calculateFare({
        distanceKm: 0,
        durationMinutes: 0,
      });

      expect(result.fare).toBe(5.0);
    });

    test('very large distance produces correct result', () => {
      const result = calculateFare({
        distanceKm: 1000,
        durationMinutes: 600,
      });

      // subtotal = (2.5 + 1200 + 120) * 1.0 = 1322.5
      expect(result.fare).toBe(1322.5);
    });

    test('returns all expected keys', () => {
      const result = calculateFare({
        distanceKm: 10,
        durationMinutes: 15,
      });

      expect(result).toHaveProperty('fare');
      expect(result).toHaveProperty('platformFee');
      expect(result).toHaveProperty('driverPayout');
      expect(result).toHaveProperty('surgeMultiplier');
      expect(result).toHaveProperty('breakdown');
      expect(result.breakdown).toHaveProperty('baseFare');
      expect(result.breakdown).toHaveProperty('distanceCharge');
      expect(result.breakdown).toHaveProperty('timeCharge');
      expect(result.breakdown).toHaveProperty('vehicleMultiplier');
      expect(result.breakdown).toHaveProperty('surgeApplied');
    });

    test('all fare values are rounded to 2 decimal places', () => {
      const result = calculateFare({
        distanceKm: 7.777,
        durationMinutes: 13.333,
        surgeMultiplier: 1.25,
        vehicleType: 'comfort',
      });

      const check2Decimals = (val) => {
        const str = val.toString();
        const parts = str.split('.');
        if (parts.length === 2) {
          expect(parts[1].length).toBeLessThanOrEqual(2);
        }
      };

      check2Decimals(result.fare);
      check2Decimals(result.platformFee);
      check2Decimals(result.driverPayout);
    });

    test('comfort + surge combined multipliers', () => {
      const result = calculateFare({
        distanceKm: 10,
        durationMinutes: 15,
        surgeMultiplier: 1.5,
        vehicleType: 'comfort',
      });

      // subtotal = (2.5 + 12 + 3) * 1.3 = 22.75
      // fare = max(5.0, 22.75) * 1.5 = 34.125 -> 34.13
      expect(result.fare).toBe(34.13);
    });
  });
});
