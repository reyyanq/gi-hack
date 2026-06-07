import { test, expect } from '@playwright/test';

async function goto(page: any, url: string) {
  await page.goto(url);
  await page.waitForLoadState('load');
}

test('graph explorer loads', async ({ page }) => {
  await goto(page, '/graph');
  await expect(page.locator('h1')).toContainText('Graph Explorer');
});
