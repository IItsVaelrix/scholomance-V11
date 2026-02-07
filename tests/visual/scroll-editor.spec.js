import { test, expect } from "@playwright/test";

test.describe("ScrollEditor formatting", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/read", { waitUntil: "domcontentloaded" });
  });

  test("should apply bold and italic formatting to selected text", async ({ page }) => {
    // 1. Click "Begin New Scroll" to open the editor
    await page.waitForLoadState("networkidle");
    const beginNewScrollButton = page.getByRole("button", { name: "Begin New Scroll" });
    await beginNewScrollButton.waitFor({ state: "visible" });
    await beginNewScrollButton.click();

    // 2. Type text into the editor
    const editor = page.locator("#scroll-content");
    await expect(editor).toBeVisible();
    await expect(editor).toBeEnabled();
    await editor.fill("The quick brown fox jumps over the lazy dog.");

    const selectWordInEditor = async (word) => {
      const value = await editor.inputValue();
      const start = value.indexOf(word);
      expect(start).toBeGreaterThanOrEqual(0);
      await editor.evaluate((el, range) => {
        el.focus();
        el.setSelectionRange(range.start, range.end);
      }, { start, end: start + word.length });
    };

    // 3. Select the word "quick" and apply bold
    await selectWordInEditor("quick");
    await editor.focus();
    await page.keyboard.down("Control");
    await page.keyboard.press("b");
    await page.keyboard.up("Control");

    // 4. Assert that the text is bolded with markdown
    await expect(editor).toHaveValue("The **quick** brown fox jumps over the lazy dog.");

    // 5. Select the word "lazy" and apply italic
    await selectWordInEditor("lazy");
    await editor.focus();
    await page.keyboard.down("Control");
    await page.keyboard.press("i");
    await page.keyboard.up("Control");

    // 6. Assert that the text is italicized with markdown
    await expect(editor).toHaveValue("The **quick** brown fox jumps over the *lazy* dog.");
  });
});
