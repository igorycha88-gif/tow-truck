#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────
# Выпуск SSL-сертификата Let's Encrypt для домена эвакуация.online
# ─────────────────────────────────────────────────────────────────────
# Запускать НА VPS (под root / sudo):
#   sudo bash setup-ssl.sh
#
# Что делает:
#   1. Проверяет наличие nginx + certbot.
#   2. Создаёт webroot для ACME challenge.
#   3. Деплоит минимальный HTTP-сервер (если ещё нет) для прохождения challenge.
#   4. Выпускает сертификат на apex + www через `certbot --nginx --redirect`.
#   5. Проверяет статус реновации (systemd timer).
#
# Требования ДО запуска:
#   - DNS: A-запись эвакуация.online  и www.эвакуация.online → IP VPS.
#   - nginx установлен и слушает :80.
# ─────────────────────────────────────────────────────────────────────
set -euo pipefail

DOMAIN="эвакуация.online"
DOMAIN_WWW="www.эвакуация.online"
EMAIL="${CERTBOT_EMAIL:-boronind1m@yandex.ru}"
WEBROOT="/var/www/letsencrypt"

# Цветной вывод.
log()  { printf '\033[1;32m[setup-ssl]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[setup-ssl]\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[1;31m[setup-ssl ERROR]\033[0m %s\n' "$*" >&2; exit 1; }

# ── 1. Зависимости ──
log "Проверка зависимостей..."
command -v nginx  >/dev/null || die "nginx не установлен. Установите: apt-get install -y nginx"
command -v certbot>/dev/null || die "certbot не установлен. Установите: apt-get install -y certbot python3-certbot-nginx"

# ── 2. Webroot для ACME ──
log "Создание webroot ${WEBROOT}..."
mkdir -p "${WEBROOT}"
chmod 755 "${WEBROOT}"

# ── 3. Минимальный HTTP-сервер для первого прохождения challenge ──
# Выпускаем сертификат ДО применения основного proxy-конфига (где уже HTTPS).
# certbot --nginx сам добавит server-блок с SSL и redirect.
if [ ! -f "/etc/nginx/conf.d/evakuaciya-upstream.conf" ]; then
    log "Копирую upstream-конфиг..."
    cp -n "$(dirname "$0")/evakuaciya-upstream.conf" /etc/nginx/conf.d/ 2>/dev/null || true
fi

# Временный минимальный HTTP-сервер (только для bootstrap), если основного ещё нет.
if ! nginx -T 2>/dev/null | grep -q "server_name ${DOMAIN}"; then
    log "Создаю временный HTTP-server для ACME challenge..."
    cat > /etc/nginx/conf.d/evakuaciya-bootstrap.conf <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN} ${DOMAIN_WWW};
    location ^~ /.well-known/acme-challenge/ {
        root ${WEBROOT};
        default_type "text/plain";
    }
}
EOF
    nginx -t || die "nginx -t упал на bootstrap-конфиге"
    systemctl reload nginx
fi

# ── 4. Выпуск сертификата (--nginx сам пропишет SSL + redirect) ──
log "Выпуск сертификата для ${DOMAIN} и ${DOMAIN_WWW}..."
certbot --nginx \
    -d "${DOMAIN}" -d "${DOMAIN_WWW}" \
    --redirect \
    --agree-tos \
    --no-eff-email \
    -m "${EMAIL}" \
    --non-interactive

log "Сертификат выпущен. Пути:"
log "  /etc/letsencrypt/live/${DOMAIN}/fullchain.pem"
log "  /etc/letsencrypt/live/${DOMAIN}/privkey.pem"

# ── 5. Применяем финальный production server-блок ──
log "Применяем финальный server-блок evakuaciya-online.conf..."
cp -f "$(dirname "$0")/evakuaciya-online.conf" /etc/nginx/conf.d/
cp -f "$(dirname "$0")/evakuaciya-map.conf"     /etc/nginx/conf.d/

# Удаляем bootstrap (больше не нужен — финальный конфиг содержит :80 redirect).
rm -f /etc/nginx/conf.d/evakuaciya-bootstrap.conf

nginx -t || die "nginx -t упал на финальном конфиге — проверьте /etc/nginx/conf.d/"
systemctl reload nginx

# ── 6. Реновация (timer) ──
log "Проверка timer реновации..."
systemctl enable --now certbot.timer 2>/dev/null || warn "certbot.timer не найден — настройте cron: 0 3 * * * certbot renew --quiet --deploy-hook 'systemctl reload nginx'"

# ── 7. Финальная проверка ──
log "Проверка HTTPS..."
sleep 2
curl -sfI --max-time 10 "https://${DOMAIN}/" | head -5 || warn "curl https://${DOMAIN} не ответил — проверьте DNS/SSL"
curl -sf   --max-time 10 "https://${DOMAIN}/api/health" || warn "/api/health не ответил (приложение ещё не запущено?)"

log "✅ SSL настроен для https://${DOMAIN}"
