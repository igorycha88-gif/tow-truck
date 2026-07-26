import { getRedis } from '@/lib/redis';
import { logger } from '@/lib/logger';

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  resetSec: number;
};

// Rate-limit на публичный API (антиспам формы заявок).
// По умолчанию: 3 запроса/час с IP (см. .env.example RATE_LIMIT_ORDERS_PER_HOUR).
// Graceful degradation: если Redis недоступен — пропускаем запрос (fallback ok),
// чтобы не блокировать лиды из-за сбоя инфраструктуры.

const HOUR_SEC = 3600;

export async function rateLimit(
  key: string,
  opts: { max?: number; windowSec?: number } = {},
): Promise<RateLimitResult> {
  const max = opts.max ?? Number(process.env.RATE_LIMIT_ORDERS_PER_HOUR || 3);
  const windowSec = opts.windowSec ?? HOUR_SEC;

  const redis = getRedis();
  if (!redis) {
    // Fallback: Redis недоступен — пропускаем, логируем.
    logger.warn('Rate-limit skipped: Redis unavailable', {
      operation: 'rateLimit.fallback',
      key,
    });
    return { ok: true, remaining: max, resetSec: windowSec };
  }

  try {
    const redisKey = `ratelimit:${key}`;
    const current = await redis.incr(redisKey);

    if (current === 1) {
      await redis.expire(redisKey, windowSec);
    }

    const ttl = await redis.ttl(redisKey);

    if (current > max) {
      logger.warn('Rate limit exceeded', {
        operation: 'rateLimit.exceeded',
        key,
        current,
        max,
      });
      return { ok: false, remaining: 0, resetSec: ttl > 0 ? ttl : windowSec };
    }

    return { ok: true, remaining: Math.max(0, max - current), resetSec: ttl > 0 ? ttl : windowSec };
  } catch (err) {
    // Fallback при ошибке Redis — пропускаем, не теряем лиды.
    logger.error('Rate-limit error, falling back to allow', {
      operation: 'rateLimit.error',
      key,
      error: err instanceof Error ? err.message : String(err),
    });
    return { ok: true, remaining: max, resetSec: windowSec };
  }
}
