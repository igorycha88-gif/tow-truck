import type { Metadata } from 'next';
import { siteConfig } from '@/config/site';
import { trustStats } from '@/config/company';
import { priceFromLabel } from '@/config/pricing';
import { absoluteUrl, siteOrigin } from '@/lib/seo/url';

// Хелпер metadata (см. SKILL_DEVELOPER.md §7 SEO, ЧТЗ_SEO_Рост_позиций_Вебмастер §4 ЭПИК-1).
// Генераторы JSON-LD вынесены в ./json-ld.ts.
// EV-T1: все абсолютные URL — Punycode через absoluteUrl(). EV-T4: OG/Twitter-картинка
// /opengraph-image (1200×630). EV-T9: noIndex → follow, noCanonical для 404,
// нестандартный og:phone_number убран.

export function buildMetadata({
  title,
  description,
  path = '/',
  noIndex = false,
  noCanonical = false,
  exactTitle = false,
}: {
  title?: string;
  description?: string;
  path?: string;
  noIndex?: boolean;
  /** true → не выводить canonical (404 и другие вне-индексные страницы) */
  noCanonical?: boolean;
  /** true → title как есть (SEO-эталоны ≤60 симв., без суффикса имени сайта) */
  exactTitle?: boolean;
} = {}): Metadata {
  const defaultTitle = `${siteConfig.name} — эвакуатор 24/7`;
  const fullTitle = !title
    ? defaultTitle
    : exactTitle
      ? title
      : `${title} — ${siteConfig.name}`;
  const desc = description || siteConfig.description;
  const url = absoluteUrl(path);
  const ogImage = absoluteUrl(siteConfig.ogImage);

  return {
    metadataBase: new URL(siteOrigin()),
    title: fullTitle,
    description: desc,
    ...(noCanonical ? {} : { alternates: { canonical: url } }),
    openGraph: {
      type: 'website',
      locale: siteConfig.locale,
      url,
      title: fullTitle,
      description: desc,
      siteName: siteConfig.name,
      images: [{ url: ogImage, width: 1200, height: 630, alt: siteConfig.name }],
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description: desc,
      images: [ogImage],
    },
    robots: noIndex
      ? { index: false, follow: true }
      : { index: true, follow: true },
  };
}

// Мета главной страницы (ЧТЗ_SEO_Рост_позиций_Вебмастер §4, ЭПИК-1).
// Title ≤60 симв.: [УТП] + [гео] + [ценовой триггер], ключ «эвакуатор 24/7» — в первых 30.
// Цена и время подачи — из единых источников (pricing.ts, company.ts), без хардкода.
// EV-T9: вызывается из src/app/page.tsx, а не из layout (canonical только у страницы).
export function homeMetadata(): Metadata {
  return buildMetadata({
    title: `Эвакуатор 24/7 Москва и МО — подача ${trustStats.responseMinutes} мин, ${priceFromLabel()}`,
    description: siteConfig.description,
    path: '/',
    exactTitle: true,
  });
}
