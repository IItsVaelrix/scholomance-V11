import { expect, test } from "@playwright/test";
import { installReadPageMocks } from "./support/mocks.js";

test.describe("Scholomance shell and scribe rite", () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await installReadPageMocks(page);
  });

  test("routes through the shell and reaches the signal chamber", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveURL(/\/read$/);
    await expect(page.getByRole("navigation", { name: "Primary navigation" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Watch" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Listen" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Scribe" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Combat" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Nexus" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Portal" })).toBeVisible();

    const themeToggle = page.getByRole("button", { name: /Switch to (dark|light) mode/i });
    const initialTheme = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
    await themeToggle.click();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.getAttribute("data-theme")))
      .not.toBe(initialTheme);

    await page.getByRole("link", { name: "Listen" }).click();
    await expect(page).toHaveURL(/\/listen$/);
    await expect(page.getByRole("heading", { name: "Scholomance Signal Chamber" })).toBeVisible();
    await expect(page.locator(".arcane-radio")).toBeVisible();
  });

  test("saves a scroll, opens truesight lore, and reloads persisted content", async ({ page }) => {
    const uniqueTitle = `Smoke Scroll ${Date.now()}`;

    await page.goto("/read");
    await page.getByRole("button", { name: "Begin New Scroll" }).click();

    await page.getByLabel("Scroll Title").fill(uniqueTitle);
    await page.locator("#scroll-content").fill("Echo ember");
    await page.getByRole("button", { name: "Save Scroll" }).click();

    await expect(page.locator(".scroll-list")).toContainText(uniqueTitle);

    const overlay = page.locator(".truesight-overlay");
    await expect(overlay).toBeVisible();

    await overlay.getByRole("button", { name: "Echo" }).click();
    const tooltip = page.getByRole("dialog", { name: /echo/i });
    await expect(tooltip).toContainText("A reflected sound preserved by the chamber.");
    await expect(tooltip).toContainText("reverb");

    await page.reload();

    await expect(page.locator(".scroll-list")).toContainText(uniqueTitle);
    await page.getByRole("button", { name: new RegExp(uniqueTitle) }).click();
    await expect(page.locator(".editor-body")).toContainText("Echo ember");
  });
});
