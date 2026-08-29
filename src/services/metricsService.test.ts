import { describe, it, expect, beforeEach, vi } from 'vitest';

const { clickEventCreate, orderCount, clickCount, orderFindMany, clickFindMany, orderGroupBy, visitFindMany, visitCreate } =
  vi.hoisted(() => ({
    clickEventCreate: vi.fn(),
    orderCount: vi.fn(),
    clickCount: vi.fn(),
    orderFindMany: vi.fn(),
    clickFindMany: vi.fn(),
    orderGroupBy: vi.fn(),
    visitFindMany: vi.fn(),
    visitCreate: vi.fn(),
  }));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    clickEvent: {
      create: clickEventCreate,
      count: clickCount,
      findMany: clickFindMany,
    },
    order: {
      count: orderCount,
      findMany: orderFindMany,
      groupBy: orderGroupBy,
    },
    visit: {
      create: visitCreate,
      findMany: visitFindMany,
    },
  },
  pingDb: vi.fn(),
}));

const { loggerMock } = vi.hoisted(() => ({
  loggerMock: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));
vi.mock('@/lib/logger', () => ({ logger: loggerMock }));

import { metricsService } from '@/services/metricsService';

describe('metricsService.createClickEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('создаёт клик по телефону и логирует начало/конец (happy path)', async () => {
    const fake = { id: 'clk1', createdAt: new Date() };
    clickEventCreate.mockResolvedValue(fake);

    const result = await metricsService.createClickEvent({
      eventType: 'click_phone',
      page: 'home',
      referrer: 'yandex.ru',
      ip: '1.1.1.1',
      userAgent: 'Mozilla/5.0',
      city: 'Moscow',
    });

    expect(result).toEqual(fake);
    expect(clickEventCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: 'click_phone',
          page: 'home',
          service: null,
          referer: 'yandex.ru',
          city: 'Moscow',
          ip: '1.1.1.1',
          userAgent: 'Mozilla/5.0',
        }),
      }),
    );
    expect(loggerMock.info).toHaveBeenCalledWith(
      'Creating click event',
      expect.objectContaining({ operation: 'metricsService.createClickEvent' }),
    );
    expect(loggerMock.info).toHaveBeenCalledWith(
      'Click event created',
      expect.objectContaining({ eventId: 'clk1' }),
    );
  });

  it('создаёт service_click со slug услуги (ЧТЗ §2.4)', async () => {
    clickEventCreate.mockResolvedValue({ id: 'clk2', createdAt: new Date() });

    await metricsService.createClickEvent({
      eventType: 'service_click',
      page: 'home',
      service: 'light_vehicle',
      referrer: '(direct)',
    });

    expect(clickEventCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: 'service_click',
          service: 'light_vehicle',
          referer: '(direct)',
        }),
      }),
    );
  });

  it('referrer отсутствует → referer=null; источник-мусор санитизируется в (direct) (edge case)', async () => {
    clickEventCreate.mockResolvedValue({ id: 'clk3', createdAt: new Date() });

    await metricsService.createClickEvent({ eventType: 'click_phone', page: 'contacts' });
    expect(clickEventCreate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ referer: null, city: null, service: null }),
      }),
    );

    await metricsService.createClickEvent({
      eventType: 'click_phone',
      page: 'home',
      referrer: 'https://www.GOOGLE.ru/search',
    });
    expect(clickEventCreate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ referer: 'google.ru' }),
      }),
    );
  });

  it('подставляет null для ip/userAgent, если их нет (edge case)', async () => {
    clickEventCreate.mockResolvedValue({ id: 'x', createdAt: new Date() });
    await metricsService.createClickEvent({ eventType: 'click_phone', page: 'contacts' });
    expect(clickEventCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ page: 'contacts', ip: null, userAgent: null }),
      }),
    );
  });

  it('бросает и логирует ошибку при сбое БД (error case)', async () => {
    clickEventCreate.mockRejectedValue(new Error('DB down'));
    await expect(
      metricsService.createClickEvent({ eventType: 'click_phone', page: 'home' }),
    ).rejects.toThrow('DB down');
    expect(loggerMock.error).toHaveBeenCalledWith(
      'Failed to create click event',
      expect.objectContaining({ operation: 'metricsService.createClickEvent' }),
    );
  });
});

describe('metricsService.createVisit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('создаёт визит с источником и гео, логирует начало/конец (happy path)', async () => {
    const fake = { id: 'vis1', createdAt: new Date() };
    visitCreate.mockResolvedValue(fake);

    const result = await metricsService.createVisit({
      page: 'home',
      referrer: 'yandex.ru',
      ip: '1.1.1.1',
      userAgent: 'Mozilla/5.0',
      city: 'Moscow',
    });

    expect(result).toEqual(fake);
    expect(visitCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          page: 'home',
          referer: 'yandex.ru',
          city: 'Moscow',
          ip: '1.1.1.1',
          userAgent: 'Mozilla/5.0',
        }),
      }),
    );
    expect(loggerMock.info).toHaveBeenCalledWith(
      'Creating visit',
      expect.objectContaining({ operation: 'metricsService.createVisit' }),
    );
    expect(loggerMock.info).toHaveBeenCalledWith(
      'Visit created',
      expect.objectContaining({ visitId: 'vis1' }),
    );
  });

  it('не-входной визит (без referrer) → referer=null (ЧТЗ §2.2, edge case)', async () => {
    visitCreate.mockResolvedValue({ id: 'x', createdAt: new Date() });
    await metricsService.createVisit({ page: 'politika' });
    expect(visitCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ page: 'politika', referer: null, city: null, ip: null, userAgent: null }),
      }),
    );
  });

  it('входной визит с прямым заходом → referer=(direct)', async () => {
    visitCreate.mockResolvedValue({ id: 'y', createdAt: new Date() });
    await metricsService.createVisit({ page: 'home', referrer: '(direct)' });
    expect(visitCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ referer: '(direct)' }),
      }),
    );
  });

  it('бросает и логирует ошибку при сбое БД (error case)', async () => {
    visitCreate.mockRejectedValue(new Error('DB down'));
    await expect(metricsService.createVisit({ page: 'home' })).rejects.toThrow('DB down');
    expect(loggerMock.error).toHaveBeenCalledWith(
      'Failed to create visit',
      expect.objectContaining({ operation: 'metricsService.createVisit' }),
    );
  });
});

describe('metricsService.getMetrics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('агрегирует метрики сегодня/неделя/месяц (happy path)', async () => {
    visitFindMany.mockResolvedValue([{ ip: '1.1.1.1' }, { ip: '2.2.2.2' }]);
    orderCount.mockResolvedValue(3);
    clickCount.mockResolvedValue(5);
    orderGroupBy.mockResolvedValue([
      { status: 'NEW', _count: { _all: 2 } },
      { status: 'DONE', _count: { _all: 1 } },
    ]);

    const result = await metricsService.getMetrics();

    expect(result.visitors).toEqual({ today: 2, week: 2, month: 2 });
    expect(result.orders.today).toBe(3);
    expect(result.clicks.today).toBe(5);
    expect(result.orders.byStatus).toEqual([
      { status: 'NEW', count: 2 },
      { status: 'DONE', count: 1 },
    ]);
    expect(orderCount).toHaveBeenCalledTimes(3);
    expect(clickCount).toHaveBeenCalledTimes(3);
    expect(visitFindMany).toHaveBeenCalledTimes(3);
    expect(orderFindMany).not.toHaveBeenCalled();
    expect(clickFindMany).not.toHaveBeenCalled();
    expect(loggerMock.info).toHaveBeenCalledWith(
      'Business metrics aggregated',
      expect.objectContaining({ operation: 'metricsService.getMetrics', visitorsToday: 2 }),
    );
  });

  it('исключает ip "unknown" из посетителей (edge case)', async () => {
    visitFindMany.mockResolvedValue([{ ip: 'unknown' }, { ip: '9.9.9.9' }]);
    orderCount.mockResolvedValue(0);
    clickCount.mockResolvedValue(0);
    orderGroupBy.mockResolvedValue([]);

    const result = await metricsService.getMetrics();
    expect(result.visitors.today).toBe(1);
  });

  it('посетители считаются из Visit даже при 0 заявок и 0 кликов (регрессия ADR-002)', async () => {
    visitFindMany.mockResolvedValue([{ ip: '3.3.3.3' }]);
    orderCount.mockResolvedValue(0);
    clickCount.mockResolvedValue(0);
    orderGroupBy.mockResolvedValue([]);

    const result = await metricsService.getMetrics();
    expect(result.visitors.today).toBe(1);
    expect(result.orders.today).toBe(0);
    expect(result.clicks.today).toBe(0);
  });

  it('бросает и логирует ошибку при сбое БД (error case)', async () => {
    orderCount.mockRejectedValue(new Error('DB down'));
    await expect(metricsService.getMetrics()).rejects.toThrow('DB down');
    expect(loggerMock.error).toHaveBeenCalledWith(
      'Failed to aggregate business metrics',
      expect.objectContaining({ operation: 'metricsService.getMetrics' }),
    );
  });
});