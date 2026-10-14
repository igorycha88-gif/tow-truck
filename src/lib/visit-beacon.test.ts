import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Транспорт визитов v2 (ADR-014): enter/leave через sendBeacon-first +
// fetch-fallback (как click-beacon, ADR-012). Node-окружение: глобалы стубаются.

import { sendVisitBeacon } from '@/lib/visit-beacon';

const ENDPOINT = '/api/visit';

describe('sendVisitBeacon (ADR-014)', () => {
  let sendBeacon: ReturnType<typeof vi.fn>;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    sendBeacon = vi.fn();
    fetchMock = vi.fn();
    vi.stubGlobal('navigator', { sendBeacon });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('happy path: enter-пейлоад уходит через sendBeacon', async () => {
    sendBeacon.mockReturnValue(true);

    sendVisitBeacon({ type: 'enter', page: 'home', sessionId: 'sid-1', viewId: 'view-1' });

    expect(sendBeacon).toHaveBeenCalledTimes(1);
    expect(sendBeacon.mock.calls[0][0]).toBe(ENDPOINT);
    const blob = sendBeacon.mock.calls[0][1] as Blob;
    expect(blob.type).toBe('application/json');
    const body = JSON.parse(await blob.text());
    expect(body).toEqual({ type: 'enter', page: 'home', sessionId: 'sid-1', viewId: 'view-1' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('leave-пейлоад с dwellMs уходит через sendBeacon (переживает unload)', async () => {
    sendBeacon.mockReturnValue(true);

    sendVisitBeacon({ type: 'leave', viewId: 'view-1', dwellMs: 12_345 });

    const blob = sendBeacon.mock.calls[0][1] as Blob;
    expect(JSON.parse(await blob.text())).toEqual({ type: 'leave', viewId: 'view-1', dwellMs: 12_345 });
  });

  it('error case: sendBeacon false → fetch keepalive fallback', () => {
    sendBeacon.mockReturnValue(false);

    sendVisitBeacon({ type: 'leave', viewId: 'v1', dwellMs: 1 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(ENDPOINT);
    expect(init.method).toBe('POST');
    expect(init.keepalive).toBe(true);
  });

  it('edge case: sendBeacon бросает исключение → fetch fallback, без throw', () => {
    sendBeacon.mockImplementation(() => {
      throw new Error('overflow');
    });

    expect(() => sendVisitBeacon({ type: 'enter', page: 'home' })).not.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('edge case: fetch тоже бросает — исключение не прорывается (метрики некритичны)', () => {
    sendBeacon.mockReturnValue(false);
    fetchMock.mockImplementation(() => {
      throw new Error('network down');
    });

    expect(() => sendVisitBeacon({ type: 'enter', page: 'home' })).not.toThrow();
  });
});
