import { test, expect } from '@playwright/test';

test('graph explorer loads and renders graph after query', async ({ page }) => {
  await page.goto('http://localhost:5173/graph');
  await page.waitForLoadState('networkidle');

  await expect(page.locator('h1')).toContainText('Graph Explorer');

  await page.getByRole('button', { name: 'Run' }).click();

  await page.waitForTimeout(2000);

  const svg = page.locator('svg');
  const circles = await svg.locator('circle').count();
  expect(circles).toBeGreaterThan(1);

  await expect(page.locator('text=/nodes/')).toBeVisible();
});
