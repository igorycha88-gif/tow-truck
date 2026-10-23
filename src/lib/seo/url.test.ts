import { describe, it, expect, vi, beforeEach } from 'vitest';

// EV-T1: Punycode-нормализация абсолютных URL + запрет конкатенаций siteConfig.url.

describe('seo.url (EV-T1)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('absoluteUrl кодирует кириллический домен в Punycode', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://эвакуация.online');
    const { absoluteUrl } = await import('@/lib/seo/url');
    expect(absoluteUrl('/evakuator-marino')).toBe(
      'https://xn--80aae0ai8cwa4cza.online/evakuator-marino',
    );
    vi.unstubAllEnvs();
  });

  it('siteOrigin возвращает ASCII-origin', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://эвакуация.online');
    const { siteOrigin } = await import('@/lib/seo/url');
    expect(siteOrigin()).toBe('https://xn--80aae0ai8cwa4cza.online');
    vi.unstubAllEnvs();
  });

  it('ENV со слешем и без слеша дают одинаковый origin (edge case)', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://эвакуация.online/');
    const { siteOrigin: withSlash } = await import('@/lib/seo/url');
    expect(withSlash()).toBe('https://xn--80aae0ai8cwa4cza.online');
    vi.unstubAllEnvs();
  });

  it('canonical главной — корень со слешем', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://эвакуация.online');
    const { absoluteUrl } = await import('@/lib/seo/url');
    expect(absoluteUrl('/')).toBe('https://xn--80aae0ai8cwa4cza.online/');
    expect(absoluteUrl()).toBe('https://xn--80aae0ai8cwa4cza.online/');
    vi.unstubAllEnvs();
  });

  it('латинский домен проходит без изменений', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'http://localhost:3000');
    const { absoluteUrl } = await import('@/lib/seo/url');
    expect(absoluteUrl('/ceny')).toBe('http://localhost:3000/ceny');
    vi.unstubAllEnvs();
  });

  it('нет конкатенаций `${siteConfig.url}` вне url.ts (grep-тест)', async () => {
    const { readdirSync, readFileSync, statSync } = await import('node:fs');
    const { join, extname } = await import('node:path');
    const collect = (dir: string): string[] => {
      const out: string[] = [];
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
          if (entry === 'node_modules' || entry === '.next') continue;
          out.push(...collect(full));
        } else if (['.ts', '.tsx'].includes(extname(entry)) && !entry.includes('.test.')) {
          out.push(full);
        }
      }
      return out;
    };
    const hits: string[] = [];
    for (const file of collect(join(process.cwd(), 'src'))) {
      const content = readFileSync(file, 'utf8');
      if (content.includes('siteConfig.url}') && !file.endsWith('seo/url.ts')) {
        hits.push(file);
      }
    }
    expect(hits, `конкатенации siteConfig.url найдены в: ${hits.join(', ')}`).toEqual([]);
  });
});
