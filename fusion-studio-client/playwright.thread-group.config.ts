import { defineConfig, devices } from '@playwright/test';

/**
 * Isolated Playwright config for the CHAT-01 / SPEC-01 Thread Group
 * compatibility gate (slices 01A–01C).
 *
 * The owner's long-running dev server squats on port 3001 and the default
 * `playwright.config.ts` reuses it (`reuseExistingServer: true`), which would
 * hit the live dev database. This config spawns a fresh server from THIS
 * worktree on an isolated port with a throwaway `FUSION_APP_USER_DATA` profile
 * under /tmp so no owner workspace or `fusion-studio-server/data/fusion.db` is
 * touched.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: 'list',
  timeout: 60_000,
  use: {
    baseURL: 'http://localhost:3315',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'mkdir -p /tmp/chat01/01c/e2e-profile && node ../fusion-studio-server/server.js',
    url: 'http://localhost:3315',
    reuseExistingServer: false,
    env: {
      ...process.env,
      PORT: '3315',
      FUSION_APP_USER_DATA: '/tmp/chat01/01c/e2e-profile',
      FUSION_LOCAL_MACHINE: 'RC-MacAir-15',
    },
    timeout: 120_000,
  },
});
