import { describe, it, expect, beforeEach, vi } from 'vitest';

const { clickEventCreate, orderCount, clickCount, orderFindMany, clickFindMany, orderGroupBy } =
  vi.hoisted(() => ({
    clickEventCreate: vi.fn(),
    orderCount: vi.fn(),
    clickCount: vi.fn(),
    orderFindMany: vi.fn(),
    clickFindMany: vi.fn(),
    orderGroupBy: vi.fn(),
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

  it('создаёт клик и логирует начало/конец (happy path)', async () => {
    const fake = { id: 'clk1', createdAt: new Date() };
    clickEventCreate.mockResolvedValue(fake);

    const result = await metricsService.createClickEvent({
      page: 'home',
      ip: '1.1.1.1',
      userAgent: 'Mozilla/5.0',
    });

    expect(result).toEqual(fake);
    expect(clickEventCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          page: 'home',
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

  it('подставляет null для ip/userAgent, если их нет (edge case)', async () => {
    clickEventCreate.mockResolvedValue({ id: 'x', createdAt: new Date() });
    await metricsService.createClickEvent({ page: 'contacts' });
    expect(clickEventCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ page: 'contacts', ip: null, userAgent: null }),
      }),
    );
  });

  it('бросает и логирует ошибку при сбое БД (error case)', async () => {
    clickEventCreate.mockRejectedValue(new Error('DB down'));
    await expect(metricsService.createClickEvent({ page: 'home' })).rejects.toThrow('DB down');
    expect(loggerMock.error).toHaveBeenCalledWith(
      'Failed to create click event',
      expect.objectContaining({ operation: 'metricsService.createClickEvent' }),
    );
  });
});

describe('metricsService.getMetrics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('агрегирует метрики сегодня/неделя/месяц (happy path)', async () => {
    orderFindMany.mockResolvedValue([{ ip: '1.1.1.1' }, { ip: '2.2.2.2' }]);
    clickFindMany.mockResolvedValue([{ ip: '1.1.1.1' }, { ip: null }]);
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
    expect(loggerMock.info).toHaveBeenCalledWith(
      'Business metrics aggregated',
      expect.objectContaining({ operation: 'metricsService.getMetrics' }),
    );
  });

  it('исключает ip "unknown" из посетителей (edge case)', async () => {
    orderFindMany.mockResolvedValue([{ ip: 'unknown' }, { ip: '9.9.9.9' }]);
    clickFindMany.mockResolvedValue([]);
    orderCount.mockResolvedValue(0);
    clickCount.mockResolvedValue(0);
    orderGroupBy.mockResolvedValue([]);

    const result = await metricsService.getMetrics();
    expect(result.visitors.today).toBe(1);
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