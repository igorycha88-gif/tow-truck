# ЧТЗ: Подготовка CI/CD и продакшн-деплой (ветка main)

## Контекст
Проект готов к прод-деплою (Dockerfile multi-stage, nginx+SSL, спецификация
`PIPELINE_PROD.js`). Но отсутствует CI/CD: нет GitHub Actions, нет прод-сборки
compose, `/api/health` не отдаёт версию, нет entrypoint с миграциями. Пользователь
просит подготовить CI/CD и выполнить деплой на прод с ветки `main`.

## Решение (маршрутизация)
Внедрить GitHub Actions (3 воркфлоу: CI, сборка+GHCR, деплой), прод-`docker-compose.yml`
(stateful сервисы), `docker-entrypoint.sh` с авто-миграциями, baseline Prisma-миграцию,
`version` в health, `CHANGELOG.md`. Исполняемый скрипт Blue-Green для VPS. Реальный
деплой пускается через GitHub Actions (workflow_dispatch) — не требует хранения
VPS-ключей в репо.

**Маршрут:** Аналитик → Архитектор → Аналитик → Разработчик → Тестировщик → DevOps (Маршрут 2).
**Архитектор:** выполнен (см. раздел «Архитектурные решения» выше/в ADR).

## Критерии приёмки
1. `.github/workflows/ci.yml` запускается на push (main/dev) и PR → lint+tsc+vitest+build; падает при ошибках.
2. `.github/workflows/docker-publish.yml` на push в main / теги `v*` собирает образ и пушит в GHCR с тегами `sha-<short>`, `latest`, `<semver>`.
3. `.github/workflows/deploy.yml` (workflow_dispatch) по SSH выполняет Blue-Green на VPS (pull→green→healthcheck→nginx→blue stop→prod→cleanup) с авто-откатом.
4. `docker-compose.yml` (prod) описывает postgres+redis с healthcheck и volumes (app управляется скриптом Blue-Green).
5. `deploy/docker-entrypoint.sh` запускает `prisma migrate deploy`, затем `next start`; исполняемый бит; создаётся в образе.
6. `prisma/migrations/<ts>_init/migration.sql` — baseline-миграция (сгенерирована через `migrate diff`), `migrate deploy` проходит.
7. `/api/health` отдаёт поле `version` (= версия package.json); есть автотест.
8. `CHANGELOG.md` создан, начинается с v0.1.0.
9. Документация: `deploy/README.md` (или раздел) описывает требуемые GitHub-secrets и порядок первого деплоя.
10. `npm run test && npm run lint && npx tsc --noEmit` — зелёные.
11. Логирование сохранено/добавлено во все затронутые файлы (entrypoint, health).

## Список файлов (создать)
- `.github/workflows/ci.yml`
- `.github/workflows/docker-publish.yml`
- `.github/workflows/deploy.yml`
- `docker-compose.yml` (prod)
- `deploy/docker-entrypoint.sh`
- `deploy/blue-green-deploy.sh`
- `prisma/migrations/<timestamp>_init/migration.sql`
- `CHANGELOG.md`
- `deploy/README.md` (обновить: секреты + порядок деплоя)

## Список файлов (изменить)
- `src/app/api/health/route.ts` — добавить `version`
- `src/app/api/health/route.test.ts` — тест на `version`
- `Dockerfile` — копировать `docker-entrypoint.sh` в runner, сделать entrypoint
- `package.json` — version bump по semver на этапе Versioning

## Декомпозиция
- TASK-INF-001: GitHub Actions — `ci.yml`
- TASK-INF-002: GitHub Actions — `docker-publish.yml` (GHCR)
- TASK-INF-003: GitHub Actions — `deploy.yml` (Blue-Green по SSH)
- TASK-INF-004: `docker-compose.yml` (prod stateful) + `docker-entrypoint.sh` + правка `Dockerfile`
- TASK-INF-005: baseline Prisma-миграция (`migrate diff`)
- TASK-BCK-001: `version` в `/api/health` + автотест
- TASK-INF-006: `CHANGELOG.md` + `deploy/README.md` (секреты/порядок)
- TASK-TST-001: ревью и прогоны проверок

## Вне скоупа
- Настройка самих GitHub-secrets (VPS_HOST, VPS_USER, VPS_SSH_KEY) — делает пользователь (я не храню приватные ключи).
- Первый бутстрап VPS (установка Docker/nginx/Postgres/Redis, выпуск SSL) — описан в `deploy/nginx/README.md`, делается вручную на сервере.
- Восстановление/миграция данных существующей прод-БД — только через бэкап (Правило защиты данных).

## Что нужно от пользователя для РЕАЛЬНОГО деплоя (будет озвучено на этапе DevOps)
1. Доступный VPS (IP) с установленными Docker, nginx, контейнерами postgres+redis.
2. GitHub repo secrets: `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY` (приватный ключ), опционально `TELEGRAM_*`.
3. `.env` на VPS (DATABASE_URL, REDIS_URL, TELEGRAM_*, YANDEX_MAPS_API_KEY, NEXT_PUBLIC_*).
4. DNS `эвакуация.online` → VPS_IP (для SSL).
