import { test, expect } from "@playwright/test";

function makeLongContent(lines = 140) {
  const out = [];
  for (let i = 1; i <= lines; i += 1) {
    out.push(`Line ${i} - liberation freedom salvation rhythm color ${i % 7}`);
  }
  return out.join("\n");
}

test("tmp read seam repro", async ({ page }) => {
  await page.goto("/read", { waitUntil: "load" });
  await page.waitForSelector(".ide-layout-wrapper", { state: "visible", timeout: 15000 });
  await expect(page.locator(".ide-layout-wrapper")).toBeVisible();

  await page.getByRole("button", { name: "Begin New Scroll" }).click();

  await page.locator("#scroll-title").fill(`Seam Repro ${Date.now()}`);
  await page.locator("#scroll-content").fill(makeLongContent(220));

  await page.getByRole("button", { name: "Save" }).click();

  await expect(page.getByRole("button", { name: "Edit" })).toBeVisible({ timeout: 10000 });
  await page.waitForTimeout(200);

  await page.screenshot({ path: "tmp-read-seam.png", fullPage: true });

  const truesight = page.getByRole("button", { name: /truesight/i });
  await truesight.click();
  await page.waitForTimeout(200);
  await page.screenshot({ path: "tmp-read-seam-truesight.png", fullPage: true });
});
