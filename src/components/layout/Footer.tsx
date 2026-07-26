import Link from 'next/link';
import { Phone, MessageCircle, Send, Truck, Clock } from 'lucide-react';
import { company } from '@/config/company';
import { navigation } from '@/config/site';

// Footer — Server Component (SEO, минимум JS).
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
          </div>

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
            <a href={company.phoneHref} className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-accent">
              <Phone className="h-4 w-4" /> {company.phone}
            </a>
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

          <div className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground">Реквизиты</h2>
            <p className="text-sm text-muted-foreground">{company.legalName}</p>
            <p className="text-sm text-muted-foreground">ИНН: {company.inn}</p>
            <p className="text-sm text-muted-foreground">{company.address}</p>
          </div>
        </div>

        <div className="mt-8 border-t border-border pt-6">
          <p className="text-xs text-muted-foreground">
            © {year} {company.legalName}. Все права защищены. Информация на сайте не является публичной офертой.
          </p>
        </div>
      </div>
    </footer>
  );
}
