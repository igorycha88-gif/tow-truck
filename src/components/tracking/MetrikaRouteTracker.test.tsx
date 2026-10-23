// @vitest-environment happy-dom
// Тесты MetrikaRouteTracker (ЧТЗ_Яндекс_SEO_доработка_2026-10, TASK-Я-01):
// init с defer:true не шлёт просмотр сам — трекер отправляет ровно один hit
// на первый рендер, +1 на смену pathname (с referer предыдущей страницы)
// и 0 на повторный рендер с тем же pathname.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';

const usePathnameMock = vi.fn<(path?: string) => string>();
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
vi.mock('next/navigation', () => ({
  usePathname: (...args: unknown[]) => usePathnameMock(...(args as [path?: string])),
}));

import { MetrikaRouteTracker } from '@/components/tracking/MetrikaRouteTracker';

type YmMock = ReturnType<typeof vi.fn>;
let ym: YmMock;
let container: HTMLElement | null;
let root: Root | null;

const hitCalls = (mock: YmMock): unknown[][] =>
  mock.mock.calls.filter((c) => c[1] === 'hit');

const render = () => {
  act(() => {
    root!.render(React.createElement(MetrikaRouteTracker));
  });
};

beforeEach(() => {
  process.env.NEXT_PUBLIC_METRIKA_ID = '111456265';
  ym = vi.fn();
  (window as unknown as { ym: unknown }).ym = ym;
  usePathnameMock.mockReset();
  window.history.pushState({}, '', '/');
  document.title = 'Тестовая страница';
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root!.unmount();
  });
  container?.remove();
  delete (window as unknown as { ym?: unknown }).ym;
  delete process.env.NEXT_PUBLIC_METRIKA_ID;
});

describe('components.tracking.MetrikaRouteTracker (TASK-Я-01)', () => {
  it('первый рендер — ровно один hit с абсолютным URL (happy path)', () => {
    usePathnameMock.mockReturnValue('/');
    render();
    const calls = hitCalls(ym);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.[0]).toBe(111456265);
    expect(calls[0]?.[2]).toBe(window.location.href);
    expect(String(calls[0]?.[2])).toContain('http://');
    expect((calls[0]?.[3] as Record<string, unknown>)?.title).toBe(document.title);
  });

  it('повторный рендер с тем же pathname — 0 новых hit (edge case)', () => {
    usePathnameMock.mockReturnValue('/');
    render();
    render();
    expect(hitCalls(ym)).toHaveLength(1);
  });

  it('смена pathname — +1 hit с referer предыдущей страницы (happy path)', () => {
    usePathnameMock.mockReturnValue('/');
    render();
    const firstUrl = window.location.href;

    window.history.pushState({}, '', '/ceny');
    usePathnameMock.mockReturnValue('/ceny');
    render();

    const calls = hitCalls(ym);
    expect(calls).toHaveLength(2);
    expect(calls[1]?.[2]).toBe(window.location.href);
    expect((calls[1]?.[3] as Record<string, unknown>)?.referer).toBe(firstUrl);
  });

  it('без NEXT_PUBLIC_METRIKA_ID hit не отправляется (error case)', () => {
    delete process.env.NEXT_PUBLIC_METRIKA_ID;
    usePathnameMock.mockReturnValue('/');
    render();
    expect(hitCalls(ym)).toHaveLength(0);
  });

  it('отсутствие window.ym не ломает рендер (error case)', () => {
    delete (window as unknown as { ym?: unknown }).ym;
    usePathnameMock.mockReturnValue('/');
    expect(() => render()).not.toThrow();
  });
});
