import { defineConfig, devices } from '@playwright/test';

// This config is entered only by boot-regressions.mjs after its disposable
// server reports an ephemeral loopback port. The fixture-only config remains
// deliberately unable to boot an HTTP app.
const baseURL = process.env.CHAT_ARCH_BOOT_BASE_URL;
const resultPath = process.env.CHAT_ARCH_BOOT_RESULT_PATH;
const outputDir = process.env.CHAT_ARCH_BOOT_OUTPUT_DIR;
if (!baseURL || !/^http:\/\/127\.0\.0\.1:\d+$/.test(baseURL) || baseURL.endsWith(':3001')) {
  throw new Error('isolated chat architecture boot baseURL is required');
}
if (!resultPath || !outputDir) throw new Error('isolated chat architecture artifact paths are required');

export default defineConfig({
  testDir: '..',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  timeout: 45_000,
  reporter: [['list'], ['json', { outputFile: resultPath }]],
  outputDir,
  grepInvert: /built client boots the real app on the isolated server without runtime errors/,
  use: { ...devices['Desktop Chrome'], baseURL, trace: 'retain-on-failure' },
  projects: [{ name: 'isolated-boot-chromium', use: { ...devices['Desktop Chrome'] } }],
});
