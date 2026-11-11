#!/usr/bin/env bash
# Установка Prometheus на ПРОД VPS (решение владельца 2026-11-11, дополняет
# ЧТЗ_Внутренняя_Графана_Prometheus.md v1.1: прод-стек получает внутренний
# Prometheus для дашборда «Бизнес-метрики — Prometheus» и локальной истории
# business_*-метрик).
#
# Что делает (идемпотентно, повторный запуск безопасен):
#   1. Проверяет окружение: .env с MONITORING_KEY, app на :3001, ufw (9090 закрыт снаружу).
#   2. Генерирует /etc/prometheus/prometheus.yml из prometheus/prometheus.prod.tpl.yml
#      (sed подставляет ключ; файл chmod 600, в git не попадает).
#   3. Запускает контейнер prometheus (host-сеть, retention 15d, restart unless-stopped).
#   4. Пересоздаёт tow-truck-grafana с env PROMETHEUS_URL=http://<gateway>:9090
#      (datasource prometheus.yml в репо использует ${PROMETHEUS_URL}; dev-стек
#      задаёт http://prometheus:9090 в docker-compose.dev.yml).
#
# Запуск на VPS из корня репо (/root/tow-truck):
#   bash deploy/monitoring/setup-prometheus-prod.sh

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TPL="$PROJECT_DIR/prometheus/prometheus.prod.tpl.yml"
CONF_DIR="/etc/prometheus"
CONF="$CONF_DIR/prometheus.yml"
NET="tow-truck-net"
GF_CONTAINER="tow-truck-grafana"
PROM_IMAGE="prom/prometheus:v2.53.0"

log() { printf '[setup-prometheus-prod] %s\n' "$*"; }
fail() { printf '[setup-prometheus-prod] ОШИБКА: %s\n' "$*" >&2; exit 1; }

# ── 1. Проверка окружения ────────────────────────────────────────────────────
[ -f "$PROJECT_DIR/.env" ] || fail ".env не найден в $PROJECT_DIR"
KEY="$(grep -E '^MONITORING_KEY=' "$PROJECT_DIR/.env" | cut -d= -f2 | tr -d '"' || true)"
[ -n "$KEY" ] || fail "MONITORING_KEY пуст в .env"
[ -f "$TPL" ] || fail "шаблон не найден: $TPL"
curl -sf --max-time 5 http://127.0.0.1:3001/api/health >/dev/null \
  || fail "app не отвечает на 127.0.0.1:3001/api/health"
if command -v ufw >/dev/null 2>&1 && ufw status 2>/dev/null | grep -q 'Status: active'; then
  ufw status | grep -qE '^9090/tcp' \
    && fail "ufw разрешает 9090 снаружи — Prometheus будет открыт в интернет. Закройте: ufw deny 9090/tcp"
  # Grafana (bridge tow-truck-net) скрейпит prometheus (host-сеть) через gateway:
  # разрешаем 9090 ТОЛЬКО из подсети tow-truck-net, наружу остаётся закрыто.
  NET_SUBNET="$(docker network inspect "$NET" --format '{{(index .IPAM.Config 0).Subnet}}')"
  ufw status | grep -qF "$NET_SUBNET" \
    || ufw allow from "$NET_SUBNET" to any port 9090 proto tcp comment "grafana->prometheus ($NET)" >/dev/null
  log "ufw: 9090 закрыт снаружи, разрешён из $NET_SUBNET"
fi
log "окружение OK (ключ, app:3001, ufw)"

# ── 2. Конфиг из шаблона ─────────────────────────────────────────────────────
mkdir -p "$CONF_DIR"
sed "s/__MONITORING_KEY__/$KEY/" "$TPL" > "$CONF"
# Образ prom/prometheus работает под uid 65534 (nobody): даём ему читать конфиг,
# не открывая секрет остальным (root:65534, 640 — никто кроме root и контейнера).
chown root:65534 "$CONF"
chmod 640 "$CONF"
log "конфиг сгенерирован: $CONF ($(wc -c <"$CONF") байт, root:65534, права 640)"

# ── 3. Контейнер Prometheus ──────────────────────────────────────────────────
docker volume create prometheus-data >/dev/null
docker rm -f prometheus 2>/dev/null || true
docker run -d \
  --name prometheus \
  --network host \
  --restart unless-stopped \
  -v "$CONF:/etc/prometheus/prometheus.yml:ro" \
  -v prometheus-data:/prometheus \
  "$PROM_IMAGE" \
  --config.file=/etc/prometheus/prometheus.yml \
  --storage.tsdb.retention.time=15d \
  --web.listen-address=0.0.0.0:9090 >/dev/null
log "контейнер prometheus запущен (host-сеть, retention 15d)"

READY=0
for _ in $(seq 1 20); do
  sleep 2
  if curl -sf --max-time 3 http://127.0.0.1:9090/-/ready >/dev/null; then READY=1; break; fi
done
[ "$READY" = 1 ] || fail "prometheus не перешёл в ready за 40с (docker logs prometheus)"
log "prometheus: /-/ready = 200"

# ── 4. Grafana: env PROMETHEUS_URL (datasource ${PROMETHEUS_URL}) ────────────
GW="$(docker network inspect "$NET" --format '{{(index .IPAM.Config 0).Gateway}}')"
[ -n "$GW" ] || fail "не удалось определить gateway сети $NET"

docker inspect "$GF_CONTAINER" >/dev/null 2>&1 || fail "контейнер $GF_CONTAINER не найден"
# Текущие GF_/GRAFANA_-переменные переносим в env-file, добавляем PROMETHEUS_URL.
ENV_FILE="$(mktemp)"
trap 'rm -f "$ENV_FILE"' EXIT
docker inspect "$GF_CONTAINER" --format '{{range .Config.Env}}{{println .}}{{end}}' \
  | grep -E '^(GF_|GRAFANA_)' > "$ENV_FILE"
if grep -q '^PROMETHEUS_URL=' "$ENV_FILE"; then
  sed -i "s|^PROMETHEUS_URL=.*|PROMETHEUS_URL=http://$GW:9090|" "$ENV_FILE"
else
  printf 'PROMETHEUS_URL=http://%s:9090\n' "$GW" >> "$ENV_FILE"
fi

GF_ROOT_URL="$(grep '^GF_SERVER_ROOT_URL=' "$ENV_FILE" | cut -d= -f2-)"
docker rm -f "$GF_CONTAINER" >/dev/null
docker run -d \
  --name "$GF_CONTAINER" \
  --network "$NET" \
  --restart unless-stopped \
  -p 127.0.0.1:3030:3000 \
  --env-file "$ENV_FILE" \
  -v "$PROJECT_DIR/grafana/grafana.ini:/etc/grafana/grafana.ini" \
  -v "$PROJECT_DIR/grafana/provisioning:/etc/grafana/provisioning" \
  -v "$PROJECT_DIR/grafana/dashboards:/var/lib/grafana/dashboards" \
  -v grafana-data:/var/lib/grafana \
  grafana/grafana:11.2.0 >/dev/null
log "grafana пересоздан с PROMETHEUS_URL=http://$GW:9090 (root_url=$GF_ROOT_URL)"

GF_READY=0
for _ in $(seq 1 15); do
  sleep 2
  if curl -sf --max-time 3 http://127.0.0.1:3030/api/health >/dev/null; then GF_READY=1; break; fi
done
[ "$GF_READY" = 1 ] || fail "grafana не поднялась за 30с (docker logs $GF_CONTAINER)"
log "grafana: /api/health = 200"

# Достижимость Prometheus из grafana-сети (через gateway).
docker exec "$GF_CONTAINER" wget -qO- --timeout=5 "http://$GW:9090/-/ready" >/dev/null 2>&1 \
  || fail "grafana не достигает prometheus на http://$GW:9090 — проверьте сеть $NET"
log "grafana → prometheus ($GW:9090) OK"

log "готово. Дашборд: https://эвакуация.online/grafana → «Бизнес-метрики — Prometheus» (данные через 1–2 скрейпа)"
