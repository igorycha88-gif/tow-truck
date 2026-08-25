import { describe, it, expect } from 'vitest';
import sitemap from '@/app/sitemap';
import robots from '@/app/robots';
import { servicePageSlugs } from '@/config/service-pages';
import { landingSlugs } from '@/config/geo';

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

  it('содержит все 7 посадочных SEO-страниц из реестра (ЧТЗ ЭПИК-2)', () => {
    const urls = sitemap().map((r) => r.url);
    servicePageSlugs().forEach((slug) => {
      expect(urls.some((u) => u.endsWith(`/${slug}`)), `sitemap не содержит /${slug}`).toBe(true);
    });
  });

  it('содержит все гео-посадочные из объединённого реестра (ADR-003)', () => {
    const urls = sitemap().map((r) => r.url);
    landingSlugs().forEach((slug) => {
      expect(urls.some((u) => u.endsWith(`/${slug}`)), `sitemap не содержит /${slug}`).toBe(true);
    });
  });

  it('URL в sitemap уникальны (нет дублей)', () => {
    const urls = sitemap().map((r) => r.url);
    expect(new Set(urls).size).toBe(urls.length);
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
