import { defineConfig, devices } from '@playwright/test'
import {
  createOfficePlaywrightRunPaths,
  sweepOfficeHarnessEmptyShells,
  sweepStaleOfficeFixtureRoots,
} from './e2e/office/fixture-lifecycle.mjs'
import {
  OFFICE_E2E_PLAYWRIGHT_TEST_TIMEOUT_MS,
  officeE2eGlobalTimeoutMs,
} from './e2e/office/harness-bounds.mjs'

const rawPort = process.env.FUSION_OFFICE_E2E_PORT ?? '3311'
if (!/^(0|[1-9]\d*)$/.test(rawPort)) throw new Error('FUSION_OFFICE_E2E_PORT must be an integer')
const port = Number(rawPort)
if (port < 1024 || port > 65535 || port === 3001) {
  throw new Error('FUSION_OFFICE_E2E_PORT must be a non-production port from 1024 through 65535')
}
const runPaths = createOfficePlaywrightRunPaths(process.env.FUSION_OFFICE_E2E_RUN_ROOT)
process.env.FUSION_OFFICE_E2E_RUN_ROOT = runPaths.root

// Remove abandoned run roots from interrupted suites before this suite stages
// anything. A sweep failure never blocks the run.
try {
  const sweep = sweepStaleOfficeFixtureRoots({ currentRoot: runPaths.root })
  if (sweep.removed.length > 0) console.log(`OFFICE_E2E_STALE_ROOTS_SWEPT=${sweep.removed.length}`)
} catch (error) {
  console.warn(`OFFICE_E2E_STALE_SWEEP_SKIPPED=${error?.message ?? 'error'}`)
}

// R5: remove empty, age-gated harness-owned packaging shells (for example the
// `fusion-spec00a-*` leftovers in the system temporary root) alongside the
// stale-root sweep. A janitor failure never blocks the run.
try {
  sweepOfficeHarnessEmptyShells()
} catch (error) {
  console.warn(`OFFICE_E2E_JANITOR_SKIPPED=${error?.message ?? 'error'}`)
}

export default defineConfig({
  testDir: './e2e',
  timeout: OFFICE_E2E_PLAYWRIGHT_TEST_TIMEOUT_MS,
  globalTimeout: officeE2eGlobalTimeoutMs(),
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
  testMatch: [
    '**/office*.spec.ts',
    '**/shared-menu-component.spec.ts',
    '**/workspace-header-menus.spec.ts',
    '**/workspace-ribbon-add-menu.spec.ts',
    '**/view-tab-runtime.spec.ts',
  ],
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
