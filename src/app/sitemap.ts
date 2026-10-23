import type { MetadataRoute } from 'next';
import { servicePages } from '@/config/service-pages';
import { landingPages, geoHubs } from '@/config/geo';
import { contentLastModified } from '@/config/seo-dates';
import { absoluteUrl } from '@/lib/seo/url';

// sitemap.xml (ЧТЗ_SEO_Техническая_корректировка 2026-10, TASK-EV-T3):
// - только индексируемые канонические URL (главная + 123 посадочные из
//   ОБЪЕДИНЁННОГО реестра landingPages); /politika (noindex) НЕ включается;
// - hreflang НЕ выводится: сайт одноязычный (ru), hreflang не нужен;
// - lastmod — дата контента (updatedAt конфига или CONTENT_UPDATED_AT релиза),
//   НЕ время сборки: Google игнорирует неточный lastmod;
// - priority оставлен (Яндекс учитывает при порядке обхода), changefreq удалён
//   (Google игнорирует, Яндекс не использует).

const hubSlugs = new Set(geoHubs.map((h) => h.slug));

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: absoluteUrl('/'),
      lastModified: contentLastModified(),
      priority: 1,
    },
    ...landingPages.map((page): MetadataRoute.Sitemap[number] => {
      const isService = servicePages.some((p) => p.slug === page.slug);
      return {
        url: absoluteUrl(`/${page.slug}`),
        lastModified: contentLastModified(page.updatedAt),
        priority: isService || hubSlugs.has(page.slug) ? 0.8 : 0.7,
      };
    }),
  ];
}
