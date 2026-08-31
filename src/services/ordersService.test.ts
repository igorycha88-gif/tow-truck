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
      location: 'МКАД',
      serviceType: 'light_vehicle',
      consent: true,
    });

    expect(result).toEqual({ ...fake, displayNumber: '20260831-5' });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'Иван',
          phone: '+79991234567',
          location: 'МКАД',
          serviceType: 'light_vehicle',
          source: 'website',
        }),
      }),
    );
    expect(loggerMock.info).toHaveBeenCalledWith(
      'Creating order',
      expect.objectContaining({ operation: 'ordersService.createOrder' }),
    );
    expect(loggerMock.info).toHaveBeenCalledWith(
      'Order created',
      expect.objectContaining({ orderId: 'clx1', number: '20260831-5' }),
    );
  });

  it('displayNumber по московскому времени (edge case, 21:00 UTC = след. день)', async () => {
    create.mockResolvedValue({ id: 'clx2', number: 7, status: 'NEW', createdAt: new Date('2026-08-31T21:00:00Z') });
    const result = await ordersService.createOrder({
      name: 'Иван',
      phone: '+79991234567',
      location: 'МКАД',
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
        location: 'МКАД',
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
      location: 'ул. Пушкина',
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
});
