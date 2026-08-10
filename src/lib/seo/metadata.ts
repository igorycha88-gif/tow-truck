import type { Metadata } from 'next';
import { siteConfig } from '@/config/site';
import { company } from '@/config/company';

// Хелпер metadata (см. SKILL_DEVELOPER.md §7 SEO, ЧТЗ_SEO_Яндекс_Google.md §3.2).
// Генераторы JSON-LD вынесены в ./json-ld.ts.

export function buildMetadata({
  title,
  description,
  path = '/',
  noIndex = false,
}: {
  title?: string;
  description?: string;
  path?: string;
  noIndex?: boolean;
} = {}): Metadata {
  const fullTitle = title
    ? `${title} — ${siteConfig.name}`
    : `${siteConfig.name} — эвакуатор 24/7`;
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
