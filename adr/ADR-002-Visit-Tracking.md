# ADR-002: Трекинг посетителей сайта (модель Visit)

**Дата:** 2026-08-14
**Статус:** Accepted
**Контекст:** Метрика «посетители» в Grafana показывает 0: она считается как
`COUNT(DISTINCT ip)` из `Order` (заявок нет — посетителей «нет»). Реального
трекинга визитов не существует: посетитель фиксируется только при заявке или
клике по номеру. Нужно фиксировать каждое посещение и строить часовой график.

## Решение

Клиентский beacon-трекер + таблица `Visit` + endpoint `POST /api/visit`.
Grafana читает Visit напрямую через PostgreSQL datasource (как в ADR-001).

### Компоненты:
1. **Visit** — новая таблица Prisma (ip, userAgent, page, createdAt)
2. **POST /api/visit** — Route Handler: Zod → rate-limit (Redis) → Prisma
3. **VisitTracker** — Client Component в корневом layout: 1 запрос на страницу
   за сессию браузера (sessionStorage), fire-and-forget, keepalive
4. **Grafana** — исправленная панель «Посетители» (из Visit) + новая панель
   «Посетители по часам» (date_trunc('hour'))

## Альтернативы

### Вариант А: Client beacon (рекомендован) — ВЫБРАН
VisitTracker в layout → POST /api/visit.
- **Плюсы:** тот же паттерн что PhoneClickTracker (ADR-001); Prisma работает
  в Route Handler (Node runtime); дедуп на клиенте (sessionStorage) отсекает
  перезагрузки; не зависит от edge-ограничений.
- **Минусы:** не срабатывает без JS (боты/curl) — приемлемо, ботов считаем
  через Метрику; adblock может блокировать.
- **Оценка:** 9/10

### Вариант Б: Next.js middleware
Логика в middleware.ts на каждый запрос.
- **Плюсы:** фиксирует и no-JS запросы.
- **Минусы:** middleware — Edge runtime, Prisma напрямую нельзя (нужен
  доп. HTTP-вызов внутрь); шум от _next/static; в Next 15 Node-runtime
  middleware экспериментален; дедуп сложнее.
- **Оценка:** 5/10

### Вариант В: Парсинг Nginx access.log
- **Плюсы:** фиксирует вообще всё, ноль кода в приложении.
- **Минусы:** нужен pipeline доставки логов в БД/Loki — новая инфраструктура;
  статика/боты шумят; срок реализации выше.
- **Оценка:** 4/10

## Детали дизайна

### Схема БД
```prisma
model Visit {
  id        String   @id @default(cuid())
  ip        String?
  userAgent String?
  page      String   @default("home")
  createdAt DateTime @default(now())

  @@index([createdAt])
  @@index([page])
}
```

- `page` — свободный slug (не enum): страницы добавляются без миграций схемы;
  валидация Zod: строка 1-100, паттерн `^[a-z0-9/_-]*$`, дефолт `home`.

### Дедупликация
- Клиент: sessionStorage `visit:<path>` — 1 beacon на страницу за сессию.
- Сервер: rate-limit `visit:<ip>` (дефолт 120/час, env RATE_LIMIT_VISIT_PER_HOUR).
- Отчёты: посетители = COUNT(DISTINCT ip) — робастно к дублям.

### Нормализация IP
`getClientIp` дополняется `normalizeIp()`: `::ffff:1.2.3.4` → `1.2.3.4`.
Применяется в /api/visit, /api/click-event, /api/orders (новые записи;
существующие `::ffff:`-записи в отчётах дедуплицируются как есть — исторических
строк мало, миграция данных нецелесообразна).

### Часовой график (Grafana)
```sql
SELECT date_trunc('hour', "createdAt") AS "Time",
       COUNT(DISTINCT "ip")::int AS "Посетители",
       COUNT(*)::int AS "Визиты"
FROM "Visit"
WHERE $__timeFilter("createdAt") AND "ip" IS NOT NULL AND "ip" <> 'unknown'
GROUP BY 1 ORDER BY 1;
```
БД хранит UTC (timestamptz-инстанты), дашборд — timezone browser (МСК):
часовые корзины отображаются корректно без смещения.

### Совместимость
- `GET /api/metrics`: `visitors.*` теперь из Visit (источник истины).
  Order/ClickEvent IP больше не смешиваются с визитами (иначе метрика
  «посетители» задваивалась против новой Visit).
- Клики/заявки не меняются.

## Влияние на архитектуру
- Новая таблица + миграция; новый endpoint; VisitTracker в layout;
  правки business-metrics.json; metricsService + createVisit.

## Риски и митигация
| Риск | Митигация |
|---|---|
| Рост Visit (боты/перезагрузки) | rate-limit; DISTINCT ip в отчётах; индекс createdAt |
| Adblock режет beacon | Индикативная метрика; Метрика остаётся резервом |
| БД-запись на каждый визит | Таблица узкая, нагрузка минимальна для MVP |

## Критерии успеха
- [ ] Visit создаётся при заходе на любую страницу (1 раз/сессия/страница)
- [ ] Панель «Посетители» показывает данные при 0 заявках и 0 кликах
- [ ] Часовой график показывает распределение посещений по часам (МСК)
- [ ] npm run test && lint && tsc — зелёные
