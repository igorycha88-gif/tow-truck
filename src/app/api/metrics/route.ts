import { NextResponse } from 'next/server';
import { metricsService } from '@/services/metricsService';
import { logger } from '@/lib/logger';

// GET /api/metrics — агрегированные бизнес-метрики (см. ADR-001).
// Опционален: Grafana запрашивает данные напрямую из PostgreSQL через datasource.
// Этот endpoint полезен для внешних интеграций/кэша. Доступ с базовой аутентификацией
// на уровне Nginx в prod (см. deploy/nginx) — данные не публичные.

export async function GET() {
  const startTime = Date.now();

  logger.info('API request', {
    method: 'GET',
    path: '/api/metrics',
    operation: 'metrics.GET',
  });

  try {
    const metrics = await metricsService.getMetrics();

    logger.info('API response 200', {
      method: 'GET',
      path: '/api/metrics',
      status: 200,
      duration: Date.now() - startTime,
    });

    return NextResponse.json(metrics);
  } catch (err) {
    logger.error('API response 500', {
      method: 'GET',
      path: '/api/metrics',
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