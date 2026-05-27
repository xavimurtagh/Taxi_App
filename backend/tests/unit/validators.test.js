/**
 * Unit tests for src/utils/validators.js
 *
 * These are Joi schemas, so we test them by calling .validate() directly.
 * No mocking needed — Joi has no external dependencies.
 */

const {
  registerSchema,
  loginSchema,
  rideRequestSchema,
  ratingSchema,
  proposalSchema,
  voteSchema,
  updateLocationSchema,
} = await import('../../src/utils/validators.js');

// ---------------------------------------------------------------------------
// registerSchema
// ---------------------------------------------------------------------------
describe('registerSchema', () => {
  const validUser = {
    email: 'test@example.com',
    phone: '+1234567890',
    password: 'securepass',
    firstName: 'Jane',
    lastName: 'Doe',
    role: 'passenger',
  };

  test('accepts valid registration data', () => {
    const { error } = registerSchema.validate(validUser);
    expect(error).toBeUndefined();
  });

  // Email validation
  test('rejects missing email', () => {
    const { error } = registerSchema.validate({ ...validUser, email: undefined });
    expect(error).toBeDefined();
    expect(error.details[0].path).toContain('email');
  });

  test('rejects invalid email', () => {
    const { error } = registerSchema.validate({ ...validUser, email: 'not-an-email' });
    expect(error).toBeDefined();
    expect(error.details[0].message).toMatch(/email/i);
  });

  test('rejects email without domain', () => {
    const { error } = registerSchema.validate({ ...validUser, email: 'user@' });
    expect(error).toBeDefined();
  });

  // Phone validation
  test('rejects missing phone', () => {
    const { error } = registerSchema.validate({ ...validUser, phone: undefined });
    expect(error).toBeDefined();
  });

  test('accepts E.164 phone with +', () => {
    const { error } = registerSchema.validate({ ...validUser, phone: '+447911123456' });
    expect(error).toBeUndefined();
  });

  test('accepts E.164 phone without +', () => {
    const { error } = registerSchema.validate({ ...validUser, phone: '1234567890' });
    expect(error).toBeUndefined();
  });

  test('rejects phone starting with 0', () => {
    const { error } = registerSchema.validate({ ...validUser, phone: '0123456789' });
    expect(error).toBeDefined();
  });

  test('rejects phone with letters', () => {
    const { error } = registerSchema.validate({ ...validUser, phone: '+1abc567890' });
    expect(error).toBeDefined();
  });

  // Password validation
  test('rejects password shorter than 8 characters', () => {
    const { error } = registerSchema.validate({ ...validUser, password: 'short' });
    expect(error).toBeDefined();
    expect(error.details[0].message).toMatch(/8 characters/i);
  });

  test('accepts password of exactly 8 characters', () => {
    const { error } = registerSchema.validate({ ...validUser, password: '12345678' });
    expect(error).toBeUndefined();
  });

  // Role validation
  test('accepts passenger role', () => {
    const { error } = registerSchema.validate({ ...validUser, role: 'passenger' });
    expect(error).toBeUndefined();
  });

  test('accepts driver role', () => {
    const { error } = registerSchema.validate({ ...validUser, role: 'driver' });
    expect(error).toBeUndefined();
  });

  test('accepts both role', () => {
    const { error } = registerSchema.validate({ ...validUser, role: 'both' });
    expect(error).toBeUndefined();
  });

  test('rejects invalid role', () => {
    const { error } = registerSchema.validate({ ...validUser, role: 'admin' });
    expect(error).toBeDefined();
    expect(error.details[0].message).toMatch(/passenger.*driver.*both/i);
  });

  // Name validation
  test('rejects missing firstName', () => {
    const { error } = registerSchema.validate({ ...validUser, firstName: undefined });
    expect(error).toBeDefined();
  });

  test('rejects empty lastName', () => {
    const { error } = registerSchema.validate({ ...validUser, lastName: '' });
    expect(error).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// loginSchema
// ---------------------------------------------------------------------------
describe('loginSchema', () => {
  test('accepts valid login credentials', () => {
    const { error } = loginSchema.validate({
      email: 'test@example.com',
      password: 'mypassword',
    });
    expect(error).toBeUndefined();
  });

  test('rejects missing email', () => {
    const { error } = loginSchema.validate({ password: 'mypassword' });
    expect(error).toBeDefined();
  });

  test('rejects invalid email format', () => {
    const { error } = loginSchema.validate({
      email: 'not-email',
      password: 'mypassword',
    });
    expect(error).toBeDefined();
  });

  test('rejects missing password', () => {
    const { error } = loginSchema.validate({ email: 'test@example.com' });
    expect(error).toBeDefined();
  });

  test('does not enforce minimum password length (login != register)', () => {
    // Login schema should accept any non-empty password
    const { error } = loginSchema.validate({
      email: 'test@example.com',
      password: 'ab',
    });
    expect(error).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// rideRequestSchema
// ---------------------------------------------------------------------------
describe('rideRequestSchema', () => {
  const validRide = {
    pickupLat: 40.7128,
    pickupLng: -74.006,
    pickupAddress: '350 Fifth Avenue, New York, NY',
    dropoffLat: 40.758,
    dropoffLng: -73.9855,
    dropoffAddress: 'Times Square, New York, NY',
    vehicleType: 'economy',
  };

  test('accepts valid ride request', () => {
    const { error } = rideRequestSchema.validate(validRide);
    expect(error).toBeUndefined();
  });

  test('defaults vehicleType to economy when not provided', () => {
    const { vehicleType, ...withoutVehicle } = validRide;
    const { error, value } = rideRequestSchema.validate(withoutVehicle);
    expect(error).toBeUndefined();
    expect(value.vehicleType).toBe('economy');
  });

  // Coordinate validation
  test('rejects pickupLat outside -90 to 90', () => {
    const { error } = rideRequestSchema.validate({ ...validRide, pickupLat: 91 });
    expect(error).toBeDefined();
    expect(error.details[0].message).toMatch(/latitude/i);
  });

  test('rejects pickupLat below -90', () => {
    const { error } = rideRequestSchema.validate({ ...validRide, pickupLat: -91 });
    expect(error).toBeDefined();
  });

  test('rejects pickupLng outside -180 to 180', () => {
    const { error } = rideRequestSchema.validate({ ...validRide, pickupLng: 181 });
    expect(error).toBeDefined();
  });

  test('rejects dropoffLat outside range', () => {
    const { error } = rideRequestSchema.validate({ ...validRide, dropoffLat: -91 });
    expect(error).toBeDefined();
  });

  test('rejects dropoffLng outside range', () => {
    const { error } = rideRequestSchema.validate({ ...validRide, dropoffLng: 200 });
    expect(error).toBeDefined();
  });

  test('accepts edge values -90 and 90 for latitude', () => {
    const { error: e1 } = rideRequestSchema.validate({ ...validRide, pickupLat: -90 });
    expect(e1).toBeUndefined();
    const { error: e2 } = rideRequestSchema.validate({ ...validRide, pickupLat: 90 });
    expect(e2).toBeUndefined();
  });

  test('accepts edge values -180 and 180 for longitude', () => {
    const { error: e1 } = rideRequestSchema.validate({ ...validRide, pickupLng: -180 });
    expect(e1).toBeUndefined();
    const { error: e2 } = rideRequestSchema.validate({ ...validRide, pickupLng: 180 });
    expect(e2).toBeUndefined();
  });

  // Vehicle types
  test('accepts all valid vehicle types', () => {
    for (const vt of ['economy', 'comfort', 'xl', 'accessible']) {
      const { error } = rideRequestSchema.validate({ ...validRide, vehicleType: vt });
      expect(error).toBeUndefined();
    }
  });

  test('rejects invalid vehicle type', () => {
    const { error } = rideRequestSchema.validate({ ...validRide, vehicleType: 'luxury' });
    expect(error).toBeDefined();
  });

  // Required fields
  test('rejects missing pickupAddress', () => {
    const { error } = rideRequestSchema.validate({ ...validRide, pickupAddress: undefined });
    expect(error).toBeDefined();
  });

  test('rejects missing dropoffAddress', () => {
    const { error } = rideRequestSchema.validate({ ...validRide, dropoffAddress: undefined });
    expect(error).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// ratingSchema
// ---------------------------------------------------------------------------
describe('ratingSchema', () => {
  test('accepts valid rating', () => {
    const { error } = ratingSchema.validate({
      rideId: '550e8400-e29b-41d4-a716-446655440000',
      score: 5,
      comment: 'Great ride!',
    });
    expect(error).toBeUndefined();
  });

  test('rejects non-UUID rideId', () => {
    const { error } = ratingSchema.validate({
      rideId: 'not-a-uuid',
      score: 5,
    });
    expect(error).toBeDefined();
  });

  test('rejects score below 1', () => {
    const { error } = ratingSchema.validate({
      rideId: '550e8400-e29b-41d4-a716-446655440000',
      score: 0,
    });
    expect(error).toBeDefined();
  });

  test('rejects score above 5', () => {
    const { error } = ratingSchema.validate({
      rideId: '550e8400-e29b-41d4-a716-446655440000',
      score: 6,
    });
    expect(error).toBeDefined();
  });

  test('rejects non-integer score', () => {
    const { error } = ratingSchema.validate({
      rideId: '550e8400-e29b-41d4-a716-446655440000',
      score: 3.5,
    });
    expect(error).toBeDefined();
  });

  test('allows empty comment', () => {
    const { error } = ratingSchema.validate({
      rideId: '550e8400-e29b-41d4-a716-446655440000',
      score: 4,
      comment: '',
    });
    expect(error).toBeUndefined();
  });

  test('allows missing comment', () => {
    const { error } = ratingSchema.validate({
      rideId: '550e8400-e29b-41d4-a716-446655440000',
      score: 4,
    });
    expect(error).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// proposalSchema
// ---------------------------------------------------------------------------
describe('proposalSchema', () => {
  test('accepts valid proposal', () => {
    const { error } = proposalSchema.validate({
      title: 'Add bike lanes',
      description: 'We should add dedicated bike lanes to reduce congestion.',
      category: 'feature',
    });
    expect(error).toBeUndefined();
  });

  test('rejects title shorter than 5 chars', () => {
    const { error } = proposalSchema.validate({
      title: 'Hi',
      description: 'This is a sufficiently long description for testing.',
      category: 'policy',
    });
    expect(error).toBeDefined();
  });

  test('rejects description shorter than 20 chars', () => {
    const { error } = proposalSchema.validate({
      title: 'Valid title here',
      description: 'Too short',
      category: 'policy',
    });
    expect(error).toBeDefined();
  });

  test('accepts all valid categories', () => {
    const categories = ['policy', 'feature', 'fee_structure', 'safety', 'community', 'other'];
    for (const cat of categories) {
      const { error } = proposalSchema.validate({
        title: 'Valid title here',
        description: 'This is a sufficiently long description for testing validation.',
        category: cat,
      });
      expect(error).toBeUndefined();
    }
  });

  test('rejects invalid category', () => {
    const { error } = proposalSchema.validate({
      title: 'Valid title here',
      description: 'This is a sufficiently long description for testing validation.',
      category: 'invalid',
    });
    expect(error).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// voteSchema
// ---------------------------------------------------------------------------
describe('voteSchema', () => {
  test('accepts valid vote', () => {
    const { error } = voteSchema.validate({
      proposalId: '550e8400-e29b-41d4-a716-446655440000',
      vote: 'for',
    });
    expect(error).toBeUndefined();
  });

  test('accepts all vote values', () => {
    for (const v of ['for', 'against', 'abstain']) {
      const { error } = voteSchema.validate({
        proposalId: '550e8400-e29b-41d4-a716-446655440000',
        vote: v,
      });
      expect(error).toBeUndefined();
    }
  });

  test('rejects invalid vote value', () => {
    const { error } = voteSchema.validate({
      proposalId: '550e8400-e29b-41d4-a716-446655440000',
      vote: 'maybe',
    });
    expect(error).toBeDefined();
  });

  test('rejects non-UUID proposalId', () => {
    const { error } = voteSchema.validate({
      proposalId: '12345',
      vote: 'for',
    });
    expect(error).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// updateLocationSchema
// ---------------------------------------------------------------------------
describe('updateLocationSchema', () => {
  test('accepts valid coordinates', () => {
    const { error } = updateLocationSchema.validate({ lat: 40.7128, lng: -74.006 });
    expect(error).toBeUndefined();
  });

  test('rejects lat above 90', () => {
    const { error } = updateLocationSchema.validate({ lat: 91, lng: 0 });
    expect(error).toBeDefined();
  });

  test('rejects lat below -90', () => {
    const { error } = updateLocationSchema.validate({ lat: -91, lng: 0 });
    expect(error).toBeDefined();
  });

  test('rejects lng above 180', () => {
    const { error } = updateLocationSchema.validate({ lat: 0, lng: 181 });
    expect(error).toBeDefined();
  });

  test('rejects lng below -180', () => {
    const { error } = updateLocationSchema.validate({ lat: 0, lng: -181 });
    expect(error).toBeDefined();
  });

  test('rejects missing lat', () => {
    const { error } = updateLocationSchema.validate({ lng: 0 });
    expect(error).toBeDefined();
  });

  test('rejects missing lng', () => {
    const { error } = updateLocationSchema.validate({ lat: 0 });
    expect(error).toBeDefined();
  });

  test('accepts edge coordinates', () => {
    const { error: e1 } = updateLocationSchema.validate({ lat: 90, lng: 180 });
    expect(e1).toBeUndefined();
    const { error: e2 } = updateLocationSchema.validate({ lat: -90, lng: -180 });
    expect(e2).toBeUndefined();
  });
});
