import client from 'prom-client';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { normalizeIp } from '@/lib/utils';

// business_*-метрики для централизованного мониторинга (ЧТЗ §4.1,
// TASK-BCK-001; ЧТЗ_Сайт_эвакуация_online_Полные_Бизнес_Метрики.md §2;
// v2 — ЧТЗ_Метрики_пути_клиента_v2.md, ADR-014: полный путь клиента,
// окна 24ч+7д, воронка, устройства, WhatsApp, время на странице).
// Гейджи, пересчёт из БД раз в 60 с (кэш в памяти), окна 24ч/7д (+1х/12х где важно).
//
// Источники (все запросы идут по индексу @@index([createdAt])):
//   Visit      → просмотры/сессии/посетители/источники/гео/landing/переходы/
//                exit/устройства/UTM-возвраты/время на странице
//   ClickEvent → события (click_phone / click_whatsapp / service_click),
//                contact-сессии воронки
//   Order      → заявки (все статусы)
//
// Метрики телефона/WhatsApp (клики-окна + события с timestamp) и топ-разрезы
// рендерятся вручную (не через prom-client): prom-client всегда пишет HELP/TYPE
// даже для пустых гейджей и не поддерживает timestamp у семплов, а по ЧТЗ
// «кликов нет — метрики не рендерятся» и нужен unix-мс на каждый семпл события.

const CACHE_TTL_MS = 60_000;
const SESSION_GAP_MS = 30 * 60 * 1000;
const MAX_EVENT_TYPE_VALUES = 19; // + other = ≤ 20 значений лейбла (ЧТЗ §4.1)
const TOP_SLICES = 10; // топ-10 referral/geo/service/landing/переходов (ЧТЗ §2.2–2.4)
const TOP_DWELL_SLICES = 5; // топ-5 страниц по времени (ADR-014)
const UNKNOWN_CITY = '(unknown)';
const UNKNOWN_DEVICE = 'unknown';
const MAX_PHONE_CLICK_EVENTS = 10_000; // защита текста метрик от разрастания

// Воронка (ADR-014): content_view = просмотр страницы вне этого списка.
const FUNNEL_EXCLUDED_PAGES = new Set(['home', 'politika']);
export const FUNNEL_STAGES = ['visit', 'content_view', 'contact_click', 'lead'] as const;

export const businessRegistry = new client.Registry();

const gauges = {
  sessionsActive: gauge('business_sessions_active', 'Active sessions in the last 30 minutes'),
  pageViews24h: gauge('business_page_views_24h', 'Page views in the last 24 hours'),
  pageViews1h: gauge('business_page_views_1h', 'Page views in the last hour'),
  pageViews7d: gauge('business_page_views_7d', 'Page views in the last 7 days'),
  uniqueVisitors24h: gauge('business_unique_visitors_24h', 'Unique visitors in the last 24 hours (visitorId, fallback IP)'),
  uniqueVisitors7d: gauge('business_unique_visitors_7d', 'Unique visitors in the last 7 days (visitorId, fallback IP)'),
  sessions24h: gauge('business_sessions_24h', 'Sessions in the last 24 hours'),
  sessions7d: gauge('business_sessions_7d', 'Sessions in the last 7 days'),
  avgSessionDuration24h: gauge(
    'business_avg_session_duration_seconds_24h',
    'Average session duration in seconds (24h)',
  ),
  avgSessionDuration7d: gauge(
    'business_avg_session_duration_seconds_7d',
    'Average session duration in seconds (7d)',
  ),
  bounceRate24h: gauge('business_bounce_rate_24h', 'Share of single-page-view sessions (24h, 0..1)'),
  bounceRate7d: gauge('business_bounce_rate_7d', 'Share of single-page-view sessions (7d, 0..1)'),
  leads24h: gauge('business_leads_24h', 'Orders (all statuses) in the last 24 hours'),
  leads1h: gauge('business_leads_1h', 'Orders (all statuses) in the last hour'),
  leads7d: gauge('business_leads_7d', 'Orders (all statuses) in the last 7 days'),
  conversionRate24h: gauge('business_conversion_rate_24h', 'leads_24h / sessions_24h (0..1)'),
  conversionRate7d: gauge('business_conversion_rate_7d', 'leads_7d / sessions_7d (0..1)'),
  // ADR-014: путь клиента и engagement.
  avgPagesPerSession24h: gauge('business_avg_pages_per_session_24h', 'Average page views per session (24h)'),
  avgPagesPerSession7d: gauge('business_avg_pages_per_session_7d', 'Average page views per session (7d)'),
  avgTimeOnPage24h: gauge('business_avg_time_on_page_24h', 'Average time on page in seconds (24h)'),
  avgTimeOnPage7d: gauge('business_avg_time_on_page_7d', 'Average time on page in seconds (7d)'),
  visitorsReturning24h: gauge('business_visitors_returning_24h', 'Returning visitors (visitorId seen before window) in the last 24 hours'),
  visitorsReturning7d: gauge('business_visitors_returning_7d', 'Returning visitors (visitorId seen before window) in the last 7 days'),
  phoneClicks7d: gauge('business_phone_clicks_7d', 'Phone number (tel:) clicks in the last 7 days'),
  whatsappClicks12h: gauge('business_whatsapp_clicks_12h', 'WhatsApp (wa.me) clicks in the last 12 hours'),
  whatsappClicks7d: gauge('business_whatsapp_clicks_7d', 'WhatsApp (wa.me) clicks in the last 7 days'),
};

const eventsGauge = new client.Gauge({
  name: 'business_events_24h',
  help: 'Tracked events in the last 24 hours, by event_type (click_phone, click_whatsapp, service_click)',
  labelNames: ['event_type'],
  registers: [businessRegistry],
});

const funnel24hGauge = new client.Gauge({
  name: 'business_funnel_24h',
  help: 'Conversion funnel by stage in the last 24 hours: visit → content_view → contact_click → lead',
  labelNames: ['stage'],
  registers: [businessRegistry],
});

const funnel7dGauge = new client.Gauge({
  name: 'business_funnel_7d',
  help: 'Conversion funnel by stage in the last 7 days: visit → content_view → contact_click → lead',
  labelNames: ['stage'],
  registers: [businessRegistry],
});

function gauge(name: string, help: string): client.Gauge {
  return new client.Gauge({ name, help, registers: [businessRegistry] });
}

// ── Чистые функции расчёта (unit-тестируемые) ─────────────────────────

export type VisitRow = {
  id: string;
  ip: string | null;
  referer: string | null;
  city: string | null;
  createdAt: Date;
  // v2 (ADR-014) — опциональны для совместимости легаси-строк/тестов.
  page?: string | null;
  fromPage?: string | null;
  sessionId?: string | null;
  visitorId?: string | null;
  device?: string | null;
  dwellMs?: number | null;
};
export type EventRow = { eventType: string; count: number };
export type ServiceRow = { service: string; count: number };
export type TransitionRow = { from: string; to: string; count: number };
export type EntryFlowRow = { source: string; landing: string; count: number };

export type SessionSummary = {
  first: number;
  last: number;
  views: number;
  // ADR-014: страницы входа/выхода сессии.
  firstPage: string;
  lastPage: string;
  key: string;
};

export type BusinessSnapshot = {
  sessionsActive: number;
  pageViews24h: number;
  pageViews1h: number;
  pageViews7d: number;
  uniqueVisitors24h: number;
  uniqueVisitors7d: number;
  sessions24h: number;
  sessions7d: number;
  avgSessionDurationSeconds24h: number;
  avgSessionDurationSeconds7d: number;
  bounceRate24h: number;
  bounceRate7d: number;
  leads24h: number;
  leads1h: number;
  leads7d: number;
  conversionRate24h: number;
  conversionRate7d: number;
  events24h: Array<{ eventType: string; count: number }>;
  // ЧТЗ «Полные бизнес-метрики»:
  phoneClicks12h: number;
  phoneClicks7d: number;
  phoneClickTimestamps24h: number[]; // unix-мс, по возрастанию (ADR-012)
  referralSources24h: Array<{ source: string; count: number }>;
  geoVisitors24h: Array<{ city: string; visitors: number }>;
  serviceClicks24h: Array<{ service: string; count: number }>;
  // ЧТЗ «Метрики пути клиента v2» (ADR-014):
  landingPages24h: Array<{ page: string; count: number }>;
  landingPages7d: Array<{ page: string; count: number }>;
  transitions24h: TransitionRow[];
  transitions7d: TransitionRow[];
  entryFlows24h: EntryFlowRow[];
  exitPages24h: Array<{ page: string; count: number }>;
  exitPages7d: Array<{ page: string; count: number }>;
  devices24h: Array<{ device: string; count: number }>;
  devices7d: Array<{ device: string; count: number }>;
  visitorsReturning24h: number;
  visitorsReturning7d: number;
  whatsappClicks12h: number;
  whatsappClicks7d: number;
  whatsappClickTimestamps24h: number[];
  avgPagesPerSession24h: number;
  avgPagesPerSession7d: number;
  avgTimeOnPageSeconds24h: number;
  avgTimeOnPageSeconds7d: number;
  topDwellPages24h: Array<{ page: string; seconds: number }>;
  funnel24h: Record<(typeof FUNNEL_STAGES)[number], number>;
  funnel7d: Record<(typeof FUNNEL_STAGES)[number], number>;
};

// Ключ сессии: sessionId вкладки (ADR-014), fallback — нормализованный IP
// (легаси-строки ADR-002), без ip — одиночная анонимная сессия.
function sessionKey(visit: VisitRow): string {
  if (visit.sessionId) return `sid:${visit.sessionId}`;
  if (visit.ip && visit.ip !== 'unknown') return `ip:${normalizeIp(visit.ip)}`;
  return `anon:${visit.id}`;
}

// Сессия = цепочка просмотров одного ключа без разрывов > 30 мин (ЧТЗ §4.1,
// ADR-014). Сортировка по времени: порядок из БД не гарантирован.
export function sessionizeVisits(visits: VisitRow[], gapMs = SESSION_GAP_MS): SessionSummary[] {
  const byKey = new Map<string, SessionSummary[]>();

  const sorted = [...visits].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
  );

  for (const visit of sorted) {
    const at = visit.createdAt.getTime();
    const key = sessionKey(visit);
    const page = visit.page || 'home';
    const chain = byKey.get(key) ?? [];
    const current = chain[chain.length - 1];
    if (current && at - current.last <= gapMs) {
      current.last = at;
      current.views += 1;
      current.lastPage = page;
    } else {
      chain.push({ first: at, last: at, views: 1, firstPage: page, lastPage: page, key });
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

// Топ-N БЕЗ other: сортировка по count (desc), затем по label (asc) —
// для referral/geo/service топ-10 (ЧТЗ §2.2–2.4).
export function topSlices(
  rows: Array<{ label: string; count: number }>,
  n: number,
): Array<{ label: string; count: number }> {
  return [...rows]
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, n);
}

// Переходы from→to за окно (ADR-014): топ-N пар + other.
export function computeTransitions(
  visits: VisitRow[],
  n = TOP_SLICES,
): TransitionRow[] {
  const counts = new Map<string, { label: string; from: string; to: string; count: number }>();
  for (const visit of visits) {
    if (!visit.fromPage) continue;
    const to = visit.page || 'home';
    const key = `${visit.fromPage}\u0000${to}`;
    const cur = counts.get(key) ?? { label: `${visit.fromPage} → ${to}`, from: visit.fromPage, to, count: 0 };
    cur.count += 1;
    counts.set(key, cur);
  }
  return topNWithOther([...counts.values()], n).map((row) => {
    const [from, to] = row.label.split(' → ');
    return { from: from ?? 'other', to: to ?? 'other', count: row.count };
  });
}

// Источник × посадочная за окно (ADR-014): только входные визиты сессий.
export function computeEntryFlows(visits: VisitRow[], n = TOP_SLICES): EntryFlowRow[] {
  const counts = new Map<string, { label: string; source: string; landing: string; count: number }>();
  for (const visit of entryVisitsOf(visits)) {
    const landing = visit.page || 'home';
    const key = `${visit.referer}\u0000${landing}`;
    const cur = counts.get(key) ?? { label: `${visit.referer} → ${landing}`, source: visit.referer, landing, count: 0 };
    cur.count += 1;
    counts.set(key, cur);
  }
  return topNWithOther([...counts.values()], n).map((row) => {
    const [source, landing] = row.label.split(' → ');
    return { source: source ?? 'other', landing: landing ?? 'other', count: row.count };
  });
}

function entryVisitsOf(visits: VisitRow[]): Array<VisitRow & { referer: string }> {
  return visits.filter(
    (v): v is VisitRow & { referer: string } => v.referer !== null && v.referer !== undefined,
  );
}

// Устройства за окно (ADR-014): по полю device, null/undefined → unknown.
export function computeDevices(visits: VisitRow[], n = TOP_SLICES): Array<{ device: string; count: number }> {
  const counts = new Map<string, number>();
  for (const visit of visits) {
    const device = visit.device || UNKNOWN_DEVICE;
    counts.set(device, (counts.get(device) ?? 0) + 1);
  }
  return topSlices([...counts].map(([device, count]) => ({ label: device, count })), n).map(
    (row) => ({ device: row.label, count: row.count }),
  );
}

// Топ страниц по среднему времени на странице (ADR-014), секунды.
export function computeTopDwellPages(
  visits: VisitRow[],
  n = TOP_DWELL_SLICES,
): Array<{ page: string; seconds: number }> {
  const acc = new Map<string, { total: number; count: number }>();
  for (const visit of visits) {
    if (visit.dwellMs === null || visit.dwellMs === undefined) continue;
    const page = visit.page || 'home';
    const cur = acc.get(page) ?? { total: 0, count: 0 };
    cur.total += visit.dwellMs;
    cur.count += 1;
    acc.set(page, cur);
  }
  return [...acc]
    .map(([page, { total, count }]) => ({ page, seconds: Math.round((total / count / 1000) * 10) / 10 }))
    .sort((a, b) => b.seconds - a.seconds || a.page.localeCompare(b.page))
    .slice(0, n);
}

// Уникальные посетители за окно: visitorId (ADR-014), fallback — нормализованный IP.
export function computeUniqueVisitors(visits: VisitRow[]): number {
  const unique = new Set<string>();
  for (const visit of visits) {
    if (visit.visitorId) {
      unique.add(`vid:${visit.visitorId}`);
    } else if (visit.ip && visit.ip !== 'unknown') {
      unique.add(`ip:${normalizeIp(visit.ip)}`);
    }
  }
  return unique.size;
}

// Вернувшиеся: visitorId активен в окне И был до начала окна.
export function computeReturningVisitors(
  windowVisits: VisitRow[],
  seenBefore: Set<string>,
): number {
  let count = 0;
  const counted = new Set<string>();
  for (const visit of windowVisits) {
    if (!visit.visitorId || counted.has(visit.visitorId)) continue;
    if (seenBefore.has(visit.visitorId)) {
      counted.add(visit.visitorId);
      count += 1;
    }
  }
  return count;
}

// Среднее время на странице (секунды) по просмотрам с dwellMs.
export function computeAvgTimeOnPageSeconds(visits: VisitRow[]): number {
  let total = 0;
  let count = 0;
  for (const visit of visits) {
    if (visit.dwellMs === null || visit.dwellMs === undefined) continue;
    total += visit.dwellMs;
    count += 1;
  }
  if (count === 0) return 0;
  return Math.round((total / count / 1000) * 10) / 10;
}

type WindowInput = {
  visits: VisitRow[]; // визиты окна (без lookback)
  sessions: SessionSummary[]; // сессии окна (last >= граница окна)
  leads: number;
  contactClickSessionIds: Set<string>;
  returningSeenBefore: Set<string>;
};

type WindowMetrics = {
  uniqueVisitors: number;
  sessions: number;
  avgSessionDurationSeconds: number;
  bounceRate: number;
  conversionRate: number;
  landingPages: Array<{ page: string; count: number }>;
  exitPages: Array<{ page: string; count: number }>;
  transitions: TransitionRow[];
  devices: Array<{ device: string; count: number }>;
  visitorsReturning: number;
  avgPagesPerSession: number;
  avgTimeOnPageSeconds: number;
  funnel: Record<(typeof FUNNEL_STAGES)[number], number>;
};

function computeWindow(input: WindowInput): WindowMetrics {
  const { visits, sessions, leads, contactClickSessionIds } = input;

  const bounces = sessions.filter((s) => s.views === 1).length;
  const bounceRate = sessions.length > 0 ? bounces / sessions.length : 0;

  const avgSessionDurationSeconds =
    sessions.length > 0
      ? sessions.reduce((sum, s) => sum + (s.last - s.first), 0) / sessions.length / 1000
      : 0;

  const landingCounts = new Map<string, number>();
  const exitCounts = new Map<string, number>();
  for (const session of sessions) {
    landingCounts.set(session.firstPage, (landingCounts.get(session.firstPage) ?? 0) + 1);
    exitCounts.set(session.lastPage, (exitCounts.get(session.lastPage) ?? 0) + 1);
  }

  // content_view: сессии с просмотром контентной страницы (ADR-014).
  const sessionKeySet = new Set(sessions.map((s) => s.key));
  const contentViewKeys = new Set<string>();
  for (const visit of visits) {
    const page = visit.page || 'home';
    if (FUNNEL_EXCLUDED_PAGES.has(page)) continue;
    const key = sessionKey(visit);
    if (sessionKeySet.has(key)) contentViewKeys.add(key);
  }

  // contact_click: сессии с кликом телефон/WhatsApp (по sessionId, ADR-014).
  let contactClicks = 0;
  for (const sid of contactClickSessionIds) {
    if (sessionKeySet.has(`sid:${sid}`)) contactClicks += 1;
  }

  return {
    uniqueVisitors: computeUniqueVisitors(visits),
    sessions: sessions.length,
    avgSessionDurationSeconds,
    bounceRate,
    conversionRate: computeConversionRate(leads, sessions.length),
    landingPages: topNWithOther([...landingCounts].map(([page, count]) => ({ label: page, count })), TOP_SLICES).map(
      (row) => ({ page: row.label, count: row.count }),
    ),
    exitPages: topNWithOther([...exitCounts].map(([page, count]) => ({ label: page, count })), TOP_SLICES).map(
      (row) => ({ page: row.label, count: row.count }),
    ),
    transitions: computeTransitions(visits),
    devices: computeDevices(visits),
    visitorsReturning: computeReturningVisitors(visits, input.returningSeenBefore),
    avgPagesPerSession:
      sessions.length > 0
        ? Math.round((sessions.reduce((sum, s) => sum + s.views, 0) / sessions.length) * 10) / 10
        : 0,
    avgTimeOnPageSeconds: computeAvgTimeOnPageSeconds(visits),
    funnel: {
      visit: sessions.length,
      content_view: contentViewKeys.size,
      contact_click: contactClicks,
      lead: leads,
    },
  };
}

export function computeBusinessSnapshot(input: {
  now: number;
  visits: VisitRow[]; // визиты за 7д + lookback 30 мин (v2 один запрос)
  events24h: EventRow[];
  pageViews24h: number;
  pageViews1h: number;
  pageViews7d: number;
  leads24h: number;
  leads1h: number;
  leads7d: number;
  phoneClicks12h: number;
  phoneClicks7d: number;
  phoneClickTimestamps24h: number[];
  serviceClicks24h: ServiceRow[];
  // v2 (ADR-014):
  whatsappClicks12h: number;
  whatsappClicks7d: number;
  whatsappClickTimestamps24h: number[];
  contactClickSessionIds24h: string[];
  contactClickSessionIds7d: string[];
  visitorsSeenBefore24h: string[]; // visitorId с визитами до начала окна 24ч
  visitorsSeenBefore7d: string[];
}): BusinessSnapshot {
  const { now, visits } = input;
  const since24h = now - 24 * 60 * 60 * 1000;
  const since7d = now - 7 * 24 * 60 * 60 * 1000;

  const allSessions = sessionizeVisits(visits);
  const sessions24hList = allSessions.filter((s) => s.last >= since24h);
  const sessions7dList = allSessions.filter((s) => s.last >= since7d);

  const sessionsActive = allSessions.filter((s) => s.last >= now - SESSION_GAP_MS).length;

  const visits24h = visits.filter((v) => v.createdAt.getTime() >= since24h);
  const visits7d = visits.filter((v) => v.createdAt.getTime() >= since7d);

  const w24 = computeWindow({
    visits: visits24h,
    sessions: sessions24hList,
    leads: input.leads24h,
    contactClickSessionIds: new Set(input.contactClickSessionIds24h),
    returningSeenBefore: new Set(input.visitorsSeenBefore24h),
  });
  const w7 = computeWindow({
    visits: visits7d,
    sessions: sessions7dList,
    leads: input.leads7d,
    contactClickSessionIds: new Set(input.contactClickSessionIds7d),
    returningSeenBefore: new Set(input.visitorsSeenBefore7d),
  });

  // Источники: считаем только входные визиты сессий (referer ≠ null, ЧТЗ §2.2).
  const referralCounts = new Map<string, number>();
  for (const visit of visits24h) {
    if (visit.referer === null || visit.referer === undefined) continue;
    referralCounts.set(visit.referer, (referralCounts.get(visit.referer) ?? 0) + 1);
  }

  // Гео: уникальные посетители (нормализованные IP) по городам (ЧТЗ §2.3).
  const cityIps = new Map<string, Set<string>>();
  for (const visit of visits24h) {
    if (!visit.ip || visit.ip === 'unknown') continue;
    const city = visit.city ?? UNKNOWN_CITY;
    const ips = cityIps.get(city) ?? new Set<string>();
    ips.add(normalizeIp(visit.ip));
    cityIps.set(city, ips);
  }

  return {
    sessionsActive,
    pageViews24h: input.pageViews24h,
    pageViews1h: input.pageViews1h,
    pageViews7d: input.pageViews7d,
    uniqueVisitors24h: w24.uniqueVisitors,
    uniqueVisitors7d: w7.uniqueVisitors,
    sessions24h: w24.sessions,
    sessions7d: w7.sessions,
    avgSessionDurationSeconds24h: w24.avgSessionDurationSeconds,
    avgSessionDurationSeconds7d: w7.avgSessionDurationSeconds,
    bounceRate24h: w24.bounceRate,
    bounceRate7d: w7.bounceRate,
    leads24h: input.leads24h,
    leads1h: input.leads1h,
    leads7d: input.leads7d,
    conversionRate24h: w24.conversionRate,
    conversionRate7d: w7.conversionRate,
    events24h: topNWithOther(
      input.events24h.map((row) => ({ label: row.eventType, count: row.count })),
      MAX_EVENT_TYPE_VALUES,
    ).map((row) => ({ eventType: row.label, count: row.count })),
    phoneClicks12h: input.phoneClicks12h,
    phoneClicks7d: input.phoneClicks7d,
    phoneClickTimestamps24h: [...input.phoneClickTimestamps24h].sort((a, b) => a - b),
    referralSources24h: topSlices(
      [...referralCounts].map(([source, count]) => ({ label: source, count })),
      TOP_SLICES,
    ).map((row) => ({ source: row.label, count: row.count })),
    geoVisitors24h: topSlices(
      [...cityIps].map(([city, ips]) => ({ label: city, count: ips.size })),
      TOP_SLICES,
    ).map((row) => ({ city: row.label, visitors: row.count })),
    serviceClicks24h: topSlices(
      input.serviceClicks24h.map((row) => ({ label: row.service, count: row.count })),
      TOP_SLICES,
    ).map((row) => ({ service: row.label, count: row.count })),
    landingPages24h: w24.landingPages,
    landingPages7d: w7.landingPages,
    transitions24h: w24.transitions,
    transitions7d: w7.transitions,
    entryFlows24h: computeEntryFlows(visits24h),
    exitPages24h: w24.exitPages,
    exitPages7d: w7.exitPages,
    devices24h: w24.devices,
    devices7d: w7.devices,
    visitorsReturning24h: w24.visitorsReturning,
    visitorsReturning7d: w7.visitorsReturning,
    whatsappClicks12h: input.whatsappClicks12h,
    whatsappClicks7d: input.whatsappClicks7d,
    whatsappClickTimestamps24h: [...input.whatsappClickTimestamps24h].sort((a, b) => a - b),
    avgPagesPerSession24h: w24.avgPagesPerSession,
    avgPagesPerSession7d: w7.avgPagesPerSession,
    avgTimeOnPageSeconds24h: w24.avgTimeOnPageSeconds,
    avgTimeOnPageSeconds7d: w7.avgTimeOnPageSeconds,
    topDwellPages24h: computeTopDwellPages(visits24h),
    funnel24h: w24.funnel,
    funnel7d: w7.funnel,
  };
}

// ── Сбор данных из БД (Prisma только в services) ──────────────────────

const VISIT_SELECT = {
  id: true,
  ip: true,
  referer: true,
  city: true,
  createdAt: true,
  page: true,
  fromPage: true,
  sessionId: true,
  visitorId: true,
  device: true,
  dwellMs: true,
} as const;

export async function collectBusinessSnapshot(now = Date.now()): Promise<BusinessSnapshot> {
  const since24h = new Date(now - 24 * 60 * 60 * 1000);
  const since7d = new Date(now - 7 * 24 * 60 * 60 * 1000);
  const since12h = new Date(now - 12 * 60 * 60 * 1000);
  const since1h = new Date(now - 60 * 60 * 1000);
  // Lookback 30 мин: сессия, начавшаяся до окна, корректно продолжается.
  const since7dWithLookback = new Date(since7d.getTime() - SESSION_GAP_MS);

  logger.info('Collecting business metrics', {
    operation: 'promMetricsService.collect',
  });

  const [
    visits,
    pageViews24h,
    pageViews1h,
    pageViews7d,
    eventGroups,
    leads24h,
    leads1h,
    leads7d,
    phoneClicks12h,
    phoneClicks7d,
    phoneClickRows,
    whatsappClicks12h,
    whatsappClicks7d,
    whatsappClickRows,
    serviceGroups,
    contactSessions24h,
    contactSessions7d,
  ] = await Promise.all([
    prisma.visit.findMany({
      where: { createdAt: { gte: since7dWithLookback } },
      select: VISIT_SELECT,
    }),
    prisma.visit.count({ where: { createdAt: { gte: since24h } } }),
    prisma.visit.count({ where: { createdAt: { gte: since1h } } }),
    prisma.visit.count({ where: { createdAt: { gte: since7d } } }),
    prisma.clickEvent.groupBy({
      by: ['eventType'],
      where: { createdAt: { gte: since24h } },
      _count: { _all: true },
    }),
    prisma.order.count({ where: { createdAt: { gte: since24h } } }),
    prisma.order.count({ where: { createdAt: { gte: since1h } } }),
    prisma.order.count({ where: { createdAt: { gte: since7d } } }),
    prisma.clickEvent.count({
      where: { eventType: 'click_phone', createdAt: { gte: since12h } },
    }),
    prisma.clickEvent.count({
      where: { eventType: 'click_phone', createdAt: { gte: since7d } },
    }),
    prisma.clickEvent.findMany({
      where: { eventType: 'click_phone', createdAt: { gte: since24h } },
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' },
      take: MAX_PHONE_CLICK_EVENTS,
    }),
    prisma.clickEvent.count({
      where: { eventType: 'click_whatsapp', createdAt: { gte: since12h } },
    }),
    prisma.clickEvent.count({
      where: { eventType: 'click_whatsapp', createdAt: { gte: since7d } },
    }),
    prisma.clickEvent.findMany({
      where: { eventType: 'click_whatsapp', createdAt: { gte: since24h } },
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' },
      take: MAX_PHONE_CLICK_EVENTS,
    }),
    prisma.clickEvent.groupBy({
      by: ['service'],
      where: { eventType: 'service_click', createdAt: { gte: since24h }, service: { not: null } },
      _count: { _all: true },
    }),
    prisma.clickEvent.findMany({
      where: {
        eventType: { in: ['click_phone', 'click_whatsapp'] },
        sessionId: { not: null },
        createdAt: { gte: since24h },
      },
      select: { sessionId: true },
      distinct: ['sessionId'],
    }),
    prisma.clickEvent.findMany({
      where: {
        eventType: { in: ['click_phone', 'click_whatsapp'] },
        sessionId: { not: null },
        createdAt: { gte: since7d },
      },
      select: { sessionId: true },
      distinct: ['sessionId'],
    }),
  ]);

  // Вернувшиеся посетители (ADR-014): visitorId активен в окне И был до окна.
  const [seenBefore24hRows, seenBefore7dRows] = await Promise.all([
    findVisitorsSeenBefore(visits, since24h),
    findVisitorsSeenBefore(visits, since7d),
  ]);

  const events24h: EventRow[] = eventGroups.map((row) => ({
    eventType: row.eventType,
    count: row._count._all,
  }));

  const serviceClicks24h: ServiceRow[] = serviceGroups
    .filter((row) => row.service !== null)
    .map((row) => ({ service: row.service as string, count: row._count._all }));

  const snapshot = computeBusinessSnapshot({
    now,
    visits,
    events24h,
    pageViews24h,
    pageViews1h,
    pageViews7d,
    leads24h,
    leads1h,
    leads7d,
    phoneClicks12h,
    phoneClicks7d,
    phoneClickTimestamps24h: phoneClickRows.map((row) => row.createdAt.getTime()),
    serviceClicks24h,
    whatsappClicks12h,
    whatsappClicks7d,
    whatsappClickTimestamps24h: whatsappClickRows.map((row) => row.createdAt.getTime()),
    contactClickSessionIds24h: contactSessions24h
      .map((row) => row.sessionId)
      .filter((sid): sid is string => sid !== null),
    contactClickSessionIds7d: contactSessions7d
      .map((row) => row.sessionId)
      .filter((sid): sid is string => sid !== null),
    visitorsSeenBefore24h: seenBefore24hRows,
    visitorsSeenBefore7d: seenBefore7dRows,
  });

  logger.info('Business metrics collected', {
    operation: 'promMetricsService.collect',
    pageViews24h,
    leads24h,
    sessions24h: snapshot.sessions24h,
    phoneClicks12h: snapshot.phoneClicks12h,
    whatsappClicks12h: snapshot.whatsappClicks12h,
  });

  return snapshot;
}

// visitorId из окна, у которых есть визиты ДО границы окна (ADR-014).
async function findVisitorsSeenBefore(
  windowVisits: VisitRow[],
  windowStart: Date,
): Promise<string[]> {
  const ids = [...new Set(windowVisits.map((v) => v.visitorId).filter((v): v is string => Boolean(v)))];
  if (ids.length === 0) return [];
  const rows = await prisma.visit.findMany({
    where: { visitorId: { in: ids }, createdAt: { lt: windowStart } },
    select: { visitorId: true },
    distinct: ['visitorId'],
  });
  return rows.map((row) => row.visitorId).filter((v): v is string => Boolean(v));
}

// ── Рендер в формат Prometheus text 0.0.4 ─────────────────────────────

export function renderBusinessMetrics(snapshot: BusinessSnapshot): void {
  gauges.sessionsActive.set(snapshot.sessionsActive);
  gauges.pageViews24h.set(snapshot.pageViews24h);
  gauges.pageViews1h.set(snapshot.pageViews1h);
  gauges.pageViews7d.set(snapshot.pageViews7d);
  gauges.uniqueVisitors24h.set(snapshot.uniqueVisitors24h);
  gauges.uniqueVisitors7d.set(snapshot.uniqueVisitors7d);
  gauges.sessions24h.set(snapshot.sessions24h);
  gauges.sessions7d.set(snapshot.sessions7d);
  gauges.avgSessionDuration24h.set(snapshot.avgSessionDurationSeconds24h);
  gauges.avgSessionDuration7d.set(snapshot.avgSessionDurationSeconds7d);
  gauges.bounceRate24h.set(snapshot.bounceRate24h);
  gauges.bounceRate7d.set(snapshot.bounceRate7d);
  gauges.leads24h.set(snapshot.leads24h);
  gauges.leads1h.set(snapshot.leads1h);
  gauges.leads7d.set(snapshot.leads7d);
  gauges.conversionRate24h.set(snapshot.conversionRate24h);
  gauges.conversionRate7d.set(snapshot.conversionRate7d);
  gauges.avgPagesPerSession24h.set(snapshot.avgPagesPerSession24h);
  gauges.avgPagesPerSession7d.set(snapshot.avgPagesPerSession7d);
  gauges.avgTimeOnPage24h.set(snapshot.avgTimeOnPageSeconds24h);
  gauges.avgTimeOnPage7d.set(snapshot.avgTimeOnPageSeconds7d);
  gauges.visitorsReturning24h.set(snapshot.visitorsReturning24h);
  gauges.visitorsReturning7d.set(snapshot.visitorsReturning7d);
  gauges.phoneClicks7d.set(snapshot.phoneClicks7d);
  gauges.whatsappClicks12h.set(snapshot.whatsappClicks12h);
  gauges.whatsappClicks7d.set(snapshot.whatsappClicks7d);

  // Сбрасываем лейбл-комбинации прошлой отдачи (кэш 60 с мог устареть).
  eventsGauge.reset();
  for (const event of snapshot.events24h) {
    eventsGauge.set({ event_type: event.eventType }, event.count);
  }

  funnel24hGauge.reset();
  for (const stage of FUNNEL_STAGES) {
    funnel24hGauge.set({ stage }, snapshot.funnel24h[stage]);
  }
  funnel7dGauge.reset();
  for (const stage of FUNNEL_STAGES) {
    funnel7dGauge.set({ stage }, snapshot.funnel7d[stage]);
  }
}

// Экранирование значения лейбла (спецификация Prometheus text 0.0.4).
export function escapeLabelValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/"/g, '\\"');
}

// Ручной рендер метрик, которых нет в реестре (ЧТЗ §2.1–2.4; ADR-014):
// - клики по телефону/WhatsApp: gauge-окна + один семпл «1 <unix-мс>» на клик за 24ч;
// - топ-10 referral/geo/service/landing/переходов/exit/устройств, входные потоки.
// Нет данных → блок целиком не рендерится. Чистая функция (unit-тестируемая).
export function renderExtraBusinessMetricsText(snapshot: BusinessSnapshot): string {
  const blocks: string[] = [];

  if (snapshot.phoneClickTimestamps24h.length > 0) {
    blocks.push(
      [
        '# HELP business_phone_clicks_12h Phone number (tel:) clicks in the last 12 hours',
        '# TYPE business_phone_clicks_12h gauge',
        `business_phone_clicks_12h ${snapshot.phoneClicks12h}`,
      ].join('\n'),
      [
        '# HELP business_phone_clicks_event Phone click events (last 24h), one sample per click with exact click timestamp',
        '# TYPE business_phone_clicks_event gauge',
        ...snapshot.phoneClickTimestamps24h.map((ts) => `business_phone_clicks_event 1 ${ts}`),
      ].join('\n'),
    );
  }

  if (snapshot.whatsappClickTimestamps24h.length > 0) {
    blocks.push(
      [
        '# HELP business_whatsapp_clicks_event WhatsApp click events (last 24h), one sample per click with exact click timestamp',
        '# TYPE business_whatsapp_clicks_event gauge',
        ...snapshot.whatsappClickTimestamps24h.map((ts) => `business_whatsapp_clicks_event 1 ${ts}`),
      ].join('\n'),
    );
  }

  if (snapshot.referralSources24h.length > 0) {
    blocks.push(
      [
        '# HELP business_referral_sources_24h Visits by referral source (top 10) in the last 24 hours',
        '# TYPE business_referral_sources_24h gauge',
        ...snapshot.referralSources24h.map(
          (row) => `business_referral_sources_24h{source="${escapeLabelValue(row.source)}"} ${row.count}`,
        ),
      ].join('\n'),
    );
  }

  if (snapshot.geoVisitors24h.length > 0) {
    blocks.push(
      [
        '# HELP business_geo_visitors_24h Unique visitors by city (top 10) in the last 24 hours',
        '# TYPE business_geo_visitors_24h gauge',
        ...snapshot.geoVisitors24h.map(
          (row) => `business_geo_visitors_24h{city="${escapeLabelValue(row.city)}"} ${row.visitors}`,
        ),
      ].join('\n'),
    );
  }

  if (snapshot.serviceClicks24h.length > 0) {
    blocks.push(
      [
        '# HELP business_service_clicks_24h Service card clicks (top 10) in the last 24 hours',
        '# TYPE business_service_clicks_24h gauge',
        ...snapshot.serviceClicks24h.map(
          (row) => `business_service_clicks_24h{service="${escapeLabelValue(row.service)}"} ${row.count}`,
        ),
      ].join('\n'),
    );
  }

  // ── ADR-014: путь клиента ────────────────────────────────────────────

  if (snapshot.landingPages24h.length > 0) {
    blocks.push(
      [
        '# HELP business_landing_pages_24h Session landing (entry) pages (top 10) in the last 24 hours',
        '# TYPE business_landing_pages_24h gauge',
        ...snapshot.landingPages24h.map(
          (row) => `business_landing_pages_24h{page="${escapeLabelValue(row.page)}"} ${row.count}`,
        ),
      ].join('\n'),
    );
  }

  if (snapshot.landingPages7d.length > 0) {
    blocks.push(
      [
        '# HELP business_landing_pages_7d Session landing (entry) pages (top 10) in the last 7 days',
        '# TYPE business_landing_pages_7d gauge',
        ...snapshot.landingPages7d.map(
          (row) => `business_landing_pages_7d{page="${escapeLabelValue(row.page)}"} ${row.count}`,
        ),
      ].join('\n'),
    );
  }

  if (snapshot.transitions24h.length > 0) {
    blocks.push(
      [
        '# HELP business_page_transitions_24h Internal page transitions from→to (top 10) in the last 24 hours',
        '# TYPE business_page_transitions_24h gauge',
        ...snapshot.transitions24h.map(
          (row) =>
            `business_page_transitions_24h{from="${escapeLabelValue(row.from)}",to="${escapeLabelValue(row.to)}"} ${row.count}`,
        ),
      ].join('\n'),
    );
  }

  if (snapshot.transitions7d.length > 0) {
    blocks.push(
      [
        '# HELP business_page_transitions_7d Internal page transitions from→to (top 10) in the last 7 days',
        '# TYPE business_page_transitions_7d gauge',
        ...snapshot.transitions7d.map(
          (row) =>
            `business_page_transitions_7d{from="${escapeLabelValue(row.from)}",to="${escapeLabelValue(row.to)}"} ${row.count}`,
        ),
      ].join('\n'),
    );
  }

  if (snapshot.entryFlows24h.length > 0) {
    blocks.push(
      [
        '# HELP business_entry_flows_24h Entry visits by source and landing page (top 10) in the last 24 hours',
        '# TYPE business_entry_flows_24h gauge',
        ...snapshot.entryFlows24h.map(
          (row) =>
            `business_entry_flows_24h{source="${escapeLabelValue(row.source)}",landing="${escapeLabelValue(row.landing)}"} ${row.count}`,
        ),
      ].join('\n'),
    );
  }

  if (snapshot.exitPages24h.length > 0) {
    blocks.push(
      [
        '# HELP business_exit_pages_24h Session exit pages (top 10) in the last 24 hours',
        '# TYPE business_exit_pages_24h gauge',
        ...snapshot.exitPages24h.map(
          (row) => `business_exit_pages_24h{page="${escapeLabelValue(row.page)}"} ${row.count}`,
        ),
      ].join('\n'),
    );
  }

  if (snapshot.exitPages7d.length > 0) {
    blocks.push(
      [
        '# HELP business_exit_pages_7d Session exit pages (top 10) in the last 7 days',
        '# TYPE business_exit_pages_7d gauge',
        ...snapshot.exitPages7d.map(
          (row) => `business_exit_pages_7d{page="${escapeLabelValue(row.page)}"} ${row.count}`,
        ),
      ].join('\n'),
    );
  }

  if (snapshot.devices24h.length > 0) {
    blocks.push(
      [
        '# HELP business_devices_24h Visits by device type in the last 24 hours',
        '# TYPE business_devices_24h gauge',
        ...snapshot.devices24h.map(
          (row) => `business_devices_24h{device="${escapeLabelValue(row.device)}"} ${row.count}`,
        ),
      ].join('\n'),
    );
  }

  if (snapshot.devices7d.length > 0) {
    blocks.push(
      [
        '# HELP business_devices_7d Visits by device type in the last 7 days',
        '# TYPE business_devices_7d gauge',
        ...snapshot.devices7d.map(
          (row) => `business_devices_7d{device="${escapeLabelValue(row.device)}"} ${row.count}`,
        ),
      ].join('\n'),
    );
  }

  if (snapshot.topDwellPages24h.length > 0) {
    blocks.push(
      [
        '# HELP business_top_dwell_pages_24h Top pages by average time on page in seconds (top 5) in the last 24 hours',
        '# TYPE business_top_dwell_pages_24h gauge',
        ...snapshot.topDwellPages24h.map(
          (row) => `business_top_dwell_pages_24h{page="${escapeLabelValue(row.page)}"} ${row.seconds}`,
        ),
      ].join('\n'),
    );
  }

  if (blocks.length === 0) return '';
  return blocks.join('\n\n') + '\n';
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
      const registryText = await businessRegistry.metrics();
      // Доп. метрики (клики/рефереры/гео/услуги/путь) — вручную, после реестра.
      const extraText = renderExtraBusinessMetricsText(snapshot);
      const text = registryText.trimEnd() + (extraText ? '\n' + extraText : '\n');
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
