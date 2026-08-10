# Скилл: Карта проекта «Эвакуация (Москва и МО)» — где что лежит

## Назначение

Справочный навигационный скилл. Отвечает на вопрос **«где что лежит»** для любой роли
конвейера (Аналитик, Архитектор, Разработчик, Тестировщик, DevOps). Используется ПЕРЕД
тем, как лезть в код — чтобы быстро понять, какой файл/папку трогать.

**Принцип карты:** описана **РЕАЛЬНАЯ** файловая структура репозитория (а не плановая).
Проверяй актуальность перед использованием; если структура изменилась — обнови этот файл.

---

## Когда использовать

- Поступила задача → посмотри карту, чтобы понять scope и затрагиваемые файлы.
- Нужно найти «где меняется цена / телефон / текст политики / список услуг».
- Разработчик ищет, в какой слой класть новый код (config / services / lib / components).
- Тестировщик ищет, где лежат тесты конкретного модуля.
- DevOps ищет docker/nginx/CI-конфиги.

---

## 0. Корень проекта

```
Эваукация/
├── src/                     # ВЕСЬ исходный код приложения (см. §6)
├── prisma/                  # Схема БД, миграции, сиды (см. §7)
├── tests/                   # E2E-тесты (Playwright) (см. §8)
├── deploy/                  # Скрипты и nginx-конфиги деплоя (см. §9)
├── .github/workflows/       # CI/CD: GitHub Actions (см. §10)
├── public/                  # Статика (пока только .gitkeep) (см. §11)
├── требования/              # ЧТЗ (бизнес-требования) (см. §3)
├── node_modules/            # Зависимости (не коммитить)
├── coverage/                # Отчёты покрытия Vitest (генерируется)
├── .next/                   # Билд Next.js (генерируется)
│
├── package.json             # Зависимости + npm-скрипты (см. §13)
├── package-lock.json
├── tsconfig.json            # Конфиг TS (strict), path-алиас @/* → src/*
├── tsconfig.tsbuildinfo     # Инкрементальный билд TS
├── next.config.mjs          # Конфиг Next.js 15
├── tailwind.config.ts       # Конфиг Tailwind 3.4
├── postcss.config.mjs       # PostCSS (autoprefixer + tailwind)
├── vitest.config.ts         # Конфиг Vitest (unit/интеграция)
├── playwright.config.ts     # Конфиг Playwright (E2E)
├── .eslintrc.json           # ESLint (next/core-web-vitals)
├── .prettierrc              # Форматирование
├── Dockerfile               # Образ приложения
├── docker-compose.yml       # PROD-состав сервисов (VPS)
├── docker-compose.dev.yml   # DEV-состав сервисов (локально)
├── .env.example             # Шаблон переменных окружения (секреты в .env, НЕ коммитить)
├── .gitignore
├── .dockerignore
```

---

## 1. Документация и скиллы (корень)

| Файл | Что внутри |
|------|-----------|
| `README.md` | Описание проекта для разработчиков |
| `AGENTS.md` | **Главный конфиг opencode**: конвейер, роли, 8 правил, маршрутизация |
| `ARCHITECTURE.md` | Архитектура проекта (БД, слои, паттерны). Читать при архитектурных задачах |
| `TECH_STACK.md` | Полное описание техстека |
| `SEO_SETUP.md` | Инструкция по SEO (Яндекс/Google, Метрика, sitemap) |
| `CHANGELOG.md` | История версий (обновляется при prod-деплое) |
| `SKILL_ARCHITECT.md` | Скилл роли 🏗️ Архитектор |
| `SKILL_ANALYST.md` | Скилл роли 📋 Аналитик |
| `SKILL_DEVELOPER.md` | Скилл роли 💻 Разработчик |
| `SKILL_TESTER.md` | Скилл роли 🧪 Тестировщик |
| `SKILL_DEVOPS.md` | Скилл роли 🚀 DevOps (dev-деплой) |
| `SKILL_DEVOPS_PROD.md` | Скилл роли 🚀 DevOps (prod, Blue-Green) |
| `SKILL_PROJECT_MAP.md` | **Этот файл** — карта проекта |

---

## 2. Конвейерные спецификации (корень)

| Файл | Назначение |
|------|-----------|
| `PIPELINE.js` | Формальная спецификация DEV-конвейера (этапы, роли, переходы) |
| `PIPELINE_PROD.js` | Формальная спецификация PROD-деплоя (Blue-Green, версионирование, откаты) |

---

## 3. `требования/` — ЧТЗ (бизнес-требования)

Здесь Аналитик сохраняет ЧТЗ по шаблону `ЧТЗ_[Название].md`. Текущие:

```
требования/
├── ЧТЗ_Главная_страница_MVP.md
├── ЧТЗ_Актуальные_контакты.md
├── ЧТЗ_Обновление_цен.md
├── ЧТЗ_Убрать_реквизиты.md
├── ЧТЗ_Убрать_услугу_подвоз_топлива.md
├── ЧТЗ_Скрыть_личную_почту.md
├── ЧТЗ_SEO_Яндекс_Google.md
├── ЧТЗ_CICD_Прод_деплой.md
└── ЧТЗ_Nginx_SSL_Prod.md
```

---

## 4. Соглашения проекта (важно перед чтением структуры)

1. **Одностраничник.** Главная страница — `src/app/page.tsx`, собирается из секций.
   Навигация по якорям (`/#services`, `/#order` и т.д.). Отдельных страниц
   `/uslugi`, `/tseny` сейчас НЕТ (есть только `/politika`).
2. **Контент в `src/config/` (TypeScript), НЕ в БД.** Услуги, цены, отзывы, FAQ,
   преимущества — в TS-файлах. Админки нет. В БД (`Order`) — только заявки.
3. **Тесты co-located** (рядом с кодом): `foo.ts` + `foo.test.ts`. E2E — в `tests/e2e/`.
4. **Server Components по умолчанию.** `'use client'` только для форм/интерактива.
5. **Бизнес-логика в `src/services/`**, не в API-route. Prisma — только в services.
6. **Path-алиас `@/*`** → `src/*` (настроено в `tsconfig.json`).
7. **Логирование** — pino через `@/lib/logger`. `console.log` запрещён.

---

## 5. Карта «где менять X» (быстрая навигация)

| Что нужно сделать | Куда идти |
|-------------------|-----------|
| Поменять телефон/название/URL/описание сайта | `src/config/site.ts` (читает ENV, см. `.env.example`) |
| Изменить **цену** | `src/config/services.ts` |
| Добавить/убрать **услугу** | `src/config/services.ts` + секция `src/components/sections/Services.tsx` |
| Поменять **преимущества** | `src/config/advantages.ts` + `sections/Advantages.tsx` |
| Изменить **шаги процесса** | `src/config/process-steps.ts` + `sections/Process.tsx` |
| Добавить **вопрос в FAQ** | `src/config/faq.ts` + `sections/Faq.tsx` |
| Реквизиты/почта/контакты компании | `src/config/company.ts` + `sections/Contacts.tsx` |
| Текст **политики ПД (152-ФЗ)** | `src/app/politika/` |
| Список навигации в шапке/меню | `src/config/site.ts` → `navigation` |
| Форма заявки (UI + валидация) | `src/components/forms/OrderForm.tsx` + `src/lib/validators/order.ts` |
| Логика сохранения заявки | `src/services/ordersService.ts` |
| API приёма заявки | `src/app/api/orders/route.ts` |
| Уведомление оператору (Telegram/email) | `src/services/notifyService.ts` + `src/lib/telegram.ts` |
| Антиспам (rate-limit) | `src/lib/rate-limit.ts` |
| Подключение к БД / Redis | `src/lib/prisma.ts`, `src/lib/redis.ts` |
| Логирование | `src/lib/logger.ts` |
| SEO: метаданные / schema.org | `src/lib/seo/metadata.ts`, `src/lib/seo/json-ld.ts` |
| SEO: компоненты (Breadcrumbs, JsonLd) | `src/components/seo/` |
| `sitemap.xml` / `robots.txt` | `src/app/sitemap.ts`, `src/app/robots.ts` |
| Иконки/OG/manifest | `src/app/icon.tsx`, `apple-icon.tsx`, `opengraph-image.tsx`, `manifest.ts` |
| Шапка/подвал/плавающая кнопка звонка | `src/components/layout/` |
| Базовые UI-компоненты (кнопка, инпут) | `src/components/ui/` |
| Схема БД | `prisma/schema.prisma` |
| Docker (dev) | `docker-compose.dev.yml` + `Dockerfile` |
| Docker (prod) | `docker-compose.yml` + `deploy/` |
| Nginx | `deploy/nginx/` |
| CI/CD | `.github/workflows/` |

---

## 6. `src/` — исходный код

```
src/
├── app/                         # Next.js App Router
│   ├── api/                     # Route Handlers (API)
│   │   ├── health/route.ts      #   GET /api/health — healthcheck (Docker/мониторинг)
│   │   └── orders/route.ts      #   POST /api/orders — приём заявки (валидация+БД+Telegram)
│   ├── politika/                # Страница политики обработки ПД (152-ФЗ)
│   ├── layout.tsx               # Корневой layout (Header/Footer, метаданные, шрифты)
│   ├── page.tsx                 # ГЛАВНАЯ (одностраничник): Hero→Services→Advantages→
│   │                            #   Process→Faq→OrderSection→Contacts
│   ├── globals.css              # Глобальные стили + Tailwind directives
│   ├── not-found.tsx            # 404
│   ├── sitemap.ts               # Генерация sitemap.xml
│   ├── sitemap.test.ts          # Тест sitemap
│   ├── robots.ts                # Генерация robots.txt
│   ├── manifest.ts              # PWA-манифест
│   ├── icon.tsx                 # Favicon (генерируется)
│   ├── apple-icon.tsx           # Apple touch icon
│   └── opengraph-image.tsx      # OG-картинка (генерируется)
│
├── components/
│   ├── sections/                # СЕКЦИИ главной страницы
│   │   ├── Hero.tsx             #   Первый экран (заголовок, CTA)
│   │   ├── Services.tsx         #   Услуги + цены (из config/services.ts)
│   │   ├── Advantages.tsx       #   Преимущества (из config/advantages.ts)
│   │   ├── Process.tsx          #   Как работаем (из config/process-steps.ts)
│   │   ├── Faq.tsx              #   FAQ (из config/faq.ts) + schema.org FAQPage
│   │   ├── OrderSection.tsx     #   Блок с формой заявки
│   │   └── Contacts.tsx         #   Контакты (из config/company.ts)
│   ├── forms/
│   │   └── OrderForm.tsx        # Форма заявки ('use client', React Hook Form + Zod)
│   ├── layout/
│   │   ├── Header.tsx           # Шапка (sticky, телефон, навигация)
│   │   ├── Footer.tsx           # Подвал
│   │   └── FloatingCallBtn.tsx  # Плавающая кнопка звонка (моб.)
│   ├── seo/
│   │   ├── JsonLd.tsx           # Вывод schema.org JSON-LD
│   │   └── Breadcrumbs.tsx      # Хлебные крошки + BreadcrumbList schema
│   └── ui/                      # Базовые компоненты (shadcn/ui-стиль)
│       ├── button.tsx
│       ├── input.tsx
│       ├── label.tsx
│       ├── card.tsx
│       ├── badge.tsx
│       ├── checkbox.tsx         # Согласие на ПД (152-ФЗ) в форме
│       └── DynamicIcon.tsx      # Обёртка над lucide-react (динамические иконки)
│
├── lib/                         # Инфраструктурный код (без бизнес-логики)
│   ├── logger.ts                # pino-логгер (redact ПД/секретов)
│   ├── prisma.ts                # PrismaClient singleton
│   ├── redis.ts                 # ioredis-клиент (кэш, rate-limit)
│   ├── rate-limit.ts            # Rate-limit публичного API (Redis)
│   ├── telegram.ts              # Telegraf: отправка заявок в Telegram
│   ├── utils.ts                 # cn(), форматирование телефона/цены, getClientIp
│   ├── version.ts               # Версия приложения (для healthcheck/деплоя)
│   ├── seo/
│   │   ├── metadata.ts          # generateMetadata, OG, Twitter Cards
│   │   ├── metadata.test.ts
│   │   ├── json-ld.ts           # schema.org: LocalBusiness, Service, FAQ, AggregateRating
│   │   └── json-ld.test.ts
│   └── validators/
│       ├── order.ts             # Zod-схема заявки (телефон RU, обязательные поля)
│       └── order.test.ts
│
├── services/                    # БИЗНЕС-ЛОГИКА (здесь Prisma-вызовы)
│   ├── ordersService.ts         # CRUD заявок (createOrder и т.д.)
│   ├── ordersService.test.ts
│   ├── notifyService.ts         # Доставка уведомлений (Telegram + email-резерв)
│   └── notifyService.test.ts
│
├── config/                      # КОНТЕНТ сайта (TS, без БД/админки)
│   ├── site.ts                  # Название/URL/описание/навигация (читает ENV)
│   ├── company.ts               # Контакты компании (телефон, email, адрес)
│   ├── services.ts              # Услуги + ЦЕНЫ + serviceType (для заявок)
│   ├── advantages.ts            # Преимущества
│   ├── process-steps.ts         # Шаги «как мы работаем»
│   ├── faq.ts                   # Вопросы/ответы (→ FAQPage schema)
│   └── config.test.ts           # Тесты консистентности конфигов
│
└── types/
    └── index.ts                 # Общие TypeScript-типы проекта
```

---

## 7. `prisma/` — база данных

```
prisma/
├── schema.prisma                # Схема: datasource postgres + модель Order
│                                #   (заявки: name, phone, serviceType, status, ip, utm…)
│                                #   binaryTargets: native + arm64 + musl (docker)
├── migrations/
│   └── 20260726205000_init/     # Первоначальная миграция
└── seeds/
    └── seed.ts                  # Сид (запуск: npm run db:seed)
```

**Важно:** контент (услуги/цены/отзывы) в БД НЕ хранится — он в `src/config/`.
В `Order` пишутся только заявки с сайта.

---

## 8. `tests/` — E2E

```
tests/
├── setup.ts                     # Общий setup для Playwright
└── e2e/
    └── home.spec.ts             # E2E главной страницы
```

Unit/интеграционные тесты — **co-located** в `src/` (файлы `*.test.ts` рядом с кодом).

---

## 9. `deploy/` — деплой

```
deploy/
├── docker-entrypoint.sh         # Entrypoint контейнера (миграции, запуск Next)
├── blue-green-deploy.sh         # Скрипт Blue-Green деплоя (prod)
├── README.md                    # Инструкция по деплою
└── nginx/
    ├── evakuaciya-upstream.conf #   upstream-блоки (blue:3001 / green:3003)
    ├── evakuaciya-map.conf      #   server/location map
    ├── evakuaciya-online.conf   #   домен/SSL/проксирование
    ├── setup-ssl.sh             #   выпуск SSL (Let's Encrypt)
    └── README.md                #   инструкция по nginx
```

---

## 10. `.github/workflows/` — CI/CD

```
.github/workflows/
├── ci.yml               # CI: lint + typecheck + test на каждый push/PR
├── docker-publish.yml   # Сборка Docker-образа и пуш в GHCR
└── deploy.yml           # Prod-деплой (Blue-Green) на VPS
```

---

## 11. `public/` — статика

```
public/
└── .gitkeep             # Папка пока пуста (статика генерируется/кладётся по мере надобности)
```

---

## 12. Где что тестировать

| Слой | Инструмент | Где лежат тесты |
|------|-----------|-----------------|
| Services (`ordersService`, `notifyService`) | Vitest | `src/services/*.test.ts` |
| Lib (`rate-limit`, `redis`, `telegram`, `utils`, `seo/*`, `validators/*`) | Vitest | `src/lib/**/*.test.ts` |
| Config (консистентность) | Vitest | `src/config/config.test.ts` |
| App routes (`sitemap`) | Vitest | `src/app/sitemap.test.ts` |
| UI-сценарии (главная) | Playwright | `tests/e2e/*.spec.ts` |

---

## 13. Шпаргалка по npm-скриптам (из `package.json`)

```bash
npm run dev               # Dev-сервер (http://localhost:3000)
npm run build             # Production-сборка
npm run start             # Запуск prod-сборки

# Качество (троица перед завершением Этапа 2):
npm run test              # Vitest (однократно)
npm run lint              # ESLint (next lint)
npm run typecheck         # tsc --noEmit

# Тесты дополнительно:
npm run test:watch        # Vitest watch
npm run test:coverage     # Vitest + coverage
npm run test:e2e          # Playwright

# БД:
npm run db:generate       # prisma generate
npm run db:push           # prisma db push (dev)
npm run db:migrate        # prisma migrate dev (создать миграцию)
npm run db:seed           # заполнить БД тестовыми данными
```

---

## 14. Слои приложения и их ответственность (шпаргалка для Разработчика)

```
HTTP request
   │
   ▼
src/app/api/*/route.ts        ← валидация (Zod), rate-limit, логи req/res, HTTP-статусы
   │
   ▼
src/services/*Service.ts      ← бизнес-логика + Prisma-вызовы
   │
   ▼
src/lib/prisma.ts             ← PrismaClient singleton
prisma/schema.prisma          ← описание моделей БД

Контент (не БД):
src/config/*.ts               ← услуги, цены, отзывы, FAQ, контакты (TS)

UI:
src/app/**/page.tsx           ← страницы (Server Component по умолчанию)
src/components/sections/*     ← секции главной
src/components/forms/*        ← 'use client' формы (RHF + Zod)
src/components/ui/*           ← примитивы (button, input, card…)
```

**Правило:** API-route НЕ должен содержать бизнес-логику и прямых Prisma-вызовов —
всё через `services/`. Prisma — только в `services/`.

---

## 15. Чек-лист поддержания карты в актуальном состоянии

При изменении структуры проекта:
- [ ] Добавлен/удалён файл или папка → обнови соответствующий раздел карты.
- [ ] Появилась новая страница в `app/` → добавь в §6.
- [ ] Изменилась модель БД → обнови §7.
- [ ] Добавлен workflow → обнови §10.
- [ ] Добавлен npm-скрипт → обнови §13.
- [ ] Изменилось правило слоёв → обнови §14.

> Карта достоверна настолько, насколько её поддерживают. Не оставляй её гнить.

---

*Скилл поддерживается вручную. Источник истины — реальная файловая система, не этот файл.*
