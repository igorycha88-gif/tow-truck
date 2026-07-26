import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Мокаем redis ДО импорта rate-limit.
const incr = vi.fn();
const expire = vi.fn();
const ttl = vi.fn();
vi.mock('@/lib/redis', () => ({
  getRedis: vi.fn(() => ({
    incr,
    expire,
    ttl,
    on: vi.fn(),
    quit: vi.fn(),
  })),
}));

import { rateLimit } from '@/lib/rate-limit';

describe('rateLimit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    incr.mockReset();
    expire.mockReset();
    ttl.mockReset();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('пропускает под лимитом (happy path)', async () => {
    incr.mockResolvedValue(1);
    ttl.mockResolvedValue(3600);
    const r = await rateLimit('ip:1.2.3.4', { max: 3, windowSec: 3600 });
    expect(r.ok).toBe(true);
    expect(r.remaining).toBe(2);
    expect(incr).toHaveBeenCalledWith('ratelimit:ip:1.2.3.4');
    expect(expire).toHaveBeenCalledWith('ratelimit:ip:1.2.3.4', 3600);
  });

  it('блокирует при превышении лимита (error case)', async () => {
    incr.mockResolvedValue(4);
    ttl.mockResolvedValue(3000);
    const r = await rateLimit('ip:1.2.3.4', { max: 3, windowSec: 3600 });
    expect(r.ok).toBe(false);
    expect(r.remaining).toBe(0);
  });

  it('блокирует ровно на max+1 (edge case)', async () => {
    incr.mockResolvedValue(3);
    ttl.mockResolvedValue(3500);
    const r = await rateLimit('ip:x', { max: 3 });
    expect(r.ok).toBe(true);
    expect(r.remaining).toBe(0);
  });

  it('не выставляет expire повторно для существующего ключа', async () => {
    incr.mockResolvedValue(2);
    ttl.mockResolvedValue(3000);
    await rateLimit('ip:y', { max: 3 });
    expect(expire).not.toHaveBeenCalled();
  });

  it('фолбэк: пропускает при ошибке Redis (graceful)', async () => {
    incr.mockRejectedValue(new Error('Redis down'));
    const r = await rateLimit('ip:z', { max: 3 });
    expect(r.ok).toBe(true);
  });
});
