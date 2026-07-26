# Архитектура проекта «Эвакуация (Москва и МО)»

> Документ ведёт Архитектор. Обновляется при архитектурных изменениях.
> Техстек и обоснование: [`TECH_STACK.md`](./TECH_STACK.md).

---

## 1. Обзор

Production-ready сайт услуг эвакуатора в Москве и МО. Lead-gen сервис с фокусом на:
скорость (LCP < 2.5s), мобильный опыт, локальное SEO, максимизацию лидов
(звонки + заявки → Telegram оператору).

**Архитектурный паттерн:** монолит Next.js 15 (App Router) fullstack — UI + API + services
в едином кодбейсе. Без микросервисов (overkill для масштаба).

---

## 2. Слои

```
┌──────────────────────────────────────────────────────────┐
│  VISITOR (mobile-first, RU)                              │
└────────────────────────┬─────────────────────────────────┘
                         │ HTTPS
┌────────────────────────▼─────────────────────────────────┐
│  NGINX (reverse proxy, SSL, Blue-Green upstream switch)  │
└────────────────────────┬─────────────────────────────────┘
                         │ :3001 (prod) / :3003 (green)
┌────────────────────────▼─────────────────────────────────┐
│  NEXT.JS APP (App Router, RSC)                           │
│  ├─ (public)/   — страницы (SSR/SSG)                     │
│  ├─ api/        — Route Handlers (orders, health)        │
│  ├─ components/ — UI (Server/Client Components)          │
│  ├─ lib/        — prisma, redis, logger, telegram, utils │
│  ├─ services/   — бизнес-логика (orders, notify)         │
│  └─ config/     — каталог услуг/цен/отзывов/зон (TS)     │
└───┬──────────────┬──────────────┬──────────────┬─────────┘
    │              │              │              │
┌───▼────┐   ┌────▼────┐   ┌─────▼─────┐  ┌─────▼──────┐
│Postgres│   │  Redis  │   │ Telegram  │  │ Yandex     │
│ (заявки)│   │(rate-lim│   │ Bot API   │  │ Maps/Метр. │
└────────┘   └─────────┘   └───────────┘  └────────────┘
```

---

## 3. Поток заявки (ключевой сценарий)

```
1. Клиент заполняет форму (имя, телефон, локация, тип услуги)
2. React Hook Form + Zod валидируют на клиенте (RU телефон)
3. POST /api/orders (rate-limited: 3/час с IP через Redis)
4. ordersService.createOrder() → PostgreSQL (Order, status=NEW)
5. notifyService.notifyNewOrder() → Telegram оператору (+ email-резерв при сбое)
6. Клиент видит «Заявка принята, перезвоним»
7. Логирование на каждом шаге (pino, маскирование телефона)
```

---

## 4. Хранение контента (БЕЗ админки)

| Тип | Хранилище | Обоснование |
|-----|-----------|-------------|
| Заявки | PostgreSQL (`Order`) | Долговечность, аналитика, страховка Telegram |
| Услуги/прайс | `src/config/services.ts` | Без админки, git-управление, типобезопасно |
| Отзывы | `src/config/reviews.ts` | Контролируется, без спама |
| Зоны покрытия | `src/config/areas.ts` | Карты + список |
| FAQ | `src/config/faq.ts` | SEO long-tail |

> При росте — можно вынести контент в БД + админку. Сейчас config проще.

---

## 5. Модель данных (Prisma)

```prisma
model Order {
  id          String   @id @default(cuid())
  name        String
  phone       String
  location    String
  serviceType String         // light_vehicle, moto, commercial, offroad, accident, fuel
  status      String   @default("NEW")  // NEW, CALLED, DONE, CANCELLED
  source      String   @default("website")
  ip          String?
  utm         Json?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([status])
  @@index([createdAt])
}
```

> Расширяется по мере необходимости (Review, ServiceArea — при переходе к БД-контенту).

---

## 6. Компонентная стратегия (Server vs Client)

| Тип | Component | Причина |
|-----|-----------|---------|
| Server (по умолчанию) | страницы, секции контента, услуги, отзывы, цены | SEO, минимум JS |
| Client | формы (OrderForm), калькулятор (интерактив), карта, бургер-меню | state, события |

---

## 7. SEO-архитектура

- **SSR/SSG** для всех публичных страниц (App Router)
- `generateMetadata` на каждой странице (title, description, OG)
- **schema.org:** LocalBusiness (главная), Service (услуги), FAQ, BreadcrumbList, AggregateRating
- `app/sitemap.ts` + `app/robots.ts`
- Семантический HTML, `alt` у всех изображений
- Yandex.Метрика через `<Script strategy="afterInteractive">`

---

## 8. Развёртывание

| Среда | Ветка | Стратегия | Порт |
|-------|-------|-----------|------|
| dev | `dev` | Полная пересборка контейнеров (`docker-compose.dev.yml`) | 3000 |
| prod | `main` | Blue-Green (образ из GHCR, `docker-compose.yml`) | 3001/3003 |

CI: GitHub Actions → lint, test, build → push образа в GHCR.
Подробнее: `PIPELINE.js` (dev), `PIPELINE_PROD.js` (prod).

---

## 9. Безопасность и соответствие

- Валидация входов (Zod) на API и в формах
- Валидация RU телефона (libphonenumber-js)
- Rate-limit публичного API (Redis, 3/час с IP)
- **152-ФЗ:** чекбокс согласия на ПД + страница Политики
- Маскирование ПД в логах (pino redact: phone)
- Секреты только в `.env`
- HTTPS only (Nginx SSL)

---

## 10. Журнал архитектурных решений (ADR)

> Раздел заполняется Архитектором при принятии решений.

- *Пока пусто. Первый ADR будет создан при первой сложной задаче.*

---

## 11. Статус

- **Текущая фаза:** MVP главной страницы реализован (Hero, Услуги, Преимущества,
  Схема работы, Форма заявки, Контакты, sticky-header + floating-call)
- **Реализовано:** инициализация Next.js 15 проекта, Prisma `Order`, API
  `/api/orders` (валидация Zod + rate-limit Redis + Telegram/email-нотификация
  с graceful fallback), `/api/health`, SEO (metadata, LocalBusiness JSON-LD,
  sitemap, robots), Docker dev-окружение, 48 автотестов (Vitest) + E2E (Playwright)
- **Следующий шаг:** деплой dev-окружения (полная пересборка контейнеров) →
  затем отдельные ЧТЗ: онлайн-калькулятор, карта зоны покрытия, отзывы, FAQ, цены
- **Версия:** `0.1.0` (MVP главной)
