import { siteConfig } from '@/config/site';

// ЕДИНСТВЕННЫЙ способ строить абсолютные URL (ЧТЗ_SEO_Техническая_корректировка
// 2026-10, TASK-EV-T1 / ADR-015). Яндекс запрещает кириллицу в robots.txt и
// ожидает Punycode для IDN-доменов; WHATWG URL сам приводит хост к ASCII.
// siteConfig.url остаётся человекочитаемым (ENV), Punycode — только в URL-выходе.

/** Origin сайта в ASCII (Punycode): https://xn--80aae0ai8cwa4cza.online */
export const siteOrigin = (): string => new URL(siteConfig.url).origin;

/** Абсолютный URL для canonical, sitemap, robots, JSON-LD, крошек. path начинается с «/». */
export const absoluteUrl = (path = '/'): string =>
  new URL(path, siteOrigin() + '/').toString();
