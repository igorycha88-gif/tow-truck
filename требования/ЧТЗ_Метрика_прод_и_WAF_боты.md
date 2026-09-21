# ЧТЗ: Метрика на проде + WAF allow-list для Яндекс-ботов и мониторинга

- **Дата:** 2026-09-21
- **Домен:** эвакуация.online (прод, VPS 178.57.218.204)
- **Маршрутизация:** Разработчик → Тестировщик → DevOps
- **Тип:** инфраструктурно-конфигурационная (изменений БД/API нет)

## 1. Проблема

1. **Сайт «слепой»:** счётчик Яндекс.Метрики 111456265 существует, но код на проде
   не рендерится — в HTML нет `mc.yandex.ru` (проверено curl'ом 2026-09-21).
   Причина: код счётчика уже реализован (`src/lib/seo/metrika.ts`, `src/app/layout.tsx`
   по ЧТЗ_Яндекс_Метрика.md), но на проде отсутствует env `NEXT_PUBLIC_METRIKA_ID`
   (прод берёт env из `/root/tow-truck/.env` на VPS через `--env-file` в
   `deploy/blue-green-deploy.sh`). В `docker-compose.dev.yml` ID уже прописан.
2. **Риск WAF:** карта `$blocked_agent` (deploy/nginx/evakuaciya-protection.conf)
   блокирует сканерские UA (python-httpx, go-http-client → 403 подтверждён live-тестом).
   Яндекс-боты сейчас проходят (200), но в карте НЕТ явных приоритетных разрешений:
   один неудачный будущий паттерн в блок-листе — и боты Яндекса получат 403
   (риск повторного падения позиций). Мониторинговые UA на go-http-client/python-httpx
   блокируются.

## 2. Решение

### TASK-INF-001: Метрика на проде (runtime env)

- В `.env.example` заполнить `NEXT_PUBLIC_METRIKA_ID=111456265` (документация значения).
- Технически: `layout.tsx` — Server Component, `process.env.NEXT_PUBLIC_METRIKA_ID`
  читается при SSR в рантайме → достаточно env на VPS, пересборка образа НЕ нужна.
- На VPS: добавить `NEXT_PUBLIC_METRIKA_ID=111456265` в `/root/tow-truck/.env`
  и пересоздать контейнер `tow-truck-app` (docker rm + docker run с тем же образом
  и env-file, скопировать параметры из работающего контейнера).

### TASK-INF-002: WAF allow-list поверх блок-листа

- `deploy/nginx/evakuaciya-protection.conf`: в map `$blocked_agent` ДО блок-паттернов
  добавить явные разрешения (значение `0`; nginx map — first-match-wins):
  - Яндекс (все краулеры содержат «Yandex» либо «YaDirect»): `~*yandex`, `~*yadirect`;
  - Поисковики: `~*googlebot`, `~*google-inspectiontool`, `~*bingbot`, `~*duckduckbot`,
    `~*mail\.ru_bot` (совпадает по «Mail.RU_Bot»), `~*applebot`, `~*baiduspider`;
  - Мониторинг: `~*uptimerobot|uptimebot`, `~*checkhost`, `~*pingdom`,
    `~*host-tracker`, `~*statuscake`, `~*uptime-kuma`, `~*betteruptime`.
- Блок-лист сканеров (nuclei, sqlmap, semrushbot и пр.) остаётся без изменений.
- На VPS: scp конфига → `nginx -t` → reload.

### TASK-QA-003: Автотест конфига WAF

- Vitest `deploy/nginx/protection-conf.test.ts` (или рядом с tests/): парсит conf и
  проверяет: (а) allow-паттерны стоят раньше любого блок-паттерна; (б) присутствуют
  ключевые allow (yandex, yadirect, googlebot, мониторинги); (в) блок-лист сканеров
  не пуст; (г) счётчик ID в dev-compose/env.example совпадает (111456265).

## 3. Критерии приёмки

1. `curl -s https://эвакуация.online/ | grep mc.yandex.ru` → содержит
   `tag.js?id=111456265` и noscript-пиксель `watch/111456265`.
2. Live: UA YandexBot/YandexMetrika/YandexWebmaster/YandexDirect/YaDirectFetcher → 200.
3. Live: UA python-httpx/nuclei/sqlmap → 403 (защита не ослаблена).
4. `nginx -t` на VPS — OK.
5. `npm run test && npm run lint && npx tsc --noEmit` — зелёные.
6. Метрика в интерфейсе metrika.yandex.ru начинает получать визиты («счётчик онлайн»).

## 4. Файлы

| Файл | Изменение |
|------|-----------|
| `.env.example` | `NEXT_PUBLIC_METRIKA_ID="111456265"` |
| `deploy/nginx/evakuaciya-protection.conf` | allow-правила в начале map |
| `deploy/nginx/protection-conf.test.ts` | новый автотест |

## 5. Риски

- env на VPS правится вручную (в git не попадает — секреты/окружение); фиксация —
  в CHANGELOG и инструкции деплоя.
- Reload nginx безопасен (не drop соединений); `nginx -t` перед reload обязателен.
