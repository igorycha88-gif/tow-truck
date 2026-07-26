#!/usr/bin/env bash
# deploy/blue-green-deploy.sh — безопасный Blue-Green деплой «Эвакуация» на VPS.
# Исполняемая реализация PIPELINE_PROD.js → Этап 3 (DEPLOY) + авто-откат.
#
# Запуск (на VPS или через SSH из GitHub Actions):
#   ./deploy/blue-green-deploy.sh <IMAGE>
#   IMAGE=ghcr.io/igorycha88-gif/tow-truck/app:sha-abc1234 ./deploy/blue-green-deploy.sh
#
# Поведение:
#   1. Бэкап БД (pg_dump через контейнер tow-truck-db).
#   2. Запуск GREEN (порт 3003) — BLUE (3001) продолжает работать.
#   3. Healthcheck GREEN (макс 120с). Провал → авто-откат (nginx→BLUE, rm GREEN).
#   4. nginx → GREEN, smoke-тесты.
#   5. Стоп BLUE → новый prod на 3001 → nginx → 3001 → cleanup GREEN.
#
# Не требует подтверждений: откат автоматический при провале critical-шага.

set -euo pipefail

# ─── Конфигурация ───
IMAGE="${1:-${IMAGE:-}}"
PROJECT_DIR="${PROJECT_DIR:-/root/tow-truck}"
BLUE_PORT="${BLUE_PORT:-3001}"
GREEN_PORT="${GREEN_PORT:-3003}"
CONTAINER="${CONTAINER:-tow-truck-app}"
CONTAINER_GREEN="${CONTAINER_GREEN:-tow-truck-app-green}"
DB_CONTAINER="${DB_CONTAINER:-tow-truck-db}"
# Реальный upstream-файл nginx (см. deploy/nginx/evakuaciya-upstream.conf).
NGINX_UPSTREAM="${NGINX_UPSTREAM:-/etc/nginx/conf.d/evakuaciya-upstream.conf}"
BACKUP_DIR="${PROJECT_DIR}/backups"
DEPLOY_LOG_DIR="${DEPLOY_LOG_DIR:-/var/log/tow-truck-deploy}"
DEPLOY_LOG="${DEPLOY_LOG_DIR}/deploy-$(date +%Y%m%d-%H%M%S).log"

# ─── Логирование ───
log()  { printf '[%s] %s\n' "$(date '+%H:%M:%S')" "$*" | tee -a "$DEPLOY_LOG" >&2; }
ok()   { log "✅ $*"; }
warn() { log "⚠️  $*"; }
die()  { log "❌ $*"; exit 1; }

mkdir -p "$BACKUP_DIR" "$DEPLOY_LOG_DIR"

[ -n "$IMAGE" ] || die "IMAGE не задан (аргумент \$1 или env IMAGE)."
[ -f "${PROJECT_DIR}/.env" ] || die ".env не найден в ${PROJECT_DIR}."

# Запоминаем предыдущий образ (для отката).
PREVIOUS_IMAGE="$(docker inspect --format='{{.Config.Image}}' "$CONTAINER" 2>/dev/null || echo "none")"
DEPLOY_TIME=$(date +%s)
log "═══════════════════════════════════════════"
log "🚀 BLUE-GREEN DEPLOY"
log "   IMAGE:          $IMAGE"
log "   Previous image: $PREVIOUS_IMAGE"
log "   BLUE=${BLUE_PORT}  GREEN=${GREEN_PORT}"
log "═══════════════════════════════════════════"

# ─── Откат ───
set_nginx() { # $1 = порт
  local port="$1"
  printf 'upstream app {\n    server 127.0.0.1:%s;\n    keepalive 32;\n}\n' "$port" \
    | tee "$NGINX_UPSTREAM" >/dev/null
  nginx -t && nginx -s reload
}
rollback() { # $1 = причина
  warn "ОТКАТ: $1"
  set_nginx "$BLUE_PORT" || warn "nginx switch на BLUE failed"
  docker rm -f "$CONTAINER_GREEN" 2>/dev/null || true
  # Если BLUE упал — поднимаем предыдущий образ.
  if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
    warn "BLUE не работает — поднимаю предыдущий образ: $PREVIOUS_IMAGE"
    [ "$PREVIOUS_IMAGE" != "none" ] && \
      docker run -d --name "$CONTAINER" --network host --restart unless-stopped \
        --env-file "${PROJECT_DIR}/.env" -e PORT="$BLUE_PORT" -e NODE_ENV=production "$PREVIOUS_IMAGE" || true
  fi
  die "Деплой провален, выполнен откат к BLUE."
}

# ─── 1. Бэкап БД ───
log "💾 Backup БД..."
if docker ps --format '{{.Names}}' | grep -qx "$DB_CONTAINER"; then
  BAK="${BACKUP_DIR}/db_$(date +%Y%m%d_%H%M%S).sql.gz"
  docker exec "$DB_CONTAINER" pg_dump -U "${POSTGRES_USER:-postgres}" "${POSTGRES_DB:-tow_truck}" 2>/dev/null | gzip > "$BAK" || warn "pg_dump failed (продолжаем — BLUE жив)."
  if [ -s "$BAK" ]; then
    ok "Бэкап: $BAK ($(du -h "$BAK" | cut -f1))"
  else
    warn "Бэкап пустой."
  fi
else
  warn "Контейнер БД '$DB_CONTAINER' не найден — бэкап пропущен."
fi

# ─── 2. Pull образа ───
log "🏗️  Pull образа: $IMAGE"
docker pull "$IMAGE" || die "docker pull failed."
ok "Образ получен."

# ─── 3. Запуск GREEN ───
log "🟢 Запуск GREEN на :${GREEN_PORT} (BLUE продолжается на :${BLUE_PORT})..."
docker rm -f "$CONTAINER_GREEN" 2>/dev/null || true
docker run -d \
  --name "$CONTAINER_GREEN" \
  --network host \
  --restart no \
  --env-file "${PROJECT_DIR}/.env" \
  -e PORT="$GREEN_PORT" \
  -e NODE_ENV=production \
  "$IMAGE" >/dev/null || die "docker run GREEN failed."

# ─── 4. Healthcheck GREEN ───
log "🩺 Healthcheck GREEN (макс 120с)..."
HEALTH_OK=0
for _ in $(seq 1 24); do
  sleep 5
  if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER_GREEN"; then
    log "GREEN контейнер упал:"; docker logs --tail 30 "$CONTAINER_GREEN" 2>&1 | tee -a "$DEPLOY_LOG" >&2 || true
    rollback "GREEN контейнер умер."
  fi
  if curl -sf --max-time 3 "http://127.0.0.1:${GREEN_PORT}/api/health" | grep -q '"status"'; then
    HEALTH_OK=1; break
  fi
done
[ "$HEALTH_OK" = 1 ] || rollback "Healthcheck GREEN не прошёл за 120с."
# Проверяем, что нет ошибок БД в ответе.
HRESP="$(curl -sf --max-time 3 "http://127.0.0.1:${GREEN_PORT}/api/health" || true)"
echo "$HRESP" | grep -q '"db":"up"' || rollback "GREEN health: БД down."
ok "GREEN healthy: $HRESP"

# ─── 5. nginx → GREEN ───
log "🔁 nginx → GREEN (:${GREEN_PORT})..."
set_nginx "$GREEN_PORT" || rollback "nginx switch на GREEN failed."
ok "Трафик пошёл на GREEN."

# ─── 6. Smoke-тесты через nginx (локально, :80) ───
log "🧪 Smoke-тесты (/, /api/health, /kontakt)..."
smoke() { # $1=url $2=ожидаемый код
  local code; code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$1" || echo 000)"
  if [ "$code" = "$2" ]; then
    ok "smoke $1 → $code"
  else
    rollback "smoke $1 → $code (ожидался $2)"
  fi
}
smoke "http://127.0.0.1/" "200"
smoke "http://127.0.0.1/api/health" "200"

# ─── 7. Стоп BLUE → новый prod на :3001 ───
log "🔄 Замена BLUE новым prod на :${BLUE_PORT}..."
docker stop "$CONTAINER" 2>/dev/null || true
docker rm "$CONTAINER" 2>/dev/null || true
docker run -d \
  --name "$CONTAINER" \
  --network host \
  --restart unless-stopped \
  --env-file "${PROJECT_DIR}/.env" \
  -e PORT="$BLUE_PORT" \
  -e NODE_ENV=production \
  "$IMAGE" >/dev/null || rollback "docker run нового BLUE failed."

# Ждём health нового prod.
PROD_OK=0
for _ in $(seq 1 24); do
  sleep 5
  curl -sf --max-time 3 "http://127.0.0.1:${BLUE_PORT}/api/health" | grep -q '"status"' && { PROD_OK=1; break; }
done
[ "$PROD_OK" = 1 ] || rollback "Новый prod healthcheck не прошёл."

# nginx → BLUE (финальное каноническое состояние: prod на 3001).
set_nginx "$BLUE_PORT" || warn "nginx switch на BLUE failed (проверь вручную)."
docker rm -f "$CONTAINER_GREEN" 2>/dev/null || true

# ─── 8. Итог ───
FINAL="$(curl -sf --max-time 5 "http://127.0.0.1:${BLUE_PORT}/api/health" || echo '{}')"
ELAPSED=$(( $(date +%s) - DEPLOY_TIME ))
ok "═══════════════════════════════════════════"
ok "🎉 ДЕПЛОЙ УСПЕШЕН (за ${ELAPSED}с)"
ok "   prod: ${CONTAINER} на :${BLUE_PORT}"
ok "   image: ${IMAGE}"
ok "   health: ${FINAL}"
ok "   откат к: ${PREVIOUS_IMAGE}"
ok "═══════════════════════════════════════════"

# cleanup старых образов
docker image prune -f >/dev/null 2>&1 || true
exit 0
