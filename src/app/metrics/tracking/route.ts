import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { isMonitoringAuthorized } from '@/lib/metrics/monitoring-auth';
import { promMetricsService } from '@/services/promMetricsService';
import { logger } from '@/lib/logger';

// GET /metrics/tracking — business_*-метрики для централизованного мониторинга
// (ЧТЗ «Централизованный мониторинг», US-001/US-005, TASK-BCK-001).
// Auth: nginx (основная граница) + X-Monitoring-Key (defense in depth, US-002).
// Формат: Prometheus text exposition 0.0.4. Пересчёт гейджей — раз в 60 с.
// Экспортирован только GET: прочие методы Next.js автоматически отвечает 405.

const PROMETHEUS_CONTENT_TYPE = 'text/plain; version=0.0.4; charset=utf-8';

export async function GET(req: NextRequest) {
  const startTime = Date.now();

  logger.info('API request', {
    method: 'GET',
    path: '/metrics/tracking',
    operation: 'metricsTracking.GET',
  });

  if (!isMonitoringAuthorized(req)) {
    logger.warn('API response 403', {
      method: 'GET',
      path: '/metrics/tracking',
      status: 403,
      duration: Date.now() - startTime,
      reason: 'invalid or missing X-Monitoring-Key',
    });
    return new NextResponse('Forbidden\n', {
      status: 403,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  try {
    const body = await promMetricsService.getTrackingMetricsText();

    logger.info('API response 200', {
      method: 'GET',
      path: '/metrics/tracking',
      status: 200,
      duration: Date.now() - startTime,
      bytes: body.length,
    });

    return new NextResponse(body, {
      status: 200,
      headers: { 'Content-Type': PROMETHEUS_CONTENT_TYPE },
    });
  } catch (err) {
    logger.error('API response 500', {
      method: 'GET',
      path: '/metrics/tracking',
      status: 500,
      duration: Date.now() - startTime,
      error: err instanceof Error ? err.message : String(err),
    });
    return new NextResponse('Internal Server Error\n', {
      status: 500,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}
