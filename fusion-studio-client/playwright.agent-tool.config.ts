import { defineConfig } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const port = Number(process.env.PORT);
if (!Number.isSafeInteger(port) || port < 1024 || port > 65535 || port === 3001) {
  throw new Error('The agent-tool live config requires a unique non-3001 PORT.');
}
if (process.env.FUSION_PROVENANCE_TEST_MODE !== 'isolated-v1'
  || !['agent-tool-live', 'agent-tool-restart'].includes(process.env.FUSION_PROVENANCE_TEST_SCENARIO || '')) {
  throw new Error('The agent-tool live config may run only through its guarded launcher.');
}
const testRoot = process.env.FUSION_PROVENANCE_TEST_ROOT;
const nonce = process.env.FUSION_PROVENANCE_TEST_NONCE;
if (!testRoot || !path.isAbsolute(testRoot) || !nonce
  || fs.readFileSync(path.join(testRoot, '.fusion-provenance-test-owned'), 'utf8') !== `${nonce}\n`) {
  throw new Error('The agent-tool live config requires a marker-owned output root.');
}

export default defineConfig({
  testDir: './e2e/provenance',
  testMatch: 'agent-tool-live.spec.ts',
  outputDir: path.join(testRoot, `playwright-${process.env.FUSION_PROVENANCE_TEST_SCENARIO}`),
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'node ../fusion-studio-server/server.js',
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
    timeout: 30_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
