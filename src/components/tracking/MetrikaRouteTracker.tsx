'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { metrikaRouteHit } from '@/lib/seo/metrika';

// Отправка просмотра в Яндекс.Метрику (EV-T13; ЧТЗ_Яндекс_SEO_доработка
// 2026-10, TASK-Я-01). init счётчика — с defer:true (не шлёт просмотр сам),
// поэтому ВСЕ просмотры — отсюда: первый рендер + каждая смена pathname.
// Ровно один hit на URL: повторный рендер с тем же адресом не отправляется.
// referer: предыдущий внутренний URL (или document.referrer на входе),
// url — абсолютный location.href (в отчётах не будет относительных адресов).

export function MetrikaRouteTracker() {
  const pathname = usePathname();
  const metrikaId = process.env.NEXT_PUBLIC_METRIKA_ID;
  const prevUrlRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!metrikaId) return;
    const url = window.location.href;
    // Не слать повторный hit на тот же URL (ре-рендер без смены маршрута).
    if (prevUrlRef.current === url) return;
    const referer = prevUrlRef.current ?? document.referrer;
    prevUrlRef.current = url;
    try {
      metrikaRouteHit(metrikaId, url, {
        ...(referer ? { referer } : {}),
        title: document.title,
      });
    } catch {
      // Метрики некритичны для UX — ошибки отправки игнорируются.
    }
  }, [pathname, metrikaId]);

  return null;
}
