'use client';

import * as React from 'react';
import Link from 'next/link';
import { Phone, Menu, X, Truck } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { navigation } from '@/config/site';
import { company } from '@/config/company';

// Sticky-header с телефоном и CTA. Client — из-за мобильного меню.
// Телефон всегда кликабелен (tel:), независимо от скролла.

export function Header() {
  const [menuOpen, setMenuOpen] = React.useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <div className="container flex h-16 items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2 font-bold text-foreground" aria-label="На главную">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
            <Truck className="h-5 w-5" />
          </span>
          <span className="hidden sm:inline">Эвакуация 24/7</span>
        </Link>

        <nav className="hidden items-center gap-6 lg:flex" aria-label="Основная навигация">
          {navigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <a
            href={company.phoneHref}
            className={cn(buttonVariants({ variant: 'default', size: 'sm' }), 'gap-2')}
          >
            <Phone className="h-4 w-4" />
            <span className="hidden sm:inline">{company.phone}</span>
            <span className="sm:hidden">Позвонить</span>
          </a>

          <button
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-foreground hover:bg-muted lg:hidden"
            aria-label={menuOpen ? 'Закрыть меню' : 'Открыть меню'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav className="border-t border-border bg-background lg:hidden" aria-label="Мобильная навигация">
          <div className="container flex flex-col py-2">
            {navigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="py-3 text-base font-medium text-foreground"
                onClick={() => setMenuOpen(false)}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </nav>
      )}
    </header>
  );
}
