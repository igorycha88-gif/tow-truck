import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { ZodError } from 'zod';
import { orderSchema } from '@/lib/validators/order';
import { ordersService } from '@/services/ordersService';
import { notifyService } from '@/services/notifyService';
import { rateLimit } from '@/lib/rate-limit';
import { getClientIp } from '@/lib/utils';
import { logger } from '@/lib/logger';

// POST /api/orders — создание заявки с сайта.
// Валидация (Zod) → rate-limit (Redis) → ordersService (Prisma) → notifyService (Telegram+email).
// Статусы: 201 / 400 (VALIDATION_ERROR) / 429 (RATE_LIMIT_EXCEEDED) / 500 (INTERNAL_ERROR).
// Логирование request/response обязательно (SKILL_DEVELOPER.md §2).

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  const ip = getClientIp(req);

  logger.info('API request', {
    method: 'POST',
    path: '/api/orders',
    operation: 'orders.POST',
  });

  // 1. Антиспам (rate-limit, 3/час с IP)
  const limited = await rateLimit(`orders:${ip}`);
  if (!limited.ok) {
    logger.warn('API response 429', {
      method: 'POST',
      path: '/api/orders',
      status: 429,
      duration: Date.now() - startTime,
      resetSec: limited.resetSec,
    });
    return NextResponse.json(
      {
        error: 'RATE_LIMIT_EXCEEDED',
        message: 'Слишком много заявок. Попробуйте позже или позвоните нам.',
        resetSec: limited.resetSec,
      },
      { status: 429 },
    );
  }

  try {
    // 2. Парсинг и валидация тела
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', message: 'Некорректный JSON' },
        { status: 400 },
      );
    }

    const data = orderSchema.parse(body);

    // 3. Сохранение в БД
    const order = await ordersService.createOrder({
      ...data,
      ip,
      source: 'website',
    });

    // 4. Уведомление оператору (fire-and-forget, не блокирует ответ)
    void notifyService
      .notifyNewOrder({ ...data, orderId: order.id })
      .then((r) => {
        logger.info('Notify result', {
          operation: 'notifyService.result',
          orderId: order.id,
          delivered: r.delivered,
          channel: r.channel,
        });
      })
      .catch((err) => {
        logger.error('Notify crashed', {
          operation: 'notifyService.crash',
          orderId: order.id,
          error: err instanceof Error ? err.message : String(err),
        });
      });

    logger.info('API response 201', {
      method: 'POST',
      path: '/api/orders',
      status: 201,
      duration: Date.now() - startTime,
      orderId: order.id,
    });

    return NextResponse.json(
      { id: order.id, status: order.status, createdAt: order.createdAt },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof ZodError) {
      logger.warn('API response 400 (validation)', {
        method: 'POST',
        path: '/api/orders',
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
      path: '/api/orders',
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
