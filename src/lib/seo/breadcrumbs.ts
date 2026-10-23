import { absoluteUrl } from '@/lib/seo/url';
import type { BreadcrumbItem } from '@/types';
import type { ServicePageConfig } from '@/types/service-page';

// Навигационная цепочка по требованиям Яндекса (ЧТЗ_Яндекс_SEO_доработка
// 2026-10, TASK-Я-02): ≤3 элементов, каждый name 4–40 символов, «Главная»
// в JSON-LD (в видимых крошках её исключает Яндекс), все URL — Punycode.
// Видимые крошки и BreadcrumbList строятся ОДНИМИ этими функциями — имена
// никогда не расходятся.

/** Видимая цепочка: [родитель-хаб] → текущая (без «Главной»). */
export function breadcrumbItemsFor(page: ServicePageConfig): BreadcrumbItem[] {
  return [
    ...(page.parent ? [{ name: page.parent.name, url: `/${page.parent.slug}` }] : []),
    { name: page.breadcrumbName ?? page.h1, url: `/${page.slug}` },
  ];
}

/** Цепочка для JSON-LD BreadcrumbList: Главная → [хаб] → текущая, абсолютные URL. */
export function breadcrumbGraphItemsFor(page: ServicePageConfig): BreadcrumbItem[] {
  return [{ name: 'Главная', url: '/' }, ...breadcrumbItemsFor(page)].map((i) => ({
    name: i.name,
    url: absoluteUrl(i.url),
  }));
}
