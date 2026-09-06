import { defineConfig } from '@playwright/test';

/** Source/store contract tests only. No app server and no shared profile. */
export default defineConfig({
  testDir: './e2e',
  testMatch: [
    'file-save-protocol-source.spec.ts',
    'resource-provenance-protocol-source.spec.ts',
    'file-viewer-read-projection-source.spec.ts',
    'file-viewer-central-cutover-source.spec.ts',
    'file-viewer-empty-tab.spec.ts',
    'agent-resource-projection-source.spec.ts',
  ],
  workers: 1,
  reporter: 'list',
});
