import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { DynamicIcon } from '@/components/ui/DynamicIcon';
import { services } from '@/config/services';
import { formatPricing } from '@/lib/utils';

// Секции услуг. Server Component. Карточки → ссылка на форму с предзаполнением serviceType.
export function Services() {
  return (
    <section id="services" className="py-16 md:py-24" aria-labelledby="services-heading">
      <div className="container">
        <div className="mx-auto max-w-2xl text-center">
          <h2
            id="services-heading"
            className="text-3xl font-bold tracking-tight sm:text-4xl"
          >
            Услуги эвакуации
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Эвакуируем любой транспорт в Москве и МО. Нажмите на услугу, чтобы оставить заявку.
          </p>
        </div>

        <ul
          className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
          aria-label="Список услуг"
        >
          {services.map((service) => (
            <li key={service.slug}>
              <Link
                href={`/?service=${service.slug}#order`}
                className="group block h-full"
                aria-label={`Заказать: ${service.title}`}
              >
                <Card className="h-full p-6">
                  <div className="flex items-start justify-between">
                    <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-accent/10 text-accent">
                      <DynamicIcon name={service.icon} className="h-6 w-6" />
                    </span>
                    <ArrowRight
                      className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-accent"
                      aria-hidden="true"
                    />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold">{service.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{service.description}</p>
                  <p className="mt-4 text-base font-bold text-foreground">
                    {formatPricing(service.pricing)}
                  </p>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
