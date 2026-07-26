import Redis from 'ioredis';
import { logger } from '@/lib/logger';

// Singleton Redis-клиента (см. ARCHITECTURE.md, SKILL_DEVELOPER.md).
// При отсутствии REDIS_URL — клиент не создаётся (graceful degradation).

let client: Redis | null = null;
let connectionFailed = false;

declare global {
  // eslint-disable-next-line no-var
  var __redisClient: Redis | undefined;
}

export function getRedis(): Redis | null {
  if (connectionFailed) return null;
  if (global.__redisClient) {
    client = global.__redisClient;
    return client;
  }

  const url = process.env.REDIS_URL;
  if (!url) {
    logger.warn('Redis URL not configured, rate-limit disabled', {
      operation: 'redis.init',
    });
    connectionFailed = true;
    return null;
  }

  try {
    client = new Redis(url, {
      maxRetriesPerRequest: 2,
      enableReadyCheck: true,
      lazyConnect: false,
    });

    client.on('error', (err) => {
      logger.error('Redis error', {
        operation: 'redis.error',
        error: err.message,
      });
    });

    client.on('connect', () => {
      logger.info('Redis connected', { operation: 'redis.connect' });
    });

    global.__redisClient = client;
    return client;
  } catch (err) {
    logger.error('Redis init failed', {
      operation: 'redis.init',
      error: err instanceof Error ? err.message : String(err),
    });
    connectionFailed = true;
    return null;
  }
}

export async function pingRedis(): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return false;
  try {
    const pong = await redis.ping();
    return pong === 'PONG';
  } catch (err) {
    logger.error('Redis ping failed', {
      operation: 'redis.ping',
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

export async function closeRedis(): Promise<void> {
  if (client) {
    await client.quit();
    client = null;
    global.__redisClient = undefined;
  }
}
