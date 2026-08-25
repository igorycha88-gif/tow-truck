# ЧТЗ: Донастройка site-metrics эвакуация.online — эндпоинты node и postgres

> Версия: 1.0 · Дата: 2026-08-19
> Адресат: владелец/команда сайта **эвакуация.online** (VPS 178.57.218.204, Next.js + PostgreSQL)
> От: команда централизованного мониторинга (проект «Мониторинг сайтов»)
> Парный документ на стороне мониторинга: `monitoring/требования/ЧТЗ_Подключение_эвакуация_online.md` (v1.1)

## 1. Контекст

Централизованный мониторинг уже собирает метрики сайта по 4 направлениям (за заголовком `X-Monitoring-Key`, персайтный ключ — ADR-010):

| Kind | URL | Текущий статус (проверено 2026-08-19) |
|---|---|---|
| tracking | `https://эвакуация.online/metrics/tracking` | ✅ 200 OK |
| content | `https://эвакуация.online/metrics/content` | ✅ 200 OK |
| **node** | `https://эвакуация.online/metrics/node` | ❌ **404 — эндпоинт не существует** |
| **postgres** | `https://эвакуация.online/metrics/postgres` | ❌ **404 — эндпоинт не существует** |

Из-за 404 в мониторинге горит алерт `SiteMetricsEndpointDown` (kind=node, kind=postgres),
серверные метрики сайта (ЦП, память, диск, БД) не собираются.

## 2. Задача

Развернуть на сервере сайта экспортёры и проксировать их через nginx по образцу
da-dryclean.ru (ADR-007 D1 мониторинга): наружу ничего, кроме 443, не открывается.

### 2.1. node_exporter (kind=node)

1. Установить `node_exporter` (например, пакетом или бинарником).
2. Биндить **строго на `127.0.0.1:9100`** (systemd-юнит, `--web.listen-address=127.0.0.1:9100`).
3. Проверка: `curl -s http://127.0.0.1:9100/metrics | head` — текст Prometheus.

### 2.2. postgres_exporter (kind=postgres)

1. Развернуть `postgres_exporter` (docker или бинарник), порт **`127.0.0.1:9187`**.
2. Создать readonly-пользователя БД (права `pg_monitor`), DSN — в `.env` экспортёра.
3. Проверка: `curl -s http://127.0.0.1:9187/metrics | head` — метрики `pg_*`.

### 2.3. nginx — два новых location

В конфиг nginx сайта добавить (по аналогии с уже работающими `/metrics/tracking` и `/metrics/content`):

```nginx
location = /metrics/node {
    proxy_pass http://127.0.0.1:9100/metrics;
    # проверка X-Monitoring-Key — тот же механизм, что у tracking/content
}

location = /metrics/postgres {
    proxy_pass http://127.0.0.1:9187/metrics;
    # проверка X-Monitoring-Key — тот же механизм, что у tracking/content
}
```

Требования к защите (единые для всех /metrics/* сайта):
- Заголовок `X-Monitoring-Key`: неверный/отсутствующий → **403**.
- Только метод **GET**.
- Rate limit ≤ 10 r/s (мониторинг опрашивает ~1 раз в 60 с).
- Экспортёры 9100/9187 — только localhost; в файрволе порты НЕ открывать.

## 3. Формат ответа

`text/plain; version=0.0.4` (Prometheus exposition). Содержимое — стандартные
метрики node_exporter и postgres_exporter; кастомные метрики не требуются.

## 4. Критерии приёмки

С сервера мониторинга (или любого внешнего хоста):

```bash
KEY=<персайтный ключ эвакуация.online>

# 1. С ключом — 200 и метрики:
curl -s -o /dev/null -w '%{http_code}\n' -H "X-Monitoring-Key: $KEY" https://эвакуация.online/metrics/node      # 200
curl -s -o /dev/null -w '%{http_code}\n' -H "X-Monitoring-Key: $KEY" https://эвакуация.online/metrics/postgres  # 200

# 2. Пунши: punycode-хост тоже работает (canonical: эвакуация.online = xn--80aae0ai8cwa4cza.online):
curl -s -o /dev/null -w '%{http_code}\n' -H "X-Monitoring-Key: $KEY" https://xn--80aae0ai8cwa4cza.online/metrics/node  # 200

# 3. Без ключа / с неверным ключом — 403:
curl -s -o /dev/null -w '%{http_code}\n' https://эвакуация.online/metrics/node       # 403
curl -s -o /dev/null -w '%{http_code}\n' -H "X-Monitoring-Key: wrong" https://эвакуация.online/metrics/postgres  # 403
```

После деплоя на стороне сайта уведомить команду мониторинга: мы проверим
`monitoring_site_metrics_up{site="эвакуация.online",kind="node|postgres"} = 1`
и появление метрик `node_*` / `pg_*` в Grafana (дашборд «Обзор сайта»).

## 5. Что НЕ входит в это ЧТЗ

- **Вебмастер** (поисковые запросы): подключение отложено до готовности site-metrics
  (решение владельца, см. парное ЧТЗ v1.1 п.2). Потребуется верификация хоста
  эвакуация.online в Яндекс.Вебмастере — вернёмся отдельной задачей.
- Изменения на стороне мониторинга не требуются: конфигурация `metrics_urls`
  уже прописана, SD подхватит эндпоинты автоматически в течение 60 с после их появления.

## 6. Справка

- Домен (canonical): `эвакуация.online` (punycode: `xn--80aae0ai8cwa4cza.online`)
- TLS-сертификат сайта валиден (осталось ~80 дней) — проблем не создаёт.
- Ключ `X-Monitoring-Key` эвакуация.online уже передан команде мониторинга;
  хранить на сайте в `/etc/nginx/conf.d/monitoring-key.conf` (chmod 600) и/или `.env`,
  в код и коммиты не попадает.
