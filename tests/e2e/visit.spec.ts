import { test, expect, type Page } from '@playwright/test';

// E2E: трекинг пути клиента v2 (ADR-014, VisitTracker.tsx) — enter-beacon на
// каждую навигацию (page, from, sessionId, visitorId, viewId; вход вкладки
// несёт referrer+UTM), leave-beacon на уход (dwellMs). Дедуп: перезагрузка
// той же страницы < 30 с не дублирует enter.
// Тело sendBeacon (Blob) недоступно в route-перехвате — рекордер через addInitScript.

async function installBeaconRecorder(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { __visits: Record<string, unknown>[] };
    w.__visits = [];
    const orig = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = (url: string | URL, data?: BodyInit | null): boolean => {
      if (String(url).includes('/api/visit')) {
        try {
          if (data instanceof Blob) {
            void data.text().then((t) => w.__visits.push(JSON.parse(t)));
          }
        } catch {
          // ignore
        }
      }
      return orig(url, data);
    };
  });
}

function payloads(page: Page): Promise<Array<Record<string, unknown>>> {
  return page.evaluate(() =>
    (window as unknown as { __visits: Record<string, unknown>[] }).__visits ?? [],
  );
}

async function enters(page: Page): Promise<Array<Record<string, unknown>>> {
  return (await payloads(page)).filter((p) => p.type === 'enter');
}

test.beforeEach(async ({ page }) => {
  await installBeaconRecorder(page);
  await page.route('**/api/visit', async (route) => {
    await route.fulfill({ status: 201, contentType: 'application/json', body: '{}' });
  });
});

test('загрузка главной: enter с page=home, источником и ID сессии/визитора', async ({ page }) => {
  await page.goto('/');

  await expect
    .poll(async () => (await enters(page)).length, { timeout: 5000 })
    .toBe(1);

  const [enter] = await enters(page);
  // Прямой заход (без document.referrer) → источник (direct).
  expect(enter).toMatchObject({ type: 'enter', page: 'home', referrer: '(direct)' });
  expect(typeof enter.sessionId).toBe('string');
  expect(typeof enter.visitorId).toBe('string');
  expect(typeof enter.viewId).toBe('string');
  // Входная страница не имеет from.
  expect(enter.from).toBeUndefined();
});

test('перезагрузка < 30 с не дублирует enter (дедуп F5, ADR-014)', async ({ page }) => {
  await page.goto('/');
  await expect.poll(async () => (await enters(page)).length, { timeout: 5000 }).toBe(1);

  await page.reload();
  await page.waitForTimeout(1500);

  const list = await enters(page);
  expect(list).toHaveLength(1);
});

test('внутренняя навигация: enter с from=home, без источника; уход шлёт leave', async ({ page }) => {
  await page.goto('/');
  await expect.poll(async () => (await enters(page)).length, { timeout: 5000 }).toBe(1);

  // Внутренняя навигация: from есть, referrer уже не прикладывается.
  await page.click('footer a[href="/politika"]');
  await expect.poll(async () => (await enters(page)).length, { timeout: 5000 }).toBe(2);

  const [, second] = await enters(page);
  expect(second).toMatchObject({ type: 'enter', page: 'politika', from: 'home' });
  expect(second.referrer).toBeUndefined();

  // SPA-переход с главной шлёт leave с dwellMs для её viewId (ADR-014).
  const first = (await enters(page))[0];
  await expect
    .poll(
      async () =>
        (await payloads(page)).some(
          (p) => p.type === 'leave' && p.viewId === first.viewId && typeof p.dwellMs === 'number',
        ),
      { timeout: 5000 },
    )
    .toBe(true);
});

test('визит на /politika напрямую: page=politika с источником', async ({ page }) => {
  await page.goto('/politika');

  await expect.poll(async () => (await enters(page)).length, { timeout: 5000 }).toBe(1);
  const [enter] = await enters(page);
  expect(enter).toMatchObject({ type: 'enter', page: 'politika', referrer: '(direct)' });
});
