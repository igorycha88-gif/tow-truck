# ЧТЗ: Мониторинг ботов в Grafana — люди и боты раздельно

## Версия: 1.1
## Дата: 2026-11-11
## Автор: AI-Аналитик (конвейер), ADR-016
## Приоритет: High
## Статус: Согласовано

> **Изменения v1.1:** классификатор шиппера дополнен scripted-клиентами и
> сканерами (axios, python-requests, Go-http-client, curl/wget, zgrab,
> ExchangeScanner и др. → `vendor='scanner'`); в дашборд добавлены панель и
> стат «Кто пытался войти» (статусы 400/403/429) и колонка «Тип» с человеко-
> читаемым описанием вендора. Мотивация: на проде за 15 дней WAF отрезал
> 1470 запросов таких клиентов, DeepSeekBot придушен rate-limit (429) —
> ранее они не попадали в BotVisit (в UA нет bot/crawler).

---

## 1. Цели и задачи

Владельцу в Grafana (`https://эвакуация.online/grafana`) нужно видеть:

1. **Посещения людьми и ботами раздельно** — две независимые линии/панели.
2. **Какие боты приходили**: Yandex vs Google vs прочие, с точным именем
   (YandexBot, YandexMetrika, Googlebot, Googlebot-Image, GPTBot…).
3. **Когда приходили** — временные ряды по часам/дням.
4. **Какие страницы посещал каждый бот** — журнал: время, бот, страница, статус.

Контекст: сейчас боты в Grafana не видны (трекинг `Visit` — клиентский JS,
боты его не исполняют). Полный след ботов — только в nginx access-логе VPS
(15 дней истории). Решение по архитектуре — ADR-016 (вариант В).

## 2. Функциональные требования

### ФР-1. Сбор данных о ботах (без изменений кода приложения)
- Python-скрипт `deploy/bots-shipper/nginx_bots_shipper.py` на VPS:
  - инкрементально читает `/var/log/nginx/evakuaciya-online.access.log`
    (state-файл: inode+offset; survives logrotate);
  - классифицирует User-Agent: реестр известных ботов (v1.1: + scripted-клиенты
    и сканеры — axios, python-requests/-httpx, Go-http-client, curl, wget,
    zgrab, ExchangeScanner, masscan, nuclei, censys, shodan и др. →
    `vendor='scanner'`) + generic-фолбэк (`bot|crawler|spider|slurp`);
    не-боты НЕ импортируются;
  - каждому боту присваивает `botName` (каноническое) и `vendor`
    (`yandex|google|bing|openai|other`);
  - пишет строки в таблицу `BotVisit` через
    `docker exec -i tow-truck-db psql … COPY … FROM STDIN` (`ON CONFLICT DO NOTHING`);
  - запланирован в cron каждые 5 минут; ошибки пишет в свой лог
    (`/var/log/nginx-bots-shipper.log`), не ломает ничего при падении.
- Исключаемые пути: `/grafana*`, `/metrics/*`.
- Ретро-режим `--retro`: разовый импорт всех ротированных логов
  `evakuaciya-online.access.log.*.gz` (+ `.log.1`) — история за 15 дней.

### ФР-2. Таблица `BotVisit`
- Prisma-модель + миграция (schema.prisma):
  - `id` — TEXT PK, детерминированный `md5(ts|ip|method|path|userAgent)`
    → идемпотентность повторных импортов;
  - `ts` — timestamptz, время запроса из лога (не момент импорта);
  - `botName`, `vendor` — NOT NULL;
  - `ip` — маскированный (152-ФЗ: IPv4 → последний октет `0`; IPv6 → /64);
  - `method`, `path` (без query), `query` (?yclid=…), `status`, `referer`,
    `userAgent`, `createdAt`;
  - индексы: `ts`, `botName,ts`, `vendor,ts`, `path,ts`.

### ФР-3. Дашборд Grafana `bots-monitoring.json`
Datasource `postgres-metrics`. Панели:
1. Stat-ряд (6): Люди 24ч (из `Visit`) · Боты 24ч · Яндекс 24ч · Google 24ч ·
   Сканеры 24ч · **Заблокированные попытки 24ч** (status IN 400,403,429).
2. Time series: **Люди (Visit) vs Боты (BotVisit)** — раздельные линии за период.
3. Time series: боты по вендорам (yandex/google/bing/openai/scanner/other).
4. Bar chart: топ-10 ботов по имени за период.
5. Таблица: топ страниц у ботов (бот × страница × количество).
6. Таблица-журнал: последние 100 визитов ботов — время, бот, **Тип
   (человеко-читаемое описание вендора)**, страница(+query), статус, IP.
7. **«Кто пытался войти»** — таблица отвергнутых запросов ботов
   (status IN 400,403,429): время, имя бота, тип, страница, код, IP.
- Фильтр `vendor` дополнен значением `scanner` («Сканеры»).
- Интервалы: стандартные Grafana (с привязкой к `ts`, timezone Europe/Moscow
  как в остальных дашбордах).

### ФР-4. Установка на VPS
- `deploy/bots-shipper/setup-vps.sh`: проверка окружения (python3, docker,
  лог-файл), регистрация cron `*/5 * * * *`, запуск разового `--retro` импорта.
- Миграция применяется стандартным `prisma migrate deploy` при деплое.
- README с описанием установки/отката.

## 3. Нефункциональные требования

- **152-ФЗ:** IP ботов маскируются до записи (те же правила, что `maskIp` в
  приложении); UA-строки и query — не ПДн; данные людей не дублируются.
- **Производительность:** ~50–200 бот-строк/сутки; COPY-batch, единый psql-вызов
  на запуск; отсутствие нагрузки на БД (индексы только для чтения Grafana).
- **Надёжность:** скрипт не падает от битых строк лога (skip+warn в лог);
  повторный запуск не создаёт дублей; падение скрипта не влияет на сайт.
- **Безопасность:** скрипт на VPS читает креды БД из `/root/tow-truck/.env`
  (chmod 600), ничего не публикует наружу; лог не содержит паролей.
- **Код приложения Next.js не меняется** (0 изменений в src/).

## 4. Техническая архитектура

По ADR-016:

```
nginx access.log ──(python shipper, cron 5 мин)──▶ BotVisit (PostgreSQL)
                                                       ▲
Visit (клиентский JS, люди) ──────────────────────────┤
                                                       │
Grafana (bots-monitoring.json, datasource postgres) ───┘
```

- Скрипт: stdlib-only python3 (никаких pip-зависимостей).
- Парсинг combined-формата nginx regex-ом; строки с невалидной датой — skip+warn.
- Cron-окружение: PATH к docker; flock от параллельного запуска.

## 5. UI/UX требования

- Дашборд на русском (как `business-metrics.json`), заголовок «Боты и люди».
- Переменная-фильтр `vendor` (All/yandex/google/bing/openai/other) на дашборде.
- Читаемые подписи панелей; людям — зелёная палитра, ботам — оранжевая/красная
  (визуальное разделение).

## 6. Декомпозиция на задачи

| ID | Задача | Исполнитель |
|----|--------|-------------|
| TASK-BCK-001 | Prisma-модель `BotVisit` + SQL-миграция + проверка `migrate dev` | Разработчик |
| TASK-INF-001 | `nginx_bots_shipper.py`: парсер, классификатор UA, maskIp, state, psql COPY, `--retro`, flock | Разработчик |
| TASK-INF-002 | `setup-vps.sh` (cron + проверка окружения + retro-запуск) + README | Разработчик |
| TASK-FRT-001 | Дашборд `bots-monitoring.json` (6 панелей + фильтр vendor) | Разработчик |
| TASK-TST-001 | Тесты: python unittest (парсер/классификатор/маскирование/ретро/дедуп); валидация JSON дашборда | Разработчик |

Порядок: TASK-BCK-001 → TASK-INF-001 → TASK-TST-001 → TASK-INF-002 → TASK-FRT-001.

## 7. Тестирование

- **Unit (python unittest, `deploy/bots-shipper/test_nginx_bots_shipper.py`):**
  - парсер combined-строки (валидная, битая, IPv6, пустой referer);
  - классификатор: каждый известный бот → (botName, vendor); человек → None;
    подделка «Googlebot» в браузерном UA-хвосте — по реестру (см. примечание*);
  - maskIp: IPv4/IPv6/некорректный;
  - дедуп: одинаковая строка → одинаковый id; ON CONFLICT не растит счётчик;
  - исключение путей /grafana, /metrics.
- **Валидация дашборда:** JSON парсится, все panels ссылаются на
  `postgres-metrics`, SQL-запросы синтаксически валидны (EXPLAIN на dev-БД).
- **Vitest/lint/tsc:** обязательный прогон (`npm run test && npm run lint &&
  npx tsc --noEmit`) — код приложения не меняется, но регрессия исключается.
- **Ручная проверка на VPS после установки:** retro-импорт наполняет BotVisit,
  дашборд показывает людей и ботов раздельно.

Примечание*: скрипт классифицирует по подстрокам UA (это мониторинг статистики,
не access-control) — точная верификация rDNS не требуется (см. ADR-016).

## 8. Риски и зависимости

| Риск | Митигание |
|------|-----------|
| Смена формата nginx-лога | парсер падает мягко: skip+warn, алерт в логе скрипта |
| Logrotate между запусками | state хранит inode: новый inode → полный файл, дедуп по id |
| VPS без python-модулей | stdlib-only |
| Дубли при ретро | детерминированный id + ON CONFLICT DO NOTHING |
| Рост таблицы | ~200 строк/сутки; retention не требуется (годы — копейки) |

## Маршрутизация

- **Маршрут 2** (сложная задача): Архитектор (ADR-016 — готов) → Аналитик (ЧТЗ) →
  **Разработчик** → Тестировщик → DevOps.
- **Исполнитель после ЧТЗ: Разработчик** (код скриптов, дашборда, миграции, тестов).
- DevOps: деплой на dev (миграция+тесты) не требуется менять compose; прод — по
  отдельной команде пользователя (PIPELINE_PROD), установка shipper через
  `setup-vps.sh` на VPS.

## Критерии приёмки

1. `BotVisit` в schema.prisma + миграция накатывается без ошибок.
2. Скрипт на тестовом лог-фрагменте: боты классифицированы (YandexBot→yandex,
   Googlebot→google, GPTBot→openai, bingbot→bing, неизвестный краулер→other;
   v1.1: axios→scanner, python-requests→scanner, curl→scanner,
   zgrab→scanner, ExchangeScanner→scanner, DeepSeekBot→other),
   люди пропущены, пути /grafana//metrics исключены, IP замаскированы.
3. Повторный прогон скрипта на том же логе не добавляет строки (дедуп).
4. python unittest проходит; `npm run test && npm run lint && npx tsc --noEmit` проходят.
5. Дашборд валиден: люди (Visit) и боты (BotVisit) — раздельные панели; фильтр
   vendor работает (вкл. scanner); есть таблица «бот × страницы × время»;
   v1.1: панель «Кто пытался войти» (400/403/429) + колонка «Тип» в журнале.
6. Установка на VPS (`setup-vps.sh`): cron зарегистрирован, retro-импорт выполнен,
   в Grafana видны реальные боты за 15 дней (YandexMetrika, YandexBot, Googlebot,
   bingbot, GPTBot — подтверждено выше при диагностике; v1.1: заблокированные
   axios/ExchangeScanner/zgrab видны в панели «Кто пытался войти»).
