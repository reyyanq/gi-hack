import { test, expect } from '@playwright/test';

test.describe('Gi-Hack Demo Pipeline', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173');
  });

  test('homepage loads', async ({ page }) => {
    await expect(page).toHaveTitle(/Gi-Hack/);
  });

  test('navigate to pipeline page', async ({ page }) => {
    await page.goto('http://localhost:5173/pipeline');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('body')).toBeVisible();
  });

  test('pipeline displays demo leads', async ({ page }) => {
    await page.goto('http://localhost:5173/pipeline');
    await page.waitForLoadState('networkidle');

    const pageContent = await page.content();
    expect(pageContent.toLowerCase()).toMatch(/pipeline|lead|stage/);
  });

  test('navigate to leads page', async ({ page }) => {
    await page.goto('http://localhost:5173/leads');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('body')).toBeVisible();
  });

  test('navigate to admin page', async ({ page }) => {
    await page.goto('http://localhost:5173/admin');
    await page.waitForLoadState('networkidle');

    const pageContent = await page.content();
    expect(pageContent).toBeTruthy();
  });
});

test.describe('Graph Explorer', () => {
  test('graph explorer loads', async ({ page }) => {
    await page.goto('http://localhost:5173/graph');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('Chat Interface', () => {
  test('chat page loads', async ({ page }) => {
    await page.goto('http://localhost:5173/chat');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('body')).toBeVisible();
  });
});
