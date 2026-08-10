import { describe, it, expect, vi } from 'vitest';
import { isValidMetrikaId, metrikaInitScript, metrikaNoscriptSrc } from '@/lib/seo/metrika';
import { logger } from '@/lib/logger';

describe('seo.metrika.isValidMetrikaId', () => {
  it('принимает числовой ID (happy path)', () => {
    expect(isValidMetrikaId('111456265')).toBe(true);
  });

  it('отклоняет пустую строку (edge case)', () => {
    expect(isValidMetrikaId('')).toBe(false);
  });

  it('отклоняет не-числовое значение', () => {
    expect(isValidMetrikaId('abc')).toBe(false);
  });

  it('отклоняет попытку инъекции скрипта (безопасность)', () => {
    expect(isValidMetrikaId('1");alert(1)')).toBe(false);
    expect(isValidMetrikaId('"><img src=x>')).toBe(false);
  });

  it('обрезает пробелы перед проверкой', () => {
    expect(isValidMetrikaId('  111456265  ')).toBe(true);
  });
});

describe('seo.metrika.metrikaInitScript', () => {
  it('содержит URL tag.js с ?id=<ID> (happy path)', () => {
    const s = metrikaInitScript('111456265');
    expect(s).toContain('https://mc.yandex.ru/metrika/tag.js?id=111456265');
  });

  it('вызывает ym(<ID>, "init", ...) со всеми расширенными опциями', () => {
    const s = metrikaInitScript('111456265');
    expect(s).toContain('ym(111456265, "init"');
    expect(s).toMatch(/ssr:true/);
    expect(s).toMatch(/webvisor:true/);
    expect(s).toMatch(/clickmap:true/);
    expect(s).toMatch(/ecommerce:"dataLayer"/);
    expect(s).toMatch(/referrer: document\.referrer/);
    expect(s).toMatch(/url: location\.href/);
    expect(s).toMatch(/accurateTrackBounce:true/);
    expect(s).toMatch(/trackLinks:true/);
  });

  it('возвращает пустую строку для пустого ID (edge case)', () => {
    expect(metrikaInitScript('')).toBe('');
  });

  it('возвращает пустую строку для невалидного/опасного ID (безопасность)', () => {
    expect(metrikaInitScript('evil"<script>')).toBe('');
    expect(metrikaInitScript('1");alert(1)')).toBe('');
  });

  it('логирует warning при невалидном ID (логирование)', () => {
    const spy = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    metrikaInitScript('nope');
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('не логирует warning при валидном ID', () => {
    const spy = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    metrikaInitScript('111456265');
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('seo.metrika.metrikaNoscriptSrc', () => {
  it('формирует watch-URL с ID (happy path)', () => {
    expect(metrikaNoscriptSrc('111456265')).toBe('https://mc.yandex.ru/watch/111456265');
  });

  it('возвращает пустую строку для невалидного ID (edge case)', () => {
    expect(metrikaNoscriptSrc('')).toBe('');
    expect(metrikaNoscriptSrc('abc')).toBe('');
  });
});
