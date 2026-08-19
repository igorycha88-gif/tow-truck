import { describe, it, expect, beforeEach, vi } from 'vitest';

const prismaMocks = vi.hoisted(() => ({
  visitFindMany: vi.fn(),
  visitCount: vi.fn(),
  clickGroupBy: vi.fn(),
  orderCount: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    visit: { findMany: prismaMocks.visitFindMany, count: prismaMocks.visitCount },
    clickEvent: { groupBy: prismaMocks.clickGroupBy },
    order: { count: prismaMocks.orderCount },
  },
  pingDb: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { logger } from '@/lib/logger';
import {
  sessionizeVisits,
  topNWithOther,
  computeConversionRate,
  computeBusinessSnapshot,
  promMetricsService,
  __resetBusinessMetricsCache,
  type VisitRow,
} from '@/services/promMetricsService';

const NOW = Date.UTC(2026, 7, 19, 12, 0, 0);
const MIN = 60 * 1000;
const HOUR = 60 * 60 * 1000;

// minutesAgo — количество МИНУТ (целое), конвертация внутри хелпера.
function visit(id: string, ip: string | null, minutesAgo: number): VisitRow {
  return { id, ip, createdAt: new Date(NOW - minutesAgo * MIN) };
}

function stubDb(visits: VisitRow[], pageViews24h: number, clicks: Array<{ page: string; count: number }>, leads24h: number) {
  prismaMocks.visitFindMany.mockResolvedValue(visits);
  prismaMocks.visitCount.mockImplementation(
    ({ where }: { where: { createdAt: { gte: Date } } }) =>
      where.createdAt.gte.getTime() === NOW - 24 * HOUR ? pageViews24h : 0,
  );
  prismaMocks.clickGroupBy.mockResolvedValue(
    clicks.map((c) => ({ page: c.page, _count: { _all: c.count } })),
  );
  prismaMocks.orderCount.mockImplementation(
    ({ where }: { where: { createdAt: { gte: Date } } }) =>
      where.createdAt.gte.getTime() === NOW - 24 * HOUR ? leads24h : 0,
  );
}

describe('sessionizeVisits', () => {
  it('одиночный визит → одна сессия с одним просмотром', () => {
    const sessions = sessionizeVisits([visit('1', '1.1.1.1', 60)]);
    expect(sessions).toEqual([{ first: NOW - 60 * MIN, last: NOW - 60 * MIN, views: 1 }]);
  });

  it('визиты одного ip без разрыва > 30 мин → одна сессия (happy path)', () => {
    const sessions = sessionizeVisits([
      visit('1', '1.1.1.1', 120),
      visit('2', '1.1.1.1', 110),
      visit('3', '1.1.1.1', 91), // gap 19 мин от предыдущего
    ]);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].views).toBe(3);
    expect(sessions[0].last).toBe(NOW - 91 * MIN);
  });

  it('разрыв ровно 30 мин остаётся одной сессией, больше — двумя (edge case)', () => {
    const boundary = sessionizeVisits([visit('1', '1.1.1.1', 90), visit('2', '1.1.1.1', 60)]);
    expect(boundary).toHaveLength(1);

    const split = sessionizeVisits([visit('1', '1.1.1.1', 91), visit('2', '1.1.1.1', 60)]);
    expect(split).toHaveLength(2);
  });

  it('разные ip → разные сессии', () => {
    const sessions = sessionizeVisits([visit('1', '1.1.1.1', 10), visit('2', '2.2.2.2', 10)]);
    expect(sessions).toHaveLength(2);
  });

  it('визиты без ip — отдельные одиночные сессии', () => {
    const sessions = sessionizeVisits([visit('1', null, 10), visit('2', null, 5)]);
    expect(sessions).toHaveLength(2);
  });

  it('IPv6-mapped IPv4 группируется с обычным IPv4 (нормализация IP)', () => {
    const sessions = sessionizeVisits([
      visit('1', '1.2.3.4', 20),
      visit('2', '::ffff:1.2.3.4', 10),
    ]);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].views).toBe(2);
  });

  it('неотсортированный вход обрабатывается корректно', () => {
    const sessions = sessionizeVisits([visit('2', '1.1.1.1', 10), visit('1', '1.1.1.1', 20)]);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].views).toBe(2);
    expect(sessions[0].first).toBe(NOW - 20 * MIN);
    expect(sessions[0].last).toBe(NOW - 10 * MIN);
  });
});

describe('topNWithOther (кардинальность топ-N + other)', () => {
  it('меньше N → отсортированный топ без other', () => {
    const rows = topNWithOther(
      [
        { label: 'a', count: 1 },
        { label: 'b', count: 5 },
      ],
      5,
    );
    expect(rows).toEqual([
      { label: 'b', count: 5 },
      { label: 'a', count: 1 },
    ]);
  });

  it('больше N → N значений + other, сумма сохраняется', () => {
    const input = Array.from({ length: 10 }, (_, i) => ({ label: `e${i}`, count: i + 1 }));
    const rows = topNWithOther(input, 3);
    expect(rows).toHaveLength(4);
    expect(rows[3]).toEqual({ label: 'other', count: 1 + 2 + 3 + 4 + 5 + 6 + 7 });
    const sum = rows.reduce((s, r) => s + r.count, 0);
    expect(sum).toBe(input.reduce((s, r) => s + r.count, 0));
  });

  it('пустой вход → пустой результат (empty case)', () => {
    expect(topNWithOther([], 5)).toEqual([]);
  });
});

describe('computeConversionRate', () => {
  it('считает конверсию leads/sessions', () => {
    expect(computeConversionRate(3, 12)).toBeCloseTo(0.25);
  });

  it('деление на 0 → 0 (ЧТЗ §4.1)', () => {
    expect(computeConversionRate(5, 0)).toBe(0);
  });
});

describe('computeBusinessSnapshot', () => {
  it('пустая БД → нули и без events-серий (empty case)', () => {
    const snap = computeBusinessSnapshot({
      now: NOW,
      visits: [],
      clicks24h: [],
      pageViews24h: 0,
      pageViews1h: 0,
      leads24h: 0,
      leads1h: 0,
    });
    expect(snap.pageViews24h).toBe(0);
    expect(snap.sessions24h).toBe(0);
    expect(snap.bounceRate24h).toBe(0);
    expect(snap.conversionRate24h).toBe(0);
    expect(snap.events24h).toEqual([]);
  });

  it('считает окна, сессии, bounce, длительность, конверсию (happy path)', () => {
    // ip A: сессия 3 просмотра (13ч20м→13ч назад), ip B: 1 просмотр час назад.
    const visits = [
      visit('a1', '9.9.9.9', 760), // 13ч20м назад
      visit('a2', '9.9.9.9', 770), // 13ч10м назад
      visit('a3', '9.9.9.9', 780), // 13ч назад
      visit('b1', '8.8.8.8', 60),
    ];
    const snap = computeBusinessSnapshot({
      now: NOW,
      visits,
      clicks24h: [
        { page: 'home', count: 5 },
        { page: 'header', count: 2 },
      ],
      pageViews24h: 4,
      pageViews1h: 1,
      leads24h: 1,
      leads1h: 0,
    });

    expect(snap.sessions24h).toBe(2);
    expect(snap.uniqueVisitors24h).toBe(2);
    expect(snap.bounceRate24h).toBeCloseTo(0.5); // 1 из 2 сессий однократная
    expect(snap.avgSessionDurationSeconds24h).toBeCloseTo(10 * 60); // (20мин + 0) / 2 сессии
    expect(snap.conversionRate24h).toBeCloseTo(0.5); // 1 лид / 2 сессии
    expect(snap.events24h).toContainEqual({ eventType: 'click_home', count: 5 });
    expect(snap.events24h).toContainEqual({ eventType: 'click_header', count: 2 });
  });

  it('sessions_active: сессия с активностью ≤ 30 мин назад', () => {
    const snap = computeBusinessSnapshot({
      now: NOW,
      visits: [visit('1', '1.1.1.1', 29), visit('2', '2.2.2.2', 31)],
      clicks24h: [],
      pageViews24h: 2,
      pageViews1h: 2,
      leads24h: 0,
      leads1h: 0,
    });
    expect(snap.sessionsActive).toBe(1);
  });

  it('сессия, начавшаяся до окна 24ч, но продолжившаяся внутри — учитывается (edge case)', () => {
    // Начало 24ч+10мин назад, последний просмотр 23ч назад.
    const visits = [visit('a1', '7.7.7.7', 1450), visit('a2', '7.7.7.7', 1380)];
    const snap = computeBusinessSnapshot({
      now: NOW,
      visits,
      clicks24h: [],
      pageViews24h: 1,
      pageViews1h: 0,
      leads24h: 0,
      leads1h: 0,
    });
    expect(snap.sessions24h).toBe(1);
    expect(snap.uniqueVisitors24h).toBe(1); // только визиты внутри окна
  });

  it('лиды без сессий → конверсия 0 (деление на 0)', () => {
    const snap = computeBusinessSnapshot({
      now: NOW,
      visits: [],
      clicks24h: [],
      pageViews24h: 0,
      pageViews1h: 0,
      leads24h: 7,
      leads1h: 2,
    });
    expect(snap.leads24h).toBe(7);
    expect(snap.conversionRate24h).toBe(0);
  });
});

describe('promMetricsService.getTrackingMetricsText', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __resetBusinessMetricsCache();
  });

  it('отдаёт Prometheus text с business_*-метриками (happy path)', async () => {
    stubDb(
      [visit('1', '1.1.1.1', 60), visit('2', '2.2.2.2', 30)],
      2,
      [{ page: 'home', count: 3 }],
      1,
    );

    const text = await promMetricsService.getTrackingMetricsText(NOW);

    expect(text).toContain('# TYPE business_page_views_24h gauge');
    expect(text).toContain('business_page_views_24h 2');
    expect(text).toContain('business_leads_24h 1');
    expect(text).toContain('business_events_24h{event_type="click_home"} 3');
    expect(text).toContain('business_sessions_24h 2');
    expect(text).toContain('business_conversion_rate_24h 0.5');
    // Метрики несуществующих разрезов не отдаются (ЧТЗ §4.1).
    expect(text).not.toContain('business_referral_sources_24h');
    expect(text).not.toContain('business_geo_visitors_24h');
    expect(text).not.toContain('business_service_clicks_24h');
  });

  it('кэширует результат на 60 с: БД не дёргается повторно (ЧТЗ §6)', async () => {
    stubDb([visit('1', '1.1.1.1', 60)], 1, [], 0);

    await promMetricsService.getTrackingMetricsText(NOW);
    await promMetricsService.getTrackingMetricsText(NOW + 30_000);
    expect(prismaMocks.visitFindMany).toHaveBeenCalledTimes(1);

    await promMetricsService.getTrackingMetricsText(NOW + 61_000);
    expect(prismaMocks.visitFindMany).toHaveBeenCalledTimes(2);
  });

  it('при ошибке БД логирует и пробрасывает исключение (error case)', async () => {
    prismaMocks.visitFindMany.mockRejectedValue(new Error('DB down'));

    await expect(promMetricsService.getTrackingMetricsText(NOW)).rejects.toThrow('DB down');
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Failed to render business metrics'),
      expect.objectContaining({ operation: 'promMetricsService.getTrackingMetricsText' }),
    );
  });
});
