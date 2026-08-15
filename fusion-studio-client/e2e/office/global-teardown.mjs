import { finalizeOfficeProcessLifecycle } from './fixture-lifecycle.mjs'
import { takeOfficePlaywrightLifecycleState } from './global-setup.mjs'

export default async function globalTeardown() {
  const state = takeOfficePlaywrightLifecycleState()
  if (!state) {
    delete process.env.FUSION_OFFICE_E2E_BASE_URL
    delete process.env.FUSION_OFFICE_E2E_FIXTURE_ROOT
    delete process.env.FUSION_OFFICE_E2E_RUN_ROOT
    return
  }
  try {
    await finalizeOfficeProcessLifecycle(state.lifecycle, { reason: 'orderly' })
  } finally {
    state.removeSignalHandlers()
    delete process.env.FUSION_OFFICE_E2E_BASE_URL
    delete process.env.FUSION_OFFICE_E2E_FIXTURE_ROOT
    delete process.env.FUSION_OFFICE_E2E_RUN_ROOT
  }
}
