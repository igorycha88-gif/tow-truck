import Link from 'next/link';
import { Phone } from 'lucide-react';
import { buildMetadata } from '@/lib/seo/metadata';
import { company } from '@/config/company';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Кастомная 404. noindex — не индексируется. Ссылка на главную + телефон (конверсия).
export const metadata = buildMetadata({
  title: 'Страница не найдена',
  path: '/404',
  noIndex: true,
});

export default function NotFound() {
  return (
    <section className="container flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
      <p className="text-7xl font-extrabold text-accent">404</p>
      <h1 className="mt-4 text-3xl font-bold tracking-tight">Страница не найдена</h1>
      <p className="mt-3 max-w-md text-muted-foreground">
        Возможно, страница была удалена или вы перешли по неверной ссылке. Если нужен
        эвакуатор — позвоните, поможем прямо сейчас.
      </p>

      <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
        <Link href="/" className={cn(buttonVariants({ size: 'lg' }))}>
          На главную
        </Link>
        <a
          href={company.phoneHref}
          className={cn(buttonVariants({ variant: 'secondary', size: 'lg' }), 'gap-2')}
        >
          <Phone className="h-5 w-5" /> {company.phone}
        </a>
      </div>
    </section>
  );
}
