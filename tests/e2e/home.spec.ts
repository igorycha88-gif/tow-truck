import { test, expect } from '@playwright/test';

// E2E: главная страница. Базовые сценарии рендера и формы.

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

test('форма: показывает ошибку при невалидном телефоне', async ({ page }) => {
  await page.goto('/#order');

  await page.fill('#name', 'Иван');
  await page.fill('#phone', '123');
  await page.fill('#addressFrom', 'МКАД');
  await page.check('#consent');

  await page.click('button[type="submit"]');

  await expect(page.locator('text=/неверный формат|укажите номер/i')).toBeVisible({ timeout: 5000 });
});

test('форма: кнопка отправки неактивна до согласия на обработку ПД (152-ФЗ)', async ({ page }) => {
  await page.goto('/#order');

  await page.fill('#name', 'Иван');
  await page.fill('#phone', '+7 (999) 123-45-67');
  await page.fill('#addressFrom', 'МКАД 50 км');

  // consent не отмечен → кнопка disabled
  const submit = page.locator('button[type="submit"]');
  await expect(submit).toBeDisabled();

  // отмечаем согласие → кнопка активна
  await page.check('#consent');
  await expect(submit).toBeEnabled();
});

test('мобильная вьюпорт: floating-call кнопка видна', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'только мобильная вьюпорт');
  await page.goto('/');
  await expect(page.locator('a[aria-label="Позвонить"]').first()).toBeVisible();
});
