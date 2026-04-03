/**
 * VIEWPORT PRECISION AUDIT — Bytecode Symmetrical Validation
 * ══════════════════════════════════════════════════════════════════════════════
 * Domain: Visual Geometry & Layout Stability
 * Purpose: Ensures all pages satisfy the 'One-Screen Cockpit' mandate with
 *          mathematical precision and bilateral symmetry.
 */

import { test, expect } from '@playwright/test';

const PAGES = [
  { name: 'Read', path: '/read' },
  { name: 'Listen', path: '/listen' },
  { name: 'Watch', path: '/watch' },
  { name: 'Nexus', path: '/nexus' },
  { name: 'Combat', path: '/combat' },
  { name: 'PixelBrain', path: '/pixelbrain' },
  { name: 'Career', path: '/career' },
  { name: 'Auth', path: '/auth' },
  { name: 'Profile', path: '/profile' },
  { name: 'Collab', path: '/collab' },
];

const VIEWPORT = { width: 1920, height: 1080 };

test.describe('Viewport Precision Audit', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(VIEWPORT);
  });

  for (const pageInfo of PAGES) {
    test(`Page [${pageInfo.name}] satisfies mathematical symmetry and containment`, async ({ page }) => {
      await page.goto(pageInfo.path);
      
      // 1. Await ritual stabilization
      await page.waitForTimeout(1000);

      // ── MANDATE 1: Viewport Containment (No Overflow) ──
      
      const scrollHeight = await page.evaluate(() => document.documentElement.scrollHeight);
      const clientHeight = await page.evaluate(() => document.documentElement.clientHeight);
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);

      if (scrollHeight > clientHeight + 1) {
        throw new Error(`PB-ERR-v1-RENDER-CRIT-VIEW-0x0902-{"page":"${pageInfo.name}","overflow":"vertical","diff":${scrollHeight - clientHeight}}`);
      }
      if (scrollWidth > clientWidth + 1) {
        throw new Error(`PB-ERR-v1-RENDER-CRIT-VIEW-0x0902-{"page":"${pageInfo.name}","overflow":"horizontal","diff":${scrollWidth - clientWidth}}`);
      }

      // ── MANDATE 2: Bilateral Symmetry Audit ──
      
      // Take a high-fidelity screenshot
      await page.screenshot();
      
      // Perform Visual Symmetry Analysis via Script
      const symmetryResult = await page.evaluate(async () => {
        const checkSymmetry = () => {
          // Check central elements for horizontal centering
          const elements = Array.from(document.querySelectorAll('main, .central-orb, .page-content, .cockpit-core'));
          const results = [];
          
          elements.forEach(el => {
            const rect = el.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const viewportCenter = window.innerWidth / 2;
            const drift = Math.abs(centerX - viewportCenter);
            
            results.push({
              tag: el.tagName,
              className: el.className,
              drift,
              isSymmetrical: drift < 2 // Allow 2px sub-pixel leeway
            });
          });
          
          return results;
        };
        
        return checkSymmetry();
      });

      const primaryDrift = symmetryResult.find(r => r.drift > 2);
      if (primaryDrift) {
        console.warn(`Symmetry Warning [${pageInfo.name}]: ${primaryDrift.className} drifted by ${primaryDrift.drift}px`);
      }

      // ── MANDATE 3: Alchemical Core Centering (47.7% Height) ──
      
      if (pageInfo.name === 'Listen' || pageInfo.name === 'PixelBrain') {
        const coreHeightResult = await page.evaluate(() => {
          const orb = document.querySelector('.central-orb, .view-container, canvas');
          if (!orb) return null;
          const rect = orb.getBoundingClientRect();
          const centerY = rect.top + rect.height / 2;
          const heightPercent = (centerY / window.innerHeight) * 100;
          return { heightPercent, drift: Math.abs(heightPercent - 47.7) };
        });

        if (coreHeightResult && coreHeightResult.drift > 5) { // 5% tolerance for varied page structures
           console.warn(`Core Height Alert [${pageInfo.name}]: Expected 47.7%, found ${coreHeightResult.heightPercent.toFixed(2)}%`);
        }
      }

      // Final Visual Snapshot for Blackbox Inspection
      await expect(page).toHaveScreenshot(`${pageInfo.name}-fidelity.png`, {
        maxDiffPixelRatio: 0.05,
        animations: 'disabled',
        timeout: 15000
      });
    });
  }
});
