import { test, expect } from '@playwright/test';

async function goto(page: any, url: string) {
  await page.goto(url);
  await page.waitForLoadState('load');
}

test.describe('Gi-Hack Demo Pipeline', () => {
  test.beforeEach(async ({ page }) => {
    await goto(page, '/');
  });

  test('homepage loads', async ({ page }) => {
    await expect(page).toHaveTitle(/Gi-Hack/);
  });

  test('navigate to pipeline page', async ({ page }) => {
    await goto(page, '/pipeline');
    await expect(page.locator('body')).toBeVisible();
  });

  test('navigate to leads page', async ({ page }) => {
    await goto(page, '/leads');
    await expect(page.locator('body')).toBeVisible();
  });

  test('navigate to admin page', async ({ page }) => {
    await goto(page, '/admin');
    const pageContent = await page.content();
    expect(pageContent).toBeTruthy();
  });
});

test.describe('Graph Explorer', () => {
  test('graph explorer loads', async ({ page }) => {
    await goto(page, '/graph');
    await expect(page.locator('body')).toBeVisible();
  });
});
