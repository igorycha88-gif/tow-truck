// Транспорт визитов v2 (ADR-014): enter на каждую навигацию, leave на уход.
// sendBeacon — основной канал (переживает unload, важно для leave);
// fallback — fetch keepalive (как click-beacon, ADR-012).

const ENDPOINT = '/api/visit';

export function sendVisitBeacon(payload: Record<string, unknown>): void {
  const body = JSON.stringify(payload);

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
    // Метрики — некритичны для UX, ошибки отправки игнорируются (ADR-002/014).
  }
}
