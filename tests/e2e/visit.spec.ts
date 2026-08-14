import { test, expect } from '@playwright/test';

// E2E: трекинг визитов (ADR-002, VisitTracker.tsx) — beacon на /api/visit
// при загрузке страницы, 1 раз на страницу за сессию (sessionStorage-дедуп).

test('загрузка главной отправляет POST /api/visit с page=home', async ({ page }) => {
  let visitPayload: Record<string, unknown> | null = null;

  await page.route('**/api/visit', async (route) => {
    const request = route.request();
    if (request.method() === 'POST') {
      visitPayload = request.postDataJSON();
    }
    await route.fulfill({ status: 201, contentType: 'application/json', body: '{}' });
  });

  await page.goto('/');

  await expect.poll(() => visitPayload, { timeout: 5000 }).toEqual({ page: 'home' });
});

test('перезагрузка страницы не дублирует визит (sessionStorage-дедуп)', async ({ page }) => {
  const visits: Record<string, unknown>[] = [];

  await page.route('**/api/visit', async (route) => {
    const request = route.request();
    if (request.method() === 'POST') {
      visits.push(request.postDataJSON());
    }
    await route.fulfill({ status: 201, contentType: 'application/json', body: '{}' });
  });

  await page.goto('/');
  await expect
    .poll(() => visits.length, { timeout: 5000 })
    .toBe(1);

  await page.reload();
  await page.waitForTimeout(1500);

  expect(visits).toEqual([{ page: 'home' }]);
});

test('визит на /politika отправляет page=politika', async ({ page }) => {
  let visitPayload: Record<string, unknown> | null = null;

  await page.route('**/api/visit', async (route) => {
    const request = route.request();
    if (request.method() === 'POST') {
      visitPayload = request.postDataJSON();
    }
    await route.fulfill({ status: 201, contentType: 'application/json', body: '{}' });
  });

  await page.goto('/politika');

  await expect.poll(() => visitPayload, { timeout: 5000 }).toEqual({ page: 'politika' });
});
