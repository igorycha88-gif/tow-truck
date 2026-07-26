import Link from 'next/link';
import { Phone, Timer, ShieldCheck, Star } from 'lucide-react';
import { company, trustStats } from '@/config/company';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Hero — Server Component. H1 + УТП + CTA + бейджи доверия.
export function Hero() {
  return (
    <section
      className="relative overflow-hidden bg-primary text-primary-foreground"
      aria-labelledby="hero-heading"
    >
      {/* Декоративный фоновый акцент */}
      <div
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            'radial-gradient(circle at 80% 20%, hsl(var(--accent)) 0%, transparent 50%)',
        }}
        aria-hidden="true"
      />

      <div className="container relative py-16 md:py-24 lg:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-accent/90 px-4 py-1.5 text-sm font-semibold text-accent-foreground">
            <Timer className="h-4 w-4" /> Подача {trustStats.responseMinutes} минут
          </span>

          <h1
            id="hero-heading"
            className="mt-6 text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl lg:text-6xl"
          >
            Эвакуатор <span className="text-accent">24/7</span> в Москве и области
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-lg text-primary-foreground/80 sm:text-xl">
            Круглосуточная эвакуация легковых, мото, спецтехники и авто после ДТП.
            Своя техника, фиксированные цены, аккуратные водители.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href={company.phoneHref}
              className={cn(buttonVariants({ variant: 'default', size: 'lg' }), 'w-full sm:w-auto')}
            >
              <Phone className="h-5 w-5" />
              {company.phone}
            </a>
            <Link
              href="/#order"
              className={cn(
                buttonVariants({ variant: 'secondary', size: 'lg' }),
                'w-full sm:w-auto',
              )}
            >
              Заказать эвакуатор
            </Link>
          </div>

          <dl className="mx-auto mt-12 grid max-w-2xl grid-cols-3 gap-4 text-center">
            <div className="space-y-1">
              <dt className="flex items-center justify-center gap-1.5 text-xs uppercase tracking-wide text-primary-foreground/70">
                <Timer className="h-4 w-4" /> Подача
              </dt>
              <dd className="text-2xl font-bold text-accent">{trustStats.responseMinutes} мин</dd>
            </div>
            <div className="space-y-1">
              <dt className="flex items-center justify-center gap-1.5 text-xs uppercase tracking-wide text-primary-foreground/70">
                <ShieldCheck className="h-4 w-4" /> Опыт
              </dt>
              <dd className="text-2xl font-bold">{trustStats.experienceYears} лет</dd>
            </div>
            <div className="space-y-1">
              <dt className="flex items-center justify-center gap-1.5 text-xs uppercase tracking-wide text-primary-foreground/70">
                <Star className="h-4 w-4" /> Рейтинг
              </dt>
              <dd className="text-2xl font-bold">{trustStats.rating.toFixed(1)}</dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}
