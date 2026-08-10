import { describe, it, expect } from 'vitest';
import { buildMetadata } from '@/lib/seo/metadata';

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

  it('содержит og:phone_number в other', () => {
    const m = buildMetadata();
    const other = m.other as Record<string, string>;
    expect(other['og:phone_number']).toBe('+7 (901) 705-45-40');
  });

  it('не добавляет og:email, когда email не задан (edge case)', () => {
    const m = buildMetadata();
    const other = m.other as Record<string, string>;
    expect(other['og:email']).toBeUndefined();
  });
});
