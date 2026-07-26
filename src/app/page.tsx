import { Hero } from '@/components/sections/Hero';
import { Services } from '@/components/sections/Services';
import { Advantages } from '@/components/sections/Advantages';
import { Process } from '@/components/sections/Process';
import { OrderSection } from '@/components/sections/OrderSection';
import { Contacts } from '@/components/sections/Contacts';

// Главная страница. Server Component (SSR/SSG) — максимум SEO, минимум client JS.
export default function HomePage() {
  return (
    <>
      <Hero />
      <Services />
      <Advantages />
      <Process />
      <OrderSection />
      <Contacts />
    </>
  );
}
