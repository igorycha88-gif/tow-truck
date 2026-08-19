import { timingSafeEqual } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { logger } from '@/lib/logger';

// Проверка ключа X-Monitoring-Key для эндпоинтов /metrics/*
// (ЧТЗ «Централизованный мониторинг», §2 US-002).
//
// Основная граница аутентификации — nginx (deploy/nginx/monitoring-key.conf,
// map $metrics_auth, 403 без ключа). Здесь — защита на уровне приложения
// (defense in depth): если MONITORING_KEY задан в .env, требуется точное
// совпадение заголовка (timingSafeEqual — защита от timing-атак).
// Если MONITORING_KEY не задан — запрос разрешён (его уже проверил nginx),
// логируем предупреждение один раз. Ключ в логи НЕ попадает.

const MONITORING_KEY_HEADER = 'x-monitoring-key';

let warnedUnsetKey = false;

export function isMonitoringAuthorized(req: NextRequest): boolean {
  const expected = process.env.MONITORING_KEY;

  if (!expected) {
    if (!warnedUnsetKey) {
      warnedUnsetKey = true;
      logger.warn(
        'MONITORING_KEY is not set: /metrics/* is protected by nginx only',
        { operation: 'monitoringAuth.isAuthorized' },
      );
    }
    return true;
  }

  const provided = req.headers.get(MONITORING_KEY_HEADER) ?? '';
  return keysEqual(provided, expected);
}

function keysEqual(provided: string, expected: string): boolean {
  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length || a.length === 0) return false;
  return timingSafeEqual(a, b);
}

// Сброс one-time-флага предупреждения (для тестов).
export function __resetMonitoringAuthWarn(): void {
  warnedUnsetKey = false;
}
