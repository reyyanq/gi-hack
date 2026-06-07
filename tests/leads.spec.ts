import { test, expect } from '@playwright/test';

async function goto(page: any, url: string) {
  await page.goto(url);
  await page.waitForLoadState('load');
}

test('leads page shows company and contact info', async ({ page }) => {
  await goto(page, '/leads');

  await expect(page.locator('h1')).toContainText('Lead Explorer');

  await expect(page.getByText('Company', { exact: true })).toBeVisible();
  await expect(page.getByText('Contact', { exact: true })).toBeVisible();
  await expect(page.getByText('Role / Email', { exact: true })).toBeVisible();
  await expect(page.getByText('Tier', { exact: true })).toBeVisible();
});
