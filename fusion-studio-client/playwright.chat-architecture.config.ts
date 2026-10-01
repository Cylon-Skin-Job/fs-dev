import { defineConfig, devices } from '@playwright/test';

// The browser-only architecture lane serves the built renderer from a
// test-owned port. It must never attach to the live development server/DB.
const port = Number(process.env.CHAT_TRANSPORT_TEST_PORT || 43177);
if (!Number.isInteger(port) || port < 1024 || port > 65535 || port === 3001) {
  throw new Error('CHAT_TRANSPORT_TEST_PORT must be a safe isolated port');
}
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: 'list',
  webServer: {
    command: `node e2e/chat-transport-test-server.mjs ${port}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 30_000,
  },
  grepInvert: /built client boots the real app on the isolated server without runtime errors/,
  use: {
    ...devices['Desktop Chrome'],
    baseURL,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'fixture-only-chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
