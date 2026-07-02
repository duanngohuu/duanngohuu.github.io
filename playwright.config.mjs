import { defineConfig, devices } from '@playwright/test';

const liveBaseURL = process.env.LIVE_BASE_URL;
const baseURL = liveBaseURL || 'http://127.0.0.1:4173';

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.mjs',
  timeout: liveBaseURL ? 45_000 : 30_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  webServer: liveBaseURL ? undefined : {
    command: 'npx http-server . -p 4173 -c-1 --silent',
    url: 'http://127.0.0.1:4173/flashcard/',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000
  },
  projects: [
    {
      name: 'chromium-desktop',
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'mobile-iphone',
      use: {
        ...devices['iPhone 13'],
        viewport: { width: 390, height: 844 }
      }
    }
  ]
});
