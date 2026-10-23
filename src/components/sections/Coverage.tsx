import Link from 'next/link';
import { geoDirections } from '@/config/geo';
import { COVERAGE_TOP_LOCALITIES_PER_HUB } from '@/config/seo-links';

// Блок «Районы и города, где мы работаем» (EV-T5, ADR-015): ссылки на все 10
// гео-хабов + топ-локации. Server Component, обычные <a href> (без JS) —
// главная → хаб (1 клик) → любая локация (2 клика). Сетка 1/2/5 колонок,
// область нажатия ≥44px (ЧТЗ §5 НФТ).

export function Coverage() {
  const moscowDirs = geoDirections.filter((d) => d.id.startsWith('moscow-'));
  const moDirs = geoDirections.filter((d) => !d.id.startsWith('moscow-'));

  const renderGroup = (dirs: typeof geoDirections, label: string) => (
    <div>
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </h3>
      <ul className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-5">
        {dirs.map((dir) => (
          <li key={dir.hubSlug} className="min-w-0">
            <Link
              href={`/${dir.hubSlug}`}
              className="block py-2 text-sm font-medium text-foreground hover:text-accent"
            >
              {dir.hubH1}
            </Link>
            <ul className="space-y-0.5">
              {dir.localities
                .slice(0, COVERAGE_TOP_LOCALITIES_PER_HUB)
                .map((loc) => (
                  <li key={loc.slug}>
                    <Link
                      href={`/evakuator-${loc.slug}`}
                      className="block py-1.5 text-sm text-muted-foreground hover:text-foreground"
                    >
                      {loc.name}
                    </Link>
                  </li>
                ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <section className="py-12 md:py-16" aria-labelledby="coverage-heading">
      <div className="container">
        <h2
          id="coverage-heading"
          className="text-2xl font-bold tracking-tight sm:text-3xl"
        >
          Эвакуатор по районам Москвы и городам МО
        </h2>
        <p className="mt-3 max-w-3xl leading-relaxed text-muted-foreground">
          Дежурные эвакуаторы распределены по всему городу и области: выберите
          округ Москвы или направление Подмосковья — рядом с вами всегда есть
          свободная машина.
        </p>
        <div className="mt-8 space-y-8">
          {renderGroup(moscowDirs, 'Округа Москвы')}
          {renderGroup(moDirs, 'Направления Московской области')}
        </div>
      </div>
    </section>
  );
}
