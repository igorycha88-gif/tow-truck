# Централизованный мониторинг — runbook DevOps

Реализация ЧТЗ `требования/ЧТЗ_Централизованный_мониторинг.md`
(эндпоинты метрик эвакуация.online для мониторинга VPS 130.49.129.241).

## Что уже в коде (после деплоя приложения)

| Эндпоинт | Что отдаёт | Реализация |
|---|---|---|
| `GET /metrics/tracking` | `business_*` (гейджи, кэш 60 с) | `src/app/metrics/tracking/route.ts` + `src/services/promMetricsService.ts` |
| `GET /metrics/content` | `content_http_requests_total`, `content_http_request_duration_seconds` | `src/app/metrics/content/route.ts` + `src/lib/metrics/http-metrics.ts` + `src/instrumentation.ts` |
| `GET /metrics/node` | `node_*` | node_exporter (systemd, 127.0.0.1:9100) |
| `GET /metrics/postgres` | `pg_*` | postgres_exporter (docker, 127.0.0.1:9187) |

До применения nginx-конфига `/metrics/*` отдают 404 — норма (ЧТЗ §2).

## Порядок настройки на VPS (root@эвакуация-VPS)

### 1. Ключ мониторинга (nginx)

```bash
cd /root/tow-truck   # PROJECT_DIR
cp deploy/nginx/monitoring-key.conf.example /etc/nginx/conf.d/monitoring-key.conf
vi /etc/nginx/conf.d/monitoring-key.conf   # вставить реальный ключ (64 hex)
chmod 600 /etc/nginx/conf.d/monitoring-key.conf
chown root:root /etc/nginx/conf.d/monitoring-key.conf
```

Тот же ключ положить в `.env` приложения (`MONITORING_KEY=...`) —
защита на уровне приложения (defense in depth), и перезапустить приложение.

### 2. nginx: server-блок + rate-limit

В `deploy/nginx/evakuaciya-online.conf` и `deploy/nginx/evakuaciya-map.conf`
конфиги уже обновлены (4 location `/metrics/*`, зона `metrics_limit` 10 r/s,
минимальный access_log без ключа). Синхронизировать на VPS:

```bash
cp deploy/nginx/evakuaciya-map.conf /etc/nginx/conf.d/evakuaciya-map.conf
cp deploy/nginx/evakuaciya-online.conf /etc/nginx/conf.d/evakuaciya-online.conf
nginx -t && systemctl reload nginx
```

Проверка регрессии: сайт 200, `/api/health` 200, `/grafana` работает.

### 3. node_exporter (TASK-INF-001)

```bash
bash deploy/node-exporter/setup.sh
ss -tlnp | grep 9100   # только 127.0.0.1:9100
```

### 4. postgres_exporter (TASK-INF-002)

```bash
# 4.1. readonly-пользователь (пароль придумать, в git не класть):
EXPORTER_PASSWORD='<пароль>' bash deploy/postgres-exporter/setup-user.sh

# 4.2. DSN в .env (рядом с docker-compose.yml):
#   POSTGRES_EXPORTER_DSN="postgresql://postgres_exporter:<пароль>@postgres:5432/tow_truck?sslmode=disable"
chmod 600 .env

# 4.3. запуск (профиль monitoring, stateful-сервисы не трогаем):
docker compose --profile monitoring up -d
ss -tlnp | grep 9187   # только 127.0.0.1:9187
```

### 5. Приложение

Обычный prod-деплой (Blue-Green, `PIPELINE_PROD.js`) — образ содержит
route handlers `/metrics/{tracking,content}` и instrumentation.

## Приёмка (ЧТЗ §8)

```bash
KEY='<реальный ключ>'

# 200 + метрики:
curl -s -H "X-Monitoring-Key: $KEY" https://эвакуация.online/metrics/tracking | grep -E 'business_(page_views_24h|leads_24h)'
curl -s -H "X-Monitoring-Key: $KEY" https://эвакуация.online/metrics/node     | head -3
curl -s -H "X-Monitoring-Key: $KEY" https://эвакуация.online/metrics/postgres | head -3
curl -s -H "X-Monitoring-Key: $KEY" https://эвакуация.online/metrics/content  | grep content_http_requests_total

# 403 без ключа / с неверным; 403/405 на POST:
curl -s -o /dev/null -w '%{http_code}\n' https://эвакуация.online/metrics/tracking
curl -s -o /dev/null -w '%{http_code}\n' -H "X-Monitoring-Key: wrong" https://эвакуация.online/metrics/node
curl -s -o /dev/null -w '%{http_code}\n' -X POST -H "X-Monitoring-Key: $KEY" https://эвакуация.online/metrics/tracking

# Порты закрыты снаружи:
ss -tlnp | grep -E '9100|9187'   # только 127.0.0.1

# Ключ не в git:
grep -r "$KEY" src/ deploy/ || echo OK
```

После подключения мониторингом (на стороне VPS мониторинга) проверить:
`monitoring_site_metrics_up{site="эвакуация.online",kind=..."} = 1`.

## Безопасность

- Ключ: только `/etc/nginx/conf.d/monitoring-key.conf` (600, root) и `.env`
  приложения (600). НЕ в git/коммитах/логах.
- Пароль root сервера мониторинга в репозитории не хранится (ЧТЗ §9).
- Новых открытых портов нет: всё через публичный 443.
