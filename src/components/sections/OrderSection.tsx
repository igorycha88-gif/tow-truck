import { PhoneCall } from 'lucide-react';
import { OrderForm } from '@/components/forms/OrderForm';
import { company } from '@/config/company';

// Секция формы заявки. Server Component-обёртка + client-форма внутри.
export function OrderSection() {
  return (
    <section id="order" className="py-16 md:py-24" aria-labelledby="order-heading">
      <div className="container">
        <div className="mx-auto grid max-w-5xl gap-10 lg:grid-cols-2">
          <div className="lg:pr-8">
            <span className="inline-flex items-center gap-2 rounded-full bg-accent/10 px-3 py-1 text-sm font-semibold text-accent">
              <PhoneCall className="h-4 w-4" /> Оставить заявку
            </span>
            <h2
              id="order-heading"
              className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl"
            >
              Заказать эвакуатор
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Заполните форму — оператор перезвонит в течение нескольких минут,
              уточнит детали и стоимость. Или позвоните сами:
            </p>

            <a
              href={company.phoneHref}
              className="mt-6 inline-block text-2xl font-extrabold text-accent hover:underline"
            >
              {company.phone}
            </a>

            <ul className="mt-8 space-y-2 text-sm text-muted-foreground">
              <li>✓ Подача 15–30 минут по Москве и МО</li>
              <li>✓ Фиксированная цена, без скрытых платежей</li>
              <li>✓ Работаем 24/7, без выходных</li>
            </ul>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
            <OrderForm />
          </div>
        </div>
      </div>
    </section>
  );
}
