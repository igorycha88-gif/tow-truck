import { describe, it, expect, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { register } from '@/instrumentation';
import { __resetHttpMetricsForTests } from '@/lib/metrics/http-metrics';

describe('instrumentation.register', () => {
  const originalRuntime = process.env.NEXT_RUNTIME;

  beforeEach(() => {
    __resetHttpMetricsForTests();
  });

  afterEach(() => {
    if (originalRuntime === undefined) delete process.env.NEXT_RUNTIME;
    else process.env.NEXT_RUNTIME = originalRuntime;
  });

  it('в nodejs-рантайме включает сбор content_*-метрик', async () => {
    process.env.NEXT_RUNTIME = 'nodejs';
    await register();
    expect((globalThis as { __httpMetricsPatched?: boolean }).__httpMetricsPatched).toBe(true);
  });

  it('в edge-рантайме метрики не включаются', async () => {
    process.env.NEXT_RUNTIME = 'edge';
    await register();
    expect((globalThis as { __httpMetricsPatched?: boolean }).__httpMetricsPatched).toBeFalsy();
  });
});
