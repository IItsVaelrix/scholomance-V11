import { test, expect } from "@playwright/test";

const UNIQUE_TITLE = `Test Scroll - ${Date.now()}`;
const UNIQUE_CONTENT = `This is the content of the test scroll, created at ${new Date().toISOString()}.`;

test.describe("Session Persistence", () => {
  test("should save a new scroll and persist it between sessions", async ({ page, browserName }) => {
    // Helper for stable clicking (webkit has animation stability issues)
    const stableClick = async (locator) => {
        await locator.waitFor({ state: "visible" });
        await page.waitForTimeout(200);
        if (browserName === "webkit") {
            await locator.dispatchEvent("click");
        } else {
        await locator.click();
      }
    };

        // === SESSION 1: Create a new scroll ===
        await page.goto("/read", { waitUntil: "load" });
        await page.waitForSelector(".ide-layout-wrapper", { state: "visible", timeout: 15000 });
        await expect(page.locator(".ide-layout-wrapper")).toBeVisible();

        // Wait for animations to settle before clicking
        const beginNewScrollButton = page.getByRole("button", { name: "Begin New Scroll" });
        await page.waitForTimeout(300);
        await stableClick(beginNewScrollButton);

    // Wait for editor to appear after clicking
    const scrollTitle = page.locator("#scroll-title");
    await scrollTitle.waitFor({ state: "visible", timeout: 10000 });

    // Fill in title and content
        await scrollTitle.fill(UNIQUE_TITLE);
        await page.locator("#scroll-content").fill(UNIQUE_CONTENT);

        // Save the scroll
        const saveButton = page.getByRole("button", { name: /(Save|Submit|Update) Scroll/i });
        await stableClick(saveButton);

    // Verify that the scroll is in the list
    const scrollList = page.locator(".scroll-list");
    await expect(scrollList).toContainText(UNIQUE_TITLE, { timeout: 10000 });

        // === SESSION 2: Verify the scroll is still there ===
        // Reload the page to simulate a new session
        await page.reload({ waitUntil: "domcontentloaded" });
        await expect(page.locator(".ide-layout-wrapper")).toBeVisible();

        // Verify that the scroll is still in the list
        await expect(scrollList).toContainText(UNIQUE_TITLE);

    // Click on the scroll and verify its content
    const scrollButton = page.getByRole("button", { name: UNIQUE_TITLE });
    await stableClick(scrollButton);

    // Wait for editor content to load
    const editor = page.locator("#scroll-content");
    await expect(editor).toHaveValue(UNIQUE_CONTENT, { timeout: 10000 });
  });
});
