import { defineConfig, devices } from '@playwright/test'
import { createOfficePlaywrightRunPaths } from './e2e/office/fixture-lifecycle.mjs'

const rawPort = process.env.FUSION_OFFICE_E2E_PORT ?? '3311'
if (!/^(0|[1-9]\d*)$/.test(rawPort)) throw new Error('FUSION_OFFICE_E2E_PORT must be an integer')
const port = Number(rawPort)
if (port < 1024 || port > 65535 || port === 3001) {
  throw new Error('FUSION_OFFICE_E2E_PORT must be a non-production port from 1024 through 65535')
}
const runPaths = createOfficePlaywrightRunPaths(process.env.FUSION_OFFICE_E2E_RUN_ROOT)
process.env.FUSION_OFFICE_E2E_RUN_ROOT = runPaths.root

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  globalSetup: './e2e/office/global-setup.mjs',
  globalTeardown: './e2e/office/global-teardown.mjs',
  outputDir: runPaths.outputDir,
  reporter: [
    ['list'],
    ['./e2e/office/run-isolated-electron.mjs', { runRoot: runPaths.root }],
  ],
  retries: 0,
  testMatch: ['**/office*.spec.ts', '**/shared-menu-component.spec.ts'],
  workers: 1,
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
