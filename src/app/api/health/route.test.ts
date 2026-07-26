import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/prisma', () => ({ pingDb: vi.fn() }));
vi.mock('@/lib/redis', () => ({ pingRedis: vi.fn() }));
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { GET } from '@/app/api/health/route';
import { pingDb } from '@/lib/prisma';
import { pingRedis } from '@/lib/redis';

describe('GET /api/health', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('возвращает 200 когда БД и Redis доступны (happy path)', async () => {
    vi.mocked(pingDb).mockResolvedValue(true);
    vi.mocked(pingRedis).mockResolvedValue(true);

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.db).toBe('up');
    expect(body.redis).toBe('up');
    expect(body.timestamp).toBeDefined();
  });

  it('возвращает 503 когда БД недоступна', async () => {
    vi.mocked(pingDb).mockResolvedValue(false);
    vi.mocked(pingRedis).mockResolvedValue(true);

    const res = await GET();
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.status).toBe('degraded');
    expect(body.db).toBe('down');
  });

  it('возвращает 200 даже если Redis упал (фолбэк есть) (edge case)', async () => {
    vi.mocked(pingDb).mockResolvedValue(true);
    vi.mocked(pingRedis).mockResolvedValue(false);

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.redis).toBe('down');
  });
});
