// Инструментация Next.js (stable API Next 15): register() вызывается один раз
// при старте серверного процесса. Включает сбор content_*-метрик приложения
// (ЧТЗ «Централизованный мониторинг», §4.2) — только в nodejs-рантайме:
// middleware Next.js работает в edge-рантайме и не видит статус ответа.

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { initHttpMetrics } = await import('./lib/metrics/http-metrics');
    initHttpMetrics();
  }
}
