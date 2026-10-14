'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import {
  toPageSlug,
  getSessionId,
  getVisitorId,
  getViewId,
  readLastNav,
  writeLastNav,
  takeEntryPayload,
  isEntryAlreadySent,
  type LastNav,
} from '@/lib/client-tracking';
import { sendVisitBeacon } from '@/lib/visit-beacon';

// Трекинг пути клиента v2 (ADR-014): enter на каждую навигацию (page, from,
// sessionId, visitorId, viewId; вход вкладки дополнительно несёт referrer+UTM),
// leave на уход со страницы (pagehide/visibilitychange/SPA-переход) — точное
// время на странице. Дедуп: перезагрузка той же страницы < 30 с не пишется.
// Fire-and-forget: не блокирует рендер, ошибки молчаливые (метрики некритичны).

const RELOAD_DEDUP_MS = 30_000;
const MAX_DWELL_MS = 1_800_000; // кламп 30 минут (как в Zod-схеме)

// Текущий просмотр страницы (модульное состояние, живёт в памяти страницы).
let currentView: LastNav | null = null;
let leaveSentFor: string | null = null;

function sendLeaveIfNeeded(): void {
  if (!currentView) return;
  if (leaveSentFor === currentView.viewId) return; // leave уже отправлен
  const dwellMs = Math.min(Math.max(Date.now() - currentView.at, 0), MAX_DWELL_MS);
  sendVisitBeacon({ type: 'leave', viewId: currentView.viewId, dwellMs });
  leaveSentFor = currentView.viewId;
  currentView = null;
}

export function VisitTracker() {
  const pathname = usePathname();

  React.useEffect(() => {
    const page = toPageSlug(pathname || '/');
    const prev = readLastNav();
    const now = Date.now();

    // Дедуп перезагрузки (ADR-014): та же страница < 30 с — F5-шум, пропускаем.
    if (prev && prev.page === page && now - prev.at < RELOAD_DEDUP_MS) return;

    const view: LastNav = { page, viewId: getViewId(), at: now };
    writeLastNav(view);
    currentView = view;

    const body: Record<string, unknown> = {
      type: 'enter',
      page,
      sessionId: getSessionId(),
      visitorId: getVisitorId(),
      viewId: view.viewId,
    };
    if (prev) body.from = prev.page;

    // Вход вкладки: источник + UTM посадочной страницы — один beacon за вкладку.
    if (!isEntryAlreadySent()) {
      Object.assign(body, takeEntryPayload());
    }

    try {
      sendVisitBeacon(body);
    } catch {
      // Метрики — некритичны для UX, ошибки отправки игнорируются.
    }

    // SPA-навигация: leave текущего просмотра при уходе с маршрута.
    return () => {
      sendLeaveIfNeeded();
    };
  }, [pathname]);

  React.useEffect(() => {
    const onHide = () => sendLeaveIfNeeded();
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') sendLeaveIfNeeded();
    };

    document.addEventListener('pagehide', onHide);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('pagehide', onHide);
      document.removeEventListener('visibilitychange', onVisibility);
      sendLeaveIfNeeded();
    };
  }, []);

  return null;
}
