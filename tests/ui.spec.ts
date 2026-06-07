import { test, expect } from "@playwright/test";

// Helper: wait for page to render (HTML loaded, don't wait for API calls that may hang without Neo4j)
async function goto(page: any, url: string) {
  await page.goto(url);
  await page.waitForLoadState("load");
}

test.describe("UI Elements", () => {
  test.describe("Header and Navigation", () => {
    test("should display Siemens Healthineers logo", async ({ page }) => {
      await goto(page, "/");
      const logo = page.locator('img[alt="Siemens Healthineers"]');
      await expect(logo).toBeVisible();
    });

    test("should display page title", async ({ page }) => {
      await page.goto("/");
      await expect(page).toHaveTitle(/Gi-Hack/);
    });

    test("should have all navigation items", async ({ page }) => {
      await goto(page, "/");
      const navLinks = ["Dashboard", "Leads", "Pipeline", "Graph Explorer", "Admin"];
      for (const link of navLinks) {
        await expect(page.locator(`nav >> text=${link}`).first()).toBeVisible();
      }
    });

    test("should navigate to pages via sidebar", async ({ page }) => {
      await goto(page, "/");

      const pages = [
        { link: "Leads", heading: "Lead Explorer" },
        { link: "Pipeline", heading: "Pipeline CRM" },
        { link: "Graph Explorer", heading: "Graph Explorer" },
        { link: "Admin", heading: "Admin Panel" },
      ];

      for (const { link, heading } of pages) {
        await page.locator(`nav >> text=${link}`).first().click();
        await page.waitForTimeout(2000);
        await expect(page.locator(`h1:has-text("${heading}")`).first()).toBeVisible({
          timeout: 10000,
        });
      }
    });
  });

  test.describe("Leads Page UI", () => {
    test.beforeEach(async ({ page }) => {
      await goto(page, "/leads");
    });

    test("should display lead explorer header", async ({ page }) => {
      const header = page.locator("h1:has-text('Lead Explorer')");
      await expect(header).toBeVisible();
    });

    test("should have tier filter buttons", async ({ page }) => {
      const filters = ["ALL", "HOT", "WARM", "COLD"];
      for (const filter of filters) {
        await expect(page.locator(`button:has-text("${filter}")`).first()).toBeVisible();
      }
    });

    test("should have search input for companies", async ({ page }) => {
      const searchInput = page.locator('input[placeholder*="Search"]');
      await expect(searchInput).toBeVisible();
    });

    test("should have segment filter dropdown", async ({ page }) => {
      await expect(page.locator("select").first()).toBeVisible();
    });

    test("should display column headers", async ({ page }) => {
      const columns = ["Company", "Contact", "Role / Email", "Tier", "Score", "Signals"];
      for (const col of columns) {
        await expect(page.locator(`text=${col}`).first()).toBeVisible();
      }
    });
  });

  test.describe("Pipeline Page UI", () => {
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

  test.describe("Admin Page UI", () => {
    test.beforeEach(async ({ page }) => {
      await goto(page, "/admin");
    });

    test("should display admin panel title", async ({ page }) => {
      await expect(page.locator("h1:has-text('Admin Panel')")).toBeVisible();
    });

    test("should display action buttons", async ({ page }) => {
      await expect(page.locator('button:has-text("Run All")').first()).toBeVisible();
      await expect(page.locator('button:has-text("Recalculate Scores")')).toBeVisible();
    });
  });

  test.describe("Graph Explorer Page", () => {
    test("should display graph explorer", async ({ page }) => {
      await goto(page, "/graph");
      await expect(page.locator("h1:has-text('Graph Explorer')")).toBeVisible();
    });
  });
});
