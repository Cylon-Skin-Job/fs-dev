import crypto from 'node:crypto'
import fs from 'node:fs'
import net from 'node:net'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { unzipSync } from 'fflate'

import {
  activateOfficeFixtureA,
  cleanupOfficePlaywrightRunRoot,
  createOfficeProcessLifecycle,
  createOfficeRuntimeLayout,
  finalizeOfficeProcessLifecycle,
  installOfficeSignalCleanup,
  officeRuntimeEnvironment,
  startOfficeOwnedProcess,
  stopOfficeOwnedProcesses,
  validateOfficeFixtureOptions,
} from './fixture-lifecycle.mjs'
import {
  assertNoRetiredPaletteArtifacts,
  paletteSelectorFileEvidence,
  preparePaletteElectronRelaunch,
  runPaletteSelectorElectronVariant,
} from './palette-selector-electron.mjs'

const require = createRequire(import.meta.url)
const {
  materializePresentationOutputElectronApp,
} = require('./presentation-output-app-identity.cjs')
const {
  createParentLifecycleWatch,
} = require('./parent-lifecycle-watch.cjs')

export default class OfficePlaywrightCleanupReporter {
  constructor(options = {}) {
    if (typeof options.runRoot !== 'string') throw new Error('Office Playwright cleanup reporter requires runRoot')
    this.runRoot = options.runRoot
  }

  onExit() {
    return cleanupOfficePlaywrightRunRoot(this.runRoot)
  }
}

const OPTION_NAMES = Object.freeze(['workspaces', 'relaunches', 'copies', 'manual', 'scenario', 'variant'])
export const OFFICE_E2E_ELECTRON_LAUNCH = Object.freeze({
  command: 'npm',
  args: Object.freeze(['run', 'electron:dev']),
})
const PRESENTATION_OUTPUT_NAMES = Object.freeze([
  'Presentation Output--copy-01.pdf',
  'Presentation Output--copy-01.docx',
])
const outputWrapperPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'isolated-electron-output-main.cjs',
)

function pathIsWithin(candidate, root) {
  const relative = path.relative(root, candidate)
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
}

function assertOwnedNonsymlinkDirectory(candidate, root) {
  const canonicalRoot = fs.realpathSync(root)
  const rootStat = fs.lstatSync(root)
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
    throw new Error(`Office E2E owned root is not a nonsymlink directory: ${root}`)
  }
  const canonicalCandidate = fs.realpathSync(candidate)
  const stat = fs.lstatSync(candidate)
  if (!stat.isDirectory() || stat.isSymbolicLink() || !pathIsWithin(canonicalCandidate, canonicalRoot)) {
    throw new Error(`Office E2E output directory escapes its owned root: ${candidate}`)
  }
  return canonicalCandidate
}

export function createPresentationOutputLaunchContext(lifecycle, launchContext) {
  const artifacts = path.join(lifecycle.fixture.root, 'artifacts')
  const outputDirectory = path.join(artifacts, 'downloads')
  const appIdentityDirectory = path.join(artifacts, 'app-identity')
  fs.mkdirSync(outputDirectory, { recursive: true })
  fs.mkdirSync(appIdentityDirectory)
  const canonicalOutputDirectory = assertOwnedNonsymlinkDirectory(
    outputDirectory,
    lifecycle.fixture.root,
  )
  const runtimeRequire = createRequire(path.join(launchContext.runtime.runtimeClientRoot, 'package.json'))
  const sourceElectronExecutable = runtimeRequire('electron')
  const appIdentity = materializePresentationOutputElectronApp(
    sourceElectronExecutable,
    appIdentityDirectory,
  )
  const productionMain = path.join(launchContext.runtime.runtimeClientRoot, 'electron', 'main.cjs')
  const ledgerPath = path.join(artifacts, 'download-ledger.json')
  for (const candidate of [appIdentity.executablePath, productionMain, outputWrapperPath]) {
    if (!fs.statSync(candidate).isFile()) throw new Error(`Missing Office E2E launch file: ${candidate}`)
  }
  return Object.freeze({
    ...appIdentity,
    electronExecutable: appIdentity.executablePath,
    ledgerPath,
    outputDirectory: canonicalOutputDirectory,
    productionMain,
    wrapperPath: outputWrapperPath,
  })
}

const FAILURE_DIAGNOSTIC_TAIL_BYTES = 65_536

function boundedDiagnosticMessage(value) {
  const buffer = Buffer.from(String(value), 'utf8')
  if (buffer.length <= FAILURE_DIAGNOSTIC_TAIL_BYTES) {
    return { text: buffer.toString('utf8'), truncated: false }
  }
  let end = FAILURE_DIAGNOSTIC_TAIL_BYTES
  while (end > 0 && (buffer[end] & 0xc0) === 0x80) end -= 1
  return { text: buffer.subarray(0, end).toString('utf8'), truncated: true }
}

function boundedDiagnosticTail(value) {
  const buffer = Buffer.from(String(value), 'utf8')
  if (buffer.length <= FAILURE_DIAGNOSTIC_TAIL_BYTES) {
    return { text: buffer.toString('utf8'), truncated: false }
  }
  let start = buffer.length - FAILURE_DIAGNOSTIC_TAIL_BYTES
  while (start < buffer.length && (buffer[start] & 0xc0) === 0x80) start += 1
  return { text: buffer.subarray(start).toString('utf8'), truncated: true }
}

function readDiagnosticTail(candidate) {
  try {
    const stat = fs.statSync(candidate)
    if (!stat.isFile()) return { text: '[not a regular file]', truncated: false }
    const bytes = Math.min(stat.size, FAILURE_DIAGNOSTIC_TAIL_BYTES)
    const buffer = Buffer.alloc(bytes)
    const descriptor = fs.openSync(candidate, 'r')
    try {
      if (bytes > 0) fs.readSync(descriptor, buffer, 0, bytes, stat.size - bytes)
    } finally {
      fs.closeSync(descriptor)
    }
    return { text: buffer.toString('utf8'), truncated: stat.size > bytes }
  } catch (error) {
    return { text: `[unavailable: ${error.code ?? error.message}]`, truncated: false }
  }
}

export function formatPresentationOutputManualReady({ identity, relaunch, scenario, totalRelaunches }) {
  if (!identity?.bundleIdentifier || !identity?.appName || !identity?.windowTitle) {
    throw new Error('Presentation-output manual readiness requires a materialized app identity')
  }
  return [
    'OFFICE_E2E_MANUAL_READY=1',
    `SCENARIO=${scenario}`,
    `APP_IDENTITY=${identity.bundleIdentifier}`,
    `APP_NAME=${JSON.stringify(identity.appName)}`,
    `WINDOW_TITLE=${JSON.stringify(identity.windowTitle)}`,
    `RELAUNCH=${relaunch}/${totalRelaunches}`,
  ].join(' ')
}

export function emitPresentationOutputFailureDiagnostics({
  failure,
  identity,
  ledgerDiagnostic,
  processRecord,
  result,
  temporaryDirectory,
  write = (text) => fs.writeSync(process.stderr.fd, text),
}) {
  const output = processRecord?.readOutput?.() ?? {
    stderr: '[unavailable]',
    stderrTruncated: false,
    stdout: '[unavailable]',
    stdoutTruncated: false,
  }
  const rawSources = [
    ...(ledgerDiagnostic ? [['download ledger', {
      text: ledgerDiagnostic.message,
      truncated: ledgerDiagnostic.truncated,
    }]] : []),
    ['child stdout', { text: output.stdout, truncated: output.stdoutTruncated }],
    ['child stderr', { text: output.stderr, truncated: output.stderrTruncated }],
    ['Electron main', readDiagnosticTail(path.join(temporaryDirectory, 'fusion-electron.log'))],
    ['Electron renderer', readDiagnosticTail(path.join(temporaryDirectory, 'electron-renderer.log'))],
  ]
  const sources = rawSources.map(([label, source]) => {
    const bounded = boundedDiagnosticTail(source.text)
    return [label, {
      text: bounded.text,
      truncated: Boolean(source.truncated || bounded.truncated),
    }]
  })
  const header = {
    appIdentity: identity?.bundleIdentifier ?? null,
    appName: identity?.appName ?? null,
    failure: failure ? {
      code: failure.code ?? null,
      message: String(failure.message ?? failure).slice(-4096),
      name: failure.name ?? null,
      path: failure.path ?? null,
      syscall: failure.syscall ?? null,
    } : null,
    failureContext: failure instanceof AggregateError
      ? failure.errors.map((candidate) => ({
          code: candidate?.code ?? null,
          message: String(candidate?.message ?? candidate).slice(-4096),
          name: candidate?.name ?? null,
        }))
      : [],
    maxBytesPerSource: FAILURE_DIAGNOSTIC_TAIL_BYTES,
    result: result ?? {
      code: processRecord?.child?.exitCode ?? null,
      signal: processRecord?.child?.signalCode ?? null,
    },
    scenario: 'presentation-output',
    windowTitle: identity?.windowTitle ?? null,
  }
  const sections = sources.map(([label, source]) => [
    `--- ${label}; tailBytes<=${FAILURE_DIAGNOSTIC_TAIL_BYTES}; truncated=${Boolean(source.truncated)} ---`,
    source.text || '[empty]',
  ].join('\n'))
  const report = [
    `OFFICE_E2E_FAILURE_DIAGNOSTICS_BEGIN=${JSON.stringify(header)}`,
    ...sections,
    'OFFICE_E2E_FAILURE_DIAGNOSTICS_END',
    '',
  ].join('\n')
  write(report)
  return report
}

function presentationLedgerDiagnostic(code, message, details = {}) {
  const bounded = boundedDiagnosticMessage(message)
  return Object.freeze({ code, message: bounded.text, truncated: bounded.truncated, ...details })
}

export function inspectPresentationOutputFailureLedger(
  ledgerPath,
  { readFileSync = fs.readFileSync } = {},
) {
  let source
  try {
    source = readFileSync(ledgerPath, 'utf8')
  } catch (error) {
    return presentationLedgerDiagnostic(
      'OFFICE_E2E_DOWNLOAD_LEDGER_UNAVAILABLE',
      `Office E2E download ledger unavailable: ${error.code ?? error.message}`,
    )
  }
  let ledger
  try {
    ledger = JSON.parse(source)
  } catch (error) {
    return presentationLedgerDiagnostic(
      'OFFICE_E2E_DOWNLOAD_LEDGER_MALFORMED',
      `Office E2E download ledger malformed: ${error.message}`,
    )
  }
  if (
    !ledger
    || typeof ledger !== 'object'
    || Array.isArray(ledger)
    || !Array.isArray(ledger.downloads)
    || !Array.isArray(ledger.errors)
    || ledger.errors.some((message) => typeof message !== 'string')
  ) {
    return presentationLedgerDiagnostic(
      'OFFICE_E2E_DOWNLOAD_LEDGER_MALFORMED',
      'Office E2E download ledger malformed: expected downloads and string errors arrays',
    )
  }
  if (ledger.errors.length > 0) {
    return presentationLedgerDiagnostic(
      'OFFICE_E2E_DOWNLOAD_WRAPPER_FAILURE',
      `Office E2E download wrapper failed: ${ledger.errors.join('; ')}`,
      { errors: Object.freeze([...ledger.errors]) },
    )
  }
  return presentationLedgerDiagnostic(
    'OFFICE_E2E_DOWNLOAD_LEDGER_NO_ERROR',
    'Office E2E download ledger recorded no wrapper error before child failure',
  )
}

function aggregatePresentationOutputFailure(failure, ledgerDiagnostic) {
  const ledgerMessage = boundedDiagnosticMessage(ledgerDiagnostic.message).text
  const ledgerError = new Error(ledgerMessage)
  ledgerError.code = ledgerDiagnostic.code
  const aggregateMessage = boundedDiagnosticMessage(
    `${failure.message}; ${ledgerMessage}`,
  ).text
  const aggregate = new AggregateError(
    [failure, ledgerError],
    aggregateMessage,
    { cause: failure },
  )
  aggregate.code = failure.code ?? 'OFFICE_E2E_CHILD_FAILURE'
  aggregate.phase = failure.phase
  aggregate.result = failure.result
  return aggregate
}

export function createIsolatedElectronFinalFailure(finalizedFailure) {
  const primaryErrors = finalizedFailure.primaryFailure instanceof AggregateError
    ? finalizedFailure.primaryFailure.errors
    : [finalizedFailure.primaryFailure]
  const aggregate = new AggregateError(
    [
      ...primaryErrors,
      ...finalizedFailure.diagnosticFailures,
      finalizedFailure.cleanupError,
    ].filter(Boolean),
    'Office E2E failure diagnostics or cleanup could not complete',
    { cause: primaryErrors[0] },
  )
  aggregate.code = finalizedFailure.primaryFailure?.code ?? 'OFFICE_E2E_CHILD_FAILURE'
  aggregate.phase = finalizedFailure.primaryFailure?.phase
  aggregate.result = finalizedFailure.primaryFailure?.result
  return aggregate
}

export async function finalizeIsolatedElectronFailure({
  activeApplication,
  emitDiagnostics = emitPresentationOutputFailureDiagnostics,
  failure,
  finalizeLifecycle = finalizeOfficeProcessLifecycle,
  inspectFailureLedger = inspectPresentationOutputFailureLedger,
  lifecycle,
  reason,
}) {
  let primaryFailure = failure
  const diagnosticFailures = []
  if (activeApplication) {
    let ledgerDiagnostic
    try {
      ledgerDiagnostic = inspectFailureLedger(activeApplication.identity?.ledgerPath)
    } catch (error) {
      ledgerDiagnostic = presentationLedgerDiagnostic(
        'OFFICE_E2E_DOWNLOAD_LEDGER_INSPECTION_FAILED',
        `Office E2E download ledger inspection failed: ${error.code ?? error.message}`,
      )
      diagnosticFailures.push(error)
    }
    primaryFailure = aggregatePresentationOutputFailure(failure, ledgerDiagnostic)
    try {
      emitDiagnostics({
        ...activeApplication,
        failure: primaryFailure,
        ledgerDiagnostic,
      })
    } catch (error) {
      diagnosticFailures.push(error)
    }
  }
  let cleanupError = null
  if (lifecycle) {
    try {
      await finalizeLifecycle(lifecycle, { reason })
    } catch (error) {
      cleanupError = error
    }
  }
  return Object.freeze({ cleanupError, diagnosticFailures, primaryFailure })
}

export function assertPresentationChildSucceeded(result, phase, options = {}) {
  const allowedSignals = options.allowedSignals ?? []
  const succeeded = result?.code === 0 && result?.signal === null
  const expectedSignal = result?.code === null && allowedSignals.includes(result?.signal)
  if (succeeded || expectedSignal) return result
  const error = new Error(`Office E2E ${phase} child failed: ${JSON.stringify(result)}`)
  error.code = 'OFFICE_E2E_CHILD_FAILURE'
  error.phase = phase
  error.result = result
  throw error
}

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex')
}

function assertDocxPackage(bytes) {
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) throw new Error('DOCX download lacks ZIP magic')
  const archive = unzipSync(bytes)
  for (const name of ['[Content_Types].xml', 'word/document.xml']) {
    if (!archive[name]?.length) throw new Error(`DOCX download lacks ${name}`)
  }
  return true
}

export async function inspectPresentationOutputDownloads(outputDirectory, ledgerPath, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs
  let ledger = null
  while (Date.now() < deadline) {
    try {
      ledger = JSON.parse(fs.readFileSync(ledgerPath, 'utf8'))
      if (ledger.downloads?.length >= PRESENTATION_OUTPUT_NAMES.length) break
    } catch { /* wait for the wrapper's final atomic ledger write */ }
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  if (!ledger) throw new Error('Office E2E download wrapper did not produce a ledger')
  if (ledger.errors?.length) throw new Error(`Office E2E download wrapper failed: ${ledger.errors.join('; ')}`)
  const entries = fs.readdirSync(outputDirectory).sort()
  if (entries.some((name) => /\.crdownload$|\.partial$/i.test(name))) {
    throw new Error('Office E2E output directory contains a partial download')
  }
  const completedNames = ledger.downloads
    ?.filter(({ state }) => state === 'completed')
    .map(({ filename }) => filename)
    .sort()
  const expectedNames = [...PRESENTATION_OUTPUT_NAMES].sort()
  if (JSON.stringify(completedNames) !== JSON.stringify(expectedNames)) {
    throw new Error(`Office E2E downloads mismatch: ${JSON.stringify(completedNames)}`)
  }
  if (JSON.stringify(entries) !== JSON.stringify(expectedNames)) {
    throw new Error(`Office E2E output directory mismatch: ${JSON.stringify(entries)}`)
  }
  return Object.freeze(expectedNames.map((filename) => {
    const bytes = fs.readFileSync(path.join(outputDirectory, filename))
    if (filename.endsWith('.pdf') && !bytes.subarray(0, 5).equals(Buffer.from('%PDF-'))) {
      throw new Error('PDF download lacks %PDF- magic')
    }
    const parsed = filename.endsWith('.docx') ? assertDocxPackage(bytes) : true
    return Object.freeze({ filename, bytes: bytes.length, sha256: sha256(bytes), parsed })
  }))
}

function parseBoundedCount(name, value, minimum, maximum) {
  if (!/^(0|[1-9]\d*)$/.test(value)) throw new Error(`Malformed --${name} count: ${value}`)
  const parsed = Number(value)
  if (parsed < minimum || parsed > maximum) {
    throw new Error(`--${name} must be an integer from ${minimum} through ${maximum}`)
  }
  return parsed
}

export function parseIsolatedElectronArguments(args) {
  const values = new Map()
  for (const argument of args) {
    const match = /^--([a-z-]+)=(.*)$/.exec(argument)
    if (!match) throw new Error(`Malformed Office Electron option: ${argument}`)
    const [, name, value] = match
    if (!OPTION_NAMES.includes(name)) throw new Error(`Unknown Office Electron option: --${name}`)
    if (values.has(name)) throw new Error(`Duplicate Office Electron option: --${name}`)
    if (value.length === 0) throw new Error(`Malformed Office Electron option: --${name}=`)
    values.set(name, value)
  }
  const options = {
    workspaces: parseBoundedCount('workspaces', values.get('workspaces') ?? '1', 1, 3),
    relaunches: parseBoundedCount('relaunches', values.get('relaunches') ?? '1', 1, Number.MAX_SAFE_INTEGER),
    copies: parseBoundedCount('copies', values.get('copies') ?? '1', 1, 32),
    scenario: values.get('scenario') ?? 'basic',
  }
  if (values.has('variant')) options.variant = values.get('variant')
  if (values.has('manual')) {
    const manual = values.get('manual')
    if (!['0', '1'].includes(manual)) throw new Error('--manual must be 0 or 1')
    options.manual = manual === '1'
  }
  validateOfficeFixtureOptions(options)
  if (options.scenario === 'palette' && options.variant === 'machine-move' && options.relaunches !== 2) {
    throw new Error('The machine-move selector variant requires --relaunches=2')
  }
  return Object.freeze(options)
}

async function unusedPort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (!address || typeof address === 'string') return reject(new Error('Could not allocate Electron CDP port'))
      server.close((error) => error ? reject(error) : resolve(address.port))
    })
  })
}

async function waitForValue(read, accept, label, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs
  let value
  while (Date.now() < deadline) {
    try {
      value = await read()
      if (accept(value)) return value
    } catch { /* retry startup transition */ }
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  throw new Error(`Timed out waiting for ${label}: ${JSON.stringify(value)}`)
}

async function electronPage(cdpPort) {
  const { chromium } = await import('@playwright/test')
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${cdpPort}`)
  const page = await waitForValue(
    () => Promise.resolve(browser.contexts().flatMap((context) => context.pages())[0]),
    Boolean,
    'Electron renderer page',
  )
  await page.waitForSelector('.rv-workspace-name')
  return { browser, page }
}

async function runLifecycleProbe(lifecycle) {
  const sentinelScript = [
    "const { spawn } = require('node:child_process')",
    "const descendant = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' })",
    "console.log(`OFFICE_E2E_PROBE_DESCENDANT_PID=${descendant.pid}`)",
    'setInterval(() => {}, 1000)',
  ].join(';')
  const sentinel = startOfficeOwnedProcess(lifecycle, process.execPath, ['-e', sentinelScript], {
    readyPattern: /OFFICE_E2E_PROBE_DESCENDANT_PID=\d+/,
    readyTimeoutMs: 10_000,
  })
  await sentinel.ready
  console.log(`OFFICE_E2E_PROBE_ROOT=${lifecycle.fixture.root}`)
  console.log(`OFFICE_E2E_PROBE_LAUNCHER_PID=${process.pid}`)
  console.log(`OFFICE_E2E_PROBE_SENTINEL_PID=${sentinel.child.pid}`)
  await sentinel.completion
}

export function createIsolatedElectronLaunchContext(lifecycle) {
  const runtime = createOfficeRuntimeLayout(lifecycle.fixture)
  const isolatedTemporaryDirectory = path.join(lifecycle.fixture.root, 'tmp')
  fs.mkdirSync(isolatedTemporaryDirectory, { recursive: true })
  return Object.freeze({
    cwd: runtime.runtimeClientRoot,
    env: Object.freeze({
      ...officeRuntimeEnvironment(runtime),
      FUSION_APP_PACKAGED: '1',
      FUSION_CALENDAR_APPLE_ENABLED: '0',
      FUSION_CALENDAR_GOOGLE_ENABLED: '0',
      FUSION_APP_USER_DATA: lifecycle.fixture.appUserData,
      FUSION_LOCAL_MACHINE: lifecycle.fixture.machineName,
      TMPDIR: isolatedTemporaryDirectory,
    }),
    runtime,
  })
}

export async function createWatchedOfficeProcessLifecycle(
  options,
  parentWatch,
  dependencies = {},
) {
  const createLifecycle = dependencies.createLifecycle ?? createOfficeProcessLifecycle
  const finalizeLifecycle = dependencies.finalizeLifecycle ?? finalizeOfficeProcessLifecycle
  const lifecycle = await createLifecycle(options)
  if (!parentWatch) return lifecycle
  try {
    // Fixture creation itself is not cancellable. Finish it first so a parent
    // loss can never win a race before the owned lifecycle is available for
    // fail-safe finalization.
    await parentWatch.race(Promise.resolve())
    return lifecycle
  } catch (error) {
    try {
      await finalizeLifecycle(lifecycle, { reason: 'setup' })
    } catch (cleanupError) {
      throw new AggregateError(
        [error, cleanupError],
        'Office E2E parent loss cleanup failed during fixture creation',
      )
    }
    throw error
  }
}

export function classifyIsolatedElectronFailure(error, applicationLaunchStarted) {
  if (error?.code === 'OFFICE_E2E_PARENT_LOST') return 'parent-loss'
  if (error?.code === 'OFFICE_E2E_PATH_SAFETY') return 'safety'
  return applicationLaunchStarted ? 'assertion' : 'setup'
}

export function finalizationReasonForIsolatedElectronFailure(error, applicationLaunchStarted) {
  const classification = classifyIsolatedElectronFailure(error, applicationLaunchStarted)
  return classification === 'parent-loss' ? 'signal' : classification
}

export async function runIsolatedElectron(args = process.argv.slice(2), hooks = {}) {
  const options = parseIsolatedElectronArguments(args)
  const parentWatch = options.scenario === 'presentation-output'
    ? createParentLifecycleWatch({ role: 'presentation-output-runner' })
    : null
  const parentSafe = (promise) => parentWatch
    ? parentWatch.race(Promise.resolve(promise))
    : promise
  let lifecycle
  const removeSignalHandlers = installOfficeSignalCleanup()
  let applicationLaunchStarted = false
  let activeApplication = null
  try {
    lifecycle = await createWatchedOfficeProcessLifecycle(options, parentWatch)
    removeSignalHandlers.attach(lifecycle)
    console.log(`OFFICE_E2E_FIXTURE_ROOT=${lifecycle.fixture.root}`)
    console.log(`OFFICE_E2E_WORKSPACE_IDS=${lifecycle.fixture.workspaceIds.join(',')}`)
    if (process.env.FUSION_OFFICE_E2E_LIFECYCLE_PROBE === '1') {
      await parentSafe(runLifecycleProbe(lifecycle))
      return
    }
    await parentSafe(hooks.beforeApplicationLaunch?.(lifecycle))
    const launchContext = createIsolatedElectronLaunchContext(lifecycle)
    let presentationLaunch = null
    if (options.scenario === 'presentation-output') {
      presentationLaunch = createPresentationOutputLaunchContext(lifecycle, launchContext)
      console.log(`OFFICE_E2E_OUTPUT_DIR=${presentationLaunch.outputDirectory}`)
      const build = startOfficeOwnedProcess(lifecycle, 'npm', ['run', 'build'], {
        captureOutput: true,
        cwd: launchContext.cwd,
        env: launchContext.env,
      })
      activeApplication = Object.freeze({
        identity: presentationLaunch,
        processRecord: build,
        temporaryDirectory: launchContext.env.TMPDIR,
      })
      const buildResult = await parentSafe(build.completion)
      activeApplication = Object.freeze({
        ...activeApplication,
        result: buildResult,
      })
      assertPresentationChildSucceeded(buildResult, 'renderer-build')
      activeApplication = null
    }
    for (let relaunch = 1; relaunch <= options.relaunches; relaunch += 1) {
      await parentSafe(activateOfficeFixtureA(lifecycle.fixture))
      const machineName = options.scenario === 'palette'
        ? preparePaletteElectronRelaunch(lifecycle.fixture, options.variant, relaunch)
        : lifecycle.fixture.machineName
      console.log(`OFFICE_E2E_RELAUNCH=${relaunch}/${options.relaunches} MACHINE=${machineName}`)
      const cdpPort = await parentSafe(unusedPort())
      const command = presentationLaunch?.electronExecutable ?? OFFICE_E2E_ELECTRON_LAUNCH.command
      const commandArgs = presentationLaunch
        ? [presentationLaunch.wrapperPath, `--remote-debugging-port=${cdpPort}`]
        : [...OFFICE_E2E_ELECTRON_LAUNCH.args, '--', `--remote-debugging-port=${cdpPort}`]
      const environment = {
        ...launchContext.env,
        FUSION_LOCAL_MACHINE: machineName,
        ...(presentationLaunch ? {
          FUSION_OFFICE_E2E_DOWNLOAD_LEDGER: presentationLaunch.ledgerPath,
          FUSION_OFFICE_E2E_OUTPUT_DIR: presentationLaunch.outputDirectory,
          FUSION_OFFICE_E2E_PRODUCTION_MAIN: presentationLaunch.productionMain,
        } : {}),
      }
      const electron = startOfficeOwnedProcess(
        lifecycle,
        command,
        commandArgs,
        {
          cwd: launchContext.cwd,
          env: environment,
          readyUrl: `http://127.0.0.1:${cdpPort}/json/version`,
          readyTimeoutMs: 120_000,
          forwardOutput: false,
        },
      )
      activeApplication = presentationLaunch
        ? Object.freeze({
            identity: presentationLaunch,
            processRecord: electron,
            temporaryDirectory: launchContext.env.TMPDIR,
          })
        : null
      await parentSafe(electron.spawned)
      applicationLaunchStarted = true
      await parentSafe(electron.ready)
      const connected = await parentSafe(electronPage(cdpPort))
      console.log(`OFFICE_E2E_ELECTRON_PID=${electron.child.pid} CDP_PORT=${cdpPort}`)
      let result
      if (options.manual) {
        if (presentationLaunch) {
          console.log(formatPresentationOutputManualReady({
            identity: presentationLaunch,
            relaunch,
            scenario: options.scenario,
            totalRelaunches: options.relaunches,
          }))
        } else {
          console.log(`OFFICE_E2E_MANUAL_READY=1 SCENARIO=${options.scenario} APP_IDENTITY=production-default RELAUNCH=${relaunch}/${options.relaunches}`)
        }
        console.log(`OFFICE_E2E_MANUAL_ROOT=${lifecycle.fixture.root}`)
        result = await parentSafe(electron.completion)
        await parentSafe(connected.browser.close().catch(() => {}))
        if (presentationLaunch) {
          activeApplication = Object.freeze({ ...activeApplication, result })
          assertPresentationChildSucceeded(result, 'Electron')
        } else if (result.code !== 0 || result.signal !== null) {
          throw new Error(`Office E2E Electron failed: ${JSON.stringify(result)}`)
        }
      } else {
        try {
          if (options.scenario === 'palette') {
            await parentSafe(runPaletteSelectorElectronVariant({
              fixture: lifecycle.fixture,
              page: connected.page,
              relaunch,
              variant: options.variant,
            }))
          }
        } finally {
          await parentSafe(connected.browser.close())
        }
      }
      if (options.manual && presentationLaunch) {
        const artifacts = await parentSafe(inspectPresentationOutputDownloads(
          presentationLaunch.outputDirectory,
          presentationLaunch.ledgerPath,
        ))
        console.log(`OFFICE_E2E_OUTPUT_ARTIFACTS=${JSON.stringify(artifacts)}`)
      }
      await parentSafe(stopOfficeOwnedProcesses(lifecycle))
      result ??= await parentSafe(electron.completion)
      if (!options.manual && presentationLaunch) {
        activeApplication = Object.freeze({ ...activeApplication, result })
        assertPresentationChildSucceeded(result, 'Electron', {
          allowedSignals: ['SIGKILL', 'SIGTERM'],
        })
      }
      console.log(`OFFICE_E2E_GRACEFUL_QUIT=${relaunch} RESULT=${JSON.stringify(result)}`)
      if (options.manual && options.scenario === 'palette') {
        console.log(`OFFICE_E2E_MANUAL_EVIDENCE=${JSON.stringify(
          paletteSelectorFileEvidence(lifecycle.fixture, machineName),
        )}`)
      }
      assertNoRetiredPaletteArtifacts(lifecycle.fixture.root)
      activeApplication = null
    }
    const root = lifecycle.fixture.root
    const finalized = await parentSafe(finalizeOfficeProcessLifecycle(lifecycle, { reason: 'orderly' }))
    if (!finalized.retained) {
      if (fs.existsSync(root)) throw new Error(`Office fixture root remained after cleanup: ${root}`)
      console.log(`OFFICE_E2E_CLEANED_ROOT=${root}`)
    }
  } catch (error) {
    const reason = finalizationReasonForIsolatedElectronFailure(error, applicationLaunchStarted)
    const finalizedFailure = await finalizeIsolatedElectronFailure({
      activeApplication,
      failure: error,
      lifecycle,
      reason,
    })
    if (finalizedFailure.diagnosticFailures.length > 0 || finalizedFailure.cleanupError) {
      throw createIsolatedElectronFinalFailure(finalizedFailure)
    }
    throw finalizedFailure.primaryFailure
  } finally {
    parentWatch?.stop()
    removeSignalHandlers()
  }
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null
if (invokedPath === fileURLToPath(import.meta.url)) {
  runIsolatedElectron().catch((error) => {
    console.error(error.stack ?? error.message)
    process.exitCode = 1
  })
}
