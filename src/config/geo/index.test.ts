import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
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
import { services } from '@/config/services';
import { faq as faqItems } from '@/config/faq';
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
  it('102 гео-страницы: 94 локации + 8 хабов', () => {
    expect(geoPages).toHaveLength(102);
    expect(geoHubs).toHaveLength(8);
    expect(localityPages).toHaveLength(94);
  });

  it('115 посадочных в объединённом реестре (13 услуг + 102 гео)', () => {
    expect(landingPages).toHaveLength(115);
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
  it('title уникальны по всем 115 посадочным', () => {
    const titles = landingPages.map((p) => p.title);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it('description уникальны по всем 115 посадочным', () => {
    const descriptions = landingPages.map((p) => p.description);
    expect(new Set(descriptions).size).toBe(descriptions.length);
  });

  it('H1 уникальны по всем 115 посадочным', () => {
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
      'moscow-yuzao',
      'moscow-zao',
      'mo-vostok',
      'mo-yugo-vostok',
      'mo-yug',
    ];
    geoDirections.forEach((d) => {
      expect(validIds).toContain(d.id);
    });
  });

  it('8 направлений: 15 ВАО + 12 ЮВАО + 15 ЮАО + 12 ЮЗАО + 12 ЗАО + 11 МО-восток + 14 ЮВ МО + 3 Ю МО', () => {
    const counts = Object.fromEntries(geoDirections.map((d) => [d.id, d.localities.length]));
    expect(counts['moscow-vao']).toBe(15);
    expect(counts['moscow-yuvao']).toBe(12);
    expect(counts['moscow-yuao']).toBe(15);
    expect(counts['moscow-yuzao']).toBe(12);
    expect(counts['moscow-zao']).toBe(12);
    expect(counts['mo-vostok']).toBe(11);
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

// ЧТЗ_SEO_Рост_позиций_Вебмастер_v2: ЮЗАО/ЗАО — литературные + разговорные запросы,
// лимит 15 тонн (запрет грузовой тематики), грамматика nameIn.

describe('geo: обе формы запросов ЮЗАО/ЗАО (ЧТЗ SEO-Вебмастер v2 §3.1, §7.3)', () => {
  const newDirections = geoDirections.filter((d) => d.id === 'moscow-yuzao' || d.id === 'moscow-zao');

  it('24 локации ЮЗАО/ЗАО зарегистрированы, страницы открываются из реестра', () => {
    expect(newDirections).toHaveLength(2);
    const localities = newDirections.flatMap((d) => d.localities);
    expect(localities).toHaveLength(24);
    localities.forEach((l) => {
      const page = getGeoPage(`evakuator-${l.slug}`);
      expect(page, `evakuator-${l.slug} отсутствует в реестре`).toBeTruthy();
    });
  });

  it('title и H1 начинаются с разговорного ключа «Эвакуатор <Имя>»', () => {
    newDirections.flatMap((d) => d.localities).forEach((l) => {
      const page = getGeoPage(`evakuator-${l.slug}`)!;
      const name = l.h1Name ?? l.name;
      expect(page.title.startsWith(`Эвакуатор ${name}`), `${l.slug}: title не разговорный`).toBe(true);
      expect(page.h1).toBe(`Эвакуатор ${name}`);
    });
  });

  it('description содержит литературную форму (nameIn) и обе формы в хаб-метах', () => {
    newDirections.flatMap((d) => d.localities).forEach((l) => {
      const page = getGeoPage(`evakuator-${l.slug}`)!;
      expect(l.nameIn.length).toBeGreaterThan(3);
      expect(l.nameIn).toMatch(/^(в|на) /);
      expect(page.description, `${l.slug}: description без литературной формы`).toContain(l.nameIn);
    });
    const yuzaoHub = getGeoPage('evakuator-yuzao-moskvy')!;
    expect(yuzaoHub.title).toContain('Эвакуатор ЮЗАО');
    expect(yuzaoHub.description).toContain('в юго-западном округе Москвы');
    const zaoHub = getGeoPage('evakuator-zao-moskvy')!;
    expect(zaoHub.title).toContain('Эвакуатор ЗАО');
    expect(zaoHub.description).toContain('в западном округе Москвы');
  });

  it('грамматика nameIn: корректная предложная форма (ЧТЗ §7.4)', () => {
    const expected = {
      akademicheskij: 'в Академическом',
      gagarinskij: 'в Гагаринском',
      zyuzino: 'в Зюзино',
      konkovo: 'в Конькове',
      kotlovka: 'в Котловке',
      lomonosovskij: 'в Ломоносовском',
      obruchevskij: 'в Обручевском',
      'severnoe-butovo': 'в Северном Бутово',
      'teplyj-stan': 'в Тёплом Стане',
      cheremushki: 'в Черёмушках',
      'yuzhnoe-butovo': 'в Южном Бутово',
      yasenevo: 'в Ясенево',
      dorogomilovo: 'в Дорогомилово',
      krylatskoe: 'в Крылатском',
      kuncevo: 'в Кунцеве',
      mozhajskij: 'в Можайском',
      'novo-peredelkino': 'в Ново-Переделкино',
      'ochakovo-matveevskoe': 'в Очаково-Матвеевском',
      'prospekt-vernadskogo': 'на проспекте Вернадского',
      ramenki: 'в Раменках',
      solncevo: 'в Солнцеве',
      'troparevo-nikulino': 'в Тропарёво-Никулино',
      'filevskij-park': 'в Филёвском парке',
      'fili-davydkovo': 'в Фили-Давыдково',
    } as const;
    newDirections.flatMap((d) => d.localities).forEach((l) => {
      expect(l.nameIn, `${l.slug}: некорректная предложная форма`).toBe(expected[l.slug as keyof typeof expected]);
    });
  });

  it('FAQ новых локаций: 1 литературный вопрос + 1 разговорный (ЧТЗ §3.1)', () => {
    newDirections.flatMap((d) => d.localities).forEach((l) => {
      const page = getGeoPage(`evakuator-${l.slug}`)!;
      const questions = page.faq.map((f) => f.question);
      expect(questions, `${l.slug}: нет литературного FAQ`).toContain(`Сколько стоит эвакуатор ${l.nameIn}?`);
      expect(questions, `${l.slug}: нет разговорного FAQ`).toContain(`Эвакуатор ${l.h1Name} — как быстро приедете?`);
    });
  });
});

describe('geo: запрет грузовой тематики, лимит 15 тонн (ЧТЗ ЭПИК-2, §7.5)', () => {
  const forbiddenRe = new RegExp(['грузовик', 'автопоезд', 'полуприцеп', 'фура'].join('|'));

  function listSourceFiles(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        out.push(...listSourceFiles(full));
      } else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.(ts|tsx)$/.test(entry)) {
        out.push(full);
      }
    }
    return out;
  }

  it('по src/ нет запрещённых грузовых терминов', () => {
    const files = listSourceFiles(resolve(process.cwd(), 'src'));
    expect(files.length).toBeGreaterThan(0);
    files.forEach((file) => {
      const content = readFileSync(file, 'utf8');
      const match = content.match(forbiddenRe);
      expect(match, `${file}: запрещённый термин «${match?.[0]}»`).toBeNull();
    });
  });

  it('«тонн» встречается только как «до 15 тонн» / «до 5 тонн» (или «тоннель»)', () => {
    const files = listSourceFiles(resolve(process.cwd(), 'src'));
    files.forEach((file) => {
      const content = readFileSync(file, 'utf8');
      const rest = content
        .replace(/до 15 тонн/g, '')
        .replace(/до 5 тонн/g, '')
        .replace(/тоннел\w*/gi, '');
      expect(rest, `${file}: «тонн» вне контекста «до 15 тонн»`).not.toMatch(/тонн/i);
    });
  });

  it('карточка «спецтехника» и FAQ честно указывают лимит 15 тонн', () => {
    const commercial = services.find((s) => s.slug === 'commercial')!;
    expect(commercial.title).toBe('Эвакуация спецтехники');
    expect(commercial.description).toContain('до 15 тонн');
    const faqText = faqItems.map((f) => f.question + f.answer).join('\n');
    expect(faqText).toContain('до 15 тонн');
  });
});

// ЧТЗ_SEO_Разговорные_запросы_Восток: разговорные поисковые ключи без предлогов
// + посадочные для трасс Горьковка (М-7) и шоссе Энтузиастов.

describe('geo: разговорные ключи и трассы (ЧТЗ SEO-восток)', () => {
  it('Балашиха, Реутов, Новогиреево: разговорные title, H1 и description', () => {
    const bal = getGeoPage('evakuator-balashiha')!;
    expect(bal.title).toBe('Эвакуатор Балашиха — 24/7, подача ~20 минут');
    expect(bal.h1).toBe('Эвакуатор Балашиха');
    expect(bal.description.startsWith('Эвакуатор Балашиха:')).toBe(true);

    const reut = getGeoPage('evakuator-reutov')!;
    expect(reut.title).toBe('Эвакуатор Реутов — 24/7, подача ~15 минут');
    expect(reut.h1).toBe('Эвакуатор Реутов');
    expect(reut.description.startsWith('Эвакуатор Реутов:')).toBe(true);

    const novo = getGeoPage('evakuator-novogireevo')!;
    expect(novo.title).toBe('Эвакуатор Новогиреево — 24/7, подача ~15 минут');
    expect(novo.h1).toBe('Эвакуатор Новогиреево');
    expect(novo.description.startsWith('Эвакуатор Новогиреево')).toBe(true);
  });

  it('nameIn сохранён: грамматика базовых FAQ не сломана', () => {
    const bal = getGeoPage('evakuator-balashiha')!;
    expect(bal.faq.map((f) => f.question)).toContain('Сколько стоит эвакуатор в Балашихе?');
    expect(bal.priceNote).toContain('Подача эвакуатора в Балашихе');
  });

  it('трасса Горьковка: страница в реестре, разговорный H1, дистанция задана', () => {
    const gorkovka = getGeoPage('evakuator-gorkovka')!;
    expect(gorkovka.title).toBe('Эвакуатор Горьковка — 24/7, подача ~20 минут');
    expect(gorkovka.h1).toBe('Эвакуатор Горьковка');
    expect(gorkovka.areaName).toBe('Горьковка, Московская область');
    expect(gorkovka.parent?.slug).toBe('evakuator-vostok-podmoskovya');
  });

  it('трасса шоссе Энтузиастов: разговорный H1 и areaServed без «район»', () => {
    const shosse = getGeoPage('evakuator-shosse-entuziastov')!;
    expect(shosse.title).toBe('Эвакуатор шоссе Энтузиастов — 24/7, ~15 минут');
    expect(shosse.h1).toBe('Эвакуатор шоссе Энтузиастов');
    expect(shosse.areaName).toBe('шоссе Энтузиастов, Москва');
    expect(shosse.parent?.slug).toBe('evakuator-vao-moskvy');
  });

  it('новые трассы перелинкованы между собой и с соседями', () => {
    const gorkovka = getGeoPage('evakuator-gorkovka')!;
    const shosse = getGeoPage('evakuator-shosse-entuziastov')!;
    expect(gorkovka.related).toContain('evakuator-shosse-entuziastov');
    expect(shosse.related).toContain('evakuator-gorkovka');

    const vaoHub = getGeoPage('evakuator-vao-moskvy')!;
    const vostokHub = getGeoPage('evakuator-vostok-podmoskovya')!;
    expect(vaoHub.related).toContain('evakuator-shosse-entuziastov');
    expect(vostokHub.related).toContain('evakuator-gorkovka');
  });

  it('новые трассы отвечают на разговорные запросы в FAQ (nameIn с «на»)', () => {
    const gorkovka = getGeoPage('evakuator-gorkovka')!;
    expect(gorkovka.faq.map((f) => f.question)).toContain('Сколько стоит эвакуатор на Горьковке?');
    const shosse = getGeoPage('evakuator-shosse-entuziastov')!;
    expect(shosse.faq.map((f) => f.question)).toContain(
      'Приедете ли вы на шоссе Энтузиастов ночью?',
    );
  });
});
