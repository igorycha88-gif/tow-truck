import type { Metadata } from 'next';
import { siteConfig } from '@/config/site';
import { company, trustStats } from '@/config/company';
import { priceFromLabel } from '@/config/pricing';

// Хелпер metadata (см. SKILL_DEVELOPER.md §7 SEO, ЧТЗ_SEO_Рост_позиций_Вебмастер §4 ЭПИК-1).
// Генераторы JSON-LD вынесены в ./json-ld.ts.

export function buildMetadata({
  title,
  description,
  path = '/',
  noIndex = false,
  exactTitle = false,
}: {
  title?: string;
  description?: string;
  path?: string;
  noIndex?: boolean;
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
  const url = `${siteConfig.url}${path}`;
  const other: Record<string, string> = { 'og:phone_number': company.phone };
  if (company.email) other['og:email'] = company.email;

  return {
    metadataBase: new URL(siteConfig.url),
    title: fullTitle,
    description: desc,
    alternates: { canonical: url },
    openGraph: {
      type: 'website',
      locale: siteConfig.locale,
      url,
      title: fullTitle,
      description: desc,
      siteName: siteConfig.name,
      images: [{ url: siteConfig.ogImage, width: 1200, height: 630, alt: siteConfig.name }],
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description: desc,
      images: [siteConfig.ogImage],
    },
    robots: noIndex
      ? { index: false, follow: false }
      : { index: true, follow: true },
    other,
  };
}

// Мета главной страницы (ЧТЗ_SEO_Рост_позиций_Вебмастер §4, ЭПИК-1).
// Title ≤60 симв.: [УТП] + [гео] + [ценовой триггер], ключ «эвакуатор 24/7» — в первых 30.
// Цена и время подачи — из единых источников (pricing.ts, company.ts), без хардкода.
export function homeMetadata(): Metadata {
  return buildMetadata({
    title: `Эвакуатор 24/7 Москва и МО — подача ${trustStats.responseMinutes} мин, ${priceFromLabel()}`,
    description: siteConfig.description,
    path: '/',
    exactTitle: true,
  });
}
