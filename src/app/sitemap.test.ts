import { describe, it, expect } from 'vitest';
import sitemap from '@/app/sitemap';
import { buildRobotsTxt } from '@/lib/seo/robots';
import { servicePageSlugs } from '@/config/service-pages';
import { geoHubs, landingSlugs } from '@/config/geo';
import { CONTENT_UPDATED_AT } from '@/config/seo-dates';

describe('app/sitemap (EV-T3)', () => {
  it('ровно 124 URL: главная + 123 посадочные; /politika нет', () => {
    const urls = sitemap().map((r) => r.url);
    expect(urls).toHaveLength(124);
    expect(urls.some((u) => u.endsWith('/'))).toBe(true);
    expect(urls.some((u) => u.endsWith('/politika'))).toBe(false);
  });

  it('каждая запись имеет url и priority', () => {
    sitemap().forEach((r) => {
      expect(r.url).toMatch(/^https?:\/\//);
      expect(r.priority).toBeGreaterThan(0);
    });
  });

  it('содержит все посадочные из объединённого реестра (услуги + гео)', () => {
    const urls = sitemap().map((r) => r.url);
    landingSlugs().forEach((slug) => {
      expect(urls.some((u) => u.endsWith(`/${slug}`)), `sitemap не содержит /${slug}`).toBe(true);
    });
  });

  it('107 гео-URL: хабы приоритет 0.8, локации 0.7', () => {
    const entries = sitemap();
    const geoSlugs = landingSlugs().filter((slug) => !servicePageSlugs().includes(slug));
    expect(geoSlugs).toHaveLength(107);
    const hubSlugSet = new Set(geoHubs.map((h) => h.slug));
    geoSlugs.forEach((slug) => {
      const entry = entries.find((r) => r.url.endsWith(`/${slug}`))!;
      const expected = hubSlugSet.has(slug) ? 0.8 : 0.7;
      expect(entry.priority, `/${slug}: приоритет должен быть ${expected}`).toBe(expected);
    });
  });

  it('URL в sitemap уникальны (нет дублей)', () => {
    const urls = sitemap().map((r) => r.url);
    expect(new Set(urls).size).toBe(urls.length);
  });

  it('lastmod стабилен: равен CONTENT_UPDATED_AT, не времени сборки', () => {
    const first = sitemap();
    const second = sitemap();
    first.forEach((entry, i) => {
      const a = new Date(entry.lastModified as string | Date).getTime();
      const b = new Date(second[i].lastModified as string | Date).getTime();
      expect(a).toBe(b);
      expect(a).toBe(new Date(CONTENT_UPDATED_AT).getTime());
    });
  });

  it('нет hreflang-альтернатив (сайт одноязычный)', () => {
    sitemap().forEach((entry) => {
      expect(entry.alternates).toBeUndefined();
    });
  });

  it('нет changeFrequency (Google игнорирует)', () => {
    sitemap().forEach((entry) => {
      expect(entry.changeFrequency).toBeUndefined();
    });
  });
});

describe('robots.txt (EV-T2)', () => {
  const txt = buildRobotsTxt();

  it('разрешает индексацию всем, закрывает служебные пути', () => {
    expect(txt).toContain('User-Agent: *');
    expect(txt).toContain('Allow: /');
    expect(txt).toContain('Disallow: /api/');
    expect(txt).toContain('Disallow: /metrics/');
    expect(txt).toContain('Disallow: /grafana/');
  });

  it('блок Yandex содержит Clean-param для utm/yclid/service', () => {
    expect(txt).toContain('User-Agent: Yandex');
    expect(txt).toContain('Clean-param: utm_source&utm_medium&utm_campaign&utm_content&utm_term');
    expect(txt).toContain('Clean-param: yclid&gclid&ysclid&_openstat&from&service');
  });

  it('нет директивы Host (Яндекс не поддерживает)', () => {
    expect(txt).not.toMatch(/^Host:/m);
    expect(txt).not.toContain('Host:');
  });

  it('нет кириллицы — только ASCII/Punycode', () => {
    // eslint-disable-next-line no-control-regex
    expect(txt).not.toMatch(/[А-Яа-яЁё]/);
  });

  it('Sitemap-строка — абсолютный ASCII-URL (Punycode на прод-домене)', () => {
    expect(txt).toMatch(/Sitemap: https?:\/\/[a-z0-9.:_-]+\/sitemap\.xml/);
    expect(txt).not.toContain('эвакуация.online');
  });
});
