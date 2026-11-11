#!/usr/bin/env bash
# Установка мониторинга ботов на VPS (ADR-016, ЧТЗ_Мониторинг_ботов_Grafana.md).
#
# Что делает (идемпотентно, повторный запуск безопасен):
#   1. Проверяет окружение: python3, docker, контейнер БД, nginx-лог, .env.
#   2. Регистрирует cron: инкрементальный импорт каждые 5 минут.
#   3. Выполняет разовый ретро-импорт истории логов (~15 дней).
#
# Запуск на VPS из корня репо (/root/tow-truck):
#   bash deploy/bots-shipper/setup-vps.sh
#
# Требование: миграция BotVisit уже применена (prisma migrate deploy при деплое).

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SHIPPER="$PROJECT_DIR/deploy/bots-shipper/nginx_bots_shipper.py"
CRON_MARKER='# nginx-bots-shipper (ADR-016)'
CRON_JOB="*/5 * * * * /usr/bin/python3 $SHIPPER >> /var/log/nginx-bots-shipper.cron.log 2>&1 $CRON_MARKER"

log() { printf '[setup-vps] %s\n' "$*"; }
fail() { printf '[setup-vps] ОШИБКА: %s\n' "$*" >&2; exit 1; }

# ── 1. Проверка окружения ────────────────────────────────────────────────────
command -v python3 >/dev/null 2>&1 || fail "python3 не найден"
python3 --version >&2
docker inspect tow-truck-db >/dev/null 2>&1 || fail "контейнер tow-truck-db не запущен"
[ -f /var/log/nginx/evakuaciya-online.access.log ] || fail "nginx access-лог не найден"
[ -f "$PROJECT_DIR/.env" ] || fail "$PROJECT_DIR/.env не найден"
[ -f "$SHIPPER" ] || fail "шиппер не найден: $SHIPPER"

# Креды БД из .env (с fallback как в docker-compose.yml)
PGUSER_VAL="$(grep -E '^POSTGRES_USER=' "$PROJECT_DIR/.env" | cut -d= -f2 | tr -d '"' || true)"
PGDB_VAL="$(grep -E '^POSTGRES_DB=' "$PROJECT_DIR/.env" | cut -d= -f2 | tr -d '"' || true)"
PGUSER_VAL="${PGUSER_VAL:-postgres}"
PGDB_VAL="${PGDB_VAL:-tow_truck}"

# Таблица BotVisit существует? (миграция должна быть применена до установки)
if ! docker exec tow-truck-db psql -U "$PGUSER_VAL" -d "$PGDB_VAL" -tAc \
     "SELECT to_regclass('\"BotVisit\"')" 2>/dev/null | grep -q BotVisit; then
  fail 'таблица "BotVisit" отсутствует — сначала деплой с миграцией (prisma migrate deploy)'
fi
log 'окружение OK (python3, docker, БД + BotVisit, nginx-лог)'

# ── 2. Cron (идемпотентно) ───────────────────────────────────────────────────
mkdir -p /var/lib/nginx-bots-shipper
touch /var/log/nginx-bots-shipper.log /var/log/nginx-bots-shipper.cron.log
if crontab -l 2>/dev/null | grep -qF "$CRON_MARKER"; then
  log 'cron уже зарегистрирован — пропускаю'
else
  (crontab -l 2>/dev/null || true; echo "$CRON_JOB") | crontab -
  log 'cron добавлен (*/5 * * * *)'
fi

# ── 3. Ретро-импорт истории (~15 дней) ───────────────────────────────────────
log 'ретро-импорт истории логов…'
python3 "$SHIPPER" --retro || log 'ПРЕДУПРЕЖДЕНИЕ: ретро-импорт завершился с ошибкой (см. /var/log/nginx-bots-shipper.log)'

# ── 4. Первый инкрементальный прогон ─────────────────────────────────────────
python3 "$SHIPPER" || true

COUNT=$(docker exec tow-truck-db psql -U "$PGUSER_VAL" -d "$PGDB_VAL" -tAc \
  'SELECT COUNT(*) FROM "BotVisit"' 2>/dev/null || echo '?')
log "готово. строк в BotVisit: $COUNT"
log 'дашборд: https://эвакуация.online/grafana → «Боты и люди»'
