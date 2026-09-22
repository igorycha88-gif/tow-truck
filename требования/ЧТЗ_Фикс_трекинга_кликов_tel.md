# ЧТЗ (упрощённое) — Фикс трекинга кликов по телефону (tel:-handoff)

**Дата:** 22.09.2026
**Маршрут:** Аналитик → Разработчик → Тестировщик → DevOps (прод-деплой)
**Версия-цель:** v0.14.1 (patch)

## Проблема

С 15.09 10:44 UTC (деплой aac6b13 «убрать форму, CTA → tel:») на проде **0 событий
`click_phone`** при живом трафике (~120 визитов за 8 дней, до этого CTR ≈ 6%).
Визиты (`/api/visit`) при этом регистрируются корректно.

**Диагностика (22.09):**
- Сайт работоспособен: 120/120 URL — 200, /api/health OK (db/redis up), SSL до 07.11.
- Живая проверка Chromium (desktop + mobile + tap) и WebKit: трекинг кликов
  на главной и страницах услуг работает, ошибок гидрации/JS нет.
- POST /api/click-event от реальных пользователей в nginx не приходили вовсе
  (не 4xx/5xx — именно не приходили) весь период 15–21.09 и после.

**Корневая причина:** `ClickEventsTracker.sendEvent` использует `fetch keepalive`,
клик по `tel:` инициирует хендофф в диалер — мобильный браузер сворачивает/убивает
страницу до завершения запроса. До 15.09 главный CTA вёл на `/#order` (внутренняя
навигация, страница жива), телефонные ссылки кликали в основном с desktop (fetch
успевает). После перевода CTA на `tel:` основной клик — мобильный, с убийством страницы.

## Решение

1. Отправка событий кликов через `navigator.sendBeacon` (спроектирован для выживания
   при unload/навигации), с fallback на `fetch keepalive` при недоступности/отказе
   sendBeacon (возвращает false при превышении лимита очереди).
2. **(добавлено при реализации)** Убран досрочный выход по `event.defaultPrevented`:
   Next.js `<Link>` (карточки услуг) делает preventDefault при клиентской навигации,
   из-за чего `service_click` не трекался НИКОГДА (в БД 0 записей за всё время).
   Проверка `event.button !== 0` сохранена.

## Изменяемые файлы

1. `src/lib/click-beacon.ts` (новый) — транспорт sendBeacon-first + fetch-fallback.
2. `src/components/tracking/ClickEventsTracker.tsx` — переход на sendClickBeacon,
   убран defaultPrevented-guard.
3. `src/lib/click-beacon.test.ts` (новый) — unit-тесты транспорта (6 кейсов).
4. `tests/e2e/metrics.spec.ts` — починка упавших тестов: `noWaitAfter` для tel:-кликов
   (внешний протокол = таймаут клика), `postData()` вместо `postDataJSON()` для
   Blob-beacon. Тесты были красные ДО изменений (в CI e2e не запускаются).

## Критерии приёмки

1. Клик по tel: шлёт POST /api/click-event через `navigator.sendBeacon`
   (Blob, `application/json`) — проверяется unit-тестом.
2. Если sendBeamon недоступен или вернул false — fallback на `fetch keepalive`
   (проверяется unit-тестом).
3. Существующие e2e (tests/e2e/metrics.spec.ts) остаются зелёными
   (Playwright перехватывает и beacons, и fetch).
4. `npm run test && npm run lint && npx tsc --noEmit` — без ошибок.
5. Логирование: без изменений (клиентский fire-and-forget, ошибки молчаливы
   по архитектуре ADR-012; серверная часть не меняется).

## Риски

- Низкие: API не меняется (тот же POST /api/click-event, тот же JSON).
- sendBeacon не поддерживает заголовки — Content-Type через Blob.type
  (application/json парсится сервером корректно).
