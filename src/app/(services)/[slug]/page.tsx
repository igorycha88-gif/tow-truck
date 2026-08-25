import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ServicePage } from '@/components/pages/ServicePage';
import { buildMetadata } from '@/lib/seo/metadata';
import { landingPages, getLandingPage } from '@/config/geo';

// Универсальный роут посадочных SEO-страниц (ЧТЗ_SEO_Рост_позиций, ЭПИК-2 + ADR-003).
// SSG: страницы генерируются из ОБЪЕДИНЁННОГО реестра landingPages
// (услуги + гео-районы/города/хабы); неизвестные слаги — 404.

export const dynamicParams = false;

export function generateStaticParams(): { slug: string }[] {
  return landingPages.map((p) => ({ slug: p.slug }));
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = getLandingPage(slug);
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
  const page = getLandingPage(slug);
  if (!page) notFound();
  return <ServicePage page={page} />;
}
