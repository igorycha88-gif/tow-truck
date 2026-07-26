import { DynamicIcon } from '@/components/ui/DynamicIcon';
import { processSteps } from '@/config/process-steps';

// Схема работы 1→2→3→4. Server Component.
export function Process() {
  return (
    <section id="process" className="py-16 md:py-24" aria-labelledby="process-heading">
      <div className="container">
        <div className="mx-auto max-w-2xl text-center">
          <h2
            id="process-heading"
            className="text-3xl font-bold tracking-tight sm:text-4xl"
          >
            Как мы работаем
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            От звонка до погрузки — минимум 15 минут.
          </p>
        </div>

        <ol
          className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4"
          aria-label="Схема работы"
        >
          {processSteps.map((step) => (
            <li key={step.step} className="relative">
              <div className="rounded-xl border border-border bg-card p-6 text-center">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-accent/10 text-accent">
                  <DynamicIcon name={step.icon} className="h-7 w-7" />
                </span>
                <div className="mt-4 text-sm font-bold uppercase tracking-wide text-accent">
                  Шаг {step.step}
                </div>
                <h3 className="mt-1 font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
