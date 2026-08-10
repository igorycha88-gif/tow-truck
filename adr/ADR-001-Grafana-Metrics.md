# ADR-001: Интеграция Grafana для бизнес-метрик

**Дата:** 2026-08-10
**Статус:** Proposed
**Контекст:** Требуется визуализация ключевых бизнес-метрик (посетители, заявки, клики по номеру) для мониторинга конверсии и операционной эффективности.

## Решение

Интегрировать Grafana через PostgreSQL datasource plugin для прямого доступа к данным из БД.

### Компоненты:
1. **ClickEvent** — новая таблица для логирования кликов по номеру телефона
2. **Grafana** — Docker контейнер с настроенным PostgreSQL datasource
3. **Nginx** — reverse proxy для доступа по `/grafana`
4. **PhoneClickTracker** — Client Component для отслеживания кликов

## Альтернативы

### Вариант А: PostgreSQL datasource plugin (рекомендован)
- **Плюсы:** Минимальный код, прямой доступ к данным, быстрая реализация
- **Минусы:** Требует передачи учетных данных PostgreSQL в Grafana
- **Оценка:** 8/10

### Вариант Б: JSON API datasource
- **Плюсы:** Больший контроль, возможность кэширования, безопасность (нет прямого доступа к БД)
- **Минусы:** Требует разработки API endpoints, больше кода
- **Оценка:** 6/10

### Вариант В: Prometheus exporter
- **Плюсы:** Стандарт для мониторинга, масштабируемость
- **Минусы:** Избыточно для проекта, добавляет сложность
- **Оценка:** 4/10

## Обоснование выбора

Вариант А chosen потому что:
1. MVP требует быстрой реализации
2. PostgreSQL уже развернут и доступен
3. Нет необходимости в дополнительной абстракции
4. Grafana native поддерживает PostgreSQL

## Влияние на архитектуру

### База данных
```sql
-- Новая таблица для логирования кликов
CREATE TABLE "ClickEvent" (
  id TEXT PRIMARY KEY DEFAULT cuid(),
  ip TEXT,
  "userAgent" TEXT,
  page TEXT DEFAULT 'home',
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_click_event_created_at ON "ClickEvent"("createdAt");
```

### API
```
GET /api/metrics — агрегированные метрики (для кэширования/дополнительных целей)
POST /api/click-event — логирование кликов
```

### Структура файлов
```
src/
├── app/
│   ├── api/
│   │   ├── metrics/route.ts
│   │   └── click-event/route.ts
├── services/
│   └── metricsService.ts
├── components/
│   └── phone-link/
│       └── PhoneClickTracker.tsx
└── lib/
    └── prisma.ts

docker-compose.dev.yml — добавить Grafana контейнер
docker-compose.yml — добавить Grafana контейнер (prod)
nginx/ — добавить конфиг для /grafana
```

### TypeScript-интерфейсы
```typescript
interface ClickEvent {
  id: string;
  ip?: string;
  userAgent?: string;
  page: string;
  createdAt: Date;
}

interface MetricsResponse {
  visitors: {
    today: number;
    week: number;
    month: number;
  };
  orders: {
    today: number;
    week: number;
    month: number;
    byStatus: Record<string, number>;
  };
  clicks: {
    today: number;
    week: number;
    month: number;
  };
}
```

## Риски и митигация

| Риск | Вероятность | Влияние | Митигация |
|------|-------------|---------|-----------|
| Утечка учетных данных PostgreSQL | Низкое | Высокое | Использовать отдельного пользователя с ограниченными правами |
| Замедление БД запросами Grafana | Среднее | Среднее | Индексы, materialized views, ограничение частоты обновления |
| Безопасность Grafana | Среднее | Высокое | Базовая аутентификация + Nginx + HTTPS |
| Размер данных ClickEvent | Низкое | Низкое | Очистка старых записей (cron job) |

## Критерии успеха

- [ ] Grafana доступна по `https://эвакуация.online/grafana`
- [ ] Дашборд показывает: посетители, заявки (по статусам), клики
- [ ] Авто-обновление каждую минуту
- [ ] Базовая аутентификация работает
- [ ] Клики по номеру логируются в ClickEvent
- [ ] Не влияет на производительность основного API