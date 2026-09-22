import { test, expect, type Page } from '@playwright/test';

// E2E: клики по телефону и услугам → POST /api/click-event через sendBeacon
// (ЧТЗ «Полные бизнес-метрики», ADR-012, ClickEventsTracker.tsx — делегированный
// обработчик + debounce 5 с; ЧТЗ_Фикс_трекинга_кликов_tel — транспорт sendBeacon).
//
// Тело sendBeacon (Blob) недоступно в перехвате запросов (на mobile-эмуляции
// postData()/postDataBuffer() = null), поэтому рекордер ставится до загрузки
// приложения через addInitScript и читает тело напрямую.

async function installBeaconRecorder(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { __beacons: { url: string; body: unknown }[] };
    w.__beacons = [];
    const orig = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = (url: string | URL, data?: BodyInit | null): boolean => {
      const record = (body: unknown) => w.__beacons.push({ url: String(url), body });
      try {
        if (data instanceof Blob) void data.text().then((t) => record(JSON.parse(t)));
        else if (typeof data === 'string') record(JSON.parse(data));
        else record(null);
      } catch {
        record(null);
      }
      return orig(url, data);
    };
  });
}

function beaconPayloads(page: Page): Promise<Record<string, unknown>[]> {
  return page.evaluate(() =>
    ((window as unknown as { __beacons: { body: unknown }[] }).__beacons ?? []).map(
      (b) => b.body as Record<string, unknown>,
    ),
  );
}

test.beforeEach(async ({ page }) => {
  await installBeaconRecorder(page);
  await page.route('**/api/click-event', async (route) => {
    await route.fulfill({ status: 201, contentType: 'application/json', body: '{}' });
  });
});

test('клик по номеру в Hero отправляет click_phone с page=home', async ({ page }) => {
  await page.goto('/');

  // Первый телефон в Hero (CTA с номером). noWaitAfter: клик по tel: инициирует
  // внешний протокол (диалер) — без флага click ждёт навигацию и падает по таймауту.
  const heroPhone = page.locator('section[aria-labelledby="hero-heading"] a[href^="tel:"]').first();
  await expect(heroPhone).toBeVisible();
  await heroPhone.click({ noWaitAfter: true });

  await expect
    .poll(() => beaconPayloads(page), { timeout: 5000 })
    .toContainEqual({ eventType: 'click_phone', page: 'home', referrer: '(direct)' });
});

test('мобильная вьюпорт: клик по floating-call отправляет метрику', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'только мобильная вьюпорт');

  await page.goto('/');

  const floating = page.locator('a[aria-label="Позвонить"]').first();
  await expect(floating).toBeVisible();
  await floating.click({ noWaitAfter: true });

  await expect
    .poll(() => beaconPayloads(page), { timeout: 5000 })
    .toContainEqual({ eventType: 'click_phone', page: 'floating_call', referrer: '(direct)' });
});

test('клик по карточке услуги отправляет service_click со slug', async ({ page }) => {
  await page.goto('/');

  // Карточка первой услуги в каталоге (data-service проставлен в Services.tsx).
  const card = page.locator('#services a[data-service]').first();
  await expect(card).toBeVisible();
  const slug = await card.getAttribute('data-service');
  await card.click({ noWaitAfter: true });

  await expect
    .poll(() => beaconPayloads(page), { timeout: 5000 })
    .toContainEqual({
      eventType: 'service_click',
      page: 'home',
      service: slug,
      referrer: '(direct)',
    });
});

test('debounce 5 с: повторный клик по той же ссылке не дублирует событие', async ({ page }) => {
  await page.goto('/');

  const heroPhone = page.locator('section[aria-labelledby="hero-heading"] a[href^="tel:"]').first();
  await heroPhone.click({ noWaitAfter: true });
  await expect
    .poll(async () => (await beaconPayloads(page)).length, { timeout: 5000 })
    .toBe(1);

  // Второй клик в течение 5 секунд — событие не отправляется (ADR-012 D2/D3).
  await heroPhone.click({ noWaitAfter: true });
  await page.waitForTimeout(1000);
  expect(await beaconPayloads(page)).toHaveLength(1);
});
