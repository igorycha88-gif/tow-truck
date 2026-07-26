# Деплой «Эвакуация» на прод (CI/CD + Blue-Green)

Полный конвейер: push в `main` → CI (качество) → docker-publish (образ в GHCR) →
deploy (Blue-Green на VPS). Формальная спецификация: `PIPELINE_PROD.js`.

## Воркфлоу GitHub Actions

| Воркфлоу | Файл | Триггер | Что делает |
|----------|------|---------|------------|
| **ci** | `.github/workflows/ci.yml` | push (main/dev), PR→main | lint + typecheck + vitest + build |
| **docker-publish** | `.github/workflows/docker-publish.yml` | push main, теги `v*` | собирает `runner`-образ, пушит в GHCR; затем (при `ENABLE_PROD_DEPLOY=true`) авто-деплой на VPS |
| **deploy** | `.github/workflows/deploy.yml` | workflow_dispatch (ручной) | Blue-Green деплой указанного тега образа на VPS по SSH |

**Маршрут:** `push main` → ci ✅ → docker-publish (образ `sha-<short>` + `latest`) →
deploy-джоба (только если `ENABLE_PROD_DEPLOY=true` и заданы VPS-secrets).

---

## Образ в GHCR

`ghcr.io/igorycha88-gif/tow-truck/app`

Теги: `sha-<short>`, `latest` (main), `v<semver>` (для тегов `v*`).

---

## 🔑 Необходимые GitHub-secrets и переменные

**Secrets** (Settings → Secrets and variables → Actions → Secrets):

| Secret | Назначение | Пример |
|--------|-----------|--------|
| `VPS_HOST` | IP/хост сервера | `185.100.100.100` |
| `VPS_USER` | SSH-пользователь | `root` |
| `VPS_SSH_KEY` | приватный SSH-ключ (cat ~/.ssh/id_ed25519) | `-----BEGIN OPENSSH...` |
| `VPS_PORT` *(опц.)* | SSH-порт | `22` |
| `VPS_PROJECT_DIR` *(опц.)* | путь к проекту на VPS | `/root/tow-truck` |

**Variables** (Settings → Secrets and variables → Actions → Variables):

| Variable | Назначение |
|----------|-----------|
| `ENABLE_PROD_DEPLOY` | `true` — включить авто-деплой на VPS после сборки образа на `main`. Пока не задана/не `true` — образ собирается, но на прод не выкатывается. |

> `docker-publish` использует встроенный `GITHUB_TOKEN` (доп. секреты не нужны).
> Для пулла образа на VPS выполните **один раз** на сервере вход в GHCR:
> ```bash
> echo "<PAT с read:packages>" | docker login ghcr.io -u igorycha88-gif --password-stdin
> ```

> ⚠️ **Дефолтная ветка репозитория — `dev`**, а деплой идёт с `main`. Поэтому
> авто-деплой реализован как job внутри `docker-publish.yml` (а не через `workflow_run`).
> Для ручного ре-деплоя конкретного тега используйте воркфлоу `deploy`.

---

## 🖥️ Первый бутстрап VPS (один раз)

1. **Клонировать проект**:
   ```bash
   git clone https://github.com/igorycha88-gif/tow-truck.git /root/tow-truck
   cd /root/tow-truck
   ```
2. **`.env`** (по `.env.example`): заполнить `DATABASE_URL`, `REDIS_PASSWORD`,
   `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `YANDEX_MAPS_API_KEY`,
   `NEXT_PUBLIC_*`, `POSTGRES_PASSWORD`.
3. **Поднять stateful-сервисы** (PostgreSQL + Redis):
   ```bash
   docker compose -f docker-compose.yml up -d
   docker compose -f docker-compose.yml ps   # оба healthy
   ```
4. **nginx + SSL**: см. `deploy/nginx/README.md` (DNS → `эвакуация.online` → VPS_IP,
   затем `bash deploy/nginx/setup-ssl.sh`).
5. **Вход в GHCR** (см. выше) — чтобы VPS мог пуллить приватный образ.
6. **Задать GitHub-secrets** (см. таблицу выше).

---

## 🚀 Запуск деплоя

**Автоматически:** push в `main` → сборка образа → (если `ENABLE_PROD_DEPLOY=true` и
заданы VPS-secrets) авто-деплой job-ой в `docker-publish.yml`.

**Вручную** (ре-деплой конкретного тега): GitHub → Actions → `deploy` → Run workflow →
тег образа (по умолчанию `latest`). Работает независимо от дефолтной ветки.

Что делает `deploy/blue-green-deploy.sh`:
1. Бэкап БД (`pg_dump` через `tow-truck-db`) → `backups/db_*.sql.gz`.
2. `docker pull` нового образа.
3. GREEN-контейнер на `:3003` (BLUE на `:3001` продолжает работать).
4. Healthcheck GREEN (макс 120с). **Провал → авто-откат** (nginx→BLUE, rm GREEN).
5. nginx upstream `app` → `127.0.0.1:3003`, smoke-тесты (`/`, `/api/health`).
6. Стоп BLUE → новый prod на `:3001` → nginx → `:3001` → cleanup GREEN.

---

## 🔍 Проверка после деплоя

```bash
# На VPS:
curl -s http://127.0.0.1:3001/api/health | head        # status ok, version, db/redis up
docker ps --filter name=tow-truck                      # tow-truck-app Up (healthy)

# Снаружи (после SSL):
curl -sI https://эвакуация.online/ | head -3           # HTTP/2 200
curl -s  https://эвакуация.online/api/health           # version == деплоеная
```

---

## 🔄 Откат

**Авто:** при провале critical-шага (healthcheck/smoke) скрипт возвращает nginx на
BLUE (`:3001`) и поднимает предыдущий образ.

**Вручную:** Actions → `deploy` → Run workflow с тегом предыдущего образа
(`sha-xxxxxxx`), или на VPS:
```bash
PREV="ghcr.io/igorycha88-gif/tow-truck/app:sha-xxxxxxx"
./deploy/blue-green-deploy.sh "$PREV"
```

Восстановление БД (только при повреждении, **с подтверждением**):
```bash
docker stop tow-truck-app
gunzip -c /root/tow-truck/backups/db_YYYYMMDD_HHMMSS.sql.gz \
  | docker exec -i tow-truck-db psql -U postgres -d tow_truck
```

---

## 📋 Журналы

- Деплой-логи на VPS: `/var/log/tow-truck-deploy/deploy-*.log`
- Бэкапы БД: `/root/tow-truck/backups/db_*.sql.gz` (хранение 7 дней)
- nginx: `/var/log/nginx/evakuaciya-online.{access,error}.log`
