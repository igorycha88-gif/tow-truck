# ЧТЗ: Nginx-защита от ботов и сканеров (rate-limit + блок UA + закрытие Grafana)

**Дата:** 2026-09-08
**Маршрутизация:** Маршрут 3 (инфраструктурная) → исполнитель: **DevOps**
**Основание:** анализ логов прода за 08/Sep/2026 — 68% трафика боты (python-httpx 871 req, сканер уязвимостей с GCP 688 req, axios 56 req), Grafana публично доступна без внешней авторизации.

## 1. Цель

Снизить мусорный трафик и закрыть поверхность атаки на nginx-уровне (прод VPS `178.57.218.204`), не затронув легитимных пользователей, SEO-ботов Яндекса и мониторинг.

## 2. Требования

### 2.1 Блок ботов по User-Agent
- Новый файл `/etc/nginx/conf.d/evakuaciya-protection.conf` (http-контекст):
  `map $http_user_agent $blocked_agent` → 1 для скриптовых/сканирующих UA:
  `python-httpx, python-requests, python-urllib, scrapy, go-http-client, java/, apache-httpclient, okhttp, axios/, node-fetch, undici, zgrab, nuclei, masscan, nikto, sqlmap, gobuster, dirbuster, fscan, httpx/, BuiltWith, ExchangeScanner, MJ12bot, SemrushBot, AhrefsBot, DotBot, PetalBot, Bytespider`.
- В apex server-блоке (443) и default_server (:80): `if ($blocked_agent = 1) { return 403; }`.
- **НЕ блокировать:** curl/wget (используются мониторингом и деплоем), пустой UA, ботов Яндекса/Grok/OAI (SEO).
- Внутренние IP (127.0.0.1, ::1, 178.57.218.204) не подпадают ни под блок, ни под лимиты (healthcheck/деплой-скрипты).

### 2.2 Rate-limit
- Зоны в `evakuaciya-protection.conf`:
  - `site_limit` 10 r/s (key = $binary_remote_addr, внутренние IP → пустой ключ = без лимита);
  - `api_limit` 5 r/s для `/api/`.
- `location /` → `limit_req zone=site_limit burst=20 nodelay;`
- Новый `location ^~ /api/` → `limit_req zone=api_limit burst=10 nodelay;` (те же proxy-заголовки, что в `location /`).
- `limit_req_status 429`.
- `/metrics/*` не трогать (уже защищены ключом + metrics_limit).

### 2.3 Закрытие Grafana
- `location /grafana/`: добавить `auth_basic` + `/etc/nginx/.htpasswd-grafana` (пользователь `admin`, сгенерированный пароль ≥ 20 симв., хранится в `/root/grafana-admin-password.txt`, chmod 600).
- Внутренний логин Grafana остаётся (двойной барьер).

### 2.4 Синхронизация репозитория
- Обновить `deploy/nginx/evakuaciya-online.conf` в репо (файл = финальное состояние прода), добавить `evakuaciya-protection.conf.example` (без секретов) + заметка в `deploy/nginx/README.md`.

## 3. Критерии приёмки

1. `python-httpx/0.28.1` → 403; браузерный UA → 200.
2. 40+ параллельных запросов за секунду с одного внешнего IP → часть 429; одиночные запросы не страдают.
3. `/grafana/` без пароля → 401; с паролем → 200.
4. `https://эвакуация.online/` → 200; `/api/health` → 200; `/?yclid=...` (YandexMetrika verifier UA) → 200.
5. `/metrics/node` без ключа → 403 (не сломано).
6. `nginx -t` OK; в error-логе нет ошибок после reload.

## 4. Риски и откат

- Риск: ложное срабатывание на легитимный трафик → mit: белый список внутренних IP, консервативный blocklist.
- Откат: бэкап конфигов до изменения (`/root/tow-truck/backups/nginx-*`), восстановление + `nginx -s reload`.
- Контейнеры НЕ пересобираются и НЕ перезапускаются (изменения только на уровне nginx хоста; даунтайм = 0).

## 5. Декомпозиция

- TASK-INF-001: бэкап nginx-конфигов на VPS.
- TASK-INF-002: protection.conf (map UA, geo внутренние, зоны лимитов) + правки evakuaciya-online.conf + default_server.
- TASK-INF-003: htpasswd для Grafana.
- TASK-INF-004: nginx -t, reload, полная верификация по критериям приёмки.
- TASK-INF-005: синхронизация репо (конфиг + README).
