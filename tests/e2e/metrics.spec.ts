import { test, expect } from '@playwright/test';

// E2E: бизнес-метрики — клик по номеру телефона должен уходить в /api/click-event
// (см. ADR-001, PhoneClickTracker.tsx).

test('клик по номеру в Hero отправляет POST /api/click-event', async ({ page }) => {
  let clickPayload: Record<string, unknown> | null = null;

  // Перехватываем запрос к click-event (не блокируя основную навигацию tel:).
  await page.route('**/api/click-event', async (route) => {
    const request = route.request();
    if (request.method() === 'POST') {
      clickPayload = request.postDataJSON();
    }
    await route.fulfill({ status: 201, contentType: 'application/json', body: '{}' });
  });

  await page.goto('/');

  // Первый телефон в Hero (CTA с номером).
  const heroPhone = page.locator('section[aria-labelledby="hero-heading"] a[href^="tel:"]').first();
  await expect(heroPhone).toBeVisible();
  await heroPhone.click();

  await expect.poll(() => clickPayload, { timeout: 5000 }).toEqual({ page: 'home' });
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

  await expect.poll(() => clickPayload, { timeout: 5000 }).toEqual({ page: 'floating_call' });
});