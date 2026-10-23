import { describe, it, expect } from 'vitest';
import { landingPages, landingSlugs } from '@/config/geo';
import { getServicePage, catalogServiceToLanding } from '@/config/service-pages';
import {
  footerLandingLinks,
  coverageHubLinks,
  coverageTopLocalityLinks,
} from '@/config/seo-links';

// BFS-тест графа перелинковки (EV-T5, ADR-015): все 123 посадочные достижимы
// с главной за ≤3 кликов. Рёбра графа = ровно те ссылки, что рендерятся в HTML:
// главная (Coverage + каталог + Contacts) ∪ подвал (услуги + гео-хабы) ∪ related
// посадочной ∪ parent (хаб в крошках). Больше NOTHING — иначе тест врёт.

const HUB = '/';

/** Рёбра главной страницы: блок Coverage, каталог услуг, Contacts, подвал. */
function homeEdges(): string[] {
  return [
    ...coverageHubLinks,
    ...coverageTopLocalityLinks,
    ...Object.values(catalogServiceToLanding),
    'evakuator-vidnoe', // Contacts (ЭПИК-5)
    ...footerLandingLinks,
  ].map((slug) => `/${slug}`);
}

/** Рёбра посадочной: related-перелинковка + parent-хаб (крошки). */
function pageEdges(slug: string): string[] {
  const page = landingPages.find((p) => p.slug === slug);
  if (!page) return [];
  return [
    ...page.related,
    ...(page.parent ? [page.parent.slug] : []),
  ]
    .map((s) => `/${s}`)
    .filter((s) => s !== HUB);
}

describe('link-graph: достижимость и глубина (EV-T5)', () => {
  const edges = new Map<string, string[]>();
  edges.set(HUB, homeEdges());
  for (const slug of landingSlugs()) {
    edges.set(`/${slug}`, pageEdges(slug));
  }

  // BFS от главной
  const depth = new Map<string, number>([[HUB, 0]]);
  const queue: string[] = [HUB];
  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentDepth = depth.get(current)!;
    for (const next of edges.get(current) ?? []) {
      if (!depth.has(next)) {
        depth.set(next, currentDepth + 1);
        queue.push(next);
      }
    }
  }

  it('все 123 посадочные достижимы с главной', () => {
    expect(landingSlugs()).toHaveLength(123);
    const unreachable = landingSlugs().filter(
      (slug) => !depth.has(`/${slug}`),
    );
    expect(
      unreachable,
      `недостижимы с главной: ${unreachable.join(', ')}`,
    ).toEqual([]);
  });

  it('максимальная глубина до любой посадочной ≤ 3 кликов', () => {
    let maxDepth = 0;
    let deepest = '';
    for (const slug of landingSlugs()) {
      const d = depth.get(`/${slug}`);
      expect(d, `/${slug} недостижима`).toBeDefined();
      if ((d ?? 0) > maxDepth) {
        maxDepth = d ?? 0;
        deepest = slug;
      }
    }
    expect(
      maxDepth,
      `глубина ${maxDepth} у /${deepest} — превышен бюджет 3 кликов`,
    ).toBeLessThanOrEqual(3);
  });

  it('все 10 гео-хабов достижимы за 1 клик (блок Coverage + подвал)', () => {
    for (const hub of coverageHubLinks) {
      expect(depth.get(`/${hub}`), `/${hub}`).toBe(1);
    }
  });

  it('на главной ≤ 50 новых ссылок (Coverage + каталог)', () => {
    const coverageLinks = coverageHubLinks.length + coverageTopLocalityLinks.length;
    expect(coverageHubLinks).toHaveLength(10);
    expect(coverageLinks).toBeLessThanOrEqual(50);
  });

  it('ссылки главной и подвала указывают на существующие посадочные', () => {
    const slugs = new Set(landingSlugs());
    for (const slug of [...footerLandingLinks, ...coverageHubLinks, ...coverageTopLocalityLinks]) {
      expect(slugs.has(slug), `/${slug} нет в реестре landingPages`).toBe(true);
    }
    expect(getServicePage('ceny')).toBeTruthy();
  });
});
