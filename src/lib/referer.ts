// Источник трафика для бизнес-метрик (ЧТЗ_Сайт_эвакуация_online_Полные_
// Бизнес_Метрики.md §2.2): источник = host referer'а, прямой заход — (direct).
//
// Важно: заголовок Referer самого запроса /api/* всегда указывает на страницу
// сайта (same-origin fetch), поэтому источник сессии вычисляет клиент из
// document.referrer (см. lib/client-tracking.ts) и передаёт в теле запроса.

export const DIRECT_SOURCE = '(direct)';
export const SOURCE_LABEL_MAX = 100;

// Санитизация метки источника на сервере: null/пусто/мусор → (direct),
// приводится к host-подобному виду (голый host или URL), www-префикс срезается.
// Чистая функция (unit-тестируемая), используется в metricsService.
export function sanitizeSourceLabel(label: string | null | undefined): string {
  if (label === null || label === undefined) return DIRECT_SOURCE;

  const trimmed = label.trim().toLowerCase().slice(0, SOURCE_LABEL_MAX);
  if (!trimmed) return DIRECT_SOURCE;
  if (trimmed === DIRECT_SOURCE) return DIRECT_SOURCE;

  return extractHost(trimmed) ?? DIRECT_SOURCE;
}

function extractHost(raw: string): string | null {
  try {
    // Клиент может прислать как голый host, так и полный URL (защита).
    const url = raw.includes('://') ? new URL(raw) : new URL(`http://${raw}`);
    const host = url.hostname.replace(/^www\./, '');
    return /^[a-z0-9.-]+$/.test(host) ? host : null;
  } catch {
    return null;
  }
}
