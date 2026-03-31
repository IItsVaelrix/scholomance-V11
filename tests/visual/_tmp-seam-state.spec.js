import { test, expect } from "@playwright/test";

function makeLongContent(lines = 320) {
  const out = [];
  for (let i = 1; i <= lines; i += 1) {
    out.push(`Line ${i} freedom defiance salvation cost rhythm meter rhyme`);
  }
  return out.join("\n");
}

test("tmp seam state capture", async ({ page }) => {
  await page.goto("/read", { waitUntil: "load" });
  await page.waitForSelector(".ide-layout-wrapper", { state: "visible", timeout: 15000 });

  const newBtn = page.getByRole("button", { name: /new scroll/i }).first();
  await expect(newBtn).toBeVisible();
  await newBtn.click();

  const title = page.locator("#scroll-title");
  const editor = page.locator("#scroll-content");

  await expect(title).toBeVisible();
  await expect(editor).toBeVisible();

  await title.fill(`Seam Probe ${Date.now()}`);
  await editor.fill(makeLongContent());

  const save = page.getByRole("button", { name: /^save$/i });
  await expect(save).toBeVisible();
  await save.click();

  const edit = page.getByRole("button", { name: /^edit$/i });
  await expect(edit).toBeVisible({ timeout: 10000 });

  const truesight = page.getByRole("button", { name: /truesight/i });
  await truesight.click();
  await page.waitForTimeout(300);

  await page.screenshot({ path: "tmp-seam-readonly-top.png", fullPage: true });

  // Scroll textarea (still present in read-only Truesight mode)
  await editor.evaluate((el) => {
    el.scrollTop = Math.floor(el.scrollHeight * 0.55);
    el.dispatchEvent(new Event("scroll", { bubbles: true }));
  });
  await page.waitForTimeout(250);

  await page.screenshot({ path: "tmp-seam-readonly-mid.png", fullPage: true });

  await editor.evaluate((el) => {
    el.scrollTop = el.scrollHeight;
    el.dispatchEvent(new Event("scroll", { bubbles: true }));
  });
  await page.waitForTimeout(250);

  await page.screenshot({ path: "tmp-seam-readonly-bottom.png", fullPage: true });
});
