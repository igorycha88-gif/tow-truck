# 🚛 Сайт услуг эвакуации — Москва и Московская область

Production-ready сайт для предоставления услуг эвакуатора в Москве и МО.
Сайт-сервис с фокусом на скорость, мобильный опыт, локальное SEO и максимизацию
лидов (звонки + заявки → Telegram оператору).

> 📋 Вся разработка ведётся **через конвейер AI-команды**.
> Перед началом работы **обязательно** прочитайте [`AGENTS.md`](./AGENTS.md).

---

## 🧭 Документация конвейера

| Документ | Назначение |
|----------|------------|
| [`AGENTS.md`](./AGENTS.md) | Правила работы opencode (читается автоматически) |
| [`PIPELINE.js`](./PIPELINE.js) | Спецификация dev-конвейера (Аналитик → Разработчик → Тестировщик → DevOps) |
| [`PIPELINE_PROD.js`](./PIPELINE_PROD.js) | Спецификация prod-деплоя (Blue-Green, версионирование, откаты) |
| [`SKILL_ARCHITECT.md`](./SKILL_ARCHITECT.md) | Скилл Архитектора |
| [`SKILL_ANALYST.md`](./SKILL_ANALYST.md) | Скилл Аналитика (ЧТЗ, маршрутизация) |
| [`SKILL_DEVELOPER.md`](./SKILL_DEVELOPER.md) | Скилл Разработчика (Next.js 15 + Vitest) |
| [`SKILL_TESTER.md`](./SKILL_TESTER.md) | Скилл Тестировщика |
| [`SKILL_DEVOPS.md`](./SKILL_DEVOPS.md) | Скилл DevOps (dev-деплой) |
| [`SKILL_DEVOPS_PROD.md`](./SKILL_DEVOPS_PROD.md) | Скилл DevOps (prod-деплой Blue-Green) |
| [`TECH_STACK.md`](./TECH_STACK.md) | Обоснование техстека и лучшие практики |
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) | Описание архитектуры проекта |

---

## ⚙️ Технический стек

- **Frontend:** Next.js 15 (App Router) · React 19 · TypeScript 5.5 · Tailwind CSS 3.4 · shadcn/ui
- **Backend:** Next.js Route Handlers · Prisma 5 · PostgreSQL 16 · Redis 7
- **Интеграции:** Yandex Maps · Yandex.Метрика · Telegram Bot (Telegraf)
- **Тестирование:** Vitest (unit) · Playwright (E2E)
- **Инфраструктура:** Docker · Docker Compose · Nginx · GitHub Actions · VPS (Blue-Green)

Подробнее: [`TECH_STACK.md`](./TECH_STACK.md)

---

## 🚀 Быстрый старт (после инициализации проекта)

```bash
# Установка зависимостей
npm install

# Копирование env-шаблона
cp .env.example .env

# БД (Prisma)
npx prisma generate
npx prisma migrate dev
npm run db:seed

# Запуск dev-сервера
npm run dev          # http://localhost:3000

# Docker (опционально, полная среда)
docker compose -f docker-compose.dev.yml up -d --build
```

### Команды качества

```bash
npm run lint            # ESLint
npx tsc --noEmit        # Проверка типов
npm run test            # Vitest
npm run test:e2e        # Playwright
npm run build           # Production-сборка
```

---

## 🌿 Git-флоу

| Ветка | Назначение |
|-------|------------|
| `main` | Production-ready код. Деплой на прод — по команде «деплой на прод». |
| `dev` | Активная разработка. CI собирает и тестирует. |

- Функциональные ветки: `feature/*`, `fix/*` — от `dev`, PR в `dev`.
- Релиз: PR `dev` → `main`, semver-тег `vX.Y.Z`, CHANGELOG.md.

---

## 📞 Контакты проекта

- Репозиторий: https://github.com/igorycha88-gif/tow-truck
- Ответственный: igor (igorycha.s@yandex.ru)
