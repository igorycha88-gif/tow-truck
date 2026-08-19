#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────
# TASK-INF-002: создание readonly-пользователя postgres_exporter
# (SQL — см. create-monitoring-user.sql; ЧТЗ §4.4).
#
# Запуск на VPS (root), пароль передаётся окружением (в git НЕ хранится):
#   EXPORTER_PASSWORD='<пароль>' bash deploy/postgres-exporter/setup-user.sh
# ─────────────────────────────────────────────────────────────────────
set -euo pipefail

if [ -z "${EXPORTER_PASSWORD:-}" ]; then
  echo "EXPORTER_PASSWORD не задан. Пример:" >&2
  echo "  EXPORTER_PASSWORD='<пароль>' bash $0" >&2
  exit 1
fi

docker exec -i tow-truck-db psql -U postgres -d tow_truck \
  -v exporter_password="'${EXPORTER_PASSWORD}'" \
  < "$(dirname "$0")/create-monitoring-user.sql"

echo "OK: роль postgres_exporter создана (pg_monitor, NOSUPERUSER)."
echo "DSN для .env (POSTGRES_EXPORTER_DSN):"
echo "  postgresql://postgres_exporter:${EXPORTER_PASSWORD}@postgres:5432/tow_truck?sslmode=disable"
