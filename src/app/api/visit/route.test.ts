import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { visitCreate, visitUpdateMany, rateLimitFn } = vi.hoisted(() => ({
  visitCreate: vi.fn(),
  visitUpdateMany: vi.fn(),
  rateLimitFn: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    visit: {
      create: visitCreate,
      updateMany: visitUpdateMany,
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

const { lookupCityMock } = vi.hoisted(() => ({ lookupCityMock: vi.fn() }));
vi.mock('@/lib/geo', () => ({ lookupCity: lookupCityMock }));

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
    visitUpdateMany.mockReset();
    visitUpdateMany.mockResolvedValue({ count: 1 });
    lookupCityMock.mockReset();
    lookupCityMock.mockReturnValue(null);
  });

  it('создаёт визит и возвращает 201 (happy path)', async () => {
    visitCreate.mockResolvedValue({ id: 'vis1', createdAt: new Date().toISOString() });

    const res = await postVisit(makeRequest({ page: 'home' }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe('vis1');
    expect(visitCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ page: 'home', referer: null }),
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

  it('входной визит несёт источник и гео (ЧТЗ §2.2/§2.3)', async () => {
    lookupCityMock.mockReturnValue('Moscow');
    visitCreate.mockResolvedValue({ id: 'vis3', createdAt: new Date().toISOString() });

    const res = await postVisit(
      makeRequest(
        { page: 'home', referrer: 'yandex.ru' },
        { 'x-forwarded-for': '77.88.8.8' },
      ),
    );
    expect(res.status).toBe(201);
    // 152-ФЗ: в БД — маскированный IP, гео — по полному.
    expect(visitCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          page: 'home',
          referer: 'yandex.ru',
          city: 'Moscow',
          ip: '77.88.8.0',
        }),
      }),
    );
    expect(lookupCityMock).toHaveBeenCalledWith('77.88.8.8');
  });

  it('прямой заход → referer=(direct); мусорный источник санитизируется (edge case)', async () => {
    visitCreate.mockResolvedValue({ id: 'vis4', createdAt: new Date().toISOString() });

    await postVisit(makeRequest({ page: 'home', referrer: '(direct)' }));
    expect(visitCreate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ referer: '(direct)' }),
      }),
    );

    await postVisit(makeRequest({ page: 'home', referrer: 'https://www.GOOGLE.ru/' }));
    expect(visitCreate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ referer: 'google.ru' }),
      }),
    );
  });

  it('нормализует и маскирует IPv6-mapped IP из x-forwarded-for (edge case)', async () => {
    visitCreate.mockResolvedValue({ id: 'vis2', createdAt: new Date().toISOString() });

    const res = await postVisit(
      makeRequest({ page: 'politika' }, { 'x-forwarded-for': '::ffff:5.6.7.8, 10.0.0.1' }),
    );
    expect(res.status).toBe(201);
    expect(visitCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ ip: '5.6.7.0' }),
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

  // ── v2 (ADR-014): полный путь клиента ────────────────────────────────

  it('v2 enter: полный payload с from/sessionId/UTM пишется (happy path)', async () => {
    visitCreate.mockResolvedValue({ id: 'vis-v2', createdAt: new Date().toISOString() });

    const res = await postVisit(
      makeRequest(
        {
          type: 'enter',
          page: 'uslugi/a',
          from: 'home',
          sessionId: 'sid-12345678',
          visitorId: 'vid-87654321',
          viewId: 'view-abcdef01',
          utmSource: 'yandex',
          utmMedium: 'cpc',
          utmCampaign: 'evacuation-moscow',
        },
        { 'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile Safari' },
      ),
    );
    expect(res.status).toBe(201);
    expect(visitCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          page: 'uslugi/a',
          fromPage: 'home',
          sessionId: 'sid-12345678',
          visitorId: 'vid-87654321',
          viewId: 'view-abcdef01',
          utmSource: 'yandex',
          utmMedium: 'cpc',
          utmCampaign: 'evacuation-moscow',
          device: 'mobile',
        }),
      }),
    );
  });

  it('v2 leave: обновляет dwellMs по viewId и возвращает 200 (happy path)', async () => {
    visitUpdateMany.mockResolvedValue({ count: 1 });

    const res = await postVisit(
      makeRequest({ type: 'leave', viewId: 'view-abcdef01', dwellMs: 42_000 }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(visitUpdateMany).toHaveBeenCalledWith({
      where: { viewId: 'view-abcdef01' },
      data: { dwellMs: 42_000 },
    });
    expect(visitCreate).not.toHaveBeenCalled();
  });

  it('v2 leave: viewId не найден (гонка) → всё равно 200, fire-and-forget (edge case)', async () => {
    visitUpdateMany.mockResolvedValue({ count: 0 });

    const res = await postVisit(
      makeRequest({ type: 'leave', viewId: 'view-unknown1', dwellMs: 1000 }),
    );
    expect(res.status).toBe(200);
  });

  it('v2 leave: dwellMs > 30 минут → 400 (edge case)', async () => {
    const res = await postVisit(
      makeRequest({ type: 'leave', viewId: 'view-abcdef01', dwellMs: 1_800_001 }),
    );
    expect(res.status).toBe(400);
    expect(visitUpdateMany).not.toHaveBeenCalled();
  });

  it('v2 leave: короткий viewId → 400 (валидация)', async () => {
    const res = await postVisit(makeRequest({ type: 'leave', viewId: 'abc', dwellMs: 100 }));
    expect(res.status).toBe(400);
  });

  it('v2 enter: невалидный sessionId → 400 (валидация)', async () => {
    const res = await postVisit(
      makeRequest({ type: 'enter', page: 'home', sessionId: 'слишком-коротко!' }),
    );
    expect(res.status).toBe(400);
  });

  it('v2 enter: desktop UA определяется по user-agent (edge case)', async () => {
    visitCreate.mockResolvedValue({ id: 'vis-d', createdAt: new Date().toISOString() });

    await postVisit(
      makeRequest(
        { type: 'enter', page: 'home' },
        { 'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit Chrome' },
      ),
    );
    expect(visitCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ device: 'desktop' }),
      }),
    );
  });
});
