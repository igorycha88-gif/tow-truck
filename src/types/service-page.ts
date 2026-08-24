import type { FaqItem, ServiceType } from '@/types';

// Тип посадочной SEO-страницы (ЧТЗ_SEO_Рост_позиций_Вебмастер §4, ЭПИК-2).
// Страница = 1 конфиг-файл в src/config/service-pages/, рендер — универсальный
// шаблон ServicePage через реестр (index.ts). Цены — только по ссылке на источник.

/** Модель цены на посадочной: тариф из каталога / «от минимума» / «по запросу». */
export type ServicePagePrice =
  | { kind: 'tariff'; serviceSlug: ServiceType }
  | { kind: 'fromMin' }
  | { kind: 'onRequest' };

export type ServicePageInclude = {
  title: string;
  text: string;
};

export type ServicePageStep = {
  title: string;
  text: string;
};

export type ServicePageConfig = {
  /** URL-слаг, напр. `evakuator-24-7` */
  slug: string;
  /** meta title ≤60 симв., уникальный, ключ в первых 30 символах */
  title: string;
  /** meta description ≤160 симв., уникальный */
  description: string;
  /** H1 страницы (1 шт.) */
  h1: string;
  /** Лид-абзацы: ключ + УТП */
  lead: string[];
  /** Блок «Что входит в услугу» */
  included: ServicePageInclude[];
  /** Цена — ссылка на единый источник, не хардкод */
  price: ServicePagePrice;
  /** Пояснение к цене (условия, что входит) */
  priceNote?: string;
  /** «Как проходит эвакуация»: 3–5 шагов */
  steps: ServicePageStep[];
  /** FAQ: 3–5 вопросов (JSON-LD FAQPage) */
  faq: FaqItem[];
  /** Слаги смежных страниц (перелинковка), 2–3 шт. */
  related: string[];
  /** Тип услуги для предзаполнения формы заявки */
  orderServiceType: ServiceType;
};
