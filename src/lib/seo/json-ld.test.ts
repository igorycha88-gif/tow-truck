import { describe, it, expect } from 'vitest';
import {
  organizationLd,
  websiteLd,
  localBusinessLd,
  serviceLd,
  servicesLd,
  servicePageLd,
  servicePageGraphLd,
  webPageLd,
  faqPageLd,
  breadcrumbLd,
  siteGraphLd,
} from '@/lib/seo/json-ld';
import { servicePages, getServicePage } from '@/config/service-pages';
import { getLandingPage } from '@/config/geo';
import { priceFromLabel } from '@/config/pricing';
import { formatPrice } from '@/lib/utils';
import { ICON_SIZES } from '@/lib/seo/og-icon';

describe('json-ld.organizationLd', () => {
  it('тип Organization и @id', () => {
    const o = organizationLd();
    expect(o['@type']).toBe('Organization');
    expect(String(o['@id'])).toMatch(/#organization$/);
    expect(o.name).toBeTruthy();
  });

  it('содержит телефон и url', () => {
    const o = organizationLd();
    expect(o.telephone).toBe('+79017054540');
    expect(String(o.url)).toMatch(/^https?:\/\//);
  });
});

describe('json-ld.websiteLd', () => {
  it('тип WebSite и ссылка на publisher', () => {
    const w = websiteLd();
    expect(w['@type']).toBe('WebSite');
    expect(w.inLanguage).toBe('ru-RU');
    expect(w.publisher).toEqual({ '@id': expect.stringMatching(/#organization$/) });
  });

  it('alternateName для сниппета имени сайта (EV-T8)', () => {
    const w = websiteLd() as { alternateName: string[] };
    expect(w.alternateName).toEqual(['Эвакуация 24/7', 'эвакуация.online']);
  });
});

describe('json-ld.localBusinessLd (EV-T7: честная карточка)', () => {
  it('тип AutoWrecker (legacy-совместимость)', () => {
    const lb = localBusinessLd();
    expect(lb['@type']).toBe('AutoWrecker');
    expect(String(lb['@id'])).toMatch(/#localbusiness$/);
  });

  it('телефон в E.164-формате; email опускается, если не задан', () => {
    const lb = localBusinessLd();
    expect(lb.telephone).toBe('+79017054540');
    expect(lb.email).toBeUndefined();
  });

  it('круглосуточный режим работы', () => {
    const lb = localBusinessLd() as {
      openingHoursSpecification: { opens: string; closes: string };
    };
    expect(lb.openingHoursSpecification.opens).toBe('00:00');
    expect(lb.openingHoursSpecification.closes).toBe('23:59');
  });

  it('priceRange синхронизирован с единым источником цен (pricing.ts)', () => {
    const lb = localBusinessLd() as { priceRange: string };
    expect(lb.priceRange).toBe(priceFromLabel());
    expect(lb.priceRange).toContain(formatPrice(5000));
  });

  it('адрес без фиктивного streetAddress; только город/регион (EV-T7)', () => {
    const lb = localBusinessLd() as { address: Record<string, unknown> };
    expect(lb.address.addressCountry).toBe('RU');
    expect(lb.address.addressLocality).toBe('Москва');
    expect(lb.address.streetAddress).toBeUndefined();
  });

  it('geo отсутствует без ENV-координат; выводится при ENV с ≥5 знаками (EV-T7)', () => {
    const lbDefault = localBusinessLd() as { geo?: { latitude: number } };
    expect(lbDefault.geo).toBeUndefined();

    process.env.NEXT_PUBLIC_LATITUDE = '55.720832';
    process.env.NEXT_PUBLIC_LONGITUDE = '37.640298';
    const lb = localBusinessLd() as { geo: { latitude: number; longitude: number } };
    expect(lb.geo).toBeDefined();
    expect(String(lb.geo.latitude).split('.')[1].length).toBeGreaterThanOrEqual(5);
    delete process.env.NEXT_PUBLIC_LATITUDE;
    delete process.env.NEXT_PUBLIC_LONGITUDE;
  });

  it('areaServed: City Москва + AdministrativeArea МО (EV-T7)', () => {
    const lb = localBusinessLd() as { areaServed: Array<{ '@type': string; name: string }> };
    expect(lb.areaServed).toContainEqual({ '@type': 'City', name: 'Москва' });
    expect(lb.areaServed).toContainEqual({
      '@type': 'AdministrativeArea',
      name: 'Московская область',
    });
  });

  it('logo — ресурс ≥112px (icon-512, EV-T7)', () => {
    const lb = localBusinessLd() as { logo: string };
    expect(lb.logo).toMatch(/\/icon-512$/);
    expect(ICON_SIZES['icon-512'].width).toBeGreaterThanOrEqual(112);
    expect(ICON_SIZES['icon-512'].height).toBeGreaterThanOrEqual(112);
  });

  it('aggregateRating отсутствует (Google self-serving review policy)', () => {
    const lb = localBusinessLd() as { aggregateRating?: unknown };
    expect(lb.aggregateRating).toBeUndefined();
  });
});

describe('json-ld.serviceLd (каталог, только главная — EV-T8)', () => {
  it('тип Service и provider ссылается на LocalBusiness', () => {
    const s = serviceLd({
      slug: 'light_vehicle',
      title: 'Тест',
      description: 'desc',
      pricing: { kind: 'tariff', baseFee: 5000, perKm: 100 },
      icon: 'Car',
    });
    expect(s['@type']).toBe('Service');
    expect(s.provider).toEqual({ '@id': expect.stringMatching(/#localbusiness$/) });
  });

  it('url — каноническая посадочная, БЕЗ параметров ?service= (EV-T8)', () => {
    const arr = servicesLd();
    for (const s of arr) {
      expect(String(s.url)).not.toContain('?service=');
    }
    const light = arr.find((s) => s.name === 'Эвакуация легковых авто') as { url: string };
    expect(light.url).toMatch(/\/evakuator-legkovyh$/);
  });

  it('для тарифа — Offer с price и ценой за км', () => {
    const s = serviceLd({
      slug: 'light_vehicle',
      title: 'Тест',
      description: 'desc',
      pricing: { kind: 'tariff', baseFee: 5000, perKm: 100 },
      icon: 'Car',
    }) as { offers: { price: number; priceSpecification: { price: number } } };
    expect(s.offers.price).toBe(5000);
    expect(s.offers.priceSpecification.price).toBe(100);
  });

  it('для «по запросу» — Offer без фиксированной цены', () => {
    const s = serviceLd({
      slug: 'commercial',
      title: 'Тест',
      description: 'desc',
      pricing: { kind: 'onRequest' },
      icon: 'Truck',
    }) as { offers: { price?: number; description: string } };
    expect(s.offers.price).toBeUndefined();
    expect(s.offers.description).toMatch(/по запросу/i);
  });

  it('возвращает массив Service по числу услуг в каталоге', () => {
    const arr = servicesLd();
    expect(Array.isArray(arr)).toBe(true);
    expect(arr.length).toBeGreaterThanOrEqual(1);
    expect(arr.every((s) => s['@type'] === 'Service')).toBe(true);
  });
});

describe('json-ld.servicePageLd (посадочные страницы)', () => {
  it('для tariff-цены — Offer с price из каталога (единый источник)', () => {
    const page = getServicePage('evakuator-legkovyh')!;
    const ld = servicePageLd(page) as Record<string, unknown> & {
      offers: { price: number; priceSpecification: { price: number } };
    };
    expect(ld['@type']).toBe('Service');
    expect(ld.offers.price).toBe(5000);
    expect(ld.offers.priceSpecification.price).toBe(100);
  });

  it('для fromMin — Offer с минимальной подачей из pricing.ts', () => {
    const page = getServicePage('evakuator-24-7')!;
    const ld = servicePageLd(page) as Record<string, { price: number }>;
    expect(ld.offers.price).toBe(5000);
  });

  it('url канонический (Punycode-absolute), @id с якорем #service (EV-T8)', () => {
    const page = getServicePage('evakuator-vidnoe')!;
    const ld = servicePageLd(page) as { url: string; '@id': string };
    expect(ld.url).toMatch(/\/evakuator-vidnoe$/);
    expect(ld['@id']).toMatch(/\/evakuator-vidnoe#service$/);
  });

  it('serviceType — короткое название, не H1 целиком (EV-T8)', () => {
    const page = getServicePage('evakuator-vidnoe')!;
    const ld = servicePageLd(page) as { serviceType: string; name: string };
    expect(ld.serviceType).toBe('Эвакуация автомобилей');
    expect(ld.serviceType).not.toBe(ld.name);
  });

  it('все 16 услуг дают валидный Service с Offer', () => {
    servicePages.forEach((page) => {
      const ld = servicePageLd(page) as Record<string, unknown>;
      expect(ld['@type']).toBe('Service');
      expect(ld.name).toBeTruthy();
      expect(ld.description).toBeTruthy();
      const offers = ld.offers as Record<string, unknown>;
      expect(offers['@type']).toBe('Offer');
      expect(offers.priceCurrency).toBe('RUB');
      expect(offers.availability).toBe('https://schema.org/InStock');
    });
  });
});

describe('json-ld.webPageLd + servicePageGraphLd (EV-T8)', () => {
  const page = getLandingPage('evakuator-marino')!;
  const crumbs = [
    { name: 'Главная', url: 'https://example.com/' },
    { name: 'Эвакуатор в Марьино', url: 'https://example.com/evakuator-marino' },
  ];

  it('WebPage.url = canonical, @id = #webpage, isPartOf → #website', () => {
    const wp = webPageLd(page) as Record<string, { '@id': string; url: string }>;
    expect(wp['@type']).toBe('WebPage');
    expect(wp.url).toMatch(/\/evakuator-marino$/);
    expect(String(wp['@id'])).toMatch(/#webpage$/);
    expect(wp.isPartOf['@id']).toMatch(/#website$/);
  });

  it('граф посадочной: ровно один Service, FAQPage, BreadcrumbList и WebPage', () => {
    const graph = servicePageGraphLd(page, crumbs) as { '@graph': Array<{ '@type': string }> };
    const types = graph['@graph'].map((n) => n['@type']);
    expect(types.filter((t) => t === 'WebPage')).toHaveLength(1);
    expect(types.filter((t) => t === 'Service')).toHaveLength(1);
    expect(types.filter((t) => t === 'FAQPage')).toHaveLength(1);
    expect(types.filter((t) => t === 'BreadcrumbList')).toHaveLength(1);
    expect(graph['@graph']).toHaveLength(4);
  });

  it('в графе НЕТ ссылок с параметрами ?service= (EV-T8)', () => {
    for (const p of [getLandingPage('evakuator-marino')!, getServicePage('ceny')!]) {
      const graph = servicePageGraphLd(p, crumbs);
      expect(JSON.stringify(graph)).not.toContain('?service=');
    }
  });
});

describe('json-ld.faqPageLd', () => {
  it('тип FAQPage с mainEntity-массивом вопросов', () => {
    const f = faqPageLd([
      { question: 'В1?', answer: 'О1' },
      { question: 'В2?', answer: 'О2' },
    ]);
    expect(f['@type']).toBe('FAQPage');
    expect(f.mainEntity).toHaveLength(2);
    expect(f.mainEntity[0]).toEqual({
      '@type': 'Question',
      name: 'В1?',
      acceptedAnswer: { '@type': 'Answer', text: 'О1' },
    });
  });

  it('по умолчанию использует каталог faq из config', () => {
    const f = faqPageLd();
    expect(f.mainEntity.length).toBeGreaterThanOrEqual(1);
  });
});

describe('json-ld.breadcrumbLd', () => {
  it('формирует BreadcrumbList с позициями; опциональный @id (EV-T8)', () => {
    const b = breadcrumbLd(
      [
        { name: 'Главная', url: 'https://example.com/' },
        { name: 'Услуги', url: 'https://example.com/uslugi' },
      ],
      'https://example.com/uslugi#breadcrumb',
    ) as Record<string, unknown> & {
      itemListElement: Array<{ position: number }>;
    };
    expect(b['@type']).toBe('BreadcrumbList');
    expect(b.itemListElement[0].position).toBe(1);
    expect(b.itemListElement[1].position).toBe(2);
    expect(b['@id']).toBe('https://example.com/uslugi#breadcrumb');
  });
});

describe('json-ld.siteGraphLd (сквозной граф layout — EV-T8)', () => {
  it('Organization + WebSite + LocalBusiness, БЕЗ каталога Service', () => {
    const g = siteGraphLd();
    expect(g['@context']).toBe('https://schema.org');
    expect(Array.isArray(g['@graph'])).toBe(true);
    const graph = g['@graph'] as Array<{ '@type': string }>;
    const types = graph.map((n) => n['@type']);
    expect(types).toContain('Organization');
    expect(types).toContain('WebSite');
    expect(types).toContain('AutoWrecker');
    expect(types).not.toContain('Service');
  });

  it('во всём графе нет URL с кириллическим хостом', () => {
    const g = siteGraphLd();
    expect(JSON.stringify(g)).not.toContain('эвакуация.online/');
    expect(JSON.stringify(g)).not.toContain('?service=');
  });
});
