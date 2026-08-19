import http from 'node:http';
import client from 'prom-client';
import { logger } from '@/lib/logger';
import { normalizeRoute } from '@/lib/metrics/route-template';

// content_*-метрики приложения (ЧТЗ §4.2, TASK-BCK-002):
//   content_http_requests_total{method,route,code}         — counter
//   content_http_request_duration_seconds{method,route}    — histogram
//
// Сбор — патч http.Server через instrumentation.ts: middleware Next.js
// работает в edge-рантайме и не видит статуса ответа. Сами пути /metrics/*
// в метрики приложения НЕ включаются (требование ЧТЗ §4.2).
//
// ВАЖНО: instrumentation-чанк и route-чанки Next.js бандлятся отдельно и
// получают РАЗНЫЕ экземпляры этого модуля. Поэтому реестр живёт на
// globalThis (тот же паттерн, что у prisma-клиента) — иначе счётчики
// instrumentation не попадали бы в ответ /metrics/content.

type HttpMetricsRuntime = {
  registry: client.Registry;
  requestsTotal: client.Counter;
  requestDuration: client.Histogram;
};

function getRuntime(): HttpMetricsRuntime {
  const g = globalThis as { __evakuaciyaHttpMetrics?: HttpMetricsRuntime };
  if (!g.__evakuaciyaHttpMetrics) {
    const registry = new client.Registry();
    g.__evakuaciyaHttpMetrics = {
      registry,
      requestsTotal: new client.Counter({
        name: 'content_http_requests_total',
        help: 'HTTP requests to the application, by method/route/status',
        labelNames: ['method', 'route', 'code'],
        registers: [registry],
      }),
      requestDuration: new client.Histogram({
        name: 'content_http_request_duration_seconds',
        help: 'HTTP request duration in seconds, by method/route',
        labelNames: ['method', 'route'],
        buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
        registers: [registry],
      }),
    };
  }
  return g.__evakuaciyaHttpMetrics;
}

export function getHttpRegistry(): client.Registry {
  return getRuntime().registry;
}

export async function getHttpMetricsText(): Promise<string> {
  return getRuntime().registry.metrics();
}

export function recordRequest(
  method: string,
  rawPath: string,
  code: number,
  durationSeconds: number,
): void {
  // Сами пути /metrics/* в метрики приложения не включаем (ЧТЗ §4.2).
  if (isMetricsPath(rawPath)) return;

  try {
    const runtime = getRuntime();
    const route = normalizeRoute(rawPath);
    runtime.requestsTotal.inc({ method, route, code: String(code) });
    runtime.requestDuration.observe({ method, route }, durationSeconds);
  } catch (err) {
    // Метрики никогда не ломают обслуживание запроса.
    logger.error('Failed to record http metric', {
      operation: 'httpMetrics.recordRequest',
      error: err instanceof Error ? err.message : String(err),
      method,
      path: rawPath,
    });
  }
}

// Патчим http.Server.prototype.emit один раз за процесс (защита от dev
// hot-reload и повторных вызовов register()).
export function initHttpMetrics(): void {
  const g = globalThis as { __httpMetricsPatched?: boolean };
  if (g.__httpMetricsPatched) return;
  g.__httpMetricsPatched = true;

  const originalEmit = http.Server.prototype.emit;

  http.Server.prototype.emit = function patchedEmit(
    this: http.Server,
    event: string | symbol,
    ...args: unknown[]
  ): boolean {
    if (event === 'request') {
      const [req, res] = args as [http.IncomingMessage, http.ServerResponse];
      if (req && res) {
        const startedAt = process.hrtime.bigint();
        const method = req.method ?? 'UNKNOWN';
        const path = req.url ?? '/';
        res.on('finish', () => {
          const durationSeconds = Number(process.hrtime.bigint() - startedAt) / 1e9;
          recordRequest(method, path, res.statusCode, durationSeconds);
        });
      }
    }
    return originalEmit.apply(
      this,
      [event, ...args] as Parameters<typeof originalEmit>,
    );
  };

  logger.info('HTTP metrics instrumentation enabled', {
    operation: 'httpMetrics.init',
  });
}

function isMetricsPath(url: string | undefined): boolean {
  return Boolean(url && (url === '/metrics' || url.startsWith('/metrics/')));
}

// Тестовый хук: сброс реестра (патч http остаётся идемпотентным).
export function __resetHttpMetricsForTests(): void {
  getRuntime().registry.resetMetrics();
}
