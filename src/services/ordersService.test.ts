import { describe, it, expect, beforeEach, vi } from 'vitest';

const { create } = vi.hoisted(() => ({ create: vi.fn() }));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    order: { create },
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

import { ordersService } from '@/services/ordersService';

describe('ordersService.createOrder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('создаёт заявку, возвращает displayNumber и логирует (happy path)', async () => {
    const createdAt = new Date('2026-08-31T10:00:00Z');
    const fake = { id: 'clx1', number: 5, name: 'Иван', status: 'NEW', serviceType: 'light_vehicle', createdAt };
    create.mockResolvedValue(fake);

    const result = await ordersService.createOrder({
      name: 'Иван',
      phone: '+79991234567',
      addressFrom: 'МКАД',
      addressTo: 'Москва, ул. Тверская, 1',
      serviceType: 'light_vehicle',
      consent: true,
    });

    expect(result).toEqual({ ...fake, displayNumber: '20260831-5' });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'Иван',
          phone: '+79991234567',
          addressFrom: 'МКАД',
          addressTo: 'Москва, ул. Тверская, 1',
          serviceType: 'light_vehicle',
          source: 'website',
          consentAt: expect.any(Date),
        }),
      }),
    );
    expect(loggerMock.info).toHaveBeenCalledWith(
      'Creating order',
      expect.objectContaining({ operation: 'ordersService.createOrder' }),
    );
    expect(loggerMock.info).toHaveBeenCalledWith(
      'Order created',
      expect.objectContaining({
        orderId: 'clx1',
        number: '20260831-5',
        consent: true,
        consentAt: expect.any(String),
      }),
    );
  });

  it('фиксирует согласие (152-ФЗ): consentAt сохраняется и логируется', async () => {
    const before = new Date();
    create.mockResolvedValue({ id: 'clx-consent', number: 9, status: 'NEW', createdAt: new Date('2026-08-31T10:00:00Z') });
    await ordersService.createOrder({
      name: 'Иван',
      phone: '+79991234567',
      addressFrom: 'МКАД',
      serviceType: 'light_vehicle',
      consent: true,
    });
    const savedData = create.mock.calls[0][0].data;
    expect(savedData.consentAt).toBeInstanceOf(Date);
    expect(savedData.consentAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    const createdLog = loggerMock.info.mock.calls.find(
      ([msg]) => msg === 'Order created',
    )?.[1];
    expect(createdLog.consent).toBe(true);
    expect(typeof createdLog.consentAt).toBe('string');
  });

  it('displayNumber по московскому времени (edge case, 21:00 UTC = след. день)', async () => {
    create.mockResolvedValue({ id: 'clx2', number: 7, status: 'NEW', createdAt: new Date('2026-08-31T21:00:00Z') });
    const result = await ordersService.createOrder({
      name: 'Иван',
      phone: '+79991234567',
      addressFrom: 'МКАД',
      serviceType: 'light_vehicle',
      consent: true,
    });
    expect(result.displayNumber).toBe('20260901-7');
  });

  it('бросает и логирует ошибку при сбое БД (error case)', async () => {
    create.mockRejectedValue(new Error('DB down'));
    await expect(
      ordersService.createOrder({
        name: 'Иван',
        phone: '+79991234567',
        addressFrom: 'МКАД',
        serviceType: 'light_vehicle',
        consent: true,
      }),
    ).rejects.toThrow('DB down');
    expect(loggerMock.error).toHaveBeenCalledWith(
      'Failed to create order',
      expect.objectContaining({ operation: 'ordersService.createOrder' }),
    );
  });

  it('передаёт ip и source (edge case)', async () => {
    create.mockResolvedValue({ id: 'x', number: 3, status: 'NEW', createdAt: new Date('2026-08-31T10:00:00Z') });
    await ordersService.createOrder({
      name: 'Петр',
      phone: '+79991234567',
      addressFrom: 'ул. Пушкина',
      serviceType: 'moto',
      consent: true,
      ip: '1.1.1.1',
      source: 'callback',
    });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ ip: '1.1.1.1', source: 'callback' }),
      }),
    );
  });

  it('сохраняет undefined для addressTo, если адрес доставки не указан (edge case)', async () => {
    create.mockResolvedValue({ id: 'x2', number: 4, status: 'NEW', createdAt: new Date('2026-08-31T10:00:00Z') });
    await ordersService.createOrder({
      name: 'Сергей',
      phone: '+79991234567',
      addressFrom: 'Ленинградское шоссе',
      serviceType: 'accident',
      consent: true,
    });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ addressFrom: 'Ленинградское шоссе', addressTo: undefined }),
      }),
    );
  });
});
