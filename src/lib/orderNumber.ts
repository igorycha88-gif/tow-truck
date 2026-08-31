// Читаемый номер заявки (ADR-013): ГГГГММДД-N, дата по Москве (Europe/Moscow).
// Пример: formatOrderNumber(new Date('2026-08-30T22:30:00Z'), 5) → '20260830-5'
// (22:30 UTC = 01:30 мск 31-го → дата берётся по московскому времени).

const MOSCOW_UTC_OFFSET_MS = 3 * 60 * 60 * 1000; // UTC+3, без DST

export function formatOrderNumber(createdAt: Date, number: number): string {
  // Сдвигаем дату в Москву и берём компоненты UTC сдвинутой даты.
  const moscow = new Date(createdAt.getTime() + MOSCOW_UTC_OFFSET_MS);
  const y = moscow.getUTCFullYear();
  const m = String(moscow.getUTCMonth() + 1).padStart(2, '0');
  const d = String(moscow.getUTCDate()).padStart(2, '0');
  return `${y}${m}${d}-${number}`;
}
