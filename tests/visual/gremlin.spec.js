import { test, expect } from '@playwright/test';

/**
 * Gremlin Test: Chaos Engineering for the Scholomance IDE.
 * 
 * Objectives:
 * 1. Spam click key UI controls (Navigation, Toggles).
 * 2. Rapidly toggle themes and schools.
 * 3. Resize viewport between desktop and mobile extremes.
 * 4. Reload mid-action to verify state persistence and recovery.
 * 5. Assert responsiveness, no console errors, and no app crashes.
 */

test.describe('Gremlin Chaos Test', () => {
  let consoleErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        // Ignore auth/session related errors that are expected when running against a clean/unauthenticated dev server
        if (
          !text.includes('chrome-extension') && 
          !text.includes('401 (Unauthorized)') &&
          !text.includes('500 (Internal Server Error)') &&
          !text.includes('CSRF token') &&
          !text.includes('progression')
        ) {
          consoleErrors.push(text);
        }
      }
    });

    // Start at home
    await page.goto('/');
  });

  test('should survive rapid interaction and environment changes', async ({ page }) => {
    // 1. Navigation Spam
    const navLinks = ['watch', 'listen', 'read'];
    // Wait for at least one nav link to be visible to ensure hydration
    await page.waitForSelector('nav a', { state: 'visible' });
    
    for (let i = 0; i < 10; i++) {
      const target = navLinks[i % navLinks.length];
      await page.click(`nav a[href="/${target}"]`);
      // No wait, just move fast
    }

    // 2. Theme/School Toggling (Listen Page)
    await page.goto('/listen');
    const schoolButtons = page.locator('button[aria-label*="Tune to"]');
    if (await schoolButtons.count() > 0) {
      for (let i = 0; i < 15; i++) {
        const count = await schoolButtons.count();
        await schoolButtons.nth(i % count).click({ force: true });
      }
    }

    // 3. Viewport Chaos
    const viewports = [
      { width: 1280, height: 720 },
      { width: 375, height: 667 }, // iPhone SE
      { width: 1920, height: 1080 },
      { width: 768, height: 1024 }, // iPad
    ];

    for (const vp of viewports) {
      await page.setViewportSize(vp);
      // Brief pause for layout shift
      await page.waitForTimeout(100); 
    }

    // 4. Reload mid-action (Read Page)
    await page.goto('/read');
    
    // Check if we are on the placeholder screen and need to click "Begin New Scroll"
    const newScrollBtn = page.locator('button:has-text("Begin New Scroll")');
    if (await newScrollBtn.isVisible()) {
      await newScrollBtn.click();
    }
    
    // Wait for the page to be ready and stable
    const textarea = page.locator('textarea');
    await expect(textarea).toBeVisible({ timeout: 15000 });
    
    await textarea.fill('The quick brown fox jumps over the lazy dog.');
    
    // Trigger an analysis click then immediately reload
    // We wait for the overlay to appear
    const firstWord = page.locator('.word-overlay span').first();
    try {
      await firstWord.waitFor({ state: 'visible', timeout: 5000 });
      await firstWord.click();
    } catch (e) {
      console.log('Word overlay not detected, skipping analysis click');
    }
    
    await page.reload();
    
    // 5. Assertions
    // Verify app is still responsive by checking if we can still navigate back to home
    await page.click('nav a[href="/watch"]');
    await expect(page.locator('nav')).toBeVisible();

    // Check for critical failures (filtered in beforeEach)
    expect(consoleErrors, `Detected critical console errors: ${consoleErrors.join('\n')}`).toHaveLength(0);
  });
});
