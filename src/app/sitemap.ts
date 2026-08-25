import type { MetadataRoute } from 'next';
import { siteConfig } from '@/config/site';
import { servicePages } from '@/config/service-pages';
import { landingPages, geoHubs } from '@/config/geo';

// sitemap.xml — генерируется через App Router (см. TECH_STACK.md §2.2, ЧТЗ SEO §3.6).
// Посадочные SEO-страницы добавляются динамически из ОБЪЕДИНЁННОГО реестра
// landingPages (ЧТЗ_SEO_Рост_позиций, ЭПИК-2; ADR-003 — гео-страницы).
const now = new Date();
const hubSlugs = new Set(geoHubs.map((h) => h.slug));

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${siteConfig.url}/`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1,
      alternates: {
        languages: {
          'ru-RU': `${siteConfig.url}/`,
          'x-default': `${siteConfig.url}/`,
        },
      },
    },
    ...landingPages.map((page): MetadataRoute.Sitemap[number] => {
      const isService = servicePages.some((p) => p.slug === page.slug);
      return {
        url: `${siteConfig.url}/${page.slug}`,
        lastModified: now,
        changeFrequency: 'monthly',
        priority: isService || hubSlugs.has(page.slug) ? 0.8 : 0.7,
      };
    }),
    {
      url: `${siteConfig.url}/politika`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ];
}
