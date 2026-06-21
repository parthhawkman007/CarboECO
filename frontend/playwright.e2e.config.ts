import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './src/__tests_e2e__',
  testMatch: '**/user_journeys.spec.ts',
  fullyParallel: false,
  retries: 1,
  timeout: 30000,
  use: {
    baseURL: 'http://localhost:3000',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  reporter: [['html', { outputFolder: 'e2e-report' }]],
});
