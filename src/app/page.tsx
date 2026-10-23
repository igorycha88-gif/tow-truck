import type { Metadata } from 'next';
import { Hero } from '@/components/sections/Hero';
import { Services } from '@/components/sections/Services';
import { Prices } from '@/components/sections/Prices';
import { Coverage } from '@/components/sections/Coverage';
import { Advantages } from '@/components/sections/Advantages';
import { Process } from '@/components/sections/Process';
import { Faq } from '@/components/sections/Faq';
import { OrderSection } from '@/components/sections/OrderSection';
import { Contacts } from '@/components/sections/Contacts';
import { JsonLd } from '@/components/seo/JsonLd';
import { servicesLd } from '@/lib/seo/json-ld';
import { homeMetadata } from '@/lib/seo/metadata';

// Главная страница. Server Component (SSG/SSG) — максимум SEO, минимум client JS.
// EV-T8: каталог услуг (Service с url посадочных) — только здесь, не на всех страницах.
// EV-T5: блок Coverage — ссылки на 10 гео-хабов (все посадочные в ≤3 кликах).

export const metadata: Metadata = homeMetadata();

export default function HomePage() {
  return (
    <>
      <JsonLd
        data={{ '@context': 'https://schema.org', '@graph': servicesLd() }}
      />
      <Hero />
      <Services />
      <Prices />
      <Coverage />
      <Advantages />
      <Process />
      <Faq />
      <OrderSection />
      <Contacts />
    </>
  );
}
