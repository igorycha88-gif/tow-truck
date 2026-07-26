import type { MetadataRoute } from 'next';
import { siteConfig } from '@/config/site';

// sitemap.xml — генерируется через App Router (см. TECH_STACK.md §2.2).
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    {
      url: `${siteConfig.url}/`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${siteConfig.url}/politika`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ];
}
