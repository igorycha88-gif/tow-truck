import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

const { clickEventCreate, rateLimitFn } = vi.hoisted(() => ({
  clickEventCreate: vi.fn(),
  rateLimitFn: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    clickEvent: {
      create: clickEventCreate,
      count: vi.fn(),
      findMany: vi.fn(),
    },
    order: {
      count: vi.fn(),
      findMany: vi.fn(),
      groupBy: vi.fn(),
    },
  },
  pingDb: vi.fn(),
}));

vi.mock('@/lib/redis', () => ({
  getRedis: vi.fn(() => null),
  pingRedis: vi.fn(async () => true),
}));

vi.mock('@/lib/rate-limit', () => ({ rateLimit: rateLimitFn }));

const { loggerMock } = vi.hoisted(() => ({
  loggerMock: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));
vi.mock('@/lib/logger', () => ({ logger: loggerMock }));

import { POST as postClickEvent } from '@/app/api/click-event/route';
import { GET as getMetrics } from '@/app/api/metrics/route';

function makeRequest(body: unknown): NextRequest {
  const req = new NextRequest('http://localhost/api/click-event', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return req;
}

describe('POST /api/click-event', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rateLimitFn.mockReset();
    rateLimitFn.mockResolvedValue({ ok: true, remaining: 59, resetSec: 3600 });
    clickEventCreate.mockReset();
  });

  it('создаёт клик и возвращает 201 (happy path)', async () => {
    rateLimitFn.mockResolvedValue({ ok: true, remaining: 59, resetSec: 3600 });
    clickEventCreate.mockResolvedValue({ id: 'clk1', createdAt: new Date().toISOString() });

    const res = await postClickEvent(makeRequest({ page: 'home' }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe('clk1');
    expect(loggerMock.info).toHaveBeenCalledWith(
      'API request',
      expect.objectContaining({ path: '/api/click-event' }),
    );
  });

  it('возвращает 400 на невалидную страницу', async () => {
    const res = await postClickEvent(makeRequest({ page: 'unknown_page' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('VALIDATION_ERROR');
  });

  it('возвращает 429 при превышении rate-limit', async () => {
    rateLimitFn.mockResolvedValue({ ok: false, remaining: 0, resetSec: 100 });
    const res = await postClickEvent(makeRequest({ page: 'home' }));
    expect(res.status).toBe(429);
    expect(loggerMock.warn).toHaveBeenCalledWith(
      'API response 429',
      expect.objectContaining({ path: '/api/click-event' }),
    );
  });

  it('возвращает 400 на некорректный JSON', async () => {
    const req = new NextRequest('http://localhost/api/click-event', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'not-json',
    });
    const res = await postClickEvent(req);
    expect(res.status).toBe(400);
  });

  it('возвращает 500 при сбое БД', async () => {
    clickEventCreate.mockRejectedValue(new Error('DB down'));
    const res = await postClickEvent(makeRequest({ page: 'contacts' }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('INTERNAL_ERROR');
    expect(loggerMock.error).toHaveBeenCalledWith(
      'API response 500',
      expect.objectContaining({ path: '/api/click-event' }),
    );
  });
});

describe('GET /api/metrics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('возвращает агрегированные метрики с 200 (happy path)', async () => {
    vi.mocked(prisma.order.findMany).mockResolvedValue([]);
    vi.mocked(prisma.clickEvent.findMany).mockResolvedValue([]);
    vi.mocked(prisma.order.count).mockResolvedValue(3);
    vi.mocked(prisma.clickEvent.count).mockResolvedValue(2);
    vi.mocked(prisma.order.groupBy).mockResolvedValue([
      { status: 'NEW', _count: { _all: 3 } },
    ] as never);

    const res = await getMetrics();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.orders.today).toBe(3);
    expect(body.clicks.month).toBe(2);
    expect(body.orders.byStatus).toEqual([{ status: 'NEW', count: 3 }]);
  });

  it('возвращает 500 при сбое БД', async () => {
    vi.mocked(prisma.order.count).mockRejectedValue(new Error('DB down'));

    const res = await getMetrics();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('INTERNAL_ERROR');
  });
});