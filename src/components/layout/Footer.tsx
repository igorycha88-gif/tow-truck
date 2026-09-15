import Link from 'next/link';
import { Phone, Mail, MessageCircle, Send, Truck, Clock, MapPin } from 'lucide-react';
import { company } from '@/config/company';
import { navigation } from '@/config/site';
import { getServicePage } from '@/config/service-pages';

// Ссылки на главные услуги в подвале (ЭПИК-4 + ЧТЗ SEO v2: /ceny — сквозная
// перелинковка на страницу цен со всех страниц сайта).
const footerServiceLinks = [
  'ceny',
  'evakuator-24-7',
  'evakuator-posle-dtp',
  'evakuator-legkovyh',
  'evakuator-vidnoe',
]
  .map((slug) => getServicePage(slug))
  .filter((p): p is NonNullable<typeof p> => Boolean(p));

// Footer — Server Component (SEO, минимум JS). Ссылки услуг и телефон несут
// data-service/data-page для делегированного трекинга (ClickEventsTracker).
export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-secondary/30">
      <div className="container py-12">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2 font-bold">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                <Truck className="h-5 w-5" />
              </span>
              <span>{company.name}</span>
            </div>
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" /> {company.workingHours}
            </p>
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" /> {company.address}
            </p>
          </div>

          <nav className="space-y-2" aria-label="Услуги">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground">Услуги</h2>
            <ul className="space-y-1">
              {footerServiceLinks.map((page) => (
                <li key={page.slug}>
                  <Link href={`/${page.slug}`} data-service={page.slug} className="text-sm text-muted-foreground hover:text-foreground">
                    {page.h1}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav className="space-y-2" aria-label="Навигация в подвале">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground">Разделы</h2>
            <ul className="space-y-1">
              {navigation.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="text-sm text-muted-foreground hover:text-foreground">
                    {item.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link href="/politika" className="text-sm text-muted-foreground hover:text-foreground">
                  Политика конфиденциальности
                </Link>
              </li>
            </ul>
          </nav>

          <div className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground">Контакты</h2>
            <a href={company.phoneHref} data-page="footer" className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-accent">
              <Phone className="h-4 w-4" /> {company.phone}
            </a>
            {company.email && (
              <a href={company.emailHref} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
                <Mail className="h-4 w-4" /> {company.email}
              </a>
            )}
            {company.whatsapp && (
              <a
                href={`https://wa.me/${company.whatsapp.replace(/[^0-9]/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
              >
                <MessageCircle className="h-4 w-4" /> WhatsApp
              </a>
            )}
            {company.telegram && (
              <a
                href={company.telegram}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
              >
                <Send className="h-4 w-4" /> Telegram
              </a>
            )}
          </div>
        </div>

        <div className="mt-8 border-t border-border pt-6">
          <p className="text-xs text-muted-foreground">
            © {year} {company.name}. Все права защищены. Информация на сайте не является публичной офертой.
          </p>
        </div>
      </div>
    </footer>
  );
}
