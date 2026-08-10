# Changelog

Все заметные изменения проекта «Эвакуация (Москва и МО)».

Формат основан на [Keep a Changelog](https://keepachangelog.com/ru/1.1.0/),
версионирование — [Semantic Versioning](https://semver.org/lang/ru/).

## [Unreleased]

## [0.3.0] — 2026-08-10

### Добавлено
- **Полная SEO-оптимизация для Яндекс и Google** (см. `требования/ЧТЗ_SEO_Яндекс_Google.md`).
- **schema.org `@graph`** в едином JSON-LD: `Organization`, `WebSite`, `AutoWrecker` (расширенный — `geo`, `PostalAddress`, `aggregateRating`, `sameAs`, `parentOrganization`), `Service` по каждой услуге (`Offer` с тарифом / «по запросу»), `FAQPage`, `BreadcrumbList`. Генераторы в новом `src/lib/seo/json-ld.ts`.
- **FAQ-блок** на главной + `src/config/faq.ts` (8 вопросов для SEO long-tail) + `src/components/sections/Faq.tsx` (нативный `<details>`, без client JS).
- **Динамические иконки и OG-картинка** через `next/og`: `src/app/icon.tsx`, `src/app/apple-icon.tsx`, `src/app/opengraph-image.tsx`.
- **Web App Manifest** (`src/app/manifest.ts`) — PWA, мобильное SEO.
- **Кастомная 404** (`src/app/not-found.tsx`) с `noindex` и CTA.
- **Хлебные крошки** — `src/components/seo/Breadcrumbs.tsx` (визуальный nav + JSON-LD).
- **Инструкция по внешней настройке SEO** — `SEO_SETUP.md` (Yandex.Webmaster, Google Search Console, Метрика с целями, Яндекс.Бизнес, Google Business Profile, чек-лист).
- Мета-теги `verification` (yandex/google), `appleWebApp`, `formatDetection: telephone: false`, `themeColor` (light/dark).
- `<noscript>`-пиксель Yandex.Метрики.
- Расширенный `.env.example`: `NEXT_PUBLIC_YANDEX_VERIFICATION`, `NEXT_PUBLIC_GOOGLE_VERIFICATION`, `NEXT_PUBLIC_LATITUDE`/`LONGITUDE`, `NEXT_PUBLIC_YANDEX_MAPS_URL`, `NEXT_PUBLIC_2GIS_URL`.
- 18 новых unit-тестов на генераторы JSON-LD (`src/lib/seo/json-ld.test.ts`).

### Изменено
- `src/app/layout.tsx`: полный `@graph` вместо одного `localBusinessLd`, расширенные app-meta.
- `src/lib/seo/metadata.ts`: `localBusinessLd` вынесен в `json-ld.ts` (без дублирования).
- `src/app/sitemap.ts`: `alternates.languages` с `ru-RU` и `x-default`.

### Не коммитить
- Корневые фото `2026-07-26-*.jpg` — не относятся к SEO-задаче, оставлены в рабочем каталоге.

## [0.2.0] — 2026-07-26

### Добавлено
- **CI/CD на GitHub Actions**: воркфлоу `ci` (lint + typecheck + vitest + build), `docker-publish` (сборка prod-образа и пуш в GHCR), `deploy` (Blue-Green деплой на VPS по SSH).
- **Продакшн-`docker-compose.yml`**: stateful-сервисы PostgreSQL + Redis (порты только на 127.0.0.1, healthcheck, volumes, лог-ротация).
- **`deploy/docker-entrypoint.sh`**: авто-применение Prisma-миграций (`migrate deploy`) перед стартом Next.js.
- **`deploy/blue-green-deploy.sh`**: безопасный Blue-Green деплой с бэкапом БД, healthcheck, авто-откатом.
- **Baseline Prisma-миграция** `20260726205000_init` — схема `Order`.
- Поле `version` в `/api/health` (для сверки версии на проде, PIPELINE_PROD → FT1).
- `src/lib/version.ts` — единый источник версии приложения.

### Изменено
- `Dockerfile`: production-стадия `runner` использует `docker-entrypoint.sh` (миграции + `next start`).

## [0.1.0] — 2026-07-26

### Добавлено
- MVP главной страницы услуг эвакуации (Hero, услуги, калькулятор, зона, цены, отзывы, форма заявки).
- Форма заявки с валидацией телефона (RU, 152-ФЗ согласие) + уведомления в Telegram.
- Кэш/rate-limit на Redis, фолбэк при недоступности.
- Nginx + SSL (Let's Encrypt) для домена `эвакуация.online` (HTTP→HTTPS, www→apex, security headers).
- Конвейер AI-команды (PIPELINE.js / PIPELINE_PROD.js), техстек, архитектура.
