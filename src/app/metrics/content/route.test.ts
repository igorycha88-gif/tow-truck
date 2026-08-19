import { describe, it, expect, beforeEach, vi } from 'vitest';

const { isMonitoringAuthorized } = vi.hoisted(() => ({ isMonitoringAuthorized: vi.fn() }));

vi.mock('@/lib/metrics/monitoring-auth', () => ({ isMonitoringAuthorized }));
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { logger } from '@/lib/logger';
import * as contentRoute from '@/app/metrics/content/route';
import { recordRequest } from '@/lib/metrics/http-metrics';
import type { NextRequest } from 'next/server';

function makeRequest(headers: Record<string, string> = {}): NextRequest {
  return { headers: new Headers(headers) } as unknown as NextRequest;
}

describe('GET /metrics/content (контракт ЧТЗ §2/§4.2, TASK-TST-002)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('200 + text/plain 0.0.4 + content_http_requests_total (happy path)', async () => {
    isMonitoringAuthorized.mockReturnValue(true);
    // Сеем данные: один запрос к приложению (счётчик с лейблами появляется
    // только после первого наблюдения).
    recordRequest('GET', '/api/health', 200, 0.01);

    const res = await contentRoute.GET(makeRequest({ 'x-monitoring-key': 'k'.repeat(64) }));

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/^text\/plain; version=0\.0\.4/);
    const body = await res.text();
    expect(body).toContain('content_http_requests_total');
    expect(body).toContain('content_http_request_duration_seconds_bucket');
    expect(body).toContain('route="/api/health"');
  });

  it('403 без ключа (US-002)', async () => {
    isMonitoringAuthorized.mockReturnValue(false);

    const res = await contentRoute.GET(makeRequest());

    expect(res.status).toBe(403);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('403'),
      expect.objectContaining({ path: '/metrics/content', status: 403 }),
    );
  });

  it('экспортирован только GET → не-GET методы получают 405 от Next.js', () => {
    expect(contentRoute.GET).toBeTypeOf('function');
    expect((contentRoute as Record<string, unknown>).POST).toBeUndefined();
  });

  it('логирует request и response (Правило 8)', async () => {
    isMonitoringAuthorized.mockReturnValue(true);
    await contentRoute.GET(makeRequest());

    expect(logger.info).toHaveBeenCalledWith(
      'API request',
      expect.objectContaining({ method: 'GET', path: '/metrics/content' }),
    );
    expect(logger.info).toHaveBeenCalledWith(
      'API response 200',
      expect.objectContaining({ method: 'GET', path: '/metrics/content', status: 200 }),
    );
  });
});
