import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { FloatingCallBtn } from '@/components/layout/FloatingCallBtn';
import { JsonLd } from '@/components/seo/JsonLd';
import { buildMetadata, localBusinessLd } from '@/lib/seo/metadata';

// Системный шрифт (см. globals.css --font-sans). next/font не используется,
// чтобы не зависеть от интернета при сборке в Docker.

export const metadata: Metadata = buildMetadata({ path: '/' });

export const viewport: Viewport = {
  themeColor: '#0f172a',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body className="min-h-screen font-sans">
        <JsonLd data={localBusinessLd()} />
        <Header />
        <main id="main">{children}</main>
        <Footer />
        <FloatingCallBtn />

        {/* Yandex.Метрика (заглушка — вставить реальный ID в .env NEXT_PUBLIC_METRIKA_ID) */}
        {process.env.NEXT_PUBLIC_METRIKA_ID && (
          <script
            type="text/javascript"
            dangerouslySetInnerHTML={{
              __html: `
                (function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
                m[i].l=1*new Date();
                for (var j = 0; j < document.scripts.length; j++) {if (document.scripts[j].src === r) { return; }}
                k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})
                (window, document, "script", "https://mc.yandex.ru/metrika/tag.js", "ym");
                ym(${process.env.NEXT_PUBLIC_METRIKA_ID}, "init", { clickmap:true, trackLinks:true, accurateTrackBounce:true, webvisor:true });
              `,
            }}
          />
        )}
      </body>
    </html>
  );
}
