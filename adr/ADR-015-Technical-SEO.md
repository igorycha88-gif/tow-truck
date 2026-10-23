# ADR-015: Техническое SEO — канонический URL и граф ссылок

**Дата:** 2026-10-23
**Статус:** Accepted
**Контекст:** Аудит кода v0.18.0 (ЧТЗ `требования/ЧТЗ_SEO_Техническая_корректировка_2026-10.md`)
выявил потери технического SEO-слоя: кириллица в robots.txt (Яндекс запрещает),
разнобой хоста (canonical в Punycode, sitemap/JSON-LD/крошки на кириллице),
битый `og:image` (`/og.png` → 404 на всех страницах), `noindex`-страница в sitemap,
`lastmod` = время сборки (Google перестаёт доверять), нет `Clean-param` (дубли
`?utm_*`/`?yclid`/`?service`), глубина посадочных до 9 кликов (42 страницы вне
3 кликов), каталог `Service` с URL `/?service=…#order` на всех страницах,
фиктивный адрес/координаты в LocalBusiness, обещания «без ночной наценки»
(противоречит решению владельца о ночном тарифе +30%).

## Решение

### 1. Единый канонический URL — `src/lib/seo/url.ts`

`siteOrigin()` / `absoluteUrl(path)` — единственный способ строить абсолютные
URL; WHATWG URL сам приводит IDN-хост к Punycode. Используется в metadata,
json-ld, Breadcrumbs, sitemap, robots. `siteConfig.url` (ENV) остаётся
читаемым. Grep-тест запрещает конкатенации `${siteConfig.url}` вне `url.ts`.

### 2. robots.txt / sitemap.xml — по правилам Яндекса и Google

- `app/robots.txt/route.ts` (raw-текст, `MetadataRoute.Robots` не поддерживает
  `Clean-param`): ASCII-only, `Disallow: /api/,/metrics/,/grafana/`,
  `Clean-param` для utm/yclid/service, БЕЗ `Host` (не поддерживается Яндексом).
- `app/sitemap.ts`: только индексируемые (124 URL, без `/politika`), без
  hreflang (сайт одноязычный), `lastmod` из `src/config/seo-dates.ts`
  (`CONTENT_UPDATED_AT` — дата контентного релиза, не время сборки), `priority`
  оставлен (Яндекс учитывает при обходе), `changefreq` удалён.

### 3. OG/Twitter-картинка

`siteConfig.ogImage = '/opengraph-image'` (генерируемый роут 1200×630) вместо
битого `/og.png`; в мету — абсолютный URL через `absoluteUrl()`.

### 4. Граф перелинковки — `src/config/seo-links.ts`

Единый источник ссылок главной (блок `Coverage`: 10 гео-хабов + 3 топ-локации
каждого) и подвала (услуги + колонка «География»). Глубина: главная(0) →
хаб(1) → локация(2). BFS-тест `src/lib/seo/link-graph.test.ts`: все 123
посадочные ≤ 3 кликов, хабы = 1 клик, ≤ 50 новых ссылок на главной.

### 5. JSON-LD по типу страницы

- `layout` — сквозной граф: Organization + WebSite (+`alternateName`) +
  AutoWrecker (честный адрес: без `streetAddress` по умолчанию, `geo` только
  из ENV с ≥5 знаками, `logo` = `/icon-512`, `areaServed` City+область).
- Главная — каталог `Service` с `url` посадочной из `catalogServiceToLanding`
  (никаких `?service=`).
- Посадочная — один `@graph`: WebPage(`#webpage`) + Service(`#service`) +
  FAQPage + BreadcrumbList(`#breadcrumb`) на каноническом URL.

### 6. Ночной тариф +30% (решение владельца 23.10.2026)

`pricing.ts`: `nightSurchargePercent = 30`, `nightTariffLabel() → «+30%»` —
единый источник для текстов; обещания «без ночной наценки» удалены со всех
страниц (~116 URL), контроль — `content-audit.test.ts` (запрещённые паттерны).

### 7. Гигиена меты

Мета главной — в `page.tsx` (layout — только сквозные поля, без canonical);
`/politika` — свой description, `noindex, follow`; 404 — один meta robots
(встроенный noindex Next), без canonical; `og:phone_number` убран.

### 8. IndexNow (прод-деплой)

Ключ `INDEXNOW_KEY` (ENV) + публичный файл `public/<ключ>.txt`; отправка
изменённых URL (`требования/Переобход_vX.Y.Z_urls.txt`) после blue-green —
шаг FN3 в `PIPELINE_PROD.js`. Ошибка IndexNow не валит деплой.

## Последствия

- Новые модули: `src/lib/seo/url.ts`, `src/lib/seo/robots.ts`,
  `src/config/seo-links.ts`, `src/config/seo-dates.ts`,
  `src/components/sections/Coverage.tsx`, `src/lib/seo/og-icon.tsx`,
  `src/app/{robots.txt,icon-192,icon-512}/route.ts`,
  `src/lib/seo/link-graph.test.ts`, `scripts/check-first-load-budget.mjs`.
- Все абсолютные URL в отдаче — Punycode; для поисковиков это тот же хост
  (склейки не требуется).
- `Clean-param: service` склеивает `/?service=…` с `/` — трекинг выбора услуги
  клиентский, от индексации не зависит.
- T11 (анти-doorway контент гео-страниц) — отдельно, после выгрузки Вебмастера.
