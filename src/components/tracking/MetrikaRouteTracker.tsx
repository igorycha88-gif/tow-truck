'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { metrikaRouteHit } from '@/lib/seo/metrika';

// Отправка просмотра в Яндекс.Метрику при клиентской смене маршрута (EV-T13).
// tag.js не знает о Next App Router: без искусственного hit переходы
// главная → /ceny не попадают в отчёты. Fire-and-forget, ошибки молчаливые.

export function MetrikaRouteTracker() {
  const pathname = usePathname();
  const metrikaId = process.env.NEXT_PUBLIC_METRIKA_ID;

  React.useEffect(() => {
    if (!metrikaId) return;
    try {
      metrikaRouteHit(metrikaId, pathname || '/');
    } catch {
      // Метрики некритичны для UX — ошибки отправки игнорируются.
    }
  }, [pathname, metrikaId]);

  return null;
}
