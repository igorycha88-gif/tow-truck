import { Phone, PhoneCall } from 'lucide-react';
import { company } from '@/config/company';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Секция заказа (id="order" — якорь навигации /#order). Форма заявки убрана:
// конверсия переведена на прямой звонок (tel:). Server Component.
// Клик по телефону трекается делегированно (ClickEventsTracker).
export function OrderSection() {
  return (
    <section id="order" className="py-16 md:py-24" aria-labelledby="order-heading">
      <div className="container">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-accent/10 px-3 py-1 text-sm font-semibold text-accent">
            <PhoneCall className="h-4 w-4" /> Заказ по телефону
          </span>
          <h2
            id="order-heading"
            className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl"
          >
            Заказать эвакуатор
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Позвоните — оператор назовёт точную стоимость и время подачи.
            Работаем 24/7, без выходных.
          </p>

          <a
            href={company.phoneHref}
            className={cn(
              buttonVariants({ variant: 'default', size: 'lg' }),
              'mt-6 inline-flex w-full gap-2 sm:w-auto',
            )}
          >
            <Phone className="h-5 w-5" />
            {company.phone}
          </a>

          {company.email && (
            <a
              href={company.emailHref}
              className="mt-4 block text-sm text-muted-foreground transition-colors hover:text-accent"
            >
              {company.email}
            </a>
          )}

          <ul className="mx-auto mt-8 grid max-w-xl gap-2 text-left text-sm text-muted-foreground sm:grid-cols-1">
            <li>✓ Подача 15–30 минут по Москве и МО</li>
            <li>✓ Фиксированная цена, без скрытых платежей</li>
            <li>✓ Работаем 24/7, без выходных</li>
          </ul>
        </div>
      </div>
    </section>
  );
}
