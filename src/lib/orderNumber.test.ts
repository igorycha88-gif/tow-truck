import { describe, it, expect } from 'vitest';
import { formatOrderNumber } from '@/lib/orderNumber';

describe('formatOrderNumber', () => {
  it('формирует ГГГГММДД-N (happy path)', () => {
    expect(formatOrderNumber(new Date('2026-08-31T10:00:00Z'), 1)).toBe('20260831-1');
  });

  it('дата по Москве: UTC-время до 21:00 относится к тому же дню', () => {
    expect(formatOrderNumber(new Date('2026-08-31T20:59:59Z'), 42)).toBe('20260831-42');
  });

  it('дата по Москве: 21:00 UTC = полночь следующего дня мск (edge case)', () => {
    expect(formatOrderNumber(new Date('2026-08-31T21:00:00Z'), 7)).toBe('20260901-7');
  });

  it('сквозной счётчик без ведущих нулей и сброса (edge case)', () => {
    expect(formatOrderNumber(new Date('2027-01-01T05:00:00Z'), 12345)).toBe('20270101-12345');
  });

  it('периоды года и месяца с нулями (edge case)', () => {
    expect(formatOrderNumber(new Date('2026-02-05T00:30:00Z'), 9)).toBe('20260205-9');
  });
});
