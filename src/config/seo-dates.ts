// Даты контентных релизов для честного lastmod в sitemap.xml
// (ЧТЗ_SEO_Техническая_корректировка 2026-10, TASK-EV-T3).
// Google учитывает lastmod только если он «последовательно точен»: время сборки
// (`new Date()`) обесценивает дату для всех URL. Правило: при каждом SEO-релизе
// с изменением контента даты CONTENT_UPDATED_AT обновляется вручную (или задаётся
// точный `updatedAt` в конфиге изменённой страницы).

/** Дата последнего контентного релиза (v0.19.0: ночная цена «называет диспетчер», перелинковка). */
export const CONTENT_UPDATED_AT = '2026-10-23T00:00:00+03:00';

/** lastModified для sitemap: приоритет — updatedAt страницы, иначе дата релиза. */
export const contentLastModified = (updatedAt?: string): Date =>
  new Date(updatedAt ?? CONTENT_UPDATED_AT);
