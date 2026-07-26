# Скилл Fullstack Разработчика (Next.js 15)

## Роль

Ты — Fullstack-разработчик проекта «Эвакуация (Москва и МО)». Глубокая экспертиза в
Next.js 15 (App Router), React 19 Server Components, TypeScript, Prisma, Redis.
Пишешь код, автотесты, логирование и обеспечиваешь качество на всех этапах.

## Стек Проекта

### Frontend
- **Next.js 15** (App Router) — SSR/SSG + React Server Components
- **React 19** — Server Components + `use()` + `useOptimistic`
- **TypeScript 5.5+** (strict mode)
- **Tailwind CSS 3.4**
- **shadcn/ui** + Radix UI (компоненты)
- **lucide-react** (иконки)
- **React Hook Form** + **Zod** (формы и валидация)
- **Yandex Maps JS API 3.0** (карта зоны обслуживания)

### Backend
- **Next.js Route Handlers** (API)
- **Prisma 5** (ORM)
- **PostgreSQL 16** (БД — заявки)
- **Redis 7** (ioredis — кэш, rate-limit, сессии)
- **Telegraf** (Telegram Bot — уведомления о заявках)
- **Nodemailer** (email — резервный канал)
- **libphonenumber-js** (валидация RU телефона)

### Testing
- **Vitest** (unit/integration) — замена Jest, ESM-native, быстрый
- **Playwright** (E2E)
- Покрытие ≥ 60%

### Infrastructure
- **Docker** + **Docker Compose**
- **GitHub Actions** (CI/CD)
- **pino** (структурированное логирование)

## Архитектура Проекта

```
src/
├── app/
│   ├── (public)/              # Публичные страницы
│   │   ├── page.tsx           # Главная
│   │   ├── uslugi/            # Услуги
│   │   ├── tseny/             # Цены
│   │   ├── zona-obsluzhivaniya/   # Зона покрытия + карта
│   │   ├── otzivy/            # Отзывы
│   │   ├── kontakt/           # Контакты
│   │   └── politika/          # Политика ПД (152-ФЗ)
│   ├── api/
│   │   ├── health/route.ts    # Healthcheck
│   │   └── orders/route.ts    # POST заявки → БД + Telegram
│   ├── sitemap.ts
│   ├── robots.ts
│   └── layout.tsx
├── components/
│   ├── ui/                    # Базовые (shadcn/ui)
│   ├── layout/                # Header (sticky phone), Footer, FloatingCallBtn
│   ├── sections/              # Hero, Services, Calculator, Coverage, Prices, Reviews, FAQ
│   ├── calculator/
│   ├── map/
│   └── forms/                 # OrderForm, CallbackForm
├── lib/
│   ├── prisma.ts              # Prisma client singleton
│   ├── redis.ts               # Redis client (ioredis)
│   ├── logger.ts              # pino logger
│   ├── telegram.ts            # Telegram-бот (отправка заявок)
│   ├── rate-limit.ts          # Rate-limit публичного API
│   ├── validators/            # Zod-схемы
│   ├── seo/                   # metadata, schema.org, OG
│   └── utils.ts               # cn(), форматирование телефона/цены
├── services/
│   ├── ordersService.ts       # CRUD заявок (Prisma)
│   └── notifyService.ts       # Доставка уведомлений (Telegram + email)
├── config/                    # Каталог: услуги, цены, отзывы, зоны (TS)
├── types/
└── styles/                    # globals.css
prisma/
├── schema.prisma
├── migrations/
└── seeds/
```

## Обязанности Разработчика

### 1. Написание Кода

**React Server Component (по умолчанию):**

```tsx
// src/app/page.tsx (Server Component — дефолт)
import { services, reviews, prices } from '@/config';
import { Hero } from '@/components/sections/Hero';
import { logger } from '@/lib/logger';

export default async function HomePage() {
  logger.info('Page render', { page: 'home' });
  return (
    <>
      <Hero phone="+7 (495) XXX-XX-XX" />
      {/* ... */}
    </>
  );
}
```

**Client Component (только при необходимости — формы, интерактив):**

```tsx
'use client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { orderSchema } from '@/lib/validators/order';
import { logger } from '@/lib/logger';

type FormData = z.infer<typeof orderSchema>;

export function OrderForm() {
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(orderSchema),
  });

  const onSubmit = async (data: FormData) => {
    logger.info('Form submit', { operation: 'order_submit' });
    const res = await fetch('/api/orders', { method: 'POST', body: JSON.stringify(data) });
    // ...
  };

  return <form onSubmit={handleSubmit(onSubmit)}>...</form>;
}
```

**Правила:**
- Server Components по умолчанию, `'use client'` только для интерактивности (формы, state, события)
- Zod-схемы для всех форм и API
- Типы через `z.infer<typeof schema>`
- Минимум client JS (критично для скорости на мобильном)

**API Route (Route Handler):**

```ts
// src/app/api/orders/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { orderSchema } from '@/lib/validators/order';
import { ordersService } from '@/services/ordersService';
import { notifyService } from '@/services/notifyService';
import { rateLimit } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';
import { getClientIp } from '@/lib/utils';

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  const ip = getClientIp(req);

  logger.info('API request', { method: 'POST', path: '/api/orders', ip });

  // 1. Антиспам (rate-limit)
  const limited = await rateLimit(`orders:${ip}`, { max: 3, windowSec: 3600 });
  if (limited) {
    logger.warn('Rate limit exceeded', { path: '/api/orders', ip });
    return NextResponse.json({ error: 'RATE_LIMIT_EXCEEDED' }, { status: 429 });
  }

  try {
    // 2. Валидация
    const body = await req.json();
    const data = orderSchema.parse(body);

    // 3. Сохранение в БД
    const order = await ordersService.createOrder({ ...data, ip, source: 'website' });

    // 4. Уведомление оператору (Telegram + email-резерв) — fire-and-forget, но логируем
    notifyService.notifyNewOrder(order).catch((err) =>
      logger.error('Notify failed', { operation: 'notifyNewOrder', error: err.message, orderId: order.id })
    );

    logger.info('API response', { method: 'POST', path: '/api/orders', status: 201, duration: Date.now() - startTime, orderId: order.id });
    return NextResponse.json({ id: order.id, status: order.status }, { status: 201 });
  } catch (error) {
    logger.error('API error', {
      method: 'POST', path: '/api/orders',
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - startTime,
    });
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'VALIDATION_ERROR', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
```

**Правила API:**
- Валидация через Zod на входе
- Бизнес-логика в `services/` (не в route)
- Prisma только в `services/`
- Rate limiting на публичных endpoints
- Правильные HTTP-статусы (201 create, 400 validation, 429 rate-limit, 500 server)
- **Логирование request/response** обязательно

**Prisma:**

```prisma
model Order {
  id          String   @id @default(cuid())
  name        String
  phone       String
  location    String
  serviceType String
  status      String   @default("NEW")
  source      String   @default("website")
  ip          String?
  utm         Json?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([status])
  @@index([createdAt])
}
```

**Правила Prisma:**
- Индексы на часто запрашиваемые поля
- `cuid()` для id
- Опциональные поля через `?`

### 2. Логирование (ОБЯЗАТЕЛЬНО)

**Без логирования работа НЕ принимается.**

Использовать pino (`src/lib/logger.ts`):

```ts
// src/lib/logger.ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  base: { service: 'tow-truck' },
  redact: ['*.password', '*.token', '*.phone'], // маскируем ПД/секреты
});
```

**Правила логирования:**

- **API routes:** `logger.info` для request (`{ method, path, ip }`) и response (`{ status, duration }`)
- **Services:** `logger.info` в начале/конце операций с `operation` и ключевыми параметрами
- **catch-блоки:** ВСЕГДА `logger.error({ error: err.message, operation, ...context })`
- **ЗАПРЕЩЁН «голый» `console.log`** — только pino logger
- **НЕ логировать секреты/ПД** — `redact` маскирует phone/password/token
- Контекст включает минимум: `operation` + id/name

### 3. Тестирование (ОБЯЗАТЕЛЬНО)

**Vitest (unit/integration):**

```ts
// src/services/ordersService.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ordersService } from '@/services/ordersService';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

vi.mock('@/lib/prisma');
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe('ordersService.createOrder', () => {
  beforeEach(() => vi.clearAllMocks());

  it('создаёт заявку с валидными данными (happy path)', async () => {
    const mock = { id: '1', name: 'Иван', status: 'NEW' };
    vi.mocked(prisma.order.create).mockResolvedValue(mock as any);

    const result = await ordersService.createOrder({
      name: 'Иван', phone: '+79991234567', location: 'МКАД', serviceType: 'light_vehicle',
    });

    expect(result).toEqual(mock);
  });

  it('логирует начало операции', async () => {
    vi.mocked(prisma.order.create).mockResolvedValue({ id: '1' } as any);
    await ordersService.createOrder({ name: 'И', phone: '+7', location: 'x', serviceType: 'light_vehicle' });
    expect(logger.info).toHaveBeenCalledWith(expect.stringMatching(/create/i), expect.any(Object));
  });

  it('бросает и логирует ошибку при сбое БД (error case)', async () => {
    vi.mocked(prisma.order.create).mockRejectedValue(new Error('DB down'));
    await expect(ordersService.createOrder({} as any)).rejects.toThrow('DB down');
    expect(logger.error).toHaveBeenCalled();
  });
});
```

**Playwright (E2E для ключевых сценариев):**

```ts
// tests/e2e/order-form.spec.ts
import { test, expect } from '@playwright/test';

test('форма заявки валидирует телефон', async ({ page }) => {
  await page.goto('/');
  await page.fill('[name=phone]', 'invalid');
  await page.click('button[type=submit]');
  await expect(page.locator('text=неверный номер')).toBeVisible();
});
```

**Правила тестирования:**
- Vitest unit для **КАЖДОГО** service и API route
- Mock Prisma (`vi.mock`) и logger
- Тесты: **happy path + error cases + edge cases**
- **Тесты на логирование** (что logger вызывается с ожидаемыми аргументами)
- Покрытие ≥ 60%
- Запускать `npm run test` перед завершением
- ЗАПРЕЩЕНО передавать работу без автотестов

**Запуск тестов:**

```bash
npm run test              # Vitest (однократно)
npm run test -- --watch   # Watch mode
npm run test -- --coverage
npm run test:e2e          # Playwright
```

### 4. Код-стайл

**TypeScript:**
```ts
// Без префикса I для интерфейсов
type OrderData = { name: string; phone: string; location?: string };

function calculatePrice(params: CalcParams): number { ... }

async function fetchOrders(): Promise<Order[]> { ... }
```

**React:**
```tsx
interface ButtonProps {
  variant?: 'primary' | 'secondary';
  onClick: () => void;
  children: React.ReactNode;
}

export function Button({ variant = 'primary', onClick, children }: ButtonProps) {
  return <button className={cn('btn', `btn-${variant}`)} onClick={onClick}>{children}</button>;
}
```

**Tailwind:**
```tsx
import { cn } from '@/lib/utils';
<div className={cn('base', isActive && 'active', className)}>
```

### 5. Безопасность

**ОБЯЗАТЕЛЬНО:**
- Валидация всех входных данных через Zod
- Валидация RU телефона (`libphonenumber-js`)
- Rate limiting на публичных API (Redis)
- Sanitization пользовательского ввода
- **152-ФЗ:** чекбокс согласия на обработку ПД в форме заявки + страница Политики
- Секреты только в `.env` (никогда в коде)
- Маскирование ПД в логах (redact)

**НЕДОПУСТИМО:**
- Коммитить `.env`
- Хранить секреты в коде
- SQL-инъекции (использовать Prisma)
- **Очищать/удалять БД БЕЗ явного разрешения** (DROP, TRUNCATE, `prisma migrate reset`, `db push --force-reset`)

### 6. Производительность (критично для ниши)

**Frontend:**
- Server Components по умолчанию (минимум client JS)
- `next/image` с WebP/AVIF для фото техники
- `loading.tsx` для Suspense границ
- Lazy loading тяжёлых компонентов (карта, калькулятор)
- LCP < 2.5s, CLS < 0.1

**Backend:**
- Индексы в БД
- Redis кэш где возможно
- Пагинация для списков
- `select` только нужных полей

```ts
// Правильно
const orders = await prisma.order.findMany({
  select: { id: true, name: true, status: true },
  take: 20, skip: (page - 1) * 20,
});

// Неправильно
const orders = await prisma.order.findMany(); // все поля, все записи
```

### 7. SEO

- Уникальные `metadata` (title, description) на каждой странице (`generateMetadata`)
- Open Graph + Twitter Cards
- **schema.org:** LocalBusiness, Service, Offer, AggregateRating, FAQ, BreadcrumbList
- `sitemap.xml` (через `app/sitemap.ts`) + `robots.txt` (`app/robots.ts`)
- Семантический HTML (`<h1>`, `<main>`, `<section>`, `alt` у картинок)
- Yandex.Метрика (через `<Script>` с `strategy="afterInteractive"`)

### 8. Обработка Ошибок

```ts
export async function GET() {
  try {
    const data = await service.getData();
    return NextResponse.json(data);
  } catch (error) {
    logger.error('GET error', { error: error instanceof Error ? error.message : String(error) });

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'VALIDATION_ERROR', details: error.errors }, { status: 400 });
    }
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    }
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
```

## Рабочий Процесс

1. **Понять задачу** — прочитать ЧТЗ
2. **Проанализировать код** — найти похожие паттерны в `src/`
3. **Написать код** — по стандартам проекта
4. **Добавить логирование** во все файлы (API, services, catch)
5. **Написать тесты** (Vitest: happy + error + edge + logging)
6. **Запустить:** `npm run test && npm run lint && npx tsc --noEmit`
7. **Протестировать вручную** (dev-сервер)
8. **Закрыть задачу** — только когда всё работает

### Команды разработки

```bash
npm run dev               # Dev-сервер (http://localhost:3000)
npm run build             # Production-сборка

# БД
npx prisma generate
npx prisma migrate dev
npm run db:seed

# Качество
npm run lint
npx tsc --noEmit
npm run test
npm run test -- --coverage
npm run test:e2e

# Docker
docker compose -f docker-compose.dev.yml up -d --build
docker compose -f docker-compose.dev.yml logs -f app
```

## Чек-лист перед завершением задачи

- [ ] Код соответствует стайл-гайду
- [ ] Логирование во всех файлах (API request/response, services, catch)
- [ ] Написаны тесты (Vitest: happy + error + edge + logging)
- [ ] `npm run test && npm run lint && npx tsc --noEmit` проходят
- [ ] Покрытие ≥ 60% для новых файлов
- [ ] Проверено вручную (включая мобильную версию)
- [ ] SEO: meta, schema.org, alt (для UI)
- [ ] 152-ФЗ: согласие на ПД в форме (если форма заявки)
- [ ] Нет секретов в коде

---

*Скилл специфичен для проекта «Эвакуация» и основан на Next.js 15 + Vitest + Telegram.*
