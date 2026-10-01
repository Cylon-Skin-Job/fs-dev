// Shared resource and lifetime bounds for every Office E2E harness entry point.
//
// Slice 12.1 owns the wall-clock and process-lifetime bounds (R1/R2). Slice 12.2
// extends this same surface with the disk headroom, CoW delta, and janitor
// bounds, so keep new constants centralized here instead of at call sites.
import fs from 'node:fs'
import { createRequire } from 'node:module'

import {
  activeOfficeHarnessProcessIds,
  activeOfficeHarnessRoots,
  cleanupActiveOfficeHarness,
} from './fixture-lifecycle.mjs'

const require = createRequire(import.meta.url)
const {
  DEFAULT_PARENT_WATCH_INTERVAL_MS,
  createParentLifecycleWatch,
} = require('./parent-lifecycle-watch.cjs')

// `node --test` harness run deadline (override FUSION_OFFICE_E2E_TEST_DEADLINE_MS).
export const OFFICE_E2E_TEST_DEADLINE_ENV = 'FUSION_OFFICE_E2E_TEST_DEADLINE_MS'
export const OFFICE_E2E_TEST_DEADLINE_DEFAULT_MS = 15 * 60 * 1000
// Per-test timeout for the documented `node --test --test-timeout=<ms>` entry.
// Validated against observed per-test durations: the 2026-09-17 slice 12.1
// full run measured a maximum single-test duration of ~205 s, so this holds
// ~1.5x headroom while the 15 min run deadline remains the outer bound.
export const OFFICE_E2E_NODE_TEST_TIMEOUT_MS = 300 * 1000
// Playwright per-test timeout is a config constant (no override).
export const OFFICE_E2E_PLAYWRIGHT_TEST_TIMEOUT_MS = 120 * 1000
// Playwright global run timeout (override FUSION_OFFICE_E2E_GLOBAL_TIMEOUT_MS).
export const OFFICE_E2E_GLOBAL_TIMEOUT_ENV = 'FUSION_OFFICE_E2E_GLOBAL_TIMEOUT_MS'
export const OFFICE_E2E_GLOBAL_TIMEOUT_DEFAULT_MS = 45 * 60 * 1000
// Time a fired parent-loss/deadline watch may spend cleaning owned roots.
export const OFFICE_E2E_ORPHAN_CLEANUP_DEADLINE_MS = 30 * 1000
// Parent-loss poll cadence reuses the helper's single default literal.
export const OFFICE_E2E_PARENT_WATCH_INTERVAL_MS = DEFAULT_PARENT_WATCH_INTERVAL_MS

// R3: disk headroom reserved on top of the planned staged logical bytes. The
// override is expressed in MiB because that is the unit an operator reasons in;
// every consumer converts through officeE2eDiskHeadroomBytes so the literal
// appears exactly once.
export const OFFICE_E2E_DISK_HEADROOM_ENV = 'FUSION_OFFICE_E2E_DISK_HEADROOM_MB'
export const OFFICE_E2E_DISK_HEADROOM_DEFAULT_BYTES = 2 * 1024 * 1024 * 1024
// R3: physical-delta ceiling for copy-on-write staging. A run that physically
// duplicates staged bytes instead of cloning them must stay under this bound;
// max(64 MiB, 2% of staged logical bytes).
export const OFFICE_E2E_COW_DELTA_MIN_BYTES = 64 * 1024 * 1024
export const OFFICE_E2E_COW_DELTA_FRACTION = 0.02

// Stable markers: documented in the slice handoff and asserted by the probes.
export const OFFICE_E2E_PARENT_LOST_MARKER = 'OFFICE_E2E_PARENT_LOST_CLEANUP'
export const OFFICE_E2E_TEST_DEADLINE_EXCEEDED_MARKER = 'OFFICE_E2E_TEST_DEADLINE_EXCEEDED'
export const OFFICE_E2E_LIFETIME_CLEANUP_REPORT = 'OFFICE_E2E_LIFETIME_CLEANUP_REPORT'
export const OFFICE_E2E_LIFETIME_RETAINED = 'OFFICE_E2E_LIFETIME_RETAINED_ROOTS'
export const OFFICE_E2E_LIFETIME_EVIDENCE_ENV = 'FUSION_OFFICE_E2E_LIFETIME_EVIDENCE'
export const OFFICE_E2E_LOW_DISK_MARKER = 'OFFICE_E2E_LOW_DISK'
export const OFFICE_E2E_STAGED_BYTES_MARKER = 'OFFICE_E2E_STAGED_BYTES'
export const OFFICE_E2E_COW_OK_MARKER = 'OFFICE_E2E_COW_OK'
export const OFFICE_E2E_COW_REGRESSION_MARKER = 'OFFICE_E2E_COW_REGRESSION'
export const OFFICE_E2E_COW_SKIP_MARKER = 'OFFICE_E2E_COW_SKIP'
export const OFFICE_E2E_RESOURCE_MISSING_MARKER = 'OFFICE_E2E_RESOURCE_MISSING'
export const OFFICE_E2E_JANITOR_SWEPT_MARKER = 'OFFICE_E2E_JANITOR_SWEPT'

export function parseOfficeBoundsInteger(environment, name, fallback) {
  const raw = environment?.[name]
  if (raw === undefined || raw === '') return fallback
  if (typeof raw !== 'string' || !/^(0|[1-9]\d*)$/.test(raw)) {
    throw new Error(`${name} must be a non-negative integer`)
  }
  return Number(raw)
}

export function officeE2eTestDeadlineMs(environment = process.env) {
  const value = parseOfficeBoundsInteger(
    environment,
    OFFICE_E2E_TEST_DEADLINE_ENV,
    OFFICE_E2E_TEST_DEADLINE_DEFAULT_MS,
  )
  if (value <= 0) throw new Error(`${OFFICE_E2E_TEST_DEADLINE_ENV} must be greater than zero`)
  return value
}

export function officeE2eGlobalTimeoutMs(environment = process.env) {
  const value = parseOfficeBoundsInteger(
    environment,
    OFFICE_E2E_GLOBAL_TIMEOUT_ENV,
    OFFICE_E2E_GLOBAL_TIMEOUT_DEFAULT_MS,
  )
  if (value <= 0) throw new Error(`${OFFICE_E2E_GLOBAL_TIMEOUT_ENV} must be greater than zero`)
  return value
}

// R3: required free-space headroom in bytes. `FUSION_OFFICE_E2E_DISK_HEADROOM_MB`
// is validated by the shared integer parser so malformed overrides fail loudly
// instead of silently collapsing to a smaller bound.
export function officeE2eDiskHeadroomBytes(environment = process.env) {
  const fallbackMb = OFFICE_E2E_DISK_HEADROOM_DEFAULT_BYTES / (1024 * 1024)
  const valueMb = parseOfficeBoundsInteger(environment, OFFICE_E2E_DISK_HEADROOM_ENV, fallbackMb)
  return valueMb * 1024 * 1024
}

// R3: physical-delta ceiling for one staged logical byte count.
export function officeE2eCowDeltaCeilingBytes(stagedLogicalBytes) {
  if (!Number.isFinite(stagedLogicalBytes) || stagedLogicalBytes < 0) {
    throw new TypeError('Office E2E CoW ceiling requires a non-negative staged logical byte count')
  }
  return Math.max(
    OFFICE_E2E_COW_DELTA_MIN_BYTES,
    Math.ceil(stagedLogicalBytes * OFFICE_E2E_COW_DELTA_FRACTION),
  )
}

// The documented `node --test` invocation, kept next to the constant it uses so
// the value and its consumption cannot drift apart.
export function officeNodeTestHarnessInvocation() {
  return `node --test --test-timeout=${OFFICE_E2E_NODE_TEST_TIMEOUT_MS} e2e/office/fixture-lifecycle.test.mjs`
}

let markerFeed = null

// Remember the last harness marker this process wrote. The feed forwards every
// byte unchanged; diagnostics must never alter harness output. Shared by every
// armer in the process so nested armers do not stack wrappers.
function officeHarnessMarkerFeed() {
  if (markerFeed) return markerFeed
  const original = process.stdout.write
  let lastMarker = null
  process.stdout.write = function write(...args) {
    try {
      const [chunk] = args
      const text = typeof chunk === 'string'
        ? chunk
        : (Buffer.isBuffer(chunk) ? chunk.toString('utf8') : '')
      for (const line of text.split('\n')) {
        const trimmed = line.trim()
        if (trimmed.includes('OFFICE_E2E_')) lastMarker = trimmed
      }
    } catch { /* marker tracking is diagnostic only */ }
    return original.apply(this, args)
  }
  markerFeed = () => lastMarker
  return markerFeed
}

function writeLifetimeEvidence(evidencePath, record) {
  if (!evidencePath) return
  try {
    fs.writeFileSync(evidencePath, `${JSON.stringify(record)}\n`, { mode: 0o600 })
  } catch { /* evidence is best-effort; the process still exits with its code */ }
}

// Arm parent-loss self-termination (R1) and, when deadlineMs is set, the
// wall-clock run deadline (R2) for one long-lived harness entry point.
//
// On parent loss: print the stable marker, run bounded cleanup within the
// orphan cleanup deadline, and exit 143. On deadline expiry: print
// OFFICE_E2E_TEST_DEADLINE_EXCEEDED with diagnostics, run bounded cleanup, and
// exit 124. Retained roots are reported, never silently dropped.
export function armOfficeHarnessLifetime(options = {}) {
  const role = options.role
  if (typeof role !== 'string' || role.length === 0) {
    throw new TypeError('Office harness lifetime requires a role')
  }
  const environment = options.environment ?? process.env
  const intervalMs = options.intervalMs ?? OFFICE_E2E_PARENT_WATCH_INTERVAL_MS
  const deadlineMs = options.deadlineMs === undefined
    ? OFFICE_E2E_TEST_DEADLINE_DEFAULT_MS
    : options.deadlineMs
  const cleanupDeadlineMs = options.cleanupDeadlineMs ?? OFFICE_E2E_ORPHAN_CLEANUP_DEADLINE_MS
  const cleanupReason = options.cleanupReason ?? 'signal'
  const exit = options.exit ?? ((code) => process.exit(code))
  const evidencePath = options.evidencePath ?? environment[OFFICE_E2E_LIFETIME_EVIDENCE_ENV] ?? null
  const lastMarker = officeHarnessMarkerFeed()
  const parentWatch = createParentLifecycleWatch({ intervalMs, role })

  let terminated = false
  let deadlineTimer = null

  const finish = async ({ cause, exitCode, marker, extra = {} }) => {
    if (terminated) return
    terminated = true
    if (deadlineTimer) clearTimeout(deadlineTimer)
    parentWatch.stop()
    const before = {
      active_roots: activeOfficeHarnessRoots(),
      child_pids: activeOfficeHarnessProcessIds(),
      last_marker: lastMarker(),
    }
    let report
    try {
      report = await cleanupActiveOfficeHarness({ reason: cleanupReason, deadlineMs: cleanupDeadlineMs })
    } catch (error) {
      report = {
        childPids: before.child_pids,
        cleanedRoots: [],
        durationMs: 0,
        failures: [{ error, phase: 'cleanup-invocation' }],
        retainedRoots: before.active_roots,
        roots: before.active_roots,
      }
    }
    const record = {
      cause,
      cleaned_roots: report.cleanedRoots,
      duration_ms: report.durationMs,
      exit_code: exitCode,
      failures: report.failures,
      marker,
      retained_roots: report.retainedRoots,
      role,
      ...before,
      ...extra,
    }
    writeLifetimeEvidence(evidencePath, record)
    try { console.log(`${OFFICE_E2E_LIFETIME_CLEANUP_REPORT} ${JSON.stringify(record)}`) } catch { /* output already gone */ }
    if (report.retainedRoots.length > 0) {
      try {
        console.warn(`${OFFICE_E2E_LIFETIME_RETAINED}=${JSON.stringify(report.retainedRoots)} role=${role} cause=${cause}`)
      } catch { /* output already gone */ }
    }
    exit(exitCode)
  }

  parentWatch.lost.then((error) => {
    try {
      console.log(
        `${OFFICE_E2E_PARENT_LOST_MARKER} role=${role} expected_parent_pid=${error.expectedParentPid} current_parent_pid=${error.currentParentPid}`,
      )
    } catch { /* output already gone */ }
    finish({
      cause: 'parent-loss',
      exitCode: 143,
      extra: {
        current_parent_pid: error.currentParentPid,
        expected_parent_pid: error.expectedParentPid,
      },
      marker: OFFICE_E2E_PARENT_LOST_MARKER,
    })
  })

  if (Number.isSafeInteger(deadlineMs) && deadlineMs > 0) {
    deadlineTimer = setTimeout(() => {
      const diagnostics = {
        active_roots: activeOfficeHarnessRoots(),
        child_pids: activeOfficeHarnessProcessIds(),
        last_marker: lastMarker(),
      }
      try {
        console.log(
          `${OFFICE_E2E_TEST_DEADLINE_EXCEEDED_MARKER} role=${role} deadline_ms=${deadlineMs} active_roots=${JSON.stringify(diagnostics.active_roots)} child_pids=${JSON.stringify(diagnostics.child_pids)} last_marker=${diagnostics.last_marker ?? 'none'}`,
        )
      } catch { /* output already gone */ }
      finish({
        cause: 'deadline',
        exitCode: 124,
        extra: { deadline_ms: deadlineMs },
        marker: OFFICE_E2E_TEST_DEADLINE_EXCEEDED_MARKER,
      })
    }, deadlineMs)
    deadlineTimer.unref?.()
  }

  return Object.freeze({
    deadlineMs: Number.isSafeInteger(deadlineMs) && deadlineMs > 0 ? deadlineMs : null,
    parentWatch,
    role,
    stop() {
      if (deadlineTimer) clearTimeout(deadlineTimer)
      parentWatch.stop()
    },
  })
}
