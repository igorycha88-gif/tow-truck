// Определение устройства из User-Agent (ADR-014). Чистая функция без
// зависимостей — regex по конвенциям аналитики. null/пустой UA → 'unknown'.

export type Device = 'mobile' | 'tablet' | 'desktop' | 'unknown';

const MOBILE_RE = /Mobile|iPhone|iPod|Windows Phone|IEMobile|BlackBerry|Opera Mini|Opera Mobi/i;
const TABLET_RE = /iPad|Tablet|PlayBook|Silk|Kindle|Android(?!.*Mobile)/i;

export function detectDevice(userAgent: string | null | undefined): Device {
  if (!userAgent) return 'unknown';
  if (MOBILE_RE.test(userAgent)) return 'mobile';
  if (TABLET_RE.test(userAgent)) return 'tablet';
  return 'desktop';
}
