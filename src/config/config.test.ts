import { describe, it, expect } from 'vitest';
import { services, getServiceBySlug } from '@/config/services';
import { advantages } from '@/config/advantages';
import { processSteps } from '@/config/process-steps';
import { company, trustStats } from '@/config/company';
import { siteConfig, navigation } from '@/config/site';
import { SERVICE_TYPES } from '@/types';

// Тесты на консистентность каталогов контента (см. ARCHITECTURE.md §4).

describe('config.services', () => {
  it('содержит все 6 типов услуг из SERVICE_TYPES', () => {
    const slugs = services.map((s) => s.slug);
    SERVICE_TYPES.forEach((t) => expect(slugs).toContain(t));
  });

  it('каждая услуга имеет непустые поля и положительную цену', () => {
    services.forEach((s) => {
      expect(s.title.length).toBeGreaterThan(0);
      expect(s.description.length).toBeGreaterThan(0);
      expect(s.priceFrom).toBeGreaterThan(0);
      expect(s.icon.length).toBeGreaterThan(0);
    });
  });

  it('getServiceBySlug находит услугу (happy path)', () => {
    expect(getServiceBySlug('light_vehicle')?.title).toBeTruthy();
  });

  it('getServiceBySlug возвращает undefined для неизвестного slug', () => {
    expect(getServiceBySlug('unknown')).toBeUndefined();
  });
});

describe('config.advantages', () => {
  it('содержит минимум 4 преимущества', () => {
    expect(advantages.length).toBeGreaterThanOrEqual(4);
  });
  it('каждое преимущество валидно', () => {
    advantages.forEach((a) => {
      expect(a.id).toBeTruthy();
      expect(a.icon).toBeTruthy();
      expect(a.title).toBeTruthy();
      expect(a.text).toBeTruthy();
    });
  });
});

describe('config.processSteps', () => {
  it('содержит ровно 4 шага', () => {
    expect(processSteps).toHaveLength(4);
  });
  it('шаги пронумерованы 1..4 по порядку', () => {
    processSteps.forEach((s, i) => expect(s.step).toBe(i + 1));
  });
});

describe('config.company', () => {
  it('содержит телефон и ИНН', () => {
    expect(company.phone).toBeTruthy();
    expect(company.inn).toBeTruthy();
  });
  it('phoneHref начинается с tel:', () => {
    expect(company.phoneHref).toMatch(/^tel:/);
  });
  it('телефон соответствует актуальному номеру +79017054540', () => {
    expect(company.phoneHref).toBe('tel:+79017054540');
    expect(company.phone.replace(/\D/g, '')).toBe('79017054540');
  });
  it('содержит актуальный email boronind1m@yandex.ru', () => {
    expect(company.email).toBe('boronind1m@yandex.ru');
  });
  it('emailHref начинается с mailto: и содержит email', () => {
    expect(company.emailHref).toMatch(/^mailto:/);
    expect(company.emailHref).toBe(`mailto:${company.email}`);
  });
});

describe('config.trustStats', () => {
  it('содержит числовые метрики доверия', () => {
    expect(trustStats.experienceYears).toBeGreaterThan(0);
    expect(trustStats.rating).toBeGreaterThan(0);
  });
});

describe('config.site', () => {
  it('siteConfig имеет имя и описание', () => {
    expect(siteConfig.name).toBeTruthy();
    expect(siteConfig.description).toBeTruthy();
  });
  it('url не заканчивается слэшем', () => {
    expect(siteConfig.url.endsWith('/')).toBe(false);
  });
  it('navigation содержит якоря секций', () => {
    const hrefs = navigation.map((n) => n.href);
    expect(hrefs).toContain('/#services');
    expect(hrefs).toContain('/#order');
    expect(hrefs).toContain('/#contacts');
  });
});
