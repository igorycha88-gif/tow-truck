import { describe, it, expect } from 'vitest';

// Zod-схема визита v2 (ADR-014): union enter|leave, обратная совместимость
// со старым payload {page, referrer?}, UTM/ID/dwellMs-валидация.

import { visitSchema, isVisitLeave } from '@/lib/validators/visit';

describe('visitSchema v2 (ADR-014)', () => {
  it('старый payload {page, referrer?} валиден как enter (обратная совместимость)', () => {
    const parsed = visitSchema.parse({ page: 'home', referrer: 'yandex.ru' });
    expect(isVisitLeave(parsed)).toBe(false);
    expect(parsed).toMatchObject({ page: 'home', referrer: 'yandex.ru' });
  });

  it('v2 enter: полный payload с from/ID/UTM (happy path)', () => {
    const parsed = visitSchema.parse({
      type: 'enter',
      page: 'uslugi/a',
      from: 'home',
      sessionId: 'sid-12345678',
      visitorId: 'vid-87654321',
      viewId: 'view-abcdef01',
      utmSource: 'yandex',
      utmMedium: 'cpc',
      utmCampaign: 'summer',
    });
    expect(isVisitLeave(parsed)).toBe(false);
    expect(parsed).toMatchObject({ page: 'uslugi/a', from: 'home', utmSource: 'yandex' });
  });

  it('enter: page дефолтится в home (edge case)', () => {
    const parsed = visitSchema.parse({});
    expect(isVisitLeave(parsed)).toBe(false);
    if (!isVisitLeave(parsed)) {
      expect(parsed.page).toBe('home');
    }
  });

  it('leave: корректный payload (happy path)', () => {
    const parsed = visitSchema.parse({ type: 'leave', viewId: 'view-abcdef01', dwellMs: 42_000 });
    expect(isVisitLeave(parsed)).toBe(true);
  });

  it('leave: dwellMs = 0 и максимум 1_800_000 валидны (границы)', () => {
    expect(isVisitLeave(visitSchema.parse({ type: 'leave', viewId: 'view-abcdef01', dwellMs: 0 }))).toBe(true);
    expect(
      isVisitLeave(visitSchema.parse({ type: 'leave', viewId: 'view-abcdef01', dwellMs: 1_800_000 })),
    ).toBe(true);
  });

  it('leave: dwellMs отрицательный / дробный / > 30 мин → throw (edge cases)', () => {
    expect(() => visitSchema.parse({ type: 'leave', viewId: 'view-abcdef01', dwellMs: -1 })).toThrow();
    expect(() => visitSchema.parse({ type: 'leave', viewId: 'view-abcdef01', dwellMs: 1.5 })).toThrow();
    expect(() => visitSchema.parse({ type: 'leave', viewId: 'view-abcdef01', dwellMs: 1_800_001 })).toThrow();
  });

  it('leave: без viewId → throw (валидация)', () => {
    expect(() => visitSchema.parse({ type: 'leave', dwellMs: 1000 })).toThrow();
  });

  it('sessionId короче 8 символов → throw (edge case)', () => {
    expect(() => visitSchema.parse({ type: 'enter', page: 'home', sessionId: 'abc' })).toThrow();
  });

  it('sessionId с недопустимыми символами → throw', () => {
    expect(() => visitSchema.parse({ type: 'enter', page: 'home', sessionId: 'хеш!не-тот' })).toThrow();
  });

  it('кириллический page → throw (как в v1)', () => {
    expect(() => visitSchema.parse({ page: 'Главная' })).toThrow();
  });

  it('UTM длиннее 100 символов → throw (edge case)', () => {
    expect(() => visitSchema.parse({ type: 'enter', page: 'home', utmSource: 'x'.repeat(101) })).toThrow();
  });

  it('UTM со спецсимволами санитизируется на сервере (BUG-001, hardening)', () => {
    const parsed = visitSchema.parse({ type: 'enter', page: 'home', utmSource: 'ya ndex!<script>' });
    if (!isVisitLeave(parsed)) {
      expect(parsed.utmSource).toBe('ya_ndex__script_');
    }
  });
});
