import { describe, it, expect } from 'vitest';
import {
  geoPages,
  geoHubs,
  geoDirections,
  landingPages,
  getLandingPage,
  landingSlugs,
  getGeoPage,
} from '@/config/geo';
import { servicePages } from '@/config/service-pages';
import { tariffs } from '@/config/pricing';
import { formatPrice } from '@/lib/utils';

// Тесты гео-модуля (ADR-003, ЧТЗ_Гео §7.1): состав, уникальность (анти-дорвей),
// структура контента, перелинковка, дистанции МО, цены из единого источника.

const hubSlugs = new Set(geoHubs.map((h) => h.slug));
const localityPages = geoPages.filter((p) => !hubSlugs.has(p.slug));

/** Все текстовые поля страницы — для проверки объёма и цен. */
function allTexts(page: (typeof landingPages)[number]): string {
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

const allowedPrices = [
  formatPrice(tariffs.lightVehicle.baseFee),
  formatPrice(tariffs.offroad.baseFee),
  formatPrice(tariffs.lightVehicle.perKm),
];

describe('geo: состав реестра (ЧТЗ §2.2)', () => {
  it('74 гео-страницы: 68 локаций + 6 хабов', () => {
    expect(geoPages).toHaveLength(74);
    expect(geoHubs).toHaveLength(6);
    expect(localityPages).toHaveLength(68);
  });

  it('81 посадочная в объединённом реестре (7 услуг + 74 гео)', () => {
    expect(landingPages).toHaveLength(81);
    expect(landingPages.length).toBe(servicePages.length + geoPages.length);
  });

  it('все слаги валидны [a-z0-9-] и начинаются с evakuator-', () => {
    geoPages.forEach((p) => {
      expect(p.slug).toMatch(/^evakuator-[a-z0-9-]+$/);
    });
  });

  it('слаги уникальны по всему объединённому реестру', () => {
    const slugs = landingSlugs();
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('getLandingPage находит гео-страницу, для мусорного слага — undefined', () => {
    expect(getLandingPage('evakuator-marino')?.h1).toBeTruthy();
    expect(getLandingPage('evakuator-lyubercy')?.h1).toBeTruthy();
    expect(getLandingPage('evakuator-yuvao-moskvy')?.h1).toBeTruthy();
    expect(getLandingPage('no-such-page')).toBeUndefined();
    expect(getGeoPage('evakuator-marino')?.h1).toBeTruthy();
  });
});

describe('geo: уникальность мета-данных (анти-дорвей, ЧТЗ §3.2)', () => {
  it('title уникальны по всем 81 страницам', () => {
    const titles = landingPages.map((p) => p.title);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it('description уникальны по всем 81 страницам', () => {
    const descriptions = landingPages.map((p) => p.description);
    expect(new Set(descriptions).size).toBe(descriptions.length);
  });

  it('H1 уникальны по всем 81 страницам', () => {
    const h1s = landingPages.map((p) => p.h1);
    expect(new Set(h1s).size).toBe(h1s.length);
  });

  it('лид-абзацы уникальны (lead[0] и lead[1] отдельно)', () => {
    const lead0 = landingPages.map((p) => p.lead[0]);
    const lead1 = landingPages.map((p) => p.lead[1]);
    expect(new Set(lead0).size).toBe(lead0.length);
    expect(new Set(lead1).size).toBe(lead1.length);
  });

  it('вопросы FAQ уникальны по всем страницам', () => {
    const questions = landingPages.flatMap((p) => p.faq.map((f) => f.question));
    expect(new Set(questions).size).toBe(questions.length);
  });

  it('localIncluded titles уникальны по всем локациям', () => {
    const titles = geoDirections.flatMap((dir) =>
      dir.localities.flatMap((l) => l.localIncluded.map((i) => i.title)),
    );
    expect(new Set(titles).size).toBe(titles.length);
  });

  it('внутри одной страницы included titles не дублируются', () => {
    geoPages.forEach((p) => {
      const titles = p.included.map((i) => i.title);
      expect(new Set(titles).size).toBe(titles.length);
    });
  });
});

describe('geo: структура контента (ЧТЗ §3.2, §7.1)', () => {
  it('title ≤60 символов, ключ «эвакуатор» в первых 30', () => {
    geoPages.forEach((p) => {
      expect(p.title.length).toBeLessThanOrEqual(60);
      expect(p.title.toLowerCase().slice(0, 30)).toContain('эвакуатор');
    });
  });

  it('description ≤160 символов', () => {
    geoPages.forEach((p) => {
      expect(p.description.length).toBeLessThanOrEqual(160);
    });
  });

  it('лид: 2 абзаца, каждый >80 символов', () => {
    geoPages.forEach((p) => {
      expect(p.lead.length).toBe(2);
      p.lead.forEach((l) => expect(l.length).toBeGreaterThan(80));
    });
  });

  it('included: ≥5 карточек', () => {
    geoPages.forEach((p) => {
      expect(p.included.length).toBeGreaterThanOrEqual(5);
      p.included.forEach((i) => {
        expect(i.title.length).toBeGreaterThan(3);
        expect(i.text.length).toBeGreaterThan(20);
      });
    });
  });

  it('FAQ: 3–5 вопросов, ответы >60 символов, вопрос заканчивается на ?', () => {
    geoPages.forEach((p) => {
      expect(p.faq.length).toBeGreaterThanOrEqual(3);
      expect(p.faq.length).toBeLessThanOrEqual(5);
      p.faq.forEach((f) => {
        expect(f.question.endsWith('?')).toBe(true);
        expect(f.answer.length).toBeGreaterThan(60);
      });
    });
  });

  it('объём контента ≥350 слов (нижний порог качества)', () => {
    geoPages.forEach((p) => {
      const words = allTexts(p).split(/\s+/).filter(Boolean).length;
      expect(words, `${p.slug}: слишком мало текста (${words} слов)`).toBeGreaterThanOrEqual(350);
    });
  });

  it('orderServiceType каждой страницы — light_vehicle', () => {
    geoPages.forEach((p) => {
      expect(p.orderServiceType).toBe('light_vehicle');
    });
  });

  it('price kind = fromMin (единый источник, без хардкода)', () => {
    geoPages.forEach((p) => {
      expect(p.price.kind).toBe('fromMin');
    });
  });
});

describe('geo: перелинковка (ЧТЗ §3.3)', () => {
  it('все related слаги существуют в объединённом реестре', () => {
    const slugs = new Set(landingSlugs());
    geoPages.forEach((p) => {
      p.related.forEach((r) => {
        expect(slugs.has(r), `${p.slug}: related «${r}» не существует`).toBe(true);
      });
    });
  });

  it('локация: related 2–3 и начинается с хаба направления', () => {
    localityPages.forEach((p) => {
      expect(p.related.length).toBeGreaterThanOrEqual(2);
      expect(p.related.length).toBeLessThanOrEqual(3);
      expect(p.related[0]).toBe(p.parent?.slug);
    });
  });

  it('локация не ссылается на себя', () => {
    geoPages.forEach((p) => {
      expect(p.related).not.toContain(p.slug);
    });
  });

  it('хаб: related содержит все локации направления', () => {
    geoDirections.forEach((dir) => {
      const hub = getGeoPage(dir.hubSlug)!;
      const localitySlugs = dir.localities.map((l) => `evakuator-${l.slug}`);
      localitySlugs.forEach((slug) => {
        expect(hub.related, `хаб ${dir.hubSlug} не содержит ${slug}`).toContain(slug);
      });
    });
  });

  it('хаб: relatedTitle задан (не дефолт «Смежные услуги»)', () => {
    geoHubs.forEach((h) => {
      expect(h.relatedTitle).toBeTruthy();
      expect(h.relatedTitle).not.toBe('Смежные услуги');
    });
  });

  it('каждая локация имеет parent (хлебные крошки)', () => {
    localityPages.forEach((p) => {
      expect(p.parent).toBeTruthy();
      expect(p.parent?.slug).toMatch(/^evakuator-/);
    });
  });

  it('каждая локация имеет areaName для schema.org', () => {
    localityPages.forEach((p) => {
      expect(p.areaName).toBeTruthy();
      expect(p.areaName!.length).toBeGreaterThan(5);
    });
  });
});

describe('geo: МО — дистанции и направления (ЧТЗ §2.2)', () => {
  it('все города МО ≤30 км от МКАД', () => {
    geoDirections
      .filter((d) => d.id.startsWith('mo-'))
      .flatMap((d) => d.localities)
      .forEach((l) => {
        expect(l.distanceKm, `${l.slug}: дистанция не задана`).toBeDefined();
        expect(l.distanceKm!).toBeLessThanOrEqual(30);
      });
  });

  it('у районов Москвы нет distanceKm', () => {
    geoDirections
      .filter((d) => d.id.startsWith('moscow-'))
      .flatMap((d) => d.localities)
      .forEach((l) => {
        expect(l.distanceKm).toBeUndefined();
      });
  });

  it('direction id валидны', () => {
    const validIds = [
      'moscow-vao',
      'moscow-yuao',
      'moscow-yuvao',
      'mo-vostok',
      'mo-yugo-vostok',
      'mo-yug',
    ];
    geoDirections.forEach((d) => {
      expect(validIds).toContain(d.id);
    });
  });

  it('6 направлений: 14+12+15 районов Москвы + 10+14+3 городов МО', () => {
    const counts = Object.fromEntries(geoDirections.map((d) => [d.id, d.localities.length]));
    expect(counts['moscow-vao']).toBe(14);
    expect(counts['moscow-yuvao']).toBe(12);
    expect(counts['moscow-yuao']).toBe(15);
    expect(counts['mo-vostok']).toBe(10);
    expect(counts['mo-yugo-vostok']).toBe(14);
    expect(counts['mo-yug']).toBe(3);
  });
});

describe('geo: цены из единого источника (рассинхрон = баг)', () => {
  it('любая цена «N ₽» в текстах гео-страниц входит в разрешённые из pricing.ts', () => {
    const priceRe = /\d[\d\u00A0\s]*₽/gu;
    geoPages.forEach((p) => {
      const found = allTexts(p).match(priceRe) ?? [];
      found.forEach((price) => {
        const allowed = allowedPrices.some((a) => price.includes(a));
        expect(allowed, `${p.slug}: цена «${price}» не из pricing.ts`).toBe(true);
      });
    });
  });
});
