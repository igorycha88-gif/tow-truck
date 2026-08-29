'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { toPageSlug, resolveSessionSource, markSourceSent } from '@/lib/client-tracking';

// Трекинг визитов (ADR-002): 1 beacon на страницу за сессию браузера.
// Дедуп через sessionStorage (ключ visit:<page>) — перезагрузки не дублируются.
// Первый визит сессии дополнительно несёт referrer — источник трафика (ЧТЗ §2.2).
// Fire-and-forget: не блокирует рендер, ошибки молчаливые (метрики некритичны).

const SESSION_KEY_PREFIX = 'visit:';

export function VisitTracker() {
  const pathname = usePathname();

  React.useEffect(() => {
    const page = toPageSlug(pathname || '/');
    const key = `${SESSION_KEY_PREFIX}${page}`;

    let isFirstPageView = true;
    try {
      if (typeof window === 'undefined') return;
      if (window.sessionStorage.getItem(key)) {
        isFirstPageView = false;
      } else {
        window.sessionStorage.setItem(key, '1');
      }
    } catch {
      // sessionStorage недоступен (private mode) — отправляем без дедупа.
    }

    const body: Record<string, unknown> = { page };
    if (isFirstPageView && markSourceSent()) {
      body.referrer = resolveSessionSource();
    }

    try {
      void fetch('/api/visit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        keepalive: true,
      });
    } catch {
      // Метрики — некритичны для UX, игнорируем ошибки отправки.
    }
  }, [pathname]);

  return null;
}
