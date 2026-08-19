import { describe, it, expect, beforeEach, vi } from 'vitest';
import http from 'node:http';

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
  getHttpRegistry,
  initHttpMetrics,
  recordRequest,
  __resetHttpMetricsForTests,
} from '@/lib/metrics/http-metrics';

describe('http-metrics (content_*)', () => {
  beforeEach(() => {
    __resetHttpMetricsForTests();
  });

  it('recordRequest инкрементирует counter и histogram по шаблону роута (happy path)', async () => {
    recordRequest('GET', '/uslugi/evakuaciya-motocikla', 200, 0.05);

    const text = await getHttpRegistry().metrics();
    expect(text).toContain('content_http_requests_total');
    expect(text).toContain('content_http_request_duration_seconds_bucket');
    expect(text).toContain('route="/uslugi/[slug]"');
    expect(text).toContain('code="200"');
  });

  it('пути /metrics/* не попадают в метрики приложения (ЧТЗ §4.2)', async () => {
    recordRequest('GET', '/metrics/tracking', 200, 0.01);

    const text = await getHttpRegistry().metrics();
    expect(text).not.toContain('route="/metrics/tracking"');
  });

  it('initHttpMetrics патчит http.Server и считает реальные запросы (интеграция)', async () => {
    initHttpMetrics();
    // Повторный вызов не дублирует патч (идемпотентность).
    initHttpMetrics();

    const server = http.createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('ok');
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = (server.address() as { port: number }).port;

    await fetch(`http://127.0.0.1:${port}/uslugi/test-slug`);
    await fetch(`http://127.0.0.1:${port}/metrics/node`);
    // Даём событию 'finish' отработать до чтения реестра.
    await new Promise((resolve) => setTimeout(resolve, 100));

    const text = await getHttpRegistry().metrics();
    expect(text).toContain('route="/uslugi/[slug]"');
    expect(text).not.toContain('route="/metrics/node"');

    server.close();
  });

  it('реестр живёт на globalThis: разные экземпляры модуля делят одни счётчики', () => {
    // Эмулируем «другой чанк»: чистый вызов getHttpRegistry возвращает тот же объект.
    const a = getHttpRegistry();
    const b = getHttpRegistry();
    expect(a).toBe(b);
    expect((globalThis as { __evakuaciyaHttpMetrics?: unknown }).__evakuaciyaHttpMetrics).toBeDefined();
  });
});
