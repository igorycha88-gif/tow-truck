// Клиентские хелперы трекинга (браузер). Общий источник сессии для визитов
// и событий кликов (ЧТЗ §2.1/§2.2): host document.referrer входной страницы
// сессии; свой сайт / прямой заход → (direct).

import { DIRECT_SOURCE } from '@/lib/referer';

const SOURCE_KEY = 'track:source';
const SOURCE_SENT_KEY = 'track:source:sent';

// slug страницы по pathname ('/' → 'home'), как в VisitTracker.
export function toPageSlug(pathname: string): string {
  const trimmed = pathname.replace(/^\//, '').replace(/\/+$/, '');
  if (!trimmed) return 'home';
  return trimmed.toLowerCase().replace(/[^a-z0-9/_-]/g, '_').slice(0, 100);
}

// Источник сессии: вычисляется один раз за сессию браузера (sessionStorage),
// при первом обращении — из document.referrer текущей (входной) страницы.
export function resolveSessionSource(): string {
  try {
    const stored = window.sessionStorage.getItem(SOURCE_KEY);
    if (stored) return stored;
  } catch {
    // private mode: считаем без persisted-кэша
  }

  const source = computeSourceFromReferrer();
  try {
    window.sessionStorage.setItem(SOURCE_KEY, source);
  } catch {
    // ignore
  }
  return source;
}

// Отправлялся ли уже источник с визитом входной страницы (для VisitTracker):
// ровно один beacon за сессию несёт referrer.
export function markSourceSent(): boolean {
  try {
    if (window.sessionStorage.getItem(SOURCE_SENT_KEY)) return false;
    window.sessionStorage.setItem(SOURCE_SENT_KEY, '1');
    return true;
  } catch {
    // sessionStorage недоступен — отправляем источник без флага.
    return true;
  }
}

function computeSourceFromReferrer(): string {
  try {
    if (!document.referrer) return DIRECT_SOURCE;
    const ref = new URL(document.referrer);
    const host = ref.hostname.toLowerCase().replace(/^www\./, '');
    const own = window.location.hostname.toLowerCase().replace(/^www\./, '');
    if (!host || host === own) return DIRECT_SOURCE;
    return host;
  } catch {
    return DIRECT_SOURCE;
  }
}
