import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

// Redis-модуль использует globalThis кэш — очищаем между тестами.

describe('redis.getRedis / pingRedis', () => {
  beforeEach(() => {
    vi.resetModules();
    globalThis.__redisClient = undefined;
  });

  afterEach(() => {
    vi.resetModules();
    globalThis.__redisClient = undefined;
    delete process.env.REDIS_URL;
  });

  it('возвращает null если REDIS_URL не задан (graceful fallback)', async () => {
    delete process.env.REDIS_URL;
    const { getRedis } = await import('@/lib/redis');
    expect(getRedis()).toBeNull();
  });

  it('pingRedis возвращает false без конфигурации', async () => {
    delete process.env.REDIS_URL;
    const { pingRedis } = await import('@/lib/redis');
    expect(await pingRedis()).toBe(false);
  });
});
