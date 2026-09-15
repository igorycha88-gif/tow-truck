import type { ServicePageConfig } from '@/types/service-page';
import { servicePages } from '@/config/service-pages';
import { moscowVao } from './moscow-vao';
import { moscowYuvao } from './moscow-yuvao';
import { moscowYuao } from './moscow-yuao';
import { moscowYuzao } from './moscow-yuzao';
import { moscowZao } from './moscow-zao';
import { moVostok } from './mo-vostok';
import { moYugoVostok } from './mo-yugo-vostok';
import { moYug } from './mo-yug';
import type { GeoDirection, GeoLocality } from './types';

// Гео-модуль (ADR-003): направления → композер → ServicePageConfig.
// landingPages — ЕДИНСТВЕННЫЙ реестр для роутинга (services)/[slug] и sitemap.

export const geoDirections: GeoDirection[] = [
  moscowVao,
  moscowYuvao,
  moscowYuao,
  moscowYuzao,
  moscowZao,
  moVostok,
  moYugoVostok,
  moYug,
];

/** Гео-зона локации для schema.org areaServed. */
const localityAreaName = (dir: GeoDirection, loc: GeoLocality): string =>
  dir.id.startsWith('moscow-')
    ? `район ${loc.name}, Москва`
    : `${loc.name}, Московская область`;

/** Посадочная локации: уникальные данные + общие блоки направления. */
const composeGeoPage = (dir: GeoDirection, loc: GeoLocality): ServicePageConfig => ({
  slug: `evakuator-${loc.slug}`,
  title: loc.title,
  description: loc.description,
  h1: `Эвакуатор ${loc.h1Name ?? loc.nameIn}`,
  lead: loc.lead,
  included: [...loc.localIncluded, ...dir.baseIncluded],
  price: { kind: 'fromMin' },
  priceNote: dir.priceNote(loc.nameIn),
  steps: dir.steps,
  faq: [
    ...loc.localFaq,
    ...dir.baseFaq.map((f) => ({
      question: f.question(loc.nameIn),
      answer: f.answer(loc.nameIn),
    })),
  ],
  related: [dir.hubSlug, ...loc.related],
  orderServiceType: 'light_vehicle',
  parent: { name: dir.hubH1, slug: dir.hubSlug },
  areaName: loc.areaNameOverride ?? localityAreaName(dir, loc),
  ...(loc.sections ? { sections: loc.sections } : {}),
});

/** Хаб направления: обзор + перелинковка на все локации. */
const composeHubPage = (dir: GeoDirection): ServicePageConfig => ({
  slug: dir.hubSlug,
  title: dir.hubTitle,
  description: dir.hubDescription,
  h1: dir.hubH1,
  lead: dir.hubLead,
  included: dir.hubIncluded,
  price: { kind: 'fromMin' },
  priceNote: dir.hubPriceNote,
  steps: dir.steps,
  faq: dir.hubFaq,
  related: [
    ...dir.localities.map((l) => `evakuator-${l.slug}`),
    ...(dir.hubRelatedExtra ?? []),
  ],
  relatedTitle: dir.hubRelatedTitle,
  orderServiceType: 'light_vehicle',
  areaName: dir.hubAreaName,
});

/** Все гео-посадочные: локации + хабы. */
export const geoPages: ServicePageConfig[] = geoDirections.flatMap((dir) => [
  ...dir.localities.map((l) => composeGeoPage(dir, l)),
  composeHubPage(dir),
]);

/** Хабы направлений (для sitemap priority 0.8). */
export const geoHubs: ServicePageConfig[] = geoDirections.map(composeHubPage);

export const getGeoPage = (slug: string): ServicePageConfig | undefined =>
  geoPages.find((p) => p.slug === slug);

/** ОБЪЕДИНЁННЫЙ реестр всех посадочных: услуги + гео. */
export const landingPages: ServicePageConfig[] = [...servicePages, ...geoPages];

export const getLandingPage = (slug: string): ServicePageConfig | undefined =>
  landingPages.find((p) => p.slug === slug);

export const landingSlugs = (): string[] => landingPages.map((p) => p.slug);
