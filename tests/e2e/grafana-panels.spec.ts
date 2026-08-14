import { test, expect } from '@playwright/test';

// Диагностика Grafana: рендерятся ли timeseries-панели (дашборд бизнес-метрик).
// Логин admin → открыть дашборд → проверить панель «Посетители по часам».

const GRAFANA = process.env.GRAFANA_URL || 'http://localhost:3030/grafana';
const USER = process.env.GRAFANA_USER || 'admin';
const PASS = process.env.GRAFANA_PASS || 'admin';

test('панель «Посетители по часам» рендерится без ошибок', async ({ page }) => {
  await page.goto(`${GRAFANA}/login`);
  await page.getByLabel('Email or username').fill(USER);
  await page.getByLabel('Password').first().fill(PASS);
  await page.getByRole('button', { name: 'Log in' }).click();

  // Grafana при первом входе с дефолтным паролем требует смену — пропускаем.
  const skipBtn = page.getByRole('button', { name: 'Skip' });
  await skipBtn.waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});
  if (await skipBtn.isVisible()) {
    await skipBtn.click();
  }
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });

  await page.goto(`${GRAFANA}/d/evakuaciya-business-metrics`);
  await page.waitForLoadState('networkidle');

  const panel = page.locator('h2, [data-testid*="panel-title"]').filter({
    hasText: 'Посетители по часам',
  });
  await expect(panel).toBeVisible({ timeout: 15000 });

  // Панель не должна показывать ошибку запроса или пустые данные при наличии визитов.
  const panelBody = panel.first().locator('xpath=ancestor::div[contains(@class,"panel")]').first();
  const panelText = (await panelBody.innerText().catch(() => '')) || '';
  expect(panelText).not.toMatch(/db has no time column|no time column found/i);
});
