import type { MetadataRoute } from 'next';
import { siteConfig } from '@/config/site';

// sitemap.xml — генерируется через App Router (см. TECH_STACK.md §2.2, ЧТЗ SEO §3.6).
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
    {
      url: `${siteConfig.url}/politika`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ];
}
