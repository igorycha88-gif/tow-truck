import { geoDirections } from '@/config/geo';

// ЕДИНЫЙ источник ссылок главной и подвала (ЧТЗ_SEO_Техническая_корректировка
// 2026-10, TASK-EV-T5, ADR-015). Используется компонентами (Coverage, Footer)
// и тестом графа перелинковки (src/lib/seo/link-graph.test.ts) — чтобы BFS
// проверял ровно те ссылки, что рендерятся в HTML.

/** Посадочные услуг в подвале (evakuator-vidnoe убран — он на главной в Contacts;
 *  nochnoj-evakuator добавлен: цепочка 24/7 → ночь → электромобили → паркинг ≤ 3 кликов). */
export const footerLandingLinks: string[] = [
  'ceny',
  'sravnenie-evakuatorov-moskva',
  'evakuator-24-7',
  'nochnoj-evakuator',
  'evakuator-posle-dtp',
  'evakuator-legkovyh',
];

/** 10 гео-хабов: колонка «География» в подвале + блок Coverage на главной. */
export const coverageHubLinks: string[] = geoDirections.map((d) => d.hubSlug);

/** Топ-локаций под каждым хабом в блоке Coverage (3 шт. — итог ≤50 ссылок на главной). */
export const COVERAGE_TOP_LOCALITIES_PER_HUB = 3;

/** Самые востребованные локации каждого направления (первые по списку до данных Вебмастера). */
export const coverageTopLocalityLinks: string[] = geoDirections.flatMap((d) =>
  d.localities
    .slice(0, COVERAGE_TOP_LOCALITIES_PER_HUB)
    .map((l) => `evakuator-${l.slug}`),
);
