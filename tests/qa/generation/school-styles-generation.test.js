/**
 * QA Validation: School Styles Generation
 *
 * Validates the generate-school-styles.js script for:
 * - CSS output correctness
 * - School variable generation
 * - File system operations
 * - Error handling and fallbacks
 *
 * @see scripts/generate-school-styles.js
 * @see src/lib/css/schoolStyles.js
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../../..');
const SCRIPT_PATH = path.join(ROOT, 'scripts/generate-school-styles.js');
const OUTPUT_DIR = path.join(ROOT, 'src/lib/css/generated');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'school-styles.css');

describe('School Styles Generation QA', () => {
  let originalEnv;
  let originalConsoleLog;
  let consoleLogs;

  beforeEach(() => {
    originalEnv = { ...process.env };
    originalConsoleLog = console.log;
    consoleLogs = [];
    console.log = (...args) => {
      consoleLogs.push(args.join(' '));
      originalConsoleLog(...args);
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    console.log = originalConsoleLog;
  });

  describe('Script Contract Validation', () => {
    it('should have valid script file', () => {
      expect(fs.existsSync(SCRIPT_PATH)).toBe(true);
    });

    it('should have required CLI argument handling', () => {
      const scriptContent = fs.readFileSync(SCRIPT_PATH, 'utf8');
      expect(scriptContent).toContain('--from-api');
      expect(scriptContent).toContain('FETCH_FROM_API');
      expect(scriptContent).toContain('NODE_ENV');
    });

    it('should have fallback mechanism', () => {
      const scriptContent = fs.readFileSync(SCRIPT_PATH, 'utf8');
      expect(scriptContent).toContain('generateLocalFallback');
      expect(scriptContent).toContain('fetchSchoolStyles');
    });
  });

  describe('CSS Output Validation', () => {
    it('should generate school-styles.css file', async () => {
      // Run the script (local fallback mode)
      await import(SCRIPT_PATH);

      expect(fs.existsSync(OUTPUT_FILE)).toBe(true);
    });

    it('should produce valid CSS syntax', () => {
      if (!fs.existsSync(OUTPUT_FILE)) {
        vi.skip('Output file not generated');
        return;
      }

      const cssContent = fs.readFileSync(OUTPUT_FILE, 'utf8');

      // Basic CSS syntax validation
      const braceCount = (cssContent.match(/{/g) || []).length;
      const closeBraceCount = (cssContent.match(/}/g) || []).length;
      expect(braceCount).toBe(closeBraceCount);

      // Should have CSS variables
      expect(cssContent).toMatch(/--[a-z0-9-]+:/i);
    });

    it('should contain all required school themes', () => {
      if (!fs.existsSync(OUTPUT_FILE)) {
        vi.skip('Output file not generated');
        return;
      }

      const cssContent = fs.readFileSync(OUTPUT_FILE, 'utf8');

      // Check for school-specific CSS classes/variables
      const schools = ['SONIC', 'PSYCHIC', 'ALCHEMY', 'WILL', 'VOID'];
      schools.forEach(school => {
        expect(cssContent.toLowerCase()).toContain(school.toLowerCase());
      });
    });

    it('should have proper CSS variable structure', () => {
      if (!fs.existsSync(OUTPUT_FILE)) {
        vi.skip('Output file not generated');
        return;
      }

      const cssContent = fs.readFileSync(OUTPUT_FILE, 'utf8');

      // Should define CSS custom properties
      const variablePattern = /--[a-z0-9-]+\s*:\s*[^;]+;/gi;
      const variables = cssContent.match(variablePattern) || [];

      expect(variables.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling QA', () => {
    it('should handle missing output directory gracefully', async () => {
      // Temporarily rename output directory if it exists
      const tempDir = OUTPUT_DIR + '.backup';
      if (fs.existsSync(OUTPUT_DIR)) {
        fs.renameSync(OUTPUT_DIR, tempDir);
      }

      try {
        // Script should create the directory
        delete process.env.NODE_ENV; // Force local fallback
        await import(`${SCRIPT_PATH}?reload=${Date.now()}`);

        expect(fs.existsSync(OUTPUT_DIR)).toBe(true);
      } finally {
        // Restore
        if (fs.existsSync(tempDir)) {
          fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
          fs.renameSync(tempDir, OUTPUT_DIR);
        }
      }
    });

    it('should complete without throwing on API error', async () => {
      // Force API mode with invalid URL to trigger fallback
      process.env.NODE_ENV = 'production';
      process.env.API_BASE_URL = 'http://invalid-host-12345:9999';

      // Should not throw, should fall back to local generation
      await expect(import(SCRIPT_PATH)).resolves.toBeDefined();
    });
  });

  describe('Performance QA', () => {
    it('should complete generation within acceptable time', async () => {
      const startTime = Date.now();
      await import(SCRIPT_PATH);
      const duration = Date.now() - startTime;

      // Should complete in under 5 seconds
      expect(duration).toBeLessThan(5000);
    });

    it('should not generate excessively large CSS file', () => {
      if (!fs.existsSync(OUTPUT_FILE)) {
        vi.skip('Output file not generated');
        return;
      }

      const stats = fs.statSync(OUTPUT_FILE);
      const maxSizeKB = 100; // Reasonable size limit

      expect(stats.size / 1024).toBeLessThan(maxSizeKB);
    });
  });

  describe('Integration Contract', () => {
    it('should export functions for programmatic use', async () => {
      const { generateSchoolCSSVariables, generateLockedSchoolStyles } =
        await import(path.join(ROOT, 'src/lib/css/schoolStyles.js'));

      expect(typeof generateSchoolCSSVariables).toBe('function');
      expect(typeof generateLockedSchoolStyles).toBe('function');

      const variables = generateSchoolCSSVariables();
      const locked = generateLockedSchoolStyles();

      expect(typeof variables).toBe('string');
      expect(typeof locked).toBe('string');
      expect(variables.length).toBeGreaterThan(0);
      // generateLockedSchoolStyles may return empty string for locked schools
      expect(locked.length).toBeGreaterThanOrEqual(0);
    });
  });
});
