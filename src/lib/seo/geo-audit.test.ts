import { describe, it, expect } from 'vitest';
import {
  countWords,
  localityUniqueBlocks,
  localityAuditRow,
  hubAuditRow,
  geoAuditRows,
  geoAuditCsv,
} from '@/lib/seo/geo-audit';
import { geoDirections } from '@/config/geo';

// Тесты чистых функций аудита гео-страниц (TASK-Я-03, шаг 1).

const makeDir = (over: Partial<(typeof geoDirections)[number]> = {}) => ({
  ...geoDirections[0]!,
  ...over,
}) as (typeof geoDirections)[number];

const makeLoc = (over: Record<string, unknown> = {}) =>
  ({
    ...geoDirections[0]!.localities[0]!,
    ...over,
  }) as (typeof geoDirections)[number]['localities'][number];

describe('seo.geo-audit.countWords (чистая функция)', () => {
  it('считает слова в строке (happy path)', () => {
    expect(countWords('раз два три')).toBe(3);
  });

  it('пустая строка и пробелы — 0 (edge case)', () => {
    expect(countWords('')).toBe(0);
    expect(countWords('   \n\t  ')).toBe(0);
  });
});

describe('seo.geo-audit.localityAuditRow', () => {
  it('уникальные блоки = lead + localIncluded + localFaq + sections', () => {
    const dir = makeDir();
    const loc = makeLoc();
    const uniqueWords = localityUniqueBlocks(loc).reduce((s, b) => s + countWords(b), 0);
    const row = localityAuditRow(dir, loc);
    expect(row.uniqueWords).toBe(uniqueWords);
    expect(row.totalWords).toBeGreaterThan(uniqueWords);
    expect(row.uniqueSharePercent).toBe(Math.round((uniqueWords / row.totalWords) * 100));
  });

  it('slug с префиксом evakuator-, direction — короткое имя хаба, depth 2', () => {
    const row = localityAuditRow(makeDir(), makeLoc());
    expect(row.slug).toMatch(/^evakuator-/);
    expect(row.direction).toBe(makeDir().hubBreadcrumbName);
    expect(row.depth).toBe(2);
  });

  it('нулевые блоки не делят на ноль (edge case)', () => {
    const dir = makeDir({
      baseIncluded: [],
      baseFaq: [],
      steps: [],
      priceNote: () => '',
    });
    const loc = makeLoc({
      lead: [],
      localIncluded: [],
      localFaq: [],
      sections: undefined,
      title: '',
      description: '',
    });
    const row = localityAuditRow(dir, loc);
    expect(row.totalWords).toBe(0);
    expect(row.uniqueSharePercent).toBe(0);
  });
});

describe('seo.geo-audit.hubAuditRow', () => {
  it('хаб: depth 1, уникальные блоки хаба считаются', () => {
    const row = hubAuditRow(makeDir());
    expect(row.slug).toBe(makeDir().hubSlug);
    expect(row.depth).toBe(1);
    expect(row.uniqueWords).toBeGreaterThan(0);
    expect(row.uniqueSharePercent).toBeGreaterThan(0);
    expect(row.uniqueSharePercent).toBeLessThanOrEqual(100);
  });
});

describe('seo.geo-audit.geoAuditRows / csv (интеграция на реестре)', () => {
  it('107 строк: 97 локаций + 10 хабов', () => {
    const rows = geoAuditRows(geoDirections);
    expect(rows).toHaveLength(107);
    expect(rows.filter((r) => r.depth === 1)).toHaveLength(10);
    expect(rows.filter((r) => r.depth === 2)).toHaveLength(97);
  });

  it('CSV: заголовок + 107 строк, формат slug;direction;total;unique;share;depth', () => {
    const csv = geoAuditCsv(geoAuditRows(geoDirections));
    const lines = csv.split('\n');
    expect(lines[0]).toBe('slug;direction;words_total;words_unique;unique_share_percent;depth_from_home');
    expect(lines).toHaveLength(108);
    lines.slice(1).forEach((l) => {
      expect(l.split(';')).toHaveLength(6);
    });
  });

  it('известные минимумы из ЧТЗ: ilinskij 312 слов (санити-проверка подсчёта)', () => {
    const rows = geoAuditRows(geoDirections);
    const ilinskij = rows.find((r) => r.slug === 'evakuator-ilinskij');
    expect(ilinskij).toBeTruthy();
    // Порядок величины из ЧТЗ §Я-03: минимальные страницы ~312–324 слов
    expect(ilinskij!.totalWords).toBeGreaterThan(250);
    expect(ilinskij!.totalWords).toBeLessThan(450);
  });
});
