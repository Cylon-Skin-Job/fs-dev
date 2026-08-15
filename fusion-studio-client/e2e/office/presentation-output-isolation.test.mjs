import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { EventEmitter } from 'node:events'
import { createRequire } from 'node:module'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { zipSync } from 'fflate'

import {
  assertPresentationChildSucceeded,
  classifyIsolatedElectronFailure,
  createIsolatedElectronFinalFailure,
  createPresentationOutputLaunchContext,
  createWatchedOfficeProcessLifecycle,
  emitPresentationOutputFailureDiagnostics,
  finalizeIsolatedElectronFailure,
  finalizationReasonForIsolatedElectronFailure,
  inspectPresentationOutputDownloads,
  inspectPresentationOutputFailureLedger,
} from './run-isolated-electron.mjs'
import {
  createOfficeProcessLifecycle,
  finalizeOfficeProcessLifecycle,
} from './fixture-lifecycle.mjs'
import { downloadDocumentArtifact } from '../../src/lib/downloadDocumentArtifact.mjs'

const require = createRequire(import.meta.url)
const {
  PRESENTATION_OUTPUT_APP_NAME,
  PRESENTATION_OUTPUT_WINDOW_TITLE,
  applyPresentationOutputAppIdentity,
} = require('./presentation-output-app-identity.cjs')
const { createDownloadSink } = require('./isolated-electron-output-main.cjs')
const testDirectory = path.dirname(fileURLToPath(import.meta.url))
const clientRoot = path.resolve(testDirectory, '..', '..')

test('[spec 11 owner smoke] launch selection materializes a unique signed app bundle', (t) => {
  if (process.platform !== 'darwin') return t.skip('macOS bundle identity is Darwin-only')
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-presentation-identity-test-'))
  try {
    const launch = createPresentationOutputLaunchContext(
      { fixture: { root } },
      { runtime: { runtimeClientRoot: clientRoot } },
    )
    const sourceExecutable = createRequire(path.join(clientRoot, 'package.json'))('electron')
    assert.notEqual(launch.electronExecutable, sourceExecutable)
    assert.equal(launch.electronExecutable.startsWith(`${launch.appPath}${path.sep}`), true)
    assert.equal(path.relative(root, launch.appPath).startsWith('..'), false)
    const expectedSuffix = createHash('sha256')
      .update(fs.realpathSync(path.join(root, 'artifacts', 'app-identity')))
      .digest('hex')
      .slice(0, 12)
    assert.equal(
      launch.bundleIdentifier,
      `studio.fusion.e2e.presentation-output.${expectedSuffix}`,
    )
    assert.equal(launch.sourceBundleIdentifier, 'com.github.Electron')
    const signature = fs.realpathSync(launch.appPath)
    assert.equal(fs.lstatSync(signature).isDirectory(), true)
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
  assert.equal(fs.existsSync(root), false)
})

test('[spec 11 owner smoke] wrapper identity is conspicuous while production main stays invariant', () => {
  const app = new EventEmitter()
  const names = []
  app.setName = (name) => names.push(name)
  applyPresentationOutputAppIdentity(app)
  assert.deepEqual(names, [PRESENTATION_OUTPUT_APP_NAME])

  const webContents = new EventEmitter()
  const titles = []
  const window = { setTitle: (title) => titles.push(title), webContents }
  app.emit('browser-window-created', {}, window)
  let prevented = false
  webContents.emit('page-title-updated', { preventDefault: () => { prevented = true } })
  assert.equal(prevented, true)
  assert.deepEqual(titles, [PRESENTATION_OUTPUT_WINDOW_TITLE, PRESENTATION_OUTPUT_WINDOW_TITLE])

  const productionMain = fs.readFileSync(
    path.resolve(testDirectory, '..', '..', 'electron', 'main.cjs'),
    'utf8',
  )
  assert.match(productionMain, /app\.setName\('Fusion Studio'\)/)
  assert.doesNotMatch(productionMain, /presentation-output-app-identity/)
  assert.doesNotMatch(productionMain, /FUSION_OFFICE_E2E/)
})

test('[spec 11 owner smoke] every presentation child phase routes nonzero results to failure', () => {
  const success = Object.freeze({ code: 0, signal: null })
  assert.equal(assertPresentationChildSucceeded(success, 'renderer-build'), success)
  for (const phase of ['renderer-build', 'readiness', 'manual Electron', 'nonmanual Electron']) {
    assert.throws(
      () => assertPresentationChildSucceeded({ code: 1, signal: null }, phase),
      (error) => error.code === 'OFFICE_E2E_CHILD_FAILURE'
        && error.phase === phase
        && error.result.code === 1,
    )
  }
  assert.deepEqual(
    assertPresentationChildSucceeded(
      { code: null, signal: 'SIGTERM' },
      'nonmanual Electron',
      { allowedSignals: ['SIGTERM'] },
    ),
    { code: null, signal: 'SIGTERM' },
  )

  const runnerSource = fs.readFileSync(
    path.join(testDirectory, 'run-isolated-electron.mjs'),
    'utf8',
  )
  const buildContext = runnerSource.indexOf('processRecord: build')
  const buildAwait = runnerSource.indexOf('await parentSafe(build.completion)')
  const ledgerInspection = runnerSource.indexOf('ledgerDiagnostic = inspectFailureLedger')
  const catchDiagnostics = runnerSource.indexOf('emitDiagnostics({')
  const catchCleanup = runnerSource.indexOf('await finalizeLifecycle(lifecycle, { reason })')
  assert.ok(buildContext >= 0 && buildContext < buildAwait)
  assert.match(runnerSource, /captureOutput: true/)
  assert.match(runnerSource, /assertPresentationChildSucceeded\(buildResult, 'renderer-build'\)/)
  assert.match(runnerSource, /if \(!options\.manual && presentationLaunch\)/)
  assert.ok(ledgerInspection >= 0 && ledgerInspection < catchDiagnostics)
  assert.ok(catchDiagnostics >= 0 && catchDiagnostics < catchCleanup)
})

test('[spec 11 repair] child failure reads exact wrapper ledger reason before diagnostics and cleanup', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-presentation-ledger-diagnostics-'))
  const ledgerPath = path.join(root, 'download-ledger.json')
  fs.writeFileSync(ledgerPath, `${JSON.stringify({
    downloads: [],
    errors: ['Renderer download Presentation Output--copy-01.pdf finished as interrupted'],
  })}\n`)
  const childFailure = Object.assign(new Error('Office E2E Electron child failed: {"code":1,"signal":null}'), {
    code: 'OFFICE_E2E_CHILD_FAILURE',
    phase: 'Electron',
    result: { code: 1, signal: null },
  })
  const order = []
  let emitted
  let emittedText = ''
  try {
    const result = await finalizeIsolatedElectronFailure({
      activeApplication: { identity: { ledgerPath } },
      emitDiagnostics: (input) => {
        order.push('diagnostics')
        emitted = input
        emitPresentationOutputFailureDiagnostics({
          ...input,
          processRecord: { readOutput: () => ({
            stderr: '', stderrTruncated: false, stdout: '', stdoutTruncated: false,
          }) },
          temporaryDirectory: root,
          write: (text) => { emittedText = text },
        })
      },
      failure: childFailure,
      finalizeLifecycle: async () => {
        order.push('cleanup')
        fs.rmSync(root, { recursive: true })
      },
      lifecycle: { fixture: { root } },
      reason: 'assertion',
    })
    assert.deepEqual(order, ['diagnostics', 'cleanup'])
    assert.equal(fs.existsSync(root), false)
    assert.equal(result.cleanupError, null)
    assert.deepEqual(result.diagnosticFailures, [])
    assert.equal(result.primaryFailure instanceof AggregateError, true)
    assert.equal(result.primaryFailure.errors[0], childFailure)
    assert.match(result.primaryFailure.message, /finished as interrupted/)
    assert.equal(emitted.failure, result.primaryFailure)
    assert.equal(
      emitted.ledgerDiagnostic.message,
      'Office E2E download wrapper failed: Renderer download Presentation Output--copy-01.pdf finished as interrupted',
    )
    assert.match(emittedText, /Office E2E download wrapper failed: Renderer download Presentation Output--copy-01\.pdf finished as interrupted/)
    assert.match(emittedText, /Office E2E Electron child failed/)
    assert.ok(emittedText.indexOf('download ledger') < emittedText.indexOf('child stdout'))
  } finally {
    if (fs.existsSync(root)) fs.rmSync(root, { recursive: true, force: true })
  }
})

test('[spec 11 repair] ledger diagnostics distinguish missing, malformed, and read failures', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-presentation-ledger-errors-'))
  try {
    const missing = inspectPresentationOutputFailureLedger(path.join(root, 'missing.json'))
    assert.equal(missing.code, 'OFFICE_E2E_DOWNLOAD_LEDGER_UNAVAILABLE')
    assert.match(missing.message, /ENOENT/)
    const malformedPath = path.join(root, 'malformed.json')
    fs.writeFileSync(malformedPath, '{not json')
    const malformed = inspectPresentationOutputFailureLedger(malformedPath)
    assert.equal(malformed.code, 'OFFICE_E2E_DOWNLOAD_LEDGER_MALFORMED')
    assert.match(malformed.message, /JSON/)
    const denied = inspectPresentationOutputFailureLedger(malformedPath, {
      readFileSync: () => { throw Object.assign(new Error('denied'), { code: 'EACCES' }) },
    })
    assert.equal(denied.code, 'OFFICE_E2E_DOWNLOAD_LEDGER_UNAVAILABLE')
    assert.match(denied.message, /EACCES/)
    const oversized = inspectPresentationOutputFailureLedger(malformedPath, {
      readFileSync: () => { throw new Error(`oversized inspection: ${'x'.repeat(100_000)}`) },
    })
    assert.equal(oversized.code, 'OFFICE_E2E_DOWNLOAD_LEDGER_UNAVAILABLE')
    assert.equal(oversized.truncated, true)
    assert.match(oversized.message, /^Office E2E download ledger unavailable: oversized inspection:/)
    assert.ok(Buffer.byteLength(oversized.message) <= 65_536)
    let emitted = ''
    emitPresentationOutputFailureDiagnostics({
      failure: new Error('child failure'),
      identity: {},
      ledgerDiagnostic: { code: 'INJECTED', message: 'z'.repeat(100_000) },
      processRecord: { readOutput: () => ({
        stderr: '', stderrTruncated: false, stdout: '', stdoutTruncated: false,
      }) },
      result: { code: 1, signal: null },
      temporaryDirectory: root,
      write: (text) => { emitted = text },
    })
    assert.match(emitted, /--- download ledger; tailBytes<=65536; truncated=true ---/)
    assert.ok(Buffer.byteLength(emitted) < 70_000)
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test('[spec 11 repair] cleanup still runs after ledger inspection and diagnostic emission failures', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-presentation-ledger-cleanup-'))
  const childFailure = Object.assign(new Error('generic child failure'), {
    code: 'OFFICE_E2E_CHILD_FAILURE',
  })
  const order = []
  const inspectionFailure = new Error('ledger inspection failed')
  const emissionFailure = new Error('diagnostic write failed')
  const cleanupFailure = new Error('cleanup report failed')
  const result = await finalizeIsolatedElectronFailure({
    activeApplication: { identity: { ledgerPath: path.join(root, 'ledger.json') } },
    emitDiagnostics: () => {
      order.push('diagnostics')
      throw emissionFailure
    },
    failure: childFailure,
    finalizeLifecycle: async () => {
      order.push('cleanup')
      fs.rmSync(root, { recursive: true })
      throw cleanupFailure
    },
    inspectFailureLedger: () => {
      order.push('inspection')
      throw inspectionFailure
    },
    lifecycle: { fixture: { root } },
    reason: 'assertion',
  })
  assert.deepEqual(order, ['inspection', 'diagnostics', 'cleanup'])
  assert.equal(fs.existsSync(root), false)
  assert.equal(result.primaryFailure.errors[0], childFailure)
  assert.match(result.primaryFailure.message, /ledger inspection failed/)
  assert.equal(result.diagnosticFailures.length, 2)
  assert.equal(result.cleanupError, cleanupFailure)
  assert.throws(
    () => { throw createIsolatedElectronFinalFailure(result) },
    (error) => {
      assert.equal(error instanceof AggregateError, true)
      assert.equal(error.errors[0], childFailure)
      assert.equal(error.errors[1].code, 'OFFICE_E2E_DOWNLOAD_LEDGER_INSPECTION_FAILED')
      assert.equal(error.errors[2], inspectionFailure)
      assert.equal(error.errors[3], emissionFailure)
      assert.equal(error.errors[4], cleanupFailure)
      return true
    },
  )
})

function fakeDownloadItem(filename) {
  const item = new EventEmitter()
  item.cancelled = false
  item.getFilename = () => filename
  item.setSavePath = (candidate) => { item.savePath = candidate }
  item.cancel = () => { item.cancelled = true }
  return item
}

test('[spec 11 repair] real wrapper sink handles PDF/DOCX and fails closed on collision/interruption/partial', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-presentation-download-sink-'))
  const output = path.join(root, 'downloads')
  const ledgerPath = path.join(root, 'download-ledger.json')
  fs.mkdirSync(output)
  const ledger = { downloads: [], errors: [] }
  const failures = []
  const writeLedger = () => fs.writeFileSync(ledgerPath, `${JSON.stringify(ledger)}\n`)
  const install = createDownloadSink({
    canonicalOutput: fs.realpathSync(output),
    fail: (message) => { failures.push(message); ledger.errors.push(message); writeLedger() },
    ledger,
    writeLedger,
  })
  const session = new EventEmitter()
  install(session)
  try {
    const pdf = fakeDownloadItem('Presentation Output--copy-01.pdf')
    session.emit('will-download', {}, pdf)
    assert.equal(path.dirname(pdf.savePath), fs.realpathSync(output))
    fs.writeFileSync(pdf.savePath, '%PDF-safe-sink')
    pdf.emit('done', {}, 'completed')

    const docx = fakeDownloadItem('Presentation Output--copy-01.docx')
    session.emit('will-download', {}, docx)
    fs.writeFileSync(docx.savePath, Buffer.from(zipSync({
      '[Content_Types].xml': Buffer.from('<Types/>'),
      'word/document.xml': Buffer.from('<w:document/>'),
    })))
    docx.emit('done', {}, 'completed')
    assert.deepEqual(failures, [])
    const artifacts = await inspectPresentationOutputDownloads(output, ledgerPath, 100)
    assert.deepEqual(artifacts.map(({ filename }) => filename), [
      'Presentation Output--copy-01.docx',
      'Presentation Output--copy-01.pdf',
    ])

    const collision = fakeDownloadItem('Presentation Output--copy-01.pdf')
    session.emit('will-download', {}, collision)
    assert.equal(collision.cancelled, true)
    assert.equal(failures.at(-1), 'Colliding renderer download: Presentation Output--copy-01.pdf')

    const interrupted = fakeDownloadItem('another.pdf')
    session.emit('will-download', {}, interrupted)
    interrupted.emit('done', {}, 'interrupted')
    assert.equal(failures.at(-1), 'Renderer download another.pdf finished as interrupted')

    const partial = fakeDownloadItem('leftover.partial')
    session.emit('will-download', {}, partial)
    fs.writeFileSync(partial.savePath, 'partial')
    partial.emit('done', {}, 'completed')
    ledger.errors.length = 0
    ledger.downloads.splice(0, ledger.downloads.length,
      { filename: 'Presentation Output--copy-01.pdf', state: 'completed' },
      { filename: 'Presentation Output--copy-01.docx', state: 'completed' },
    )
    writeLedger()
    await assert.rejects(
      inspectPresentationOutputDownloads(output, ledgerPath, 100),
      (error) => error.message === 'Office E2E output directory contains a partial download',
    )
    assert.equal(path.relative(fs.realpathSync(output), partial.savePath).startsWith('..'), false)
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test('[spec 11 repair] production download helper defers URL retirement until PDF/DOCX consumers start', async () => {
  for (const [filename, bytes, mimeType] of [
    ['safe.pdf', Buffer.from('%PDF-safe'), 'application/pdf'],
    ['safe.docx', Buffer.from('PK-safe'), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  ]) {
    let removed = false
    let resolveConsumption
    const consumption = new Promise((resolve) => { resolveConsumption = resolve })
    const anchor = {
      click() {
        setTimeout(async () => {
          try {
            const response = await fetch(anchor.href)
            resolveConsumption(Buffer.from(await response.arrayBuffer()))
          } catch (error) {
            resolveConsumption(error)
          }
        }, 0)
      },
      remove() { removed = true },
    }
    downloadDocumentArtifact(
      { bytes, filename, mimeType },
      { documentImpl: { body: { appendChild() {} }, createElement: () => anchor } },
    )
    assert.equal(removed, true)
    assert.deepEqual(await consumption, bytes)
  }

  const blob = new Blob([Buffer.from('%PDF-prior-sequence')])
  const url = URL.createObjectURL(blob)
  const priorConsumption = new Promise((resolve) => setTimeout(async () => {
    try { resolve(await fetch(url)) } catch (error) { resolve(error) }
  }, 0))
  URL.revokeObjectURL(url)
  assert.equal(await priorConsumption instanceof Error, true)

  const urlCalls = []
  assert.throws(
    () => downloadDocumentArtifact(
      { bytes: Buffer.from('setup-failure'), filename: 'failure.pdf', mimeType: 'application/pdf' },
      {
        documentImpl: {
          createElement: () => { throw new Error('create failed') },
        },
        urlImpl: {
          createObjectURL: () => { urlCalls.push('create'); return 'blob:setup-failure' },
          revokeObjectURL: (candidate) => { urlCalls.push(`revoke:${candidate}`) },
        },
      },
    ),
    /create failed/,
  )
  assert.deepEqual(urlCalls, ['create', 'revoke:blob:setup-failure'])

  const removalFailureCalls = []
  const scheduledRevocations = []
  assert.throws(
    () => downloadDocumentArtifact(
      { bytes: Buffer.from('remove-failure'), filename: 'remove.pdf', mimeType: 'application/pdf' },
      {
        documentImpl: {
          body: { appendChild: () => removalFailureCalls.push('append') },
          createElement: () => ({
            set href(value) { removalFailureCalls.push(`href:${value}`) },
            set download(value) { removalFailureCalls.push(`download:${value}`) },
            click: () => removalFailureCalls.push('click'),
            remove: () => { removalFailureCalls.push('remove'); throw new Error('remove failed') },
          }),
        },
        scheduleRevoke: (callback) => scheduledRevocations.push(callback),
        urlImpl: {
          createObjectURL: () => { removalFailureCalls.push('create'); return 'blob:remove-failure' },
          revokeObjectURL: (candidate) => removalFailureCalls.push(`revoke:${candidate}`),
        },
      },
    ),
    /remove failed/,
  )
  assert.deepEqual(removalFailureCalls, [
    'create',
    'href:blob:remove-failure',
    'download:remove.pdf',
    'append',
    'click',
    'remove',
    'revoke:blob:remove-failure',
  ])
  assert.deepEqual(scheduledRevocations, [])
})

test('[spec 11 owner smoke] parent loss during delayed fixture creation finalizes exactly once', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-parent-create-test-'))
  const lifecycle = { fixture: { root } }
  const parentLoss = Object.assign(new Error('parent lost'), {
    code: 'OFFICE_E2E_PARENT_LOST',
  })
  let finalizeCalls = 0
  try {
    await assert.rejects(
      createWatchedOfficeProcessLifecycle(
        { scenario: 'presentation-output' },
        { race: async (promise) => { await promise; throw parentLoss } },
        {
          createLifecycle: async () => {
            await new Promise((resolve) => setImmediate(resolve))
            return lifecycle
          },
          finalizeLifecycle: async (actual, options) => {
            finalizeCalls += 1
            assert.equal(actual, lifecycle)
            assert.deepEqual(options, { reason: 'setup' })
            fs.rmSync(root, { recursive: true })
          },
        },
      ),
      (error) => error === parentLoss,
    )
    assert.equal(finalizeCalls, 1)
    assert.equal(fs.existsSync(root), false)
  } finally {
    if (fs.existsSync(root)) fs.rmSync(root, { recursive: true, force: true })
  }
})

test('[spec 11 owner smoke] parent loss upgrades in-flight orderly cleanup and cannot retain a requested fixture', async () => {
  const originalRetain = process.env.FUSION_OFFICE_E2E_RETAIN
  process.env.FUSION_OFFICE_E2E_RETAIN = '1'
  const lifecycle = await createOfficeProcessLifecycle({
    scenario: 'presentation-output',
    workspaces: 1,
    copies: 4,
  })
  const root = lifecycle.fixture.root
  let assertionLifecycle = null
  let assertionRoot = null
  const parentLoss = Object.assign(new Error('parent lost after launch'), {
    code: 'OFFICE_E2E_PARENT_LOST',
  })
  try {
    assert.equal(classifyIsolatedElectronFailure(parentLoss, true), 'parent-loss')
    assert.equal(classifyIsolatedElectronFailure(new Error('assertion'), true), 'assertion')
    assert.equal(finalizationReasonForIsolatedElectronFailure(parentLoss, true), 'signal')
    const orderlyFinalization = finalizeOfficeProcessLifecycle(lifecycle, { reason: 'orderly' })
    const parentLossFinalization = finalizeOfficeProcessLifecycle(lifecycle, {
      reason: finalizationReasonForIsolatedElectronFailure(parentLoss, true),
    })
    const [first, upgraded] = await Promise.all([orderlyFinalization, parentLossFinalization])
    assert.equal(first.retained, false)
    assert.equal(upgraded, first)
    assert.equal(fs.existsSync(root), false)
    const second = await finalizeOfficeProcessLifecycle(lifecycle, { reason: 'parent-loss' })
    assert.equal(second, first)
    assert.equal(fs.existsSync(root), false)

    assertionLifecycle = await createOfficeProcessLifecycle({
      scenario: 'presentation-output',
      workspaces: 1,
      copies: 4,
    })
    assertionRoot = assertionLifecycle.fixture.root
    const retainedAssertion = await finalizeOfficeProcessLifecycle(assertionLifecycle, {
      reason: classifyIsolatedElectronFailure(new Error('assertion'), true),
    })
    assert.equal(retainedAssertion.retained, true)
    assert.equal(fs.existsSync(assertionRoot), true)
    const assertionCleanup = await finalizeOfficeProcessLifecycle(assertionLifecycle, { reason: 'signal' })
    assert.equal(assertionCleanup.retained, false)
    assert.equal(fs.existsSync(assertionRoot), false)
  } finally {
    if (originalRetain === undefined) delete process.env.FUSION_OFFICE_E2E_RETAIN
    else process.env.FUSION_OFFICE_E2E_RETAIN = originalRetain
    if (fs.existsSync(root)) fs.rmSync(root, { recursive: true, force: true })
    if (assertionRoot && fs.existsSync(assertionRoot)) {
      fs.rmSync(assertionRoot, { recursive: true, force: true })
    }
  }
})
