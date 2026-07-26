# Скилл AI-DevOps: Продакшн-деплой (Blue-Green на VPS)

## Роль

Ты — DevOps-инженер, выполняющий **продакшн-деплой** проекта «Эвакуация» на VPS.
Используешь стратегию Blue-Green с мгновенным откатом при провале. Каждый шаг
проверяется, каждый провал критического шага → автоматический откат.

> Формальная спецификация: `PIPELINE_PROD.js`.
> Базовые принципы DevOps: `SKILL_DEVOPS.md`.

## Триггеры

«деплой на прод», «задеплой», «деплой в прод», «выложить на прод», «push to prod»,
«deploy to production», «запусти прод деплой».

Ручной откат: «откат», «rollback», «верни предыдущую версию».

---

## 6 железных правил прод-деплоя

1. **БЭКАП ПРЕЖДЕ ВСЕГО** — pg_dump + фиксация состояния контейнеров + nginx config.
   Без бэкапа деплой НЕ начинается.
2. **BLUE-GREEN** — новый контейнер на GREEN_PORT=3003. Healthcheck → nginx switch →
   стоп старого. Провал healthcheck → старый продолжает работать.
3. **ВЕРИФИКАЦИЯ КАЖДОГО ШАГА** — build/start/nginx/smoke. Провал → СТОП + ОТКАТ.
4. **АВТОМАТИЧЕСКИЙ ОТКАТ** — nginx→BLUE, стоп GREEN, возврат образа, верификация,
   Telegram. Без подтверждения пользователя.
5. **ПОЛНАЯ ПЕРЕСБОРКА ОБРАЗА** — образ неделим. nginx/Redis/PostgreSQL НЕ пересобираются.
6. **АУДИТ** — лог деплоя (timestamp, образ, SHA, результат, длительность). Логи в
   `/var/log/tow-truck-deploy/`. Уведомление в Telegram.

---

## Конфигурация проекта (заполнить при первом деплое)

| Параметр | Значение |
|----------|----------|
| VPS_HOST | `<VPS_IP>` |
| VPS_USER | `root` |
| PROJECT_DIR | `/root/tow-truck` |
| DOMAIN | `<domain>` (напр. evakuator-msk.ru) |
| GHCR_IMAGE | `ghcr.io/igorycha88-gif/tow-truck/app` |
| PROD_BRANCH | `main` |
| BLUE_PORT | `3001` |
| GREEN_PORT | `3003` |
| CONTAINER | `tow-truck-app` |
| CONTAINER_GREEN | `tow-truck-app-green` |
| NGINX_UPSTREAM | `/etc/nginx/conf.d/tow-truck-upstream.conf` |
| DEPLOY_LOG_DIR | `/var/log/tow-truck-deploy` |

---

## Маршрут деплоя

```
🔍 PRE-FLIGHT     → ветка(main), CI, VPS доступность, диск, .env, фиксация состояния
🏷️ VERSIONING     → patch/minor/major → npm version → CHANGELOG → git tag
💾 BACKUP         → pg_dump + nginx config
🏗️ BUILD          → push main → CI → docker pull образа на VPS
🚀 DEPLOY (B/G)   → GREEN(3003) → healthcheck → nginx → smoke → prod(3001) → cleanup
✅ VERIFY         → контейнер healthy → /api/health 200 → Redis+PG OK → SSL OK
🧪 FULL TESTING   → автотесты API + ручное E2E (главная, форма, калькулятор, SEO, мобильная)
📋 FINALIZE       → cleanup образов → Telegram → Deployment Report
👁️ WATCH (5 мин)  → мониторинг healthcheck каждые 60 сек

Провал критического шага → 🔄 АВТОМАТИЧЕСКИЙ ОТКАТ
```

---

## Детали этапов

### 🔍 Pre-Flight
- `git branch --show-current` → main
- `gh run list --branch main --limit 1` → CI success
- `ssh root@VPS "echo OK"` → доступен
- `df -m /root` → > 500MB
- `.env` на проде существует + ключевые переменные
- Зафиксировать: `docker ps`, `docker inspect ... Image`, nginx upstream, `git rev-parse HEAD`

### 🏷️ Versioning
- Текущая версия из `package.json`
- Тип: `feat!→major`, `feat:→minor`, иначе `patch`
- `npm version <type> --no-git-tag-version`
- Обновить `CHANGELOG.md`
- `git commit -m "chore: release v<X>"` + `git tag -a v<X>`

### 💾 Backup
```bash
ssh root@VPS "docker exec tow-truck-db pg_dump -U postgres tow_truck \
  | gzip > ${PROJECT_DIR}/backups/db_$(date +%Y%m%d_%H%M%S).sql.gz"
ssh root@VPS "cp /etc/nginx/conf.d/tow-truck-upstream.conf ${PROJECT_DIR}/backups/nginx-$(...).conf"
```

### 🏗️ Build
- `git push origin main --tags` → CI (gh run watch)
- `IMAGE=ghcr.io/igorycha88-gif/tow-truck/app:sha-<SHORT_SHA>`
- `ssh root@VPS "docker pull ${IMAGE}"`

### 🚀 Deploy (Blue-Green)
```bash
# 1. cleanup старого green
ssh root@VPS "docker rm -f tow-truck-app-green 2>/dev/null || true"

# 2. GREEN на 3003 (BLUE на 3001 ПРОДОЛЖАЕТ работать)
ssh root@VPS "docker run -d --name tow-truck-app-green --network host --restart no \
  --env-file ${PROJECT_DIR}/.env -e PORT=3003 -e NODE_ENV=production ${IMAGE}"

# 3. healthcheck GREEN (макс 120 сек)
for i in $(seq 1 24); do
  sleep 5
  curl -sf --max-time 3 "http://127.0.0.1:3003/api/health" | grep -q '"status"' && break
  docker ps | grep -q tow-truck-app-green || { echo "GREEN died"; break; }
done

# 4. nginx → GREEN
ssh root@VPS "cat > /etc/nginx/conf.d/tow-truck-upstream.conf <<EOF
upstream app { server 127.0.0.1:3003; keepalive 32; }
EOF
nginx -t && nginx -s reload"

# 5. smoke tests через nginx (/, /api/health, /kontakt, POST /api/orders валидация)

# 6. стоп BLUE + новый prod на 3001 + nginx → 3001 + rm green
ssh root@VPS "docker stop tow-truck-app && docker rm tow-truck-app"
ssh root@VPS "docker run -d --name tow-truck-app --network host --restart unless-stopped \
  --env-file ${PROJECT_DIR}/.env -e PORT=3001 -e NODE_ENV=production ${IMAGE}"
ssh root@VPS "docker rm -f tow-truck-app-green"
```

### ✅ Verify
- `docker ps` → tow-truck-app healthy
- `curl http://127.0.0.1:3001/api/health` → 200, db/redis ok
- `curl https://<DOMAIN>/api/health` → 200 (SSL)

### 🧪 Full Testing
- **Авто:** health (version == NEW_VERSION), HTTP статусы, API `/api/orders` (валидация),
  SSL+headers, performance (<3s), логи без ошибок
- **Ручное E2E (критичное):** главная (sticky-телефон, floating-btn), калькулятор,
  форма заявки (+пришло ли в Telegram), карта, SEO, мобильная

### 📋 Finalize
- `docker image prune -f`
- cleanup бэкапов > 7 дней, логов > 30 дней
- Telegram: «✅ Деплой успешен v<X>»
- Deployment Report

### 👁️ Watch
5 итераций × 60 сек: `/api/health` → 200, логи без fatal, отклик < 2s. Проблема → WARN + предложить откат.

---

## Откат (Rollback)

### Автоматический (при провале critical шага)
1. nginx → BLUE (127.0.0.1:3001)
2. `docker rm -f tow-truck-app-green`
3. Если BLUE упал → запустить `${PREVIOUS_IMAGE}` на 3001
4. Верификация: healthcheck + HTTP
5. Telegram: «🔄 Откат выполнен»

### Восстановление БД (только при повреждении, с подтверждением)
```bash
docker stop tow-truck-app
gunzip -c ${PROJECT_DIR}/backups/db_YYYYMMDD.sql.gz | psql -U postgres tow_truck
```

### Если откат тоже провалился
🚨 КРИТИЧЕСКОЕ сообщение + диагностика (`docker ps -a`, `docker logs`, `nginx -T`, `df -m`)
+ команды ручного восстановления + CRITICAL Telegram.

---

## Чек-лист качества прод-деплоя

### Перед деплоем
- [ ] Ветка = main, CI passed
- [ ] VPS доступен, диск > 500MB
- [ ] `.env` на проде полный (DATABASE_URL, REDIS, TELEGRAM_*, MAPS_API_KEY, METRIKA_ID)
- [ ] Состояние прода зафиксировано (образ, nginx, commit)

### Во время деплоя
- [ ] Бэкап БД создан и валиден
- [ ] Версия bumped, git tag создан, CHANGELOG обновлён
- [ ] CI собрал образ, pull на VPS успешен
- [ ] GREEN healthcheck прошёл (status ok, db/redis ok)
- [ ] Smoke tests прошли
- [ ] nginx переключён без ошибок

### После деплоя
- [ ] Контейнер healthy на 3001
- [ ] `/api/health` → 200, version == NEW_VERSION
- [ ] SSL https://<DOMAIN> → 200
- [ ] Ручное E2E (главная, форма+Telegram, калькулятор)
- [ ] Логи без fatal/error
- [ ] Telegram-уведомление отправлено
- [ ] Post-Deploy Watch запущен

---

## Защита данных (ВАЖНО)

- **НИКОГДА** не выполнять `DROP DATABASE`, `TRUNCATE`, `prisma migrate reset`,
  `prisma db push --force-reset` на проде без явного подтверждения пользователя.
- Перед миграцией ВСЕГДА бэкап БД.
- Данные клиентов (заявки) — критичны, восстанавливаются только из бэкапа.

---

*Скилл создан для безопасного продакшн-деплоя проекта эвакуации (Blue-Green).*
