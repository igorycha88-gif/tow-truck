// Клиентские хелперы трекинга v2 (браузер, ADR-014). Общий источник сессии
// для визитов и событий кликов (ЧТЗ §2.1/§2.2): host document.referrer входной
// страницы сессии; свой сайт / прямой заход → (direct).
//
// Анонимные ID (не ПД, 152-ФЗ ок): sessionId — сессия вкладки (sessionStorage);
// visitorId — постоянный ID посетителя (localStorage, TTL 180 дней);
// viewId — на каждый просмотр страницы (генерируется трекером).

import { DIRECT_SOURCE } from '@/lib/referer';

const SOURCE_KEY = 'track:source';
const SESSION_ID_KEY = 'track:sid';
const VISITOR_ID_KEY = 'track:vid';
const VISITOR_AT_KEY = 'track:vid:at';
const LAST_NAV_KEY = 'track:lastNav';
const ENTRY_SENT_KEY = 'track:entry:sent';

export const VISITOR_TTL_MS = 180 * 24 * 60 * 60 * 1000; // 180 дней (ADR-014)

// slug страницы по pathname ('/' → 'home'), как в VisitTracker.
export function toPageSlug(pathname: string): string {
  const trimmed = pathname.replace(/^\//, '').replace(/\/+$/, '');
  if (!trimmed) return 'home';
  return trimmed.toLowerCase().replace(/[^a-z0-9/_-]/g, '_').slice(0, 100);
}

function randomId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    // crypto недоступен — fallback ниже.
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

// Сессия вкладки: один sessionId на вкладку (sessionStorage).
export function getSessionId(): string {
  try {
    const stored = window.sessionStorage.getItem(SESSION_ID_KEY);
    if (stored) return stored;
    const sid = randomId();
    window.sessionStorage.setItem(SESSION_ID_KEY, sid);
    return sid;
  } catch {
    // private mode: сессионный ID живёт в памяти страницы.
    return randomId();
  }
}

// Постоянный анонимный ID посетителя (localStorage, TTL 180 дней):
// новые/вернувшиеся считаются на сервере по visitorId.
export function getVisitorId(): string {
  try {
    const at = Number(window.localStorage.getItem(VISITOR_AT_KEY) || 0);
    const stored = window.localStorage.getItem(VISITOR_ID_KEY);
    if (stored && Date.now() - at < VISITOR_TTL_MS) {
      return stored;
    }
    const vid = randomId();
    window.localStorage.setItem(VISITOR_ID_KEY, vid);
    window.localStorage.setItem(VISITOR_AT_KEY, String(Date.now()));
    return vid;
  } catch {
    return randomId();
  }
}

export function getViewId(): string {
  return randomId();
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

// UTM-метки с посадочной URL вкладки: utm_source/utm_medium/utm_campaign,
// обрезка 100 симв., только [a-zA-Z0-9._-] (санитизация на сервере тоже есть).
export function parseUtmParams(search: string): {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
} {
  const result: { utmSource?: string; utmMedium?: string; utmCampaign?: string } = {};
  if (!search) return result;
  try {
    const params = new URLSearchParams(search);
    const pick = (key: string): string | undefined =>
      (params.get(key) || '')
        .trim()
        .slice(0, 100)
        .replace(/[^a-zA-Z0-9._-]/g, '_') || undefined;
    result.utmSource = pick('utm_source');
    result.utmMedium = pick('utm_medium');
    result.utmCampaign = pick('utm_campaign');
  } catch {
    // битый search — возвращаем пусто.
  }
  return result;
}

export type LastNav = { page: string; viewId: string; at: number };

export function readLastNav(): LastNav | null {
  try {
    const raw = window.sessionStorage.getItem(LAST_NAV_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LastNav;
    if (typeof parsed.page !== 'string' || typeof parsed.viewId !== 'string') return null;
    return { page: parsed.page, viewId: parsed.viewId, at: Number(parsed.at) || 0 };
  } catch {
    return null;
  }
}

export function writeLastNav(nav: LastNav): void {
  try {
    window.sessionStorage.setItem(LAST_NAV_KEY, JSON.stringify(nav));
  } catch {
    // private mode — путь сессии деградирует до single-page.
  }
}

// Входные данные (referrer+UTM) отправляются ровно одним beacon за вкладку.
export function takeEntryPayload(): { referrer: string } & ReturnType<typeof parseUtmParams> {
  const result = { referrer: resolveSessionSource(), ...parseUtmParams(window.location.search) };
  try {
    window.sessionStorage.setItem(ENTRY_SENT_KEY, '1');
  } catch {
    // ignore
  }
  return result;
}

export function isEntryAlreadySent(): boolean {
  try {
    return Boolean(window.sessionStorage.getItem(ENTRY_SENT_KEY));
  } catch {
    return false;
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
