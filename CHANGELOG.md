# Changelog

Все заметные изменения проекта «Эвакуация (Москва и МО)».

Формат основан на [Keep a Changelog](https://keepachangelog.com/ru/1.1.0/),
версионирование — [Semantic Versioning](https://semver.org/lang/ru/).

## [Unreleased]

## [0.12.0] — 2026-08-31

### Добавлено
- **Разговорные SEO-ключи востока** (98cb464): «Эвакуатор Балашиха/Реутов/Новогиреево» — разговорные формулировки в гео-модуле.
- **Посадочные страницы** направления «Горьковское шоссе» и «шоссе Энтузиастов».

## [0.11.0] — 2026-08-31

### Добавлено
- **Блок «Адреса» в форме заявки** (Откуда забрать / Куда доставить): поля `fromAddress`/`toAddress`, миграции `20260831140000_add_order_addresses` и `20260831150000_add_order_consent_at` (применяются автоматически при деплое).
- **Согласие на обработку ПД (152-ФЗ)**: поле `consentAt` — фиксация времени согласия; кнопка отправки неактивна, пока чекбокс согласия не отмечен.

## [0.10.0] — 2026-08-31

### Добавлено
- **Email-уведомления о заявках** через Яндекс SMTP (Nodemailer, ЧТЗ_Email_уведомления_Яндекс_SMTP): `src/lib/mailer.ts` — письма операторам (список `NOTIFY_EMAIL` через запятую), порт 465/587, graceful-деградация (SMTP не настроен/ошибка — заявка всё равно создаётся). Настройки на проде: `.env` (SMTP_HOST/PORT/USER/PASSWORD/FROM, NOTIFY_EMAIL).
- **Читаемый номер заявки** (ADR-013, ЧТЗ_Читаемый_номер_заявки): `Order.number` — сквозной счётчик через PG sequence + миграция `20260831120000_readable_order_number` (существующие заявки нумеруются детерминированно по `createdAt`); отображаемый формат ГГГГММДД-N (`src/lib/orderNumber.ts`); номер в Telegram- и email-уведомлениях.

### Изменено
- `notifyService` — единая точка отправки уведомлений (Telegram + email), упрощение.

## [0.9.0] — 2026-08-29

### Добавлено
- **Полные бизнес-метрики** (ЧТЗ Полные_Бизнес_Метрики): модель `ClickEvent` с `eventType` (`click_phone`|`service_click`), `service`, `referer`, `city`; `Visit` дополнен `referer`/`city` + миграция. Источник сессии из `document.referrer` (1 раз за сессию), гео по GeoLite2 (`geoip-lite`, офлайн, кэш). Новые метрики `/metrics/tracking`: `business_phone_clicks_12h`, `business_phone_clicks_event`, `business_referral_sources_24h`, `business_geo_visitors_24h`, `business_service_clicks_24h`.
- Тесты: 329 unit + 44 e2e, покрытие новых файлов 93–100%.

### Изменено
- `PhoneClickTracker` заменён делегированным трекером кликов (`tel:` + `data-service`, debounce 5с).
- `geoip-lite` добавлен в `serverExternalPackages` (фикс ENOENT `data/*.dat` при бандлинге).

## [0.8.0] — 2026-08-25

### Добавлено
- **74 гео-посадочные SEO-страницы** (ADR-003, ЧТЗ_Гео_посадочные_районы_МО): data-driven гео-модуль `src/config/geo/` поверх шаблона `ServicePage` — 41 район Москвы (ВАО 14, ЮВАО 12, ЮАО 15) + 27 городов МО ≤30 км + 6 хабов. Композер собирает `ServicePageConfig` из данных + общих блоков направления; объединённый реестр `landingPages` (услуги + гео) для роута и sitemap. Хлебные крошки Главная → Хаб → Локация, JSON-LD `areaServed` + `areaName`. Анти-дорвей: уникальные title/desc/H1/лиды/FAQ, ≥350 слов (32 автотеста в `src/config/geo/index.test.ts`, E2E `tests/e2e/geo-pages.spec.ts`).

### Исправлено
- **Дрейф репо ↔ prod-VPS** (ЧТЗ_Устранение_дрейфа_репо_VPS): nginx `server_name` и SSL-пути переведены на punycode (`xn--80aae0ai8cwa4cza.online`) — nginx 1.24 на VPS не нормализует IDN; `listen 443 ssl http2` вместо раздельных директив. `postgres-exporter` → `network_mode: host` + `--web.listen-address=127.0.0.1:9187` (на VPS postgres запущен вне compose через `docker run`, hostname `postgres:5432` не резолвится); DSN host `127.0.0.1`.

### Документация
- ЧТЗ: SEO рост позиций (Вебмастер), site-metrics node+postgres, подключение эвакуации к мониторингу, устранение дрейфа репо/VPS.

## [0.7.0] — 2026-08-24

### Добавлено
- **7 посадочных SEO-страниц** под кластеры запросов Яндекс.Вебмастера (ЧТЗ_SEO_Рост_позиций_Вебмастер, ЭПИК-2): `/evakuator-24-7`, `/evakuator-posle-dtp`, `/evakuator-s-lebedkoj`, `/evakuaciya-mototehniki`, `/evakuator-zablokirovannyh-koles`, `/evakuator-vidnoe` (гео-пилот), `/evakuator-legkovyh`. SSG через `generateStaticParams` + универсальный шаблон `ServicePage.tsx`; реестр и контент — `src/config/service-pages/` (страница = 1 конфиг).
- **Единый источник цен `src/config/pricing.ts`** (ЭПИК-1): тарифы 5 000/6 000 ₽ подача + 100 ₽/км; `services.ts`, мета-теги, JSON-LD `priceRange` и посадочные страницы берут цифры только отсюда (рассинхрон цен = баг, ловится автотестом).
- **Новые сниппеты главной (ЭПИК-1, CTR)**: title «Эвакуатор 24/7 Москва и МО — подача 15–30 мин, от 5 000 ₽» (≤60 симв., ключ в первых 30, цена из pricing.ts); description ≤160 с УТП и призывом «Звоните сейчас». `buildMetadata({ exactTitle })` + `homeMetadata()`.
- **JSON-LD посадочных**: `Service` + `Offer` (цена из единого источника), `FAQPage`, `BreadcrumbList` — генератор `servicePageLd()` в `json-ld.ts`.
- **Секция «Цены» на главной** (`#prices`, ЭПИК-5): таблица тарифов из каталога + ссылки на посадочные; пункт «Цены» в навигации (быстрые ссылки Яндекса, ЭПИК-1.4).
- **Перелинковка (ЭПИК-4)**: карточки услуг главной → посадочные (`catalogServiceToLanding`), блок «Смежные услуги» на каждой посадочной (2–3), подвал — 4 главные услуги, «Эвакуатор в Видном» в контактах.
- **Контент-аудит word-salad (ЭПИК-3)**: автотест `content-audit.test.ts` сканирует `src/` на запрещённые фразы выдачи («перевести корпус связей», «просевшая страна», …), бренд конкурента и чужие телефоны (+7 933 091-72-70, +7 499 703-00-37) + CJK-примеси.
- `OrderForm({ defaultServiceType })` — предзаполнение типа услуги с посадочной; `click_event.page` + `service_page` (клики по телефону с посадочных в бизнес-метриках).
- `SEO_SETUP.md`: раздел «Внешние работы после деплоя» (переобход, быстрые ссылки, Яндекс.Бизнес, отзывы, белые каталоги, еженедельная сводка SEO).
- Тесты (257 total): реестр страниц (уникальность мета, лимиты 60/160, ключ в первых 30 символах, структура FAQ/шагов, «сироты» перелинковки), синхронизация цен, sitemap, `homeMetadata`, `servicePageLd`, forbidden-словарь.

### Изменено
- `sitemap.ts`: посадочные добавляются динамически из реестра (monthly, 0.8).
- `siteConfig.description` — новый SEO-текст ≤160 симв.; навигация + «Цены» → `/#prices`.
- Тарифы каталога услуг переведены на `pricing.ts` (значения не изменились: 5000/6000/100).

### Ограничения по ЧТЗ (§8 «Не делать»)
- Блок отзывов на главной не добавлен: реальных отзывов пока нет, фиктивные — риск санкций Яндекса (ЧТЗ §9). Вернуть вместе с `aggregateRating` после 5+ реальных отзывов (регламент — SEO_SETUP.md).
- Вердикт по title/description посадочных: после переобхода сверить сниппеты в «Проверке страницы» Вебмастера (скриншоты — к задаче).

## [0.6.0] — 2026-08-19

### Добавлено
- **`GET /metrics/tracking`** — Prometheus-метрики трекинга (клики по номеру, визиты) для централизованного мониторинга (ЧТЗ «Централизованный мониторинг»).
- **`GET /metrics/content`** — content_*-метрики приложения: `content_http_requests_total`, `content_http_request_duration_seconds` (патч http.Server через instrumentation.ts, только nodejs-рантайм).
- **`MONITORING_KEY`** — защита /metrics/* на уровне приложения (defense in depth, дополнительно к nginx).
- Nginx: location /metrics/* с X-Monitoring-Key, rate-limit 10 r/s, отдельный лог-формат (deploy/nginx/).
- Инфраструктура мониторинга: node_exporter и postgres_exporter (профиль `monitoring` в docker-compose, setup-скрипты).

### Исправлено
- `__resetHttpMetricsForTests`: полный сброс патча http-метрик — устранён порядок-зависимый провал CI в `instrumentation.test.ts`.

## [0.5.0] — 2026-08-14

### Добавлено
- **Трекинг посетителей (Visit)** — модель `Visit` + миграция: фиксация каждого визита на сайт (ADR-002).
- **`POST /api/visit`** — Zod-валидация, rate-limit (120/ч), логирование.
- **`VisitTracker`** в layout — beacon 1 раз/страницу/сессию (дедуп через sessionStorage).
- **Grafana**: панель «Визиты (сегодня)», «Посетители по часам (48ч, МСК)», панель «Посетители» из `Visit`.
- Unit-тесты (159) + E2E на visit и grafana-panels.

### Исправлено
- `normalizeIp`: `::ffff:` префикс → чистый IPv4.
- `/api/metrics`: visitors теперь из `Visit` (раньше считались из заявок — показывало 0).
- Grafana: фикс timeseries-панелей (алиас time в lowercase — было No data).

## [0.4.0] — 2026-08-10

### Добавлено
- **Grafana бизнес-метрики** — дашборд с 6 панелями (заявки, клики, посетители по дням и статусам). Доступ: `https://эвакуация.online/grafana/` (basic auth). PostgreSQL datasource, автообновление 1 мин (ADR-001).
- **Трекинг кликов по номеру телефона** — `PhoneClickTracker` компонент на 4 страницах (home/contacts/floating_call/header). `POST /api/click-event` (Zod, rate-limit, логирование). `ClickEvent` model + migration.
- **`GET /api/metrics`** — агрегированные метрики (заявки по статусам, клики, уникальные посетители по IP). Защищён nginx basic auth.
- **Яндекс.Метрика** — `metrika.ts` (отправка pageview + reach goal), интегрирован в layout.
- **Grafana контейнер** в docker-compose (dev:3030, prod:3030). PostgreSQL datasource provisioning, dashboard provisioning.
- **Nginx**: `/grafana/` reverse proxy + `/api/metrics` basic auth (htpasswd).

### Изменено
- `ARCHITECTURE.md`: добавлен раздел 10 (Monitoring), ADR-001.
- `TECH_STACK.md`: обновлена строка monitoring (Grafana).

## [0.3.4] — 2026-08-10

### Добавлено
- **Файл верификации Яндекс.Вебмастера** `public/yandex_c6dcbbf42140752b.html` (способ C). Доступен как `https://эвакуация.online/yandex_c6dcbbf42140752b.html` — подтверждает права на сайт в Яндекс.Вебмастере.

## [0.3.3] — 2026-08-10

### Исправлено
- **Убран `aggregateRating` из `AutoWrecker` JSON-LD.** Google Rich Results Test помечал его как невалидный Review snippet (нарушение [self-serving review policy](https://developers.google.com/search/docs/appearance/structured-data/review-snippet) — aggregateRating на собственном сайте без реальных отзывов с независимых площадок). LocalBusiness и Organization валидны. Рейтинг 4.9 остаётся в Hero визуально. Когда появятся реальные отзывы с Яндекс.Карт/2GIS — вернуть с proper `Review`-объектами и `sameAs`-ссылками.

## [0.3.2] — 2026-08-10

### Исправлено
- **`appleboy/ssh-action`: переменная `IMAGE` не передавалась** в remote-скрипт → авто-деплой падал с `IMAGE: unbound variable`. Теперь `IMAGE` пробрасывается через `env`/`envs` вместе с `PROJECT_DIR` (в `docker-publish.yml` и `deploy.yml`).

## [0.3.1] — 2026-08-10

### Исправлено
- **`NEXT_PUBLIC_SITE_URL` не пробрасывался в Docker-сборку** → canonical, `og:url`, `sitemap.xml`, JSON-LD `@id` указывали на `http://localhost:3000`. Теперь в `Dockerfile` (builder stage) добавлен `ARG NEXT_PUBLIC_SITE_URL`, а `docker-publish.yml` передаёт `build-args: NEXT_PUBLIC_SITE_URL=https://эвакуация.online`.
- **Авто-деплой из GitHub Actions падал** с `PROJECT_DIR: unbound variable`. В `appleboy/ssh-action` переменные окружения нужно передавать через `env:`/`envs:` — поправлено в `docker-publish.yml` и `deploy.yml`.

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
