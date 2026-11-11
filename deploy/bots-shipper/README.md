# Мониторинг ботов (ADR-016): nginx → BotVisit → Grafana

Раздельный учёт посещений сайта **людьми** (`Visit`, клиентский JS) и **поисковыми
ботами** (`BotVisit`, из nginx access-лога). Дашборд Grafana: **«Боты и люди»**
(`grafana/dashboards/bots-monitoring.json`).

## Компоненты

| Файл | Назначение |
|------|-----------|
| `nginx_bots_shipper.py` | Шиппер: парсит nginx-лог, классифицирует UA (реестр + generic), маскирует IP (152-ФЗ), пишет в `BotVisit` через `docker exec psql` (stdin, идемпотентно по md5-id) |
| `test_nginx_bots_shipper.py` | Юнит-тесты (python unittest): парсер, классификатор, маскирование, дедуп, SQL |
| `setup-vps.sh` | Установка на VPS: проверки + cron `*/5` + ретро-импорт 15 дней |

## Поток данных

```
nginx access.log (combined, 15 дней истории)
   │  python3 nginx_bots_shipper.py  (cron VPS, каждые 5 мин)
   ▼
PostgreSQL "BotVisit"  ◀── люди отдельно: "Visit" (ADR-014, /api/visit)
   │
   ▼
Grafana «Боты и люди» (datasource postgres-metrics)
```

- Инкрементальность: state-файл `/var/lib/nginx-bots-shipper/state.json`
  (inode + offset); на границе logrotate хвост `.log.1` дочитывается целиком —
  дубли невозможны (id = md5 полей строки, `ON CONFLICT DO NOTHING`).
- Люди в `BotVisit` НЕ пишутся (нет дублей и лишних ПДн); пути `/grafana`, `/metrics` исключены.
- IP маскируется как в приложении: IPv4 → /24, IPv6 → /64.

## Установка на VPS (после деплоя с миграцией)

```bash
ssh root@178.57.218.204
cd /root/tow-truck && git pull
bash deploy/bots-shipper/setup-vps.sh
```

Скрипт идемпотентен: повторный запуск не создаст дублей cron/данных.

## Тесты

```bash
python3 deploy/bots-shipper/test_nginx_bots_shipper.py
```

## Диагностика на VPS

```bash
tail -50 /var/log/nginx-bots-shipper.log          # лог шиппера
crontab -l | grep bots-shipper                    # cron на месте?
docker exec tow-truck-db psql -U postgres -d tow_truck \
  -c 'SELECT vendor, count(*) FROM "BotVisit" GROUP BY 1;'
python3 /root/tow-truck/deploy/bots-shipper/nginx_bots_shipper.py --retro  # ручной ретро
```

## Откат

1. `crontab -e` — удалить строку с маркером `# nginx-bots-shipper (ADR-016)`.
2. При необходимости: `DROP TABLE "BotVisit"` + удалить миграцию из репо.
