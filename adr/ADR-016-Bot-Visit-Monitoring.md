# ADR-016: Мониторинг посещений сайта поисковыми ботами (nginx → BotVisit → Grafana)

**Дата:** 2026-11-11
**Статус:** Accepted
**Контекст:** Владельцу нужно в Grafana видеть посещения сайта **людьми и ботами раздельно**:
какие боты (Yandex, Google, другие) приходили, когда и какие страницы они посещали.
Сейчас боты в Grafana не видны вообще: трекинг визитов (ADR-002/ADR-014) — клиентский
JS (`/api/visit`), а поисковые роботы JS не исполняют. Единственный полный след
ботов — nginx access-лог на VPS ( ротация daily × 15 дней), который никто не анализирует.

## Рассмотренные варианты

### Вариант А: Server-side трекинг в Next.js (middleware / root layout) — 5/10
- **Плюсы:** данные в том же рантайме, realtime.
- **Минусы:** middleware — edge-runtime (Prisma недоступен); root layout не выполняется
  для закэшированных страниц (full route cache); **не покрывает** `/robots.txt`,
  `/sitemap.xml`, статику `/_next/static` — а именно их чаще всего запрашивают боты;
  изменение кода приложения ради мониторинга.

### Вариант Б: Loki + promtail (стек логов в Grafana) — 6/10
- **Плюсы:** стандартное решение для логов, мощные запросы LogQL.
- **Минусы:** два новых контейнера на VPS (память/диск), новый источник данных,
  ретро-импорт архивов сложнее, избыточно при готовом контуре Grafana+Postgres (ADR-001).

### Вариант В: nginx access-лог → python-шиппер (cron) → PostgreSQL → Grafana — 9/10 ✅
- **Плюсы:** нулевые изменения кода приложения; 100% покрытие HTTP-запросов
  (включая robots.txt, sitemap, 404 от сканеров); python3.12 уже есть на VPS;
  используется существующий контур Grafana+Postgres (ADR-001); идемпотентный
  ретро-импорт всех 15 дней истории; дедуп по детерминированному id.
- **Минусы:** задержка до 5 мин (cron) — некритично для SEO-аналитики;
  отдельный state-файл шиппера.

## Решение (Вариант В)

### 1. Источник данных

Nginx уже пишет `evakuaciya-online.access.log` в combined-формате (есть User-Agent,
IP, путь, статус). Формат не меняем — парсим существующий.

### 2. Шиппер `deploy/bots-shipper/nginx_bots_shipper.py`

- Инкрементальный: state-файл (inode + offset), читает только новые строки
  текущего лога → cron каждые 5 мин.
- Режим `--retro`: разовый импорт ротированных `.gz` архивов (15 дней истории).
- Классификация UA: реестр известных ботов (YandexBot, YandexMetrika, YandexImages,
  YandexVideo, YandexWebmaster, YandexDirect, YandexRCA, YandexSitelinks,
  YandexAccessibility, YandexAdvertising, Googlebot, Googlebot-Image, Googlebot-News,
  Googlebot-Video, Google-InspectionTool, AdsBot-Google, bingbot, GPTBot,
  OAI-SearchBot, ChatGPT-User, ClaudeBot, Applebot, DuckDuckBot, AhrefsBot,
  SemrushBot, MJ12bot, DotBot, PetalBot, SeznamBot, Mail.RU_Bot, SputnikBot,
  FacebookBot, XingBot/LinkedInBot…) + **scripted-клиенты и сканеры →
  `vendor='scanner'`** (v1.1: axios, python-requests/-httpx, Go-http-client,
  curl, wget, zgrab, ExchangeScanner, masscan, nuclei, censys, okhttp и др.
  — их UA не содержит bot/crawler, но WAF отдаёт им 403, rate-limit 429)
  + generic-фолбэк (`bot|crawler|spider|slurp`).
  Не-боты — не импортируются (люди уже в `Visit`, ADR-014; нет дублей и лишних ПДн).
- Каждый бот получает `botName` (каноническое имя) и `vendor`
  (`yandex | google | bing | openai | scanner | other`); дашборд показывает
  человеко-читаемый «Тип» (CASE в SQL) и панель «Кто пытался войти»
  (status IN 400/403/429 — отвергнутые WAF/rate-limit запросы).
- **IP маскируется** теми же правилами, что в приложении (152-ФЗ, см.
  ЧТЗ_152ФЗ_маскирование_IP_и_политика.md): IPv4 → последний октет `0`,
  IPv6 → /64. Для статистики по ботам этого достаточно.
- Исключаемые пути: `/grafana`, `/metrics/*` (сам мониторинг и владелец, не боты).
- Запись: `docker exec -i tow-truck-db psql … COPY "BotVisit" FROM STDIN (CSV)` —
  без зависимостей на pip-пакеты хоста.
- Лог работы: `/var/log/nginx-bots-shipper.log` (свои ошибки не ломают nginx-логи).

### 3. Схема БД (Prisma-модель + миграция)

```prisma
model BotVisit {
  id        String   @id            // md5(ts|ip|method|path|ua) — детерминированный
  ts        DateTime @db.Timestamptz // время запроса из лога (не createdAt!)
  botName   String                  // каноническое имя: YandexBot, Googlebot…
  vendor    String                  // yandex | google | bing | openai | other
  ip        String?                 // маскированный IP (152-ФЗ)
  method    String?
  path      String                  // путь без query
  query     String?                 // query string (?yclid=… — полезен для Яндекса)
  status    Int?
  referer   String?
  userAgent String?
  createdAt DateTime @default(now())

  @@index([ts])
  @@index([botName, ts])
  @@index([vendor, ts])
  @@index([path, ts])
}
```

`id = md5(...)` даёт идемпотентность: повторный импорт (retro, сбой, ретрай)
не создаёт дублей (`ON CONFLICT DO NOTHING`).

### 4. Дашборд Grafana `grafana/dashboards/bots-monitoring.json`

Datasource — существующий `postgres-metrics` (ADR-001). Панели:
1. Stat-ряд: боты 24ч / Yandex 24ч / Google 24ч / **визиты людей 24ч** (из `Visit`).
2. Time series: **люди (Visit) vs боты (BotVisit)** по часам/дням — раздельно.
3. Time series: боты по вендорам (yandex / google / bing / other).
4. Bar chart: топ ботов по имени за период.
5. Таблица: топ страниц по ботам (бот × страница × счётчик).
6. Таблица «журнал»: последние визиты ботов — время, имя бота, страница,
   IP, статус (вот «чей бот и какие страницы посещал»).

### 5. Развёртывание на VPS

- Файлы едут через git (репо на VPS = /root/tow-truck), Grafana подхватывает
  дашборд автоматически (provisioning).
- Скрипт: `deploy/bots-shipper/setup-vps.sh` — копирует nothing, работает из
  репо; добавляет crontab `*/5 * * * *` + systemd-free лог; ретро-импорт
  выполняется вручную один раз при установке.
- Миграция БД — стандартно через `prisma migrate deploy` при деплое.

## Влияние на архитектуру

- **Приложение (Next.js): не меняется вообще.** Новых API/endpoints нет.
- БД: +1 таблица `BotVisit` (миграция `20261111…_bot_visit_monitoring`).
- Инфраструктура: +cron-задача на VPS, +скрипт, +дашборд Grafana.
- ПДн (152-ФЗ): IP ботов маскируются (как в Visit/ClickEvent); UA-строки ботов —
  не ПДн; query-строка логируется только для бот-запросов.
- Объём данных: ~50–200 бот-запросов/сутки → ~10–20 КБ/день, рост БД незначителен.

## Последствия

- Владелец видит в Grafana: люди vs боты раздельно, активность Yandex/Google
  по времени, страницы обхода — индикатор переиндексации SEO-страниц.
- Ретро-импорт даёт историю за доступные 15 дней сразу после установки.
- Дальше (не в этом ADR): можно добавить алерт «Яндекс не заходил >7 дней».
