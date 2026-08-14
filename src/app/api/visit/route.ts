import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { ZodError } from 'zod';
import { visitSchema } from '@/lib/validators/visit';
import { metricsService } from '@/services/metricsService';
import { rateLimit } from '@/lib/rate-limit';
import { getClientIp } from '@/lib/utils';
import { logger } from '@/lib/logger';

// POST /api/visit — трекинг визита на страницу (см. ADR-002).
// Валидация (Zod) → rate-limit (Redis) → metricsService (Prisma).
// Статусы: 201 / 400 (VALIDATION_ERROR) / 429 (RATE_LIMIT_EXCEEDED) / 500 (INTERNAL_ERROR).
// Fire-and-forget: клиент не ждёт ответа (смотрите VisitTracker).

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  const ip = getClientIp(req);

  logger.info('API request', {
    method: 'POST',
    path: '/api/visit',
    operation: 'visit.POST',
  });

  // Антиспам: визиты частые по природе — мягкий лимит (см. .env.example).
  const limited = await rateLimit(`visit:${ip}`, {
    max: Number(process.env.RATE_LIMIT_VISIT_PER_HOUR || 120),
    windowSec: 3600,
  });
  if (!limited.ok) {
    logger.warn('API response 429', {
      method: 'POST',
      path: '/api/visit',
      status: 429,
      duration: Date.now() - startTime,
      resetSec: limited.resetSec,
    });
    return NextResponse.json(
      { error: 'RATE_LIMIT_EXCEEDED' },
      { status: 429 },
    );
  }

  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', message: 'Некорректный JSON' },
        { status: 400 },
      );
    }

    const data = visitSchema.parse(body);

    const visit = await metricsService.createVisit({
      page: data.page,
      ip,
      userAgent: req.headers.get('user-agent'),
    });

    logger.info('API response 201', {
      method: 'POST',
      path: '/api/visit',
      status: 201,
      duration: Date.now() - startTime,
      visitId: visit.id,
    });

    return NextResponse.json({ id: visit.id, createdAt: visit.createdAt }, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) {
      logger.warn('API response 400 (validation)', {
        method: 'POST',
        path: '/api/visit',
        status: 400,
        duration: Date.now() - startTime,
        issues: err.issues.map((i) => ({ path: i.path, msg: i.message })),
      });
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', details: err.issues },
        { status: 400 },
      );
    }

    logger.error('API response 500', {
      method: 'POST',
      path: '/api/visit',
      status: 500,
      duration: Date.now() - startTime,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Внутренняя ошибка сервера' },
      { status: 500 },
    );
  }
}
