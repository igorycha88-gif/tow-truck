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

test('разговорные ключи: H1 «Эвакуатор Балашиха» без предлога', async ({ page }) => {
  await page.goto('/evakuator-balashiha');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Эвакуатор Балашиха');
});

test('трасса Горьковка: H1, форма, крошки с хабом МО-восток', async ({ page }) => {
  await page.goto('/evakuator-gorkovka');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Эвакуатор Горьковка');
  await expect(page.locator('#order-service form')).toBeVisible();
  const crumbs = page.getByRole('navigation', { name: 'Хлебные крошки' });
  await expect(crumbs.getByText(/востоке Подмосковья/i)).toBeVisible();
});

test('трасса шоссе Энтузиастов: H1 и JSON-LD areaServed', async ({ page }) => {
  await page.goto('/evakuator-shosse-entuziastov');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Эвакуатор шоссе Энтузиастов');
  const ldScripts = await page
    .locator('script[type="application/ld+json"]')
    .allTextContents();
  expect(ldScripts.join('\n')).toContain('шоссе Энтузиастов, Москва');
});

test('гео-хаб направления: H1 и блок перелинковки с районами', async ({ page }) => {
  await page.goto('/evakuator-yuvao-moskvy');
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/ЮВАО/i);
  // Хаб ссылается на районы — блок перелинковки не «Смежные услуги», а «Районы…»
  await expect(page.getByRole('heading', { name: /^Районы ЮВАО/i })).toBeVisible();
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

// ЧТЗ_SEO_Рост_позиций_Вебмастер_v2 §7.8: ЮЗАО/ЗАО — data-driven smoke.

const v2Pages = [
  { url: '/evakuator-yasenevo', h1: 'Эвакуатор Ясенево' },
  { url: '/evakuator-ramenki', h1: 'Эвакуатор Раменки' },
];

for (const { url, h1 } of v2Pages) {
  test(`ЮЗАО/ЗАО район ${url}: 200, разговорный H1 и форма`, async ({ page }) => {
    const res = await page.goto(url);
    expect(res?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(h1);
    await expect(page.locator('#order-service form')).toBeVisible();
  });
}

test('хаб ЮЗАО: H1, блок «Районы ЮЗАО», форма', async ({ page }) => {
  await page.goto('/evakuator-yuzao-moskvy');
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/ЮЗАО/i);
  await expect(page.getByRole('heading', { name: /^Районы ЮЗАО/i })).toBeVisible();
  await expect(page.locator('#order-service form')).toBeVisible();
});

test('хаб ЗАО: H1, блок «Районы ЗАО», форма', async ({ page }) => {
  await page.goto('/evakuator-zao-moskvy');
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/ЗАО/i);
  await expect(page.getByRole('heading', { name: /^Районы ЗАО/i })).toBeVisible();
  await expect(page.locator('#order-service form')).toBeVisible();
});

test('меты ЮЗАО/ЗАО в JSON-LD: Service, FAQPage, BreadcrumbList', async ({ page }) => {
  await page.goto('/evakuator-yasenevo');
  const ldScripts = await page.locator('script[type="application/ld+json"]').allTextContents();
  const joined = ldScripts.join('\n');
  expect(joined).toContain('"Service"');
  expect(joined).toContain('"FAQPage"');
  expect(joined).toContain('"BreadcrumbList"');
  expect(joined).toContain('Эвакуатор Ясенево');
});

test('sitemap.xml содержит новые направления ЮЗАО/ЗАО', async ({ request }) => {
  const res = await request.get('/sitemap.xml');
  expect(res.ok()).toBeTruthy();
  const xml = await res.text();
  expect(xml).toContain('/evakuator-yasenevo</loc>');
  expect(xml).toContain('/evakuator-ramenki</loc>');
  expect(xml).toContain('/evakuator-yuzao-moskvy</loc>');
  expect(xml).toContain('/evakuator-zao-moskvy</loc>');
});
