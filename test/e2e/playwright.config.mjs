import { defineConfig, devices } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL || 'https://ideareels.io';

export default defineConfig({
  testDir: './tests',
  timeout: 45_000,
  expect: { timeout: 8_000 },
  reporter: [['list'], ['html', { open: 'never', outputFolder: './playwright-report' }]],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    userAgent: 'IdeaReelsE2E/1.0 (+e2e-smoke)',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-safari', use: { ...devices['iPhone 13'] } },
  ],
  // Do NOT auto-start a dev server; tests hit the live URL.
  workers: process.env.CI ? 2 : 4,
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
});
