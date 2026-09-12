import { defineConfig, devices } from '@playwright/test';

/**
 * Temporary run config for the VIEW-02 Slice 3 verification gates.
 *
 * The owner's long-running dev server (a pre-VIEW-01 checkout) squats on
 * port 3001, and the base playwright.config.ts reuses whatever responds
 * there. This config runs the SAME spec set against a fresh server spawned
 * from THIS worktree on an isolated port so the verification gates exercise
 * the current bytes.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3312',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'node ../fusion-studio-server/server.js',
    url: 'http://localhost:3312',
    reuseExistingServer: false,
    env: {
      ...process.env,
      PORT: '3312',
    },
    timeout: 120_000,
  },
});
