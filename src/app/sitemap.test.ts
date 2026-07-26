import { describe, it, expect } from 'vitest';
import sitemap from '@/app/sitemap';
import robots from '@/app/robots';

describe('app/sitemap', () => {
  it('возвращает массив с главной страницей', () => {
    const result = sitemap();
    expect(Array.isArray(result)).toBe(true);
    expect(result.some((r) => r.url.endsWith('/'))).toBe(true);
  });

  it('каждая запись имеет url и priority', () => {
    sitemap().forEach((r) => {
      expect(r.url).toMatch(/^https?:\/\//);
      expect(r.priority).toBeGreaterThan(0);
    });
  });
});

describe('app/robots', () => {
  it('разрешает индексацию всем', () => {
    const r = robots();
    const rule = Array.isArray(r.rules) ? r.rules[0] : r.rules;
    expect(rule?.userAgent).toBe('*');
    expect(rule?.allow).toBe('/');
  });
  it('содержит ссылку на sitemap', () => {
    const r = robots();
    expect(r.sitemap).toMatch(/sitemap\.xml$/);
  });
});
