// @ts-check
import { defineConfig, devices } from "@playwright/test";

const isCI = Boolean(process.env.CI);
const runFullMatrix = process.env.PW_FULL_MATRIX === "true";
const visualPort = process.env.PW_VISUAL_PORT || "4173";
const baseURL = process.env.PW_BASE_URL || `http://127.0.0.1:${visualPort}`;

const defaultProjects = [
  {
    name: "chromium",
    use: { ...devices["Desktop Chrome"] },
  },
];

const fullMatrixProjects = [
  ...defaultProjects,
  {
    name: "firefox",
    use: { ...devices["Desktop Firefox"] },
  },
  {
    name: "webkit",
    use: { ...devices["Desktop Safari"] },
  },
  {
    name: "Mobile Chrome",
    use: { ...devices["Pixel 5"] },
  },
  {
    name: "Mobile Safari",
    use: { ...devices["iPhone 12"] },
  },
];

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: "./tests/visual",
  timeout: 45 * 1000,
  fullyParallel: false,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: 1,
  reporter: isCI ? [["line"], ["html", { open: "never" }]] : "line",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: runFullMatrix ? fullMatrixProjects : defaultProjects,
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${visualPort} --strictPort`,
    url: baseURL,
    reuseExistingServer: !isCI,
    timeout: 120 * 1000,
  },
});
