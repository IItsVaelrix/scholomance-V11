/**
 * Listen Page Visual QA - Symmetry Focus
 * Tests the key symmetry fixes for the Signal Chamber
 */

import { test, expect } from "@playwright/test";

test.describe("Listen Page Symmetry QA", () => {
  test("page renders without duplicate shelf components", async ({ page }) => {
    await page.goto("/listen", { waitUntil: "load" });
    await page.waitForTimeout(2000);

    // CRITICAL: Old ArcaneBookshelfCanvas should NOT exist
    const oldShelves = page.locator(".arcane-shelf");
    await expect(oldShelves).toHaveCount(0, {
      message: "ArcaneBookshelfCanvas components should be removed"
    });

    // New background should exist
    const bgContainer = page.locator('div[aria-hidden="true"]').first();
    await expect(bgContainer).toBeVisible();
  });

  test("console is centered on page", async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto("/listen", { waitUntil: "load" });
    await page.waitForSelector(".listen-shell", { state: "visible", timeout: 10000 });

    const consoleEl = page.locator(".signal-chamber-player-overlay");
    await expect(consoleEl).toBeVisible();

    const box = await consoleEl.boundingBox();
    const centerX = box.x + box.width / 2;
    const viewportCenterX = 1920 / 2;
    
    // Should be within 150px of center
    expect(Math.abs(centerX - viewportCenterX)).toBeLessThan(150);
  });

  test("header shows station info", async ({ page }) => {
    await page.goto("/listen", { waitUntil: "load" });
    await page.waitForTimeout(2000);

    const header = page.locator(".listen-header");
    await expect(header).toBeVisible();

    const badges = header.locator(".badge");
    await expect(badges).toHaveCount(2);

    // Status should be STANDBY or TRANSMITTING
    const statusBadge = badges.last();
    const statusText = await statusBadge.textContent();
    expect(statusText).toMatch(/STANDBY|TRANSMITTING/i);
  });

  test("visual screenshot for manual review", async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto("/listen", { waitUntil: "load" });
    await page.waitForTimeout(3000);

    const screenshot = await page.screenshot({ fullPage: true });
    expect(screenshot).toBeDefined();
  });
});
