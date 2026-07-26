import { Phone, MessageCircle, Send, MapPin, Clock } from 'lucide-react';
import { company } from '@/config/company';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Контакты. Server Component.
export function Contacts() {
  return (
    <section
      id="contacts"
      className="bg-primary py-16 text-primary-foreground md:py-24"
      aria-labelledby="contacts-heading"
    >
      <div className="container">
        <div className="mx-auto max-w-2xl text-center">
          <h2
            id="contacts-heading"
            className="text-3xl font-bold tracking-tight sm:text-4xl"
          >
            Контакты
          </h2>
          <p className="mt-4 text-lg text-primary-foreground/80">
            Звоните прямо сейчас — эвакуатор приедет через {''}
            <span className="font-semibold text-accent">15–30 минут</span>.
          </p>
        </div>

        <div className="mx-auto mt-12 max-w-3xl space-y-4">
          <a
            href={company.phoneHref}
            className={cn(
              buttonVariants({ variant: 'default', size: 'lg' }),
              'w-full gap-3 text-lg',
            )}
          >
            <Phone className="h-5 w-5" /> {company.phone}
          </a>

          <div className="grid gap-3 sm:grid-cols-2">
            {company.whatsapp && (
              <a
                href={`https://wa.me/${company.whatsapp.replace(/[^0-9]/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(buttonVariants({ variant: 'secondary', size: 'lg' }), 'gap-3')}
              >
                <MessageCircle className="h-5 w-5" /> WhatsApp
              </a>
            )}
            {company.telegram && (
              <a
                href={company.telegram}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(buttonVariants({ variant: 'secondary', size: 'lg' }), 'gap-3')}
              >
                <Send className="h-5 w-5" /> Telegram
              </a>
            )}
          </div>

          <dl className="grid gap-4 pt-6 text-sm sm:grid-cols-3">
            <div className="flex items-center justify-center gap-2 text-primary-foreground/80">
              <Clock className="h-4 w-4 text-accent" /> 24/7 без выходных
            </div>
            <div className="flex items-center justify-center gap-2 text-primary-foreground/80">
              <MapPin className="h-4 w-4 text-accent" /> {company.address}
            </div>
            <div className="flex items-center justify-center gap-2 text-primary-foreground/80">
              ИНН: {company.inn}
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}
