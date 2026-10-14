import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { logger } from '@/lib/logger';
import {
  isMonitoringAuthorized,
  __resetMonitoringAuthWarn,
} from '@/lib/metrics/monitoring-auth';
import type { NextRequest } from 'next/server';

function makeRequest(headers: Record<string, string> = {}): NextRequest {
  return { headers: new Headers(headers) } as unknown as NextRequest;
}

const VALID_KEY = 'a'.repeat(64);

describe('isMonitoringAuthorized', () => {
  const originalKey = process.env.MONITORING_KEY;

  beforeEach(() => {
    vi.clearAllMocks();
    __resetMonitoringAuthWarn();
  });

  afterEach(() => {
    if (originalKey === undefined) delete process.env.MONITORING_KEY;
    else process.env.MONITORING_KEY = originalKey;
  });

  it('разрешает запрос с корректным ключом (happy path)', () => {
    process.env.MONITORING_KEY = VALID_KEY;
    expect(isMonitoringAuthorized(makeRequest({ 'x-monitoring-key': VALID_KEY }))).toBe(true);
  });

  it('запрещает запрос без ключа → 403 на уровне route (US-002)', () => {
    process.env.MONITORING_KEY = VALID_KEY;
    expect(isMonitoringAuthorized(makeRequest())).toBe(false);
  });

  it('запрещает запрос с неверным ключом (error case)', () => {
    process.env.MONITORING_KEY = VALID_KEY;
    expect(isMonitoringAuthorized(makeRequest({ 'x-monitoring-key': 'b'.repeat(64) }))).toBe(false);
  });

  it('запрещает ключ другой длины (edge case)', () => {
    process.env.MONITORING_KEY = VALID_KEY;
    expect(isMonitoringAuthorized(makeRequest({ 'x-monitoring-key': 'short' }))).toBe(false);
  });

  it('разрешает без MONITORING_KEY (auth на стороне nginx) и логирует warn один раз (edge case)', () => {
    delete process.env.MONITORING_KEY;

    expect(isMonitoringAuthorized(makeRequest())).toBe(true);
    expect(isMonitoringAuthorized(makeRequest())).toBe(true);
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('MONITORING_KEY'),
      expect.objectContaining({ operation: 'monitoringAuth.isAuthorized' }),
    );
  });

  it('не логирует сам ключ (секреты в логи не попадают)', () => {
    process.env.MONITORING_KEY = VALID_KEY;
    isMonitoringAuthorized(makeRequest({ 'x-monitoring-key': VALID_KEY }));
    const calls = JSON.stringify([
      vi.mocked(logger.info).mock.calls,
      vi.mocked(logger.warn).mock.calls,
      vi.mocked(logger.error).mock.calls,
    ]);
    expect(calls).not.toContain(VALID_KEY);
  });

  // ── Bearer-алиас (ЧТЗ_Внутренняя_Графана_Prometheus, TASK-BCK-001) ────

  it('Bearer с корректным ключом разрешает (внутренний Prometheus, happy path)', () => {
    process.env.MONITORING_KEY = VALID_KEY;
    expect(isMonitoringAuthorized(makeRequest({ authorization: `Bearer ${VALID_KEY}` }))).toBe(true);
  });

  it('Bearer регистронезависим (bearer/BEARER, edge case)', () => {
    process.env.MONITORING_KEY = VALID_KEY;
    expect(isMonitoringAuthorized(makeRequest({ authorization: `bearer ${VALID_KEY}` }))).toBe(true);
    expect(isMonitoringAuthorized(makeRequest({ authorization: `BEARER ${VALID_KEY}` }))).toBe(true);
  });

  it('Bearer с неверным ключом запрещает (error case)', () => {
    process.env.MONITORING_KEY = VALID_KEY;
    expect(isMonitoringAuthorized(makeRequest({ authorization: `Bearer ${'b'.repeat(64)}` }))).toBe(false);
  });

  it('Authorization без префикса Bearer игнорируется — проверяется X-Monitoring-Key (edge case)', () => {
    process.env.MONITORING_KEY = VALID_KEY;
    expect(isMonitoringAuthorized(makeRequest({ authorization: `Basic ${VALID_KEY}` }))).toBe(false);
    // Но с X-Monitoring-Key одновременно — работает как раньше.
    expect(
      isMonitoringAuthorized(
        makeRequest({ authorization: `Basic ${VALID_KEY}`, 'x-monitoring-key': VALID_KEY }),
      ),
    ).toBe(true);
  });
});
