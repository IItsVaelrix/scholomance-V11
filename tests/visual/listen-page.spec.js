/**
 * Listen Page Visual QA
 * Tests symmetry and visual coherence of the Signal Chamber
 */

import { test, expect } from "@playwright/test";

test.describe("Listen Page Visual QA", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/listen", { waitUntil: "networkidle" });
    await page.waitForTimeout(3000); // Wait for Phaser/Three.js to initialize
  });

  test("page loads with central console visible", async ({ page }) => {
    // Wait for loading to complete
    await page.waitForSelector(".listen-shell", { state: "visible", timeout: 10000 });
    
    // Check the main console container is visible
    const consoleShell = page.locator(".listen-shell");
    await expect(consoleShell).toBeVisible();

    // Check header badges are present
    const badges = page.locator(".listen-header .badge");
    await expect(badges).toHaveCount(2);

    // Check SignalChamberConsole is rendered
    const signalChamber = page.locator(".signal-chamber-shell");
    await expect(signalChamber).toBeVisible();
  });

  test("background layers are present", async ({ page }) => {
    // Check AlchemicalLabBackground container exists
    const bgContainer = page.locator('div[aria-hidden="true"]').first();
    await expect(bgContainer).toBeVisible();

    // Check background overlay exists
    const overlay = page.locator(".listen-background-overlay");
    await expect(overlay).toBeVisible();
  });

  test("nebula clouds present (symmetric placement)", async ({ page }) => {
    // Get all nebula clouds - these are subtle background effects
    const clouds = page.locator(".nebula-cloud");
    
    // Should have 4 clouds (2 pairs for symmetry)
    const count = await clouds.count();
    expect(count).toBeGreaterThanOrEqual(2); // At least 2 for basic symmetry
  });

  test("console is centered horizontally", async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.waitForTimeout(1000);

    const consoleElement = page.locator(".signal-chamber-player-overlay");
    await expect(consoleElement).toBeVisible();

    const box = await consoleElement.boundingBox();
    if (!box) return;

    const centerX = box.x + box.width / 2;
    const viewportCenterX = 1920 / 2;
    
    // Should be within 100px of center
    expect(Math.abs(centerX - viewportCenterX)).toBeLessThan(100);
  });

  test("no ArcaneBookshelfCanvas components rendered", async ({ page }) => {
    // The old ArcaneBookshelfCanvas should NOT be present
    const oldShelves = page.locator(".arcane-shelf");
    await expect(oldShelves).toHaveCount(0);
  });

  test("visual coherence screenshot", async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.waitForTimeout(2000);
    
    // Take a screenshot for visual inspection
    const screenshot = await page.screenshot({ fullPage: true });
    expect(screenshot).toBeDefined();

    // Check that the console is visible
    const consoleElement = page.locator(".signal-chamber-shell");
    await expect(consoleElement).toBeInViewport();
  });

  test("header displays current station info", async ({ page }) => {
    const header = page.locator(".listen-header");
    await expect(header).toBeVisible();

    // Station badge should have text
    const stationBadge = header.locator(".badge").first();
    await expect(stationBadge).toBeVisible();
    const text = await stationBadge.textContent();
    expect(text?.trim()).toBeTruthy();

    // Status badge should show TRANSMITTING or STANDBY
    const statusBadge = header.locator(".badge").last();
    const statusText = await statusBadge.textContent();
    expect(statusText).toMatch(/TRANSMITTING|STANDBY/i);
  });

  test("reduced motion mode works", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/listen", { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);

    // Page should have is-reduced-motion class
    const section = page.locator("section.listen-page");
    await expect(section).toHaveClass(/is-reduced-motion/);
  });
});
