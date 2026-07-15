import Redis, { RedisOptions } from 'ioredis';

/**
 * SINGLE SOURCE OF TRUTH for the Redis connection.
 *
 * Reads REDIS_HOST / REDIS_PORT at call time (so env is already loaded) with
 * defaults of localhost / 6379. No other file may hardcode Redis config — the
 * `redis-config` demo scenario breaks the app by editing exactly this file.
 */
export function getRedisConfig(): RedisOptions {
  return {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: Number(process.env.REDIS_PORT ?? '6379'),
  };
}

export function createRedisClient(): Redis {
  return new Redis(getRedisConfig());
}
