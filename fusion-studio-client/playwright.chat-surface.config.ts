import { defineConfig, devices } from '@playwright/test';

/**
 * Isolated Playwright config for the CHAT-02 / SPEC-02 composable chat surface
 * gate (Slices 02A–02C). Shared by `chat-surface-identity.spec.ts` (02A),
 * `threaded-chat-host.spec.ts` (02B), `chat-surface-isolation.spec.ts` and
 * `chat-component-registration.spec.ts` (02C).
 *
 * The owner's long-running dev server squats on port 3001 and the default
 * `playwright.config.ts` reuses it (`reuseExistingServer: true`), which would
 * hit the live dev database and the owner's live workspace. This config spawns
 * a fresh server from THIS worktree on isolated port 3316 with a throwaway
 * `FUSION_APP_USER_DATA` profile under /tmp so no owner workspace, Alpha
 * profile, or `fusion-studio-server/data/fusion.db` is touched.
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
    baseURL: 'http://localhost:3316',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'mkdir -p /tmp/chat02/02b/e2e-profile && node ../fusion-studio-server/server.js',
    url: 'http://localhost:3316',
    reuseExistingServer: false,
    env: {
      ...process.env,
      PORT: '3316',
      FUSION_APP_USER_DATA: '/tmp/chat02/02b/e2e-profile',
      FUSION_LOCAL_MACHINE: 'RC-MacAir-15',
    },
    timeout: 120_000,
  },
});
