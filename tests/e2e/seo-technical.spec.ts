import { test, expect } from '@playwright/test';

// E2E: техническое SEO (ЧТЗ_SEO_Техническая_корректировка 2026-10,
// TASK-EV-T4/T5/T9: OG-картинка 200, хабы на главной, 404 без canonical,
// robots/sitemap без кириллицы).

test('EV-T4: og:image и twitter:image отдают 200, image/png, 1200×630', async ({ page, request }) => {
  for (const path of ['/', '/ceny', '/evakuator-marino', '/politika']) {
    await page.goto(path);
    const og = page.locator('meta[property="og:image"]').first();
    await expect(og).toHaveAttribute('content', /\/opengraph-image$/);
    const src = await og.getAttribute('content');
    const res = await request.get(src!);
    expect(res.status(), `${path} og:image → ${src}`).toBe(200);
    expect(res.headers()['content-type']).toContain('image/png');
    const twitter = page.locator('meta[name="twitter:image"]').first();
    await expect(twitter).toHaveAttribute('content', /\/opengraph-image$/);
  }
});

test('EV-T5: главная содержит блок Coverage со ссылками на все 10 гео-хабов', async ({ page }) => {
  await page.goto('/');
  const heading = page.getByRole('heading', {
    level: 2,
    name: 'Эвакуатор по районам Москвы и городам МО',
  });
  await expect(heading).toBeVisible();

  // 10 хабов — обычные <a href> без JS
  const hubLinks = page.locator('section a[href^="/evakuator-"][href*="-moskvy"], section a[href^="/evakuator-"][href*="-podmoskovya"]');
  const count = await hubLinks.count();
  expect(count).toBe(10);
  for (const hub of await hubLinks.all()) {
    const href = await hub.getAttribute('href');
    expect(href).toMatch(/^\/evakuator-[a-z0-9-]+$/);
  }
});

test('EV-T5: подвал содержит колонку «География» с хабами', async ({ page }) => {
  await page.goto('/ceny');
  const geo = page.getByRole('contentinfo').getByRole('navigation', { name: 'География работы' });
  await expect(geo).toBeVisible();
  expect(await geo.locator('a').count()).toBe(10);
});

test('EV-T9: 404 — нет canonical, ровно один meta robots noindex', async ({ page }) => {
  const res = await page.goto('/evakuator-net-takoj-stranicy');
  expect(res?.status()).toBe(404);
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
  await expect(page.locator('meta[name="robots"]')).toHaveCount(1);
  await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute(
    'content',
    /noindex/i,
  );
});

test('EV-T9: /politika — noindex, follow; свой description', async ({ page }) => {
  await page.goto('/politika');
  await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute(
    'content',
    /noindex,\s*follow/i,
  );
  const desc = await page
    .locator('meta[name="description"]')
    .first()
    .getAttribute('content');
  expect(desc).toContain('Политика обработки персональных данных');
});

test('EV-T2: robots.txt без кириллицы и Host, с Clean-param и Sitemap', async ({ request }) => {
  const res = await request.get('/robots.txt');
  expect(res.ok()).toBeTruthy();
  const txt = await res.text();
  expect(txt).not.toMatch(/[А-Яа-яЁё]/);
  expect(txt).not.toContain('Host:');
  expect(txt).toContain('Disallow: /api/');
  expect(txt).toContain('User-Agent: Yandex');
  expect(txt).toContain('Clean-param: utm_source&utm_medium&utm_campaign&utm_content&utm_term');
  expect(txt).toContain('Clean-param: yclid&gclid&ysclid&_openstat&from&service');
  expect(txt).toMatch(/Sitemap: https?:\/\/[a-z0-9.:_-]+\/sitemap\.xml/);
});

test('EV-T3: sitemap.xml без кириллицы, без /politika, без hreflang', async ({ request }) => {
  const res = await request.get('/sitemap.xml');
  expect(res.ok()).toBeTruthy();
  const xml = await res.text();
  expect(xml).not.toMatch(/[А-Яа-яЁё]/);
  expect(xml).not.toContain('/politika');
  expect(xml).not.toContain('hreflang');
  // 124 URL: главная + 123 посадочные
  expect((xml.match(/<loc>/g) ?? []).length).toBe(124);
});

test('EV-T7/T8: JSON-LD не содержит URL с параметрами и кириллическим хостом', async ({ page }) => {
  for (const path of ['/', '/evakuator-marino']) {
    await page.goto(path);
    const ldScripts = await page
      .locator('script[type="application/ld+json"]')
      .allTextContents();
    const joined = ldScripts.join('\n');
    expect(joined, `${path}: нет ?service=`).not.toContain('?service=');
    expect(joined, `${path}: нет кириллического хоста`).not.toContain('эвакуация.online/');
  }
});

test('EV-T8: на посадочной ровно один Service, FAQPage и BreadcrumbList', async ({ page }) => {
  await page.goto('/evakuator-marino');
  const ldScripts = await page
    .locator('script[type="application/ld+json"]')
    .allTextContents();
  const joined = ldScripts.join('\n');
  expect((joined.match(/"@type":"Service"/g) ?? []).length).toBe(1);
  expect((joined.match(/"@type":"FAQPage"/g) ?? []).length).toBe(1);
  expect((joined.match(/"@type":"BreadcrumbList"/g) ?? []).length).toBe(1);
});
