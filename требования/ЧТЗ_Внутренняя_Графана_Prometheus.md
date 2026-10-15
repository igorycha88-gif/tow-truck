# ЧТЗ: Внутренняя Grafana — бизнес-метрики как во внешнем мониторинге (Prometheus)

## Версия: 1.1
## Дата: 2026-10-15
## Автор: AI-Аналитик
## Приоритет: Medium
## Статус: Active
## ADR: — (конфигурационная задача + 1 файл кода)

> **Изменения v1.1 (2026-10-15):** панели лидов/конверсии/WhatsApp убраны
> из обоих дашбордов; воронка — 3 стадии (без lead). В Postgres-дашборд
> добавлены: «Последние переходы (входы на сайт)» с датой/временем МСК,
> «Клики по телефону (по часам, 72ч)», «Последние клики по телефону»
> (дата/время МСК). См. `ЧТЗ_Уборка_метрик_заявок_WhatsApp_время_кликов.md`.

---

## 1. Цель

Внутренняя (dev) Grafana по адресу http://localhost:3031/grafana показывает те же
`business_*`-метрики, что получает внешний централизованный мониторинг из
`GET /metrics/tracking` — в виде дашборда на Prometheus-датасорсе. Это даёт:
точное зеркало внешнего представления (проверка панельного ЧТЗ до передачи
владельцу мониторинга) + локальную историю метрик.

## 2. Решение (согласованные дефолты)

1. **Контейнер Prometheus** в `docker-compose.dev.yml` (только dev, в prod-стек
   не добавлять — там внешний мониторинг): скрейп `http://app:3000/metrics/tracking`
   каждые 60 с, retention 15 дней, порт наружу НЕ публикуется.
2. **Авторизация скрейпа**: Prometheus поддерживает только `Authorization: Bearer`.
   В `monitoring-auth.ts` добавляется Bearer-алиас той же проверки
   (timingSafeEqual). Безопасность не ослабляется: в prod внешний путь идёт через
   nginx, который требует `X-Monitoring-Key` — Bearer извне недоступен.
3. **Ключ в конфиге**: шаблон `prometheus/prometheus.tpl.yml` с плейсхолдером
   `__MONITORING_KEY__`; при старте контейнера sed подставляет env `MONITORING_KEY`
   (ключ 64 hex — спецсимволов нет). Пустой ключ → middleware пропускает (dev).
4. **Grafana provisioning**: датасорс `prometheus-business`
   (`grafana/provisioning/datasources/prometheus.yml`), дашборд
   `grafana/dashboards/business-prometheus.json` (uid `evakuaciya-business-prometheus`).

## 3. Дашборд (зеркало внешних панелей)

| Ряд | Панели |
|---|---|
| Статы | Сессии 24ч/7д, Посетители 24ч/7д, Просмотры 24ч, Активные сейчас |
| Графики | Сессии/просмотры (24ч); Отказы (24ч/7д) |
| Клики | Телефон 12ч/7д (timeseries + stats) |
| Воронка | Bar gauge: funnel_24h и funnel_7d по 3 стадиям (visit/content_view/contact_click) |
| Путь | Таблицы: landing 24ч, переходы from→to, входные потоки, exit; устройства (pie) |
| Разрезы | Таблицы: источники, города, услуги; возвращающиеся, глубина, время на стр., топ-dwell |

ПромQL-особенность: `*_event`-метрики с историческими timestamp'ами старше 10 мин
Prometheus отбрасывает — панели кликов строятся на window-гейджах (12h/7d).

## 4. Декомпозиция

| ID | Задача |
|---|---|
| TASK-BCK-001 | monitoring-auth: Bearer-алиас + тесты |
| TASK-INF-001 | prometheus.tpl.yml + сервис в docker-compose.dev.yml |
| TASK-INF-002 | Датасорс prometheus-business + дашборд business-prometheus.json |

## 5. Критерии приёмки

1. `docker compose ps`: все сервисы healthy, включая prometheus.
2. `/-/ready` = 200; targets: job `evakuaciya-business` UP
   (`up == 1`, без ошибок scrape).
3. В Grafana датасорс `prometheus-business` работает; дашборд
   «Бизнес-метрики (Prometheus)» рендерит панели (значения после 1–2 скрайпов).
4. Bearer с неверным ключом → 403; X-Monitoring-Key работает как раньше (ретресс).
5. `npm run test && npm run lint && npx tsc --noEmit` — зелёные.
6. Внешний контракт не изменён (nginx/X-Monitoring-Key не тронуты).

## 6. Не входит

- Прод-стек (docker-compose.yml) — без изменений.
- Алерты Prometheus — фаза 2 (при необходимости).
