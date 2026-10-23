import type { FaqItem } from '@/types';
import type { ServicePageInclude, ServicePageSection } from '@/types/service-page';
import type { GeoDirection, GeoLocality } from '@/config/geo/types';

// Чистые функции аудита гео-страниц (ЧТЗ_Яндекс_SEO_доработка_2026-10,
// TASK-Я-03, шаг 1): доля уникального контента и объём — для отбора волны
// доработки «малоценных» страниц. Без side effects: работает на данных
// направлений (lead/localIncluded/localFaq/sections — уникальные блоки).

/** Строка аудита одной гео-страницы. */
export type GeoAuditRow = {
  slug: string;
  /** Направление (округ Москвы / направление МО). */
  direction: string;
  /** Слов всего (весь текстовый контент страницы). */
  totalWords: number;
  /** Слов в уникальных блоках (lead + localIncluded + localFaq + sections). */
  uniqueWords: number;
  /** Доля уникального, % (0–100, округление до целого). */
  uniqueSharePercent: number;
  /** Глубина от главной (хаб = 1, локация = 2). */
  depth: number;
};

/** Подсчёт слов в тексте (чистая функция, unit-тестируемая). */
export function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

/** Сумма слов по блокам страницы. */
const blocksWords = (...blocks: string[]): number =>
  blocks.reduce((sum, b) => sum + countWords(b), 0);

const includedWords = (items: ServicePageInclude[]): string[] =>
  items.flatMap((i) => [i.title, i.text]);

const faqWords = (items: FaqItem[]): string[] =>
  items.flatMap((f) => [f.question, f.answer]);

const sectionWords = (sections?: ServicePageSection[]): string[] =>
  (sections ?? []).flatMap((s) => [
    s.title,
    ...(s.paragraphs ?? []),
    ...(s.bullets ?? []),
    ...(s.table
      ? [s.table.head.join(' '), ...s.table.rows.map((r) => r.join(' ')), s.table.note ?? '']
      : []),
  ]);

const directionLabel = (dir: GeoDirection): string => dir.hubBreadcrumbName;

/** Уникальные блоки локации: lead + localIncluded + localFaq + sections. */
export function localityUniqueBlocks(loc: GeoLocality): string[] {
  return [
    ...loc.lead,
    ...includedWords(loc.localIncluded),
    ...faqWords(loc.localFaq),
    ...sectionWords(loc.sections),
  ];
}

/** Аудит локации: уникальные блоки + общие блоки направления. */
export function localityAuditRow(dir: GeoDirection, loc: GeoLocality): GeoAuditRow {
  const uniqueWords = blocksWords(...localityUniqueBlocks(loc));
  const commonWords = blocksWords(
    ...includedWords(dir.baseIncluded),
    ...faqWords(dir.baseFaq.map((f) => ({ question: f.question(loc.nameIn), answer: f.answer(loc.nameIn) }))),
    ...dir.steps.flatMap((s) => [s.title, s.text]),
    dir.priceNote(loc.nameIn),
    loc.title,
    loc.description,
  );
  const totalWords = uniqueWords + commonWords;
  return {
    slug: `evakuator-${loc.slug}`,
    direction: directionLabel(dir),
    totalWords,
    uniqueWords,
    uniqueSharePercent: totalWords === 0 ? 0 : Math.round((uniqueWords / totalWords) * 100),
    depth: 2,
  };
}

/** Аудит хаба направления: уникальные блоки хаба + общие шаги. */
export function hubAuditRow(dir: GeoDirection): GeoAuditRow {
  const uniqueWords = blocksWords(
    ...dir.hubLead,
    ...includedWords(dir.hubIncluded),
    ...faqWords(dir.hubFaq),
    dir.hubTitle,
    dir.hubDescription,
    dir.hubPriceNote,
  );
  const commonWords = blocksWords(...dir.steps.flatMap((s) => [s.title, s.text]));
  const totalWords = uniqueWords + commonWords;
  return {
    slug: dir.hubSlug,
    direction: directionLabel(dir),
    totalWords,
    uniqueWords,
    uniqueSharePercent: totalWords === 0 ? 0 : Math.round((uniqueWords / totalWords) * 100),
    depth: 1,
  };
}

/** Аудит всех гео-страниц (107): локации + хабы. */
export function geoAuditRows(directions: GeoDirection[]): GeoAuditRow[] {
  return directions.flatMap((dir) => [
    ...dir.localities.map((l) => localityAuditRow(dir, l)),
    hubAuditRow(dir),
  ]);
}

/** CSV-строки для выгрузки (`slug;direction;totalWords;uniqueWords;share;depth`). */
export function geoAuditCsv(rows: GeoAuditRow[]): string {
  const header = 'slug;direction;words_total;words_unique;unique_share_percent;depth_from_home';
  const lines = rows.map(
    (r) => `${r.slug};${r.direction};${r.totalWords};${r.uniqueWords};${r.uniqueSharePercent};${r.depth}`,
  );
  return [header, ...lines].join('\n');
}
