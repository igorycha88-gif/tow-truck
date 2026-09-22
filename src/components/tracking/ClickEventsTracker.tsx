'use client';

import * as React from 'react';
import { toPageSlug } from '@/lib/client-tracking';
import { sendClickBeacon } from '@/lib/click-beacon';

// Делегированный трекер кликов (ЧТЗ §2.1/§2.4, ADR-012): один обработчик click
// на document ловит клики по tel:-ссылкам (eventType=click_phone) и элементам
// с data-service (service_click). Новые номера/услуги ловятся автоматически.
// Debounce: не чаще 1 события на цель в 5 секунд.
// Отправка — sendBeacon (переживает хендофф tel: в диалер, см. lib/click-beacon).
// Fire-and-forget: не блокирует переход по ссылке, ошибки молчаливые.

const DEBOUNCE_MS = 5_000;

// Ключ цели → время последнего отправленного события.
const lastFiredAt = new Map<string, number>();

function shouldFire(dedupeKey: string, now: number): boolean {
  const last = lastFiredAt.get(dedupeKey) ?? Number.NEGATIVE_INFINITY;
  if (now - last < DEBOUNCE_MS) return false;
  lastFiredAt.set(dedupeKey, now);
  return true;
}

function pageContext(target: Element): string {
  const labelled = target.closest<HTMLElement>('[data-page]');
  return labelled?.dataset.page || toPageSlug(window.location.pathname || '/');
}

export function ClickEventsTracker() {
  React.useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.button !== 0) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const now = Date.now();

      const phoneLink = target.closest<HTMLAnchorElement>('a[href^="tel:"]');
      if (phoneLink) {
        if (shouldFire(`phone:${phoneLink.href}`, now)) {
          sendClickBeacon({ eventType: 'click_phone', page: pageContext(phoneLink) });
        }
        return;
      }

      const serviceTarget = target.closest<HTMLElement>('[data-service]');
      const service = serviceTarget?.dataset.service;
      if (service) {
        if (shouldFire(`service:${service}`, now)) {
          sendClickBeacon({ eventType: 'service_click', page: pageContext(serviceTarget), service });
        }
      }
    };

    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  return null;
}
