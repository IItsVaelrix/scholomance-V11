import { test, expect } from "@playwright/test";

function buildLongScrollContent(wordCount = 650, wordsPerLine = 12) {
  const words = [];
  for (let i = 0; i < wordCount; i += 1) {
    words.push(`word${i}`);
  }

  const lines = [];
  for (let i = 0; i < words.length; i += wordsPerLine) {
    lines.push(words.slice(i, i + wordsPerLine).join(" "));
  }

  return lines.join("\n");
}

test.describe("Read page layout regressions", () => {
  test("theme toggle remains visible and changes theme", async ({ page }) => {
    await page.goto("/read", { waitUntil: "load" });
    await page.waitForSelector(".ide-layout-wrapper", { state: "visible", timeout: 15000 });
    await expect(page.locator(".ide-layout-wrapper")).toBeVisible();

    const themeToggle = page.getByRole("button", { name: /Switch to (dark|light) mode/i });
    await expect(themeToggle).toBeVisible();

    const beforeTheme = await page.evaluate(() => {
      return document.documentElement.getAttribute("data-theme");
    });

    await themeToggle.click();

    await expect.poll(async () => {
      return page.evaluate(() => document.documentElement.getAttribute("data-theme"));
    }).not.toBe(beforeTheme);
  });

  test("editor expands and text inset stays stable past 500 words", async ({ page }, testInfo) => {
    if (testInfo.project.use?.isMobile) {
      test.skip(true, "Desktop layout assertion");
    }

    await page.goto("/read", { waitUntil: "load" });
    await page.waitForSelector(".ide-layout-wrapper", { state: "visible", timeout: 15000 });
    await expect(page.locator(".ide-layout-wrapper")).toBeVisible();

    const beginNewScrollButton = page.getByRole("button", { name: "Begin New Scroll" });
    await beginNewScrollButton.waitFor({ state: "visible" });
    await beginNewScrollButton.click();

    const editor = page.locator("#scroll-content");
    const wrapper = page.locator(".editor-textarea-wrapper");
    await expect(editor).toBeVisible();
    await expect(editor).toBeEnabled();

    await editor.fill("short baseline content");

    const before = await editor.evaluate((el) => {
      const styles = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      const paddingLeft = Number.parseFloat(styles.paddingLeft || "0");
      return {
        clientWidth: el.clientWidth,
        paddingLeft,
        contentStartX: rect.left + paddingLeft,
      };
    });
    const beforeWrapperHeight = await wrapper.evaluate((el) => {
      return el.getBoundingClientRect().height;
    });

    const longContent = buildLongScrollContent(650, 12);
    await editor.fill(longContent);

    const overflow = await editor.evaluate((el) => {
      return {
        hasVerticalOverflow: el.scrollHeight > el.clientHeight + 1,
      };
    });
    const afterWrapperHeight = await wrapper.evaluate((el) => {
      return el.getBoundingClientRect().height;
    });

    const after = await editor.evaluate((el) => {
      const styles = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      const paddingLeft = Number.parseFloat(styles.paddingLeft || "0");
      return {
        clientWidth: el.clientWidth,
        paddingLeft,
        contentStartX: rect.left + paddingLeft,
      };
    });

    expect(afterWrapperHeight).toBeGreaterThan(beforeWrapperHeight);
    expect(overflow.hasVerticalOverflow).toBeFalsy();
    expect(Math.abs(after.clientWidth - before.clientWidth)).toBeLessThanOrEqual(1);
    expect(Math.abs(after.paddingLeft - before.paddingLeft)).toBeLessThanOrEqual(0.1);
    expect(Math.abs(after.contentStartX - before.contentStartX)).toBeLessThanOrEqual(1);

    await editor.fill("short reset line");
    const afterShrinkHeight = await wrapper.evaluate((el) => {
      return el.getBoundingClientRect().height;
    });
    expect(afterShrinkHeight).toBeLessThan(afterWrapperHeight);
  });

  test("truesight overlay and syllable counter stay synchronized after shrink", async ({ page }, testInfo) => {
    if (testInfo.project.use?.isMobile) {
      test.skip(true, "Desktop layout assertion");
    }

    await page.goto("/read", { waitUntil: "load" });
    await page.waitForSelector(".ide-layout-wrapper", { state: "visible", timeout: 15000 });
    await expect(page.locator(".ide-layout-wrapper")).toBeVisible();

    const beginNewScrollButton = page.getByRole("button", { name: "Begin New Scroll" });
    await beginNewScrollButton.waitFor({ state: "visible" });
    await beginNewScrollButton.click();

    const editor = page.locator("#scroll-content");
    const wrapper = page.locator(".editor-textarea-wrapper");
    await expect(editor).toBeVisible();
    await expect(editor).toBeEnabled();

    const longContent = buildLongScrollContent(900, 8);
    await editor.fill(longContent);

    const expandedHeight = await wrapper.evaluate((el) => el.getBoundingClientRect().height);

    const truesightToggle = page.getByRole("button", { name: /truesight/i });
    await truesightToggle.click();

    const overlay = page.locator(".truesight-overlay");
    await expect(overlay).toBeVisible();

    await editor.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
      el.dispatchEvent(new Event("scroll", { bubbles: true }));
    });

    const beforeShrinkSync = await page.evaluate(() => {
      const textarea = document.querySelector("#scroll-content");
      const overlayEl = document.querySelector(".truesight-overlay");
      const track = document.querySelector(".syllable-counter-track");

      const transform = track ? getComputedStyle(track).transform : "none";
      const matrix = transform && transform !== "none" ? new DOMMatrixReadOnly(transform) : null;
      return {
        textareaTop: textarea ? textarea.scrollTop : 0,
        overlayTop: overlayEl ? overlayEl.scrollTop : 0,
        counterTranslateY: matrix ? Math.abs(matrix.m42) : 0,
      };
    });

    expect(Math.abs(beforeShrinkSync.textareaTop - beforeShrinkSync.overlayTop)).toBeLessThanOrEqual(1);
    expect(Math.abs(beforeShrinkSync.textareaTop - beforeShrinkSync.counterTranslateY)).toBeLessThanOrEqual(2);

    await editor.fill("short line");

    await expect.poll(async () => {
      return editor.evaluate((el) => el.scrollTop);
    }).toBeLessThanOrEqual(1);

    const afterShrinkSync = await page.evaluate(() => {
      const overlayEl = document.querySelector(".truesight-overlay");
      const track = document.querySelector(".syllable-counter-track");

      const transform = track ? getComputedStyle(track).transform : "none";
      const matrix = transform && transform !== "none" ? new DOMMatrixReadOnly(transform) : null;
      return {
        overlayTop: overlayEl ? overlayEl.scrollTop : 0,
        counterTranslateY: matrix ? Math.abs(matrix.m42) : 0,
      };
    });

    const shrunkHeight = await wrapper.evaluate((el) => el.getBoundingClientRect().height);
    expect(shrunkHeight).toBeLessThan(expandedHeight);
    expect(afterShrinkSync.overlayTop).toBeLessThanOrEqual(1);
    expect(afterShrinkSync.counterTranslateY).toBeLessThanOrEqual(2);
  });
});
