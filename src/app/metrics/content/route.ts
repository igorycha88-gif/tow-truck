import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { isMonitoringAuthorized } from '@/lib/metrics/monitoring-auth';
import { getHttpMetricsText } from '@/lib/metrics/http-metrics';
import { logger } from '@/lib/logger';

// GET /metrics/content — метрики приложения content_* (ЧТЗ §4.2, TASK-BCK-002):
//   content_http_requests_total{method,route,code}
//   content_http_request_duration_seconds{method,route}
// Auth: nginx (основная граница) + X-Monitoring-Key (defense in depth, US-002).
// Формат: Prometheus text exposition 0.0.4.
// Сами запросы к /metrics/* в эти метрики не попадают (http-metrics.ts).

const PROMETHEUS_CONTENT_TYPE = 'text/plain; version=0.0.4; charset=utf-8';

export async function GET(req: NextRequest) {
  const startTime = Date.now();

  logger.info('API request', {
    method: 'GET',
    path: '/metrics/content',
    operation: 'metricsContent.GET',
  });

  if (!isMonitoringAuthorized(req)) {
    logger.warn('API response 403', {
      method: 'GET',
      path: '/metrics/content',
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
    const body = await getHttpMetricsText();

    logger.info('API response 200', {
      method: 'GET',
      path: '/metrics/content',
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
      path: '/metrics/content',
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
