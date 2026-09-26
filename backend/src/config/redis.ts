import Redis, { RedisOptions } from 'ioredis';
import { config } from './env';

export const redisOptions: RedisOptions = {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  retryStrategy(times) {
    const delay = Math.min(times * 100, 3000);
    return delay;
  },
};

export const redisClient = new Redis(config.redisUrl, redisOptions);

redisClient.on('connect', () => {
  console.log('[Redis] Connected successfully');
});

redisClient.on('error', (err) => {
  console.warn('[Redis] Connection warning/error:', err.message);
});

export function createRedisInstance(): Redis {
  return new Redis(config.redisUrl, redisOptions);
}
