import { describe, it, expect } from 'vitest';
import { clickEventSchema } from '@/lib/validators/click-event';

describe('clickEventSchema', () => {
  it('применяет defaults: eventType=click_phone, page=home (happy path)', () => {
    const parsed = clickEventSchema.parse({});
    expect(parsed.eventType).toBe('click_phone');
    expect(parsed.page).toBe('home');
    expect(parsed.service).toBeUndefined();
    expect(parsed.referrer).toBeUndefined();
  });

  it('принимает click_phone с известными страницами', () => {
    for (const page of ['home', 'contacts', 'floating_call', 'header', 'service_page']) {
      expect(clickEventSchema.safeParse({ eventType: 'click_phone', page }).success).toBe(true);
    }
  });

  it('принимает произвольный slug страницы (гео-посадочные)', () => {
    expect(clickEventSchema.parse({ page: 'evakuator-vidnoe' }).page).toBe('evakuator-vidnoe');
  });

  it('принимает service_click с service slug и referrer (ЧТЗ §2.2/§2.4)', () => {
    const parsed = clickEventSchema.parse({
      eventType: 'service_click',
      page: 'home',
      service: 'light_vehicle',
      referrer: 'yandex.ru',
    });
    expect(parsed.service).toBe('light_vehicle');
    expect(parsed.referrer).toBe('yandex.ru');
  });

  it('отвергает service_click без service (error case)', () => {
    const r = clickEventSchema.safeParse({ eventType: 'service_click' });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0].path[0]).toBe('service');
    }
  });

  it('отвергает неизвестный eventType (error case)', () => {
    const r = clickEventSchema.safeParse({ eventType: 'magic_click' });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0].path[0]).toBe('eventType');
    }
  });

  it('отвергает невалидную страницу — кириллица/спецсимволы (edge case)', () => {
    expect(clickEventSchema.safeParse({ page: 'Главная' }).success).toBe(false);
    expect(clickEventSchema.safeParse({ page: 'page!' }).success).toBe(false);
  });

  it('отвергает невалидный service slug и пустой referrer (edge case)', () => {
    expect(
      clickEventSchema.safeParse({ eventType: 'service_click', service: 'Услуга №1' }).success,
    ).toBe(false);
    expect(clickEventSchema.safeParse({ referrer: '' }).success).toBe(false);
  });

  it('отвергает не-строки (edge case)', () => {
    expect(clickEventSchema.safeParse({ page: 123 }).success).toBe(false);
    expect(clickEventSchema.safeParse({ service: 42, eventType: 'service_click' }).success).toBe(false);
  });
});
