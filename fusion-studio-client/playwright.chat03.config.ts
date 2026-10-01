import { defineConfig, devices } from '@playwright/test';

/**
 * Isolated Playwright config for the CHAT-03 / SPEC-03 worksurface gate.
 *
 * The owner's long-running dev server squats on port 3001 and the default
 * `playwright.config.ts` reuses it, which would hit the live dev database and
 * the owner's live workspace. This config spawns a fresh server from THIS
 * worktree on isolated port 3317 with a throwaway `FUSION_APP_USER_DATA`
 * profile under /tmp so no owner workspace, Alpha profile, or
 * `fusion-studio-server/data/fusion.db` is touched. `reuseExistingServer` is
 * false so a stale server can never satisfy the gate.
 *
 * Run `npm run build` first: the server serves the built client.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: 'list',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: 'http://localhost:3317',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'mkdir -p /tmp/chat03/03b/e2e-profile && node ../fusion-studio-server/server.js',
    url: 'http://localhost:3317',
    reuseExistingServer: false,
    env: {
      ...process.env,
      PORT: '3317',
      FUSION_APP_USER_DATA: '/tmp/chat03/03b/e2e-profile',
      FUSION_LOCAL_MACHINE: 'RC-MacAir-15',
    },
    timeout: 120_000,
  },
});
