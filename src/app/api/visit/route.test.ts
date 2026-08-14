import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { visitCreate, rateLimitFn } = vi.hoisted(() => ({
  visitCreate: vi.fn(),
  rateLimitFn: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    visit: {
      create: visitCreate,
      count: vi.fn(),
      findMany: vi.fn(),
    },
    clickEvent: {
      create: vi.fn(),
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

import { POST as postVisit } from '@/app/api/visit/route';

function makeRequest(body: unknown, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest('http://localhost/api/visit', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

describe('POST /api/visit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rateLimitFn.mockReset();
    rateLimitFn.mockResolvedValue({ ok: true, remaining: 119, resetSec: 3600 });
    visitCreate.mockReset();
  });

  it('создаёт визит и возвращает 201 (happy path)', async () => {
    visitCreate.mockResolvedValue({ id: 'vis1', createdAt: new Date().toISOString() });

    const res = await postVisit(makeRequest({ page: 'home' }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe('vis1');
    expect(visitCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ page: 'home' }),
      }),
    );
    expect(loggerMock.info).toHaveBeenCalledWith(
      'API request',
      expect.objectContaining({ path: '/api/visit' }),
    );
    expect(loggerMock.info).toHaveBeenCalledWith(
      'API response 201',
      expect.objectContaining({ path: '/api/visit', status: 201 }),
    );
  });

  it('нормализует IPv6-mapped IP из x-forwarded-for (edge case)', async () => {
    visitCreate.mockResolvedValue({ id: 'vis2', createdAt: new Date().toISOString() });

    const res = await postVisit(
      makeRequest({ page: 'politika' }, { 'x-forwarded-for': '::ffff:5.6.7.8, 10.0.0.1' }),
    );
    expect(res.status).toBe(201);
    expect(visitCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ ip: '5.6.7.8' }),
      }),
    );
  });

  it('возвращает 400 на невалидную страницу (кириллица)', async () => {
    const res = await postVisit(makeRequest({ page: 'Главная' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('VALIDATION_ERROR');
  });

  it('возвращает 400 на слишком длинный slug (edge case)', async () => {
    const res = await postVisit(makeRequest({ page: 'a'.repeat(101) }));
    expect(res.status).toBe(400);
  });

  it('возвращает 429 при превышении rate-limit', async () => {
    rateLimitFn.mockResolvedValue({ ok: false, remaining: 0, resetSec: 100 });
    const res = await postVisit(makeRequest({ page: 'home' }));
    expect(res.status).toBe(429);
    expect(loggerMock.warn).toHaveBeenCalledWith(
      'API response 429',
      expect.objectContaining({ path: '/api/visit' }),
    );
    expect(visitCreate).not.toHaveBeenCalled();
  });

  it('возвращает 400 на некорректный JSON', async () => {
    const req = new NextRequest('http://localhost/api/visit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'not-json',
    });
    const res = await postVisit(req);
    expect(res.status).toBe(400);
  });

  it('возвращает 500 при сбое БД (error case)', async () => {
    visitCreate.mockRejectedValue(new Error('DB down'));
    const res = await postVisit(makeRequest({ page: 'home' }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('INTERNAL_ERROR');
    expect(loggerMock.error).toHaveBeenCalledWith(
      'API response 500',
      expect.objectContaining({ path: '/api/visit' }),
    );
  });
});
