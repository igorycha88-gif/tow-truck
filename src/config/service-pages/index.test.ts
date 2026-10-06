import { describe, it, expect } from 'vitest';
import {
  servicePages,
  getServicePage,
  servicePageSlugs,
  servicePagePriceLabel,
  catalogServiceToLanding,
} from '@/config/service-pages';
import { landingSlugs } from '@/config/geo';
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
    ...(page.sections ?? []).flatMap((s) => [
      s.title,
      ...(s.paragraphs ?? []),
      ...(s.bullets ?? []),
      ...(s.table ? [s.table.head.join(' '), ...s.table.rows.map((r) => r.join(' ')), s.table.note ?? ''] : []),
    ]),
  ].join('\n');
}

// Разрешённые ценовые подстроки (формат единого источника pricing.ts, с nbsp от Intl).
// Примеры маршрутов EV-07 (10/30/50 км) и города МО из секции v3-EV-R4 (3/4/15/16 км)
// вычисляются по той же формуле — из tariffs.
const routeKms = [10, 30, 50, 3, 4, 15, 16];
const routeSums = routeKms.flatMap((km) => [
  formatPrice(tariffs.lightVehicle.baseFee + km * tariffs.lightVehicle.perKm),
  formatPrice(tariffs.offroad.baseFee + km * tariffs.offroad.perKm),
]);
const allowedPrices = [
  formatPrice(tariffs.lightVehicle.baseFee),
  formatPrice(tariffs.offroad.baseFee),
  formatPrice(tariffs.lightVehicle.perKm),
  ...routeSums,
];

describe('service-pages: состав реестра (ЧТЗ табл. 4.1 + ЧТЗ SEO_нетиповые + ЧТЗ SEO v2)', () => {
  it('ровно 15 страниц с требуемыми слагами (джип-посадочная удалена, ЧТЗ v3-код)', () => {
    expect(servicePages).toHaveLength(15);
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
        'ceny',
        'sravnenie-evakuatorov-moskva',
      ].sort(),
    );
  });

  it('джип-посадочная evakuator-dzhip-s-lebedkoj удалена из реестра (TASK-V3-01)', () => {
    expect(servicePageSlugs()).not.toContain('evakuator-dzhip-s-lebedkoj');
    expect(getServicePage('evakuator-dzhip-s-lebedkoj')).toBeUndefined();
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
      ceny: 'сколько стоит эвакуатор',
      'sravnenie-evakuatorov-moskva': 'эвакуатор рядом',
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
  it('related: 2–3 существующих слага (ceny: до 9 — города МО, ЧТЗ v4 EV-4)', () => {
    // Слаги проверяем по ОБЪЕДИНЁННОМУ реестру: /ceny ссылается на гео-города (ЧТЗ v4).
    const slugs = new Set([...servicePageSlugs(), ...landingSlugs()]);
    servicePages.forEach((p) => {
      expect(p.related.length).toBeGreaterThanOrEqual(2);
      expect(p.related.length).toBeLessThanOrEqual(p.slug === 'ceny' ? 9 : 3);
      p.related.forEach((r) => {
        expect(slugs.has(r), `${p.slug}: related «${r}» не существует`).toBe(true);
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

describe('service-pages: спецформаты ЧТЗ SEO v2/v3 (EV-07 цены, EV-08 сравнение, V3 джипы)', () => {
  it('EV-08 дебрендинг (TASK-V3-06): упоминаний конкурентов нет во всём контенте страницы', () => {
    const sravnenie = getServicePage('sravnenie-evakuatorov-moskva')!;
    const everything = [
      sravnenie.title,
      sravnenie.description,
      sravnenie.h1,
      allTexts(sravnenie),
    ]
      .join('\n')
      .toLowerCase();
    ['автоэвакуатор', 'перевозка 24'].forEach((brand) => {
      expect(everything, `бренд «${brand}» не должен встречаться на EV-08`).not.toContain(brand);
    });
  });

  it('EV-08 обязательные блоки: сравнение типов, эконом-класс, 24/7, CTA (ЧТЗ §2 + v3)', () => {
    const sravnenie = getServicePage('sravnenie-evakuatorov-moskva')!;
    const sections = sravnenie.sections ?? [];
    expect(sections.map((s) => s.id)).toEqual([
      'sravnenie-sluzhb',
      'ekonom-klass',
      'skolko-stoit',
      'kruglosutochno',
      'kak-vyzvat',
    ]);
    const table = sections[0].table!;
    expect(table.head.length).toBeGreaterThanOrEqual(4);
    expect(table.rows.length).toBeGreaterThanOrEqual(3);
    expect(table.rows.flat().join('\n')).toContain('Прямая служба');
    expect(table.rows.flat().join('\n')).toContain('Агрегаторы');
    expect(table.rows.flat().join('\n')).toContain('Частники');
    expect(table.note).toBeTruthy();
    // Эконом-класс (ЧТЗ v3 EV-R7): H2 с точной формулировкой, без брендов
    const ekonom = sections.find((s) => s.id === 'ekonom-klass')!;
    expect(ekonom.title).toBe('Эвакуатор эконом-класса: что входит в цену');
    expect(ekonom.bullets?.length).toBeGreaterThanOrEqual(3);
    expect(sections.find((s) => s.id === 'kruglosutochno')?.bullets?.length).toBeGreaterThanOrEqual(3);
    expect(sections.find((s) => s.id === 'kak-vyzvat')?.cta).toBe(true);
  });

  it('EV-07 обязательные блоки: тарифы, «нанять», МО-таблица, факторы, дешёвый эвакуатор', () => {
    const ceny = getServicePage('ceny')!;
    const sections = ceny.sections ?? [];
    expect(sections.map((s) => s.id)).toEqual([
      'tarify',
      'primery-rascheta',
      'stoimost-v-oblasti',
      'ot-chego-zavisit',
      'agregatory-ili-sluzhba',
    ]);
    // «Сколько стоит нанять эвакуатор» — точная фраза «нанять» в H2 (ЧТЗ v3 EV-R4)
    expect(sections[1].title).toContain('нанять');
    // Примеры расчёта синхронны с pricing.ts: 10/30/50 км по обоим тарифам
    const calcTable = sections[1].table!;
    const body = calcTable.rows.flat().join('\n');
    [10, 30, 50].forEach((km) => {
      expect(body).toContain(
        formatPrice(tariffs.lightVehicle.baseFee + km * tariffs.lightVehicle.perKm),
      );
      expect(body).toContain(
        formatPrice(tariffs.offroad.baseFee + km * tariffs.offroad.perKm),
      );
    });
    // Стоимость по городам МО (ЧТЗ v4 EV-4): H2 с точной формулировкой, 6 городов + Видное
    expect(sections[2].title).toBe('Стоимость по городам МО');
    const moTable = sections[2].table!;
    const moBody = moTable.rows.flat().join('\n');
    ['Одинцово', 'Мытищи', 'Люберцы', 'Балашиха', 'Подольск', 'Звенигород', 'Видное'].forEach(
      (city) => {
        expect(moBody, `МО-таблица без города ${city}`).toContain(city);
      },
    );
    expect(ceny.related, 'ссылка на /evakuator-vidnoe из МО-секции').toContain('evakuator-vidnoe');
    // Дешёвый эвакуатор рядом — опасность цены ниже рынка (EV-R4), без брендов
    expect(sections[4].title).toContain('Дешёвый эвакуатор рядом');
    const debranded = allTexts(ceny).toLowerCase();
    expect(debranded).not.toContain('автоэвакуатор');
    expect(debranded).not.toContain('перевозка 24');
  });

  it('EV-2 (ЧТЗ v4): H2 «за километр», FAQ «за километр» с цифрой в первой строке, ссылки', () => {
    const ceny = getServicePage('ceny')!;
    // H2 с точным хвостом «сколько стоит эвакуатор за километр»
    const tarify = ceny.sections?.find((s) => s.id === 'tarify');
    expect(tarify, 'нет секции tarify').toBeTruthy();
    expect(tarify!.title).toContain('Сколько стоит эвакуатор за километр');
    expect(tarify!.paragraphs?.join(' ')).toContain('погрузка');
    // FAQ-пункт точного хвоста «сколько стоит услуга эвакуатора за километр»,
    // ответ — цифрой в первой строке (ЧТЗ v4 EV-2 п.2)
    const kmFaq = ceny.faq.find((f) =>
      f.question.toLowerCase().includes('сколько стоит услуга эвакуатора за километр'),
    );
    expect(kmFaq, 'нет FAQ «за километр»').toBeTruthy();
    expect(kmFaq!.answer).toContain(formatPrice(tariffs.lightVehicle.perKm));
    // Внутренние ссылки: сравнение служб + «эвакуатор легковых цена» (поз. 21,3)
    expect(ceny.related).toContain('sravnenie-evakuatorov-moskva');
    expect(ceny.related).toContain('evakuator-legkovyh');
    // Ссылки на 6 городов гео-волны (EV-4: ссылка с /ceny)
    ['evakuator-zvenigorod', 'evakuator-odincovo', 'evakuator-mytishi', 'evakuator-balashiha', 'evakuator-podolsk', 'evakuator-lyubercy'].forEach(
      (slug) => {
        expect(ceny.related, `/ceny не ссылается на ${slug}`).toContain(slug);
      },
    );
  });

  it('EV-6 (ЧТЗ v4): FAQ «эвакуация мотоцикла на тросу» — честный разбор, отказ в первой строке', () => {
    const moto = getServicePage('evakuaciya-mototehniki')!;
    const trosFaq = moto.faq.find((f) => f.question.toLowerCase().includes('на тросу'))!;
    expect(trosFaq).toBeTruthy();
    expect(trosFaq.answer.startsWith('Нет')).toBe(true);
    expect(trosFaq.answer).toContain('ПДД');
    expect(trosFaq.answer).toContain('платформа');
    expect(moto.faq.length).toBeLessThanOrEqual(5);
  });

  it('EV-1 (ЧТЗ v4): на service-страницах нет леммы «договор» (мусорные показы)', () => {
    servicePages.forEach((p) => {
      const text = (allTexts(p) + ' ' + p.description).toLowerCase();
      expect(text, `${p.slug}: найдено «договор»`).not.toContain('договор');
    });
  });

  it('EV-07 ↔ EV-08 перелинкованы между собой (взаимные related)', () => {
    const ceny = getServicePage('ceny')!;
    const sravnenie = getServicePage('sravnenie-evakuatorov-moskva')!;
    expect(ceny.related).toContain('sravnenie-evakuatorov-moskva');
    expect(sravnenie.related).toContain('ceny');
  });

  it('V3-04 /evakuator-24-7: H2 «24 часа в Москве», FAQ «3 часа ночи», related ↔ ночной', () => {
    const page = getServicePage('evakuator-24-7')!;
    expect(page.description.toLowerCase()).toContain('24 часа');
    const sections = page.sections ?? [];
    expect(sections.map((s) => s.id)).toEqual(['24-chasa-v-moskve']);
    expect(sections[0].title).toBe('Эвакуатор 24 часа в Москве');
    expect(sections[0].bullets?.length).toBeGreaterThanOrEqual(3);
    const questions = page.faq.map((f) => f.question).join('\n');
    expect(questions).toContain('3 часа ночи');
    expect(page.related).toContain('nochnoj-evakuator');
    const nochnoj = getServicePage('nochnoj-evakuator')!;
    expect(nochnoj.related).toContain('evakuator-24-7');
  });

  it('V3-01 джипы удалены: каталог offroad ведёт на «Эвакуатор с лебёдкой»', () => {
    expect(catalogServiceToLanding.offroad).toBe('evakuator-s-lebedkoj');
    const sLebedkoj = getServicePage('evakuator-s-lebedkoj')!;
    expect(sLebedkoj.price).toEqual({ kind: 'tariff', serviceSlug: 'offroad' });
  });

  it('sections: id уникальны, таблицы согласованы (row.length === head.length)', () => {
    servicePages.forEach((p) => {
      const ids = (p.sections ?? []).map((s) => s.id);
      expect(new Set(ids).size, `${p.slug}: дубли id секций`).toBe(ids.length);
      (p.sections ?? []).forEach((s) => {
        if (s.table) {
          expect(s.table.head.length).toBeGreaterThanOrEqual(2);
          expect(s.table.rows.length).toBeGreaterThanOrEqual(1);
          s.table.rows.forEach((row) => {
            expect(row.length, `${p.slug}/${s.id}: строка не совпадает с шапкой`).toBe(
              s.table!.head.length,
            );
          });
        }
      });
    });
  });
});
