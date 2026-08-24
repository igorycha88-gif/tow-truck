import { describe, it, expect } from 'vitest';
import { buildMetadata, homeMetadata } from '@/lib/seo/metadata';
import { priceFromLabel } from '@/config/pricing';
import { formatPrice } from '@/lib/utils';
import { siteConfig } from '@/config/site';

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

  it('exactTitle: true → title без суффикса имени сайта', () => {
    const m = buildMetadata({ title: 'Тестовый тайтл', exactTitle: true });
    expect(m.title).toBe('Тестовый тайтл');
    expect(m.title).not.toContain(siteConfig.name);
  });

  it('exactTitle: false (по умолчанию) → суффикс имени сайта добавляется', () => {
    const m = buildMetadata({ title: 'Тестовый тайтл' });
    expect(m.title).toBe(`Тестовый тайтл — ${siteConfig.name}`);
  });
});

describe('seo.homeMetadata (ЧТЗ ЭПИК-1: сниппет главной)', () => {
  it('title ≤ 60 символов, ключ «эвакуатор 24/7» в первых 30', () => {
    const m = homeMetadata();
    const title = String(m.title);
    expect(title.length).toBeLessThanOrEqual(60);
    expect(title.toLowerCase().slice(0, 30)).toContain('эвакуатор 24/7');
  });

  it('title содержит гео, время подачи и цену из единого источника', () => {
    const title = String(homeMetadata().title);
    expect(title).toContain('Москва');
    expect(title).toContain('15–30');
    expect(title).toContain(priceFromLabel());
  });

  it('description ≤ 160 символов и содержит обязательные компоненты ЧТЗ', () => {
    const desc = String(homeMetadata().description);
    expect(desc.length).toBeLessThanOrEqual(160);
    expect(desc).toContain('24/7');
    expect(desc).toContain('15–30');
    expect(desc.toLowerCase()).toContain('фиксированная цена');
    expect(desc.toLowerCase()).toContain('своя техника');
    expect(desc).toContain('Звоните сейчас');
  });

  it('телефон НЕ попадает в title сниппета (источник — Яндекс.Бизнес)', () => {
    const title = String(homeMetadata().title);
    expect(title).not.toMatch(/\+7|тел/i);
  });

  it('canonical главной — корень сайта', () => {
    expect(String(homeMetadata().alternates?.canonical)).toMatch(/\/$/);
  });

  it('цена в title синхронна pricing.ts (рассинхрон = баг)', () => {
    const title = String(homeMetadata().title);
    expect(title).toContain(formatPrice(5000));
  });
});
