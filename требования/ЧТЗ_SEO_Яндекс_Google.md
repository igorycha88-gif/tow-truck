# ЧТЗ: SEO-оптимизация для Яндекс и Google

> **Маршрут:** Аналитик → (Архитектор свёрнуто) → Разработчик → Тестировщик → DevOps
> **Исполнитель:** Разработчик (fullstack)
> **Версия ЧТЗ:** 1.0
> **Дата:** 2026-08-10

---

## 1. Цель

Доработать техническую SEO-оптимизацию сайта до полного соответствия
требованиям поисковых систем **Яндекс** и **Google** для ниши «эвакуатор Москва и МО»,
и подготовить пошаговую инструкцию по внешней настройке (Webmaster, GSC, Метрика).

## 2. Контекст (что уже есть)

- `src/lib/seo/metadata.ts` — `buildMetadata()` + `localBusinessLd()` (базовый AutoWrecker)
- `src/components/seo/JsonLd.tsx`
- `src/app/sitemap.ts`, `src/app/robots.ts` (минимум)
- `src/app/layout.tsx` — Метрика, lang, viewport
- Семантический HTML, canonical, OG/Twitter basics

## 3. Что нужно реализовать (критерии приёмки)

### 3.1. Расширенная микроразметка schema.org (JSON-LD `@graph`)
- [ ] `WebSite` с `PotentialSearchAction` (sitelinks search box — Google) — даже без поиска,
      оставить заготовку с `target` placeholder
- [ ] `Organization` (отдельно от LocalBusiness) с `sameAs` (ссылки на соцсети/карты)
- [ ] `AutoWrecker`/`LocalBusiness` расширенный:
  - `geo` (latitude/longitude Москвы),
  - `address` (PostalAddress),
  - `aggregateRating` (ratingValue, reviewCount, bestRating),
  - `review` (1–2 примера),
  - `sameAs`,
  - `image`, `logo`, `url`, `priceRange`
- [ ] `Service` для КАЖДОЙ услуги из `src/config/services.ts`
- [ ] `FAQPage` для FAQ-блока (см. 3.3)
- [ ] `BreadcrumbList` (для вложенных страниц)
- [ ] Всё собрано в **один `@graph`** скрипт в `layout.tsx` + точечные JSON-LD на главной
- [ ] Отдельные хелперы в `src/lib/seo/json-ld.ts` (вынести из metadata.ts)

### 3.2. Мета-теги verification и app-meta
- [ ] `yandex-verification` (через `NEXT_PUBLIC_YANDEX_VERIFICATION`)
- [ ] `google-site-verification` (через `NEXT_PUBLIC_GOOGLE_VERIFICATION`)
- [ ] `applicationName`, `apple-mobile-web-app-title`, `formatDetection: telephone=no`
- [ ] `manifest` ссылка в metadata

### 3.3. FAQ-блок на главной (SEO long-tail)
- [ ] `src/config/faq.ts` — 6–8 вопросов (цена, подача, регионы, оплата, ДТП, круглосуточно)
- [ ] Секция `Faq.tsx` на главной (Server Component, `<details>` или аккордеон)
- [ ] `faqPageLd()` — JSON-LD FAQPage (Question/Answer)
- [ ] Идентификатор секции `#faq`

### 3.4. Иконки, PWA-манифест, OG-картинка
- [ ] `src/app/icon.tsx` — favicon (генерация через `ImageResponse`, Truck на фирменном фоне)
- [ ] `src/app/apple-icon.tsx` — Apple touch icon (180×180)
- [ ] `src/app/manifest.ts` — Web App Manifest (name, short_name, theme, icons, display)
- [ ] `src/app/opengraph-image.tsx` — динамическая OG-картинка 1200×630 (фирменный фон + УТП)
- [ ] (legacy) `public/favicon.ico` — опционально; Next сам сгенерирует из `icon.tsx`

### 3.5. Кастомная 404
- [ ] `src/app/not-found.tsx` — `noindex`, человекfriendly, ссылка на главную и телефон

### 3.6. Sitemap и robots (улучшения)
- [ ] `sitemap.ts` — добавить `#services`, `#faq` anchor'ы не нужны (это фрагменты), но
      добавить `lastModified` стабильный (по дате сборки) + `alternates.languages` x-default
- [ ] `robots.ts` — добавить `Clean-param: utm_source utm_medium utm_campaign utm_content utm_term`
      (директива Яндекса против дублирования URL с UTM)

### 3.7. layout.tsx
- [ ] `<noscript>` блок для Метрики (с `<img>` pixel)
- [ ] Расширенные meta через `buildMetadata`
- [ ] `themeColor` в viewport (массив light/dark)

### 3.8. Инструкция настройки
- [ ] `SEO_SETUP.md` в корне — пошаговая инструкция:
  - Регистрация домена, HTTPS, www→без-www
  - Yandex.Webmaster: добавить сайт, верификация, sitemap, регион, переезд
  - Google Search Console: добавить, верификация, sitemap, International Targeting
  - Yandex.Метрика: счётчик, цели (звонок, заявка), вебвизор
  - Яндекс.Бизнес (Организации на Яндекс.Картах)
  - Google Business Profile
  - Получить координаты, заполнить ENV
  - Чек-лист финальной проверки (Rich Results Test, PageSpeed Insights)

## 4. Файлы для изменения/создания

**Изменить:**
- `src/lib/seo/metadata.ts` — расширить `buildMetadata` (verification, appMeta)
- `src/app/layout.tsx` — `<noscript>`, расширенные meta, новый `@graph`
- `src/app/page.tsx` — добавить `<Faq />`
- `src/app/sitemap.ts` — alternates/lastModified
- `src/app/robots.ts` — Clean-param
- `.env.example` — добавить NEXT_PUBLIC_YANDEX_VERIFICATION, NEXT_PUBLIC_GOOGLE_VERIFICATION,
  NEXT_PUBLIC_GA_ID (опц.), NEXT_PUBLIC_LATITUDE/LONGITUDE
- `src/config/company.ts` — добавить sameAs[], rating/reviewCount (опц. из trustStats)

**Создать:**
- `src/lib/seo/json-ld.ts` — все генераторы схем
- `src/lib/seo/json-ld.test.ts`
- `src/config/faq.ts`
- `src/components/sections/Faq.tsx`
- `src/components/seo/Breadcrumbs.tsx`
- `src/app/icon.tsx`
- `src/app/apple-icon.tsx`
- `src/app/manifest.ts`
- `src/app/opengraph-image.tsx`
- `src/app/not-found.tsx`
- `SEO_SETUP.md`

## 5. Не делать (вне scope)

- Новые страницы (услуги/цены/отзывы/зона покрытия) — отдельные ЧТЗ
- Google Analytics gtag —Метрика приоритет (РФ-трафик); GA не обязателен
- Мультиязычность (только ru-RU + x-default)
- Server headers кэширования — это Nginx (отдельная задача)
- Контентные правки текстов

## 6. Маршрутизация

→ **Разработчик** (fullstack): реализация по TASK-SEO-001..008
→ **Тестировщик**: автотесты + код-ревью + Rich Results Test теоретический
→ **DevOps**: полная пересборка dev-контейнеров

## 7. Риски

- `ImageResponse` (`next/og`) требует Edge runtime — проверить, что работает в Node runtime Docker
- `app/icon.tsx` кэшируется — изменения требуют пересборки
- Verification ID'ы — пользователь должен получить в Webmaster/GSC и прописать в `.env`
