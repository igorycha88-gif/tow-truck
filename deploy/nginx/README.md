# Nginx + SSL для прода «Эвакуация» (домен эвакуация.online)

Production reverse-proxy и HTTPS (Let's Encrypt) для домена
**`эвакуация.online`** (IDN, Punycode: `xn--80akhbyknj4f.online`).

## Файлы

| Файл | Назначение | Куда на VPS |
|------|------------|-------------|
| `evakuaciya-upstream.conf` | Blue-Green upstream `app` → 127.0.0.1:3001 (PROD/BLUE) | `/etc/nginx/conf.d/` |
| `evakuaciya-map.conf` | `map $http_upgrade $connection_upgrade` (http-контекст) | `/etc/nginx/conf.d/` |
| `evakuaciya-online.conf` | Server-блоки: http→https, www→apex, SSL proxy | `/etc/nginx/conf.d/` |
| `setup-ssl.sh` | Выпуск SSL через certbot + применение финального конфига | запустить на VPS |

## Что реализовано

- **HTTP → HTTPS**: `301` редирект всего трафика c `:80` на `https://эвакуация.online`.
- **www → apex**: `https://www.эвакуация.online` → `301` → `https://эвакуация.online`.
- **SSL**: Let's Encrypt, общий сертификат на apex + www, авто-редирект, HSTS preload.
- **Reverse proxy**: `proxy_pass http://app;` на Blue-Green upstream (3001 prod / 3003 green),
  проброс `Host`/`X-Real-IP`/`X-Forwarded-*`, WebSocket upgrade (для Next.js).
- **Security headers**: HSTS, `X-Content-Type-Options`, `X-Frame-Options SAMEORIGIN`, `Referrer-Policy`.
- **gzip**: text/css/js/json/xml/svg.
- **Логи**: `/var/log/nginx/evakuaciya-online.{access,error}.log`.

---

## Предварительные требования (на VPS)

1. **DNS** (обязательно до выпуска SSL — иначе ACME challenge провалится):
   - `эвакуация.online` → A-запись → `<VPS_IP>`
   - `www.эвакуация.online` → A-запись → `<VPS_IP>`
   - Проверить: `dig эвакуация.online +short`, `dig www.эвакуация.online +short`
2. **nginx** установлен: `apt-get install -y nginx`
3. **certbot** + nginx-плагин: `apt-get install -y certbot python3-certbot-nginx`
4. **:80 свободен** (никакой другой сервер не занял порт).
5. Приложение запущено на `127.0.0.1:3001` (см. `SKILL_DEVOPS_PROD.md`).

---

## Порядок применения (на VPS, под root)

> Все команды выполнять на VPS. Файлы из `deploy/nginx/` скопировать на сервер любым
> способом (git pull / scp).

### Способ 1 — Автоматический (рекомендуется)

```bash
# Из корня проекта (где лежит deploy/) на VPS:
cd deploy/nginx

# 1. Установить email для Let's Encrypt (или оставить дефолт boronind1m@yandex.ru):
export CERTBOT_EMAIL="boronind1m@yandex.ru"

# 2. Запустить единый скрипт:
sudo bash setup-ssl.sh
```

Скрипт: деплоит upstream, создаёт временный HTTP-server, выпускает сертификат
(`certbot --nginx --redirect`), применяет финальный server-блок, включает timer реновации,
проверяет `https://эвакуация.online/api/health`.

### Способ 2 — Вручную (пошагово)

```bash
# 1. Копируем upstream + map в conf.d.
sudo cp evakuaciya-upstream.conf /etc/nginx/conf.d/
sudo cp evakuaciya-map.conf     /etc/nginx/conf.d/
sudo nginx -t && sudo systemctl reload nginx

# 2. Webroot для ACME.
sudo mkdir -p /var/www/letsencrypt && sudo chmod 755 /var/www/letsencrypt

# 3. Временный HTTP-server (для первого прохождения challenge).
sudo tee /etc/nginx/conf.d/evakuaciya-bootstrap.conf > /dev/null <<'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name эвакуация.online www.эвакуация.online;
    location ^~ /.well-known/acme-challenge/ {
        root /var/www/letsencrypt;
        default_type "text/plain";
    }
}
EOF
sudo nginx -t && sudo systemctl reload nginx

# 4. Выпуск сертификата (--nginx сам добавит SSL-блок и redirect).
sudo certbot --nginx -d эвакуация.online -d www.эвакуация.online \
    --redirect --agree-tos --no-eff-email -m boronind1m@yandex.ru

# 5. Применяем финальный server-блок, удаляем bootstrap.
sudo cp evakuaciya-online.conf /etc/nginx/conf.d/
sudo rm -f /etc/nginx/conf.d/evakuaciya-bootstrap.conf
sudo nginx -t && sudo systemctl reload nginx

# 6. Timer реновации.
sudo systemctl enable --now certbot.timer
```

---

## Проверка (после применения)

```bash
# HTTP → HTTPS редирект.
curl -sI http://эвакуация.online/ | head -3            # → 301 https://эвакуация.online/

# www → apex редирект.
curl -sI https://www.эвакуация.online/ | head -3       # → 301 https://эвакуация.online/

# Apex + healthcheck + SSL.
curl -sI https://эвакуация.online/ | head -3           # → HTTP/2 200
curl -s  https://эвакуация.online/api/health           # → {"status":"ok",...}

# Срок действия сертификата.
sudo certbot certificates
```

---

## Blue-Green переключение во время деплоя

Серверный блок домена править НЕ нужно — он проксирует на upstream `app`.
Меняется только `evakuaciya-upstream.conf` (см. `SKILL_DEVOPS_PROD.md → DEPLOY`):

```bash
# Переключить трафик на GREEN (3003).
echo "upstream app { server 127.0.0.1:3003; keepalive 32; }" \
  | sudo tee /etc/nginx/conf.d/evakuaciya-upstream.conf
sudo nginx -t && sudo nginx -s reload

# После cleanup вернуть на PROD (3001).
echo "upstream app { server 127.0.0.1:3001; keepalive 32; }" \
  | sudo tee /etc/nginx/conf.d/evakuaciya-upstream.conf
sudo nginx -t && sudo nginx -s reload
```

---

## Реновация сертификата

Автоматически через systemd timer (`certbot.timer`). Deploy-hook на reload nginx:

```bash
# Проверить timer:
sudo systemctl list-timers certbot.timer

# Тест реновации (dry-run):
sudo certbot renew --dry-run
```

При отсутствии timer — cron:
```cron
0 3 * * * certbot renew --quiet --deploy-hook 'systemctl reload nginx'
```

---

## Откат

```bash
# Удалить server-блоки домена (upstream оставить для приложения).
sudo rm /etc/nginx/conf.d/evakuaciya-online.conf
sudo rm /etc/nginx/conf.d/evakuaciya-map.conf
sudo nginx -t && sudo systemctl reload nginx

# Отозвать сертификат (если нужно):
sudo certbot delete --cert-name эвакуация.online
```
