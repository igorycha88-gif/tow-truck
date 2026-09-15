import { test, expect } from '@playwright/test';

// E2E: главная страница. Базовые сценарии рендера и телефонного CTA.

test('главная: H1 и ключевые секции рендерятся', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { level: 1 })).toContainText(/эвакуатор/i);
  await expect(page.locator('#services')).toBeVisible();
  await expect(page.locator('#advantages')).toBeVisible();
  await expect(page.locator('#process')).toBeVisible();
  await expect(page.locator('#order')).toBeVisible();
  await expect(page.locator('#contacts')).toBeVisible();
});

test('главная: телефон кликабелен в header (tel:)', async ({ page }) => {
  await page.goto('/');
  const phoneLink = page.locator('header a[href^="tel:"]').first();
  await expect(phoneLink).toBeVisible();
  const href = await phoneLink.getAttribute('href');
  expect(href).toMatch(/^tel:\+?\d+$/);
});

test('кнопка «Заказать эвакуатор» в Hero — tel:-ссылка на номер', async ({ page }) => {
  await page.goto('/');
  const cta = page.getByRole('link', { name: /Заказать эвакуатор/i }).first();
  await expect(cta).toBeVisible();
  expect(await cta.getAttribute('href')).toMatch(/^tel:\+?\d+$/);
});

test('секция #order: телефонный CTA, формы заявки нет', async ({ page }) => {
  await page.goto('/#order');

  await expect(page.locator('#order a[href^="tel:"]')).toBeVisible();
  await expect(page.locator('#order form')).toHaveCount(0);
  await expect(page.locator('#consent')).toHaveCount(0);
});

test('мобильная вьюпорт: floating-call кнопка видна', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'только мобильная вьюпорт');
  await page.goto('/');
  await expect(page.locator('a[aria-label="Позвонить"]').first()).toBeVisible();
});
