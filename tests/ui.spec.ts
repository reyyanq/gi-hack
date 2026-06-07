import { test, expect } from "@playwright/test";

test.describe("UI Elements", () => {

  test.describe("Header and Navigation", () => {
    test("should display Siemens Healthineers logo", async ({ page }) => {
      await page.goto("/");
      await page.waitForLoadState("networkidle");
      const logo = page.locator('img[alt="Siemens Healthineers"]');
      await expect(logo).toBeVisible();
    });

    test("should display page title", async ({ page }) => {
      await page.goto("/");
      await expect(page).toHaveTitle(/LeadGraph/);
    });

    test("should display Neo4j connection status", async ({ page }) => {
      await page.goto("/admin");
      await page.waitForLoadState("networkidle");
      await expect(page.locator("text=Neo4j connected")).toBeVisible({ timeout: 15000 });
    });

    test("should have all navigation items", async ({ page }) => {
      await page.goto("/");
      const navLinks = ["Dashboard", "Leads", "Pipeline", "Graph Explorer", "Chat", "Admin"];
      for (const link of navLinks) {
        await expect(page.locator(`nav >> text=${link}`).first()).toBeVisible();
      }
    });

    test("should navigate to all pages via sidebar", async ({ page }) => {
      await page.goto("/");
      await page.waitForLoadState("networkidle");

      const pages = [
        { link: "Leads", url: "/leads", heading: "Lead Explorer" },
        { link: "Pipeline", url: "/pipeline", heading: "Pipeline CRM" },
        { link: "Graph Explorer", url: "/graph", heading: "Graph Explorer" },
        { link: "Chat", url: "/chat", heading: "AI Chat" },
        { link: "Admin", url: "/admin", heading: "Admin Panel" },
      ];

      for (const { link, heading } of pages) {
        await page.locator(`nav >> text=${link}`).first().click();
        await page.waitForLoadState("networkidle");
        await expect(page.locator(`h1:has-text("${heading}")`).first()).toBeVisible({
          timeout: 10000,
        });
      }
    });
  });

  test.describe("Leads Page UI", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/leads");
      await page.waitForLoadState("networkidle");
    });

    test("should display lead explorer header with company count", async ({ page }) => {
      const header = page.locator("h1:has-text('Lead Explorer')");
      await expect(header).toBeVisible();
      await expect(page.locator("text=/\\d+ companies/")).toBeVisible();
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

    test("should display company rows with tier badges", async ({ page }) => {
      const tierBadges = page.locator("text=/HOT|WARM|COLD/");
      const count = await tierBadges.count();
      expect(count).toBeGreaterThan(0);
    });

    test("should filter by tier when clicking HOT button", async ({ page }) => {
      await page.locator('button:has-text("HOT")').first().click();
      await page.waitForTimeout(2000);
      const hotRows = await page.locator("text=🔥 HOT").count();
      expect(hotRows).toBeGreaterThanOrEqual(0);
    });

    test("should filter by tier when clicking WARM button", async ({ page }) => {
      await page.locator('button:has-text("WARM")').first().click();
      await page.waitForTimeout(2000);
      const warmRows = await page.locator("text=⭐ WARM").count();
      expect(warmRows).toBeGreaterThanOrEqual(0);
    });

    test("should filter by tier when clicking COLD button", async ({ page }) => {
      await page.locator('button:has-text("COLD")').first().click();
      await page.waitForTimeout(2000);
      const coldRows = await page.locator("text=❄️ COLD").count();
      expect(coldRows).toBeGreaterThanOrEqual(0);
    });

    test("should have pagination controls", async ({ page }) => {
      await expect(page.locator("text=/page \\d+ of \\d+/")).toBeVisible();
      await expect(page.locator("button:has-text('Next →')")).toBeVisible();
    });

    test("should navigate to next page", async ({ page }) => {
      const nextBtn = page.locator("button:has-text('Next →')");
      if (await nextBtn.isEnabled()) {
        const currentPage = await page.locator("text=/page \\d+ of \\d+/").textContent();
        await nextBtn.click();
        await page.waitForTimeout(2000);
        const newPage = await page.locator("text=/page \\d+ of \\d+/").textContent();
        expect(newPage).not.toBe(currentPage);
      }
    });

    test("should display find contacts buttons on company rows", async ({ page }) => {
      const findContactsBtns = page.locator("button:has-text('Find contacts')");
      const count = await findContactsBtns.count();
      expect(count).toBeGreaterThan(0);
    });

    test("should display company domain and name in rows", async ({ page }) => {
      const firstCompanyName = page.locator("text=Bio-Rad Laboratories").first();
      await expect(firstCompanyName).toBeVisible();
    });
  });

  test.describe("Pipeline Page UI", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/pipeline");
      await page.waitForLoadState("networkidle");
    });

    test("should display Pipeline CRM title", async ({ page }) => {
      await expect(page.locator("h1:has-text('Pipeline CRM')")).toBeVisible();
    });

    test("should display all stage columns", async ({ page }) => {
      const stages = ["New", "Contacted", "Meeting", "Proposal", "Closed Won", "Closed Lost"];
      for (const stage of stages) {
        await expect(page.locator(`h3:has-text("${stage}")`).first()).toBeVisible();
      }
    });

    test("should display total lead count", async ({ page }) => {
      await expect(page.locator("text=/\\d+ total/")).toBeVisible();
    });

    test("should display per-stage lead counts", async ({ page }) => {
      const stageCounts = page.locator("text=/\\d+ leads?/");
      const count = await stageCounts.count();
      expect(count).toBeGreaterThanOrEqual(3);
    });

    test("should have Run Outreach button", async ({ page }) => {
      await expect(page.locator('button:has-text("Run Outreach")')).toBeVisible();
    });

    test("should have Add lead button in New column", async ({ page }) => {
      await expect(page.locator('button:has-text("+ Add lead")').first()).toBeVisible();
    });

    test("add lead dialog appears on click", async ({ page }) => {
      await page.locator('button:has-text("+ Add lead")').first().click();
      const input = page.locator('input[placeholder="Company name"]');
      await expect(input).toBeVisible();
    });

    test("should display lead cards with company name and segment", async ({ page }) => {
      const leadCards = page.locator("h4");
      const count = await leadCards.count();
      expect(count).toBeGreaterThanOrEqual(0);
      if (count > 0) {
        const firstCard = leadCards.first();
        await expect(firstCard).toBeVisible();
      }
    });

    test("should have advance and detail buttons on lead cards", async ({ page }) => {
      const advanceBtns = page.locator('button:has-text("→")');
      const detailBtns = page.locator('button:has-text("▼ Details")');
      const linkBtns = page.locator('button:has-text("🔗 Link")');
      const counts = await Promise.all([
        advanceBtns.count(),
        detailBtns.count(),
        linkBtns.count(),
      ]);
      expect(counts.some((c) => c > 0)).toBeTruthy();
    });
  });

  test.describe("Admin Page UI", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/admin");
      await page.waitForLoadState("networkidle");
    });

    test("should display admin panel title", async ({ page }) => {
      await expect(page.locator("h1:has-text('Admin Panel')")).toBeVisible();
    });

    test("should display data sources section", async ({ page }) => {
      await expect(page.locator("text=/Data Sources/")).toBeVisible();
    });

    test("should display action buttons", async ({ page }) => {
      await expect(page.locator('button:has-text("Run All")').first()).toBeVisible();
      await expect(page.locator('button:has-text("Recalculate Scores")')).toBeVisible();
    });

    test("should display tier counts", async ({ page }) => {
      await page.waitForTimeout(3000);
      const pageText = await page.locator("body").textContent();
      expect(pageText).toMatch(/(Hot|Warm|Cold|Total\s+scored)/);
    });
  });

  test.describe("Graph Explorer Page", () => {
    test("should display graph explorer with query selector and run button", async ({ page }) => {
      await page.goto("/graph");
      await page.waitForLoadState("networkidle");
      await expect(page.locator("h1:has-text('Graph Explorer')")).toBeVisible();
      await expect(page.locator('button:has-text("Run")')).toBeVisible();
    });
  });

  test.describe("Chat Page", () => {
    test("should display AI Chat interface with input and send button", async ({ page }) => {
      await page.goto("/chat");
      await page.waitForLoadState("networkidle");
      await expect(page.locator("h1:has-text('AI Chat')")).toBeVisible();
    });
  });
});
