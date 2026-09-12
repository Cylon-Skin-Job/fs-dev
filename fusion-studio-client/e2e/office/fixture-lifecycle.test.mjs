import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn, spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { zipSync } from 'fflate'

import {
  OFFICE_E2E_DIAGNOSTIC_TAIL_BYTES,
  OFFICE_E2E_MACHINE,
  assertOfficeFixturePathSafe,
  captureOfficeFixtureMode,
  cleanupOfficePlaywrightRunRoot,
  createOfficeFixture,
  createOfficePlaywrightRunPaths,
  createOfficeProcessLifecycle,
  createOfficeRuntimeLayout,
  destroyOfficeFixture,
  finalizeOfficeProcessLifecycle,
  resetOfficeFixtureScenario,
  resetOfficePlaywrightScenario,
  shouldCleanupOfficePlaywrightRunRoot,
  startOfficeOwnedProcess,
  stopOfficeOwnedProcesses,
  withOfficeProcessLifecycle,
} from './fixture-lifecycle.mjs'
import {
  ALIGNMENT_CANONICAL,
  BORDERS_CANONICAL,
  FIXTURE_SCENARIOS,
  FIXTURE_SCENARIO_IDS,
  PRESENTATION_OUTPUT_CANONICAL,
  TITLE_ROW_CANONICAL,
  copyFilename,
  renderFixtureDocument,
} from './fixture-scenarios.mjs'
import {
  OFFICE_E2E_OTHER_MACHINE,
  PALETTE_SELECTOR_SEEDS,
  PALETTE_SELECTOR_VARIANTS,
  globalPalettePath,
  localPalettePath,
} from './palette-selector-fixtures.mjs'
import {
  default as OfficePlaywrightCleanupReporter,
  OFFICE_E2E_ELECTRON_LAUNCH,
  createIsolatedElectronLaunchContext,
  createPresentationOutputLaunchContext,
  emitPresentationOutputFailureDiagnostics,
  formatPresentationOutputManualReady,
  inspectPresentationOutputDownloads,
  parseIsolatedElectronArguments,
  runIsolatedElectron,
} from './run-isolated-electron.mjs'

const testDirectory = path.dirname(fileURLToPath(import.meta.url))
const repositoryRoot = path.resolve(testDirectory, '..', '..', '..')
const launcherPath = path.join(testDirectory, 'run-isolated-electron.mjs')
const require = createRequire(import.meta.url)

const DOCUMENT_SHA256 = Object.freeze({
  'basic/Basic Tables.md': '6e993708dcca7e1b5fe52c03a29a189ffccb31168cad753c7e09cdbf368a7a32',
  'structure/Structure-R2-C1.md': 'd1e0fc33d9355e10bb8667448b861230aa734d305edffcf6146b35aa15178dc2',
  'structure/Structure-R3-C2.md': '6108382138f6989cae9cb450eae8886b2f5c8ea892286e85d13b84a6a0d22d44',
  'structure/Structure-R5-C4.md': 'f51582f8cca19725fd911d7edd939941579d496f77a2b2570f02bfaf357e1d4e',
  'color-integrity/Color Integrity.md': 'c6879b6d195c56fa93f775a23af2e175e585539db53e4c3d3ac982c01eede3f0',
  'geometry/Geometry-One.md': 'cf7b178d936dbef4c823dab32ae34193de658c525703781851fbb440477b8737',
  'geometry/Geometry-Three.md': '467597df27cf436bee48be8f24424d3d3d9ded8360696198215b3d8b484d7301',
  'geometry/Geometry-Four.md': '71344c305e9e4dbc6726296d934c0a4e8ca0a44d4d05cf66946d7c7432b94634',
  'geometry/Geometry-Long-Minimum.md': '4b6c261609e142678466b6c994466c27c26644d6245ec8f30b50db0f5b64beb1',
  'geometry/Geometry-Keyless.md': '0f07e85a0272d7fff24c857c51e16da797a2c797c2b4c5745b11f74f864bdd11',
  'palette/Palette-A.md': 'a41ce02ade10d4eed59b99db0dd3a17bab808fea61e08cb977c6d285d16bc32a',
  'palette/Palette-B.md': 'fe9b192dac8d3511d98cb316699fc0c28ce220fc310260841dbac164d2d8d589',
  'palette/Palette-C.md': '94535281786a0e1f6a41380e5e736fa5bd89c62a1a8d3e209476d03e3efeb8d2',
  'table-lifecycle/Table Lifecycle.md': '4f9b6ee4bd09793229fde2787370fb901b547cc12f2c092ebc02ef7900890c39',
  'overflow/Overflow.md': 'b8150e617a4925f2a60125a0e1105075e8ce00662d72cf4fe09625cb32da97a9',
  'title-row/Title Row.md': 'e461a9ae7ee998370bc39ed0cd85545a89384042906eac45aa51c45cfa702f67',
  'borders/Borders.md': 'dc9bb88eb0ee933a705a6782b431f9bb1ed0d308fac89b9ed90c93ef0c65a149',
  'alignment/Alignment.md': 'b451fdaa44de795d59a506334a4f9b5c186905424d065ad75278d256a1d0b523',
  'presentation-output/Presentation Output.md': '8927a627a2011565e80c533fd800eae9a8537b2f64d7b3c7bbe666971e11b4b5',
  'full/Structure-R2-C1.md': 'd1e0fc33d9355e10bb8667448b861230aa734d305edffcf6146b35aa15178dc2',
  'full/Structure-R3-C2.md': '6108382138f6989cae9cb450eae8886b2f5c8ea892286e85d13b84a6a0d22d44',
  'full/Structure-R5-C4.md': 'f51582f8cca19725fd911d7edd939941579d496f77a2b2570f02bfaf357e1d4e',
  'full/Color Integrity.md': 'c6879b6d195c56fa93f775a23af2e175e585539db53e4c3d3ac982c01eede3f0',
  'full/Geometry-One.md': 'cf7b178d936dbef4c823dab32ae34193de658c525703781851fbb440477b8737',
  'full/Geometry-Three.md': '467597df27cf436bee48be8f24424d3d3d9ded8360696198215b3d8b484d7301',
  'full/Geometry-Four.md': '71344c305e9e4dbc6726296d934c0a4e8ca0a44d4d05cf66946d7c7432b94634',
  'full/Geometry-Long-Minimum.md': '4b6c261609e142678466b6c994466c27c26644d6245ec8f30b50db0f5b64beb1',
  'full/Geometry-Keyless.md': '0f07e85a0272d7fff24c857c51e16da797a2c797c2b4c5745b11f74f864bdd11',
  'full/Table Lifecycle.md': '4f9b6ee4bd09793229fde2787370fb901b547cc12f2c092ebc02ef7900890c39',
  'full/Overflow.md': 'b8150e617a4925f2a60125a0e1105075e8ce00662d72cf4fe09625cb32da97a9',
  'full/Title Row.md': 'e461a9ae7ee998370bc39ed0cd85545a89384042906eac45aa51c45cfa702f67',
  'full/Borders.md': 'dc9bb88eb0ee933a705a6782b431f9bb1ed0d308fac89b9ed90c93ef0c65a149',
  'full/Alignment.md': 'b451fdaa44de795d59a506334a4f9b5c186905424d065ad75278d256a1d0b523',
  'full/Presentation Output.md': '8927a627a2011565e80c533fd800eae9a8537b2f64d7b3c7bbe666971e11b4b5',
  'full/Palette-A.md': 'a41ce02ade10d4eed59b99db0dd3a17bab808fea61e08cb977c6d285d16bc32a',
  'full/Palette-B.md': 'fe9b192dac8d3511d98cb316699fc0c28ce220fc310260841dbac164d2d8d589',
  'full/Palette-C.md': '94535281786a0e1f6a41380e5e736fa5bd89c62a1a8d3e209476d03e3efeb8d2',
})

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex')
}

function fileIdentity(candidate) {
  const stat = fs.statSync(candidate)
  const hash = crypto.createHash('sha256')
  const buffer = Buffer.allocUnsafe(1024 * 1024)
  const descriptor = fs.openSync(candidate, 'r')
  try {
    let bytesRead
    do {
      bytesRead = fs.readSync(descriptor, buffer, 0, buffer.length, null)
      if (bytesRead > 0) hash.update(buffer.subarray(0, bytesRead))
    } while (bytesRead > 0)
  } finally {
    fs.closeSync(descriptor)
  }
  return `${stat.size}:${hash.digest('hex')}`
}

function canonicalPath(candidate) {
  return fs.realpathSync(candidate)
}

function assertOutside(candidate, forbiddenRoot) {
  const relative = path.relative(canonicalPath(forbiddenRoot), canonicalPath(candidate))
  assert.ok(relative.startsWith('..') || path.isAbsolute(relative), `${candidate} must be outside ${forbiddenRoot}`)
}

function officeTemporaryRoots() {
  return new Set(fs.readdirSync(os.tmpdir()).filter((name) => name.startsWith('fusion-office-e2e-')))
}

async function unusedLoopbackPort() {
  const net = await import('node:net')
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (!address || typeof address === 'string') return reject(new Error('Could not allocate Office test port'))
      server.close((error) => error ? reject(error) : resolve(address.port))
    })
  })
}

async function waitForTemporaryRoots(expected, timeoutMs = 15_000) {
  const expectedNames = [...expected].sort()
  const deadline = Date.now() + timeoutMs
  let actualNames = []
  while (Date.now() < deadline) {
    actualNames = [...officeTemporaryRoots()].sort()
    if (actualNames.length === expectedNames.length
      && actualNames.every((name, index) => name === expectedNames[index])) return
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
  assert.deepEqual(actualNames, expectedNames)
}

async function runExpectedCleanupTraceFailure({ retain }) {
  const rootsBefore = officeTemporaryRoots()
  const port = await unusedLoopbackPort()
  const env = {
    ...process.env,
    FUSION_OFFICE_E2E_EXPECTED_TRACE_FAILURE: '1',
    FUSION_OFFICE_E2E_PORT: String(port),
  }
  delete env.FUSION_OFFICE_E2E_FIXTURE_ROOT
  delete env.FUSION_OFFICE_E2E_RUN_ROOT
  if (retain) env.FUSION_OFFICE_E2E_RETAIN = '1'
  else delete env.FUSION_OFFICE_E2E_RETAIN
  const cliPath = require.resolve('@playwright/test/cli')
  const child = spawn(
    process.execPath,
    [
      cliPath,
      'test',
      '--config=playwright.office.config.ts',
      'e2e/office-harness.spec.ts',
      '--project=chromium',
      '--workers=1',
      '--grep=expected cleanup trace probe',
    ],
    {
      cwd: path.join(repositoryRoot, 'fusion-studio-client'),
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )
  let diagnosticTail = ''
  let scanCarry = ''
  let sawExpectedFailure = false
  let sawTrace = false
  const rootsMentioned = new Set()
  const scanOutput = (chunk) => {
    const chunkText = String(chunk)
    const scanned = scanCarry + chunkText
    sawExpectedFailure ||= scanned.includes('Expected Office Playwright trace failure')
    sawTrace ||= scanned.includes('trace.zip')
    for (const match of scanned.matchAll(/fusion-office-e2e-[a-zA-Z0-9-]+/g)) {
      rootsMentioned.add(match[0])
    }
    scanCarry = scanned.slice(-128)
    diagnosticTail = (diagnosticTail + chunkText).slice(-65_536)
  }
  child.stdout.on('data', scanOutput)
  child.stderr.on('data', scanOutput)
  const exit = await new Promise((resolve, reject) => {
    child.once('error', reject)
    child.once('exit', (code, signal) => resolve({ code, signal }))
  })
  child.stdout.off('data', scanOutput)
  child.stderr.off('data', scanOutput)
  child.stdout.destroy()
  child.stderr.destroy()

  assert.equal(exit.signal, null, diagnosticTail)
  assert.equal(exit.code, 1, diagnosticTail)
  assert.equal(sawExpectedFailure, true, diagnosticTail)
  assert.equal(sawTrace, true, diagnosticTail)
  assert.equal(rootsMentioned.size, 1, diagnosticTail)
  const [rootName] = rootsMentioned
  assert.equal(rootsBefore.has(rootName), false, diagnosticTail)
  return {
    root: path.join(os.tmpdir(), rootName),
    rootName,
    rootsBefore,
  }
}

function fileTreeHashes(root, excludedRelativePaths = new Set()) {
  const hashes = {}
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const candidate = path.join(directory, entry.name)
      const relative = path.relative(root, candidate)
      if (excludedRelativePaths.has(relative)) continue
      if (entry.isDirectory()) visit(candidate)
      else if (entry.isFile()) hashes[relative] = sha256(fs.readFileSync(candidate))
    }
  }
  visit(root)
  return hashes
}

function assertTreeSymlinksStayWithin(root) {
  const canonicalRoot = fs.realpathSync(root)
  const visit = (candidate) => {
    const stat = fs.lstatSync(candidate)
    if (stat.isSymbolicLink()) {
      const target = fs.realpathSync(candidate)
      const relative = path.relative(canonicalRoot, target)
      assert.ok(relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative)), candidate)
      return
    }
    if (stat.isDirectory()) {
      for (const name of fs.readdirSync(candidate)) visit(path.join(candidate, name))
    }
  }
  visit(root)
}

function isProcessAlive(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    if (error.code === 'ESRCH') return false
    throw error
  }
}

async function runSignalProbe(signal) {
  const rootsBefore = officeTemporaryRoots()
  const child = spawn(process.execPath, [launcherPath], {
    env: {
      ...process.env,
      FUSION_OFFICE_E2E_LIFECYCLE_PROBE: '1',
      FUSION_OFFICE_E2E_RETAIN: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let stdout = ''
  let stderr = ''
  child.stdout.on('data', (chunk) => { stdout += chunk.toString() })
  child.stderr.on('data', (chunk) => { stderr += chunk.toString() })
  const deadline = Date.now() + 20_000
  let root
  let sentinelPid
  let descendantPid
  while (Date.now() < deadline) {
    root = /^OFFICE_E2E_PROBE_ROOT=(.+)$/m.exec(stdout)?.[1]
    sentinelPid = Number(/^OFFICE_E2E_PROBE_SENTINEL_PID=(\d+)$/m.exec(stdout)?.[1]) || null
    descendantPid = Number(/^OFFICE_E2E_PROBE_DESCENDANT_PID=(\d+)$/m.exec(stdout)?.[1]) || null
    if (root && sentinelPid && descendantPid) break
    if (child.exitCode !== null) throw new Error(`probe exited before ready: ${stdout}\n${stderr}`)
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
  assert.ok(root, `probe root was not reported: ${stdout}\n${stderr}`)
  assert.ok(sentinelPid, `probe sentinel was not reported: ${stdout}\n${stderr}`)
  assert.ok(descendantPid, `probe descendant was not reported: ${stdout}\n${stderr}`)
  assert.equal(fs.existsSync(root), true)
  assert.equal(isProcessAlive(sentinelPid), true)
  assert.equal(isProcessAlive(descendantPid), true)
  child.kill(signal)
  const result = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`probe did not exit after ${signal}`)), 20_000)
    child.once('exit', (code, exitSignal) => {
      clearTimeout(timeout)
      resolve({ code, signal: exitSignal })
    })
  })
  assert.ok(result.code === (signal === 'SIGINT' ? 130 : 143) || result.signal === signal)
  assert.equal(fs.existsSync(root), false)
  assert.equal(isProcessAlive(sentinelPid), false)
  assert.equal(isProcessAlive(descendantPid), false)
  assert.doesNotMatch(stdout, /^OFFICE_E2E_RETAINED_ROOT=/m)
  assert.deepEqual(officeTemporaryRoots(), rootsBefore)
}

async function runSetupSignalProbe(signal) {
  const rootsBefore = officeTemporaryRoots()
  const child = spawn(process.execPath, [launcherPath], {
    env: {
      ...process.env,
      FUSION_OFFICE_E2E_RETAIN: '1',
      FUSION_OFFICE_E2E_SETUP_SIGNAL_PROBE: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let stdout = ''
  let stderr = ''
  child.stdout.on('data', (chunk) => { stdout += chunk.toString() })
  child.stderr.on('data', (chunk) => { stderr += chunk.toString() })
  const deadline = Date.now() + 20_000
  let root
  let setupPid
  while (Date.now() < deadline) {
    root = /^OFFICE_E2E_SETUP_PROBE_ROOT=(.+)$/m.exec(stdout)?.[1]
    setupPid = Number(/^OFFICE_E2E_SETUP_PROBE_PID=(\d+)$/m.exec(stdout)?.[1]) || null
    if (root && setupPid) break
    if (child.exitCode !== null) throw new Error(`setup probe exited before allocation: ${stdout}\n${stderr}`)
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
  assert.ok(root, `setup probe root was not reported: ${stdout}\n${stderr}`)
  assert.ok(setupPid, `setup probe PID was not reported: ${stdout}\n${stderr}`)
  const dbPath = path.join(root, 'user-data', 'server-data', 'fusion.db')
  assert.equal(fs.existsSync(root), true)
  assert.equal(fs.existsSync(dbPath), false)
  assert.equal(isProcessAlive(setupPid), true)
  child.kill(signal)
  const result = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`setup probe did not exit after ${signal}`)), 20_000)
    child.once('exit', (code, exitSignal) => {
      clearTimeout(timeout)
      resolve({ code, signal: exitSignal })
    })
  })
  assert.ok(result.code === (signal === 'SIGINT' ? 130 : 143) || result.signal === signal)
  assert.equal(fs.existsSync(root), false)
  assert.equal(fs.existsSync(dbPath), false)
  assert.equal(isProcessAlive(setupPid), false)
  assert.doesNotMatch(stdout, /^OFFICE_E2E_RETAINED_ROOT=/m)
  assert.deepEqual(officeTemporaryRoots(), rootsBefore)
}

async function runTeardownSignalProbe(signal) {
  const rootsBefore = officeTemporaryRoots()
  const lifecycleUrl = pathToFileURL(path.join(testDirectory, 'fixture-lifecycle.mjs')).href
  const script = [
    `import { createOfficeProcessLifecycle, finalizeOfficeProcessLifecycle, installOfficeSignalCleanup, startOfficeOwnedProcess } from ${JSON.stringify(lifecycleUrl)}`,
    'const lifecycle = await createOfficeProcessLifecycle()',
    'installOfficeSignalCleanup(lifecycle)',
    "const sentinel = startOfficeOwnedProcess(lifecycle, process.execPath, ['-e', `process.on('SIGTERM', () => {}); console.log('READY'); setInterval(() => {}, 1000)`], { forwardOutput: false, readyPattern: /READY/ })",
    'await sentinel.ready',
    'console.log(`OFFICE_E2E_TEARDOWN_ROOT=${lifecycle.fixture.root}`)',
    'console.log(`OFFICE_E2E_TEARDOWN_SENTINEL_PID=${sentinel.child.pid}`)',
    "const finalization = finalizeOfficeProcessLifecycle(lifecycle, { reason: 'orderly' })",
    "console.log('OFFICE_E2E_TEARDOWN_STARTED=1')",
    'await finalization',
  ].join(';')
  const child = spawn(process.execPath, ['--input-type=module', '-e', script], {
    env: { ...process.env, FUSION_OFFICE_E2E_RETAIN: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let stdout = ''
  let stderr = ''
  child.stdout.on('data', (chunk) => { stdout += chunk.toString() })
  child.stderr.on('data', (chunk) => { stderr += chunk.toString() })
  let root
  let sentinelPid
  try {
    const deadline = Date.now() + 20_000
    while (Date.now() < deadline) {
      root = /^OFFICE_E2E_TEARDOWN_ROOT=(.+)$/m.exec(stdout)?.[1]
      sentinelPid = Number(/^OFFICE_E2E_TEARDOWN_SENTINEL_PID=(\d+)$/m.exec(stdout)?.[1]) || null
      if (root && sentinelPid && /^OFFICE_E2E_TEARDOWN_STARTED=1$/m.test(stdout)) break
      if (child.exitCode !== null) throw new Error(`teardown probe exited before ready: ${stdout}\n${stderr}`)
      await new Promise((resolve) => setTimeout(resolve, 25))
    }
    assert.ok(root, `teardown probe root was not reported: ${stdout}\n${stderr}`)
    assert.ok(sentinelPid, `teardown sentinel was not reported: ${stdout}\n${stderr}`)
    assert.equal(fs.existsSync(root), true)
    assert.equal(isProcessAlive(sentinelPid), true)
    child.kill(signal)
    const result = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error(`teardown probe did not exit after ${signal}`)), 20_000)
      child.once('exit', (code, exitSignal) => {
        clearTimeout(timeout)
        resolve({ code, signal: exitSignal })
      })
    })
    assert.ok(result.code === (signal === 'SIGINT' ? 130 : 143) || result.signal === signal)
    assert.equal(fs.existsSync(root), false)
    assert.equal(isProcessAlive(sentinelPid), false)
    assert.doesNotMatch(stdout, /^OFFICE_E2E_RETAINED_ROOT=/m)
    assert.deepEqual(officeTemporaryRoots(), rootsBefore)
  } finally {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL')
    if (root && path.dirname(root) === fs.realpathSync(os.tmpdir()) && path.basename(root).startsWith('fusion-office-e2e-')) {
      fs.rmSync(root, { recursive: true, force: true })
    }
  }
}

const BASIC_DOCUMENT = `---
name: 'Basic Tables'
description: 'Office E2E basic/basic'
metadata:
  fixtureScenario: 'basic'
  fixtureCase: 'basic'
  fixtureCopy: 1
  preserveUnknown: 'keep-me'
---
Before basic.

## basic-a

| basic-a-h0 | basic-a-h1 |
| --- | --- |
| basic-a-r1c0 | basic-a-r1c1 |

## basic-b

| basic-b-h0 | basic-b-h1 |
| --- | --- |
| basic-b-r1c0 | basic-b-r1c1 |

After basic.
`

test('[slice 00.1] seeds only canonical workspace A, its active ID, V2 Office view, and basic document', async () => {
  const fixture = await createOfficeFixture()
  try {
    assert.equal(fixture.machineName, OFFICE_E2E_MACHINE)
    assert.equal(process.env.FUSION_LOCAL_MACHINE, OFFICE_E2E_MACHINE)
    assert.deepEqual(fixture.workspaceIds, ['office-e2e-a'])
    assert.deepEqual(fixture.registryRows, [{
      id: 'office-e2e-a',
      label: 'Office E2E A',
      icon: 'description',
      description: 'Isolated Office fixture A',
      repoPath: fixture.workspaceRoots.a,
      sortOrder: 0,
      type: 'code',
      ribbonVisible: true,
      ribbonSortOrder: 0,
    }])
    assert.equal(fixture.lastActiveWorkspaceId, 'office-e2e-a')
    assert.equal(fs.existsSync(fixture.dbPath), true)
    assert.equal(fs.readFileSync(fixture.dbPath).subarray(0, 16).toString('utf8'), 'SQLite format 3\u0000')
    assert.equal(assertOfficeFixturePathSafe(fixture.root), fixture.root)
    assert.equal(assertOfficeFixturePathSafe(fixture.appUserData), fixture.appUserData)
    assert.equal(assertOfficeFixturePathSafe(fixture.dbPath), fixture.dbPath)
    assert.equal(assertOfficeFixturePathSafe(fixture.workspaceRoots.a), fixture.workspaceRoots.a)
    assert.deepEqual(Object.keys(fixture).sort(), [
      'appUserData',
      'dbPath',
      'lastActiveWorkspaceId',
      'machineName',
      'registryRows',
      'root',
      'scenario',
      'scenarioFiles',
      'scenarioPaletteFiles',
      'variant',
      'workspaceIds',
      'workspaceRoots',
    ])

    const machineRoot = path.join(fixture.workspaceRoots.a, 'ai', OFFICE_E2E_MACHINE)
    const officeRoot = path.join(machineRoot, 'Office')
    const viewRoot = path.join(machineRoot, 'System', 'Views', '001-office-viewer')
    assert.ok(fs.statSync(machineRoot).isDirectory())
    assert.ok(fs.statSync(officeRoot).isDirectory())
    assert.equal(fs.existsSync(path.join(machineRoot, 'Views')), false)
    assert.equal(fs.existsSync(path.join(viewRoot, 'state', 'state.json')), true)
    assert.equal(fs.readFileSync(path.join(viewRoot, 'manifest.md'), 'utf8'), `---
name: Office
description: Office document viewer and editor surface.
metadata:
  view-id: office-viewer
  view-type: office
  data-source: Office
  enabled: true
---
`)
    assert.equal(fs.readFileSync(path.join(viewRoot, 'content.json'), 'utf8'), `{
  "version": 1,
  "dataSource": "Office",
  "root": {
    "type": "workspace-relative",
    "path": "ai/\${machine}/Office"
  }
}
`)

    const documentPath = path.join(officeRoot, '001-Fixtures', 'Basic Tables.md')
    assert.equal(fs.readFileSync(documentPath, 'utf8'), BASIC_DOCUMENT)
    assert.equal(fixture.scenarioFiles.length, 1)
    assert.equal(fixture.scenarioFiles[0].path, documentPath)
    assert.deepEqual(fixture.scenarioPaletteFiles, [])
    assert.equal(fixture.variant, null)
  } finally {
    const root = fixture.root
    await destroyOfficeFixture(fixture)
    await destroyOfficeFixture(fixture)
    assert.equal(fs.existsSync(root), false)
  }
})

test('[slice 00.1] three-workspace registry order, fields, and machine roots are canonical', async () => {
  const fixture = await createOfficeFixture({ workspaces: 3 })
  try {
    assert.deepEqual(fixture.workspaceIds, ['office-e2e-a', 'office-e2e-b', 'office-e2e-c'])
    assert.deepEqual(fixture.registryRows, ['a', 'b', 'c'].map((suffix, index) => ({
      id: `office-e2e-${suffix}`,
      label: `Office E2E ${suffix.toUpperCase()}`,
      icon: 'description',
      description: `Isolated Office fixture ${suffix.toUpperCase()}`,
      repoPath: fixture.workspaceRoots[suffix],
      sortOrder: index,
      type: 'code',
      ribbonVisible: true,
      ribbonSortOrder: index,
    })))
    for (const suffix of ['a', 'b', 'c']) {
      assert.equal(fixture.workspaceRoots[suffix], path.join(fixture.root, `workspace-${suffix}`))
      assert.ok(fs.statSync(path.join(fixture.workspaceRoots[suffix], 'ai', OFFICE_E2E_MACHINE)).isDirectory())
    }
  } finally {
    await destroyOfficeFixture(fixture)
  }
})

test('[slice 00.1] every immutable foundation scenario renders its exact canonical document bytes', async () => {
  const fixture = await createOfficeFixture({ workspaces: 3 })
  try {
    const observed = {}
    for (const scenarioId of FIXTURE_SCENARIO_IDS) {
      await resetOfficeFixtureScenario(fixture, scenarioId)
      for (const file of fixture.scenarioFiles) {
        observed[`${scenarioId}/${file.filename}`] = sha256(fs.readFileSync(file.path))
      }
      const declaredFilenames = FIXTURE_SCENARIOS[scenarioId].documents.map(({ filename }) => filename).sort()
      assert.deepEqual(fixture.scenarioFiles.map(({ filename }) => filename).sort(), declaredFilenames)
      const firstPass = fixture.scenarioFiles.map(({ path: filePath }) => fs.readFileSync(filePath))
      await resetOfficeFixtureScenario(fixture, scenarioId)
      assert.deepEqual(fixture.scenarioFiles.map(({ path: filePath }) => fs.readFileSync(filePath)), firstPass)
    }
    assert.deepEqual(observed, DOCUMENT_SHA256)
  } finally {
    await destroyOfficeFixture(fixture)
  }
})

test('[slice 00.1] basic scenario is deterministic and reset removes mutations and undeclared files', async () => {
  const fixture = await createOfficeFixture()
  try {
    const documentPath = fixture.scenarioFiles[0].path
    fs.appendFileSync(documentPath, 'mutation\n')
    fs.writeFileSync(path.join(path.dirname(documentPath), 'Undeclared.md'), 'undeclared\n')
    const firstReset = await resetOfficeFixtureScenario(fixture, 'basic')
    const firstBytes = fs.readFileSync(firstReset[0].path)
    const secondReset = await resetOfficeFixtureScenario(fixture, 'basic')
    const secondBytes = fs.readFileSync(secondReset[0].path)
    assert.deepEqual(firstBytes, Buffer.from(BASIC_DOCUMENT, 'utf8'))
    assert.deepEqual(secondBytes, firstBytes)
    assert.equal(fs.existsSync(path.join(path.dirname(documentPath), 'Undeclared.md')), false)
  } finally {
    await destroyOfficeFixture(fixture)
  }
})

test('[slice 00.1] copy expansion changes only filename, name, fixtureCopy, and derived file ID', async () => {
  const fixture = await createOfficeFixture({ copies: 2 })
  try {
    assert.deepEqual(fixture.scenarioFiles.map(({ filename }) => filename), [
      'Basic Tables--copy-01.md',
      'Basic Tables--copy-02.md',
    ])
    const [first, second] = fixture.scenarioFiles
    assert.equal(first.fileId, `a:${first.filename}`)
    assert.equal(second.fileId, `a:${second.filename}`)
    const firstBytes = fs.readFileSync(first.path, 'utf8')
    const secondBytes = fs.readFileSync(second.path, 'utf8')
    assert.equal(firstBytes, BASIC_DOCUMENT
      .replace("name: 'Basic Tables'", "name: 'Basic Tables--copy-01'"))
    assert.equal(secondBytes
      .replace("name: 'Basic Tables--copy-02'", "name: 'Basic Tables--copy-01'")
      .replace('  fixtureCopy: 2', '  fixtureCopy: 1'), firstBytes)

    await resetOfficeFixtureScenario(fixture, 'structure', { copies: 2 })
    assert.deepEqual(fixture.scenarioFiles.map(({ filename }) => filename), [
      'Structure-R2-C1--copy-01.md',
      'Structure-R2-C1--copy-02.md',
      'Structure-R3-C2--copy-01.md',
      'Structure-R3-C2--copy-02.md',
      'Structure-R5-C4--copy-01.md',
      'Structure-R5-C4--copy-02.md',
    ])
  } finally {
    await destroyOfficeFixture(fixture)
  }
})

test('[slice 01.1] declared non-palette variants render exact bytes and reset through lifecycle selection', async () => {
  const fixture = await createOfficeFixture({ scenario: 'structure' })
  try {
    const baseByFilename = Object.fromEntries(fixture.scenarioFiles.map(({ filename, path: filePath }) => [
      filename,
      fs.readFileSync(filePath, 'utf8'),
    ]))
    assert.equal(fixture.variant, null)
    assert.ok(Object.values(baseByFilename).every((bytes) => !bytes.includes('\n  tables:\n')))

    const exactMetadataByFilename = {
      'Structure-R2-C1.md': [
        '  tables:',
        "    - { tableIndex: 0, fingerprint: 'fixture-structure-r2-c1', columns: [80] }",
        '  tableColors:',
        "    - { tableIndex: 0, fingerprint: 'fixture-structure-r2-c1', cells: { '1,0': '#ffeeaa' } }",
      ],
      'Structure-R3-C2.md': [
        '  tables:',
        "    - { tableIndex: 0, fingerprint: 'fixture-structure-r3-c2', columns: [90, 110] }",
        '  tableColors:',
        "    - { tableIndex: 0, fingerprint: 'fixture-structure-r3-c2', rows: { '1': { color: '#d6ebff', rank: 2 } }, columns: { '1': { color: '#d6ffd6', rank: 3 } } }",
      ],
      'Structure-R5-C4.md': [
        '  tables:',
        "    - { tableIndex: 0, fingerprint: 'fixture-structure-r5-c4', columns: [70, 90, 110, 130] }",
        '  tableColors:',
        "    - { tableIndex: 0, fingerprint: 'fixture-structure-r5-c4', cells: { '2,2': '#ffcccc' }, rows: { '3': { color: '#fff2cc', rank: 4 } }, columns: { '3': { color: '#e6ccff', rank: 5 } } }",
      ],
    }

    await resetOfficeFixtureScenario(fixture, 'structure', { variant: 'metadata' })
    assert.equal(fixture.variant, 'metadata')
    for (const { filename, path: filePath } of fixture.scenarioFiles) {
      const expected = baseByFilename[filename].replace(
        "  preserveUnknown: 'keep-me'\n",
        `  preserveUnknown: 'keep-me'\n${exactMetadataByFilename[filename].join('\n')}\n`,
      )
      assert.equal(fs.readFileSync(filePath, 'utf8'), expected)
    }

    const exactPartialWidthsByFilename = {
      'Structure-R2-C1.md': [80],
      'Structure-R3-C2.md': [90],
      'Structure-R5-C4.md': [70, 90],
    }
    await resetOfficeFixtureScenario(fixture, 'structure', { variant: 'partial-widths' })
    assert.equal(fixture.variant, 'partial-widths')
    for (const { filename, path: filePath } of fixture.scenarioFiles) {
      const fixtureCase = filename.slice(0, -3).toLowerCase()
      const widths = exactPartialWidthsByFilename[filename]
      const expected = baseByFilename[filename].replace(
        "  preserveUnknown: 'keep-me'\n",
        [
          "  preserveUnknown: 'keep-me'",
          '  tables:',
          `    - { tableIndex: 0, fingerprint: 'fixture-${fixtureCase}', columns: [${widths.join(', ')}] }`,
          '',
        ].join('\n'),
      )
      assert.equal(fs.readFileSync(filePath, 'utf8'), expected)
    }

    await resetOfficeFixtureScenario(fixture, 'structure', { variant: 'raw-metadata' })
    assert.equal(fixture.variant, 'raw-metadata')
    for (const { filename, path: filePath } of fixture.scenarioFiles) {
      const template = FIXTURE_SCENARIOS.structure.documents.find((entry) => entry.filename === filename)
      assert.ok(template)
      assert.equal(
        fs.readFileSync(filePath, 'utf8'),
        renderFixtureDocument('structure', template, 1, 1, 'raw-metadata'),
      )
    }

    await resetOfficeFixtureScenario(fixture, 'structure')
    assert.equal(fixture.variant, null)
    for (const { filename, path: filePath } of fixture.scenarioFiles) {
      assert.equal(fs.readFileSync(filePath, 'utf8'), baseByFilename[filename])
    }
  } finally {
    await destroyOfficeFixture(fixture)
  }
})

test('[slice 01.1] unknown declared-scenario variants fail before fixture allocation', async () => {
  const rootsBefore = officeTemporaryRoots()
  await assert.rejects(
    createOfficeFixture({ scenario: 'structure', variant: 'unknown' }),
    /Unknown Office fixture structure variant: unknown/,
  )
  assert.deepEqual(officeTemporaryRoots(), rootsBefore)
})

test('[slice 05S.3] selector variants seed exact local, global, and transported-machine bytes', async () => {
  const fixture = await createOfficeFixture({
    workspaces: 3,
    scenario: 'palette',
    variant: 'machine-move',
  })
  try {
    for (const variant of FIXTURE_SCENARIOS.palette.variants) {
      await resetOfficeFixtureScenario(fixture, 'palette', { variant })
      assert.equal(fixture.variant, variant)
      const seed = PALETTE_SELECTOR_SEEDS[variant]
      for (const suffix of ['a', 'b', 'c']) {
        const local = localPalettePath(fixture.workspaceRoots[suffix], OFFICE_E2E_MACHINE)
        assert.deepEqual(fs.readFileSync(local), Buffer.from(seed.local[suffix]))
        const transported = localPalettePath(fixture.workspaceRoots[suffix], OFFICE_E2E_OTHER_MACHINE)
        if (seed.otherMachineLocal) {
          assert.deepEqual(fs.readFileSync(transported), Buffer.from(seed.otherMachineLocal[suffix]))
        } else {
          assert.equal(fs.existsSync(transported), false)
        }
      }
      assert.deepEqual(
        fs.readFileSync(globalPalettePath(fixture.appUserData)),
        Buffer.from(seed.global),
      )
      assert.equal(fixture.scenarioPaletteFiles.length, seed.otherMachineLocal ? 7 : 4)
      if (variant === 'machine-move') {
        for (const suffix of ['a', 'b', 'c']) {
          const currentDocument = path.join(
            fixture.workspaceRoots[suffix],
            'ai',
            OFFICE_E2E_MACHINE,
            'Office',
            '001-Fixtures',
            `Palette-${suffix.toUpperCase()}.md`,
          )
          const transportedDocument = currentDocument.replace(OFFICE_E2E_MACHINE, OFFICE_E2E_OTHER_MACHINE)
          assert.deepEqual(fs.readFileSync(transportedDocument), fs.readFileSync(currentDocument))
          assert.equal(fs.existsSync(path.join(
            fixture.workspaceRoots[suffix],
            'ai',
            OFFICE_E2E_OTHER_MACHINE,
            'System',
            'Views',
            '001-office-viewer',
            'manifest.md',
          )), true)
        }
      }
    }

    const local = localPalettePath(fixture.workspaceRoots.a, OFFICE_E2E_MACHINE)
    const global = globalPalettePath(fixture.appUserData)
    fs.writeFileSync(local, 'mutated\n')
    fs.writeFileSync(global, 'mutated\n')
    await resetOfficeFixtureScenario(fixture, 'palette', { variant: 'global-selected' })
    assert.equal(fs.readFileSync(local, 'utf8'), PALETTE_SELECTOR_SEEDS['global-selected'].local.a)
    assert.equal(fs.readFileSync(global, 'utf8'), PALETTE_SELECTOR_SEEDS['global-selected'].global)
    await resetOfficeFixtureScenario(fixture, 'basic')
    assert.deepEqual(fixture.scenarioPaletteFiles, [])
    assert.equal(fs.existsSync(local), false)
    assert.equal(fs.existsSync(global), false)
  } finally {
    await destroyOfficeFixture(fixture)
  }
})

test('[slice 00.1] setup allocates unique roots and teardown restores the process environment', async () => {
  const beforeAppUserData = process.env.FUSION_APP_USER_DATA
  const beforeMachine = process.env.FUSION_LOCAL_MACHINE
  const first = await createOfficeFixture()
  const firstRoot = first.root
  await destroyOfficeFixture(first)
  const second = await createOfficeFixture()
  const secondRoot = second.root
  await destroyOfficeFixture(second)
  assert.notEqual(firstRoot, secondRoot)
  assert.equal(fs.existsSync(firstRoot), false)
  assert.equal(fs.existsSync(secondRoot), false)
  assert.equal(process.env.FUSION_APP_USER_DATA, beforeAppUserData)
  assert.equal(process.env.FUSION_LOCAL_MACHINE, beforeMachine)
})

test('[slice 00.1] a second active fixture fails before allocation or environment mutation', async () => {
  const fixture = await createOfficeFixture()
  const activeAppUserData = process.env.FUSION_APP_USER_DATA
  const rootsBefore = new Set(fs.readdirSync(os.tmpdir()).filter((name) => name.startsWith('fusion-office-e2e-')))
  try {
    await assert.rejects(createOfficeFixture(), /already active/)
    assert.equal(process.env.FUSION_APP_USER_DATA, activeAppUserData)
    assert.deepEqual(
      new Set(fs.readdirSync(os.tmpdir()).filter((name) => name.startsWith('fusion-office-e2e-'))),
      rootsBefore,
    )
  } finally {
    await destroyOfficeFixture(fixture)
  }
})

test('[slice 00.1] teardown remains retryable when root removal fails', async () => {
  const fixture = await createOfficeFixture()
  const allocatedRoot = fixture.root
  const originalRmSync = fs.rmSync
  let injected = false
  try {
    fs.rmSync = (target, options) => {
      if (!injected && path.resolve(target) === path.resolve(allocatedRoot)) {
        injected = true
        const error = new Error('injected fixture cleanup failure')
        error.code = 'EIO'
        throw error
      }
      return originalRmSync(target, options)
    }
    await assert.rejects(destroyOfficeFixture(fixture), { code: 'EIO' })
    assert.equal(fs.existsSync(allocatedRoot), true)
    await assert.rejects(resetOfficeFixtureScenario(fixture), /not active/)
  } finally {
    fs.rmSync = originalRmSync
  }
  await destroyOfficeFixture(fixture)
  assert.equal(fs.existsSync(allocatedRoot), false)
  await destroyOfficeFixture(fixture)
})

test('[slice 00.1] teardown evicts isolated server modules before later same-process use', async () => {
  const fixture = await createOfficeFixture()
  const retiredRoot = fixture.root
  const dbModulePath = path.join(repositoryRoot, 'fusion-studio-server', 'lib', 'db.js')
  const registryModulePath = path.join(repositoryRoot, 'fusion-studio-server', 'lib', 'workspace', 'registry-service.js')
  const resolvedDbModulePath = require.resolve(dbModulePath)
  const resolvedRegistryModulePath = require.resolve(registryModulePath)
  assert.ok(require.cache[resolvedDbModulePath])
  assert.ok(require.cache[resolvedRegistryModulePath])

  await destroyOfficeFixture(fixture)

  assert.equal(require.cache[resolvedDbModulePath], undefined)
  assert.equal(require.cache[resolvedRegistryModulePath], undefined)
  const restoredDbModule = require(dbModulePath)
  assert.equal(
    restoredDbModule.DB_PATH,
    path.join(repositoryRoot, 'fusion-studio-server', 'data', 'fusion.db'),
  )
  assert.equal(fs.existsSync(retiredRoot), false)
})

test('[slice 00.1] setup preserves its error and retries a transient cleanup failure', async () => {
  const createServicePath = path.join(repositoryRoot, 'fusion-studio-server', 'lib', 'workspace', 'create-service.js')
  const createService = require(createServicePath)
  const originalScaffoldProject = createService.scaffoldProject
  const originalRmSync = fs.rmSync
  const rootsBefore = new Set(fs.readdirSync(os.tmpdir()).filter((name) => name.startsWith('fusion-office-e2e-')))
  let cleanupFailureInjected = false
  try {
    createService.scaffoldProject = () => {
      const error = new Error('injected setup failure')
      error.code = 'ESETUP'
      throw error
    }
    fs.rmSync = (target, options) => {
      if (!cleanupFailureInjected && path.basename(target).startsWith('fusion-office-e2e-')) {
        cleanupFailureInjected = true
        const error = new Error('injected cleanup failure')
        error.code = 'EREMOVE'
        throw error
      }
      return originalRmSync(target, options)
    }
    await assert.rejects(createOfficeFixture(), { code: 'ESETUP' })
  } finally {
    createService.scaffoldProject = originalScaffoldProject
    fs.rmSync = originalRmSync
  }
  assert.equal(cleanupFailureInjected, true)
  assert.deepEqual(
    new Set(fs.readdirSync(os.tmpdir()).filter((name) => name.startsWith('fusion-office-e2e-'))),
    rootsBefore,
  )

  const fixture = await createOfficeFixture()
  await destroyOfficeFixture(fixture)
})

test('[slice 00.1] invalid setup fails before allocation and a destroyed fixture cannot recreate files', async () => {
  const beforeAppUserData = process.env.FUSION_APP_USER_DATA
  const beforeMachine = process.env.FUSION_LOCAL_MACHINE
  const rootsBefore = new Set(fs.readdirSync(os.tmpdir()).filter((name) => name.startsWith('fusion-office-e2e-')))
  await assert.rejects(createOfficeFixture({ scenario: 'palette', workspaces: 1 }), /unavailable workspace b/)
  assert.equal(process.env.FUSION_APP_USER_DATA, beforeAppUserData)
  assert.equal(process.env.FUSION_LOCAL_MACHINE, beforeMachine)
  assert.deepEqual(
    new Set(fs.readdirSync(os.tmpdir()).filter((name) => name.startsWith('fusion-office-e2e-'))),
    rootsBefore,
  )

  const fixture = await createOfficeFixture()
  const root = fixture.root
  await destroyOfficeFixture(fixture)
  await assert.rejects(resetOfficeFixtureScenario(fixture), /not active/)
  assert.equal(fs.existsSync(root), false)
})

test('[slice 00.1] lifecycle ownership is anchored to private allocation state', async () => {
  const fixture = await createOfficeFixture()
  const allocatedRoot = fixture.root
  const allocatedWorkspaceRoot = fixture.workspaceRoots.a
  try {
    fixture.root = os.tmpdir()
    fixture.workspaceRoots.a = os.tmpdir()
    await assert.rejects(resetOfficeFixtureScenario(fixture), /escapes its allocated root/)
  } finally {
    fixture.workspaceRoots.a = allocatedWorkspaceRoot
    await destroyOfficeFixture(fixture)
  }
  assert.equal(fs.existsSync(allocatedRoot), false)
})

test('[slice 05S.3] catalog registers only current selector palette variant IDs', () => {
  assert.deepEqual(FIXTURE_SCENARIO_IDS, [
    'basic',
    'structure',
    'color-integrity',
    'geometry',
    'palette',
    'table-lifecycle',
    'overflow',
    'title-row',
    'borders',
    'alignment',
    'presentation-output',
    'full',
  ])
  assert.deepEqual(FIXTURE_SCENARIOS.palette.variants, PALETTE_SELECTOR_VARIANTS)
  assert.ok(Object.isFrozen(FIXTURE_SCENARIOS))
  assert.ok(Object.isFrozen(FIXTURE_SCENARIOS.basic.documents[0].tables[0]))
  assert.deepEqual(
    JSON.parse(PALETTE_SELECTOR_SEEDS['global-selected'].local.a),
    { custom_colors: ['#aa0001'], sync_enabled: true },
  )
  assert.deepEqual(
    JSON.parse(PALETTE_SELECTOR_SEEDS['global-selected'].global),
    { custom_colors: ['#112233', '#445566'] },
  )
  assert.equal(PALETTE_SELECTOR_SEEDS['selected-source-errors'].global, '{"custom_colors":[')
})

test('[slice 06.4] table-lifecycle renders the exact canonical manifest and twelve isolated copies', () => {
  const scenario = FIXTURE_SCENARIOS['table-lifecycle']
  const template = scenario.documents[0]
  assert.deepEqual(scenario.variants, [])
  assert.equal(renderFixtureDocument('table-lifecycle', template), [
    '---',
    "name: 'Table Lifecycle'",
    "description: 'Office E2E table-lifecycle/table-lifecycle'",
    'metadata:',
    "  fixtureScenario: 'table-lifecycle'",
    "  fixtureCase: 'table-lifecycle'",
    '  fixtureCopy: 1',
    "  preserveUnknown: 'keep-me'",
    '  tables:',
    "    - { tableIndex: 0, fingerprint: 'fixture-life-a', columns: [100, 140] }",
    "    - { tableIndex: 1, fingerprint: 'fixture-life-b', columns: [120, 160] }",
    "    - { tableIndex: 2, fingerprint: 'fixture-life-c', columns: [140, 180] }",
    '  tableColors:',
    "    - { tableIndex: 0, fingerprint: 'fixture-life-a', cells: { '0,0': '#aa0000' } }",
    "    - { tableIndex: 1, fingerprint: 'fixture-life-b', cells: { '0,0': '#00aa00' } }",
    "    - { tableIndex: 2, fingerprint: 'fixture-life-c', cells: { '0,0': '#0000aa' } }",
    '  tableStyles:',
    "    - { tableIndex: 0, fingerprint: 'fixture-life-a', fixtureSeed: 'keep-style-0' }",
    "    - { tableIndex: 1, fingerprint: 'fixture-life-b', fixtureSeed: 'keep-style-1' }",
    "    - { tableIndex: 2, fingerprint: 'fixture-life-c', fixtureSeed: 'keep-style-2' }",
    '---',
    'Before table-lifecycle.',
    '',
    '## life-a',
    '',
    '| life-a-h0 | life-a-h1 |',
    '| --- | --- |',
    '| life-a-r1c0 | life-a-r1c1 |',
    '',
    '## life-b',
    '',
    '| life-b-h0 | life-b-h1 |',
    '| --- | --- |',
    '| life-b-r1c0 | life-b-r1c1 |',
    '| life-b-r2c0 | life-b-r2c1 |',
    '',
    '## life-c',
    '',
    '| life-c-h0 | life-c-h1 |',
    '| --- | --- |',
    '| life-c-r1c0 | life-c-r1c1 |',
    '',
    'After table-lifecycle.',
    '',
  ].join('\n'))
  for (let copy = 1; copy <= 12; copy += 1) {
    const rendered = renderFixtureDocument('table-lifecycle', template, copy, 12)
    assert.match(rendered, new RegExp(`^---\\nname: 'Table Lifecycle--copy-${String(copy).padStart(2, '0')}'\\n`))
    assert.match(rendered, new RegExp(`\\n  fixtureCopy: ${copy}\\n`))
    assert.equal(Buffer.from(rendered).subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf])), false)
    assert.equal(rendered.includes('\r'), false)
    assert.equal(rendered.endsWith('\n'), true)
  }
})

test('[slice 07.1] overflow renders the exact canonical fixture oracle', () => {
  const scenario = FIXTURE_SCENARIOS.overflow
  const template = scenario.documents[0]
  assert.deepEqual(scenario.variants, [])
  assert.equal(renderFixtureDocument('overflow', template), [
    '---',
    "name: 'Overflow'",
    "description: 'Office E2E overflow/overflow'",
    'metadata:',
    "  fixtureScenario: 'overflow'",
    "  fixtureCase: 'overflow'",
    '  fixtureCopy: 1',
    "  preserveUnknown: 'keep-me'",
    '  tables:',
    "    - { tableIndex: 0, fingerprint: 'fixture-overflow-a', columns: [96, 96] }",
    "    - { tableIndex: 1, fingerprint: 'fixture-overflow-b', columns: [96, 96] }",
    '  tableStyles:',
    "    - { tableIndex: 1, fingerprint: 'fixture-overflow-b', tableOverflow: 'truncate', fixtureSeed: 'keep-overflow' }",
    '---',
    'Before overflow.',
    '',
    '## overflow-a',
    '',
    '| overflow-a-h0 | overflow-a-h1 |',
    '| --- | --- |',
    '| FirstLineSegmentABCDEFGHIJ<br>SecondLineSegmentKLMNOPQRST | overflow-a-r1c1 |',
    '',
    '## overflow-b',
    '',
    '| overflow-b-h0 | overflow-b-h1 |',
    '| --- | --- |',
    '| overflow-b-r1c0 | ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 |',
    '',
    'After overflow.',
    '',
  ].join('\n'))
})

test('[slice 08.1] title-row catalog has one exact canonical document and no variants', () => {
  const scenario = FIXTURE_SCENARIOS['title-row']
  const template = scenario.documents[0]
  assert.deepEqual(scenario.variants, [])
  assert.equal(scenario.documents.length, 1)
  assert.equal(template.filename, 'Title Row.md')
  const rendered = renderFixtureDocument('title-row', template)
  assert.equal(rendered, TITLE_ROW_CANONICAL)
  assert.equal(rendered.includes('\r'), false)
  assert.equal(rendered.endsWith('\n'), true)
  assert.equal(Buffer.from(rendered).subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf])), false)
  assert.equal(renderFixtureDocument('title-row', template, 3, 8), TITLE_ROW_CANONICAL.replace(
    '  fixtureCopy: 1\n',
    '  fixtureCopy: 3\n',
  ))
})

test('[slice 09.1] borders catalog emits the exact canonical and copy byte oracles', async () => {
  const scenario = FIXTURE_SCENARIOS.borders
  const template = scenario.documents[0]
  assert.deepEqual(scenario.variants, [])
  assert.equal(scenario.documents.length, 1)
  assert.equal(template.fixtureCase, 'borders')
  assert.equal(template.filename, 'Borders.md')
  assert.equal(template.workspace, 'a')
  assert.equal(renderFixtureDocument('borders', template), BORDERS_CANONICAL)
  assert.equal(BORDERS_CANONICAL.includes('\r'), false)
  assert.equal(BORDERS_CANONICAL.endsWith('\n'), true)
  assert.equal(
    Buffer.from(BORDERS_CANONICAL).subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf])),
    false,
  )
  assert.equal((BORDERS_CANONICAL.match(/^## border-/gm) ?? []).length, 12)
  assert.equal((BORDERS_CANONICAL.match(/^\| --- \| --- \|$/gm) ?? []).length, 11)
  assert.equal((BORDERS_CANONICAL.match(/^ {2}tableStyles:$/gm) ?? []).length, 1)

  for (let copy = 1; copy <= 3; copy += 1) {
    const suffix = String(copy).padStart(2, '0')
    const rendered = renderFixtureDocument('borders', template, copy, 3)
    assert.match(rendered, new RegExp(`^---\\nname: 'Borders--copy-${suffix}'\\n`))
    assert.match(rendered, new RegExp(`\\n  fixtureCopy: ${copy}\\n`))
    assert.equal(rendered.includes("name: 'Borders'\n"), false)
    assert.equal(rendered.includes('\r'), false)
    assert.equal(rendered.endsWith('\n'), true)
  }

  const fixture = await createOfficeFixture({ scenario: 'borders', copies: 3 })
  try {
    assert.deepEqual(fixture.scenarioFiles.map(({ filename, fileId }) => ({ filename, fileId })), [
      { filename: 'Borders--copy-01.md', fileId: 'a:Borders--copy-01.md' },
      { filename: 'Borders--copy-02.md', fileId: 'a:Borders--copy-02.md' },
      { filename: 'Borders--copy-03.md', fileId: 'a:Borders--copy-03.md' },
    ])
    for (const [index, file] of fixture.scenarioFiles.entries()) {
      assert.equal(
        fs.readFileSync(file.path, 'utf8'),
        renderFixtureDocument('borders', template, index + 1, 3),
      )
    }
  } finally {
    await destroyOfficeFixture(fixture)
  }
})

test('[slice 10.1] alignment and full catalogs emit exact deterministic manifests', async () => {
  const alignment = FIXTURE_SCENARIOS.alignment
  const alignmentTemplate = alignment.documents[0]
  assert.deepEqual(alignment.variants, [])
  assert.equal(alignment.documents.length, 1)
  assert.equal(alignmentTemplate.fixtureCase, 'alignment')
  assert.equal(alignmentTemplate.filename, 'Alignment.md')
  assert.equal(alignmentTemplate.workspace, 'a')
  assert.equal(renderFixtureDocument('alignment', alignmentTemplate), ALIGNMENT_CANONICAL)
  assert.equal(ALIGNMENT_CANONICAL.includes('\r'), false)
  assert.equal(ALIGNMENT_CANONICAL.endsWith('\n'), true)
  assert.equal(
    Buffer.from(ALIGNMENT_CANONICAL).subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf])),
    false,
  )
  assert.equal((ALIGNMENT_CANONICAL.match(/^## align-/gm) ?? []).length, 6)
  assert.equal((ALIGNMENT_CANONICAL.match(/^\| --- \| --- \|$/gm) ?? []).length, 6)

  const alignmentFixture = await createOfficeFixture({ scenario: 'alignment', copies: 3 })
  try {
    assert.deepEqual(
      alignmentFixture.scenarioFiles.map(({ filename, fileId }) => ({ filename, fileId })),
      [1, 2, 3].map((copy) => {
        const suffix = String(copy).padStart(2, '0')
        return {
          filename: `Alignment--copy-${suffix}.md`,
          fileId: `a:Alignment--copy-${suffix}.md`,
        }
      }),
    )
    for (const [index, file] of alignmentFixture.scenarioFiles.entries()) {
      assert.equal(
        fs.readFileSync(file.path, 'utf8'),
        renderFixtureDocument('alignment', alignmentTemplate, index + 1, 3),
      )
    }
  } finally {
    await destroyOfficeFixture(alignmentFixture)
  }

  const rootsBeforeRejections = officeTemporaryRoots()
  await assert.rejects(
    createOfficeFixture({ scenario: 'full', workspaces: 1 }),
    /requires --workspaces=3/,
  )
  await assert.rejects(
    createOfficeFixture({ scenario: 'full', workspaces: 2 }),
    /requires --workspaces=3/,
  )
  await assert.rejects(
    createOfficeFixture({ scenario: 'full', workspaces: 3, variant: 'local-selected' }),
    /Unknown Office fixture full variant/,
  )
  assert.deepEqual(officeTemporaryRoots(), rootsBeforeRejections)
  assert.deepEqual(parseIsolatedElectronArguments([
    '--scenario=full',
    '--workspaces=3',
    '--copies=8',
    '--manual=1',
  ]), {
    workspaces: 3,
    relaunches: 1,
    copies: 8,
    scenario: 'full',
    manual: true,
  })
  assert.throws(() => parseIsolatedElectronArguments([
    '--scenario=full',
    '--workspaces=2',
  ]), /requires --workspaces=3/)
  assert.throws(() => parseIsolatedElectronArguments([
    '--scenario=full',
    '--workspaces=3',
    '--variant=local-selected',
  ]), /Unknown Office fixture full variant/)

  const full = FIXTURE_SCENARIOS.full
  assert.deepEqual(full.variants, [])
  assert.equal(full.requiredWorkspaces, 3)
  assert.equal(full.paletteVariant, 'local-selected')
  assert.equal(full.documents.length, 18)
  assert.deepEqual(full.documents.map(({ workspace, filename, sourceScenario }) => ({
    workspace,
    filename,
    sourceScenario,
  })), [
    ['a', 'Structure-R2-C1.md', 'structure'],
    ['a', 'Structure-R3-C2.md', 'structure'],
    ['a', 'Structure-R5-C4.md', 'structure'],
    ['a', 'Color Integrity.md', 'color-integrity'],
    ['a', 'Geometry-One.md', 'geometry'],
    ['a', 'Geometry-Three.md', 'geometry'],
    ['a', 'Geometry-Four.md', 'geometry'],
    ['a', 'Geometry-Long-Minimum.md', 'geometry'],
    ['a', 'Geometry-Keyless.md', 'geometry'],
    ['a', 'Table Lifecycle.md', 'table-lifecycle'],
    ['a', 'Overflow.md', 'overflow'],
    ['a', 'Title Row.md', 'title-row'],
    ['a', 'Borders.md', 'borders'],
    ['a', 'Alignment.md', 'alignment'],
    ['a', 'Presentation Output.md', 'presentation-output'],
    ['a', 'Palette-A.md', 'palette'],
    ['b', 'Palette-B.md', 'palette'],
    ['c', 'Palette-C.md', 'palette'],
  ].map(([workspace, filename, sourceScenario]) => ({ workspace, filename, sourceScenario })))

  const defaultFullFixture = await createOfficeFixture({ scenario: 'full', workspaces: 3 })
  try {
    assert.deepEqual(
      defaultFullFixture.scenarioFiles.map(({ filename, fileId }) => ({ filename, fileId })),
      full.documents.map(({ filename, workspace }) => ({
        filename,
        fileId: `${workspace}:${filename}`,
      })),
    )
    for (const [index, file] of defaultFullFixture.scenarioFiles.entries()) {
      assert.equal(fs.readFileSync(file.path, 'utf8'), renderFixtureDocument(
        'full',
        full.documents[index],
      ))
    }
  } finally {
    await destroyOfficeFixture(defaultFullFixture)
  }

  const fullFixture = await createOfficeFixture({ scenario: 'full', workspaces: 3, copies: 2 })
  try {
    assert.equal(fullFixture.lastActiveWorkspaceId, 'office-e2e-a')
    assert.equal(fullFixture.scenarioFiles.length, 36)
    assert.deepEqual(fullFixture.scenarioFiles.map(({ workspaceId }) => workspaceId), [
      ...Array(32).fill('office-e2e-a'),
      ...Array(2).fill('office-e2e-b'),
      ...Array(2).fill('office-e2e-c'),
    ])
    for (let templateIndex = 0; templateIndex < full.documents.length; templateIndex += 1) {
      const template = full.documents[templateIndex]
      const renderedCopies = []
      for (let copy = 1; copy <= 2; copy += 1) {
        const file = fullFixture.scenarioFiles[templateIndex * 2 + copy - 1]
        assert.equal(file.filename, copyFilename(template.filename, copy, 2))
        assert.equal(file.fileId, `${template.workspace}:${file.filename}`)
        assert.equal(
          fs.readFileSync(file.path, 'utf8'),
          renderFixtureDocument('full', template, copy, 2),
        )
        renderedCopies.push(fs.readFileSync(file.path, 'utf8'))
      }
      assert.equal(
        renderedCopies[1]
          .replace(`name: '${template.filename.slice(0, -3)}--copy-02'`, `name: '${template.filename.slice(0, -3)}--copy-01'`)
          .replace('  fixtureCopy: 2\n', '  fixtureCopy: 1\n'),
        renderedCopies[0],
      )
    }
    const paletteSeed = PALETTE_SELECTOR_SEEDS['local-selected']
    for (const suffix of ['a', 'b', 'c']) {
      assert.equal(
        fs.readFileSync(localPalettePath(fullFixture.workspaceRoots[suffix], OFFICE_E2E_MACHINE), 'utf8'),
        paletteSeed.local[suffix],
      )
    }
    assert.equal(fs.readFileSync(globalPalettePath(fullFixture.appUserData), 'utf8'), paletteSeed.global)
  } finally {
    await destroyOfficeFixture(fullFixture)
  }
})

test('[slice 11.1] presentation-output catalog emits the exact 50-table matrix and isolated copies', async () => {
  const scenario = FIXTURE_SCENARIOS['presentation-output']
  const template = scenario.documents[0]
  assert.deepEqual(scenario.variants, [])
  assert.equal(template.fixtureCase, 'matrix')
  assert.equal(template.filename, 'Presentation Output.md')
  assert.equal(template.workspace, 'a')
  assert.equal(renderFixtureDocument('presentation-output', template), PRESENTATION_OUTPUT_CANONICAL)
  assert.equal(PRESENTATION_OUTPUT_CANONICAL.includes('\r'), false)
  assert.equal(PRESENTATION_OUTPUT_CANONICAL.endsWith('\n'), true)
  assert.equal((PRESENTATION_OUTPUT_CANONICAL.match(/^## po-/gm) ?? []).length, 50)
  assert.equal((PRESENTATION_OUTPUT_CANONICAL.match(/^\x20{4}- \{ tableIndex:/gm) ?? []).length, 98)
  assert.equal(PRESENTATION_OUTPUT_CANONICAL.match(/KEEP ME/g)?.length, 1)
  assert.match(PRESENTATION_OUTPUT_CANONICAL, /\n## po-default-keyless\n/)
  assert.match(PRESENTATION_OUTPUT_CANONICAL, /\n## po-stale-title\n/)

  const fixture = await createOfficeFixture({ scenario: 'presentation-output', copies: 2 })
  try {
    assert.deepEqual(
      fixture.scenarioFiles.map(({ filename, fileId }) => ({ filename, fileId })),
      [
        { filename: 'Presentation Output--copy-01.md', fileId: 'a:Presentation Output--copy-01.md' },
        { filename: 'Presentation Output--copy-02.md', fileId: 'a:Presentation Output--copy-02.md' },
      ],
    )
    for (const [index, file] of fixture.scenarioFiles.entries()) {
      assert.equal(
        fs.readFileSync(file.path, 'utf8'),
        renderFixtureDocument('presentation-output', template, index + 1, 2),
      )
    }
  } finally {
    await destroyOfficeFixture(fixture)
  }
})

test('[slice 00.1] path safety fails closed for the live ai tree and normal server data', () => {
  const liveAi = path.join(repositoryRoot, 'ai', 'Office-E2E')
  const normalData = path.join(repositoryRoot, 'fusion-studio-server', 'data', 'office-e2e')
  assert.throws(() => assertOfficeFixturePathSafe(liveAi), /protected root/)
  assert.throws(() => assertOfficeFixturePathSafe(normalData), /protected root/)

  const symlinkRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-office-e2e-safety-'))
  try {
    const liveAiLink = path.join(symlinkRoot, 'live-ai')
    const normalDataLink = path.join(symlinkRoot, 'normal-data')
    fs.symlinkSync(path.join(repositoryRoot, 'ai'), liveAiLink)
    fs.symlinkSync(path.join(repositoryRoot, 'fusion-studio-server', 'data'), normalDataLink)
    assert.throws(() => assertOfficeFixturePathSafe(path.join(liveAiLink, 'Office-E2E')), /protected root/)
    assert.throws(() => assertOfficeFixturePathSafe(path.join(normalDataLink, 'office-e2e')), /protected root/)
  } finally {
    fs.rmSync(symlinkRoot, { recursive: true, force: true })
  }
})

test('[slice 00.1] isolated database creation leaves the normal fusion database byte-identical', async () => {
  const normalDbPath = path.join(repositoryRoot, 'fusion-studio-server', 'data', 'fusion.db')
  const before = fs.existsSync(normalDbPath) ? fileIdentity(normalDbPath) : null
  const fixture = await createOfficeFixture({ workspaces: 3 })
  try {
    assert.notEqual(path.resolve(fixture.dbPath), path.resolve(normalDbPath))
    assert.equal(fs.readFileSync(fixture.dbPath).subarray(0, 16).toString('utf8'), 'SQLite format 3\u0000')
  } finally {
    await destroyOfficeFixture(fixture)
  }
  assert.equal(fs.existsSync(normalDbPath), before !== null)
  if (before) assert.equal(fileIdentity(normalDbPath), before)
})

test('[slice 00.1] every exposed filesystem target resolves outside both protected live roots', async () => {
  const fixture = await createOfficeFixture({ workspaces: 3, scenario: 'palette' })
  try {
    const liveAi = path.join(repositoryRoot, 'ai')
    const normalData = path.join(repositoryRoot, 'fusion-studio-server', 'data')
    const exposedPaths = [
      fixture.root,
      fixture.appUserData,
      fixture.dbPath,
      ...Object.values(fixture.workspaceRoots),
      ...fixture.scenarioFiles.map((entry) => entry.path),
      ...fixture.scenarioPaletteFiles.map((entry) => entry.path),
    ]
    for (const target of exposedPaths) {
      assert.equal(assertOfficeFixturePathSafe(target), canonicalPath(target))
      const fixtureRelative = path.relative(canonicalPath(fixture.root), canonicalPath(target))
      assert.ok(fixtureRelative === '' || (!fixtureRelative.startsWith('..') && !path.isAbsolute(fixtureRelative)))
      assertOutside(target, liveAi)
      assertOutside(target, normalData)
    }
  } finally {
    await destroyOfficeFixture(fixture)
  }
})

test('[slice 00.2] [slice 05S.3] launcher parser accepts exact options and rejects invalid input before fixture allocation', () => {
  const rootsBefore = officeTemporaryRoots()
  assert.deepEqual(parseIsolatedElectronArguments([]), {
    workspaces: 1,
    relaunches: 1,
    copies: 1,
    scenario: 'basic',
  })
  assert.deepEqual(parseIsolatedElectronArguments([
    '--workspaces=3',
    '--relaunches=2',
    '--copies=32',
    '--scenario=palette',
    '--variant=machine-move',
    '--manual=1',
  ]), {
    workspaces: 3,
    relaunches: 2,
    copies: 32,
    scenario: 'palette',
    variant: 'machine-move',
    manual: true,
  })
  for (const args of [
    ['--unknown=value'],
    ['--copies=1', '--copies=2'],
    ['--copies'],
    ['--copies=01'],
    ['--copies=0'],
    ['--copies=33'],
    ['--workspaces=4'],
    ['--relaunches=0'],
    ['--scenario=unknown'],
    ['--scenario=basic', '--variant=valid'],
    ['--scenario=palette', '--workspaces=3', '--variant=unknown'],
    ['--scenario=palette', '--workspaces=3', '--variant=machine-move', '--relaunches=1'],
    ['--manual=true'],
  ]) {
    assert.throws(() => parseIsolatedElectronArguments(args))
  }
  const invalidSubprocess = spawnSync(process.execPath, [launcherPath, '--unknown=value'], {
    encoding: 'utf8',
  })
  assert.equal(invalidSubprocess.status, 1)
  assert.match(invalidSubprocess.stderr, /Unknown Office Electron option/)
  assert.deepEqual(officeTemporaryRoots(), rootsBefore)
})

test('[slice 00.2] [slice 05S.3] launcher runtime keeps packaged server modules and every mutable path fixture-owned', async (t) => {
  const rootsBefore = officeTemporaryRoots()
  const liveServerRoot = path.join(repositoryRoot, 'fusion-studio-server')
  const liveClientModulesTmp = path.join(repositoryRoot, 'fusion-studio-client', 'node_modules', '.tmp')
  const clientModulesTmpBefore = fs.existsSync(liveClientModulesTmp)
    ? fileTreeHashes(liveClientModulesTmp)
    : null
  const protectedNonDatabasePaths = [
    path.join(liveServerRoot, 'wire-debug.log'),
    path.join(liveServerRoot, 'server-live.log'),
    path.join(liveServerRoot, 'data', 'background-services.log'),
    path.join(liveServerRoot, 'data', 'config.json'),
  ]
  const before = protectedNonDatabasePaths.map(
    (candidate) => fs.existsSync(candidate) ? fileIdentity(candidate) : null,
  )
  const lifecycle = await createOfficeProcessLifecycle()
  t.after(() => finalizeOfficeProcessLifecycle(lifecycle))
  const root = lifecycle.fixture.root
  const launchContext = createIsolatedElectronLaunchContext(lifecycle)
  const { runtime } = launchContext
  const wireModule = path.join(runtime.runtimeServerRoot, 'lib', 'wire', 'wire-log.js')
  const backgroundLogModule = path.join(runtime.runtimeServerRoot, 'lib', 'background-services', 'log.js')
  const backgroundConfigModule = path.join(runtime.runtimeServerRoot, 'lib', 'background-services', 'config.js')
  const dbModule = path.join(runtime.runtimeServerRoot, 'lib', 'db.js')
  const probeScript = [
    "const fs = require('node:fs')",
    "const path = require('node:path')",
    'const readFileSync = fs.readFileSync',
    'let configPath = null',
    "fs.readFileSync = function(candidate, ...args) { if (path.basename(candidate) === 'config.json') configPath = path.resolve(candidate); return readFileSync.call(this, candidate, ...args) }",
    'const wire = require(process.argv[1])',
    'const backgroundLog = require(process.argv[2])',
    'const backgroundConfig = require(process.argv[3])',
    'const db = require(process.argv[4])',
    "backgroundConfig.isEnabled('calendar.apple')",
    "wire.logWire('fixture', 'isolated')",
    "backgroundLog.logFailure('fixture', new Error('isolated'))",
    "console.log(JSON.stringify({ wireLog: wire.WIRE_LOG_FILE, backgroundLog: backgroundLog.LOG_PATH, configPath, dbPath: db.DB_PATH, serverLive: path.join(process.argv[5], 'server-live.log'), wireModule: require.resolve(process.argv[1]), backgroundModule: require.resolve(process.argv[2]) }))",
  ].join(';')
  const probeEnvironment = { ...launchContext.env }
  delete probeEnvironment.FUSION_CALENDAR_APPLE_ENABLED
  delete probeEnvironment.FUSION_CALENDAR_GOOGLE_ENABLED
  const probe = spawnSync(process.execPath, [
    '-e',
    probeScript,
    wireModule,
    backgroundLogModule,
    backgroundConfigModule,
    dbModule,
    runtime.runtimeServerRoot,
  ], {
    encoding: 'utf8',
    env: probeEnvironment,
  })
  assert.equal(probe.status, 0, probe.stderr)
  const resolved = JSON.parse(probe.stdout.trim())
  for (const candidate of Object.values(resolved)) {
    const relative = path.relative(root, path.resolve(candidate))
    assert.ok(relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative)), candidate)
  }
  assert.equal(path.resolve(launchContext.cwd), path.resolve(runtime.runtimeClientRoot))
  assert.deepEqual(OFFICE_E2E_ELECTRON_LAUNCH, {
    command: 'npm',
    args: ['run', 'electron:dev'],
  })
  assert.equal(launchContext.env.FUSION_CALENDAR_APPLE_ENABLED, '0')
  assert.equal(launchContext.env.FUSION_CALENDAR_GOOGLE_ENABLED, '0')
  assert.match(launchContext.env.NODE_OPTIONS, /dependency-write-guard\.cjs/)
  assert.deepEqual(JSON.parse(launchContext.env.FUSION_OFFICE_E2E_READ_ONLY_ROOTS), [
    path.join(repositoryRoot, 'fusion-studio-client', 'electron', 'resources'),
    path.join(repositoryRoot, 'fusion-studio-client', 'node_modules'),
    path.join(repositoryRoot, 'fusion-studio-server', 'node_modules'),
  ])
  assert.equal(fs.lstatSync(path.join(runtime.runtimeServerRoot, 'lib')).isSymbolicLink(), false)
  assert.equal(fs.lstatSync(path.join(runtime.runtimeClientRoot, 'electron')).isSymbolicLink(), false)
  assert.equal(fs.lstatSync(path.join(runtime.runtimeServerRoot, 'node_modules')).isSymbolicLink(), false)
  assert.equal(fs.lstatSync(path.join(runtime.runtimeClientRoot, 'node_modules')).isSymbolicLink(), false)
  assert.equal(fs.lstatSync(path.join(runtime.runtimeClientRoot, 'electron', 'resources')).isSymbolicLink(), false)
  assertTreeSymlinksStayWithin(path.join(runtime.runtimeServerRoot, 'node_modules'))
  assertTreeSymlinksStayWithin(path.join(runtime.runtimeClientRoot, 'node_modules'))
  assertTreeSymlinksStayWithin(path.join(runtime.runtimeClientRoot, 'electron', 'resources'))
  assert.deepEqual(
    fileTreeHashes(path.join(runtime.runtimeServerRoot, 'lib')),
    fileTreeHashes(path.join(repositoryRoot, 'fusion-studio-server', 'lib')),
  )
  assert.deepEqual(
    fileTreeHashes(path.join(runtime.runtimeClientRoot, 'src')),
    fileTreeHashes(path.join(repositoryRoot, 'fusion-studio-client', 'src')),
  )
  assert.deepEqual(
    fs.readFileSync(path.join(runtime.runtimeClientRoot, 'node_modules', 'react', 'index.js')),
    fs.readFileSync(path.join(repositoryRoot, 'fusion-studio-client', 'node_modules', 'react', 'index.js')),
  )
  assert.deepEqual(
    fs.readFileSync(path.join(runtime.runtimeServerRoot, 'node_modules', 'express', 'index.js')),
    fs.readFileSync(path.join(repositoryRoot, 'fusion-studio-server', 'node_modules', 'express', 'index.js')),
  )
  const packagedWhisperModel = path.join(
    runtime.runtimeServerRoot,
    'node_modules',
    'nodejs-whisper',
    'cpp',
    'whisper.cpp',
    'models',
    'ggml-large-v3-turbo.bin',
  )
  assert.equal(fs.existsSync(packagedWhisperModel), false)
  assert.equal(
    fs.existsSync(path.join(runtime.runtimeServerRoot, 'node_modules', 'nodejs-whisper', 'dist', 'index.js')),
    true,
  )
  assert.equal(
    fs.lstatSync(path.join(runtime.runtimeServerRoot, 'node_modules', 'nodejs-whisper')).isSymbolicLink(),
    false,
  )
  assert.deepEqual(
    fs.readFileSync(path.join(runtime.runtimeClientRoot, 'electron', 'resources', 'models', 'gwen-0-8b', '.model-id')),
    fs.readFileSync(path.join(repositoryRoot, 'fusion-studio-client', 'electron', 'resources', 'models', 'gwen-0-8b', '.model-id')),
  )
  assert.deepEqual(
    fs.readFileSync(path.join(runtime.runtimeClientRoot, 'package.json')),
    fs.readFileSync(path.join(repositoryRoot, 'fusion-studio-client', 'package.json')),
  )
  assert.deepEqual(
    fs.readFileSync(runtime.serverEntry),
    fs.readFileSync(path.join(repositoryRoot, 'fusion-studio-server', 'server.js')),
  )
  assert.equal(
    path.resolve(runtime.runtimeClientRoot, 'electron', '..', '..', 'fusion-studio-server', 'server.js'),
    runtime.serverEntry,
  )
  const runtimeModulesTmp = path.join(runtime.runtimeClientRoot, 'node_modules', '.tmp')
  const staleBuildInfo = path.join(runtimeModulesTmp, 'tsconfig.app.tsbuildinfo')
  const missingBuildInfo = path.join(runtimeModulesTmp, 'tsconfig.node.tsbuildinfo')
  fs.writeFileSync(staleBuildInfo, 'stale-build-info\n')
  fs.rmSync(missingBuildInfo, { force: true })
  const runtimeBuild = startOfficeOwnedProcess(lifecycle, 'npm', ['run', 'build'], {
    cwd: launchContext.cwd,
    env: launchContext.env,
    stdio: 'ignore',
  })
  assert.deepEqual(await runtimeBuild.completion, { code: 0, signal: null })
  assert.equal(fs.existsSync(path.join(runtime.runtimeClientRoot, 'dist', 'index.html')), true)
  assert.notEqual(fs.readFileSync(staleBuildInfo, 'utf8'), 'stale-build-info\n')
  assert.equal(fs.existsSync(missingBuildInfo), true)
  assert.equal(fs.existsSync(liveClientModulesTmp), clientModulesTmpBefore !== null)
  if (clientModulesTmpBefore) assert.deepEqual(fileTreeHashes(liveClientModulesTmp), clientModulesTmpBefore)

  const presentationLaunch = createPresentationOutputLaunchContext(lifecycle, launchContext)
  assert.equal(path.dirname(presentationLaunch.outputDirectory), path.join(root, 'artifacts'))
  assert.equal(fs.lstatSync(presentationLaunch.outputDirectory).isSymbolicLink(), false)
  assert.equal(
    presentationLaunch.productionMain,
    path.join(runtime.runtimeClientRoot, 'electron', 'main.cjs'),
  )
  const installedElectronExecutable = createRequire(
    path.join(runtime.runtimeClientRoot, 'package.json'),
  )('electron')
  assert.notEqual(presentationLaunch.electronExecutable, installedElectronExecutable)
  assert.equal(path.relative(root, presentationLaunch.appPath).startsWith('..'), false)
  assert.match(
    presentationLaunch.bundleIdentifier,
    /^studio\.fusion\.e2e\.presentation-output\.[0-9a-f]{12}$/,
  )
  assert.equal(presentationLaunch.sourceBundleIdentifier, 'com.github.Electron')
  assert.equal(presentationLaunch.appName, 'Fusion Studio E2E — Presentation Output')
  assert.equal(presentationLaunch.windowTitle, presentationLaunch.appName)
  const identityPlist = path.join(presentationLaunch.appPath, 'Contents', 'Info.plist')
  const materializedIdentifier = spawnSync('/usr/bin/plutil', [
    '-extract',
    'CFBundleIdentifier',
    'raw',
    '-o',
    '-',
    identityPlist,
  ], { encoding: 'utf8' })
  assert.equal(materializedIdentifier.status, 0, materializedIdentifier.stderr)
  assert.equal(materializedIdentifier.stdout.trim(), presentationLaunch.bundleIdentifier)
  const signature = spawnSync('/usr/bin/codesign', [
    '--verify',
    '--deep',
    '--strict',
    presentationLaunch.appPath,
  ], { encoding: 'utf8' })
  assert.equal(signature.status, 0, signature.stderr)
  assert.doesNotMatch(
    formatPresentationOutputManualReady({
      identity: presentationLaunch,
      relaunch: 1,
      scenario: 'presentation-output',
      totalRelaunches: 1,
    }),
    /undefined/,
  )
  const wrapperSource = fs.readFileSync(presentationLaunch.wrapperPath, 'utf8')
  for (const requiredSource of [
    'session-created',
    'will-download',
    'setSavePath',
    'applyPresentationOutputAppIdentity',
    'require(productionMain)',
  ]) {
    assert.match(wrapperSource, new RegExp(requiredSource.replace(/[()]/g, '\\$&')))
  }
  const productionMainSource = fs.readFileSync(presentationLaunch.productionMain, 'utf8')
  assert.match(productionMainSource, /app\.setName\('Fusion Studio'\)/)
  assert.doesNotMatch(productionMainSource, /presentation-output-app-identity/)
  const pdfName = 'Presentation Output--copy-01.pdf'
  const docxName = 'Presentation Output--copy-01.docx'
  const pdfBytes = Buffer.from('%PDF-fixture\n')
  const docxBytes = Buffer.from(zipSync({
    '[Content_Types].xml': Buffer.from('<Types/>'),
    'word/document.xml': Buffer.from('<w:document/>'),
  }))
  fs.writeFileSync(path.join(presentationLaunch.outputDirectory, pdfName), pdfBytes)
  fs.writeFileSync(path.join(presentationLaunch.outputDirectory, docxName), docxBytes)
  fs.writeFileSync(presentationLaunch.ledgerPath, `${JSON.stringify({
    downloads: [
      { filename: pdfName, state: 'completed', bytes: pdfBytes.length },
      { filename: docxName, state: 'completed', bytes: docxBytes.length },
    ],
    errors: [],
  })}\n`)
  assert.deepEqual(
    (await inspectPresentationOutputDownloads(
      presentationLaunch.outputDirectory,
      presentationLaunch.ledgerPath,
    )).map(({ filename, parsed }) => ({ filename, parsed })),
    [
      { filename: docxName, parsed: true },
      { filename: pdfName, parsed: true },
    ],
  )

  const liveWhisperRoot = path.join(liveServerRoot, 'node_modules', 'nodejs-whisper')
  const forbiddenDependencyWrite = path.join(liveWhisperRoot, 'office-e2e-write-probe')
  const dependencyWriteProbe = spawnSync(process.execPath, [
    '-e',
    "require('node:fs').writeFileSync(process.argv[1], 'blocked')",
    forbiddenDependencyWrite,
  ], { encoding: 'utf8', env: launchContext.env })
  assert.notEqual(dependencyWriteProbe.status, 0)
  assert.match(dependencyWriteProbe.stderr, /OFFICE_E2E_DEPENDENCY_WRITE|blocked fs\.writeFileSync/)
  assert.equal(fs.existsSync(forbiddenDependencyWrite), false)
  const liveCloneProbeTargets = [
    path.join(repositoryRoot, 'fusion-studio-client', 'node_modules', 'react', 'office-e2e-shell-script-probe'),
    path.join(repositoryRoot, 'fusion-studio-server', 'node_modules', 'express', 'office-e2e-sequential-cd-probe'),
    path.join(repositoryRoot, 'fusion-studio-client', 'electron', 'resources', 'office-e2e-resource-probe'),
  ]
  const runtimeCloneProbeTargets = [
    path.join(runtime.runtimeClientRoot, 'node_modules', 'react', 'office-e2e-shell-script-probe'),
    path.join(runtime.runtimeServerRoot, 'node_modules', 'express', 'office-e2e-sequential-cd-probe'),
    path.join(runtime.runtimeClientRoot, 'electron', 'resources', 'office-e2e-resource-probe'),
  ]
  assert.equal(liveCloneProbeTargets.some((candidate) => fs.existsSync(candidate)), false)
  const externalShellScript = path.join(root, 'external-clone-write-probe.sh')
  fs.writeFileSync(externalShellScript, [
    '#!/bin/sh',
    'touch "$OFFICE_RUNTIME_CLIENT/node_modules/react/office-e2e-shell-script-probe"',
    'cd "$OFFICE_RUNTIME_SERVER"',
    'cd node_modules',
    'cd express',
    'touch office-e2e-sequential-cd-probe',
    'touch "$OFFICE_RUNTIME_CLIENT/electron/resources/office-e2e-resource-probe"',
    '',
  ].join('\n'))
  const externalShellProbe = spawnSync('/bin/sh', [externalShellScript], {
    encoding: 'utf8',
    env: {
      ...launchContext.env,
      OFFICE_RUNTIME_CLIENT: runtime.runtimeClientRoot,
      OFFICE_RUNTIME_SERVER: runtime.runtimeServerRoot,
    },
  })
  assert.equal(externalShellProbe.status, 0, externalShellProbe.stderr)
  assert.equal(runtimeCloneProbeTargets.every((candidate) => fs.existsSync(candidate)), true)
  assert.equal(liveCloneProbeTargets.some((candidate) => fs.existsSync(candidate)), false)
  protectedNonDatabasePaths.forEach((candidate, index) => {
    assert.equal(fs.existsSync(candidate), before[index] !== null)
    if (before[index]) assert.equal(fileIdentity(candidate), before[index])
  })

  const readinessPort = await unusedLoopbackPort()
  const readinessScript = [
    "const http = require('node:http')",
    `const server = http.createServer((_request, response) => response.end('ready'))`,
    `server.listen(${readinessPort}, '127.0.0.1', () => console.log('READY'))`,
    "process.on('SIGTERM', () => server.close(() => process.exit(0)))",
  ].join(';')
  const server = startOfficeOwnedProcess(
    lifecycle,
    process.execPath,
    ['-e', readinessScript],
    {
      forwardOutput: false,
      readyPattern: /READY(?:\s|$)/,
      readyUrl: `http://127.0.0.1:${readinessPort}/`,
    },
  )
  await server.ready
  assert.equal(isProcessAlive(server.child.pid), true)
  await finalizeOfficeProcessLifecycle(lifecycle)
  assert.equal(isProcessAlive(server.child.pid), false)
  assert.equal(fs.existsSync(root), false)
  assert.deepEqual(officeTemporaryRoots(), rootsBefore)
  protectedNonDatabasePaths.forEach((candidate, index) => {
    assert.equal(fs.existsSync(candidate), before[index] !== null)
    if (before[index]) assert.equal(fileIdentity(candidate), before[index])
  })
})

test('[slice 05S.3] owned process cleanup signals descendants after their group leader exits', async (t) => {
  const lifecycle = await createOfficeProcessLifecycle()
  t.after(() => finalizeOfficeProcessLifecycle(lifecycle))
  const descendantPidPath = path.join(lifecycle.fixture.root, 'descendant.pid')
  const descendantScript = 'setInterval(() => {}, 1000)'
  const leaderScript = [
    "const fs = require('node:fs')",
    "const { spawn } = require('node:child_process')",
    `const descendant = spawn(process.execPath, ['-e', ${JSON.stringify(descendantScript)}], { stdio: 'ignore' })`,
    'descendant.unref()',
    `fs.writeFileSync(${JSON.stringify(descendantPidPath)}, String(descendant.pid))`,
  ].join(';')
  const leader = startOfficeOwnedProcess(lifecycle, process.execPath, ['-e', leaderScript], { stdio: 'ignore' })
  assert.deepEqual(await leader.completion, { code: 0, signal: null })
  const descendantPid = Number(fs.readFileSync(descendantPidPath, 'utf8'))
  assert.ok(Number.isInteger(descendantPid) && descendantPid > 0)
  assert.equal(isProcessAlive(descendantPid), true)

  await stopOfficeOwnedProcesses(lifecycle)

  assert.equal(isProcessAlive(descendantPid), false)
})

test('[spec 11 owner smoke] child and isolated log tails emit before failure cleanup', async () => {
  const lifecycle = await createOfficeProcessLifecycle({
    scenario: 'presentation-output',
    workspaces: 1,
    copies: 4,
  })
  const root = lifecycle.fixture.root
  const temporaryDirectory = path.join(root, 'tmp')
  fs.mkdirSync(temporaryDirectory)
  fs.writeFileSync(
    path.join(temporaryDirectory, 'fusion-electron.log'),
    `${'m'.repeat(OFFICE_E2E_DIAGNOSTIC_TAIL_BYTES + 9)}MAIN_FAILURE\n`,
  )
  fs.writeFileSync(
    path.join(temporaryDirectory, 'electron-renderer.log'),
    'RENDERER_FAILURE\n',
  )

  try {
    const script = [
      `process.stdout.write('o'.repeat(${OFFICE_E2E_DIAGNOSTIC_TAIL_BYTES + 17}) + 'STDOUT_FAILURE\\n')`,
      `process.stderr.write('e'.repeat(${OFFICE_E2E_DIAGNOSTIC_TAIL_BYTES + 23}) + 'STDERR_FAILURE\\n')`,
      'setTimeout(() => process.exit(7), 100)',
    ].join(';')
    const child = startOfficeOwnedProcess(lifecycle, process.execPath, ['-e', script], {
      captureOutput: true,
      forwardOutput: false,
    })
    const result = await child.completion
    assert.deepEqual(result, { code: 7, signal: null })
    const output = child.readOutput()
    assert.equal(output.stdoutTruncated, true)
    assert.equal(output.stderrTruncated, true)
    assert.ok(Buffer.byteLength(output.stdout) <= OFFICE_E2E_DIAGNOSTIC_TAIL_BYTES)
    assert.ok(Buffer.byteLength(output.stderr) <= OFFICE_E2E_DIAGNOSTIC_TAIL_BYTES)

    let durableReport = ''
    emitPresentationOutputFailureDiagnostics({
      identity: {
        appName: 'Fusion Studio E2E — Presentation Output',
        bundleIdentifier: 'studio.fusion.e2e.presentation-output.0123456789ab',
        windowTitle: 'Fusion Studio E2E — Presentation Output',
      },
      processRecord: child,
      result,
      temporaryDirectory,
      write: (text) => {
        assert.equal(fs.existsSync(root), true, 'diagnostics must precede fixture cleanup')
        durableReport += text
      },
    })
    assert.match(durableReport, /OFFICE_E2E_FAILURE_DIAGNOSTICS_BEGIN=/)
    assert.match(durableReport, /STDOUT_FAILURE/)
    assert.match(durableReport, /STDERR_FAILURE/)
    assert.match(durableReport, /MAIN_FAILURE/)
    assert.match(durableReport, /RENDERER_FAILURE/)
    assert.match(durableReport, /maxBytesPerSource":65536/)
    assert.match(durableReport, /OFFICE_E2E_FAILURE_DIAGNOSTICS_END/)

    await finalizeOfficeProcessLifecycle(lifecycle, { reason: 'assertion' })
    assert.equal(fs.existsSync(root), false)
  } finally {
    if (fs.existsSync(root)) await finalizeOfficeProcessLifecycle(lifecycle, { reason: 'assertion' })
  }
})

test('[spec 11 owner smoke] a missing build command reports before async cleanup and parent exit', () => {
  const lifecycleUrl = pathToFileURL(path.join(testDirectory, 'fixture-lifecycle.mjs')).href
  const runnerUrl = pathToFileURL(path.join(testDirectory, 'run-isolated-electron.mjs')).href
  const missingCommand = `fusion-office-e2e-missing-build-${process.pid}-${Date.now()}`
  const probe = [
    "import assert from 'node:assert/strict'",
    "import fs from 'node:fs'",
    `import { createOfficeProcessLifecycle, finalizeOfficeProcessLifecycle, startOfficeOwnedProcess } from ${JSON.stringify(lifecycleUrl)}`,
    `import { emitPresentationOutputFailureDiagnostics } from ${JSON.stringify(runnerUrl)}`,
    "const unhandled = []",
    "process.on('unhandledRejection', (error) => unhandled.push(error))",
    "const lifecycle = await createOfficeProcessLifecycle({ scenario: 'presentation-output', workspaces: 1, copies: 4 })",
    "const root = lifecycle.fixture.root",
    "const temporaryDirectory = `${root}/tmp`",
    "fs.mkdirSync(temporaryDirectory)",
    `const missingCommand = ${JSON.stringify(missingCommand)}`,
    "const child = startOfficeOwnedProcess(lifecycle, missingCommand, [], { captureOutput: true, forwardOutput: false })",
    "let failure = null",
    "try { await child.completion } catch (error) { failure = error }",
    "assert.equal(failure?.code, 'ENOENT')",
    "process.stdout.write(`PRIMARY_CAUGHT=${failure.code}\\n`)",
    "emitPresentationOutputFailureDiagnostics({ failure, identity: { appName: 'Fusion Studio E2E — Presentation Output', bundleIdentifier: 'studio.fusion.e2e.presentation-output.0123456789ab', windowTitle: 'Fusion Studio E2E — Presentation Output' }, processRecord: child, temporaryDirectory, write: (text) => { assert.equal(fs.existsSync(root), true); process.stdout.write(text) } })",
    "await finalizeOfficeProcessLifecycle(lifecycle, { reason: 'setup' })",
    "assert.equal(fs.existsSync(root), false)",
    "await new Promise((resolve) => setTimeout(resolve, 75))",
    "assert.deepEqual(unhandled, [])",
    "process.stdout.write('ASYNC_BUILD_CLEANUP_COMPLETE\\n')",
    "const readinessLifecycle = await createOfficeProcessLifecycle({ scenario: 'presentation-output', workspaces: 1, copies: 4 })",
    "const readinessRoot = readinessLifecycle.fixture.root",
    "const readinessChild = startOfficeOwnedProcess(readinessLifecycle, `${missingCommand}-readiness`, [], { forwardOutput: false, readyUrl: 'http://127.0.0.1:1', readyTimeoutMs: 30_000 })",
    "let readinessFailure = null",
    "try { await readinessChild.spawned } catch (error) { readinessFailure = error }",
    "assert.equal(readinessFailure?.code, 'ENOENT')",
    "await finalizeOfficeProcessLifecycle(readinessLifecycle, { reason: 'setup' })",
    "assert.equal(fs.existsSync(readinessRoot), false)",
    "await new Promise((resolve) => setTimeout(resolve, 75))",
    "assert.deepEqual(unhandled, [])",
    "process.stdout.write('ASYNC_READINESS_CLEANUP_COMPLETE\\n')",
  ].join('\n')
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', probe], {
    cwd: path.join(repositoryRoot, 'fusion-studio-client'),
    encoding: 'utf8',
    timeout: 30_000,
  })

  assert.equal(result.signal, null, `${result.stdout}\n${result.stderr}`)
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`)
  assert.match(result.stdout, /PRIMARY_CAUGHT=ENOENT/)
  assert.match(result.stdout, new RegExp(`"message":"spawn ${missingCommand} ENOENT"`))
  assert.match(result.stdout, /"code":"ENOENT"/)
  assert.match(result.stdout, /OFFICE_E2E_FAILURE_DIAGNOSTICS_END/)
  assert.match(result.stdout, /ASYNC_BUILD_CLEANUP_COMPLETE/)
  assert.match(result.stdout, /ASYNC_READINESS_CLEANUP_COMPLETE/)
})

test('[slice 00.2] Playwright output is unique, outside the repository, and lifecycle-owned', async () => {
  const first = createOfficePlaywrightRunPaths()
  const second = createOfficePlaywrightRunPaths()
  const inherited = createOfficePlaywrightRunPaths(first.root)
  assert.notEqual(first.root, second.root)
  assert.equal(inherited.root, first.root)
  assert.equal(inherited.outputDir, first.outputDir)
  assert.equal(path.dirname(first.outputDir), first.root)
  assert.equal(path.dirname(second.outputDir), second.root)
  assert.equal(fs.existsSync(first.root), false)
  assert.equal(fs.existsSync(second.root), false)
  const repositoryRelative = path.relative(repositoryRoot, first.outputDir)
  assert.ok(repositoryRelative.startsWith('..') || path.isAbsolute(repositoryRelative))

  const lifecycle = await createOfficeProcessLifecycle({ root: first.root })
  fs.mkdirSync(first.outputDir, { recursive: true })
  fs.writeFileSync(path.join(first.outputDir, 'failure-artifact.txt'), 'fixture-owned\n')
  await finalizeOfficeProcessLifecycle(lifecycle)
  assert.equal(fs.existsSync(first.root), false)

  fs.mkdirSync(first.outputDir, { recursive: true })
  fs.writeFileSync(path.join(first.outputDir, '.last-run.json'), '{}')
  assert.equal(new OfficePlaywrightCleanupReporter({ runRoot: first.root }).onExit(), true)
  assert.equal(fs.existsSync(first.root), false)

  const beforeRetain = process.env.FUSION_OFFICE_E2E_RETAIN
  const retainedPaths = createOfficePlaywrightRunPaths()
  try {
    process.env.FUSION_OFFICE_E2E_RETAIN = '1'
    const retainedLifecycle = await createOfficeProcessLifecycle({ root: retainedPaths.root })
    await finalizeOfficeProcessLifecycle(retainedLifecycle)
    fs.mkdirSync(retainedPaths.outputDir, { recursive: true })
    fs.writeFileSync(path.join(retainedPaths.outputDir, '.last-run.json'), '{}')
    assert.equal(new OfficePlaywrightCleanupReporter({ runRoot: retainedPaths.root }).onExit(), false)
    assert.equal(fs.existsSync(retainedPaths.root), true)
  } finally {
    fs.rmSync(retainedPaths.root, { recursive: true, force: true })
    if (beforeRetain === undefined) delete process.env.FUSION_OFFICE_E2E_RETAIN
    else process.env.FUSION_OFFICE_E2E_RETAIN = beforeRetain
  }

  const setupFailurePaths = createOfficePlaywrightRunPaths()
  process.env.FUSION_OFFICE_E2E_RETAIN = '1'
  try {
    fs.mkdirSync(setupFailurePaths.outputDir, { recursive: true })
    fs.writeFileSync(path.join(setupFailurePaths.outputDir, '.last-run.json'), '{}')
    assert.equal(shouldCleanupOfficePlaywrightRunRoot(setupFailurePaths.root), true)
    assert.equal(cleanupOfficePlaywrightRunRoot(setupFailurePaths.root), true)
    assert.equal(fs.existsSync(setupFailurePaths.root), false)
  } finally {
    fs.rmSync(setupFailurePaths.root, { recursive: true, force: true })
    if (beforeRetain === undefined) delete process.env.FUSION_OFFICE_E2E_RETAIN
    else process.env.FUSION_OFFICE_E2E_RETAIN = beforeRetain
  }
})

test('[slice 07.4] failing Playwright child materializes trace then restores the exact isolated-root set', async () => {
  const probe = await runExpectedCleanupTraceFailure({ retain: false })
  await waitForTemporaryRoots(probe.rootsBefore)
  assert.equal(fs.existsSync(probe.root), false)
  assert.deepEqual(officeTemporaryRoots(), probe.rootsBefore)
})

test('[slice 07.4] exact retain opt-in preserves a failing Playwright trace until explicit cleanup', async (t) => {
  const probe = await runExpectedCleanupTraceFailure({ retain: true })
  t.after(() => cleanupOfficePlaywrightRunRoot(probe.root))
  const expectedRoots = new Set([...probe.rootsBefore, probe.rootName])
  assert.deepEqual(officeTemporaryRoots(), expectedRoots)
  assert.equal(fs.existsSync(probe.root), true)
  const lastRun = JSON.parse(fs.readFileSync(
    path.join(probe.root, 'playwright-output', '.last-run.json'),
    'utf8',
  ))
  assert.equal(lastRun.status, 'failed')
  assert.equal(lastRun.failedTests.length, 1)
  const traces = []
  const visit = (candidate) => {
    for (const entry of fs.readdirSync(candidate, { withFileTypes: true })) {
      const child = path.join(candidate, entry.name)
      if (entry.isDirectory()) visit(child)
      else if (entry.isFile() && entry.name === 'trace.zip') traces.push(child)
    }
  }
  visit(probe.root)
  assert.equal(traces.length, 1)
  assert.equal(cleanupOfficePlaywrightRunRoot(probe.root), true)
  await waitForTemporaryRoots(probe.rootsBefore)
})

test('[slice 00.2] runtime creation is idempotent and repairs partial or corrupt marked layouts', async () => {
  const lifecycle = await createOfficeProcessLifecycle()
  const root = lifecycle.fixture.root
  try {
    const partialRuntime = path.join(root, 'runtime')
    fs.mkdirSync(partialRuntime)
    fs.writeFileSync(path.join(partialRuntime, 'partial'), 'incomplete\n')
    const first = createOfficeRuntimeLayout(lifecycle.fixture)
    assert.equal(fs.existsSync(path.join(first.runtimeRoot, 'partial')), false)
    fs.rmSync(first.dependencyWriteGuard)
    fs.writeFileSync(first.serverEntry, 'corrupt runtime entry\n')
    fs.writeFileSync(path.join(first.runtimeServerRoot, 'lib', 'startup.js'), 'corrupt server lib\n')
    fs.writeFileSync(path.join(first.runtimeClientRoot, 'src', 'index.css'), 'corrupt client source\n')
    fs.writeFileSync(path.join(first.runtimeClientRoot, 'node_modules', 'react', 'index.js'), 'corrupt client dependency\n')
    fs.writeFileSync(path.join(first.runtimeServerRoot, 'node_modules', 'express', 'index.js'), 'corrupt server dependency\n')
    fs.writeFileSync(
      path.join(first.runtimeClientRoot, 'electron', 'resources', 'models', 'gwen-0-8b', '.model-id'),
      'corrupt resource\n',
    )
    const runtimePandoc = path.join(first.runtimeClientRoot, 'electron', 'resources', 'pandoc', 'darwin', 'pandoc')
    const sourcePandoc = path.join(repositoryRoot, 'fusion-studio-client', 'electron', 'resources', 'pandoc', 'darwin', 'pandoc')
    const sourcePandocMode = fs.statSync(sourcePandoc).mode & 0o7777
    fs.chmodSync(runtimePandoc, 0o644)
    fs.rmSync(path.join(first.runtimeClientRoot, 'node_modules', '.bin', 'tsc'))
    fs.rmSync(path.join(first.runtimeServerRoot, 'node_modules', '.bin', 'knex'))
    fs.symlinkSync(
      path.join(repositoryRoot, 'fusion-studio-client', 'node_modules'),
      path.join(first.runtimeClientRoot, 'node_modules', 'escape-probe'),
    )
    const second = createOfficeRuntimeLayout(lifecycle.fixture)
    assert.equal(fs.existsSync(second.dependencyWriteGuard), true)
    assert.deepEqual(
      fs.readFileSync(second.serverEntry),
      fs.readFileSync(path.join(repositoryRoot, 'fusion-studio-server', 'server.js')),
    )
    assert.deepEqual(
      fs.readFileSync(path.join(second.runtimeServerRoot, 'lib', 'startup.js')),
      fs.readFileSync(path.join(repositoryRoot, 'fusion-studio-server', 'lib', 'startup.js')),
    )
    assert.deepEqual(
      fs.readFileSync(path.join(second.runtimeClientRoot, 'src', 'index.css')),
      fs.readFileSync(path.join(repositoryRoot, 'fusion-studio-client', 'src', 'index.css')),
    )
    assert.deepEqual(
      fs.readFileSync(path.join(second.runtimeClientRoot, 'node_modules', 'react', 'index.js')),
      fs.readFileSync(path.join(repositoryRoot, 'fusion-studio-client', 'node_modules', 'react', 'index.js')),
    )
    assert.deepEqual(
      fs.readFileSync(path.join(second.runtimeServerRoot, 'node_modules', 'express', 'index.js')),
      fs.readFileSync(path.join(repositoryRoot, 'fusion-studio-server', 'node_modules', 'express', 'index.js')),
    )
    assert.deepEqual(
      fs.readFileSync(path.join(second.runtimeClientRoot, 'electron', 'resources', 'models', 'gwen-0-8b', '.model-id')),
      fs.readFileSync(path.join(repositoryRoot, 'fusion-studio-client', 'electron', 'resources', 'models', 'gwen-0-8b', '.model-id')),
    )
    assert.equal(fs.statSync(path.join(second.runtimeClientRoot, 'electron', 'resources', 'pandoc', 'darwin', 'pandoc')).mode & 0o7777, sourcePandocMode)
    assert.equal(fs.existsSync(path.join(second.runtimeClientRoot, 'node_modules', '.bin', 'tsc')), true)
    assert.equal(fs.existsSync(path.join(second.runtimeServerRoot, 'node_modules', '.bin', 'knex')), true)
    assert.equal(fs.existsSync(path.join(second.runtimeClientRoot, 'node_modules', 'escape-probe')), false)
    assert.deepEqual(createOfficeRuntimeLayout(lifecycle.fixture), second)

    const runtimeClientPackage = path.join(second.runtimeClientRoot, 'package.json')
    const sourceClientPackage = path.join(repositoryRoot, 'fusion-studio-client', 'package.json')
    const sourceClientPackageMode = fs.statSync(sourceClientPackage).mode & 0o7777
    fs.chmodSync(runtimeClientPackage, sourceClientPackageMode ^ 0o100)
    const third = createOfficeRuntimeLayout(lifecycle.fixture)
    assert.equal(fs.statSync(path.join(third.runtimeClientRoot, 'package.json')).mode & 0o7777, sourceClientPackageMode)
    assert.equal(fs.existsSync(path.join(first.runtimeRoot, '.office-e2e-runtime-complete.json')), true)
  } finally {
    await finalizeOfficeProcessLifecycle(lifecycle)
  }
  assert.equal(fs.existsSync(root), false)
})

test('[slice 00.2] reusable Playwright reset recreates the catalog scenario on every cycle', async () => {
  const lifecycle = await createOfficeProcessLifecycle()
  const beforeRoot = process.env.FUSION_OFFICE_E2E_FIXTURE_ROOT
  const documentPath = lifecycle.fixture.scenarioFiles[0].path
  const officeViewStatePath = path.join(
    lifecycle.fixture.workspaceRoots.a,
    'ai',
    OFFICE_E2E_MACHINE,
    'System',
    'Views',
    '001-office-viewer',
    'state',
    'state.json',
  )
  try {
    process.env.FUSION_OFFICE_E2E_FIXTURE_ROOT = lifecycle.fixture.root
    for (let cycle = 1; cycle <= 2; cycle += 1) {
      fs.appendFileSync(documentPath, `mutation-${cycle}\n`)
      const undeclared = path.join(path.dirname(documentPath), `undeclared-${cycle}.md`)
      fs.writeFileSync(undeclared, 'remove me\n')
      fs.writeFileSync(officeViewStatePath, `${JSON.stringify({
        preserveUnknown: `cycle-${cycle}`,
        officeViewerMode: 'archive',
        officeViewerCurrentFolder: '001-Fixtures',
        officeViewerSelectedPath: '001-Fixtures/Missing.md',
      }, null, 2)}\n`)
      const files = await resetOfficePlaywrightScenario()
      assert.equal(files.length, 1)
      assert.equal(fs.readFileSync(documentPath, 'utf8'), BASIC_DOCUMENT)
      assert.equal(fs.existsSync(undeclared), false)
      assert.deepEqual(JSON.parse(fs.readFileSync(officeViewStatePath, 'utf8')), {
        preserveUnknown: `cycle-${cycle}`,
        officeViewerMode: 'home',
        officeViewerCurrentFolder: null,
        officeViewerSelectedPath: null,
      })
    }
  } finally {
    if (beforeRoot === undefined) delete process.env.FUSION_OFFICE_E2E_FIXTURE_ROOT
    else process.env.FUSION_OFFICE_E2E_FIXTURE_ROOT = beforeRoot
    await finalizeOfficeProcessLifecycle(lifecycle)
  }
})

test('[slice 00.2] prelaunch failure cannot retain or print a retained marker', async () => {
  const beforeRetain = process.env.FUSION_OFFICE_E2E_RETAIN
  const originalLog = console.log
  const output = []
  try {
    process.env.FUSION_OFFICE_E2E_RETAIN = '1'
    console.log = (line) => output.push(String(line))
    await assert.rejects(
      runIsolatedElectron([], {
        beforeApplicationLaunch: () => { throw new Error('injected prelaunch failure') },
      }),
      /injected prelaunch failure/,
    )
  } finally {
    console.log = originalLog
    if (beforeRetain === undefined) delete process.env.FUSION_OFFICE_E2E_RETAIN
    else process.env.FUSION_OFFICE_E2E_RETAIN = beforeRetain
  }
  const root = /^OFFICE_E2E_FIXTURE_ROOT=(.+)$/m.exec(output.join('\n'))?.[1]
  assert.ok(root)
  assert.equal(fs.existsSync(root), false)
  assert.equal(output.some((line) => line.startsWith('OFFICE_E2E_RETAINED_ROOT=')), false)
})

test('[slice 00.2] deliberate wrapper failure stops and waits for a real sentinel before deleting its root', async () => {
  const beforeRetain = process.env.FUSION_OFFICE_E2E_RETAIN
  delete process.env.FUSION_OFFICE_E2E_RETAIN
  let root
  let sentinelPid
  try {
    await assert.rejects(withOfficeProcessLifecycle({}, async (lifecycle) => {
      root = lifecycle.fixture.root
      const sentinel = startOfficeOwnedProcess(
        lifecycle,
        process.execPath,
        ['-e', 'setInterval(() => {}, 1000)'],
        { stdio: 'ignore' },
      )
      sentinelPid = sentinel.child.pid
      assert.equal(isProcessAlive(sentinelPid), true)
      throw new Error('deliberate wrapper assertion failure')
    }), /deliberate wrapper assertion failure/)
  } finally {
    if (beforeRetain === undefined) delete process.env.FUSION_OFFICE_E2E_RETAIN
    else process.env.FUSION_OFFICE_E2E_RETAIN = beforeRetain
  }
  assert.equal(isProcessAlive(sentinelPid), false)
  assert.equal(fs.existsSync(root), false)
})

test('[slice 00.2] exact retain opt-in restores permissions and retains only after orderly shutdown', async () => {
  const beforeRetain = process.env.FUSION_OFFICE_E2E_RETAIN
  const originalLog = console.log
  const output = []
  let root
  try {
    process.env.FUSION_OFFICE_E2E_RETAIN = '1'
    const lifecycle = await createOfficeProcessLifecycle()
    root = lifecycle.fixture.root
    const workspaceRoot = lifecycle.fixture.workspaceRoots.a
    const originalMode = fs.statSync(workspaceRoot).mode & 0o7777
    captureOfficeFixtureMode(lifecycle.fixture, workspaceRoot)
    fs.chmodSync(workspaceRoot, 0o700)
    console.log = (line) => output.push(line)
    const result = await finalizeOfficeProcessLifecycle(lifecycle, { reason: 'orderly' })
    assert.equal(result.retained, true)
    assert.equal(fs.statSync(workspaceRoot).mode & 0o7777, originalMode)
  } finally {
    console.log = originalLog
    if (beforeRetain === undefined) delete process.env.FUSION_OFFICE_E2E_RETAIN
    else process.env.FUSION_OFFICE_E2E_RETAIN = beforeRetain
  }
  assert.deepEqual(output, [`OFFICE_E2E_RETAINED_ROOT=${root}`])
  assert.equal(fs.existsSync(root), true)
  fs.rmSync(root, { recursive: true, force: true })
})

test('[slice 00.2] exact retain opt-in also retains after assertion while every other value defaults to cleanup', async () => {
  const beforeRetain = process.env.FUSION_OFFICE_E2E_RETAIN
  const originalLog = console.log
  const output = []
  let retainedRoot
  try {
    process.env.FUSION_OFFICE_E2E_RETAIN = '1'
    console.log = (line) => output.push(line)
    await assert.rejects(withOfficeProcessLifecycle({}, async (lifecycle) => {
      retainedRoot = lifecycle.fixture.root
      throw new Error('retain assertion')
    }), /retain assertion/)
    assert.equal(fs.existsSync(retainedRoot), true)
    fs.rmSync(retainedRoot, { recursive: true, force: true })

    for (const value of ['', 'true', '01', '0']) {
      process.env.FUSION_OFFICE_E2E_RETAIN = value
      const lifecycle = await createOfficeProcessLifecycle()
      const root = lifecycle.fixture.root
      const result = await finalizeOfficeProcessLifecycle(lifecycle)
      assert.equal(result.retained, false)
      assert.equal(fs.existsSync(root), false)
    }
  } finally {
    console.log = originalLog
    if (beforeRetain === undefined) delete process.env.FUSION_OFFICE_E2E_RETAIN
    else process.env.FUSION_OFFICE_E2E_RETAIN = beforeRetain
  }
  assert.deepEqual(
    output.filter((line) => line.startsWith('OFFICE_E2E_RETAINED_ROOT=')),
    [`OFFICE_E2E_RETAINED_ROOT=${retainedRoot}`],
  )
})

test('[slice 00.2] setup and path-safety failures never retain even with the exact opt-in', async () => {
  const createServicePath = path.join(repositoryRoot, 'fusion-studio-server', 'lib', 'workspace', 'create-service.js')
  const createService = require(createServicePath)
  const originalScaffoldProject = createService.scaffoldProject
  const beforeRetain = process.env.FUSION_OFFICE_E2E_RETAIN
  const originalLog = console.log
  const output = []
  const rootsBefore = officeTemporaryRoots()
  let safetyRoot
  try {
    process.env.FUSION_OFFICE_E2E_RETAIN = '1'
    console.log = (line) => output.push(line)
    createService.scaffoldProject = () => { throw new Error('injected lifecycle setup failure') }
    await assert.rejects(createOfficeProcessLifecycle(), /injected lifecycle setup failure/)
    createService.scaffoldProject = originalScaffoldProject
    await assert.rejects(withOfficeProcessLifecycle({}, async (lifecycle) => {
      safetyRoot = lifecycle.fixture.root
      lifecycle.fixture.workspaceRoots.a = os.tmpdir()
      await resetOfficeFixtureScenario(lifecycle.fixture)
    }), { code: 'OFFICE_E2E_PATH_SAFETY' })
  } finally {
    createService.scaffoldProject = originalScaffoldProject
    console.log = originalLog
    if (beforeRetain === undefined) delete process.env.FUSION_OFFICE_E2E_RETAIN
    else process.env.FUSION_OFFICE_E2E_RETAIN = beforeRetain
  }
  assert.deepEqual(output.filter((line) => line.startsWith('OFFICE_E2E_RETAINED_ROOT=')), [])
  assert.deepEqual(officeTemporaryRoots(), rootsBefore)
  assert.equal(fs.existsSync(safetyRoot), false)
})

test('[slice 00.2] setup-window SIGINT removes the pending allocated root without retention', async () => {
  await runSetupSignalProbe('SIGINT')
})

test('[slice 00.2] setup-window SIGTERM removes the pending allocated root without retention', async () => {
  await runSetupSignalProbe('SIGTERM')
})

test('[slice 00.2] lifecycle probe SIGINT exits launcher and sentinel and removes every temporary root', async () => {
  await runSignalProbe('SIGINT')
})

test('[slice 00.2] lifecycle probe SIGTERM exits launcher and sentinel and removes every temporary root', async () => {
  await runSignalProbe('SIGTERM')
})

test('[slice 00.2] signal during in-progress teardown waits for process-group and root cleanup', async () => {
  await runTeardownSignalProbe('SIGINT')
})
