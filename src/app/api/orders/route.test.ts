import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { createOrder, notifyNewOrder, rateLimit } = vi.hoisted(() => ({
  createOrder: vi.fn(),
  notifyNewOrder: vi.fn(),
  rateLimit: vi.fn(),
}));

vi.mock('@/services/ordersService', () => ({
  ordersService: { createOrder },
}));

vi.mock('@/services/notifyService', () => ({
  notifyService: { notifyNewOrder },
}));

vi.mock('@/lib/rate-limit', () => ({ rateLimit }));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { POST } from '@/app/api/orders/route';

function makeReq(body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest('http://localhost/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

const validPayload = {
  name: 'Иван',
  phone: '+7 (999) 123-45-67',
  location: 'МКАД 50 км',
  serviceType: 'light_vehicle',
  consent: true,
};

describe('POST /api/orders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rateLimit.mockResolvedValue({ ok: true, remaining: 2, resetSec: 3600 });
    notifyNewOrder.mockResolvedValue({ delivered: true, channel: 'telegram' });
  });

  it('возвращает 201 для валидной заявки (happy path)', async () => {
    createOrder.mockResolvedValue({
      id: 'ord-1',
      status: 'NEW',
      createdAt: new Date('2026-01-01'),
    });

    const res = await POST(makeReq(validPayload));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe('ord-1');
    expect(body.status).toBe('NEW');
    expect(createOrder).toHaveBeenCalledOnce();
    expect(notifyNewOrder).toHaveBeenCalled();
  });

  it('возвращает 429 при превышении rate-limit', async () => {
    rateLimit.mockResolvedValue({ ok: false, remaining: 0, resetSec: 3000 });

    const res = await POST(makeReq(validPayload));
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toBe('RATE_LIMIT_EXCEEDED');
    expect(createOrder).not.toHaveBeenCalled();
  });

  it('возвращает 400 при невалидных данных', async () => {
    const res = await POST(makeReq({ ...validPayload, phone: '123' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('VALIDATION_ERROR');
    expect(createOrder).not.toHaveBeenCalled();
  });

  it('возвращает 400 при отсутствии согласия (152-ФЗ)', async () => {
    const res = await POST(makeReq({ ...validPayload, consent: false }));
    expect(res.status).toBe(400);
  });

  it('возвращает 500 при ошибке БД', async () => {
    createOrder.mockRejectedValue(new Error('DB down'));
    const res = await POST(makeReq(validPayload));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('INTERNAL_ERROR');
  });

  it('не блокирует ответ сбоем уведомления (fire-and-forget)', async () => {
    createOrder.mockResolvedValue({ id: 'ord-2', status: 'NEW', createdAt: new Date() });
    notifyNewOrder.mockRejectedValue(new Error('tg down'));

    const res = await POST(makeReq(validPayload));
    expect(res.status).toBe(201);
  });

  it('возвращает 400 при некорректном JSON (edge case)', async () => {
    const res = await POST(makeReq('not-json', {}));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('VALIDATION_ERROR');
  });

  it('извлекает IP из x-forwarded-for', async () => {
    createOrder.mockResolvedValue({ id: 'ord-3', status: 'NEW', createdAt: new Date() });
    await POST(makeReq(validPayload, { 'x-forwarded-for': '8.8.8.8' }));
    expect(createOrder).toHaveBeenCalledWith(
      expect.objectContaining({ ip: '8.8.8.8' }),
    );
  });
});
