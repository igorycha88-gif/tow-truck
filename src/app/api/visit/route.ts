import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { ZodError } from 'zod';
import { visitSchema, isVisitLeave } from '@/lib/validators/visit';
import { metricsService } from '@/services/metricsService';
import { rateLimit } from '@/lib/rate-limit';
import { getClientIp, maskIp } from '@/lib/utils';
import { lookupCity } from '@/lib/geo';
import { logger } from '@/lib/logger';

// POST /api/visit — трекинг пути клиента v2 (см. ADR-002, ADR-014).
// enter: полный pageview (page, from, sessionId/visitorId/viewId, входной
// referrer+UTM); leave: обновление dwellMs по viewId (идемпотентно).
// Старый payload {page, referrer?} валиден как enter без новых полей.
// Гео по IP — GeoLite2 (ЧТЗ §2.3). Валидация (Zod) → rate-limit (Redis) →
// metricsService (Prisma). Статусы: 201 / 400 / 429 / 500.
// Fire-and-forget: клиент не ждёт ответа (см. VisitTracker).

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  const ip = getClientIp(req);

  logger.info('API request', {
    method: 'POST',
    path: '/api/visit',
    operation: 'visit.POST',
  });

  // Антиспам: v2 шлёт enter+leave на каждую навигацию — лимит удвоен (ADR-014).
  const limited = await rateLimit(`visit:${ip}`, {
    max: Number(process.env.RATE_LIMIT_VISIT_PER_HOUR || 240),
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

    // leave: обновление времени на странице, строки может не быть (гонка) — 200.
    if (isVisitLeave(data)) {
      await metricsService.applyLeave({ viewId: data.viewId, dwellMs: data.dwellMs });
      logger.info('API response 200', {
        method: 'POST',
        path: '/api/visit',
        status: 200,
        duration: Date.now() - startTime,
        type: 'leave',
      });
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    const visit = await metricsService.createVisit({
      page: data.page,
      from: data.from,
      referrer: data.referrer,
      sessionId: data.sessionId,
      visitorId: data.visitorId,
      viewId: data.viewId,
      utmSource: data.utmSource,
      utmMedium: data.utmMedium,
      utmCampaign: data.utmCampaign,
      // 152-ФЗ: в БД — только маскированный IP (полный — лишь для rate-limit/гео).
      ip: maskIp(ip),
      userAgent: req.headers.get('user-agent'),
      city: lookupCity(ip),
    });

    logger.info('API response 201', {
      method: 'POST',
      path: '/api/visit',
      status: 201,
      duration: Date.now() - startTime,
      type: 'enter',
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
