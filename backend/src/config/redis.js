import Redis from 'ioredis';
import env from './env.js';

const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    const delay = Math.min(times * 200, 5000);
    console.log(
      `[redis] Reconnection attempt ${times}, retrying in ${delay}ms`
    );
    return delay;
  },
  lazyConnect: false,
});

redis.on('connect', () => {
  console.log('[redis] Connected to Redis');
});

redis.on('ready', () => {
  console.log('[redis] Redis client ready');
});

redis.on('error', (err) => {
  console.error('[redis] Redis error:', err.message);
});

redis.on('close', () => {
  console.log('[redis] Redis connection closed');
});

export default redis;
