import Joi from 'joi';

/**
 * Schema for user registration.
 */
export const registerSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Please provide a valid email address',
    'any.required': 'Email is required',
  }),
  phone: Joi.string()
    .pattern(/^\+?[1-9]\d{1,14}$/)
    .required()
    .messages({
      'string.pattern.base':
        'Phone number must be in E.164 format (e.g. +1234567890)',
      'any.required': 'Phone number is required',
    }),
  password: Joi.string().min(8).required().messages({
    'string.min': 'Password must be at least 8 characters long',
    'any.required': 'Password is required',
  }),
  firstName: Joi.string().trim().min(1).max(100).required().messages({
    'any.required': 'First name is required',
  }),
  lastName: Joi.string().trim().min(1).max(100).required().messages({
    'any.required': 'Last name is required',
  }),
  role: Joi.string()
    .valid('passenger', 'driver', 'both')
    .required()
    .messages({
      'any.only': 'Role must be one of: passenger, driver, both',
      'any.required': 'Role is required',
    }),
});

/**
 * Schema for user login.
 */
export const loginSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Please provide a valid email address',
    'any.required': 'Email is required',
  }),
  password: Joi.string().required().messages({
    'any.required': 'Password is required',
  }),
});

/**
 * Schema for ride requests.
 */
export const rideRequestSchema = Joi.object({
  pickupLat: Joi.number().min(-90).max(90).required().messages({
    'number.min': 'Pickup latitude must be between -90 and 90',
    'number.max': 'Pickup latitude must be between -90 and 90',
    'any.required': 'Pickup latitude is required',
  }),
  pickupLng: Joi.number().min(-180).max(180).required().messages({
    'number.min': 'Pickup longitude must be between -180 and 180',
    'number.max': 'Pickup longitude must be between -180 and 180',
    'any.required': 'Pickup longitude is required',
  }),
  pickupAddress: Joi.string().trim().min(1).max(500).required().messages({
    'any.required': 'Pickup address is required',
  }),
  dropoffLat: Joi.number().min(-90).max(90).required().messages({
    'number.min': 'Dropoff latitude must be between -90 and 90',
    'number.max': 'Dropoff latitude must be between -90 and 90',
    'any.required': 'Dropoff latitude is required',
  }),
  dropoffLng: Joi.number().min(-180).max(180).required().messages({
    'number.min': 'Dropoff longitude must be between -180 and 180',
    'number.max': 'Dropoff longitude must be between -180 and 180',
    'any.required': 'Dropoff longitude is required',
  }),
  dropoffAddress: Joi.string().trim().min(1).max(500).required().messages({
    'any.required': 'Dropoff address is required',
  }),
  vehicleType: Joi.string()
    .valid('economy', 'comfort', 'xl', 'accessible')
    .default('economy')
    .messages({
      'any.only':
        'Vehicle type must be one of: economy, comfort, xl, accessible',
    }),
});

/**
 * Schema for ride ratings.
 */
export const ratingSchema = Joi.object({
  rideId: Joi.string().uuid().required().messages({
    'string.guid': 'Ride ID must be a valid UUID',
    'any.required': 'Ride ID is required',
  }),
  score: Joi.number().integer().min(1).max(5).required().messages({
    'number.min': 'Score must be between 1 and 5',
    'number.max': 'Score must be between 1 and 5',
    'any.required': 'Score is required',
  }),
  comment: Joi.string().trim().max(1000).optional().allow('').messages({
    'string.max': 'Comment must not exceed 1000 characters',
  }),
});

/**
 * Schema for governance proposals.
 */
export const proposalSchema = Joi.object({
  title: Joi.string().trim().min(5).max(200).required().messages({
    'string.min': 'Title must be at least 5 characters',
    'string.max': 'Title must not exceed 200 characters',
    'any.required': 'Title is required',
  }),
  description: Joi.string().trim().min(20).max(5000).required().messages({
    'string.min': 'Description must be at least 20 characters',
    'string.max': 'Description must not exceed 5000 characters',
    'any.required': 'Description is required',
  }),
  category: Joi.string()
    .valid('policy', 'feature', 'fee_structure', 'safety', 'community', 'other')
    .required()
    .messages({
      'any.only':
        'Category must be one of: policy, feature, fee_structure, safety, community, other',
      'any.required': 'Category is required',
    }),
});

/**
 * Schema for voting on governance proposals.
 */
export const voteSchema = Joi.object({
  proposalId: Joi.string().uuid().required().messages({
    'string.guid': 'Proposal ID must be a valid UUID',
    'any.required': 'Proposal ID is required',
  }),
  vote: Joi.string().valid('for', 'against', 'abstain').required().messages({
    'any.only': 'Vote must be one of: for, against, abstain',
    'any.required': 'Vote is required',
  }),
});

/**
 * Schema for driver profile / vehicle registration.
 */
export const driverProfileSchema = Joi.object({
  licenseNumber: Joi.string().trim().min(1).max(50).required().messages({
    'any.required': 'License number is required',
  }),
  licenseExpiry: Joi.date().iso().greater('now').required().messages({
    'date.greater': 'License expiry must be a future date',
    'any.required': 'License expiry date is required',
  }),
  vehicleMake: Joi.string().trim().min(1).max(100).required().messages({
    'any.required': 'Vehicle make is required',
  }),
  vehicleModel: Joi.string().trim().min(1).max(100).required().messages({
    'any.required': 'Vehicle model is required',
  }),
  vehicleYear: Joi.number()
    .integer()
    .min(2000)
    .max(new Date().getFullYear() + 1)
    .required()
    .messages({
      'number.min': 'Vehicle year must be 2000 or later',
      'number.max': 'Vehicle year cannot be in the future',
      'any.required': 'Vehicle year is required',
    }),
  vehicleColor: Joi.string().trim().min(1).max(50).required().messages({
    'any.required': 'Vehicle color is required',
  }),
  vehiclePlate: Joi.string().trim().min(1).max(20).required().messages({
    'any.required': 'Vehicle plate number is required',
  }),
  vehicleType: Joi.string()
    .valid('economy', 'comfort', 'xl', 'accessible')
    .required()
    .messages({
      'any.only':
        'Vehicle type must be one of: economy, comfort, xl, accessible',
      'any.required': 'Vehicle type is required',
    }),
});

/**
 * Schema for creating a dispute.
 */
export const createDisputeSchema = Joi.object({
  rideId: Joi.string().uuid().required().messages({
    'string.guid': 'Ride ID must be a valid UUID',
    'any.required': 'Ride ID is required',
  }),
  defendantId: Joi.string().uuid().required().messages({
    'string.guid': 'Defendant ID must be a valid UUID',
    'any.required': 'Defendant ID is required',
  }),
  disputeType: Joi.string()
    .valid('fare_dispute', 'safety_concern', 'service_quality', 'property_damage', 'route_deviation', 'deactivation_appeal', 'other')
    .required()
    .messages({
      'any.only': 'Dispute type must be one of: fare_dispute, safety_concern, service_quality, property_damage, route_deviation, deactivation_appeal, other',
      'any.required': 'Dispute type is required',
    }),
  title: Joi.string().trim().min(5).max(200).required().messages({
    'string.min': 'Title must be at least 5 characters',
    'string.max': 'Title must not exceed 200 characters',
    'any.required': 'Title is required',
  }),
  description: Joi.string().trim().min(20).max(5000).required().messages({
    'string.min': 'Description must be at least 20 characters',
    'string.max': 'Description must not exceed 5000 characters',
    'any.required': 'Description is required',
  }),
});

/**
 * Schema for adding dispute evidence.
 */
export const disputeEvidenceSchema = Joi.object({
  evidenceType: Joi.string()
    .valid('text', 'image', 'screenshot', 'video', 'gps_log', 'receipt', 'other')
    .required()
    .messages({
      'any.only': 'Evidence type must be one of: text, image, screenshot, video, gps_log, receipt, other',
      'any.required': 'Evidence type is required',
    }),
  content: Joi.string().trim().min(1).max(5000).required().messages({
    'string.min': 'Content is required',
    'string.max': 'Content must not exceed 5000 characters',
    'any.required': 'Content is required',
  }),
  fileUrl: Joi.string().uri().max(2048).optional().allow(null, '').messages({
    'string.uri': 'File URL must be a valid URL',
    'string.max': 'File URL must not exceed 2048 characters',
  }),
});

/**
 * Schema for submitting a dispute review.
 */
export const disputeReviewSchema = Joi.object({
  vote: Joi.string()
    .valid('uphold', 'dismiss', 'partial')
    .required()
    .messages({
      'any.only': 'Vote must be one of: uphold, dismiss, partial',
      'any.required': 'Vote is required',
    }),
  reasoning: Joi.string().trim().min(20).max(5000).required().messages({
    'string.min': 'Reasoning must be at least 20 characters',
    'string.max': 'Reasoning must not exceed 5000 characters',
    'any.required': 'Reasoning is required',
  }),
});

/**
 * Schema for appealing a dispute.
 */
export const disputeAppealSchema = Joi.object({
  reason: Joi.string().trim().min(20).max(5000).required().messages({
    'string.min': 'Appeal reason must be at least 20 characters',
    'string.max': 'Appeal reason must not exceed 5000 characters',
    'any.required': 'Appeal reason is required',
  }),
});

/**
 * Schema for driver location updates.
 */
export const updateLocationSchema = Joi.object({
  lat: Joi.number().min(-90).max(90).required().messages({
    'number.min': 'Latitude must be between -90 and 90',
    'number.max': 'Latitude must be between -90 and 90',
    'any.required': 'Latitude is required',
  }),
  lng: Joi.number().min(-180).max(180).required().messages({
    'number.min': 'Longitude must be between -180 and 180',
    'number.max': 'Longitude must be between -180 and 180',
    'any.required': 'Longitude is required',
  }),
});
