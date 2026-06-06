import { test, expect } from '@playwright/test';

test('leads page shows company and contact info', async ({ page }) => {
  await page.goto('http://localhost:5173/leads');
  await page.waitForLoadState('networkidle');

  await expect(page.locator('h1')).toContainText('Lead Explorer');

  await expect(page.getByText('Company', { exact: true })).toBeVisible();
  await expect(page.getByText('Contact', { exact: true })).toBeVisible();
  await expect(page.getByText('Role / Email', { exact: true })).toBeVisible();
  await expect(page.getByText('Tier', { exact: true })).toBeVisible();

  await page.waitForTimeout(2000);

  await expect(page.getByText('Bio-Rad Laboratories').first()).toBeVisible();

  const tierBadges = await page.locator('text=/HOT|WARM|COLD/').count();
  expect(tierBadges).toBeGreaterThan(0);
});
