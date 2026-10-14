import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Транспорт кликов (ЧТЗ_Фикс_трекинга_кликов_tel): sendBeacon-first + fetch-fallback.
// ADR-014: в payload добавлен sessionId (связка клика с сессией вкладки).
// Node-окружение: navigator/fetch/globalThis.window стубаются глобально.

import { sendClickBeacon } from '@/lib/click-beacon';

const ENDPOINT = '/api/click-event';

const SESSION_ID_RE = /^[a-zA-Z0-9_-]{8,64}$/;

function lastBeaconBody(sendBeacon: ReturnType<typeof vi.fn>): Promise<unknown> {
  const blob = sendBeacon.mock.calls[0][1] as Blob;
  return blob.text().then((t) => JSON.parse(t));
}

describe('sendClickBeacon', () => {
  let sendBeacon: ReturnType<typeof vi.fn>;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    sendBeacon = vi.fn();
    fetchMock = vi.fn();
    vi.stubGlobal('navigator', { sendBeacon });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('window', {
      location: { hostname: 'эвакуация.online', pathname: '/' },
      sessionStorage: {
        getItem: vi.fn(() => null),
        setItem: vi.fn(),
      },
    });
    vi.stubGlobal('document', { referrer: '' });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('happy path: отправляет через sendBeacon и не зовёт fetch', async () => {
    sendBeacon.mockReturnValue(true);

    sendClickBeacon({ eventType: 'click_phone', page: 'home' });

    expect(sendBeacon).toHaveBeenCalledTimes(1);
    expect(sendBeacon.mock.calls[0][0]).toBe(ENDPOINT);
    const blob = sendBeacon.mock.calls[0][1] as Blob;
    expect(blob.type).toBe('application/json');
    const body = (await lastBeaconBody(sendBeacon)) as Record<string, unknown>;
    expect(body).toMatchObject({ eventType: 'click_phone', page: 'home', referrer: '(direct)' });
    // ADR-014: sessionId обязателен в payload (uuid-подобный).
    expect(typeof body.sessionId).toBe('string');
    expect(String(body.sessionId)).toMatch(SESSION_ID_RE);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('error case: sendBeacon вернул false → fetch keepalive fallback', () => {
    sendBeacon.mockReturnValue(false);

    sendClickBeacon({ eventType: 'click_phone', page: 'floating_call' });

    expect(sendBeacon).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(ENDPOINT);
    expect(init.method).toBe('POST');
    expect(init.keepalive).toBe(true);
    const body = JSON.parse(init.body) as Record<string, unknown>;
    expect(body).toMatchObject({ eventType: 'click_phone', page: 'floating_call', referrer: '(direct)' });
    expect(String(body.sessionId)).toMatch(SESSION_ID_RE);
  });

  it('error case: sendBeacon бросил исключение → fetch fallback', () => {
    sendBeacon.mockImplementation(() => {
      throw new Error('beacon queue overflow');
    });

    sendClickBeacon({ eventType: 'service_click', page: 'home', service: 'evakuator-legkovyh' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body) as Record<string, unknown>;
    expect(body).toMatchObject({
      eventType: 'service_click',
      page: 'home',
      service: 'evakuator-legkovyh',
      referrer: '(direct)',
    });
  });

  it('edge case: sendBeacon отсутствует → fetch fallback', () => {
    vi.stubGlobal('navigator', {});

    sendClickBeacon({ eventType: 'click_phone', page: 'header' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1].keepalive).toBe(true);
  });

  it('edge case: fetch тоже бросает — исключение не прорывается наружу', () => {
    sendBeacon.mockReturnValue(false);
    fetchMock.mockImplementation(() => {
      throw new Error('network down');
    });

    expect(() => sendClickBeacon({ eventType: 'click_phone', page: 'home' })).not.toThrow();
  });

  it('edge case: sendBeacon есть, navigator нет (защита от undefined)', () => {
    vi.stubGlobal('navigator', undefined);

    sendClickBeacon({ eventType: 'click_phone', page: 'home' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
