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

/** Таблица в доп. секции посадочной (EV-07 тарифы, EV-08 сравнение служб). */
export type ServicePageTable = {
  head: string[];
  rows: string[][];
  /** Примечание под таблицей: источник данных, дисклеймер. */
  note?: string;
};

/** Доп. H2-секция посадочной спецформата (ЧТЗ_эвакуация_online_SEO v2, EV-07/EV-08). */
export type ServicePageSection = {
  /** Якорь секции, уникальный в пределах страницы. */
  id: string;
  /** Заголовок H2. */
  title: string;
  /** Абзацы текста под заголовком. */
  paragraphs?: string[];
  /** Маркированный список. */
  bullets?: string[];
  /** Таблица (адаптивная, с горизонтальной прокруткой на мобиле). */
  table?: ServicePageTable;
  /** Показать телефонный CTA-блок в конце секции. */
  cta?: boolean;
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
  /** Доп. H2-секции спецформата: тарифы, сравнение служб (EV-07/EV-08). */
  sections?: ServicePageSection[];
  /** Заголовок блока шагов (дефолт «Как проходит эвакуация»). */
  stepsTitle?: string;
  /** Заголовок блока «Что входит» (дефолт «Что входит в услугу»). */
  includedTitle?: string;
  /** Заголовок блока перелинковки (для гео-хабов), дефолт «Смежные услуги» */
  relatedTitle?: string;
  /** Родительская страница (гео-хаб направления) для хлебных крошек */
  parent?: ServicePageParent;
  /** Конкретная гео-зона (район/город) для schema.org areaServed */
  areaName?: string;
};

/** Родительская страница в хлебных крошках (ADR-003). */
export type ServicePageParent = {
  name: string;
  slug: string;
};
