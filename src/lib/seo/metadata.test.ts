import { describe, it, expect } from 'vitest';
import { buildMetadata, localBusinessLd } from '@/lib/seo/metadata';

describe('seo.buildMetadata', () => {
  it('формирует title с именем сайта (happy path)', () => {
    const m = buildMetadata({ title: 'Тест' });
    expect(m.title).toMatch(/Тест/);
  });

  it('использует title по умолчанию если не задан (edge case)', () => {
    const m = buildMetadata();
    expect(typeof m.title).toBe('string');
    expect(m.title).toMatch(/эвакуатор/i);
  });

  it('формирует canonical URL из path', () => {
    const m = buildMetadata({ path: '/politika' });
    expect(m.alternates?.canonical).toMatch(/\/politika$/);
  });

  it('выключает индексацию при noIndex', () => {
    const m = buildMetadata({ noIndex: true });
    expect(m.robots).toEqual({ index: false, follow: false });
  });

  it('включает индексацию по умолчанию', () => {
    const m = buildMetadata();
    expect(m.robots).toEqual({ index: true, follow: true });
  });

  it('содержит openGraph и twitter', () => {
    const m = buildMetadata();
    expect(m.openGraph).toBeDefined();
    expect(m.twitter).toBeDefined();
  });
});

describe('seo.localBusinessLd', () => {
  it('возвращает schema.org объект типа AutoWrecker', () => {
    const ld = localBusinessLd();
    expect(ld['@context']).toBe('https://schema.org');
    expect(ld['@type']).toBe('AutoWrecker');
  });

  it('содержит телефон и регион', () => {
    const ld = localBusinessLd();
    expect(ld.telephone).toBeTruthy();
    expect(ld.areaServed).toContain('Москва');
  });

  it('круглосуточный режим работы', () => {
    const ld = localBusinessLd() as { openingHoursSpecification: { opens: string; closes: string } };
    expect(ld.openingHoursSpecification.opens).toBe('00:00');
    expect(ld.openingHoursSpecification.closes).toBe('23:59');
  });
});
