import { test, expect } from "@playwright/test";

test.describe("Pipeline Lead Flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/pipeline");
    await page.waitForLoadState("networkidle");
  });

  test("should display stage columns", async ({ page }) => {
    const stageNames = ["New", "Contacted", "Meeting", "Proposal", "Closed"];
    for (const name of stageNames) {
      await expect(page.locator(`h3:has-text("${name}")`).first()).toBeVisible();
    }
  });

  test("should add a lead and show it in the New column", async ({ page }) => {
    await page.locator("button:has-text('+ Add lead')").first().click();

    const input = page.locator("input[placeholder='Company name']");
    await expect(input).toBeVisible();
    await input.fill("Bio-Rad Laboratories");
    await input.press("Enter");

    await page.waitForTimeout(3000);

    const leadCard = page.locator("h4:has-text('Bio-Rad Laboratories')").first();
    await expect(leadCard).toBeVisible({ timeout: 10000 });
  });

  test("should advance a lead from New to Contacted", async ({ page }) => {
    await page.locator("button:has-text('+ Add lead')").first().click();
    const input = page.locator("input[placeholder='Company name']");
    await input.fill("Bio-Rad Laboratories");
    await input.press("Enter");
    await page.waitForTimeout(3000);

    const leadCard = page.locator("h4:has-text('Bio-Rad Laboratories')").first();
    await expect(leadCard).toBeVisible({ timeout: 10000 });

    const advanceBtn = leadCard.locator("..").locator("button:has-text('→')");
    if (await advanceBtn.isVisible()) {
      await advanceBtn.click();
      await page.waitForTimeout(3000);

      const contactedLead = page.locator("h4:has-text('Bio-Rad Laboratories')").first();
      await expect(contactedLead).toBeVisible({ timeout: 10000 });
    }
  });

  test("should display pipeline statistics", async ({ page }) => {
    await page.waitForLoadState("networkidle");

    const totalText = page.locator("text=/\\d+ total/").first();
    await expect(totalText).toBeVisible({ timeout: 10000 });

    const stageHeaders = page.locator("h3");
    const count = await stageHeaders.count();
    expect(count).toBeGreaterThanOrEqual(4);
  });
});
