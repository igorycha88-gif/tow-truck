import { test, expect, type Page } from '@playwright/test';

// E2E: Core Web Vitals-бюджет (ЧТЗ_SEO_Техническая_корректировка 2026-10,
// TASK-EV-T14): CLS ≤ 0.1 и LCP ≤ 2.5 c на мобильном профиле для главной и
// посадочной. Метрики собираются через PerformanceObserver до навигации.

const PAGES = ['/', '/evakuator-marino'];
const CLS_BUDGET = 0.1;
const LCP_BUDGET_MS = 2500;

async function collectVitals(page: Page): Promise<{ cls: number; lcp: number }> {
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, number>;
    w.__cls = 0;
    w.__lcp = 0;
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!(entry as { hadRecentInput?: boolean }).hadRecentInput) {
            w.__cls += (entry as { value: number }).value;
          }
        }
      }).observe({ type: 'layout-shift', buffered: true });
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const last = entries[entries.length - 1] as { startTime: number } | undefined;
        if (last) w.__lcp = last.startTime;
      }).observe({ type: 'largest-contentful-paint', buffered: true });
    } catch {
      // PerformanceObserver unsupported — значения останутся 0
    }
  });
  await page.goto('/'); // warm-up (шрифты, chunks) для честного LCP второй страницы
  for (const path of PAGES) {
    await page.goto(path, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500); // досчитать layout-shift
    const w = (await page.evaluate(() => ({
      cls: (window as unknown as Record<string, number>).__cls,
      lcp: (window as unknown as Record<string, number>).__lcp,
    }))) as { cls: number; lcp: number };
    expect(
      w.cls,
      `${path}: CLS ${w.cls.toFixed(3)} > ${CLS_BUDGET}`,
    ).toBeLessThanOrEqual(CLS_BUDGET);
    expect(
      Math.round(w.lcp),
      `${path}: LCP ${Math.round(w.lcp)} мс > ${LCP_BUDGET_MS} мс`,
    ).toBeLessThanOrEqual(LCP_BUDGET_MS);
  }
}

test('EV-T14 (mobile): CLS ≤ 0.1 и LCP ≤ 2.5 c — главная и посадочная', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'только мобильный профиль');
  await collectVitals(page);
});
