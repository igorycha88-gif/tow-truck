import type { FaqItem } from '@/types';
import type { ServicePageInclude, ServicePageStep } from '@/types/service-page';

// Типы гео-модуля (ADR-003): данные локаций → композер → ServicePageConfig.
// Уникальный контент (меты, лиды, локальные карточки и FAQ) хранится в данных
// локации; общие блоки (шаги, базовые карточки, базовые FAQ) — в направлении.

/** Идентификатор направления (округ Москвы / направление Подмосковья). */
export type GeoDirectionId =
  | 'moscow-vao'
  | 'moscow-yuao'
  | 'moscow-yuvao'
  | 'mo-vostok'
  | 'mo-yugo-vostok'
  | 'mo-yug';

/** Локация: район Москвы или город/посёлок МО ≤30 км от МКАД. */
export type GeoLocality = {
  /** Слаг без префикса, напр. `marino` → `/evakuator-marino` */
  slug: string;
  /** Название: «Марьино» */
  name: string;
  /** Название с предлогом: «в Марьино», «в Люберцах» */
  nameIn: string;
  /** Ключ H1 без предлога (разговорный запрос): «Балашиха» → H1 «Эвакуатор Балашиха»; по умолчанию — nameIn */
  h1Name?: string;
  /** Переопределение areaServed для schema.org (трассы: «шоссе Энтузиастов, Москва») */
  areaNameOverride?: string;
  /** Удалённость от МКАД, км (только города МО) */
  distanceKm?: number;
  /** meta title ≤60 симв., ключ в первых 30 */
  title: string;
  /** meta description ≤160 симв., уникальный */
  description: string;
  /** Лид-абзацы (2 шт.), уникальные: локальные улицы, шоссе, метро */
  lead: string[];
  /** Локальные карточки «Что входит» (3 шт.) — уникальные */
  localIncluded: ServicePageInclude[];
  /** Локальные FAQ (2 шт.) — уникальные */
  localFaq: FaqItem[];
  /** Доп. слаги перелинковки (полные, 2 шт.): соседи/услуги; хаб добавляется автоматически */
  related: string[];
};

/** Базовый FAQ направления: вопрос/ответ генерируются с именем локации. */
export type GeoBaseFaq = {
  question: (nameIn: string) => string;
  answer: (nameIn: string) => string;
};

/** Направление: хаб-страница + общие блоки для локаций. */
export type GeoDirection = {
  id: GeoDirectionId;
  /** Слаг хаба направления, напр. `evakuator-yuvao-moskvy` */
  hubSlug: string;
  hubTitle: string;
  hubDescription: string;
  hubH1: string;
  hubLead: string[];
  hubIncluded: ServicePageInclude[];
  hubPriceNote: string;
  hubFaq: FaqItem[];
  /** Заголовок блока перелинковки хаба */
  hubRelatedTitle: string;
  /** Доп. слаги в перелинковке хаба (напр., существующее Видное для юга МО) */
  hubRelatedExtra?: string[];
  /** Гео-зона хаба для schema.org areaServed */
  hubAreaName: string;
  /** Общие карточки «Что входит» для всех локаций направления (3 шт.) */
  baseIncluded: ServicePageInclude[];
  /** Общие FAQ направления (2 шт.), уникализируются именем локации */
  baseFaq: GeoBaseFaq[];
  /** Общие шаги «Как проходит эвакуация» (4 шт.) */
  steps: ServicePageStep[];
  /** Генератор пояснения к цене для локации */
  priceNote: (nameIn: string) => string;
  localities: GeoLocality[];
};
