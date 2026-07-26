import type { Metadata } from 'next';
import { siteConfig } from '@/config/site';
import { company } from '@/config/company';

// Хелперы для metadata (см. SKILL_DEVELOPER.md §7 SEO).

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
  const fullTitle = title ? `${title} — ${siteConfig.name}` : `${siteConfig.name} — эвакуатор 24/7`;
  const desc = description || siteConfig.description;
  const url = `${siteConfig.url}${path}`;

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
    other: {
      'og:phone_number': company.phone,
    },
  };
}

// LocalBusiness JSON-LD (главная страница) — см. TECH_STACK.md §2.2.
export function localBusinessLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'AutoWrecker',
    name: siteConfig.name,
    description: siteConfig.description,
    telephone: company.phoneHref.replace('tel:', ''),
    url: siteConfig.url,
    areaServed: ['Москва', 'Московская область'],
    openingHoursSpecification: {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      opens: '00:00',
      closes: '23:59',
    },
    priceRange: 'от 2000 ₽',
  };
}
