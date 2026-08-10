import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import type { ClickEventSchemaInput } from '@/lib/validators/click-event';

// Бизнес-логика бизнес-метрик (см. ADR-001, ЧТЗ_Графана_Бизнес_метрики.md).
// Prisma только в services (SKILL_DEVELOPER.md §1). Логирование в начале/конце и в catch.

export type CreateClickEventParams = ClickEventSchemaInput & {
  ip?: string | null;
  userAgent?: string | null;
};

export type ClickEventSummary = {
  id: string;
  createdAt: Date;
};

export type MetricsCounts = {
  today: number;
  week: number;
  month: number;
};

export type MetricsByStatus = {
  status: string;
  count: number;
};

export type BusinessMetrics = {
  visitors: MetricsCounts;
  orders: MetricsCounts & { byStatus: MetricsByStatus[] };
  clicks: MetricsCounts;
};

export const metricsService = {
  async createClickEvent(params: CreateClickEventParams): Promise<ClickEventSummary> {
    const { page, ip, userAgent } = params;

    logger.info('Creating click event', {
      operation: 'metricsService.createClickEvent',
      page,
    });

    try {
      const event = await prisma.clickEvent.create({
        data: {
          page,
          ip: ip ?? null,
          userAgent: userAgent ?? null,
        },
        select: { id: true, createdAt: true },
      });

      logger.info('Click event created', {
        operation: 'metricsService.createClickEvent',
        eventId: event.id,
        page,
      });

      return event;
    } catch (err) {
      logger.error('Failed to create click event', {
        operation: 'metricsService.createClickEvent',
        error: err instanceof Error ? err.message : String(err),
        page,
      });
      throw err;
    }
  },

  // Агрегация бизнес-метрик за период: сегодня / 7 дней / 30 дней.
  // Посетители — уникальные IP из Order (посетитель, оставивший заявку)
  // + уникальные IP из ClickEvent (активность по телефону).
  async getMetrics(): Promise<BusinessMetrics> {
    logger.info('Aggregating business metrics', {
      operation: 'metricsService.getMetrics',
    });

    try {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Посетители: уникальные IP за период (Order + ClickEvent).
      const countVisitors = async (since: Date): Promise<number> => {
        const [orderIps, clickIps] = await Promise.all([
          prisma.order.findMany({
            where: { createdAt: { gte: since } },
            select: { ip: true },
          }),
          prisma.clickEvent.findMany({
            where: { createdAt: { gte: since } },
            select: { ip: true },
          }),
        ]);
        const unique = new Set<string>();
        for (const row of [...orderIps, ...clickIps]) {
          if (row.ip && row.ip !== 'unknown') unique.add(row.ip);
        }
        return unique.size;
      };

      const countOrders = (since: Date): Promise<number> =>
        prisma.order.count({ where: { createdAt: { gte: since } } });

      const countClicks = (since: Date): Promise<number> =>
        prisma.clickEvent.count({ where: { createdAt: { gte: since } } });

      const [visitorsToday, visitorsWeek, visitorsMonth] = await Promise.all([
        countVisitors(todayStart),
        countVisitors(weekStart),
        countVisitors(monthStart),
      ]);

      const [ordersToday, ordersWeek, ordersMonth] = await Promise.all([
        countOrders(todayStart),
        countOrders(weekStart),
        countOrders(monthStart),
      ]);

      const [clicksToday, clicksWeek, clicksMonth] = await Promise.all([
        countClicks(todayStart),
        countClicks(weekStart),
        countClicks(monthStart),
      ]);

      const byStatus = await prisma.order.groupBy({
        by: ['status'],
        where: { createdAt: { gte: monthStart } },
        _count: { _all: true },
      });

      const ordersByStatus: MetricsByStatus[] = byStatus.map((row) => ({
        status: row.status,
        count: row._count._all,
      }));

      const metrics: BusinessMetrics = {
        visitors: { today: visitorsToday, week: visitorsWeek, month: visitorsMonth },
        orders: {
          today: ordersToday,
          week: ordersWeek,
          month: ordersMonth,
          byStatus: ordersByStatus,
        },
        clicks: { today: clicksToday, week: clicksWeek, month: clicksMonth },
      };

      logger.info('Business metrics aggregated', {
        operation: 'metricsService.getMetrics',
        ordersToday,
        clicksToday,
      });

      return metrics;
    } catch (err) {
      logger.error('Failed to aggregate business metrics', {
        operation: 'metricsService.getMetrics',
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  },
};