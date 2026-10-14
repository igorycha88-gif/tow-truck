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
  computeTransitions,
  computeEntryFlows,
  computeDevices,
  computeTopDwellPages,
  computeReturningVisitors,
  computeAvgTimeOnPageSeconds,
  renderExtraBusinessMetricsText,
  escapeLabelValue,
  promMetricsService,
  __resetBusinessMetricsCache,
  type VisitRow,
} from '@/services/promMetricsService';

const NOW = Date.UTC(2026, 7, 19, 12, 0, 0);
const MIN = 60 * 1000;
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

type VisitExtra = Partial<
  Pick<VisitRow, 'page' | 'fromPage' | 'sessionId' | 'visitorId' | 'device' | 'dwellMs'>
>;

// minutesAgo — количество МИНУТ (целое), конвертация внутри хелпера.
function visit(
  id: string,
  ip: string | null,
  minutesAgo: number,
  referer: string | null = null,
  city: string | null = null,
  extra: VisitExtra = {},
): VisitRow {
  return { id, ip, referer, city, createdAt: new Date(NOW - minutesAgo * MIN), ...extra };
}

interface StubDbInput {
  visits: VisitRow[];
  pageViews24h: number;
  pageViews1h: number;
  pageViews7d: number;
  events: Array<{ eventType: string; count: number }>;
  leads24h: number;
  leads1h: number;
  leads7d: number;
  phoneClicks12h: number;
  phoneClicks7d: number;
  phoneClicks24hMs: number[];
  whatsappClicks12h: number;
  whatsappClicks7d: number;
  whatsappClicks24hMs: number[];
  serviceClicks: Array<{ service: string; count: number }>;
  contactSessions24h: string[];
  contactSessions7d: string[];
  seenBeforeVisitorIds: string[];
}

function stubDb(input: Partial<StubDbInput>) {
  const {
    visits = [],
    pageViews24h = 0,
    pageViews1h = 0,
    pageViews7d = 0,
    events = [],
    leads24h = 0,
    leads1h = 0,
    leads7d = 0,
    phoneClicks12h = 0,
    phoneClicks7d = 0,
    phoneClicks24hMs = [],
    whatsappClicks12h = 0,
    whatsappClicks7d = 0,
    whatsappClicks24hMs = [],
    serviceClicks = [],
    contactSessions24h = [],
    contactSessions7d = [],
    seenBeforeVisitorIds = [],
  } = input;

  // Основной запрос визитов (7д+lookback) и seen-before-запросы (where.visitorId).
  prismaMocks.visitFindMany.mockImplementation(
    ({ where }: { where: Record<string, unknown> }) => {
      if (where && 'visitorId' in where) {
        return seenBeforeVisitorIds.map((vid) => ({ visitorId: vid }));
      }
      return visits;
    },
  );
  prismaMocks.visitCount.mockImplementation(
    ({ where }: { where: { createdAt: { gte: Date } } }) => {
      const gte = where.createdAt.gte.getTime();
      if (gte === NOW - 24 * HOUR) return pageViews24h;
      if (gte === NOW - HOUR) return pageViews1h;
      if (gte === NOW - 7 * DAY) return pageViews7d;
      return 0;
    },
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
  prismaMocks.clickCount.mockImplementation(
    ({ where }: { where: { eventType: string; createdAt: { gte: Date } } }) => {
      const gte = where.createdAt.gte.getTime();
      if (where.eventType === 'click_phone') {
        if (gte === NOW - 12 * HOUR) return phoneClicks12h;
        return phoneClicks7d;
      }
      if (gte === NOW - 12 * HOUR) return whatsappClicks12h;
      return whatsappClicks7d;
    },
  );
  prismaMocks.clickFindMany.mockImplementation(
    ({ where, select }: { where: Record<string, unknown>; select?: Record<string, unknown> }) => {
      // Контакт-сессии воронки (distinct sessionId, ADR-014).
      if (select && 'sessionId' in select) {
        const gte = (where.createdAt as { gte: Date }).gte.getTime();
        const ids = gte === NOW - 24 * HOUR ? contactSessions24h : contactSessions7d;
        return ids.map((sid) => ({ sessionId: sid }));
      }
      if (where.eventType === 'click_whatsapp') {
        return whatsappClicks24hMs.map((ms) => ({ createdAt: new Date(ms) }));
      }
      return phoneClicks24hMs.map((ms) => ({ createdAt: new Date(ms) }));
    },
  );
  prismaMocks.orderCount.mockImplementation(
    ({ where }: { where: { createdAt: { gte: Date } } }) => {
      const gte = where.createdAt.gte.getTime();
      if (gte === NOW - 24 * HOUR) return leads24h;
      if (gte === NOW - HOUR) return leads1h;
      if (gte === NOW - 7 * DAY) return leads7d;
      return 0;
    },
  );
}

describe('sessionizeVisits', () => {
  it('одиночный визит → одна сессия с одним просмотром', () => {
    const sessions = sessionizeVisits([visit('1', '1.1.1.1', 60)]);
    expect(sessions).toEqual([
      {
        first: NOW - 60 * MIN,
        last: NOW - 60 * MIN,
        views: 1,
        firstPage: 'home',
        lastPage: 'home',
        key: 'ip:1.1.1.1',
      },
    ]);
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

  // ── v2 (ADR-014): сессии по sessionId ────────────────────────────────

  it('v2: sessionId главнее ip — один ip с двумя вкладками = две сессии', () => {
    const sessions = sessionizeVisits([
      visit('1', '1.1.1.1', 60, null, null, { sessionId: 'sid-a', page: 'home' }),
      visit('2', '1.1.1.1', 50, null, null, { sessionId: 'sid-b', page: 'home' }),
    ]);
    expect(sessions).toHaveLength(2);
    expect(sessions.map((s) => s.key).sort()).toEqual(['sid:sid-a', 'sid:sid-b']);
  });

  it('v2: смена IP внутри сессии не рвёт её (мобильные сети, ADR-014)', () => {
    const sessions = sessionizeVisits([
      visit('1', '5.5.5.5', 60, null, null, { sessionId: 'sid-a', page: 'home' }),
      visit('2', '6.6.6.6', 50, null, null, { sessionId: 'sid-a', page: 'uslugi/x' }),
    ]);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].views).toBe(2);
    expect(sessions[0].firstPage).toBe('home');
    expect(sessions[0].lastPage).toBe('uslugi/x');
  });

  it('v2: легаси-визиты без sessionId продолжают группироваться по ip', () => {
    const sessions = sessionizeVisits([
      visit('1', '1.1.1.1', 60),
      visit('2', '1.1.1.1', 50, null, null, { sessionId: 'sid-b' }),
      visit('3', '1.1.1.1', 40),
    ]);
    expect(sessions).toHaveLength(2); // ip-сессия (2 просмотра) + sid-сессия
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

// ── v2 (ADR-014): чистые функции пути клиента ──────────────────────────

describe('computeTransitions (from→to, ADR-014)', () => {
  it('считает пары переходов, сортирует по убыванию (happy path)', () => {
    const rows = computeTransitions([
      visit('1', null, 60, null, null, { page: 'uslugi/a', fromPage: 'home' }),
      visit('2', null, 50, null, null, { page: 'uslugi/b', fromPage: 'home' }),
      visit('3', null, 40, null, null, { page: 'uslugi/a', fromPage: 'home' }),
    ]);
    expect(rows).toEqual([{ from: 'home', to: 'uslugi/a', count: 2 }, { from: 'home', to: 'uslugi/b', count: 1 }]);
  });

  it('входные просмотры (fromPage=null) не считаются переходом (edge case)', () => {
    const rows = computeTransitions([visit('1', null, 60, null, null, { page: 'home', fromPage: null })]);
    expect(rows).toEqual([]);
  });

  it('больше 10 пар → топ-10 + other (кардинальность)', () => {
    const visits = Array.from({ length: 15 }, (_, i) =>
      visit(String(i), null, 60 - i, null, null, { page: `p${i}`, fromPage: 'home' }),
    );
    const rows = computeTransitions(visits);
    expect(rows).toHaveLength(11);
    expect(rows[rows.length - 1]).toEqual({ from: 'other', to: 'other', count: 5 });
  });
});

describe('computeEntryFlows (источник × посадочная, ADR-014)', () => {
  it('группирует входные визиты по source+landing (happy path)', () => {
    const rows = computeEntryFlows([
      visit('1', null, 60, 'yandex.ru', null, { page: 'uslugi/a', fromPage: null }),
      visit('2', null, 50, 'yandex.ru', null, { page: 'home', fromPage: null }),
      visit('3', null, 40, 'yandex.ru', null, { page: 'uslugi/a', fromPage: null }),
    ]);
    expect(rows[0]).toEqual({ source: 'yandex.ru', landing: 'uslugi/a', count: 2 });
    expect(rows).toContainEqual({ source: 'yandex.ru', landing: 'home', count: 1 });
  });

  it('внутренние визиты без referer не попадают (edge case)', () => {
    expect(computeEntryFlows([visit('1', null, 60, null, null, { page: 'home' })])).toEqual([]);
  });
});

describe('computeDevices (ADR-014)', () => {
  it('группирует по device, null → unknown', () => {
    const rows = computeDevices([
      visit('1', null, 60, null, null, { device: 'mobile' }),
      visit('2', null, 50, null, null, { device: 'mobile' }),
      visit('3', null, 40, null, null, { device: 'desktop' }),
      visit('4', null, 30, null, null, { device: null }),
    ]);
    expect(rows).toEqual([
      { device: 'mobile', count: 2 },
      { device: 'desktop', count: 1 },
      { device: 'unknown', count: 1 },
    ]);
  });
});

describe('computeTopDwellPages (ADR-014)', () => {
  it('среднее время на странице в секундах, топ-5 (happy path)', () => {
    const rows = computeTopDwellPages([
      visit('1', null, 60, null, null, { page: 'a', dwellMs: 10_000 }),
      visit('2', null, 50, null, null, { page: 'a', dwellMs: 20_000 }),
      visit('3', null, 40, null, null, { page: 'b', dwellMs: 90_000 }),
    ]);
    expect(rows).toEqual([
      { page: 'b', seconds: 90 },
      { page: 'a', seconds: 15 },
    ]);
  });

  it('просмотры без dwellMs игнорируются (edge case)', () => {
    expect(computeTopDwellPages([visit('1', null, 60, null, null, { page: 'a', dwellMs: null })])).toEqual([]);
  });
});

describe('computeReturningVisitors (ADR-014)', () => {
  it('visitorId в окне, который был до окна → возвращающийся', () => {
    const windowVisits = [
      visit('1', null, 60, null, null, { visitorId: 'vid-1' }),
      visit('2', null, 50, null, null, { visitorId: 'vid-2' }),
      visit('3', null, 40, null, null, { visitorId: 'vid-1' }), // дубль — не считается дважды
    ];
    expect(computeReturningVisitors(windowVisits, new Set(['vid-1']))).toBe(1);
  });

  it('нет пересечений → 0 (empty case)', () => {
    expect(computeReturningVisitors([visit('1', null, 60, null, null, { visitorId: 'vid-9' })], new Set())).toBe(0);
  });
});

describe('computeAvgTimeOnPageSeconds (ADR-014)', () => {
  it('среднее по просмотрам с dwellMs, округление до 0.1 с', () => {
    const avg = computeAvgTimeOnPageSeconds([
      visit('1', null, 60, null, null, { dwellMs: 5_000 }),
      visit('2', null, 50, null, null, { dwellMs: 8_000 }),
      visit('3', null, 40, null, null, { dwellMs: null }),
    ]);
    expect(avg).toBe(6.5);
  });

  it('нет данных → 0', () => {
    expect(computeAvgTimeOnPageSeconds([])).toBe(0);
  });
});

describe('computeBusinessSnapshot', () => {
  const base = {
    now: NOW,
    pageViews24h: 0,
    pageViews1h: 0,
    pageViews7d: 0,
    leads24h: 0,
    leads1h: 0,
    leads7d: 0,
    phoneClicks12h: 0,
    phoneClicks7d: 0,
    phoneClickTimestamps24h: [] as number[],
    whatsappClicks12h: 0,
    whatsappClicks7d: 0,
    whatsappClickTimestamps24h: [] as number[],
    contactClickSessionIds24h: [] as string[],
    contactClickSessionIds7d: [] as string[],
    visitorsSeenBefore24h: [] as string[],
    visitorsSeenBefore7d: [] as string[],
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
    // v2: путь клиента тоже пуст.
    expect(snap.landingPages24h).toEqual([]);
    expect(snap.transitions24h).toEqual([]);
    expect(snap.entryFlows24h).toEqual([]);
    expect(snap.exitPages24h).toEqual([]);
    expect(snap.devices24h).toEqual([]);
    expect(snap.topDwellPages24h).toEqual([]);
    expect(snap.whatsappClickTimestamps24h).toEqual([]);
    expect(snap.funnel24h).toEqual({ visit: 0, content_view: 0, contact_click: 0, lead: 0 });
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

  // ── v2 (ADR-014): путь, воронка, устройства, dwell ───────────────────

  it('v2: landing/exit/переходы/глубина по sessionId-сессии (happy path)', () => {
    // Сессия: home (вход с yandex) → uslugi/a → uslugi/b (выход), все < 24ч.
    const snap = computeBusinessSnapshot({
      ...base,
      visits: [
        visit('1', '1.1.1.1', 60, 'yandex.ru', null, { sessionId: 'sid-a', page: 'home', fromPage: null }),
        visit('2', '1.1.1.1', 50, null, null, { sessionId: 'sid-a', page: 'uslugi/a', fromPage: 'home' }),
        visit('3', '1.1.1.1', 40, null, null, { sessionId: 'sid-a', page: 'uslugi/b', fromPage: 'uslugi/a' }),
      ],
      events24h: [],
      serviceClicks24h: [],
    });

    expect(snap.landingPages24h).toEqual([{ page: 'home', count: 1 }]);
    expect(snap.exitPages24h).toEqual([{ page: 'uslugi/b', count: 1 }]);
    expect(snap.transitions24h).toEqual([
      { from: 'home', to: 'uslugi/a', count: 1 },
      { from: 'uslugi/a', to: 'uslugi/b', count: 1 },
    ]);
    expect(snap.entryFlows24h).toEqual([{ source: 'yandex.ru', landing: 'home', count: 1 }]);
    expect(snap.avgPagesPerSession24h).toBe(3);
  });

  it('v2: воронка visit → content_view → contact_click → lead (happy path)', () => {
    const snap = computeBusinessSnapshot({
      ...base,
      visits: [
        // Сессия A: вход home → uslugi/a, клик по телефону (sid-a в contact).
        visit('1', '1.1.1.1', 60, null, null, { sessionId: 'sid-a', page: 'home', fromPage: null }),
        visit('2', '1.1.1.1', 50, null, null, { sessionId: 'sid-a', page: 'uslugi/a', fromPage: 'home' }),
        // Сессия B: bounce на home.
        visit('3', '2.2.2.2', 30, null, null, { sessionId: 'sid-b', page: 'home', fromPage: null }),
      ],
      events24h: [],
      serviceClicks24h: [],
      leads24h: 1,
      contactClickSessionIds24h: ['sid-a', 'sid-unknown'], // sid-unknown не входит в сессии окна
    });

    expect(snap.funnel24h).toEqual({ visit: 2, content_view: 1, contact_click: 1, lead: 1 });
  });

  it('v2: время на странице и топ-dwell (happy path)', () => {
    const snap = computeBusinessSnapshot({
      ...base,
      visits: [
        visit('1', null, 60, null, null, { sessionId: 'sid-a', page: 'home', dwellMs: 30_000 }),
        visit('2', null, 50, null, null, { sessionId: 'sid-a', page: 'uslugi/a', dwellMs: 60_000 }),
      ],
      events24h: [],
      serviceClicks24h: [],
    });
    expect(snap.avgTimeOnPageSeconds24h).toBe(45);
    expect(snap.topDwellPages24h).toEqual([
      { page: 'uslugi/a', seconds: 60 },
      { page: 'home', seconds: 30 },
    ]);
  });

  it('v2: устройства и вернувшиеся по visitorId (happy path)', () => {
    const snap = computeBusinessSnapshot({
      ...base,
      visits: [
        visit('1', '1.1.1.1', 60, null, null, {
          sessionId: 'sid-a', visitorId: 'vid-1', device: 'mobile', page: 'home',
        }),
        visit('2', '2.2.2.2', 50, null, null, {
          sessionId: 'sid-b', visitorId: 'vid-2', device: 'desktop', page: 'home',
        }),
      ],
      events24h: [],
      serviceClicks24h: [],
      visitorsSeenBefore24h: ['vid-1'],
    });
    expect(snap.devices24h).toEqual([
      { device: 'desktop', count: 1 },
      { device: 'mobile', count: 1 },
    ]);
    expect(snap.visitorsReturning24h).toBe(1);
    // Уникальные посетители v2 — по visitorId (главнее ip).
    expect(snap.uniqueVisitors24h).toBe(2);
  });

  it('v2: окно 7д считается отдельно от 24ч (визит 3-дневной давности)', () => {
    const snap = computeBusinessSnapshot({
      ...base,
      visits: [
        visit('old', '1.1.1.1', 3 * 24 * 60, null, null, { sessionId: 'sid-old', page: 'uslugi/a' }),
      ],
      events24h: [],
      serviceClicks24h: [],
      leads7d: 1,
    });
    expect(snap.sessions24h).toBe(0);
    expect(snap.sessions7d).toBe(1);
    expect(snap.conversionRate7d).toBe(1);
    expect(snap.landingPages7d).toEqual([{ page: 'uslugi/a', count: 1 }]);
  });
});

describe('renderExtraBusinessMetricsText (ручной рендер, ЧТЗ §2.1–2.4; ADR-014)', () => {
  function snapshotWith(overrides: Partial<Parameters<typeof renderExtraBusinessMetricsText>[0]>) {
    return {
      sessionsActive: 0,
      pageViews24h: 0,
      pageViews1h: 0,
      pageViews7d: 0,
      uniqueVisitors24h: 0,
      uniqueVisitors7d: 0,
      sessions24h: 0,
      sessions7d: 0,
      avgSessionDurationSeconds24h: 0,
      avgSessionDurationSeconds7d: 0,
      bounceRate24h: 0,
      bounceRate7d: 0,
      leads24h: 0,
      leads1h: 0,
      leads7d: 0,
      conversionRate24h: 0,
      conversionRate7d: 0,
      events24h: [],
      phoneClicks12h: 0,
      phoneClicks7d: 0,
      phoneClickTimestamps24h: [],
      referralSources24h: [],
      geoVisitors24h: [],
      serviceClicks24h: [],
      landingPages24h: [],
      landingPages7d: [],
      transitions24h: [],
      transitions7d: [],
      entryFlows24h: [],
      exitPages24h: [],
      exitPages7d: [],
      devices24h: [],
      devices7d: [],
      visitorsReturning24h: 0,
      visitorsReturning7d: 0,
      whatsappClicks12h: 0,
      whatsappClicks7d: 0,
      whatsappClickTimestamps24h: [],
      avgPagesPerSession24h: 0,
      avgPagesPerSession7d: 0,
      avgTimeOnPageSeconds24h: 0,
      avgTimeOnPageSeconds7d: 0,
      topDwellPages24h: [],
      funnel24h: { visit: 0, content_view: 0, contact_click: 0, lead: 0 },
      funnel7d: { visit: 0, content_view: 0, contact_click: 0, lead: 0 },
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

  // ── v2 (ADR-014) ─────────────────────────────────────────────────────

  it('v2: WhatsApp-события рендерятся с timestamp', () => {
    const text = renderExtraBusinessMetricsText(
      snapshotWith({ whatsappClickTimestamps24h: [NOW - HOUR, NOW - 2 * HOUR] }),
    );
    expect(text).toContain('# TYPE business_whatsapp_clicks_event gauge');
    expect(text).toContain(`business_whatsapp_clicks_event 1 ${NOW - HOUR}`);
    expect(text).toContain(`business_whatsapp_clicks_event 1 ${NOW - 2 * HOUR}`);
  });

  it('v2: landing/переходы/entry_flows/exit/устройства/топ-dwell с лейблами', () => {
    const text = renderExtraBusinessMetricsText(
      snapshotWith({
        landingPages24h: [{ page: 'home', count: 9 }],
        transitions24h: [{ from: 'home', to: 'uslugi/a', count: 4 }],
        entryFlows24h: [{ source: 'yandex.ru', landing: 'home', count: 6 }],
        exitPages24h: [{ page: 'uslugi/a', count: 2 }],
        devices24h: [{ device: 'mobile', count: 11 }],
        topDwellPages24h: [{ page: 'uslugi/a', seconds: 42.5 }],
      }),
    );
    expect(text).toContain('business_landing_pages_24h{page="home"} 9');
    expect(text).toContain('business_page_transitions_24h{from="home",to="uslugi/a"} 4');
    expect(text).toContain('business_entry_flows_24h{source="yandex.ru",landing="home"} 6');
    expect(text).toContain('business_exit_pages_24h{page="uslugi/a"} 2');
    expect(text).toContain('business_devices_24h{device="mobile"} 11');
    expect(text).toContain('business_top_dwell_pages_24h{page="uslugi/a"} 42.5');
  });

  it('v2: экранирование спецсимволов в паре from→to (edge case)', () => {
    const text = renderExtraBusinessMetricsText(
      snapshotWith({
        transitions24h: [{ from: 'a"b', to: 'c\\d', count: 1 }],
      }),
    );
    expect(text).toContain('business_page_transitions_24h{from="a\\"b",to="c\\\\d"} 1');
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

  it('v2: registry-метрики 7д/воронки/WhatsApp присутствуют в выдаче', async () => {
    stubDb({
      visits: [
        visit('1', '1.1.1.1', 60, null, null, { sessionId: 'sid-a', page: 'uslugi/a', fromPage: 'home' }),
      ],
      pageViews24h: 1,
      pageViews7d: 5,
      leads7d: 2,
      whatsappClicks12h: 3,
      whatsappClicks7d: 7,
      whatsappClicks24hMs: [NOW - HOUR],
      contactSessions24h: ['sid-a'],
    });

    const text = await promMetricsService.getTrackingMetricsText(NOW);

    expect(text).toContain('# TYPE business_page_views_7d gauge');
    expect(text).toContain('business_page_views_7d 5');
    expect(text).toContain('business_leads_7d 2');
    expect(text).toContain('business_whatsapp_clicks_12h 3');
    expect(text).toContain('business_whatsapp_clicks_7d 7');
    expect(text).toContain(`business_whatsapp_clicks_event 1 ${NOW - HOUR}`);
    expect(text).toContain('business_funnel_24h{stage="visit"} 1');
    expect(text).toContain('business_funnel_24h{stage="content_view"} 1');
    expect(text).toContain('business_funnel_24h{stage="contact_click"} 1');
    expect(text).toContain('business_funnel_24h{stage="lead"} 0');
    expect(text).toContain('business_avg_pages_per_session_24h');
    expect(text).toContain('business_avg_time_on_page_24h');
    expect(text).toContain('business_visitors_returning_24h 0');
    expect(text).toContain('business_page_transitions_24h{from="home",to="uslugi/a"} 1');
    expect(text).toContain('business_landing_pages_24h');
  });

  it('нет данных новых разрезов → их метрики отсутствуют в выдаче (empty case)', async () => {
    stubDb({
      visits: [], // ни одной сессии — все срезы пути пусты
      pageViews24h: 1,
    });

    const text = await promMetricsService.getTrackingMetricsText(NOW);

    expect(text).toContain('business_page_views_24h 1');
    expect(text).not.toContain('business_phone_clicks_12h');
    expect(text).not.toContain('business_phone_clicks_event');
    expect(text).not.toContain('business_referral_sources_24h');
    expect(text).not.toContain('business_geo_visitors_24h');
    expect(text).not.toContain('business_service_clicks_24h');
    // v2-срезы без данных тоже не рендерятся (ручной рендер).
    expect(text).not.toContain('business_landing_pages_24h{');
    expect(text).not.toContain('business_page_transitions_24h{');
    expect(text).not.toContain('business_entry_flows_24h{');
    expect(text).not.toContain('business_devices_24h{');
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
