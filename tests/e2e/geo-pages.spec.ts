import { test, expect } from '@playwright/test';

// E2E smoke гео-посадочных (ADR-003, ЧТЗ_Гео §7.2): район Москвы, город МО, хаб.

test('гео-район ЮВАО: H1, цена, форма, крошки с хабом', async ({ page }) => {
  await page.goto('/evakuator-marino');
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/Марьино/i);
  await expect(page.getByRole('heading', { name: 'Что входит в услугу' })).toBeVisible();
  await expect(page.getByTestId('price-label')).toContainText(/от/i);
  await expect(page.locator('#order-service form')).toBeVisible();
  // Крошки: Главная → Хаб ЮВАО → Марьино
  const crumbs = page.getByRole('navigation', { name: 'Хлебные крошки' });
  await expect(crumbs.getByRole('link', { name: 'Главная' })).toBeVisible();
  await expect(crumbs.getByText(/ЮВАО/i)).toBeVisible();
});

test('гео-город МО: H1 и форма', async ({ page }) => {
  await page.goto('/evakuator-lyubercy');
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/Люберцах/i);
  await expect(page.locator('#order-service form')).toBeVisible();
});

test('гео-хаб направления: H1 и блок перелинковки с районами', async ({ page }) => {
  await page.goto('/evakuator-yuvao-moskvy');
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/ЮВАО/i);
  // Хаб ссылается на районы — блок перелинковки не «Смежные услуги», а «Районы…»
  await expect(page.getByRole('heading', { name: /Районы ЮВАО/i })).toBeVisible();
});

test('гео-страница содержит JSON-LD Service и FAQPage', async ({ page }) => {
  await page.goto('/evakuator-marino');
  const ldScripts = await page.locator('script[type="application/ld+json"]').allTextContents();
  const joined = ldScripts.join('\n');
  expect(joined).toContain('"Service"');
  expect(joined).toContain('"FAQPage"');
  expect(joined).toContain('"BreadcrumbList"');
});

test('неизвестный гео-слаг — 404', async ({ page }) => {
  const res = await page.goto('/evakuator-neizvestnyj-rajon');
  expect(res?.status()).toBe(404);
});

test('sitemap.xml содержит гео-страницы', async ({ request }) => {
  const res = await request.get('/sitemap.xml');
  expect(res.ok()).toBeTruthy();
  const xml = await res.text();
  expect(xml).toContain('/evakuator-marino</loc>');
  expect(xml).toContain('/evakuator-lyubercy</loc>');
  expect(xml).toContain('/evakuator-yuvao-moskvy</loc>');
});
