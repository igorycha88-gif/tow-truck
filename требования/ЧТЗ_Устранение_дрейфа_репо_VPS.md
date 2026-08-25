# ЧТЗ: Устранение дрейфа репозиторий ↔ VPS (nginx / postgres-exporter)

> Версия: 1.0 · Дата: 2026-08-21
> Предыдущий документ: `ЧТЗ_Site-metrics_node_postgres.md` (реализован 2026-08-21)
> Маршрут: Аналитик → Разработчик → Тестировщик → DevOps (Маршрут 1)

## 1. Контекст

После деплоя site-metrics (node/postgres) выявлен **предсуществующий дрейф** между
конфигами/скриптами репозитория и реальным состоянием prod-VPS `178.57.218.204`.
Файлы репо «как задумано», но их прямое применение на VPS **ломает сайт** (SSL-пути,
синтаксис http2) либо **не работает** (postgres-exporter через compose). Часть дрейфа
была обходится хирургическими правками «на месте» — это и есть технический долг.

Цель: репозиторий становится **источником истины**, воспроизводимым на текущем VPS
без ручных заплаток.

## 2. Зафиксированные расхождения (факты VPS на 2026-08-21)

| № | Файл репо | Расхождение с VPS | Последствие прямого `cp` |
|---|---|---|---|
| Д1 | `deploy/nginx/evakuaciya-online.conf` | SSL-пути `live/эвакуация.online/` (UTF-8) | VPS cert в `live/xn--80aae0ai8cwa4cza.online/` (punycode) → `nginx -t` FAIL |
| Д2 | он же | `listen 443 ssl;` + `http2 on;` (×2 server) | nginx 1.24.0 не поддерживает `http2 on;` (нужен ≥1.25.1) → `nginx -t` FAIL |
| Д3 | он же, комментарий строка 4 | punycode `xn--80akhbyknj4f.online` | Неверно, реальный `xn--80aae0ai8cwa4cza.online` — дезинформация |
| Д4 | `docker-compose.yml` (сервис `postgres-exporter`) | `depends_on: postgres` + `ports` + default bridge | `tow-truck-db` запущен вне compose (labels пустые), DNS `postgres` не резолвится → сервис не стартует |
| Д5 | `deploy/postgres-exporter/setup-user.sh` (строка 23) | DSN-хост `postgres` | Экспортёр на `--network host` не резолвит `postgres`, нужен `127.0.0.1` |
| Д6 | `deploy/monitoring/README.md` §4.3 | `docker compose --profile monitoring up -d` + DSN-хост `postgres` | Команда не поднимает экспортёр (Д4); DSN-хост неверен (Д5) |
| Д7 | `deploy/nginx/setup-ssl.sh` (строки 78–79) | Печатает `live/${DOMAIN}/` (UTF-8) | Реальный путь punycode — лог вводит в заблуждение |

**Не-дрейф (не трогать):**
- `evakuaciya-upstream.conf` — Blue-Green state (3001/3003), legitimately меняется при деплое.
- `evakuaciya-map.conf` — функциональных отличий нет (только комментарии и `""`↔`''`, эквивалентно в nginx).

**Д3-бис (выявлено при тестировании на VPS 2026-08-21):** `server_name эвакуация.online`
(UFT-8) — предполагалось, что nginx нормализует IDN. Проверка показала: **nginx 1.24 на VPS
НЕ нормализует IDN в `server_name`** → punycode Host-заголовок не матчит apex-блок → все
 эндпоинты возвращали 301 (fallback на default :443 www-блок). Решение: `server_name` →
punycode во всех 3 server-блоках. Redirect-цели (`return 301 https://эвакуация.online…`)
оставлены UTF-8 (клиент нормализует, функционально корректно).

## 3. Решение направления

**Привести репозиторий к работающей реальности текущего VPS** (низкий риск, без
миграции данных и без апгрейда системных пакетов). VPS остаётся как есть; репо
становится воспроизводимым.

**Вне рамок ЧТЗ** (отдельные задачи, помечены в CHANGELOG как future):
- T-FUT-1: миграция stateful-сервисов (postgres/redis/grafana) под `docker compose` (риск данных, отдельный ADR).
- T-FUT-2: апгрейд nginx до ≥1.25.1 (системный пакет, отдельное окно).
- T-FUT-3: после T-FUT-2 — возврат синтаксиса `http2 on;`.

## 4. Задачи (декомпозиция)

### TASK-DRF-001 — nginx `evakuaciya-online.conf` (Д1, Д2, Д3, Д3-бис)
1. Заменить все 4 вхождения `/etc/letsencrypt/live/эвакуация.online/` → `/etc/letsencrypt/live/xn--80aae0ai8cwa4cza.online/`.
2. В обоих HTTPS server-блоках заменить:
   ```nginx
   listen 443 ssl;
   http2 on;
   listen [::]:443 ssl;
   http2 on;
   ```
   на совместимый с nginx 1.24 синтаксис:
   ```nginx
   listen 443 ssl http2;
   listen [::]:443 ssl http2;
   ```
3. Исправить punycode в комментарии шапки: `xn--80akhbyknj4f.online` → `xn--80aae0ai8cwa4cza.online`.
4. **`server_name` во всех 3 server-блоках → punycode** (`xn--80aae0ai8cwa4cza.online` / `www.xn--…`).
   nginx 1.24 на VPS не нормализует IDN (см. Д3-бис). Комментарий-пояснение обновлён.
5. Location'ы `/metrics/node` и `/metrics/postgres` уже присутствовали — не трогать.
6. Redirect-цели `return 301 https://эвакуация.online…` оставить UTF-8 (клиент нормализует).

### TASK-DRF-002 — `docker-compose.yml` сервис `postgres-exporter` (Д4)
Привести сервис в соответствие с реальным режимом запуска (`--network host`, внешний postgres):
1. Добавить `network_mode: host`.
2. Удалить блок `ports:` (на host-сети игнорируется/конфликтует; бинд задаётся аргументом `--web.listen-address=127.0.0.1:9187`).
3. Удалить `depends_on: postgres` (postgres внешний, не compose-сервис).
4. В `command` (или `args`) зафиксировать `--web.listen-address=127.0.0.1:9187` (чтобы контейнер не открывал 9187 на 0.0.0.0).
5. Комментарий: пояснить, что postgres на VPS запущен вне compose, DSN-хост `127.0.0.1`.

### TASK-DRF-003 — `deploy/postgres-exporter/setup-user.sh` (Д5)
Строка 23: хост в печатаемом DSN `@postgres:` → `@127.0.0.1:`.

### TASK-DRF-004 — `deploy/monitoring/README.md` (Д6)
1. §4.2: DSN-пример `@postgres:` → `@127.0.0.1:`.
2. §4.3: заменить `docker compose --profile monitoring up -d` на реально работающую команду:
   ```bash
   docker run -d --name tow-truck-postgres-exporter --network host --restart unless-stopped \
     -e DATA_SOURCE_NAME="${POSTGRES_EXPORTER_DSN}" \
     prometheuscommunity/postgres-exporter:v0.15.0 \
     --web.listen-address=127.0.0.1:9187
   ```
3. Добавить примечание: postgres на VPS запущен через `docker run` (вне compose),
   поэтому compose-сервис неприменим; экспортёр запускается на host-сети.

### TASK-DRF-005 — `deploy/nginx/setup-ssl.sh` (Д7)
Строки 78–79: печатаемые пути `live/${DOMAIN}/` → `live/xn--80aae0ai8cwa4cza.online/`
(certbot создаёт punycode-директорию). Комментарий-пояснение.

## 5. Критерии приёмки

### 5.1 Репозиторий (этап Разработчик/Тестировщик)
- AC-1: `npm run lint && npx tsc --noEmit && npm run test` — зелёные (репо-файлы не ломают TS/тесты).
- AC-2: `docker compose -f docker-compose.yml config -q` — валидный compose (сервис `postgres-exporter` с `network_mode: host`).
- AC-3: `grep -rn 'эвакуация.online/' deploy/nginx/` (в ssl_certificate-путях) — нет ни одного вхождения; везде punycode.
- AC-4: `grep -rn 'http2 on;' deploy/nginx/evakuaciya-online.conf` — 0 вхождений; используется `listen 443 ssl http2`.
- AC-5: `grep -rn 'xn--80akhbyknj4f' deploy/` — 0 (неверный punycode удалён).
- AC-6: `grep -n '@postgres:' deploy/postgres-exporter/setup-user.sh deploy/monitoring/README.md` — 0; везде `@127.0.0.1:`.

### 5.2 VPS (этап DevOps) — воспроизводимость
- AC-7: После применения исправленного `evakuaciya-online.conf` (полная замена файла из репо): `nginx -t` OK, `systemctl reload nginx` OK.
- AC-8: Регрессия не нарушена: `https://эвакуация.online/` 200, `/api/health` 200, `/grafana/` 302, `/metrics/tracking` (с ключом) 200.
- AC-9: Приёмка site-metrics сохраняется: `/metrics/node` и `/metrics/postgres` (с ключом) 200, без ключа 403.
- AC-10: Файл на VPS `/etc/nginx/conf.d/evakuaciya-online.conf` идентичен репо-версии (`diff` пуст) — дрейф Д1/Д2/Д3 устранён.

## 6. Безопасность / риски

- Все изменения — конфиги/скрипты/документация; код приложения, БД-схема, ключи не затрагиваются.
- DevOps применяет nginx-конфиг через backup → `nginx -t` → reload → проверка; при провале `nginx -t` — откат из backup без reload.
- Пароль `postgres_exporter` и `MONITORING_KEY` в git не попадают (проверить `grep`).
- Файрвол: 9100/9187 остаются только на `127.0.0.1` (port-publishing удалён из compose).

## 7. Файлы для изменения

| Файл | Задача |
|---|---|
| `deploy/nginx/evakuaciya-online.conf` | TASK-DRF-001 |
| `docker-compose.yml` | TASK-DRF-002 |
| `deploy/postgres-exporter/setup-user.sh` | TASK-DRF-003 |
| `deploy/monitoring/README.md` | TASK-DRF-004 |
| `deploy/nginx/setup-ssl.sh` | TASK-DRF-005 |

## 8. Маршрутизация

- Исполнитель: Разработчик (правка репо-файлов) → Тестировщик (AC-1…AC-6) → DevOps (AC-7…AC-10, пере-применение на VPS).
- Архитектор: не привлекается (нет новых сущностей/API/интеграций, < архитектурного порога).
