import { Phone } from 'lucide-react';
import { company } from '@/config/company';

// Floating-call кнопка: только на мобильных (md:hidden), всегда видна при скролле.
// Server Component — нет интерактива, просто tel:-ссылка. CSS фиксирует позицию.
// Клик трекается делегированно (ClickEventsTracker, data-page="floating_call").
export function FloatingCallBtn() {
  return (
    <a
      href={company.phoneHref}
      data-page="floating_call"
      aria-label="Позвонить"
      className="fixed bottom-4 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-lg shadow-accent/40 animate-pulse-ring md:hidden"
    >
      <Phone className="h-6 w-6" />
    </a>
  );
}
