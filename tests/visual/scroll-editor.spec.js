import { test, expect } from "@playwright/test";

test.describe("ScrollEditor save behavior", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/read", { waitUntil: "domcontentloaded" });
    await expect(page.locator(".ide-layout-wrapper")).toBeVisible();
  });

  test("should save content with Ctrl+S", async ({ page }) => {
    const uniqueTitle = `Visual Scroll ${Date.now()}`;
    const content = "The quick brown fox jumps over the lazy dog.";

    // 1. Click "Begin New Scroll" to open the editor.
    const beginNewScrollButton = page.getByRole("button", { name: "Begin New Scroll" });
    await beginNewScrollButton.waitFor({ state: "visible" });
    await beginNewScrollButton.click();

    // 2. Fill out the editor.
    const title = page.locator("#scroll-title");
    await expect(title).toBeVisible();
    await title.fill(uniqueTitle);

    const editor = page.locator("#scroll-content");
    await expect(editor).toBeVisible();
    await expect(editor).toBeEnabled();
    await editor.fill(content);

    // 3. Save with keyboard shortcut.
    await editor.focus();
    await page.keyboard.down("Control");
    await page.keyboard.press("s");
    await page.keyboard.up("Control");

    // 4. The saved scroll should appear in the list.
    const scrollList = page.locator(".scroll-list");
    await expect(scrollList).toContainText(uniqueTitle, { timeout: 10000 });
  });
});
