import { describe, it, expect } from 'vitest';
import {
  cn,
  formatPrice,
  formatPricing,
  isValidRuPhone,
  normalizePhone,
  formatPhone,
  getClientIp,
  normalizeIp,
} from '@/lib/utils';
import { NextRequest } from 'next/server';

describe('utils.cn', () => {
  it('объединяет классы и разрешает конфликты (twMerge)', () => {
    expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4');
  });

  it('поддерживает условные классы', () => {
    expect(cn('base', false && 'no', true && 'yes')).toBe('base yes');
  });
});

describe('utils.formatPrice', () => {
  it('форматирует число в рубли', () => {
    expect(formatPrice(3000)).toMatch(/3[^\d]000/);
  });

  it('не показывает копейки для целых чисел', () => {
    expect(formatPrice(2500)).not.toMatch(/\d,\d{2}/);
  });
});

describe('utils.formatPricing', () => {
  it('тариф: «Подача ... ₽ • ... ₽/км» (happy path)', () => {
    const out = formatPricing({ kind: 'tariff', baseFee: 5000, perKm: 100 });
    expect(out).toContain('Подача');
    expect(out).toContain('5');
    expect(out).toContain('000');
    expect(out).toContain('100');
    expect(out).toContain('/км');
  });

  it('точное значение для тарифа легковых', () => {
    expect(formatPricing({ kind: 'tariff', baseFee: 5000, perKm: 100 })).toBe(
      `Подача ${formatPrice(5000)} • ${formatPrice(100)}/км`,
    );
  });

  it('«по запросу»: фиксированная строка (happy path)', () => {
    expect(formatPricing({ kind: 'onRequest' })).toBe('Цена по запросу');
  });

  it('tariff и onRequest дают разные результаты (edge/regression)', () => {
    const tariff = formatPricing({ kind: 'tariff', baseFee: 6000, perKm: 100 });
    const onRequest = formatPricing({ kind: 'onRequest' });
    expect(tariff).not.toBe(onRequest);
    expect(tariff).toContain('Подача');
    expect(onRequest).not.toContain('Подача');
  });
});

describe('utils.isValidRuPhone', () => {
  it('принимает валидный российский номер (happy path)', () => {
    expect(isValidRuPhone('+7 (999) 123-45-67')).toBe(true);
  });

  it('принимает номер в формате 8XXX', () => {
    expect(isValidRuPhone('89991234567')).toBe(true);
  });

  it('отвергает короткий номер (edge case)', () => {
    expect(isValidRuPhone('123')).toBe(false);
  });

  it('отвергает иностранный номер', () => {
    expect(isValidRuPhone('+12025550123')).toBe(false);
  });

  it('отвергает мусор', () => {
    expect(isValidRuPhone('abc')).toBe(false);
    expect(isValidRuPhone('')).toBe(false);
  });
});

describe('utils.normalizePhone', () => {
  it('приводит к E.164', () => {
    expect(normalizePhone('+7 (999) 123-45-67')).toBe('+79991234567');
  });

  it('обрабатывает 8XXX', () => {
    expect(normalizePhone('8 (999) 123-45-67')).toMatch(/^\+?7?9991234567$|^\+?79991234567$/);
  });
});

describe('utils.formatPhone', () => {
  it('форматирует валидный номер', () => {
    const out = formatPhone('+79991234567');
    expect(out).toContain('+7');
    expect(out).toMatch(/\d{3}/);
  });

  it('возвращает как есть для невалидного', () => {
    expect(formatPhone('xyz')).toBe('xyz');
  });
});

describe('utils.getClientIp', () => {
  it('читает x-forwarded-for (первый IP)', () => {
    const req = new NextRequest('http://localhost/api', {
      headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' },
    });
    expect(getClientIp(req)).toBe('1.2.3.4');
  });

  it('читает x-real-ip если нет x-forwarded-for', () => {
    const req = new NextRequest('http://localhost/api', {
      headers: { 'x-real-ip': '9.9.9.9' },
    });
    expect(getClientIp(req)).toBe('9.9.9.9');
  });

  it('возвращает unknown если заголовков нет (edge case)', () => {
    const req = new NextRequest('http://localhost/api');
    expect(getClientIp(req)).toBe('unknown');
  });

  it('нормализует IPv6-mapped IPv4 из x-forwarded-for (ADR-002)', () => {
    const req = new NextRequest('http://localhost/api', {
      headers: { 'x-forwarded-for': '::ffff:1.2.3.4, 10.0.0.1' },
    });
    expect(getClientIp(req)).toBe('1.2.3.4');
  });
});

describe('utils.normalizeIp', () => {
  it('убирает ::ffff: префикс у IPv6-mapped IPv4', () => {
    expect(normalizeIp('::ffff:192.168.1.1')).toBe('192.168.1.1');
  });

  it('не трогает обычный IPv4', () => {
    expect(normalizeIp('8.8.8.8')).toBe('8.8.8.8');
  });

  it('не трогает чистый IPv6 (edge case)', () => {
    expect(normalizeIp('2001:db8::1')).toBe('2001:db8::1');
  });

  it('не трогает unknown (edge case)', () => {
    expect(normalizeIp('unknown')).toBe('unknown');
  });
});
