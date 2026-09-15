import { describe, it, expect } from 'vitest';
import {
  servicePages,
  getServicePage,
  servicePageSlugs,
  servicePagePriceLabel,
  catalogServiceToLanding,
} from '@/config/service-pages';
import { priceFromLabel, tariffs, minBaseFee } from '@/config/pricing';
import { getServiceBySlug } from '@/config/services';
import { SERVICE_TYPES } from '@/types';
import { formatPrice } from '@/lib/utils';

// Тесты реестра посадочных SEO-страниц (ЧТЗ_SEO_Рост_позиций_Вебмастер, ЭПИК-2, TASK-SEO2-008).

/** Все текстовые поля конфига (для проверки объёма и синхронизации цен). */
function allTexts(page: (typeof servicePages)[number]): string {
  return [
    page.title,
    page.description,
    page.h1,
    ...page.lead,
    ...page.included.flatMap((i) => [i.title, i.text]),
    page.priceNote ?? '',
    ...page.steps.flatMap((s) => [s.title, s.text]),
    ...page.faq.flatMap((f) => [f.question, f.answer]),
  ].join('\n');
}

// Разрешённые ценовые подстроки (формат единого источника pricing.ts, с nbsp от Intl).
const allowedPrices = [
  formatPrice(tariffs.lightVehicle.baseFee),
  formatPrice(tariffs.offroad.baseFee),
  formatPrice(tariffs.lightVehicle.perKm),
];

describe('service-pages: состав реестра (ЧТЗ табл. 4.1 + ЧТЗ SEO_нетиповые, корректировка 15.09)', () => {
  it('ровно 13 страниц с требуемыми слагами', () => {
    expect(servicePages).toHaveLength(13);
    expect([...servicePageSlugs()].sort()).toEqual(
      [
        'evakuator-24-7',
        'evakuator-legkovyh',
        'evakuator-posle-dtp',
        'evakuator-s-lebedkoj',
        'evakuaciya-mototehniki',
        'evakuator-vidnoe',
        'evakuator-zablokirovannyh-koles',
        'evakuaciya-spec-tehniki',
        'evakuaciya-elektromobilya',
        'evakuator-5-tonn',
        'evakuator-iz-podzemnogo-parkinga',
        'nochnoj-evakuator',
        'perevozka-avto-v-drugoy-gorod',
      ].sort(),
    );
  });

  it('getServicePage находит страницу, для мусорного слага — undefined', () => {
    expect(getServicePage('evakuator-24-7')?.h1).toBeTruthy();
    expect(getServicePage('no-such-page')).toBeUndefined();
  });

  it('слаги валидны для URL: [a-z0-9-]', () => {
    servicePages.forEach((p) => {
      expect(p.slug).toMatch(/^[a-z0-9-]+$/);
    });
  });
});

describe('service-pages: уникальность мета-данных (анти-каннибализация)', () => {
  it('title уникальны у всех страниц', () => {
    const titles = servicePages.map((p) => p.title);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it('description уникальны у всех страниц', () => {
    const descriptions = servicePages.map((p) => p.description);
    expect(new Set(descriptions).size).toBe(descriptions.length);
  });

  it('H1 уникальны у всех страниц', () => {
    const h1s = servicePages.map((p) => p.h1);
    expect(new Set(h1s).size).toBe(h1s.length);
  });

  it('title ≤ 60 символов (до обрезки в сниппете)', () => {
    servicePages.forEach((p) => {
      expect(p.title.length).toBeLessThanOrEqual(60);
    });
  });

  it('description ≤ 160 символов', () => {
    servicePages.forEach((p) => {
      expect(p.description.length).toBeLessThanOrEqual(160);
    });
  });

  it('главный ключ — в первых 30 символах title (позиции сниппета)', () => {
    const keys: Record<string, string> = {
      'evakuator-24-7': 'эвакуатор 24/7',
      'evakuator-posle-dtp': 'эвакуатор после дтп',
      'evakuator-s-lebedkoj': 'эвакуатор с лебёдкой',
      'evakuaciya-mototehniki': 'эвакуация мотоциклов',
      'evakuator-zablokirovannyh-koles': 'эвакуатор с заблокированными',
      'evakuator-vidnoe': 'эвакуатор в видном',
      'evakuator-legkovyh': 'эвакуатор легковых',
      'evakuaciya-spec-tehniki': 'эвакуация спецтехники',
      'evakuaciya-elektromobilya': 'эвакуация электромобиля',
      'evakuator-5-tonn': 'эвакуатор до 5 тонн',
      'evakuator-iz-podzemnogo-parkinga': 'эвакуатор из подземного',
      'nochnoj-evakuator': 'ночной эвакуатор',
      'perevozka-avto-v-drugoy-gorod': 'перевозка автомобиля',
    };
    servicePages.forEach((p) => {
      const key = keys[p.slug];
      expect(key, `ключ для ${p.slug}`).toBeTruthy();
      expect(
        p.title.toLowerCase().slice(0, 30),
        `title «${p.title}» должен начинаться с ключа`,
      ).toContain(key);
    });
  });
});

describe('service-pages: структура контента (ЧТЗ ЭПИК-2)', () => {
  it('лид-абзацы: не менее 2, каждый непустой', () => {
    servicePages.forEach((p) => {
      expect(p.lead.length).toBeGreaterThanOrEqual(2);
      p.lead.forEach((l) => expect(l.length).toBeGreaterThan(80));
    });
  });

  it('«Что входит в услугу»: не менее 5 пунктов', () => {
    servicePages.forEach((p) => {
      expect(p.included.length).toBeGreaterThanOrEqual(5);
      p.included.forEach((i) => {
        expect(i.title.length).toBeGreaterThan(3);
        expect(i.text.length).toBeGreaterThan(20);
      });
    });
  });

  it('шаги «Как проходит эвакуация»: 3–5 шагов', () => {
    servicePages.forEach((p) => {
      expect(p.steps.length).toBeGreaterThanOrEqual(3);
      expect(p.steps.length).toBeLessThanOrEqual(5);
    });
  });

  it('FAQ: 3–5 вопросов с непустыми ответами', () => {
    servicePages.forEach((p) => {
      expect(p.faq.length).toBeGreaterThanOrEqual(3);
      expect(p.faq.length).toBeLessThanOrEqual(5);
      p.faq.forEach((f) => {
        expect(f.question.endsWith('?')).toBe(true);
        expect(f.answer.length).toBeGreaterThan(60);
      });
    });
  });

  it('объём контента каждой страницы ≥ 350 слов (требование 600–900, нижний порог качества)', () => {
    servicePages.forEach((p) => {
      const words = allTexts(p).split(/\s+/).filter(Boolean).length;
      expect(
        words,
        `страница ${p.slug}: слишком мало текста (${words} слов)`,
      ).toBeGreaterThanOrEqual(350);
    });
  });
});

describe('service-pages: перелинковка (ЧТЗ ЭПИК-4)', () => {
  it('related: 2–3 существующих слага без ссылок на себя', () => {
    const slugs = servicePageSlugs();
    servicePages.forEach((p) => {
      expect(p.related.length).toBeGreaterThanOrEqual(2);
      expect(p.related.length).toBeLessThanOrEqual(3);
      p.related.forEach((r) => {
        expect(slugs).toContain(r);
        expect(r).not.toBe(p.slug);
      });
    });
  });

  it('каждая страница достижима из related хотя бы одной другой (нет сирот)', () => {
    const linked = new Set(servicePages.flatMap((p) => p.related));
    servicePages.forEach((p) => {
      expect(linked.has(p.slug), `страница ${p.slug} никто не ссылается`).toBe(true);
    });
  });

  it('catalogServiceToLanding: слаги существуют, типы услуг валидны', () => {
    const slugs = servicePageSlugs();
    Object.entries(catalogServiceToLanding).forEach(([serviceSlug, landing]) => {
      expect(SERVICE_TYPES).toContain(serviceSlug);
      expect(slugs).toContain(landing);
      expect(getServiceBySlug(serviceSlug)).toBeTruthy();
    });
  });

  it('orderServiceType каждой страницы — валидный тип услуги', () => {
    servicePages.forEach((p) => {
      expect(SERVICE_TYPES).toContain(p.orderServiceType);
    });
  });
});

describe('service-pages: цены из единого источника (рассинхрон = баг)', () => {
  it('любая цена «N ₽» в текстах страниц входит в разрешённые из pricing.ts', () => {
    const priceRe = /\d[\d\u00A0\s]*₽/gu;
    servicePages.forEach((p) => {
      const found = allTexts(p).match(priceRe) ?? [];
      found.forEach((price) => {
        const allowed = allowedPrices.some((a) => price.includes(a));
        expect(
          allowed,
          `${p.slug}: цена «${price}» не из pricing.ts (разрешено: ${allowedPrices.join(', ')})`,
        ).toBe(true);
      });
    });
  });

  it('title с ценой содержит актуальную «от N ₽» из pricing.ts', () => {
    const withPrice = servicePages.filter((p) => p.title.includes('₽'));
    expect(withPrice.length).toBeGreaterThanOrEqual(3);
    withPrice.forEach((p) => {
      // Цена в title обязана быть либо мин. подачей, либо тарифом offroad (для лебёдки)
      const ok =
        p.title.includes(priceFromLabel()) ||
        p.title.includes(formatPrice(tariffs.offroad.baseFee));
      expect(ok, `${p.slug}: цена в title не совпадает с pricing.ts`).toBe(true);
    });
  });

  it('servicePagePriceLabel: тариф → из каталога, fromMin → минимум, onRequest → по запросу', () => {
    const moto = getServicePage('evakuaciya-mototehniki')!;
    expect(servicePagePriceLabel(moto.price)).toBe(
      `Подача ${formatPrice(tariffs.moto.baseFee)} • ${formatPrice(tariffs.moto.perKm)}/км`,
    );
    const dtp = getServicePage('evakuator-posle-dtp')!;
    expect(servicePagePriceLabel(dtp.price)).toBe(`от ${formatPrice(minBaseFee())}`);
    expect(servicePagePriceLabel({ kind: 'onRequest' })).toBe('Цена по запросу');
  });
});
