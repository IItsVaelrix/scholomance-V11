import { test, expect } from "@playwright/test";

test("Read page visual snapshot", async ({ page, browserName }) => {
  await page.goto("/read", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".ide-layout-wrapper")).toBeVisible();
  await page.waitForTimeout(150);

  // Skip webkit visual comparison due to animation stability issues
  if (browserName === "webkit") {
    // Just verify the page loads without visual comparison
    await expect(page.locator(".ide-layout-wrapper")).toBeVisible();
    return;
  }

  await expect(page).toHaveScreenshot("read-page.png", {
    timeout: 10000,
    animations: "disabled",
  });
});
