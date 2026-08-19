import client from 'prom-client';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { normalizeIp } from '@/lib/utils';

// business_*-метрики для централизованного мониторинга (ЧТЗ §4.1, TASK-BCK-001).
// Гейджи, пересчёт из БД раз в 60 с (кэш в памяти), окна 24ч/1ч.
//
// Источники (все запросы идут по индексу @@index([createdAt])):
//   Visit      → просмотры/сессии/посетители
//   ClickEvent → события (клики по номеру, разрез page)
//   Order      → заявки (все статусы)
//
// Метрики referer/geo/клики-по-услугам НЕ отдаются вообще: таких разрезов
// в модели данных сайта нет (ЧТЗ §4.1: «не отдавать нули для несуществующих
// разрезов»).

const CACHE_TTL_MS = 60_000;
const SESSION_GAP_MS = 30 * 60 * 1000;
const MAX_EVENT_TYPE_VALUES = 19; // + other = ≤ 20 значений лейбла (ЧТЗ §4.1)

export const businessRegistry = new client.Registry();

const gauges = {
  sessionsActive: gauge('business_sessions_active', 'Active sessions in the last 30 minutes'),
  pageViews24h: gauge('business_page_views_24h', 'Page views in the last 24 hours'),
  pageViews1h: gauge('business_page_views_1h', 'Page views in the last hour'),
  uniqueVisitors24h: gauge('business_unique_visitors_24h', 'Unique visitor IPs in the last 24 hours'),
  sessions24h: gauge('business_sessions_24h', 'Sessions in the last 24 hours'),
  avgSessionDuration24h: gauge(
    'business_avg_session_duration_seconds_24h',
    'Average session duration in seconds (24h)',
  ),
  bounceRate24h: gauge('business_bounce_rate_24h', 'Share of single-page-view sessions (24h, 0..1)'),
  leads24h: gauge('business_leads_24h', 'Orders (all statuses) in the last 24 hours'),
  leads1h: gauge('business_leads_1h', 'Orders (all statuses) in the last hour'),
  conversionRate24h: gauge('business_conversion_rate_24h', 'leads_24h / sessions_24h (0..1)'),
};

const eventsGauge = new client.Gauge({
  name: 'business_events_24h',
  help: 'Tracked events in the last 24 hours, by event_type (click_<page>)',
  labelNames: ['event_type'],
  registers: [businessRegistry],
});

function gauge(name: string, help: string): client.Gauge {
  return new client.Gauge({ name, help, registers: [businessRegistry] });
}

// ── Чистые функции расчёта (unit-тестируемые) ─────────────────────────

export type VisitRow = { id: string; ip: string | null; createdAt: Date };
export type ClickRow = { page: string; count: number };

export type SessionSummary = { first: number; last: number; views: number };

export type BusinessSnapshot = {
  sessionsActive: number;
  pageViews24h: number;
  pageViews1h: number;
  uniqueVisitors24h: number;
  sessions24h: number;
  avgSessionDurationSeconds24h: number;
  bounceRate24h: number;
  leads24h: number;
  leads1h: number;
  conversionRate24h: number;
  events24h: Array<{ eventType: string; count: number }>;
};

// Сессия = цепочка визитов одного ip без разрывов > 30 мин (ЧТЗ §4.1).
// Визиты без ip — отдельные одиночные сессии (ключ — id визита).
export function sessionizeVisits(visits: VisitRow[], gapMs = SESSION_GAP_MS): SessionSummary[] {
  const byKey = new Map<string, SessionSummary[]>();

  // Сортируем по времени: порядок из БД не гарантирован.
  const sorted = [...visits].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
  );

  for (const visit of sorted) {
    // Нормализация IP: исторические записи могут содержать ::ffff:1.2.3.4.
    const key =
      visit.ip && visit.ip !== 'unknown' ? normalizeIp(visit.ip) : `anon:${visit.id}`;
    const at = visit.createdAt.getTime();
    const chain = byKey.get(key) ?? [];
    const current = chain[chain.length - 1];
    if (current && at - current.last <= gapMs) {
      current.last = at;
      current.views += 1;
    } else {
      chain.push({ first: at, last: at, views: 1 });
    }
    byKey.set(key, chain);
  }

  const sessions: SessionSummary[] = [];
  for (const chain of byKey.values()) sessions.push(...chain);
  return sessions;
}

// Топ-N + other: ≤ n «реальных» значений + агрегат other (ЧТЗ §4.1).
export function topNWithOther(
  rows: Array<{ label: string; count: number }>,
  n: number,
): Array<{ label: string; count: number }> {
  const sorted = [...rows].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  const top = sorted.slice(0, n);
  const rest = sorted.slice(n);
  const otherCount = rest.reduce((sum, row) => sum + row.count, 0);
  if (rest.length > 0 && otherCount > 0) {
    top.push({ label: 'other', count: otherCount });
  }
  return top;
}

// leads / sessions с защитой от деления на 0 (ЧТЗ §4.1).
export function computeConversionRate(leads: number, sessions: number): number {
  if (sessions <= 0) return 0;
  return leads / sessions;
}

export function computeBusinessSnapshot(input: {
  now: number;
  visits: VisitRow[]; // визиты за 24ч + lookback 30 мин
  clicks24h: ClickRow[];
  pageViews24h: number;
  pageViews1h: number;
  leads24h: number;
  leads1h: number;
}): BusinessSnapshot {
  const { now, visits, clicks24h } = input;
  const since24h = now - 24 * 60 * 60 * 1000;

  const allSessions = sessionizeVisits(visits);
  const sessions24hList = allSessions.filter((s) => s.last >= since24h);
  const sessions24h = sessions24hList.length;

  const bounces = sessions24hList.filter((s) => s.views === 1).length;
  const bounceRate24h = sessions24h > 0 ? bounces / sessions24h : 0;

  const avgSessionDurationSeconds24h =
    sessions24h > 0
      ? sessions24hList.reduce((sum, s) => sum + (s.last - s.first), 0) / sessions24h / 1000
      : 0;

  const sessionsActive = allSessions.filter((s) => s.last >= now - SESSION_GAP_MS).length;

  const uniqueIps = new Set(
    visits
      .filter((v) => v.createdAt.getTime() >= since24h && v.ip && v.ip !== 'unknown')
      .map((v) => normalizeIp(v.ip as string)),
  );

  return {
    sessionsActive,
    pageViews24h: input.pageViews24h,
    pageViews1h: input.pageViews1h,
    uniqueVisitors24h: uniqueIps.size,
    sessions24h,
    avgSessionDurationSeconds24h,
    bounceRate24h,
    leads24h: input.leads24h,
    leads1h: input.leads1h,
    conversionRate24h: computeConversionRate(input.leads24h, sessions24h),
    events24h: topNWithOther(
      clicks24h.map((row) => ({ label: `click_${row.page}`, count: row.count })),
      MAX_EVENT_TYPE_VALUES,
    ).map((row) => ({ eventType: row.label, count: row.count })),
  };
}

// ── Сбор данных из БД (Prisma только в services) ──────────────────────

export async function collectBusinessSnapshot(now = Date.now()): Promise<BusinessSnapshot> {
  const since24h = new Date(now - 24 * 60 * 60 * 1000);
  const since1h = new Date(now - 60 * 60 * 1000);
  // Lookback 30 мин: сессия, начавшаяся до окна 24ч, корректно продолжается.
  const since24hWithLookback = new Date(since24h.getTime() - SESSION_GAP_MS);

  logger.info('Collecting business metrics', {
    operation: 'promMetricsService.collect',
  });

  const [visits, pageViews24h, pageViews1h, clickGroups, leads24h, leads1h] = await Promise.all([
    prisma.visit.findMany({
      where: { createdAt: { gte: since24hWithLookback } },
      select: { id: true, ip: true, createdAt: true },
    }),
    prisma.visit.count({ where: { createdAt: { gte: since24h } } }),
    prisma.visit.count({ where: { createdAt: { gte: since1h } } }),
    prisma.clickEvent.groupBy({
      by: ['page'],
      where: { createdAt: { gte: since24h } },
      _count: { _all: true },
    }),
    prisma.order.count({ where: { createdAt: { gte: since24h } } }),
    prisma.order.count({ where: { createdAt: { gte: since1h } } }),
  ]);

  const clicks24h: ClickRow[] = clickGroups.map((row) => ({
    page: row.page,
    count: row._count._all,
  }));

  const snapshot = computeBusinessSnapshot({
    now,
    visits,
    clicks24h,
    pageViews24h,
    pageViews1h,
    leads24h,
    leads1h,
  });

  logger.info('Business metrics collected', {
    operation: 'promMetricsService.collect',
    pageViews24h,
    leads24h,
    sessions24h: snapshot.sessions24h,
  });

  return snapshot;
}

// ── Рендер в формат Prometheus text 0.0.4 ─────────────────────────────

export function renderBusinessMetrics(snapshot: BusinessSnapshot): void {
  gauges.sessionsActive.set(snapshot.sessionsActive);
  gauges.pageViews24h.set(snapshot.pageViews24h);
  gauges.pageViews1h.set(snapshot.pageViews1h);
  gauges.uniqueVisitors24h.set(snapshot.uniqueVisitors24h);
  gauges.sessions24h.set(snapshot.sessions24h);
  gauges.avgSessionDuration24h.set(snapshot.avgSessionDurationSeconds24h);
  gauges.bounceRate24h.set(snapshot.bounceRate24h);
  gauges.leads24h.set(snapshot.leads24h);
  gauges.leads1h.set(snapshot.leads1h);
  gauges.conversionRate24h.set(snapshot.conversionRate24h);

  // Сбрасываем лейбл-комбинации прошлой отдачи (кэш 60 с мог устареть).
  eventsGauge.reset();
  for (const event of snapshot.events24h) {
    eventsGauge.set({ event_type: event.eventType }, event.count);
  }
}

// ── Публичный API: текст метрик с кэшем 60 с ──────────────────────────

let metricsCache: { at: number; text: string } | null = null;

export const promMetricsService = {
  async getTrackingMetricsText(now = Date.now()): Promise<string> {
    if (metricsCache && now - metricsCache.at < CACHE_TTL_MS) {
      logger.debug('Business metrics served from cache', {
        operation: 'promMetricsService.getTrackingMetricsText',
        ageMs: now - metricsCache.at,
      });
      return metricsCache.text;
    }

    try {
      const snapshot = await collectBusinessSnapshot(now);
      renderBusinessMetrics(snapshot);
      const text = await businessRegistry.metrics();
      metricsCache = { at: now, text };
      return text;
    } catch (err) {
      logger.error('Failed to render business metrics', {
        operation: 'promMetricsService.getTrackingMetricsText',
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  },
};

// Тестовый хук: сброс кэша.
export function __resetBusinessMetricsCache(): void {
  metricsCache = null;
}
