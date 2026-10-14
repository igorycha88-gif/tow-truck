import { describe, it, expect } from 'vitest';

// Определение устройства из UA (ADR-014): чистая функция, без зависимостей.

import { detectDevice } from '@/lib/device';

describe('detectDevice (ADR-014)', () => {
  it('iPhone → mobile (happy path)', () => {
    expect(
      detectDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit Mobile Safari'),
    ).toBe('mobile');
  });

  it('Android Mobile → mobile', () => {
    expect(detectDevice('Mozilla/5.0 (Linux; Android 14; Pixel 8) Mobile Safari/537.36')).toBe('mobile');
  });

  it('iPad → tablet', () => {
    expect(detectDevice('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) Safari/605.1.15')).toBe('tablet');
  });

  it('Android БЕЗ Mobile (планшет) → tablet (edge case)', () => {
    expect(detectDevice('Mozilla/5.0 (Linux; Android 13; SM-X110) Safari/537.36')).toBe('tablet');
  });

  it('macOS/desktop UA → desktop', () => {
    expect(
      detectDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit Chrome/126.0 Safari'),
    ).toBe('desktop');
  });

  it('Windows UA → desktop', () => {
    expect(detectDevice('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0')).toBe('desktop');
  });

  it('null/пустой UA → unknown (edge case)', () => {
    expect(detectDevice(null)).toBe('unknown');
    expect(detectDevice(undefined)).toBe('unknown');
    expect(detectDevice('')).toBe('unknown');
  });

  it('бот без мобильных признаков → desktop (edge case)', () => {
    expect(detectDevice('Mozilla/5.0 (compatible; YandexBot/3.0)')).toBe('desktop');
  });
});
