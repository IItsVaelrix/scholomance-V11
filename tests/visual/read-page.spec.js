import { test, expect } from "@playwright/test";

test("Read page visual snapshot", async ({ page, browserName }) => {
  await page.goto("/read");
  // Wait for page to stabilize (animations, font loading, etc.)
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(500);

  // Skip webkit visual comparison due to animation stability issues
  if (browserName === "webkit") {
    // Just verify the page loads without visual comparison
    await expect(page.locator(".readPage")).toBeVisible();
    return;
  }

  await expect(page).toHaveScreenshot("read-page.png", { timeout: 10000 });
});
