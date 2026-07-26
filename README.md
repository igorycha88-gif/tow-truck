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

## 🚀 Быстрый старт

### Вариант A: Docker (рекомендуется — поднимает app + PostgreSQL + Redis)

```bash
cp .env.example .env
docker compose -f docker-compose.dev.yml up -d --build
# http://localhost:3000  (health: /api/health)
```

### Вариант B: Локально (нужны запущенные PostgreSQL и Redis)

```bash
npm install
cp .env.example .env           # заполнить DATABASE_URL, REDIS_URL
npx prisma generate
npx prisma db push             # создать схему (без миграций для dev)
npm run db:seed                # тестовые данные
npm run dev                    # http://localhost:3000
```

> Без БД/Redis приложение запускается: форма и health работают в режиме
> graceful fallback (заявки логируются, но не сохраняются; rate-limit отключён).

### Команды качества

```bash
npm run lint            # ESLint
npm run typecheck       # TypeScript (tsc --noEmit)
npm run test            # Vitest (unit/integration)
npm run test:coverage   # Vitest + покрытие
npm run test:e2e        # Playwright (нужен запущенный dev/build-сервер)
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
