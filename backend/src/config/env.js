import dotenv from 'dotenv';

dotenv.config();

const env = {
  // Application
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT, 10) || 3000,

  // Database
  DATABASE_URL:
    process.env.DATABASE_URL ||
    'postgres://openride:openride@localhost:5432/openride',

  // Redis
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',

  // JWT
  JWT_SECRET: process.env.JWT_SECRET || 'change-me-in-production',
  JWT_REFRESH_SECRET:
    process.env.JWT_REFRESH_SECRET || 'change-me-refresh-in-production',
  JWT_EXPIRY: process.env.JWT_EXPIRY || '15m',
  JWT_REFRESH_EXPIRY: process.env.JWT_REFRESH_EXPIRY || '7d',

  // Stripe
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || '',
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || '',

  // Twilio
  TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID || '',
  TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN || '',
  TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER || '',

  // S3 / Object Storage
  S3_BUCKET: process.env.S3_BUCKET || '',
  S3_ACCESS_KEY: process.env.S3_ACCESS_KEY || '',
  S3_SECRET_KEY: process.env.S3_SECRET_KEY || '',
  S3_ENDPOINT: process.env.S3_ENDPOINT || '',
  S3_REGION: process.env.S3_REGION || 'us-east-1',

  // External services
  SENTRY_DSN: process.env.SENTRY_DSN || '',
  OSRM_URL: process.env.OSRM_URL || 'http://localhost:5001',
  GEOCODING_URL: process.env.GEOCODING_URL || 'http://localhost:4000',

  // Fare configuration
  PLATFORM_FEE_PERCENT: parseFloat(process.env.PLATFORM_FEE_PERCENT) || 7,
  BASE_FARE: parseFloat(process.env.BASE_FARE) || 2.5,
  PER_KM_RATE: parseFloat(process.env.PER_KM_RATE) || 1.2,
  PER_MINUTE_RATE: parseFloat(process.env.PER_MINUTE_RATE) || 0.2,
  MINIMUM_FARE: parseFloat(process.env.MINIMUM_FARE) || 5.0,
  SURGE_CAP: parseFloat(process.env.SURGE_CAP) || 1.5,
};

// Warn about insecure defaults in production
if (env.NODE_ENV === 'production') {
  const warnings = [];
  if (env.JWT_SECRET === 'change-me-in-production') {
    warnings.push('JWT_SECRET is using the default value');
  }
  if (env.JWT_REFRESH_SECRET === 'change-me-refresh-in-production') {
    warnings.push('JWT_REFRESH_SECRET is using the default value');
  }
  if (!env.STRIPE_SECRET_KEY) {
    warnings.push('STRIPE_SECRET_KEY is not set');
  }
  if (warnings.length > 0) {
    console.warn(
      '[env] PRODUCTION WARNINGS:\n' + warnings.map((w) => `  - ${w}`).join('\n')
    );
  }
}

export default env;
