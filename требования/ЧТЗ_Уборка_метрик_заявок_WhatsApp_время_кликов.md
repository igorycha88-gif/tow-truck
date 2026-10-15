# ЧТЗ: Уборка метрик заявок и WhatsApp, время переходов и кликов по телефону

## Версия: 1.0
## Дата: 2026-10-15
## Автор: AI-Аналитик
## Приоритет: High
## Статус: Active

---

## 1. Контекст и цель

На сайте скрыта форма заявки (конверсия переведена на прямой звонок `tel:`),
мессенджеры (WhatsApp) пока не подключены. Требуется согласовать метрики:

1. Убрать из внутренней Grafana панели «Заявки (сегодня)», «Заявки по дням»,
   «Заявки по статусам» и перестать собирать/вычислять метрики заявок
   (leads, конверсия, стадия воронки lead).
2. Убрать WhatsApp-клики из дашбордов и метрик (трекер, валидатор, сбор).
3. В таблице «Последние переходы» (страницы входа) показывать дату и время
   каждого перехода.
4. Добавить график кликов по телефону с датой и временем клика + таблицу
   последних кликов с точным временем.
5. Скорректировать ТЗ внешнего (централизованного) мониторинга.

**Решение владельца (зафиксировано):**
- Исторические данные в БД (Order, старые click_whatsapp события) — **НЕ удалять**.
  Перестаём собирать новые и показывать на дашбордах; история остаётся в БД.
- Формат времени входа — **список каждого перехода** (отдельная таблица
  «Последние переходы» с точными датой/временем, МСК).

## 2. Текущее состояние

| Объект | Файл | Проблема |
|---|---|---|
| Внутренняя Grafana (Postgres) | `grafana/dashboards/business-metrics.json` | панели заявок (id 1, 4, 5), «WhatsApp-клики» (id 24), воронка с заявками (id 25), «Клики» без фильтра типа |
| Зеркало Prometheus | `grafana/dashboards/business-prometheus.json` | «Трафик и лиды» (id 7, business_leads_24h), «Конверсия» (id 8), «Телефон vs WhatsApp» (id 9) |
| Сбор метрик | `src/services/promMetricsService.ts` | leads_24h/1h/7d, conversion_rate_*, whatsapp_*, funnel stage `lead`, запросы к Order и click_whatsapp |
| Метрики JSON API | `src/services/metricsService.ts` | `orders`/`byStatus` в `getMetrics()` |
| Клиентский трекер | `src/components/tracking/ClickEventsTracker.tsx` | ветка `click_whatsapp` (wa.me) |
| Валидатор | `src/lib/validators/click-event.ts` | `click_whatsapp` в EVENT_TYPES |
| ТЗ внешнего мониторинга | `требования/ЧТЗ_Централизованный_мониторинг.md`, `требования/ЧТЗ_Подключение_эвакуация_к_мониторингу.md` | требуют `business_leads_24h`, описывают заявки/конверсию/WhatsApp |
| ТЗ внутренней графаны | `требования/ЧТЗ_Внутренняя_Графана_Prometheus.md` | описывает лиды/WhatsApp в панелях |

## 3. Требования

### 3.1 Backend — убрать метрики заявок (TASK-BCK-001)

`src/services/promMetricsService.ts`:
- Удалить гейджи: `business_leads_24h`, `business_leads_1h`, `business_leads_7d`,
  `business_conversion_rate_24h`, `business_conversion_rate_7d`,
  `business_whatsapp_clicks_12h`, `business_whatsapp_clicks_7d`.
- `FUNNEL_STAGES`: `['visit', 'content_view', 'contact_click']` (без `lead`).
- `BusinessSnapshot` / входные данные / рендер: удалить leads, conversionRate,
  whatsapp-поля; `contact_click` сессии — только по `click_phone`.
- Удалить все запросы Prisma к `Order` и к `eventType: 'click_whatsapp'`
  (включая `business_whatsapp_clicks_event`).
- Удалить `computeConversionRate` (вместе с тестами).

### 3.2 Backend — JSON-метрики без заявок (TASK-BCK-002)

`src/services/metricsService.ts`:
- `BusinessMetrics`: удалить `orders` и `MetricsByStatus`.
- `getMetrics()`: убрать подсчёт заявок и groupBy status.
- Логирование скорректировать.

### 3.3 Трекинг — убрать WhatsApp (TASK-BCK-003)

- `src/components/tracking/ClickEventsTracker.tsx`: удалить ветку `wa.me`
  (click_whatsapp больше не отправляется).
- `src/lib/validators/click-event.ts`: `EVENT_TYPES = ['click_phone', 'service_click']`.
  Существующие `click_whatsapp` в POST `/api/click-event` теперь → 400 VALIDATION_ERROR.
- `prisma/schema.prisma`: обновить комментарии к `ClickEvent` (без миграций,
  колонки/индексы не меняются — история остаётся).

### 3.4 Внутренняя Grafana, Postgres-дашборд (TASK-FRT-001)

`grafana/dashboards/business-metrics.json`:
- Удалить: «Заявки (сегодня)» (id 1), «Заявки по дням» (id 4),
  «Заявки по статусам (стек)» (id 5), «WhatsApp-клики (7д)» (id 24).
- Панель «Клики по номеру (сегодня)» (id 2) и «Клики по номеру по дням» (id 6):
  фильтр `eventType = 'click_phone'`.
- Воронка (id 25): убрать серию «Заявки» (ref C); контакт-клики — только
  `click_phone`; заголовок «Воронка по дням: визиты → контент → контакт-клик».
- НОВАЯ таблица «Последние переходы (страница входа)»: каждая строка —
  вход сессии (`fromPage IS NULL AND sessionId IS NOT NULL`), колонки:
  «Дата и время перехода (МСК)» (`to_char((createdAt AT TIME ZONE 'UTC')
  AT TIME ZONE 'Europe/Moscow', 'DD.MM.YYYY HH24:MI')`), «Страница», «Источник»
  (referer), «Город». `ORDER BY createdAt DESC LIMIT 20`.
- НОВЫЙ график «Клики по телефону (по часам, 72ч)»: `date_trunc('hour')`,
  окно `now-72h`, ось X — дата и время.
- НОВАЯ таблица «Последние клики по телефону»: колонки «Дата и время клика
  (МСК)» (как выше), «Страница», «Город». `ORDER BY createdAt DESC LIMIT 20`.
  БЕЗ IP и User-Agent (152-ФЗ, IP маскирован).
- Пересчитать gridPos без дыр.

### 3.5 Зеркало Prometheus (TASK-FRT-002)

`grafana/dashboards/business-prometheus.json`:
- id 7: убрать `business_leads_24h`, заголовок «Трафик (24ч)».
- id 8: убрать конверсию (refs A, B), заголовок «Отказы (24ч / 7д)».
- id 9: убрать WhatsApp (refs B, D), заголовок «Клики по телефону».
- Воронки (id 11/12): стадия `lead` исчезнет из метрики сама (label-driven).

### 3.6 Документация внешнего мониторинга (TASK-DOC-001)

- `требования/ЧТЗ_Централизованный_мониторинг.md` → v1.1:
  - §4.1: удалить `business_leads_*` и `business_conversion_rate_*`;
    примечание об удалении (форма заявки скрыта, WhatsApp не подключён).
  - §8 п.1: критерий приёмки — вместо `business_leads_24h` проверять
    `business_phone_clicks_7d`.
- `требования/ЧТЗ_Подключение_эвакуация_к_мониторингу.md` → v1.1:
  - §1.2: «посетители/заявки/конверсия» → «посетители/клики по телефону/
    путь клиента»; примечание о смене метрик.
- `требования/ЧТЗ_Внутренняя_Графана_Prometheus.md` → v1.1: §3 — панель
  «Клики» без WhatsApp, графики без лидов/конверсии.

### 3.7 Тесты и логирование (обязательно, Правило 8)

- Обновить: `promMetricsService.test.ts` (без leads/conversion/whatsapp,
  funnel без lead), `metricsService.test.ts`, `click-event.test.ts`,
  `api/click-event/route.test.ts` (whatsapp → 400), `metrics/tracking/route.test.ts`
  (без business_leads_24h).
- Логирование в изменённых services сохранить (начало/конец операций, catch).

## 4. Декомпозиция

| ID | Задача | Исполнитель |
|---|---|---|
| TASK-BCK-001 | promMetricsService без заявок/WhatsApp/conversion | Разработчик |
| TASK-BCK-002 | metricsService.getMetrics без orders | Разработчик |
| TASK-BCK-003 | Трекер + валидатор без click_whatsapp | Разработчик |
| TASK-FRT-001 | business-metrics.json (удаление + новые панели) | Разработчик |
| TASK-FRT-002 | business-prometheus.json (зеркало) | Разработчик |
| TASK-DOC-001 | ТЗ внешнего/внутреннего мониторинга | Разработчик |
| TASK-INF-001 | Полная пересборка dev-стека (Grafana provisioning) | DevOps |

## 5. Критерии приёмки

1. `/metrics/tracking` НЕ содержит: `business_leads_*`,
   `business_conversion_rate_*`, `business_whatsapp_*`; воронка — 3 стадии.
2. POST `/api/click-event` c `eventType: 'click_whatsapp'` → 400 VALIDATION_ERROR.
3. GET `/api/metrics` — без блока `orders`.
4. Внутренняя Grafana: нет панелей заявок и WhatsApp; есть «Последние
   переходы» (дата/время МСК), «Клики по телефону (по часам, 72ч)»,
   «Последние клики по телефону» (дата/время МСК).
5. Исторические данные Order/ClickEvent в БД не тронуты.
6. ТЗ внешнего мониторинга обновлены (без leads/WhatsApp).
7. `npm run test && npm run lint && npx tsc --noEmit` — зелёные.
8. Dev-стек: полная пересборка, все сервисы healthy, дашборды рендерятся.

## 6. Не входит

- Удаление таблицы Order / строк click_whatsapp из БД (запрещено владельцем).
- Изменение `/api/orders` (функционал сайта, не метрики).
- Прод-деплой (отдельный конвейер `PIPELINE_PROD.js` по команде владельца).
- Внешняя Grafana мониторинга (130.49.218.204) — правит команда мониторинга
  по обновлённым ТЗ.

## Маршрутизация

**Архитектор:** НЕ ТРЕБУЕТСЯ (удаление метрик + конфиги дашбордов, новых
сущностей/эндпоинтов нет).
**Исполнитель:** Разработчик (BCK/FRT/DOC) → Тестировщик → DevOps (полная
пересборка dev).
**Обоснование:** изменения локальны, контракт `/metrics/*` (пути, auth,
формат) не меняется — меняется состав метрик.
