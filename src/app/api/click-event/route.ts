import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { ZodError } from 'zod';
import { clickEventSchema } from '@/lib/validators/click-event';
import { metricsService } from '@/services/metricsService';
import { rateLimit } from '@/lib/rate-limit';
import { getClientIp } from '@/lib/utils';
import { logger } from '@/lib/logger';

// POST /api/click-event — логирование клика по номеру телефона.
// Валидация (Zod) → rate-limit (Redis) → metricsService (Prisma).
// Статусы: 201 / 400 (VALIDATION_ERROR) / 429 (RATE_LIMIT_EXCEEDED) / 500 (INTERNAL_ERROR).
// Не влияет на UX: клиент не ждёт ответа, это fire-and-forget (смотрите PhoneClickTracker).

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  const ip = getClientIp(req);

  logger.info('API request', {
    method: 'POST',
    path: '/api/click-event',
    operation: 'click-event.POST',
  });

  // Антиспам: смягчённый лимит (клики не создают нагрузку на операторов).
  const limited = await rateLimit(`click-event:${ip}`, {
    max: Number(process.env.RATE_LIMIT_CLICK_EVENT_PER_HOUR || 60),
    windowSec: 3600,
  });
  if (!limited.ok) {
    logger.warn('API response 429', {
      method: 'POST',
      path: '/api/click-event',
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

    const data = clickEventSchema.parse(body);

    const event = await metricsService.createClickEvent({
      page: data.page,
      ip,
      userAgent: req.headers.get('user-agent'),
    });

    logger.info('API response 201', {
      method: 'POST',
      path: '/api/click-event',
      status: 201,
      duration: Date.now() - startTime,
      eventId: event.id,
    });

    return NextResponse.json({ id: event.id, createdAt: event.createdAt }, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) {
      logger.warn('API response 400 (validation)', {
        method: 'POST',
        path: '/api/click-event',
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
      path: '/api/click-event',
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