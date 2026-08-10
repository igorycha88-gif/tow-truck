import { JsonLd } from '@/components/seo/JsonLd';
import { faqPageLd } from '@/lib/seo/json-ld';
import { faq } from '@/config/faq';

// FAQ-секция. Server Component. Нативный <details> (без client JS) + FAQPage JSON-LD.
// SEO long-tail — ответы на «эвакуатор цена», «как быстро», «работаете ли ночью» и т.п.
export function Faq() {
  return (
    <section id="faq" className="py-16 md:py-24" aria-labelledby="faq-heading">
      <JsonLd data={faqPageLd(faq)} />

      <div className="container">
        <div className="mx-auto max-w-2xl text-center">
          <h2 id="faq-heading" className="text-3xl font-bold tracking-tight sm:text-4xl">
            Частые вопросы
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Кратко отвечаем на популярные вопросы об эвакуации в Москве и области.
          </p>
        </div>

        <ul className="mx-auto mt-12 max-w-3xl space-y-3" aria-label="Список вопросов">
          {faq.map((item) => (
            <li key={item.question}>
              <details className="group rounded-xl border border-border bg-card p-5 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
                  <h3 className="font-semibold text-foreground">{item.question}</h3>
                  <span
                    className="ml-auto inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent transition-transform group-open:rotate-45"
                    aria-hidden="true"
                  >
                    +
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  {item.answer}
                </p>
              </details>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
