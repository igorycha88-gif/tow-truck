import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { formatOrderNumber } from '@/lib/orderNumber';
import type { Prisma } from '@prisma/client';
import type { OrderSchemaInput } from '@/lib/validators/order';

// Бизнес-логика заявок (см. SKILL_DEVELOPER.md §1: Prisma только в services).
// Логирование в начале/конце операций и в catch — обязательно.

type CreateOrderParams = OrderSchemaInput & {
  ip?: string | null;
  source?: string;
  utm?: Record<string, unknown>;
};

export const ordersService = {
  async createOrder(params: CreateOrderParams) {
    const { name, phone, addressFrom, addressTo, serviceType, ip, source = 'website', utm } = params;

    logger.info('Creating order', {
      operation: 'ordersService.createOrder',
      name,
      serviceType,
      addressFrom,
    });

    try {
      // 152-ФЗ: фиксируем момент согласия на обработку ПД (валидация consent=true
      // пройдена в Zod). Логируется здесь + хранится в БД (consentAt).
      const consentAt = new Date();
      const order = await prisma.order.create({
        data: {
          name,
          phone,
          addressFrom,
          addressTo,
          serviceType,
          source,
          ip: ip ?? null,
          utm: utm ? (utm as Prisma.InputJsonValue) : undefined,
          consentAt,
        },
        select: {
          id: true,
          number: true,
          name: true,
          status: true,
          serviceType: true,
          createdAt: true,
        },
      });

      const number = formatOrderNumber(order.createdAt, order.number);

      logger.info('Order created', {
        operation: 'ordersService.createOrder',
        orderId: order.id,
        number,
        status: order.status,
        consent: true,
        consentAt: consentAt.toISOString(),
      });

      return { ...order, displayNumber: number };
    } catch (err) {
      logger.error('Failed to create order', {
        operation: 'ordersService.createOrder',
        error: err instanceof Error ? err.message : String(err),
        name,
        serviceType,
      });
      throw err;
    }
  },
};
