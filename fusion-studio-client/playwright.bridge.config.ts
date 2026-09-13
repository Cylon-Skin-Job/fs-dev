import { defineConfig } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

/**
 * BRIDGE-01 SPEC-01 slice 01C live integration proof config.
 *
 * Mirrors the accepted provenance live configs: it may run only through its
 * marker-guarded launcher, on a unique non-3001 port, against the isolated
 * `Test-Provenance` machine profile. The server is the real `server.js` under
 * the isolated provenance runtime (scenario `normal`), and no repository or
 * developer profile is registered or written.
 */

const phase = process.env.FUSION_BRIDGE_TEST_PHASE;
const port = Number(process.env.PORT);
if (!Number.isSafeInteger(port) || port < 1024 || port > 65535 || port === 3001) {
  throw new Error('The bridge live config requires a unique non-3001 PORT.');
}
if (process.env.FUSION_PROVENANCE_TEST_MODE !== 'isolated-v1') {
  throw new Error('The bridge live config may run only through its guarded launcher.');
}
if (!['bridge-01-save', 'bridge-01-restart'].includes(phase || '')) {
  throw new Error('The bridge live config requires a known bridge test phase.');
}
const testRoot = process.env.FUSION_PROVENANCE_TEST_ROOT;
const nonce = process.env.FUSION_PROVENANCE_TEST_NONCE;
if (!testRoot || !path.isAbsolute(testRoot) || !nonce
  || fs.readFileSync(path.join(testRoot, '.fusion-provenance-test-owned'), 'utf8') !== `${nonce}\n`) {
  throw new Error('The bridge live config requires a marker-owned output root.');
}

export default defineConfig({
  testDir: './e2e/bridge',
  testMatch: 'bridge-01-live.spec.ts',
  outputDir: path.join(testRoot, `playwright-${phase}`),
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  timeout: 60_000,
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
