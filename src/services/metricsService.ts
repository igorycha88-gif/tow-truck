import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { sanitizeSourceLabel } from '@/lib/referer';
import { detectDevice } from '@/lib/device';
import type { ClickEventSchemaInput } from '@/lib/validators/click-event';
import type { VisitSchemaInput } from '@/lib/validators/visit';

// Бизнес-логика бизнес-метрик (см. ADR-001, ADR-002, ADR-014,
// ЧТЗ_Сайт_эвакуация_online_Полные_Бизнес_Метрики.md,
// ЧТЗ_Метрики_пути_клиента_v2.md).
// Prisma только в services (SKILL_DEVELOPER.md §1). Логирование в начале/конец и в catch.
// referer — источник сессии (sanitized host | (direct)); null = не входное событие.
// city — город по GeoLite2 (geoip-lite), определяется в роуте по IP.
// device — по User-Agent на сервере (ADR-014); sessionId связывает клики с сессией.

export type CreateClickEventParams = ClickEventSchemaInput & {
  ip?: string | null;
  userAgent?: string | null;
  city?: string | null;
};

export type CreateVisitParams = Extract<VisitSchemaInput, { type?: 'enter' }> & {
  ip?: string | null;
  userAgent?: string | null;
  city?: string | null;
};

export type LeaveVisitParams = {
  viewId: string;
  dwellMs: number;
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
  // Событие трекинга: click_phone (клик по tel:-ссылке, ADR-012),
  // click_whatsapp (wa.me, ADR-014) или service_click (карточка услуги, ЧТЗ §2.4).
  async createClickEvent(params: CreateClickEventParams): Promise<ClickEventSummary> {
    const { eventType, page, service, referrer, sessionId, ip, userAgent, city } = params;

    logger.info('Creating click event', {
      operation: 'metricsService.createClickEvent',
      eventType,
      page,
      service: service ?? null,
      withSession: Boolean(sessionId),
    });

    try {
      const event = await prisma.clickEvent.create({
        data: {
          eventType,
          page,
          service: service ?? null,
          referer: referrer !== undefined ? sanitizeSourceLabel(referrer) : null,
          city: city ?? null,
          ip: ip ?? null,
          userAgent: userAgent ?? null,
          sessionId: sessionId ?? null,
          device: detectDevice(userAgent),
        },
        select: { id: true, createdAt: true },
      });

      logger.info('Click event created', {
        operation: 'metricsService.createClickEvent',
        eventId: event.id,
        eventType,
        page,
      });

      return event;
    } catch (err) {
      logger.error('Failed to create click event', {
        operation: 'metricsService.createClickEvent',
        error: err instanceof Error ? err.message : String(err),
        eventType,
        page,
      });
      throw err;
    }
  },

  // Трекинг просмотра страницы (ADR-002, v2 — ADR-014): каждая навигация
  // пишется с from→to, sessionId/visitorId/viewId, UTM входа и устройством.
  // referer присылается только входным визитом сессии (ЧТЗ §2.2).
  async createVisit(params: CreateVisitParams): Promise<ClickEventSummary> {
    const {
      page,
      from,
      referrer,
      sessionId,
      visitorId,
      viewId,
      utmSource,
      utmMedium,
      utmCampaign,
      ip,
      userAgent,
      city,
    } = params;

    logger.info('Creating visit', {
      operation: 'metricsService.createVisit',
      page,
      withSource: referrer !== undefined,
      withSession: Boolean(sessionId),
      withFrom: Boolean(from),
    });

    try {
      const visit = await prisma.visit.create({
        data: {
          page,
          fromPage: from ? from : null,
          referer: referrer !== undefined ? sanitizeSourceLabel(referrer) : null,
          sessionId: sessionId ?? null,
          visitorId: visitorId ?? null,
          viewId: viewId ?? null,
          utmSource: utmSource ?? null,
          utmMedium: utmMedium ?? null,
          utmCampaign: utmCampaign ?? null,
          device: detectDevice(userAgent),
          city: city ?? null,
          ip: ip ?? null,
          userAgent: userAgent ?? null,
        },
        select: { id: true, createdAt: true },
      });

      logger.info('Visit created', {
        operation: 'metricsService.createVisit',
        visitId: visit.id,
        page,
      });

      return visit;
    } catch (err) {
      logger.error('Failed to create visit', {
        operation: 'metricsService.createVisit',
        error: err instanceof Error ? err.message : String(err),
        page,
      });
      throw err;
    }
  },

  // Leave-обновление времени на странице (ADR-014): идемпотентный UPDATE
  // по viewId; 0 строк (гонка/чужой viewId) — не ошибка, fire-and-forget.
  async applyLeave(params: LeaveVisitParams): Promise<void> {
    const { viewId, dwellMs } = params;

    logger.info('Applying visit leave', {
      operation: 'metricsService.applyLeave',
      viewId,
      dwellMs,
    });

    try {
      const result = await prisma.visit.updateMany({
        where: { viewId },
        data: { dwellMs },
      });

      logger.info('Visit leave applied', {
        operation: 'metricsService.applyLeave',
        viewId,
        updated: result.count,
      });
    } catch (err) {
      logger.error('Failed to apply visit leave', {
        operation: 'metricsService.applyLeave',
        error: err instanceof Error ? err.message : String(err),
        viewId,
      });
      throw err;
    }
  },

  // Агрегация бизнес-метрик за период: сегодня / 7 дней / 30 дней.
  // Посетители (ADR-002) — уникальные IP из Visit (реальные визиты на сайт).
  // Ранее считались из Order+ClickEvent — метрика не показывала трафик без заявок.
  async getMetrics(): Promise<BusinessMetrics> {
    logger.info('Aggregating business metrics', {
      operation: 'metricsService.getMetrics',
    });

    try {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Посетители: уникальные IP из Visit за период (ADR-002).
      const countVisitors = (since: Date): Promise<number> =>
        prisma.visit
          .findMany({
            where: { createdAt: { gte: since } },
            select: { ip: true },
          })
          .then((rows: Array<{ ip: string | null }>) => {
            const unique = new Set<string>();
            for (const row of rows) {
              if (row.ip && row.ip !== 'unknown') unique.add(row.ip);
            }
            return unique.size;
          });

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
        visitorsToday,
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