import { siteConfig } from '@/config/site';
import { company, trustStats } from '@/config/company';
import { services } from '@/config/services';
import { faq } from '@/config/faq';
import type { BreadcrumbItem, FaqItem, ServiceCatalogItem } from '@/types';

// Генераторы schema.org JSON-LD (см. ЧТЗ_SEO_Яндекс_Google.md §3.1).
// Все объекты собираются в один @graph — рекомендуемый Google/Яндекс формат.
// Используются @id-ссылки для связи сущностей (graph best practice).

const SITE_URL = siteConfig.url;
const SITE_ID = `${SITE_URL}/#website`;
const ORG_ID = `${SITE_URL}/#organization`;
const LOCAL_ID = `${SITE_URL}/#localbusiness`;

const phoneE164 = (): string => company.phoneHref.replace('tel:', '');

// Карты/соцсети для sameAs (Яндекс.Карты, 2GIS и пр. — через ENV).
const sameAs = (): string[] => {
  const links: string[] = [];
  if (company.telegram) links.push(company.telegram);
  if (company.whatsapp) {
    links.push(`https://wa.me/${company.whatsapp.replace(/[^0-9]/g, '')}`);
  }
  const yandexMaps = process.env.NEXT_PUBLIC_YANDEX_MAPS_URL;
  if (yandexMaps) links.push(yandexMaps);
  const twoGis = process.env.NEXT_PUBLIC_2GIS_URL;
  if (twoGis) links.push(twoGis);
  return links;
};

const logoUrl = (): string => `${SITE_URL}/icon`;

export function organizationLd() {
  const org: Record<string, unknown> = {
    '@type': 'Organization',
    '@id': ORG_ID,
    name: siteConfig.name,
    url: SITE_URL,
    logo: logoUrl(),
    telephone: phoneE164(),
    sameAs: sameAs(),
  };
  if (company.email) org.email = company.email;
  return org;
}

export function websiteLd() {
  return {
    '@type': 'WebSite',
    '@id': SITE_ID,
    url: SITE_URL,
    name: siteConfig.name,
    description: siteConfig.description,
    inLanguage: 'ru-RU',
    publisher: { '@id': ORG_ID },
  };
}

// LocalBusiness / AutoWrecker — расширенная карточка для локального SEO.
export function localBusinessLd() {
  const lat = parseFloat(process.env.NEXT_PUBLIC_LATITUDE || '55.7558');
  const lng = parseFloat(process.env.NEXT_PUBLIC_LONGITUDE || '37.6173');

  const lb: Record<string, unknown> = {
    '@type': 'AutoWrecker',
    '@id': LOCAL_ID,
    name: siteConfig.name,
    description: siteConfig.description,
    telephone: phoneE164(),
    url: SITE_URL,
    image: `${SITE_URL}/opengraph-image`,
    logo: logoUrl(),
    priceRange: 'от 5000 ₽',
    address: {
      '@type': 'PostalAddress',
      addressCountry: 'RU',
      addressLocality: 'Москва',
      addressRegion: 'Московская область',
      streetAddress: company.address,
    },
    geo: { '@type': 'GeoCoordinates', latitude: lat, longitude: lng },
    areaServed: [
      { '@type': 'AdministrativeArea', name: 'Москва' },
      { '@type': 'AdministrativeArea', name: 'Московская область' },
    ],
    openingHoursSpecification: {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: [
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday',
        'Sunday',
      ],
      opens: '00:00',
      closes: '23:59',
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: trustStats.rating,
      bestRating: 5,
      worstRating: 1,
      reviewCount: trustStats.ordersDone,
    },
    sameAs: sameAs(),
    parentOrganization: { '@id': ORG_ID },
  };
  if (company.email) lb.email = company.email;
  return lb;
}

// Service — отдельная карточка для каждой услуги.
export function serviceLd(service: ServiceCatalogItem) {
  const base: Record<string, unknown> = {
    '@type': 'Service',
    name: service.title,
    description: service.description,
    provider: { '@id': LOCAL_ID },
    serviceType: 'Эвакуация автомобилей',
    areaServed: [
      { '@type': 'AdministrativeArea', name: 'Москва' },
      { '@type': 'AdministrativeArea', name: 'Московская область' },
    ],
    url: `${SITE_URL}/?service=${service.slug}#order`,
  };

  base.offers =
    service.pricing.kind === 'tariff'
      ? {
          '@type': 'Offer',
          price: service.pricing.baseFee,
          priceCurrency: 'RUB',
          priceSpecification: {
            '@type': 'UnitPriceSpecification',
            price: service.pricing.perKm,
            priceCurrency: 'RUB',
            unitText: 'за 1 км',
          },
          description: `Подача от ${service.pricing.baseFee} ₽ + ${service.pricing.perKm} ₽/км`,
          availability: 'https://schema.org/InStock',
        }
      : {
          '@type': 'Offer',
          priceCurrency: 'RUB',
          description: 'Цена по запросу',
          availability: 'https://schema.org/InStock',
        };

  return base;
}

export function servicesLd(): Record<string, unknown>[] {
  return services.map(serviceLd);
}

// FAQPage — даёт расширенный сниппет в выдаче Яндекса и Google.
export function faqPageLd(items: FaqItem[] = faq) {
  return {
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  };
}

// BreadcrumbList — навигационные хлебные крошки в выдаче.
export function breadcrumbLd(items: BreadcrumbItem[]) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

// Полный @graph: Organization + WebSite + LocalBusiness + все услуги.
// Размещается в root layout (один скрипт на все страницы).
export function siteGraphLd() {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      organizationLd(),
      websiteLd(),
      localBusinessLd(),
      ...servicesLd(),
    ],
  };
}
