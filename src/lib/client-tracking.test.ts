import { describe, it, expect, beforeEach, vi } from 'vitest';

// Клиентские хелперы трекинга v2 (ADR-014): ID (session/visitor/view),
// UTM-парсинг, lastNav, entry-пейлоад. Node-окружение: window/document стубаются.

import {
  toPageSlug,
  getSessionId,
  getVisitorId,
  parseUtmParams,
  readLastNav,
  writeLastNav,
  takeEntryPayload,
  isEntryAlreadySent,
  resolveSessionSource,
} from '@/lib/client-tracking';

type StorageStub = {
  data: Map<string, string>;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

function makeStorage(): StorageStub {
  return {
    data: new Map(),
    getItem(key: string) {
      return this.data.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      this.data.set(key, value);
    },
  };
}

describe('client-tracking v2 (ADR-014)', () => {
  let sessionStorage: StorageStub;
  let localStorage: StorageStub;

  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage = makeStorage();
    localStorage = makeStorage();
    vi.stubGlobal('window', {
      location: { hostname: 'эвакуация.online', search: '' },
      sessionStorage,
      localStorage,
    });
    vi.stubGlobal('document', { referrer: '' });
  });

  describe('toPageSlug', () => {
    it("'/' → 'home'", () => {
      expect(toPageSlug('/')).toBe('home');
    });

    it('сохраняет вложенный slug и обрезает до 100 символов', () => {
      expect(toPageSlug('/Uslugi/Legkie')).toBe('uslugi/legkie');
      expect(toPageSlug(`/${'a'.repeat(150)}`)).toHaveLength(100);
    });
  });

  describe('getSessionId (сессия вкладки)', () => {
    it('генерирует один раз и переиспользует (stable в рамках вкладки)', () => {
      const first = getSessionId();
      const second = getSessionId();
      expect(first).toBe(second);
      expect(first).toMatch(/^[a-zA-Z0-9_-]{8,64}$/);
    });

    it('edge case: sessionStorage кидает → каждый вызов даёт валидный ID', () => {
      vi.stubGlobal('window', {
        sessionStorage: {
          getItem: () => {
            throw new Error('denied');
          },
          setItem: () => {
            throw new Error('denied');
          },
        },
      });
      expect(getSessionId()).toMatch(/^[a-zA-Z0-9_-]{8,64}$/);
    });
  });

  describe('getVisitorId (TTL 180 дней)', () => {
    it('генерирует и переиспользует из localStorage (happy path)', () => {
      expect(getVisitorId()).toBe(getVisitorId());
    });

    it('просроченный visitorId (> 180 дней) → новый ID (edge case)', () => {
      const first = getVisitorId();
      localStorage.data.set('track:vid:at', String(Date.now() - 181 * 24 * 60 * 60 * 1000));
      const second = getVisitorId();
      expect(second).not.toBe(first);
    });

    it('edge case: localStorage недоступен → валидный ID без throw', () => {
      vi.stubGlobal('window', {
        localStorage: {
          getItem: () => {
            throw new Error('denied');
          },
          setItem: () => {
            throw new Error('denied');
          },
        },
      });
      expect(getVisitorId()).toMatch(/^[a-zA-Z0-9_-]{8,64}$/);
    });
  });

  describe('parseUtmParams', () => {
    it('happy path: вытаскивает utm_source/medium/campaign', () => {
      expect(parseUtmParams('?utm_source=yandex&utm_medium=cpc&utm_campaign=summer')).toEqual({
        utmSource: 'yandex',
        utmMedium: 'cpc',
        utmCampaign: 'summer',
      });
    });

    it('edge case: спецсимволы санитизируются, пустые значения отбрасываются', () => {
      expect(parseUtmParams('?utm_source=ya%20ndex!&utm_medium=')).toEqual({
        utmSource: 'ya_ndex_',
        utmMedium: undefined,
        utmCampaign: undefined,
      });
    });

    it('edge case: пустая строка → пустой объект', () => {
      expect(parseUtmParams('')).toEqual({});
    });
  });

  describe('lastNav (from→to путь вкладки)', () => {
    it('write → read roundtrip (happy path)', () => {
      writeLastNav({ page: 'home', viewId: 'view-1', at: 123 });
      expect(readLastNav()).toEqual({ page: 'home', viewId: 'view-1', at: 123 });
    });

    it('edge case: битый JSON → null', () => {
      sessionStorage.data.set('track:lastNav', '{oops');
      expect(readLastNav()).toBeNull();
    });

    it('edge case: нет записи → null', () => {
      expect(readLastNav()).toBeNull();
    });
  });

  describe('takeEntryPayload (вход вкладки: источник + UTM)', () => {
    it('первый вызов несёт referrer+UTM и ставит флаг (happy path)', () => {
      vi.stubGlobal('window', {
        location: { hostname: 'эвакуация.online', search: '?utm_source=google' },
        sessionStorage,
        localStorage,
      });

      const payload = takeEntryPayload();
      expect(payload).toMatchObject({ referrer: '(direct)', utmSource: 'google' });
      expect(isEntryAlreadySent()).toBe(true);
    });

    it('isEntryAlreadySent: false до входа, true после', () => {
      expect(isEntryAlreadySent()).toBe(false);
      takeEntryPayload();
      expect(isEntryAlreadySent()).toBe(true);
    });
  });

  describe('resolveSessionSource (совместимость с ADR-002)', () => {
    it('внешний referrer → host без www', () => {
      vi.stubGlobal('document', { referrer: 'https://www.YANDEX.ru/search' });
      expect(resolveSessionSource()).toBe('yandex.ru');
    });

    it('свой сайт/прямой заход → (direct)', () => {
      // В реальном браузере location.hostname и referrer оба в punycode.
      vi.stubGlobal('document', { referrer: 'https://xn--80aae0ai8cwa4cza.online/politika' });
      vi.stubGlobal('window', {
        location: { hostname: 'xn--80aae0ai8cwa4cza.online', search: '' },
        sessionStorage,
        localStorage,
      });
      expect(resolveSessionSource()).toBe('(direct)');
    });
  });
});
