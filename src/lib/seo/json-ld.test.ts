import { describe, it, expect } from 'vitest';
import {
  organizationLd,
  websiteLd,
  localBusinessLd,
  serviceLd,
  servicesLd,
  faqPageLd,
  breadcrumbLd,
  siteGraphLd,
} from '@/lib/seo/json-ld';

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
});

describe('json-ld.localBusinessLd', () => {
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

  it('priceRange = «от 5000 ₽»', () => {
    const lb = localBusinessLd() as { priceRange: string };
    expect(lb.priceRange).toBe('от 5000 ₽');
  });

  it('содержит geo-координаты Москвы по умолчанию', () => {
    const lb = localBusinessLd() as { geo: { latitude: number; longitude: number } };
    expect(lb.geo.latitude).toBeCloseTo(55.7558, 3);
    expect(lb.geo.longitude).toBeCloseTo(37.6173, 3);
  });

  it('содержит PostalAddress с addressCountry RU', () => {
    const lb = localBusinessLd() as { address: { addressCountry: string } };
    expect(lb.address.addressCountry).toBe('RU');
  });

  it('aggregateRating отсутствует (Google self-serving review policy)', () => {
    const lb = localBusinessLd() as { aggregateRating?: unknown };
    expect(lb.aggregateRating).toBeUndefined();
  });
});

describe('json-ld.serviceLd', () => {
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
});

describe('json-ld.servicesLd', () => {
  it('возвращает массив Service по числу услуг в каталоге', () => {
    const arr = servicesLd();
    expect(Array.isArray(arr)).toBe(true);
    expect(arr.length).toBeGreaterThanOrEqual(1);
    expect(arr.every((s) => s['@type'] === 'Service')).toBe(true);
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
  it('формирует BreadcrumbList с позициями', () => {
    const b = breadcrumbLd([
      { name: 'Главная', url: 'https://example.com/' },
      { name: 'Услуги', url: 'https://example.com/uslugi' },
    ]);
    expect(b['@type']).toBe('BreadcrumbList');
    expect(b.itemListElement[0].position).toBe(1);
    expect(b.itemListElement[1].position).toBe(2);
  });
});

describe('json-ld.siteGraphLd', () => {
  it('собирает @graph с Organization, WebSite, LocalBusiness и услугами', () => {
    const g = siteGraphLd();
    expect(g['@context']).toBe('https://schema.org');
    expect(Array.isArray(g['@graph'])).toBe(true);
    const graph = g['@graph'] as Array<{ '@type': string }>;
    const types = graph.map((n) => n['@type']);
    expect(types).toContain('Organization');
    expect(types).toContain('WebSite');
    expect(types).toContain('AutoWrecker');
    expect(types.filter((t) => t === 'Service').length).toBeGreaterThanOrEqual(1);
  });
});
