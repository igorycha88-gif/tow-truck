import { describe, it, expect, beforeEach } from 'vitest';

import {
  normalizeRoute,
  __resetRouteTemplateCache,
} from '@/lib/metrics/route-template';

describe('normalizeRoute', () => {
  beforeEach(() => __resetRouteTemplateCache());

  it('статические пути остаются как есть', () => {
    expect(normalizeRoute('/')).toBe('/');
    expect(normalizeRoute('/politika')).toBe('/politika');
    expect(normalizeRoute('/api/orders')).toBe('/api/orders');
  });

  it('отрезает query-string (не сырой URL)', () => {
    expect(normalizeRoute('/api/orders?utm=x&y=1')).toBe('/api/orders');
    expect(normalizeRoute('/?foo=bar')).toBe('/');
  });

  it('схлопывает динамические слаги в шаблоны (ЧТЗ §4.2)', () => {
    expect(normalizeRoute('/uslugi/evakuaciya-motocikla')).toBe('/uslugi/[slug]');
    expect(normalizeRoute('/otzivy/123-otzyv')).toBe('/otzivy/[slug]');
  });

  it('статику Next.js схлопывает', () => {
    expect(normalizeRoute('/_next/static/css/abc.123.css')).toBe('/_next/static');
    expect(normalizeRoute('/_next/image?url=%2Fimg&w=640')).toBe('/_next/image');
  });

  it('числовые сегменты → [id]', () => {
    expect(normalizeRoute('/blog/42/edit')).toBe('/blog/[id]/edit');
  });

  it('одинаковые пути кэшируются (кардинальность не растёт)', () => {
    normalizeRoute('/uslugi/one');
    expect(normalizeRoute('/uslugi/two')).toBe('/uslugi/[slug]');
    expect(normalizeRoute('/uslugi/one')).toBe('/uslugi/[slug]');
  });

  it('ограничивает число уникальных значений 100 (edge case)', () => {
    for (let i = 0; i < 150; i++) {
      normalizeRoute(`/unique-path-${i}`);
    }
    const unique = new Set(
      Array.from({ length: 150 }, (_, i) => normalizeRoute(`/unique-path-${i}`)),
    );
    expect(unique.size).toBeLessThanOrEqual(100);
    expect(unique.has('/other')).toBe(true);
  });

  it('пустой путь → / (edge case)', () => {
    expect(normalizeRoute('')).toBe('/');
    expect(normalizeRoute('?query=only')).toBe('/');
  });
});
