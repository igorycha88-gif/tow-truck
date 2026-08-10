import { describe, it, expect } from 'vitest';
import { clickEventSchema } from '@/lib/validators/click-event';

describe('clickEventSchema', () => {
  it('принимает валидную страницу и применяет default (happy path)', () => {
    expect(clickEventSchema.parse({ page: 'home' }).page).toBe('home');
    expect(clickEventSchema.parse({}).page).toBe('home');
  });

  it('принимает все известные страницы', () => {
    for (const page of ['home', 'contacts', 'floating_call', 'header']) {
      expect(clickEventSchema.safeParse({ page }).success).toBe(true);
    }
  });

  it('отвергает неизвестную страницу (error case)', () => {
    const r = clickEventSchema.safeParse({ page: 'unknown_page' });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0].path[0]).toBe('page');
    }
  });

  it('отвергает не-строку в page (edge case)', () => {
    expect(clickEventSchema.safeParse({ page: 123 }).success).toBe(false);
  });
});