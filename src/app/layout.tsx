import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { FloatingCallBtn } from '@/components/layout/FloatingCallBtn';
import { VisitTracker } from '@/components/visit-tracker/VisitTracker';
import { ClickEventsTracker } from '@/components/tracking/ClickEventsTracker';
import { MetrikaRouteTracker } from '@/components/tracking/MetrikaRouteTracker';
import { JsonLd } from '@/components/seo/JsonLd';
import { siteGraphLd } from '@/lib/seo/json-ld';
import { metrikaInitScript, metrikaNoscriptSrc } from '@/lib/seo/metrika';
import { siteOrigin } from '@/lib/seo/url';
import { siteConfig } from '@/config/site';

// Системный шрифт (см. globals.css --font-sans). next/font не используется,
// чтобы не зависеть от интернета при сборке в Docker.

// EV-T9: в layout — только СКВОЗНЫЕ поля без canonical/описания главной;
// мету главной (canonical, og:url, description) задаёт src/app/page.tsx.
// template '%s' — нейтральный: суффикс имени сайта добавляет buildMetadata,
// чтобы не задвоить его на дочерних страницах.
export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin()),
  title: { default: `${siteConfig.name} — эвакуатор 24/7`, template: '%s' },
  manifest: '/manifest.webmanifest',
  applicationName: siteConfig.name,
  appleWebApp: {
    capable: true,
    title: siteConfig.name,
    statusBarStyle: 'default',
  },
  formatDetection: { telephone: false },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_VERIFICATION || undefined,
    yandex: process.env.NEXT_PUBLIC_YANDEX_VERIFICATION || undefined,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0f172a' },
  ],
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body className="min-h-screen font-sans">
        {/* Сквозной @graph: Organization + WebSite + LocalBusiness (EV-T8).
            Каталог Service — только на главной (src/app/page.tsx). */}
        <JsonLd data={siteGraphLd()} />
        <Header />
        <main id="main">{children}</main>
        <Footer />
        <FloatingCallBtn />
        {/* Трекинг визитов и кликов для бизнес-метрик (ADR-002, ADR-012), fire-and-forget */}
        <VisitTracker />
        <ClickEventsTracker />
        {/* Метрика: hit при SPA-переходах (EV-T13), счётчик выше по layout */}
        {process.env.NEXT_PUBLIC_METRIKA_ID && (
          <MetrikaRouteTracker />
        )}

        {/* Yandex.Метрика: счётчик рендерится при заданном NEXT_PUBLIC_METRIKA_ID */}
        {process.env.NEXT_PUBLIC_METRIKA_ID && (
          <>
            <script
              type="text/javascript"
              dangerouslySetInnerHTML={{ __html: metrikaInitScript(process.env.NEXT_PUBLIC_METRIKA_ID) }}
            />
            <noscript>
              <div>
                {/* noscript-пиксель Метрики: next/image здесь нельзя (нет JS) */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={metrikaNoscriptSrc(process.env.NEXT_PUBLIC_METRIKA_ID)}
                  style={{ position: 'absolute', left: '-9999px' }}
                  alt=""
                  width={1}
                  height={1}
                />
              </div>
            </noscript>
          </>
        )}
      </body>
    </html>
  );
}
