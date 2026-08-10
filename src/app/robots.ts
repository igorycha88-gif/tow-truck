import type { MetadataRoute } from 'next';
import { siteConfig } from '@/config/site';

// robots.txt — генерируется через App Router.
// UTM-дублирование URL не критично: canonical URL проставляется в buildMetadata
// для каждой страницы и работает для Яндекса и Google.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
    },
    sitemap: `${siteConfig.url}/sitemap.xml`,
    host: siteConfig.url,
  };
}
