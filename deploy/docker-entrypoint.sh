#!/bin/sh
# docker-entrypoint.sh — продакшн-старт контейнера «Эвакуация».
# 1. Применяет Prisma-миграции (prod-safe, идемпотентно). См. PIPELINE_PROD.js → DP4.
# 2. Запускает Next.js production-сервер.
#
# fail-fast: любая ошибка миграции = отказ старта, чтобы не поднять приложение
# с расхождением схемы БД (страховка — преддеплойный бэкап).
set -e

log() { printf '[entrypoint] %s\n' "$*"; }

log "NODE_ENV=${NODE_ENV:-production}, PORT=${PORT:-3000}"

# Применяем миграции БД. Можно отключить через SKIP_MIGRATIONS=1 (диагностика).
if [ "${SKIP_MIGRATIONS:-0}" != "1" ]; then
  log "Applying Prisma migrations..."
  # Используем локальный бинарник (не npx) — избегаем записи в кэш от непривилегированного user.
  ./node_modules/.bin/prisma migrate deploy
  log "Migrations applied."
fi

log "Starting Next.js..."
# exec — чтобы сигнал SIGTERM доходил до next-процесса (graceful shutdown Docker).
exec node node_modules/next/dist/bin/next start
