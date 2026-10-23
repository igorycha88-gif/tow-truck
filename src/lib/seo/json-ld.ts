import { siteConfig } from '@/config/site';
import { company } from '@/config/company';
import { services } from '@/config/services';
import { faq } from '@/config/faq';
import { priceRangeLabel, minBaseFee, priceFromLabel } from '@/config/pricing';
import { catalogServiceToLanding } from '@/config/service-pages';
import { absoluteUrl } from '@/lib/seo/url';
import { formatPrice } from '@/lib/utils';
import type { BreadcrumbItem, FaqItem, ServiceCatalogItem } from '@/types';
import type { ServicePageConfig } from '@/types/service-page';

// Генераторы schema.org JSON-LD (ЧТЗ_SEO_Яндекс_Google.md §3.1; переработка —
// ЧТЗ_SEO_Техническая_корректировка 2026-10, TASK-EV-T1/T7/T8, ADR-015).
// Правила:
// - ВСЕ абсолютные URL — Punycode через absoluteUrl() (кириллица в URL запрещена);
// - в layout — сквозной граф Organization + WebSite + LocalBusiness(AutoWrecker);
// - каталог Service — только на главной; url услуги — каноническая посадочная,
//   никаких `?service=` (параметры не индексируются);
// - посадочная — один @graph: WebPage + Service + FAQPage + BreadcrumbList;
// - адрес организации честный: без streetAddress по умолчанию (ENV при наличии),
//   geo — только из ENV с ≥5 знаками (фиктивный «центр Москвы» убран, EV-T7);
// - aggregateRating намеренно опущен (Google self-serving policy).

const SITE_ID = `${absoluteUrl('/')}#website`;
const ORG_ID = `${absoluteUrl('/')}#organization`;
const LOCAL_ID = `${absoluteUrl('/')}#localbusiness`;

const phoneE164 = (): string => company.phoneHref.replace('tel:', '');

// Карты/соцсети для sameAs (Яндекс.Карты, 2GIS и пр. — через ENV). Пустой
// массив не выводится вовсе (EV-T7).
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

const withSameAs = (obj: Record<string, unknown>): Record<string, unknown> => {
  const links = sameAs();
  if (links.length > 0) obj.sameAs = links;
  return obj;
};

// Логотип организации ≥112×112 (Google LocalBusiness guidelines; EV-T7).
const logoUrl = (): string => absoluteUrl('/icon-512');

export function organizationLd() {
  const org: Record<string, unknown> = {
    '@type': 'Organization',
    '@id': ORG_ID,
    name: siteConfig.name,
    url: absoluteUrl('/'),
    logo: logoUrl(),
    telephone: phoneE164(),
  };
  if (company.email) org.email = company.email;
  return withSameAs(org);
}

export function websiteLd() {
  return {
    '@type': 'WebSite',
    '@id': SITE_ID,
    url: absoluteUrl('/'),
    name: siteConfig.name,
    // Названия для Google-сниппета имени сайта (EV-T8)
    alternateName: ['Эвакуация 24/7', 'эвакуация.online'],
    description: siteConfig.description,
    inLanguage: 'ru-RU',
    publisher: { '@id': ORG_ID },
  };
}

// Честный почтовый адрес (EV-T7): по умолчанию только город/регион — без
// фиктивной улицы. Реальный адрес — через NEXT_PUBLIC_ADDRESS_*.
const postalAddress = (): Record<string, unknown> => {
  const address: Record<string, unknown> = {
    '@type': 'PostalAddress',
    addressCountry: 'RU',
  };
  const street = process.env.NEXT_PUBLIC_ADDRESS_STREET;
  if (street) {
    address.streetAddress = street;
    if (process.env.NEXT_PUBLIC_ADDRESS_POSTAL_CODE) {
      address.postalCode = process.env.NEXT_PUBLIC_ADDRESS_POSTAL_CODE;
    }
    address.addressLocality =
      process.env.NEXT_PUBLIC_ADDRESS_LOCALITY || 'Москва';
    address.addressRegion = process.env.NEXT_PUBLIC_ADDRESS_REGION || 'Москва';
  } else {
    address.addressLocality = 'Москва';
    address.addressRegion = 'Москва';
  }
  return address;
};

// Координаты — только при явных ENV, ≥5 знаков после запятой (EV-T7).
const geoCoordinates = (): Record<string, unknown> | undefined => {
  const lat = process.env.NEXT_PUBLIC_LATITUDE;
  const lng = process.env.NEXT_PUBLIC_LONGITUDE;
  if (!lat || !lng) return undefined;
  const latitude = Number(Number(lat).toFixed(5));
  const longitude = Number(Number(lng).toFixed(5));
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return undefined;
  return { '@type': 'GeoCoordinates', latitude, longitude };
};

// LocalBusiness / AutoWrecker — расширенная карточка для локального SEO.
export function localBusinessLd() {
  const lb: Record<string, unknown> = {
    '@type': 'AutoWrecker',
    '@id': LOCAL_ID,
    name: siteConfig.name,
    description: siteConfig.description,
    telephone: phoneE164(),
    url: absoluteUrl('/'),
    image: absoluteUrl('/opengraph-image'),
    logo: logoUrl(),
    priceRange: priceRangeLabel(),
    address: postalAddress(),
    areaServed: [
      { '@type': 'City', name: 'Москва' },
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
    // aggregateRating намеренно ОПУЩЕН: Google Review Snippet policy запрещает
    // self-serving rating на собственном сайте без реальных отзывов с независимых
    // площадок (Яндекс.Карты, 2GIS, Google). Вернуть, когда будут реальные отзывы
    // с external Review-объектами и sameAs-ссылками на источник (см. SEO_SETUP.md).
    parentOrganization: { '@id': ORG_ID },
  };
  const geo = geoCoordinates();
  if (geo) lb.geo = geo;
  if (company.email) lb.email = company.email;
  return withSameAs(lb);
}

// Каталог услуг для ГЛАВНОЙ страницы (EV-T8). URL — каноническая посадочная
// из catalogServiceToLanding; если посадочной нет — якорь каталога на главной.
// Ссылки с параметрами (?service=) запрещены.
export function serviceLd(service: ServiceCatalogItem) {
  const landingSlug = catalogServiceToLanding[service.slug];
  const url = landingSlug ? absoluteUrl(`/${landingSlug}`) : absoluteUrl('/#services');

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
    url,
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

// Service + Offer для посадочной SEO-страницы (ЧТЗ_SEO_Рост_позиций, ЭПИК-2).
// Цена Offer — из единого источника (pricing.ts / каталога), синхронно с контентом.
// EV-T8: @id-якорь #service на каноническом URL; serviceType — короткое название
// услуги, не H1 целиком.
export function servicePageLd(page: ServicePageConfig): Record<string, unknown> {
  const url = absoluteUrl(`/${page.slug}`);
  const offer: Record<string, unknown> = {
    '@type': 'Offer',
    priceCurrency: 'RUB',
    url,
    availability: 'https://schema.org/InStock',
  };

  const price = page.price;
  if (price.kind === 'tariff') {
    const priceSlug = price.serviceSlug;
    const svc = services.find((s) => s.slug === priceSlug);
    if (svc && svc.pricing.kind === 'tariff') {
      offer.price = svc.pricing.baseFee;
      offer.priceSpecification = {
        '@type': 'UnitPriceSpecification',
        price: svc.pricing.perKm,
        priceCurrency: 'RUB',
        unitText: 'за 1 км',
      };
      offer.description = `Подача от ${formatPrice(svc.pricing.baseFee)} + ${formatPrice(svc.pricing.perKm)}/км`;
    } else {
      offer.price = minBaseFee();
      offer.description = `Подача ${priceFromLabel()}`;
    }
  } else if (page.price.kind === 'fromMin') {
    offer.price = minBaseFee();
    offer.description = `Подача ${priceFromLabel()}`;
  } else {
    offer.description = 'Цена по запросу';
  }

  return {
    '@type': 'Service',
    '@id': `${url}#service`,
    name: page.h1,
    description: page.description,
    serviceType: 'Эвакуация автомобилей',
    url,
    provider: { '@id': LOCAL_ID },
    areaServed: [
      { '@type': 'AdministrativeArea', name: 'Москва' },
      { '@type': 'AdministrativeArea', name: 'Московская область' },
      ...(page.areaName
        ? [{ '@type': 'AdministrativeArea', name: page.areaName }]
        : []),
    ],
    offers: offer,
  };
}

// FAQPage — расширенный сниппет в выдаче Яндекса и AI-поиска.
// FAQ-сниппеты Google ОТКЛЮЧЕНЫ с 07.05.2026 (Rich Results свёрнуты) — разметку
// оставляем: её читают Яндекс и AI-поиск, вреда для Google нет (EV-T8).
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
export function breadcrumbLd(items: BreadcrumbItem[], id?: string) {
  const base: Record<string, unknown> = {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
  if (id) base['@id'] = id;
  return base;
}

// WebPage текущей посадочной (EV-T8): связывает страницу с сайтом, услугой
// и крошками через @id-ссылки.
export function webPageLd(page: ServicePageConfig): Record<string, unknown> {
  const url = absoluteUrl(`/${page.slug}`);
  return {
    '@type': 'WebPage',
    '@id': `${url}#webpage`,
    url,
    name: page.title,
    description: page.description,
    inLanguage: 'ru-RU',
    isPartOf: { '@id': SITE_ID },
    about: { '@id': `${url}#service` },
    breadcrumb: { '@id': `${url}#breadcrumb` },
  };
}

// Полный @graph ПОСАДОЧНОЙ страницы (EV-T8): WebPage + Service + FAQPage +
// BreadcrumbList в одном скрипте. Сквозные сущности (Organization/WebSite/
// LocalBusiness) рендерятся в root layout.
export function servicePageGraphLd(
  page: ServicePageConfig,
  breadcrumbItems: BreadcrumbItem[],
): Record<string, unknown> {
  const url = absoluteUrl(`/${page.slug}`);
  return {
    '@context': 'https://schema.org',
    '@graph': [
      webPageLd(page),
      servicePageLd(page),
      faqPageLd(page.faq),
      breadcrumbLd(breadcrumbItems, `${url}#breadcrumb`),
    ],
  };
}

// Сквозной @graph для root layout: Organization + WebSite + LocalBusiness.
// Каталог услуг (servicesLd) больше НЕ включается на все страницы (EV-T8) —
// он выводится только на главной (src/app/page.tsx).
export function siteGraphLd() {
  return {
    '@context': 'https://schema.org',
    '@graph': [organizationLd(), websiteLd(), localBusinessLd()],
  };
}
