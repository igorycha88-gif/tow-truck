# Changelog

Все заметные изменения проекта «Эвакуация (Москва и МО)».

Формат основан на [Keep a Changelog](https://keepachangelog.com/ru/1.1.0/),
версионирование — [Semantic Versioning](https://semver.org/lang/ru/).

## [Unreleased]

## [0.2.0] — 2026-07-26

### Добавлено
- **CI/CD на GitHub Actions**: воркфлоу `ci` (lint + typecheck + vitest + build), `docker-publish` (сборка prod-образа и пуш в GHCR), `deploy` (Blue-Green деплой на VPS по SSH).
- **Продакшн-`docker-compose.yml`**: stateful-сервисы PostgreSQL + Redis (порты только на 127.0.0.1, healthcheck, volumes, лог-ротация).
- **`deploy/docker-entrypoint.sh`**: авто-применение Prisma-миграций (`migrate deploy`) перед стартом Next.js.
- **`deploy/blue-green-deploy.sh`**: безопасный Blue-Green деплой с бэкапом БД, healthcheck, авто-откатом.
- **Baseline Prisma-миграция** `20260726205000_init` — схема `Order`.
- Поле `version` в `/api/health` (для сверки версии на проде, PIPELINE_PROD → FT1).
- `src/lib/version.ts` — единый источник версии приложения.

### Изменено
- `Dockerfile`: production-стадия `runner` использует `docker-entrypoint.sh` (миграции + `next start`).

## [0.1.0] — 2026-07-26

### Добавлено
- MVP главной страницы услуг эвакуации (Hero, услуги, калькулятор, зона, цены, отзывы, форма заявки).
- Форма заявки с валидацией телефона (RU, 152-ФЗ согласие) + уведомления в Telegram.
- Кэш/rate-limit на Redis, фолбэк при недоступности.
- Nginx + SSL (Let's Encrypt) для домена `эвакуация.online` (HTTP→HTTPS, www→apex, security headers).
- Конвейер AI-команды (PIPELINE.js / PIPELINE_PROD.js), техстек, архитектура.
