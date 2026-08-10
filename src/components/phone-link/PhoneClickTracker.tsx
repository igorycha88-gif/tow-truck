'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import type { CLICK_EVENT_PAGES } from '@/lib/validators/click-event';

type ClickEventPage = (typeof CLICK_EVENT_PAGES)[number];

interface PhoneClickTrackerProps {
  page: ClickEventPage;
  className?: string;
  children: React.ReactNode;
}

// Client-обёртка над tel:-ссылкой. При клике fire-and-forget отправляет
// POST /api/click-event для бизнес-метрики «клики по номеру» (ADR-001).
// Не блокирует переход — запрос не await во время клика, ошибки молчаливые.

export function PhoneClickTracker({ page, className, children }: PhoneClickTrackerProps) {
  const track = React.useCallback(() => {
    try {
      void fetch('/api/click-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page }),
        keepalive: true,
      });
    } catch {
      // Метрики — некритичны для UX, игнорируем ошибки отправки.
    }
  }, [page]);

  return (
    <span className={cn('contents', className)} onClick={track}>
      {children}
    </span>
  );
}