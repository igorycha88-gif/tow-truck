import Link from 'next/link';
import { JsonLd } from '@/components/seo/JsonLd';
import { breadcrumbLd } from '@/lib/seo/json-ld';
import { siteConfig } from '@/config/site';
import type { BreadcrumbItem } from '@/types';

// Хлебные крошки. Server Component. Рендерит JSON-LD BreadcrumbList + визуальный nav.
// `items` — без главной (она добавляется автоматически).
export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  const full: BreadcrumbItem[] = [
    { name: 'Главная', url: '/' },
    ...items,
  ];
  const absolute: BreadcrumbItem[] = full.map((i) => ({
    name: i.name,
    url: i.url.startsWith('http') ? i.url : `${siteConfig.url}${i.url}`,
  }));

  return (
    <>
      <JsonLd data={breadcrumbLd(absolute)} />
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
    </>
  );
}
