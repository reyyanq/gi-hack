import { test, expect } from "@playwright/test";

async function goto(page: any, url: string) {
  await page.goto(url);
  await page.waitForLoadState("load");
}

test.describe("Pipeline Lead Flow", () => {
  test.beforeEach(async ({ page }) => {
    await goto(page, "/pipeline");
  });

  test("should display Pipeline CRM title", async ({ page }) => {
    await expect(page.locator("h1:has-text('Pipeline CRM')")).toBeVisible();
  });

  test("should have Run Outreach button", async ({ page }) => {
    await expect(page.locator('button:has-text("Run Outreach")')).toBeVisible();
  });
});
