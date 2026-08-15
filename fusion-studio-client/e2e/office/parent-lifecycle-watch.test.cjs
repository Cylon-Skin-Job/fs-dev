'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawn, spawnSync } = require('node:child_process')
const { EventEmitter } = require('node:events')
const test = require('node:test')
const vm = require('node:vm')

const { createParentLifecycleWatch } = require('./parent-lifecycle-watch.cjs')

const helperPath = path.resolve(__dirname, 'parent-lifecycle-watch.cjs')
const runnerPath = path.resolve(__dirname, 'run-isolated-electron.mjs')
const wrapperPath = path.resolve(__dirname, 'isolated-electron-output-main.cjs')

async function waitForFile(candidate, timeoutMs = 5_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (fs.existsSync(candidate)) return fs.readFileSync(candidate, 'utf8')
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
  throw new Error(`Timed out waiting for parent-loss evidence: ${candidate}`)
}

test('parent watch reports a changed parent once and stops cleanly during orderly completion', async () => {
  let currentParentPid = 9001
  const watch = createParentLifecycleWatch({
    expectedParentPid: 9001,
    intervalMs: 60_000,
    isAlive: () => true,
    readParentPid: () => currentParentPid,
    role: 'probe',
  })
  assert.equal(await watch.race(Promise.resolve('complete')), 'complete')
  currentParentPid = 1
  const error = watch.checkNow()
  assert.equal(error.code, 'OFFICE_E2E_PARENT_LOST')
  assert.equal(error.expectedParentPid, 9001)
  assert.equal(error.currentParentPid, 1)
  assert.equal(await watch.lost, error)
  watch.stop()
  watch.stop()

  let stoppedParentPid = 8001
  const stopped = createParentLifecycleWatch({
    expectedParentPid: 8001,
    intervalMs: 60_000,
    isAlive: () => true,
    readParentPid: () => stoppedParentPid,
    role: 'orderly',
  })
  stopped.stop()
  stoppedParentPid = 1
  assert.equal(stopped.checkNow(), null)
})

test('real orphaned subprocesses detect parent loss for both runner and wrapper roles', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-parent-watch-test-'))
  const leafPids = []
  try {
    for (const role of ['presentation-output-runner', 'presentation-output-electron-wrapper']) {
      const evidencePath = path.join(root, `${role}.json`)
      const pidPath = path.join(root, `${role}.pid`)
      const leaf = [
        `const fs = require('node:fs')`,
        `const { createParentLifecycleWatch } = require(${JSON.stringify(helperPath)})`,
        `fs.writeFileSync(${JSON.stringify(pidPath)}, String(process.pid))`,
        `const watch = createParentLifecycleWatch({ role: ${JSON.stringify(role)}, intervalMs: 20 })`,
        `watch.lost.then((error) => { fs.writeFileSync(${JSON.stringify(evidencePath)}, JSON.stringify({ code: error.code, role: error.role, expected: error.expectedParentPid, current: error.currentParentPid })); process.exit(72) })`,
        `setInterval(() => {}, 1000)`,
      ].join(';')
      const parent = [
        `const { spawn } = require('node:child_process')`,
        `const child = spawn(process.execPath, ['-e', ${JSON.stringify(leaf)}], { detached: true, stdio: 'ignore' })`,
        `child.unref()`,
        `setTimeout(() => process.exit(0), 100)`,
      ].join(';')
      const result = spawnSync(process.execPath, ['-e', parent], {
        encoding: 'utf8',
        timeout: 5_000,
      })
      assert.equal(result.status, 0, result.stderr)
      const evidence = JSON.parse(await waitForFile(evidencePath))
      leafPids.push(Number(fs.readFileSync(pidPath, 'utf8')))
      assert.equal(evidence.code, 'OFFICE_E2E_PARENT_LOST')
      assert.equal(evidence.role, role)
      assert.ok(evidence.expected > 1)
      assert.notEqual(evidence.current, evidence.expected)
    }
  } finally {
    for (const pid of leafPids) {
      try { process.kill(pid, 'SIGKILL') } catch {}
    }
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test('presentation runner and Electron wrapper wire independent parent watches to fail-safe teardown', () => {
  const runner = fs.readFileSync(runnerPath, 'utf8')
  const wrapper = fs.readFileSync(wrapperPath, 'utf8')

  assert.match(runner, /role: 'presentation-output-runner'/)
  assert.match(runner, /parentWatch\.race\(Promise\.resolve\(promise\)\)/)
  assert.match(runner, /await finalizeOfficeProcessLifecycle\(lifecycle, \{ reason \}\)/)
  assert.match(wrapper, /role: 'presentation-output-electron-wrapper'/)
  assert.match(wrapper, /launcherParentWatch\.lost\.then/)
  assert.match(wrapper, /fail\(`\$\{error\.code\}/)
  assert.match(wrapper, /finally \{\s*setImmediate\(\(\) => app\.exit\(1\)\)/)
  assert.match(wrapper, /app\.on\('will-quit', \(\) => launcherParentWatch\.stop\(\)\)/)
})

test('wrapper parent loss still exits when its bounded ledger evidence cannot be written', async () => {
  const source = fs.readFileSync(wrapperPath, 'utf8')
  const app = new EventEmitter()
  const defaultSession = new EventEmitter()
  let exitCode = null
  app.whenReady = () => Promise.resolve()
  app.exit = (code) => { exitCode = code }
  app.setName = () => {}
  const parentError = Object.assign(new Error('parent lost'), {
    code: 'OFFICE_E2E_PARENT_LOST',
    currentParentPid: 1,
    expectedParentPid: 4242,
    role: 'presentation-output-electron-wrapper',
  })
  const fsMock = {
    realpathSync: (candidate) => candidate,
    renameSync: () => {},
    writeFileSync: () => { throw Object.assign(new Error('read only'), { code: 'EROFS' }) },
    writeSync: () => {},
  }
  const localRequire = (request) => {
    if (request === 'node:fs') return fsMock
    if (request === 'node:path') return path
    if (request === 'electron') return { app, session: { defaultSession } }
    if (request === './presentation-output-app-identity.cjs') {
      return {
        PRESENTATION_OUTPUT_APP_NAME: 'Fusion Studio E2E — Presentation Output',
        applyPresentationOutputAppIdentity: () => {},
      }
    }
    if (request === './parent-lifecycle-watch.cjs') {
      return {
        createParentLifecycleWatch: () => ({
          lost: Promise.resolve(parentError),
          stop: () => {},
        }),
      }
    }
    if (request === '/owned/production-main.cjs') return {}
    throw new Error(`Unexpected wrapper require: ${request}`)
  }

  vm.runInNewContext(source, {
    Buffer,
    console,
    process: {
      env: {
        FUSION_OFFICE_E2E_DOWNLOAD_LEDGER: '/owned/download-ledger.json',
        FUSION_OFFICE_E2E_OUTPUT_DIR: '/owned/downloads',
        FUSION_OFFICE_E2E_PRODUCTION_MAIN: '/owned/production-main.cjs',
      },
      exitCode: 0,
      stderr: { fd: 2 },
    },
    require: localRequire,
    setImmediate: (callback) => callback(),
  }, { filename: wrapperPath })
  await Promise.resolve()
  await Promise.resolve()

  assert.equal(exitCode, 1)
})
