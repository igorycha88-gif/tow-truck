import { DynamicIcon } from '@/components/ui/DynamicIcon';
import { advantages } from '@/config/advantages';

// Преимущества. Server Component.
export function Advantages() {
  return (
    <section
      id="advantages"
      className="bg-secondary/30 py-16 md:py-24"
      aria-labelledby="advantages-heading"
    >
      <div className="container">
        <div className="mx-auto max-w-2xl text-center">
          <h2
            id="advantages-heading"
            className="text-3xl font-bold tracking-tight sm:text-4xl"
          >
            Почему выбирают нас
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Работаем круглосуточно и официально. Берёмся за сложные случаи.
          </p>
        </div>

        <ul
          className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
          aria-label="Преимущества"
        >
          {advantages.map((item) => (
            <li key={item.id} className="flex gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
                <DynamicIcon name={item.icon} className="h-6 w-6" />
              </span>
              <div>
                <h3 className="font-semibold">{item.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{item.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
