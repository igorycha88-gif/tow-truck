# ЧТЗ: Nginx + SSL для прода (домен эвакуация.online)

## Версия: 1.0
## Дата: 2026-07-26
## Автор: AI-Аналитик
## Приоритет: High
## Статус: Согласовано

---

## 1. Цели и задачи

### 1.1 Бизнес-цель
Настроить production reverse-proxy (Nginx) и HTTPS (Let's Encrypt) для сайта
по кириллическому домену **`эвакуация.online`** (Punycode: `xn--80akhbyknj4f.online`).

### 1.2 Пользовательская ценность
- Сайт доступен по `https://эвакуация.online` с валидным TLS-сертификатом (доверие + SEO).
- `http://` и `www.` → 301-редирект на канонический `https://эвакуация.online`.
- Nginx проксирует запросы на Blue-Green upstream (127.0.0.1:3001 prod / 3003 green),
  сохраняя существующую стратегию деплоя из `SKILL_DEVOPS_PROD.md`.

---

## 2. Функциональные требования

### 2.1 User Stories + Acceptance Criteria

**US-1. HTTPS на apex-домене**
- *Given* браузер открывает `https://эвакуация.online`
- *Then* возвращается валидный сертификат Let's Encrypt, сайт отдаётся через `proxy_pass` на upstream `app`.

**US-2. HTTP → HTTPS редирект**
- *Given* запрос `http://эвакуация.online/` (или любой путь)
- *Then* `301` redirect на `https://эвакуация.online/` (тот же путь).

**US-3. www → apex редирект**
- *Given* запрос `https://www.эвакуация.online/...`
- *Then* `301` redirect на `https://эвакуация.online/...`.

**US-4. Healthcheck проходит через nginx**
- *Given* `curl https://эвакуация.online/api/health`
- *Then* `200` + JSON со `status` (прокси пробрасывает upstream без таймаута).

**US-5. Blue-Green переключение не ломается**
- *Given* DevOps меняет upstream-конфиг (`deploy/nginx/evakuaciya-upstream.conf`) на `127.0.0.1:3003`
- *When* `nginx -s reload`
- *Then* трафик идёт на GREEN без изменения серверного блока домена.

### 2.2 Границы (вне объёма)
- **НЕ** выполняем настройку на самом VPS из этой сессии (нет SSH-доступа): поставляем
  файлы + инструкцию применения.
- **НЕ** меняем `Dockerfile`, Blue-Green логику, порты (3001/3003 остаются).
- **НЕ** настраиваем Cloudflare/CDN (прямое SSL от Let's Encrypt).

---

## 3. Технические решения

### 3.1 Домен — IDN (кириллица)
- Канонический (отображаемый): `эвакуация.online`
- Punycode (для SSL/certbot при необходимости): `xn--80akhbyknj4f.online`
- nginx (>= 1.11.5) принимает UTF-8 в `server_name`; в конфиге указываем **обе** формы
  (`эвакуация.online www.эвакуация.online`) — nginx сам нормализует.
- Сертификат Let's Encrypt выпускается на UTF-8 форму (SAN включает Punycode).

### 3.2 Структура файлов в репо (`deploy/nginx/`)
```
deploy/nginx/
├── README.md                       — инструкция применения на VPS
├── evakuaciya-upstream.conf        — upstream { server 127.0.0.1:3001; keepalive 32; }
├── evakuaciya-online.conf          — server-блоки (http→https, www→apex, ssl proxy)
├── setup-ssl.sh                    — certbot: выпуск/возобновление сертификата
└── nginx.conf.snippet              — общие настройки (gzip, security headers, proxy)
```

### 3.3 Server-блок (ключевое)
- **:80** → `return 301 https://эвакуация.online$request_uri;` (с интеракцией для ACME
  challenge, если используется standalone/webroot). Используем метод `--nginx` certbot —
  он сам правит server-блоки, поэтому в шаблоне SSL-сертификаты подключаются опционально
  (include `/etc/letsencrypt/options-ssl-nginx.conf` после выпуска).
- **:443 apex** → `proxy_pass http://app;` + заголовки (`Host`, `X-Real-IP`,
  `X-Forwarded-For`, `X-Forwarded-Proto`), `proxy_http_version 1.1`, `Upgrade`/`Connection`
  (для Next.js HMR/WS), `client_max_body_size 16m`, таймауты 60s.
- **:443 www** → `return 301 https://эвакуация.online$request_uri;`.
- Security headers: `Strict-Transport-Security`, `X-Content-Type-Options`,
  `X-Frame-Options SAMEORIGIN`, `Referrer-Policy`.
- gzip: `text/plain text/css application/json application/javascript text/xml ...`.

### 3.4 SSL через certbot (Let's Encrypt)
- `setup-ssl.sh` — использует `certbot --nginx -d эвакуация.online -d www.эвакуация.online`
  с `--redirect` (авто-редирект http→https), `--agree-tos`, `--no-eff-email`, `-m <email>`.
- Перед выпуском: nginx уже должен слушать :80 с базовым server-блоком (для ACME challenge).
- Возобновление: системный `certbot renew` + `systemctl reload nginx` (в systemd timer).

### 3.5 Локальные конфиги репо
- `src/config/company.ts:23` → `domain: 'эвакуация.online'` (вместо `example.ru`).
- `.env.example` → `NEXT_PUBLIC_SITE_URL` (добавить комментарий про прод-URL `https://эвакуация.online`).
- `SKILL_DEVOPS_PROD.md` → `DOMAIN = эвакуация.online`.
- `PIPELINE_PROD.js` → `DOMAIN = эвакуация.online`.

---

## 4. Декомпозиция задач

- **TASK-INF-001**: Создать `deploy/nginx/` структуру файлов (upstream, server-блок, snippet, README).
- **TASK-INF-002**: Создать `deploy/nginx/setup-ssl.sh` (certbot выпуск + авто-редирект).
- **TASK-INF-003**: Обновить локальные конфиги домена (`company.ts`, `.env.example`,
  `SKILL_DEVOPS_PROD.md`, `PIPELINE_PROD.js`).
- **TASK-INF-004**: Инструкция применения в `deploy/nginx/README.md` (DNS A-запись, установка
  nginx+certbot на VPS, шаги развёртывания конфигов, выпуск SSL, проверка).

---

## 5. Критерии приёмки

1. В репо создана папка `deploy/nginx/` с upstream-конфигом, server-блоком, snippet,
   `setup-ssl.sh` и `README.md`.
2. `company.domain === 'эвакуация.online'` (покрытие: тест `config.test.ts` продолжает
   проходить, либо добавлен assert на домен).
3. `.env.example`, `SKILL_DEVOPS_PROD.md`, `PIPELINE_PROD.js` содержат `эвакуация.online`.
4. Server-блок реализует: http→https 301, www→apex 301, proxy_pass на upstream `app`,
   security headers, gzip.
5. `setup-ssl.sh` выпускает сертификат для apex + www с авто-редиректом.
6. `npm run test && npm run lint && npx tsc --noEmit` проходят (изменение `company.ts`
   не ломает типы/тесты).
7. Логирование: задача инфраструктурная, новые API/services не добавляются; nginx-логи
   описаны в README (`access_log`/`error_log`).

---

## Маршрутизация

**Архитектор:** НЕ ТРЕБУЕТСЯ (новая сущность БД/API не добавляется; nginx-паттерны
стандартные, Blue-Green upstream уже заложен в `SKILL_DEVOPS_PROD.md`).

**Маршрут:** Маршрут 3 (инфраструктурная задача): **АНАЛИТИК → DEVOPS** (прямая задача).
