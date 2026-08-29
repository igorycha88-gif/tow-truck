import { test, expect } from '@playwright/test';

// E2E: клики по телефону и услугам → POST /api/click-event
// (ЧТЗ «Полные бизнес-метрики», ADR-012, ClickEventsTracker.tsx — делегированный
// обработчик + debounce 5 с).

test('клик по номеру в Hero отправляет click_phone с page=home', async ({ page }) => {
  const payloads: Record<string, unknown>[] = [];

  // Перехватываем запрос к click-event (не блокируя основную навигацию tel:).
  await page.route('**/api/click-event', async (route) => {
    const request = route.request();
    if (request.method() === 'POST') {
      payloads.push(request.postDataJSON());
    }
    await route.fulfill({ status: 201, contentType: 'application/json', body: '{}' });
  });

  await page.goto('/');

  // Первый телефон в Hero (CTA с номером).
  const heroPhone = page.locator('section[aria-labelledby="hero-heading"] a[href^="tel:"]').first();
  await expect(heroPhone).toBeVisible();
  await heroPhone.click();

  await expect
    .poll(() => payloads, { timeout: 5000 })
    .toContainEqual({ eventType: 'click_phone', page: 'home', referrer: '(direct)' });
});

test('мобильная вьюпорт: клик по floating-call отправляет метрику', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'только мобильная вьюпорт');

  let clickPayload: Record<string, unknown> | null = null;
  await page.route('**/api/click-event', async (route) => {
    const request = route.request();
    if (request.method() === 'POST') {
      clickPayload = request.postDataJSON();
    }
    await route.fulfill({ status: 201, contentType: 'application/json', body: '{}' });
  });

  await page.goto('/');

  const floating = page.locator('a[aria-label="Позвонить"]').first();
  await expect(floating).toBeVisible();
  await floating.click();

  await expect
    .poll(() => clickPayload, { timeout: 5000 })
    .toEqual({ eventType: 'click_phone', page: 'floating_call', referrer: '(direct)' });
});

test('клик по карточке услуги отправляет service_click со slug', async ({ page }) => {
  const payloads: Record<string, unknown>[] = [];

  await page.route('**/api/click-event', async (route) => {
    const request = route.request();
    if (request.method() === 'POST') {
      payloads.push(request.postDataJSON());
    }
    await route.fulfill({ status: 201, contentType: 'application/json', body: '{}' });
  });

  await page.goto('/');

  // Карточка первой услуги в каталоге (data-service проставлен в Services.tsx).
  const card = page.locator('#services a[data-service]').first();
  await expect(card).toBeVisible();
  const slug = await card.getAttribute('data-service');
  await card.click();

  await expect
    .poll(() => payloads, { timeout: 5000 })
    .toContainEqual({
      eventType: 'service_click',
      page: 'home',
      service: slug,
      referrer: '(direct)',
    });
});

test('debounce 5 с: повторный клик по той же ссылке не дублирует событие', async ({ page }) => {
  const payloads: Record<string, unknown>[] = [];

  await page.route('**/api/click-event', async (route) => {
    const request = route.request();
    if (request.method() === 'POST') {
      payloads.push(request.postDataJSON());
    }
    await route.fulfill({ status: 201, contentType: 'application/json', body: '{}' });
  });

  await page.goto('/');

  const heroPhone = page.locator('section[aria-labelledby="hero-heading"] a[href^="tel:"]').first();
  await heroPhone.click();
  await expect.poll(() => payloads.length, { timeout: 5000 }).toBe(1);

  // Второй клик в течение 5 секунд — событие не отправляется (ADR-012 D2/D3).
  await heroPhone.click();
  await page.waitForTimeout(1000);
  expect(payloads).toHaveLength(1);
});
