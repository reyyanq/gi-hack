import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage();

const errors = [];
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(msg.text());
});
page.on("pageerror", (err) => errors.push(err.message));

await page.goto("http://localhost:5173", { waitUntil: "networkidle", timeout: 15000 }).catch((e) =>
  errors.push("Navigation: " + e.message)
);

await new Promise((r) => setTimeout(r, 3000));

console.log("=== CONSOLE ERRORS ===");
console.log(JSON.stringify(errors, null, 2));

const bodyHtml = await page.evaluate(() => document.body?.innerHTML?.substring(0, 2000) || "(empty)");
console.log("=== BODY HTML (first 2000 chars) ===");
console.log(bodyHtml);

await browser.close();
