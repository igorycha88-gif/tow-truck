import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ServicePage } from '@/components/pages/ServicePage';
import { buildMetadata } from '@/lib/seo/metadata';
import { servicePages, getServicePage } from '@/config/service-pages';

// Универсальный роут посадочных SEO-страниц (ЧТЗ_SEO_Рост_позиций, ЭПИК-2).
// SSG: страницы генерируются из реестра на этапе сборки; неизвестные слаги — 404.

export const dynamicParams = false;

export function generateStaticParams(): { slug: string }[] {
  return servicePages.map((p) => ({ slug: p.slug }));
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = getServicePage(slug);
  if (!page) {
    return buildMetadata({ title: 'Страница не найдена', noIndex: true, path: '/404' });
  }
  return buildMetadata({
    title: page.title,
    description: page.description,
    path: `/${page.slug}`,
    exactTitle: true,
  });
}

export default async function ServiceSlugPage({ params }: Props) {
  const { slug } = await params;
  const page = getServicePage(slug);
  if (!page) notFound();
  return <ServicePage page={page} />;
}
