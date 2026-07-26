import { NextResponse } from 'next/server';
import { pingDb } from '@/lib/prisma';
import { pingRedis } from '@/lib/redis';
import { logger } from '@/lib/logger';
import { APP_VERSION } from '@/lib/version';

// GET /api/health — healthcheck для DevOps (docker healthcheck).
// Возвращает статусы зависимостей + версию приложения.

export async function GET() {
  const startTime = Date.now();

  const [dbOk, redisOk] = await Promise.all([pingDb(), pingRedis()]);

  const ok = dbOk; // БД критична; Redis — желателен (фолбэк есть).

  logger.info('API response /api/health', {
    method: 'GET',
    path: '/api/health',
    status: ok ? 200 : 503,
    db: dbOk,
    redis: redisOk,
    version: APP_VERSION,
    duration: Date.now() - startTime,
  });

  return NextResponse.json(
    {
      status: ok ? 'ok' : 'degraded',
      version: APP_VERSION,
      db: dbOk ? 'up' : 'down',
      redis: redisOk ? 'up' : 'down',
      timestamp: new Date().toISOString(),
    },
    { status: ok ? 200 : 503 },
  );
}
