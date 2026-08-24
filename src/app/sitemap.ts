import type { MetadataRoute } from 'next';
import { siteConfig } from '@/config/site';
import { servicePages } from '@/config/service-pages';

// sitemap.xml — генерируется через App Router (см. TECH_STACK.md §2.2, ЧТЗ SEO §3.6).
// Посадочные SEO-страницы добавляются динамически из реестра (ЧТЗ_SEO_Рост_позиций, ЭПИК-2).
const now = new Date();

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
    ...servicePages.map((page): MetadataRoute.Sitemap[number] => ({
      url: `${siteConfig.url}/${page.slug}`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.8,
    })),
    {
      url: `${siteConfig.url}/politika`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ];
}
