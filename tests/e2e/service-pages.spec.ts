import { test, expect } from '@playwright/test';

// E2E: посадочные SEO-страницы (ЧТЗ_SEO_Рост_позиций_Вебмастер, ЭПИК-2).
// Проверяем структуру, перелинковку, JSON-LD и мобильную конверсионность.

const SLUGS = [
  'evakuator-24-7',
  'evakuator-posle-dtp',
  'evakuator-s-lebedkoj',
  'evakuaciya-mototehniki',
  'evakuator-zablokirovannyh-koles',
  'evakuator-vidnoe',
  'evakuator-legkovyh',
];

test('посадочная 24/7: H1, цена, форма, FAQ рендерятся', async ({ page }) => {
  await page.goto('/evakuator-24-7');

  await expect(page.getByRole('heading', { level: 1 })).toContainText(/24\/7/i);
  await expect(page.getByRole('heading', { name: 'Что входит в услугу' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Стоимость услуги' })).toBeVisible();
  await expect(page.getByTestId('price-label')).toContainText(/от/i);
  await expect(page.locator('#order-service form')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Смежные услуги' })).toBeVisible();
});

test('посадочная: телефон кликабелен (tel:)', async ({ page }) => {
  await page.goto('/evakuator-posle-dtp');
  const phoneLink = page.locator('a[href^="tel:"]').first();
  await expect(phoneLink).toBeVisible();
  expect(await phoneLink.getAttribute('href')).toMatch(/^tel:\+?\d+$/);
});

test('посадочная: хлебные крошки ведут на главную', async ({ page }) => {
  await page.goto('/evakuator-legkovyh');
  await page.getByRole('navigation', { name: 'Хлебные крошки' }).getByRole('link', { name: 'Главная' }).click();
  await expect(page).toHaveURL('/');
});

test('неизвестный слаг — 404, не индексируется', async ({ page }) => {
  const res = await page.goto('/evakuator-neizvestnyj');
  expect(res?.status()).toBe(404);
  const robots = page.locator('meta[name="robots"]').first();
  await expect(robots).toHaveAttribute('content', /noindex/i);
});

test('sitemap.xml содержит все 7 посадочных', async ({ request }) => {
  const res = await request.get('/sitemap.xml');
  expect(res.ok()).toBeTruthy();
  const xml = await res.text();
  for (const slug of SLUGS) {
    expect(xml).toContain(`/${slug}</loc>`);
  }
});

test('JSON-LD посадочной содержит Service и FAQPage', async ({ page }) => {
  await page.goto('/evakuator-vidnoe');
  const ldScripts = await page.locator('script[type="application/ld+json"]').allTextContents();
  const joined = ldScripts.join('\n');
  expect(joined).toContain('"Service"');
  expect(joined).toContain('"FAQPage"');
  expect(joined).toContain('"BreadcrumbList"');
});

test('карточка услуги с главной ведёт на посадочную (перелинковка)', async ({ page }) => {
  await page.goto('/#services');
  await page.getByRole('link', { name: 'Эвакуация легковых авто' }).first().click();
  await expect(page).toHaveURL(/\/evakuator-legkovyh$/);
});
