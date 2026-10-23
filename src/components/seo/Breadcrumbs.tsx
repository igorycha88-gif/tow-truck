import Link from 'next/link';
import type { BreadcrumbItem } from '@/types';

// Хлебные крошки. Server Component. Визуальный nav.
// `items` — без главной (она добавляется автоматически).
// EV-T8: JSON-LD BreadcrumbList рендерится ОДИН раз — в @graph посадочной
// (servicePageGraphLd с @id `#breadcrumb`); здесь только визуальная навигация.
export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  const full: BreadcrumbItem[] = [
    { name: 'Главная', url: '/' },
    ...items,
  ];

  return (
    <nav aria-label="Хлебные крошки" className="container py-4 text-sm text-muted-foreground">
      <ol className="flex flex-wrap items-center gap-1.5">
        {full.map((item, i) => (
          <li key={item.url} className="flex items-center gap-1.5">
            {i < full.length - 1 ? (
              <Link href={item.url} className="hover:text-foreground">
                {item.name}
              </Link>
            ) : (
              <span className="text-foreground" aria-current="page">
                {item.name}
              </span>
            )}
            {i < full.length - 1 && <span aria-hidden="true">/</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}
