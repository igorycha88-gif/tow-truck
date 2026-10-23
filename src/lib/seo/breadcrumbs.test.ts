import { describe, it, expect } from 'vitest';
import { landingPages } from '@/config/geo';
import { breadcrumbItemsFor, breadcrumbGraphItemsFor } from '@/lib/seo/breadcrumbs';
import { absoluteUrl } from '@/lib/seo/url';

// Навигационные цепочки по требованиям Яндекса (ЧТЗ_Яндекс_SEO_доработка
// 2026-10, TASK-Я-02): Яндекс исключает из цепочки элемент на главную,
// элементы короче 4 символов и «слишком длинные»; рекомендует до 3 элементов.
// Проверяем ВСЕ 123 посадочные: ≤3 элементов, name 4–40, URL — Punycode-хост.

const HOST = absoluteUrl('/');

describe('seo.breadcrumbs (TASK-Я-02): все 123 посадочные', () => {
  it('реестр полный: 123 страницы', () => {
    expect(landingPages).toHaveLength(123);
  });

  it.each(landingPages.map((p) => [p.slug, p]))('%s: цепочка валидна', (_slug, page) => {
    const graph = breadcrumbGraphItemsFor(page);

    // ≤3 элементов (Главная → хаб → текущая)
    expect(graph.length, `${page.slug}: ${graph.length} элементов в цепочке`).toBeLessThanOrEqual(3);

    // Каждый name 4–40 символов (Яндекс исключает короткие и «слишком длинные»)
    graph.forEach((item) => {
      expect(
        item.name.length,
        `${page.slug}: имя «${item.name}» вне диапазона 4–40`,
      ).toBeGreaterThanOrEqual(4);
      expect(item.name.length).toBeLessThanOrEqual(40);
    });

    // Все item — абсолютные URL на Punycode-хосте (кириллица в URL запрещена)
    graph.forEach((item) => {
      expect(item.url.startsWith(HOST), `${page.slug}: ${item.url} не на ${HOST}`).toBe(true);
    });

    // Последний элемент — текущая страница, первый — главная
    expect(graph[0]?.name).toBe('Главная');
    expect(graph[graph.length - 1]?.url).toBe(absoluteUrl(`/${page.slug}`));

    // Видимые крошки = JSON-LD минус «Главная»: одни и те же имена
    const visible = breadcrumbItemsFor(page);
    expect(visible.map((i) => i.name)).toEqual(graph.slice(1).map((i) => i.name));
  });

  it('локация: Главная → хаб (короткое имя) → локация (3 элемента)', () => {
    const marino = landingPages.find((p) => p.slug === 'evakuator-marino')!;
    const graph = breadcrumbGraphItemsFor(marino);
    expect(graph.map((i) => i.name)).toEqual(['Главная', 'ЮВАО Москвы', 'Марьино']);
  });

  it('услуга без родителя: Главная → услуга (2 элемента, ожидаемо для Яндекса)', () => {
    const ceny = landingPages.find((p) => p.slug === 'ceny')!;
    expect(breadcrumbGraphItemsFor(ceny).map((i) => i.name)).toEqual(['Главная', 'Цены']);
  });

  it('хаб: короткое имя вместо полного H1', () => {
    const vao = landingPages.find((p) => p.slug === 'evakuator-vao-moskvy')!;
    const graph = breadcrumbGraphItemsFor(vao);
    expect(graph).toHaveLength(2);
    expect(graph[1]?.name).toBe('ВАО Москвы');
    expect(graph[1]?.name).not.toBe(vao.h1);
  });
});
