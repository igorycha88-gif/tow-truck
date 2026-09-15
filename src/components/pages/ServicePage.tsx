import Link from 'next/link';
import { CheckCircle2, Phone, ArrowRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import { Breadcrumbs } from '@/components/seo/Breadcrumbs';
import { JsonLd } from '@/components/seo/JsonLd';
import { servicePageLd, faqPageLd } from '@/lib/seo/json-ld';
import { getLandingPage } from '@/config/geo';
import { servicePagePriceLabel } from '@/config/service-pages';
import { company, trustStats } from '@/config/company';
import { cn } from '@/lib/utils';
import type { BreadcrumbItem } from '@/types';
import type { ServicePageConfig } from '@/types/service-page';

// Универсальный шаблон посадочной SEO-страницы (ЧТЗ_SEO_Рост_позиций, ЭПИК-2; ADR-003 — гео).
// Server Component (SSG). Разметка одна, контент — из конфига страницы.
// Структура: H1 → лид → «Что входит» → цена → шаги → FAQ → CTA → перелинковка.
// Клики по телефону/услугам трекаются делегированно (ClickEventsTracker).

export function ServicePage({ page }: { page: ServicePageConfig }) {
  const relatedPages = page.related
    .map((slug) => getLandingPage(slug))
    .filter((p): p is ServicePageConfig => Boolean(p));
  const priceLabel = servicePagePriceLabel(page.price);

  // Хлебные крошки: Главная → [родитель-хаб] → текущая (ADR-003).
  const breadcrumbItems: BreadcrumbItem[] = [
    ...(page.parent ? [{ name: page.parent.name, url: `/${page.parent.slug}` }] : []),
    { name: page.h1, url: `/${page.slug}` },
  ];

  return (
    <article>
      {/* JSON-LD: Service + Offer (цена из единого источника) и FAQPage */}
      <JsonLd data={servicePageLd(page)} />
      <JsonLd data={faqPageLd(page.faq)} />

      <Breadcrumbs items={breadcrumbItems} />

      {/* H1 + лид-абзацы с УТП */}
      <header className="container pb-4 pt-2">
        <h1 className="max-w-3xl text-3xl font-extrabold tracking-tight sm:text-4xl">
          {page.h1}
        </h1>
        <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span className="rounded-full bg-accent/10 px-3 py-1 font-semibold text-accent">
            Подача {trustStats.responseMinutes} минут
          </span>
          <span className="rounded-full bg-accent/10 px-3 py-1 font-semibold text-accent">
            Работаем 24/7
          </span>
          <span className="rounded-full bg-accent/10 px-3 py-1 font-semibold text-accent">
            {priceLabel}
          </span>
        </p>
        <div className="mt-5 max-w-3xl space-y-4 text-lg leading-relaxed text-muted-foreground">
          {page.lead.map((paragraph) => (
            <p key={paragraph.slice(0, 40)}>{paragraph}</p>
          ))}
        </div>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <a
            href={company.phoneHref}
            data-page="service_page"
            className={cn(buttonVariants({ size: 'lg' }), 'gap-2')}
          >
            <Phone className="h-5 w-5" /> Заказать эвакуатор
          </a>
          <a
            href={company.phoneHref}
            data-page="service_page"
            className={cn(buttonVariants({ variant: 'secondary', size: 'lg' }))}
          >
            {company.phone}
          </a>
        </div>
      </header>

      {/* Что входит в услугу */}
      <section className="py-12 md:py-16" aria-labelledby={`${page.slug}-included`}>
        <div className="container">
          <h2 id={`${page.slug}-included`} className="text-2xl font-bold tracking-tight sm:text-3xl">
            Что входит в услугу
          </h2>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Состав услуги">
            {page.included.map((item) => (
              <li key={item.title}>
                <Card className="h-full p-5">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
                    <div>
                      <h3 className="font-semibold text-foreground">{item.title}</h3>
                      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{item.text}</p>
                    </div>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Цена */}
      <section className="py-6 md:py-10" aria-labelledby={`${page.slug}-price`}>
        <div className="container">
          <Card className="mx-auto max-w-3xl border-accent/30 bg-accent/5 p-6 sm:p-8">
            <h2 id={`${page.slug}-price`} className="text-xl font-bold tracking-tight sm:text-2xl">
              Стоимость услуги
            </h2>
            <p className="mt-3 text-3xl font-extrabold text-accent" data-testid="price-label">
              {priceLabel}
            </p>
            {page.priceNote && (
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{page.priceNote}</p>
            )}
            <p className="mt-4 text-sm text-muted-foreground">
              Точную стоимость по вашим адресам назовёт оператор — до выезда, без доплат «на месте».
            </p>
          </Card>
        </div>
      </section>

      {/* Как проходит эвакуация */}
      <section className="py-12 md:py-16" aria-labelledby={`${page.slug}-steps`}>
        <div className="container">
          <h2 id={`${page.slug}-steps`} className="text-2xl font-bold tracking-tight sm:text-3xl">
            Как проходит эвакуация
          </h2>
          <ol className="mt-8 grid gap-4 md:grid-cols-2" aria-label="Этапы выполнения">
            {page.steps.map((step, i) => (
              <li key={step.title}>
                <Card className="h-full p-5">
                  <div className="flex items-start gap-4">
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-base font-bold text-accent-foreground"
                      aria-hidden="true"
                    >
                      {i + 1}
                    </span>
                    <div>
                      <h3 className="font-semibold text-foreground">{step.title}</h3>
                      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{step.text}</p>
                    </div>
                  </div>
                </Card>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* FAQ (нативный details, без client JS) */}
      <section className="py-12 md:py-16" aria-labelledby={`${page.slug}-faq`}>
        <div className="container">
          <h2 id={`${page.slug}-faq`} className="text-2xl font-bold tracking-tight sm:text-3xl">
            Частые вопросы
          </h2>
          <ul className="mt-8 max-w-3xl space-y-3" aria-label="Вопросы и ответы">
            {page.faq.map((item) => (
              <li key={item.question}>
                <details className="group rounded-xl border border-border bg-card p-5 [&_summary::-webkit-details-marker]:hidden">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
                    <h3 className="font-semibold text-foreground">{item.question}</h3>
                    <span
                      className="ml-auto inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent transition-transform group-open:rotate-45"
                      aria-hidden="true"
                    >
                      +
                    </span>
                  </summary>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.answer}</p>
                </details>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* CTA заказа (id="order-service" — якорь). Форма заявки убрана: конверсия
          переведена на прямой звонок (tel:). Трекается делегированно (ClickEventsTracker). */}
      <section id="order-service" className="py-12 md:py-16" aria-labelledby={`${page.slug}-order`}>
        <div className="container">
          <div className="mx-auto max-w-3xl text-center">
            <h2 id={`${page.slug}-order`} className="text-2xl font-bold tracking-tight sm:text-3xl">
              Заказать: {page.h1.toLowerCase()}
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Позвоните — оператор назовёт точную стоимость и время подачи.
              Работаем 24/7, без выходных.
            </p>
            <a
              href={company.phoneHref}
              data-page="service_page"
              className={cn(buttonVariants({ size: 'lg' }), 'mt-6 inline-flex gap-2')}
            >
              <Phone className="h-5 w-5" /> {company.phone}
            </a>
            <ul className="mx-auto mt-8 grid max-w-xl gap-2 text-left text-sm text-muted-foreground">
              <li>✓ Подача {trustStats.responseMinutes} минут по Москве и МО</li>
              <li>✓ Фиксированная цена, без скрытых платежей</li>
              <li>✓ Работаем 24/7, без выходных</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Перелинковка: смежные услуги / районы и города направления (гео-хабы, ADR-003) */}
      {relatedPages.length > 0 && (
        <section className="py-12 md:py-16" aria-labelledby={`${page.slug}-related`}>
          <div className="container">
            <h2 id={`${page.slug}-related`} className="text-2xl font-bold tracking-tight sm:text-3xl">
              {page.relatedTitle ?? 'Смежные услуги'}
            </h2>
            <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {relatedPages.map((rel) => (
                <li key={rel.slug}>
                  <Link
                    href={`/${rel.slug}`}
                    data-service={rel.slug}
                    className="group block h-full rounded-xl border border-border bg-card p-5 transition-shadow hover:shadow-md"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="font-semibold text-foreground">{rel.h1}</h3>
                      <ArrowRight
                        className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-accent"
                        aria-hidden="true"
                      />
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {rel.lead[0]?.slice(0, 140)}…
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </article>
  );
}
