import { describe, it, expect, beforeEach, vi } from 'vitest';

const { getTrackingMetricsText } = vi.hoisted(() => ({ getTrackingMetricsText: vi.fn() }));
const { isMonitoringAuthorized } = vi.hoisted(() => ({ isMonitoringAuthorized: vi.fn() }));

vi.mock('@/services/promMetricsService', () => ({ promMetricsService: { getTrackingMetricsText } }));
vi.mock('@/lib/metrics/monitoring-auth', () => ({ isMonitoringAuthorized }));
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { logger } from '@/lib/logger';
import * as trackingRoute from '@/app/metrics/tracking/route';
import type { NextRequest } from 'next/server';

const SAMPLE_METRICS = [
  '# HELP business_page_views_24h Page views in the last 24 hours',
  '# TYPE business_page_views_24h gauge',
  'business_page_views_24h 42',
  'business_leads_24h 3',
].join('\n');

function makeRequest(headers: Record<string, string> = {}): NextRequest {
  return { headers: new Headers(headers) } as unknown as NextRequest;
}

describe('GET /metrics/tracking (контракт ЧТЗ §2, TASK-TST-002)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getTrackingMetricsText.mockResolvedValue(SAMPLE_METRICS);
  });

  it('200 + text/plain 0.0.4 + business_*-метрики с корректным ключом (happy path)', async () => {
    isMonitoringAuthorized.mockReturnValue(true);

    const res = await trackingRoute.GET(makeRequest({ 'x-monitoring-key': 'k'.repeat(64) }));

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/^text\/plain; version=0\.0\.4/);
    const body = await res.text();
    expect(body).toContain('business_page_views_24h');
    expect(body).toContain('business_leads_24h');
    expect(getTrackingMetricsText).toHaveBeenCalledTimes(1);
  });

  it('403 без ключа / с неверным ключом (US-002)', async () => {
    isMonitoringAuthorized.mockReturnValue(false);

    const cases: Array<Record<string, string>> = [
      {},
      { 'x-monitoring-key': 'wrong' },
    ];
    for (const headers of cases) {
      const res = await trackingRoute.GET(makeRequest(headers));
      expect(res.status).toBe(403);
    }
    expect(getTrackingMetricsText).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('403'),
      expect.objectContaining({ path: '/metrics/tracking', status: 403 }),
    );
  });

  it('500 + логирование при сбое расчёта метрик (error case)', async () => {
    isMonitoringAuthorized.mockReturnValue(true);
    getTrackingMetricsText.mockRejectedValue(new Error('DB down'));

    const res = await trackingRoute.GET(makeRequest());

    expect(res.status).toBe(500);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('500'),
      expect.objectContaining({
        path: '/metrics/tracking',
        error: 'DB down',
      }),
    );
  });

  it('экспортирован только GET → не-GET методы получают 405 от Next.js (US-002)', () => {
    expect(trackingRoute.GET).toBeTypeOf('function');
    expect((trackingRoute as Record<string, unknown>).POST).toBeUndefined();
    expect((trackingRoute as Record<string, unknown>).PUT).toBeUndefined();
    expect((trackingRoute as Record<string, unknown>).DELETE).toBeUndefined();
  });

  it('логирует request и response (Правило 8)', async () => {
    isMonitoringAuthorized.mockReturnValue(true);
    await trackingRoute.GET(makeRequest());

    expect(logger.info).toHaveBeenCalledWith(
      'API request',
      expect.objectContaining({ method: 'GET', path: '/metrics/tracking' }),
    );
    expect(logger.info).toHaveBeenCalledWith(
      'API response 200',
      expect.objectContaining({ method: 'GET', path: '/metrics/tracking', status: 200 }),
    );
  });
});
