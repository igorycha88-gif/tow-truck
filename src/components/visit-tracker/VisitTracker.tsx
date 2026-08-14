'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';

// Трекинг визитов (ADR-002): 1 beacon на страницу за сессию браузера.
// Дедуп через sessionStorage (ключ visit:<page>) — перезагрузки не дублируются.
// Fire-and-forget: не блокирует рендер, ошибки молчаливые (метрики некритичны).

const SESSION_KEY_PREFIX = 'visit:';

function toPageSlug(pathname: string): string {
  const trimmed = pathname.replace(/^\//, '').replace(/\/+$/, '');
  if (!trimmed) return 'home';
  return trimmed.toLowerCase().replace(/[^a-z0-9/_-]/g, '_').slice(0, 100);
}

export function VisitTracker() {
  const pathname = usePathname();

  React.useEffect(() => {
    const page = toPageSlug(pathname || '/');
    const key = `${SESSION_KEY_PREFIX}${page}`;

    try {
      if (typeof window === 'undefined') return;
      if (window.sessionStorage.getItem(key)) return;
      window.sessionStorage.setItem(key, '1');
    } catch {
      // sessionStorage недоступен (private mode) — отправляем без дедупа.
    }

    try {
      void fetch('/api/visit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page }),
        keepalive: true,
      });
    } catch {
      // Метрики — некритичны для UX, игнорируем ошибки отправки.
    }
  }, [pathname]);

  return null;
}
