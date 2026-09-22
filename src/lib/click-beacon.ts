// Транспорт событий кликов (ADR-012, ЧТЗ_Фикс_трекинга_кликов_tel 22.09.2026).
// sendBeacon — основной канал: переживает unload при хендоффе tel: в диалер
// (fetch keepalive гибнет вместе со страницей на мобильных). Fallback — fetch.

import { resolveSessionSource } from '@/lib/client-tracking';

const ENDPOINT = '/api/click-event';

export function sendClickBeacon(payload: Record<string, unknown>): void {
  const body = JSON.stringify({ ...payload, referrer: resolveSessionSource() });

  try {
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([body], { type: 'application/json' });
      if (navigator.sendBeacon(ENDPOINT, blob)) return;
    }
  } catch {
    // sendBeacon недоступен/отказал — уходим в fetch-fallback.
  }

  try {
    void fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    });
  } catch {
    // Метрики — некритичны для UX, ошибки отправки игнорируются (ADR-012).
  }
}
