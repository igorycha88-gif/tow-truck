# ЧТЗ: Главная страница (MVP)

## Версия: 1.0
## Дата: 2026-07-26
## Автор: AI-Аналитик
## Приоритет: High
## Статус: Согласовано

---

## 1. Цели и задачи

### 1.1 Бизнес-цель
Создать первую рабочую (deployment-ready) версию главной страницы сайта услуг
эвакуации в Москве и МО, способную генерировать лиды (звонки + заявки) сразу
после деплоя. Это первая сессия разработки — проект пустой, требуется
инициализация Next.js 15 + базовой инфраструктуры.

### 1.2 Пользовательская ценность
Клиент (часто с мобильного, в стрессе на дороге) за < 2 секунд видит:
УТП, телефон для быстрого звонка, основные услуги, доверительные сигналы
(схема работы, преимущества), и может оставить заявку за 30 секунд.

### 1.3 Метрики успеха
| Метрика | Цель |
|---------|------|
| LCP главной | < 2.5s (mobile, 3G) |
| CLS | < 0.1 |
| Покрытие автотестами новых файлов | ≥ 60% |
| Доступность телефона | sticky-header + floating-btn на всех вьюпортах |
| Работоспособность формы | POST /api/orders возвращает 201 / 400 / 429 |
| SEO | title, description, LocalBusiness JSON-LD на главной |

---

## 2. Функциональные требования

### 2.1 User Stories с Acceptance Criteria

**US-1. Главная страница рендерит MVP-секции**
- *Given* посетитель заходит на `/`
- *When* страница загружается
- *Then* видны секции в порядке: Header → Hero → Services → Advantages →
  Process → OrderForm → Contacts → Footer + FloatingCallBtn

**US-2. Sticky-header с телефоном и CTA**
- *Given* посетитель скроллит страницу
- *When* хедер уходит из зоны видимости
- *Then* хедер остаётся sticky сверху; телефон кликабелен (`tel:`); кнопка
  «Заказать эвакуатор» скроллит к форме

**US-3. Floating-call кнопка (mobile)**
- *Given* посетитель на мобильном
- *When* скроллит любую секцию
- *Then* в правом нижнем углу всегда видна круглая floating-кнопка звонка
  (`tel:`), не перекрывает контент (есть отступы)

**US-4. Hero с УТП и тремя CTA**
- *Given* загрузка главной
- *When* отрисован Hero
- *Then* видны: H1 («Эвакуатор 24/7 Москва и МО»), подзаголовок («Подача
  15–30 минут»), кнопка-звонок, кнопка-заявка, бейджи доверия (24/7, своя
  техника,_fix-N заявок)

**US-5. Услуги (карточки)**
- *Given* секция Services
- *When* отрисована
- *Then* отображены карточки из `src/config/services.ts` (иконка, название,
  описание, цена «от X ₽»); клик по карточке скроллит к форме и
  предзаполняет `serviceType`

**US-6. Преимущества**
- *Given* секция Advantages
- *Then* отображены пункты из `src/config/advantages.ts` (иконка + текст)

**US-7. Схема работы (1→2→3→4)**
- *Given* секция Process
- *Then* отображены 4 шага из `src/config/process-steps.ts`

**US-8. Форма заявки (152-ФЗ)**
- *Given* OrderForm
- *When* отправлена валидная форма (имя, телефон, локация, тип услуги, чекбокс
  согласия ПД)
- *Then* POST `/api/orders` → 201 → показывается success-состояние
- *When* телефон невалиден / нет согласия
- *Then* inline-ошибки валидации (RU телефон через libphonenumber-js)
- *When* превышен лимит (3/час с IP)
- *Then* 429 → user-friendly сообщение

**US-9. Контакты (footer + секция)**
- *Given* секция Contacts / Footer
- *Then* телефон (tel:), мессенджеры (WhatsApp/Telegram deep-links),
  ИНН/юр.лицо (из `src/config/company.ts`)

---

## 3. Нефункциональные требования

### 3.1 Производительность
- Server Components по умолчанию; `'use client'` только для Header (sticky
  scroll logic), FloatingCallBtn, OrderForm
- `next/font` (Inter + системный fallback), `next/image` для фото
- LCP < 2.5s, CLS < 0.1, минимум клиентского JS

### 3.2 Безопасность
- Zod-валидация на API и форме
- RU-телефон через `libphonenumber-js`
- Rate-limit: 3 запроса/час с IP (Redis, graceful fallback при отсутствии Redis)
- **152-ФЗ:** чекбокс согласия + ссылка на `/politika` (заглушка)
- Маскирование телефона в логах (pino redact)
- Секреты только в `.env`

### 3.3 SEO
- `generateMetadata` на главной (title, description, OG, canonical)
- `LocalBusiness` + `Organization` JSON-LD в layout
- Семантический HTML (`<h1>`, `<main>`, `<section>`, `alt`)
- `app/sitemap.ts` + `app/robots.ts`
- `next/font` для шрифтов

### 3.4 Мобильная адаптивность
- Mobile-first; Tailwind breakpoints (sm/md/lg)
- Sticky-header компактный на mobile
- Floating-call только на mobile (md:hidden)
- Тач-зоны ≥ 44px

### 3.5 Дизайн (цветовая система)
- **Базовые:** тёмно-синий/графит (`#0f172a`, `#1e293b` — slate) — доверие
- **Акцент:** оранжевый (`#f97316` — orange-500) для CTA — действие/срочность
- **Фон:** белый/`slate-50`
- **Текст:** `slate-900` / `slate-600`
- Tailwind CSS variables в `globals.css` (CSS custom properties)

---

## 4. Техническая архитектура

### 4.1 Изменения в БД / src/config
- **Prisma `Order` model** (см. ARCHITECTURE.md §5) — единственная таблица в MVP
- `src/config/company.ts` — телефон, мессенджеры, ИНН, юр.лицо (заглушки)
- `src/config/services.ts` — каталог услуг (6 типов: light_vehicle, moto,
  commercial, offroad, accident, fuel)
- `src/config/advantages.ts` — преимущества (4–6 пунктов)
- `src/config/process-steps.ts` — 4 шага схемы работы
- `src/config/site.ts` — навигация, SEO-настройки

### 4.2 API спецификация

**POST /api/orders** (см. SKILL_ANALYST.md шаблон + SKILL_DEVELOPER.md §1):
- Валидация Zod (`orderSchema`)
- Rate-limit Redis (3/час с IP), graceful fallback
- `ordersService.createOrder()` → Prisma
- `notifyService.notifyNewOrder()` → Telegram (fire-and-forget, try/catch)
- Статусы: 201 / 400 (VALIDATION_ERROR) / 429 (RATE_LIMIT_EXCEEDED) / 500
- **Логирование request/response обязательно** (pino)

**GET /api/health**:
- Возвращает `{ status: 'ok', db: 'up'|'down', redis: 'up'|'down', ts }`
- Используется DevOps для healthcheck

### 4.3 Структура файлов (создаются)
```
package.json, tsconfig.json, next.config.mjs, postcss.config.mjs,
tailwind.config.ts, vitest.config.ts, playwright.config.ts, .eslintrc,
Dockerfile, docker-compose.dev.yml, .dockerignore
prisma/schema.prisma
src/app/layout.tsx, page.tsx, globals.css, sitemap.ts, robots.ts
src/app/api/orders/route.ts, api/health/route.ts
src/app/politika/page.tsx (заглушка политики ПД)
src/components/ui/{button,input,label,checkbox,card}.tsx
src/components/layout/{Header,Footer,FloatingCallBtn}.tsx
src/components/sections/{Hero,Services,Advantages,Process,Contacts}.tsx
src/components/forms/OrderForm.tsx
src/components/seo/JsonLd.tsx
src/lib/{logger,prisma,redis,rate-limit,utils}.ts
src/lib/telegram.ts
src/lib/validators/order.ts
src/lib/seo/metadata.ts
src/services/{ordersService,notifyService}.ts
src/config/{company,services,advantages,process-steps,site}.ts
src/types/index.ts
src/styles/globals.css
src/lib/*.test.ts, src/services/*.test.ts, src/app/api/**/route.test.ts
tests/e2e/home.spec.ts
```

### 4.4 Интерфейсы/типы + Zod-схемы
```ts
// orderSchema (Zod) → выводит OrderInput
const orderSchema = z.object({
  name: z.string().min(2).max(100),
  phone: z.string().refine(v => parsePhoneNumber(v, 'RU')?.isValid(), 'Неверный номер'),
  location: z.string().min(3).max(200),
  serviceType: z.enum(['light_vehicle','moto','commercial','offroad','accident','fuel']),
  consent: z.literal(true), // 152-ФЗ
});
```

### 4.5 Server vs Client Components
| Компонент | Тип | Причина |
|-----------|-----|---------|
| `app/page.tsx`, секции Hero/Services/Advantages/Process/Contacts | Server | SEO, минимум JS |
| `layout/Header` | Client (scroll/sticky behavior + mobile menu) | события |
| `layout/FloatingCallBtn` | Server (просто `tel:` ссылка, видна через CSS) | нет интерактива |
| `forms/OrderForm` | Client (RHF + Zod + fetch) | state, валидация |

---

## 5. UI/UX требования

### 5.1 Макет (desktop)
```
┌─────────────────────────────────────────────────────────┐
│ [Логотип]   Эвакуатор 24/7    [📞 +7 495 XXX] [Заказать]│ ← sticky
├─────────────────────────────────────────────────────────┤
│  HERO: H1 «Эвакуатор Москва и МО»                        │
│  Подача 15–30 минут • 24/7 • Своя техника                │
│  [📞 Позвонить]  [📝 Оставить заявку]                    │
│  бейджи: 24/7 | Опыт N лет | N заявок                    │
├─────────────────────────────────────────────────────────┤
│  УСЛУГИ (grid 3 колонки):                                │
│  [🚗 Легковые от X₽] [🏍 Мото] [🚚 Спецтехника] ...      │
├─────────────────────────────────────────────────────────┤
│  ПРЕИМУЩЕСТВА (4–6 пунктов с иконками)                   │
├─────────────────────────────────────────────────────────┤
│  СХЕМА РАБОТЫ: 1→2→3→4 (Звонок → Подача → Погрузка → ...)│
├─────────────────────────────────────────────────────────┤
│  ФОРМА ЗАЯВКИ (имя, телефон, локация, услуга, чекбокс)   │
├─────────────────────────────────────────────────────────┤
│  КОНТАКТЫ: телефон, мессенджеры, ИНН                     │
├─────────────────────────────────────────────────────────┤
│  FOOTER: копирайт, ссылки, Политика ПД                   │
└─────────────────────────────────────────────────────────┘
                              (📱 floating-call справа снизу, md:hidden)
```

### 5.2 Валидация (см. §4.4)

### 5.3 Обработка ошибок
- Форма: inline-ошибки (RHF); серверная ошибка → дружелюбный toast/блок
- API: 400/429/500 с понятными кодами ошибок
- Логирование всех ошибок в catch-блоках

---

## 6. Декомпозиция на задачи

### Infrastructure
- **TASK-INF-001**: Инициализация Next.js 15 проекта (package.json, tsconfig,
  next.config.mjs, tailwind, postcss, ESLint, Prettier, .gitignore доп.)
- **TASK-INF-002**: Конфигурация тестов (vitest.config.ts, playwright.config.ts,
  директория tests/, setup-файлы)
- **TASK-INF-003**: Docker dev-окружение (Dockerfile multi-stage,
  docker-compose.dev.yml: app+postgres+redis, .dockerignore)
- **TASK-INF-004**: globals.css + Tailwind theme (CSS variables, базовые стили,
  контейнер, утилиты)

### Backend
- **TASK-BCK-001**: Prisma schema (`Order`) + `lib/prisma.ts` singleton + seed
- **TASK-BCK-002**: `lib/logger.ts` (pino + redact)
- **TASK-BCK-003**: `lib/redis.ts` (ioredis) + `lib/rate-limit.ts`
- **TASK-BCK-004**: `lib/validators/order.ts` (Zod + libphonenumber-js)
- **TASK-BCK-005**: `lib/utils.ts` (cn, formatPhone, formatPrice, getClientIp)
- **TASK-BCK-006**: `lib/telegram.ts` + `services/notifyService.ts` (Telegram
  + graceful fallback + логирование)
- **TASK-BCK-007**: `services/ordersService.ts` (createOrder → Prisma + логирование)
- **TASK-BCK-008**: `app/api/orders/route.ts` (POST: валидация + rate-limit +
  service + notify + логирование)
- **TASK-BCK-009**: `app/api/health/route.ts` (db + redis ping)
- **TASK-BCK-010**: config: company, services, advantages, process-steps, site

### Frontend
- **TASK-FRT-001**: ui/ базовые (button, input, label, checkbox, card) — shadcn-style
- **TASK-FRT-002**: `app/layout.tsx` (шрифты, metadata, JsonLd, Метрика stub, Header/Footer/Floating)
- **TASK-FRT-003**: `components/layout/Header.tsx` (sticky, phone, CTA, mobile menu)
- **TASK-FRT-004**: `components/layout/Footer.tsx`
- **TASK-FRT-005**: `components/layout/FloatingCallBtn.tsx`
- **TASK-FRT-006**: `components/seo/JsonLd.tsx` + `lib/seo/metadata.ts`
- **TASK-FRT-007**: `components/sections/Hero.tsx`
- **TASK-FRT-008**: `components/sections/Services.tsx`
- **TASK-FRT-009**: `components/sections/Advantages.tsx`
- **TASK-FRT-010**: `components/sections/Process.tsx`
- **TASK-FRT-011**: `components/sections/Contacts.tsx`
- **TASK-FRT-012**: `components/forms/OrderForm.tsx` (RHF + Zod + fetch + 152-ФЗ)
- **TASK-FRT-013**: `app/page.tsx` (сборка секций)
- **TASK-FRT-014**: `app/politika/page.tsx` (заглушка политики ПД)
- **TASK-FRT-015**: `app/sitemap.ts` + `app/robots.ts`

### Testing
- **TASK-TST-001**: Unit — validators (order.ts: valid/invalid phone, edge cases)
- **TASK-TST-002**: Unit — rate-limit (allow/block, window, Redis-down fallback)
- **TASK-TST-003**: Unit — ordersService (create happy/error, logging)
- **TASK-TST-004**: Unit — notifyService (telegram success/failure fallback, logging)
- **TASK-TST-005**: Unit — utils (formatPhone, formatPrice, cn, getClientIp)
- **TASK-TST-006**: API — /api/orders (201/400/429/500, logging)
- **TASK-TST-007**: API — /api/health (200, db/redis status)
- **TASK-TST-008**: E2E — home.spec.ts (рендер секций, отправка формы happy + validation)

### Documentation
- **TASK-DOC-001**: README.md (обновить: как запустить dev, тесты, env)
- **TASK-DOC-002**: ARCHITECTURE.md (обновить статус: MVP главной готов)

---

## 7. Тестирование

### 7.1 Unit (Vitest)
- validators/order.ts: валидный RU телефон, невалидный, пустые поля, edge cases
- rate-limit: allow под лимитом, block сверх лимита, окно, fallback без Redis
- ordersService: createOrder happy path + DB error + логирование
- notifyService: telegram success + failure → fallback + логирование
- utils: formatPhone, formatPrice, cn, getClientIp

### 7.2 API (Vitest + mocks)
- POST /api/orders: 201 (valid), 400 (validation), 429 (rate-limit), 500 (DB down)
- GET /api/health: 200, корректные статусы db/redis

### 7.3 E2E (Playwright)
- Главная: все секции рендерятся, H1 видим
- Форма: happy path отправки, валидация телефона, отсутствие consent

### 7.4 Тестовые данные
- Валидный RU телефон: `+7 (999) 123-45-67`
- Невалидный: `123`, `+7999`, international non-RU

---

## 8. Риски и зависимости

| Риск | Смягчение |
|------|-----------|
| Redis/PostgreSQL не подняты локально без Docker | docker-compose.dev.yml + graceful fallback в коде |
| Telegram не настроен (нет токена) | notifyService try/catch, fire-and-forget, заявка всё равно сохраняется в БД |
| Шрифты/изображения увеличивают LCP | next/font + системный fallback, плейсхолдеры вместо стоковых фото |
| libphonenumber-js увеличивает бандл | Использовать только на client в OrderForm, lazy если нужно |
| E2E медленные в CI | Запускать только на PR, не на каждый push |

**Зависимости:** нет (проект пустой). Все задачи выполняются в порядке INF → BCK → FRT → TST.

---

## Маршрутизация

**Архитектор:** НЕ ТРЕБУЕТСЯ (архитектура уже спроектирована в ARCHITECTURE.md
и TECH_STACK.md; ADR по сути выполнен заранее при инициализации проекта).

**Исполнитель:** Разработчик (fullstack) → затем Тестировщик → затем DevOps.

**Обоснование:** Это код/UI-задача (инициализация проекта + UI главной + API
заявки). Все решения по стеку и архитектуре уже приняты в документации.
Объём — MVP (6 секций + форма + базовый API), остальные секции (калькулятор,
зона покрытия, отзывы, FAQ, цены) — отдельные ЧТЗ.

---

## Объём явно ВНЕ MVP (отдельные ЧТЗ позже)
- Онлайн-калькулятор стоимости
- Карта зоны покрытия (Yandex Maps)
- Отзывы с рейтингом
- FAQ-блок
- Страница цен (отдельная)
- Реальная интеграция Telegram-бота (сейчас заглушка-заготовка в notifyService)
- Страницы услуг (`/uslugi/[slug]`)
