import Redis, { RedisOptions } from 'ioredis';

/**
 * Redis connection settings.
 */
export function getRedisConfig(): RedisOptions {
  return {
    host: 'localhost',
    port: 6399,
  };
}

export function createRedisClient(): Redis {
  return new Redis(getRedisConfig());
}
