import { describe, it, expect, beforeEach, vi } from 'vitest';

const prismaMocks = vi.hoisted(() => ({
  visitFindMany: vi.fn(),
  visitCount: vi.fn(),
  clickGroupBy: vi.fn(),
  clickCount: vi.fn(),
  clickFindMany: vi.fn(),
  orderCount: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    visit: { findMany: prismaMocks.visitFindMany, count: prismaMocks.visitCount },
    clickEvent: {
      groupBy: prismaMocks.clickGroupBy,
      count: prismaMocks.clickCount,
      findMany: prismaMocks.clickFindMany,
    },
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
  topSlices,
  computeConversionRate,
  computeBusinessSnapshot,
  renderExtraBusinessMetricsText,
  escapeLabelValue,
  promMetricsService,
  __resetBusinessMetricsCache,
  type VisitRow,
} from '@/services/promMetricsService';

const NOW = Date.UTC(2026, 7, 19, 12, 0, 0);
const MIN = 60 * 1000;
const HOUR = 60 * 60 * 1000;

// minutesAgo — количество МИНУТ (целое), конвертация внутри хелпера.
function visit(
  id: string,
  ip: string | null,
  minutesAgo: number,
  referer: string | null = null,
  city: string | null = null,
): VisitRow {
  return { id, ip, referer, city, createdAt: new Date(NOW - minutesAgo * MIN) };
}

interface StubDbInput {
  visits: VisitRow[];
  pageViews24h: number;
  events: Array<{ eventType: string; count: number }>;
  leads24h: number;
  phoneClicks12h: number;
  phoneClicks24hMs: number[];
  serviceClicks: Array<{ service: string; count: number }>;
}

function stubDb(input: Partial<StubDbInput>) {
  const {
    visits = [],
    pageViews24h = 0,
    events = [],
    leads24h = 0,
    phoneClicks12h = 0,
    phoneClicks24hMs = [],
    serviceClicks = [],
  } = input;

  prismaMocks.visitFindMany.mockResolvedValue(visits);
  prismaMocks.visitCount.mockImplementation(
    ({ where }: { where: { createdAt: { gte: Date } } }) =>
      where.createdAt.gte.getTime() === NOW - 24 * HOUR ? pageViews24h : 0,
  );
  // Два вызова groupBy: по eventType (все события) и по service (service_click).
  prismaMocks.clickGroupBy.mockImplementation(
    ({ by }: { by: string[] }) => {
      if (by.includes('eventType')) {
        return events.map((e) => ({ eventType: e.eventType, _count: { _all: e.count } }));
      }
      return serviceClicks.map((s) => ({ service: s.service, _count: { _all: s.count } }));
    },
  );
  prismaMocks.clickCount.mockResolvedValue(phoneClicks12h);
  prismaMocks.clickFindMany.mockResolvedValue(
    phoneClicks24hMs.map((ms) => ({ createdAt: new Date(ms) })),
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

describe('topSlices (топ-N без other, ЧТЗ §2.2–2.4)', () => {
  it('сортирует по убыванию count, при равенстве — по алфавиту', () => {
    const rows = topSlices(
      [
        { label: 'b', count: 2 },
        { label: 'a', count: 5 },
        { label: 'c', count: 2 },
      ],
      2,
    );
    expect(rows).toEqual([
      { label: 'a', count: 5 },
      { label: 'b', count: 2 },
    ]);
  });

  it('обрезает до N', () => {
    const rows = topSlices(
      Array.from({ length: 15 }, (_, i) => ({ label: `s${i}`, count: 1 })),
      10,
    );
    expect(rows).toHaveLength(10);
  });

  it('пустой вход → пустой результат', () => {
    expect(topSlices([], 10)).toEqual([]);
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

describe('escapeLabelValue', () => {
  it('экранирует спецсимволы лейблов (спецификация Prometheus)', () => {
    expect(escapeLabelValue('a"b')).toBe('a\\"b');
    expect(escapeLabelValue('a\\b')).toBe('a\\\\b');
    expect(escapeLabelValue('a\nb')).toBe('a\\nb');
  });
});

describe('computeBusinessSnapshot', () => {
  const base = {
    now: NOW,
    pageViews24h: 0,
    pageViews1h: 0,
    leads24h: 0,
    leads1h: 0,
    phoneClicks12h: 0,
    phoneClickTimestamps24h: [] as number[],
  };

  it('пустая БД → нули и без events/топ-серий (empty case)', () => {
    const snap = computeBusinessSnapshot({
      ...base,
      visits: [],
      events24h: [],
      serviceClicks24h: [],
    });
    expect(snap.pageViews24h).toBe(0);
    expect(snap.sessions24h).toBe(0);
    expect(snap.bounceRate24h).toBe(0);
    expect(snap.conversionRate24h).toBe(0);
    expect(snap.events24h).toEqual([]);
    expect(snap.phoneClickTimestamps24h).toEqual([]);
    expect(snap.referralSources24h).toEqual([]);
    expect(snap.geoVisitors24h).toEqual([]);
    expect(snap.serviceClicks24h).toEqual([]);
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
      ...base,
      visits,
      events24h: [
        { eventType: 'click_phone', count: 5 },
        { eventType: 'service_click', count: 2 },
      ],
      serviceClicks24h: [{ service: 'light_vehicle', count: 2 }],
    });

    expect(snap.sessions24h).toBe(2);
    expect(snap.uniqueVisitors24h).toBe(2);
    expect(snap.bounceRate24h).toBeCloseTo(0.5); // 1 из 2 сессий однократная
    expect(snap.avgSessionDurationSeconds24h).toBeCloseTo(10 * 60); // (20мин + 0) / 2 сессии
    expect(snap.conversionRate24h).toBeCloseTo(0); // 0 лидов / 2 сессии
    expect(snap.events24h).toContainEqual({ eventType: 'click_phone', count: 5 });
    expect(snap.events24h).toContainEqual({ eventType: 'service_click', count: 2 });
    expect(snap.serviceClicks24h).toEqual([{ service: 'light_vehicle', count: 2 }]);
  });

  it('источники: считаются только входные визиты (referer ≠ null), топ-10 (ЧТЗ §2.2)', () => {
    const snap = computeBusinessSnapshot({
      ...base,
      visits: [
        visit('1', '1.1.1.1', 10, 'yandex.ru'),
        visit('2', '1.1.1.1', 8, null), // внутренняя навигация — не источник
        visit('3', '2.2.2.2', 7, '(direct)'),
        visit('4', '3.3.3.3', 6, 'google.ru'),
      ],
      events24h: [],
      serviceClicks24h: [],
    });

    expect(snap.referralSources24h).toEqual([
      { source: '(direct)', count: 1 },
      { source: 'google.ru', count: 1 },
      { source: 'yandex.ru', count: 1 },
    ]);
  });

  it('гео: уникальные посетители по городам, null-город → (unknown) (ЧТЗ §2.3)', () => {
    const snap = computeBusinessSnapshot({
      ...base,
      visits: [
        visit('1', '1.1.1.1', 10, 'yandex.ru', 'Moscow'),
        visit('2', '1.1.1.1', 9, null, 'Moscow'), // тот же IP — не новый посетитель
        visit('3', '2.2.2.2', 8, null, 'Moscow'),
        visit('4', '3.3.3.3', 7, null, null), // город не определился
        visit('5', '::ffff:3.3.3.3', 5, null, null), // IPv6-mapped = тот же посетитель
        visit('6', null, 4, null, 'Moscow'), // без IP — не посетитель
      ],
      events24h: [],
      serviceClicks24h: [],
    });

    expect(snap.geoVisitors24h).toEqual([
      { city: 'Moscow', visitors: 2 },
      { city: '(unknown)', visitors: 1 },
    ]);
  });

  it('таймстампы кликов сортируются по возрастанию (ADR-012)', () => {
    const snap = computeBusinessSnapshot({
      ...base,
      visits: [],
      events24h: [],
      serviceClicks24h: [],
      phoneClicks12h: 2,
      phoneClickTimestamps24h: [NOW - 1000, NOW - 5 * HOUR, NOW - 3 * HOUR],
    });
    expect(snap.phoneClicks12h).toBe(2);
    expect(snap.phoneClickTimestamps24h).toEqual([
      NOW - 5 * HOUR,
      NOW - 3 * HOUR,
      NOW - 1000,
    ]);
  });

  it('sessions_active: сессия с активностью ≤ 30 мин назад', () => {
    const snap = computeBusinessSnapshot({
      ...base,
      visits: [visit('1', '1.1.1.1', 29), visit('2', '2.2.2.2', 31)],
      events24h: [],
      serviceClicks24h: [],
    });
    expect(snap.sessionsActive).toBe(1);
  });

  it('сессия, начавшаяся до окна 24ч, но продолжившаяся внутри — учитывается (edge case)', () => {
    // Начало 24ч+10мин назад, последний просмотр 23ч назад.
    const visits = [visit('a1', '7.7.7.7', 1450), visit('a2', '7.7.7.7', 1380)];
    const snap = computeBusinessSnapshot({
      ...base,
      visits,
      events24h: [],
      serviceClicks24h: [],
    });
    expect(snap.sessions24h).toBe(1);
    expect(snap.uniqueVisitors24h).toBe(1); // только визиты внутри окна
  });

  it('лиды без сессий → конверсия 0 (деление на 0)', () => {
    const snap = computeBusinessSnapshot({
      ...base,
      visits: [],
      events24h: [],
      serviceClicks24h: [],
      leads24h: 7,
      leads1h: 2,
    });
    expect(snap.leads24h).toBe(7);
    expect(snap.conversionRate24h).toBe(0);
  });
});

describe('renderExtraBusinessMetricsText (ручной рендер, ЧТЗ §2.1–2.4)', () => {
  function snapshotWith(overrides: Partial<Parameters<typeof renderExtraBusinessMetricsText>[0]>) {
    return {
      sessionsActive: 0,
      pageViews24h: 0,
      pageViews1h: 0,
      uniqueVisitors24h: 0,
      sessions24h: 0,
      avgSessionDurationSeconds24h: 0,
      bounceRate24h: 0,
      leads24h: 0,
      leads1h: 0,
      conversionRate24h: 0,
      events24h: [],
      phoneClicks12h: 0,
      phoneClickTimestamps24h: [],
      referralSources24h: [],
      geoVisitors24h: [],
      serviceClicks24h: [],
      ...overrides,
    } as Parameters<typeof renderExtraBusinessMetricsText>[0];
  }

  it('клики есть → обе метрики телефона в формате ЧТЗ (пример §2.1)', () => {
    const text = renderExtraBusinessMetricsText(
      snapshotWith({
        phoneClicks12h: 1,
        phoneClickTimestamps24h: [1753940520000, 1753969080000],
      }),
    );
    expect(text).toContain(
      '# HELP business_phone_clicks_12h Phone number (tel:) clicks in the last 12 hours',
    );
    expect(text).toContain('# TYPE business_phone_clicks_12h gauge');
    expect(text).toContain('business_phone_clicks_12h 1');
    expect(text).toContain(
      '# HELP business_phone_clicks_event Phone click events (last 24h), one sample per click with exact click timestamp',
    );
    expect(text).toContain('business_phone_clicks_event 1 1753940520000');
    expect(text).toContain('business_phone_clicks_event 1 1753969080000');
  });

  it('кликов нет → метрики телефона не рендерятся', () => {
    const text = renderExtraBusinessMetricsText(snapshotWith({}));
    expect(text).toBe('');
  });

  it('клики только за пределами 12ч → gauge 0, но семплы событий есть', () => {
    const text = renderExtraBusinessMetricsText(
      snapshotWith({ phoneClicks12h: 0, phoneClickTimestamps24h: [NOW - 20 * HOUR] }),
    );
    expect(text).toContain('business_phone_clicks_12h 0');
    expect(text).toContain(`business_phone_clicks_event 1 ${NOW - 20 * HOUR}`);
  });

  it('источники/гео/услуги рендерятся с лейблами', () => {
    const text = renderExtraBusinessMetricsText(
      snapshotWith({
        referralSources24h: [
          { source: 'yandex.ru', count: 7 },
          { source: '(direct)', count: 3 },
        ],
        geoVisitors24h: [{ city: 'Moscow', visitors: 12 }],
        serviceClicks24h: [{ service: 'light_vehicle', count: 4 }],
      }),
    );
    expect(text).toContain('business_referral_sources_24h{source="yandex.ru"} 7');
    expect(text).toContain('business_referral_sources_24h{source="(direct)"} 3');
    expect(text).toContain('business_geo_visitors_24h{city="Moscow"} 12');
    expect(text).toContain('business_service_clicks_24h{service="light_vehicle"} 4');
  });

  it('нет данных разреза → блок разреза не рендерится вовсе', () => {
    const text = renderExtraBusinessMetricsText(
      snapshotWith({ phoneClickTimestamps24h: [NOW - HOUR] }),
    );
    expect(text).toContain('business_phone_clicks_12h');
    expect(text).not.toContain('business_referral_sources_24h');
    expect(text).not.toContain('business_geo_visitors_24h');
    expect(text).not.toContain('business_service_clicks_24h');
  });

  it('спецсимволы в лейблах экранируются (edge case)', () => {
    const text = renderExtraBusinessMetricsText(
      snapshotWith({
        referralSources24h: [{ source: 'we"ird\\name', count: 1 }],
      }),
    );
    expect(text).toContain('business_referral_sources_24h{source="we\\"ird\\\\name"} 1');
  });
});

describe('promMetricsService.getTrackingMetricsText', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __resetBusinessMetricsCache();
  });

  it('отдаёт Prometheus text с business_*-метриками (happy path)', async () => {
    stubDb({
      visits: [
        visit('1', '1.1.1.1', 60, 'yandex.ru', 'Moscow'),
        visit('2', '2.2.2.2', 30, '(direct)', null),
      ],
      pageViews24h: 2,
      events: [{ eventType: 'click_phone', count: 3 }],
      leads24h: 1,
      phoneClicks12h: 2,
      phoneClicks24hMs: [NOW - 3 * HOUR, NOW - 30 * MIN],
      serviceClicks: [{ service: 'light_vehicle', count: 2 }],
    });

    const text = await promMetricsService.getTrackingMetricsText(NOW);

    expect(text).toContain('# TYPE business_page_views_24h gauge');
    expect(text).toContain('business_page_views_24h 2');
    expect(text).toContain('business_leads_24h 1');
    expect(text).toContain('business_events_24h{event_type="click_phone"} 3');
    expect(text).toContain('business_sessions_24h 2');
    expect(text).toContain('business_conversion_rate_24h 0.5');
    // Новые метрики (ЧТЗ «Полные бизнес-метрики»).
    expect(text).toContain('business_phone_clicks_12h 2');
    expect(text).toContain(`business_phone_clicks_event 1 ${NOW - 3 * HOUR}`);
    expect(text).toContain(`business_phone_clicks_event 1 ${NOW - 30 * MIN}`);
    expect(text).toContain('business_referral_sources_24h{source="yandex.ru"} 1');
    expect(text).toContain('business_referral_sources_24h{source="(direct)"} 1');
    expect(text).toContain('business_geo_visitors_24h{city="Moscow"} 1');
    expect(text).toContain('business_geo_visitors_24h{city="(unknown)"} 1');
    expect(text).toContain('business_service_clicks_24h{service="light_vehicle"} 2');
  });

  it('нет данных новых разрезов → их метрики отсутствуют в выдаче (empty case)', async () => {
    stubDb({
      visits: [visit('1', null, 60)], // без IP: нет ни источника, ни гео
      pageViews24h: 1,
    });

    const text = await promMetricsService.getTrackingMetricsText(NOW);

    expect(text).toContain('business_page_views_24h 1');
    expect(text).not.toContain('business_phone_clicks_12h');
    expect(text).not.toContain('business_phone_clicks_event');
    expect(text).not.toContain('business_referral_sources_24h');
    expect(text).not.toContain('business_geo_visitors_24h');
    expect(text).not.toContain('business_service_clicks_24h');
  });

  it('кэширует результат на 60 с: БД не дёргается повторно (ЧТЗ §6)', async () => {
    stubDb({ visits: [visit('1', '1.1.1.1', 60)], pageViews24h: 1 });

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
