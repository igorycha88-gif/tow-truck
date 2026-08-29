import Link from 'next/link';
import { BadgeRussianRuble } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { services } from '@/config/services';
import { catalogServiceToLanding } from '@/config/service-pages';
import { formatPricing } from '@/lib/utils';

// Секция «Цены» на главной (ЧТЗ_SEO_Рост_позиций, ЭПИК-5). Якорь #prices —
// источник быстрых ссылок Яндекса (ЭПИК-1). Цены — из каталога (единый источник
// pricing.ts), ссылки — на посадочные страницы (перелинковка).
// Клик по строке-услуге трекается делегированно (data-service).
export function Prices() {
  return (
    <section id="prices" className="py-16 md:py-24" aria-labelledby="prices-heading">
      <div className="container">
        <div className="mx-auto max-w-2xl text-center">
          <h2 id="prices-heading" className="text-3xl font-bold tracking-tight sm:text-4xl">
            Цены на эвакуацию
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Фиксированная стоимость: называем цену до выезда, без доплат «на месте».
            Ночь и праздники — без наценок.
          </p>
        </div>

        <div className="mx-auto mt-12 max-w-3xl">
          <Card className="overflow-hidden">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Тарифы на услуги эвакуации в Москве и МО</caption>
              <thead>
                <tr className="border-b border-border bg-muted/50 text-muted-foreground">
                  <th scope="col" className="px-5 py-3 font-semibold">Услуга</th>
                  <th scope="col" className="px-5 py-3 text-right font-semibold">Стоимость</th>
                </tr>
              </thead>
              <tbody>
                {services.map((service) => {
                  const landing = catalogServiceToLanding[service.slug];
                  return (
                    <tr key={service.slug} className="border-b border-border/60 last:border-0">
                      <th scope="row" className="px-5 py-3.5 font-medium text-foreground">
                        {landing ? (
                          <Link href={`/${landing}`} data-service={service.slug} className="hover:text-accent hover:underline">
                            {service.title}
                          </Link>
                        ) : (
                          service.title
                        )}
                      </th>
                      <td className="px-5 py-3.5 text-right font-bold text-foreground">
                        {formatPricing(service.pricing)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>

          <p className="mt-4 flex items-start justify-center gap-2 text-center text-sm text-muted-foreground">
            <BadgeRussianRuble className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
            Точную стоимость по вашим адресам назовёт оператор при заказе — до выезда.
          </p>
        </div>
      </div>
    </section>
  );
}
