#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────
# TASK-INF-001: node_exporter для централизованного мониторинга
# (ЧТЗ «Централизованный мониторинг», §4.3).
#
# Устанавливает node_exporter (>= 1.x) как systemd-сервис, слушающий
# ТОЛЬКО 127.0.0.1:9100 (паттерн эталона da-dryclean.ru, не контейнер).
# Наружу порт не публикуется — доступ только через nginx /metrics/node.
#
# Запуск на VPS (root): bash deploy/node-exporter/setup.sh
# Версию можно переопределить: NODE_EXPORTER_VERSION=1.9.1 bash setup.sh
# ─────────────────────────────────────────────────────────────────────
set -euo pipefail

VERSION="${NODE_EXPORTER_VERSION:-1.8.2}"
ARCH="$(uname -m)"
case "$ARCH" in
  x86_64)  ARCH="amd64" ;;
  aarch64) ARCH="arm64" ;;
  *) echo "Неподдерживаемая архитектура: $ARCH" >&2; exit 1 ;;
esac

TARBALL="node_exporter-${VERSION}.linux-${ARCH}.tar.gz"
URL="https://github.com/prometheus/node_exporter/releases/download/v${VERSION}/${TARBALL}"
INSTALL_DIR="/usr/local/bin"
UNIT_FILE="/etc/systemd/system/node-exporter.service"

if systemctl is-active --quiet node-exporter 2>/dev/null; then
  echo "node-exporter уже запущен — пропускаем установку."
  exit 0
fi

echo "→ Скачиваю ${URL}"
curl -fsSL -o "/tmp/${TARBALL}" "${URL}"
tar -xzf "/tmp/${TARBALL}" -C /tmp
install -m 0755 "/tmp/node_exporter-${VERSION}.linux-${ARCH}/node_exporter" "${INSTALL_DIR}/node_exporter"
rm -rf "/tmp/${TARBALL}" "/tmp/node_exporter-${VERSION}.linux-${ARCH}"

echo "→ Создаю systemd-юнит (127.0.0.1:9100)"
cat > "${UNIT_FILE}" <<'EOF'
[Unit]
Description=Node Exporter (centralized monitoring, localhost only)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=node_exporter
Group=node_exporter
ExecStart=/usr/local/bin/node_exporter --web.listen-address=127.0.0.1:9100
Restart=on-failure
RestartSec=5s
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=yes
PrivateTmp=yes

[Install]
WantedBy=multi-user.target
EOF

id -r node_exporter &>/dev/null || useradd --no-create-home --shell /usr/sbin/nologin --system node_exporter

systemctl daemon-reload
systemctl enable --now node-exporter

echo "→ Проверяю..."
sleep 2
systemctl --no-pager --lines=5 status node-exporter || true

# Метрики должны быть доступны ТОЛЬКО на loopback.
if curl -fsS http://127.0.0.1:9100/metrics | head -1 | grep -q '^# HELP'; then
  echo "OK: node_exporter отвечает на 127.0.0.1:9100"
else
  echo "FAIL: node_exporter не отвечает на 127.0.0.1:9100 — см. journalctl -u node-exporter" >&2
  exit 1
fi

echo "Готово. Проверка прослушивания: ss -tlnp | grep 9100  (должен быть только 127.0.0.1)"
