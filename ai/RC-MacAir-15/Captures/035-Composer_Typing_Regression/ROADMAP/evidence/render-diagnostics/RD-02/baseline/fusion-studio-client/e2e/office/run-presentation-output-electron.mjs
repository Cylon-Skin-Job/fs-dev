import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { spawn, spawnSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { DOMParser } from '@xmldom/xmldom'
import { unzipSync } from 'fflate'

import {
  FIXTURE_SCENARIOS,
  renderFixtureDocument,
} from './fixture-scenarios.mjs'

const MARKER_NAME = '.fusion-office-presentation-output-retained'
const MARKER_BYTES = Buffer.from('fusion-office-presentation-output\n')
const RETAINED_PARENT = path.join(os.tmpdir(), 'fusion-office-presentation-output-retained')
const RETAINED_FILES = Object.freeze([
  MARKER_NAME,
  'source.md',
  'descriptor.json',
  'transformed.html',
  'print-layout.png',
  'pdf-raster.png',
  'oracle.pdf',
  'preview-print.pdf',
  'export.pdf',
  'email.pdf',
  'export.docx',
  'email.docx',
  'email.md',
  'assertions.json',
])

function parseArguments(argv) {
  if (argv.length === 0) return { retain: false }
  if (argv.length === 1 && argv[0] === '--retain-artifacts') return { retain: true }
  throw new Error('Usage: node e2e/office/run-presentation-output-electron.mjs [--retain-artifacts]')
}

function markerMatches(directory) {
  const marker = path.join(directory, MARKER_NAME)
  try {
    return fs.lstatSync(marker).isFile() && fs.readFileSync(marker).equals(MARKER_BYTES)
  } catch {
    return false
  }
}

function cleanPriorRetention() {
  if (!fs.existsSync(RETAINED_PARENT)) return
  const parentStat = fs.lstatSync(RETAINED_PARENT)
  if (!parentStat.isDirectory() || parentStat.isSymbolicLink()) {
    throw new Error('Retained artifact parent is not a safe directory')
  }
  for (const name of fs.readdirSync(RETAINED_PARENT)) {
    const target = path.join(RETAINED_PARENT, name)
    const stat = fs.lstatSync(target)
    if (!stat.isDirectory() || stat.isSymbolicLink() || !markerMatches(target)) {
      throw new Error(`Refusing unmarked or symbolic retained artifact entry: ${name}`)
    }
    fs.rmSync(target, { recursive: true, force: false })
  }
}

function exactBody(fullMarkdown) {
  if (!fullMarkdown.startsWith('---\n')) throw new Error('Fixture frontmatter is missing')
  const closing = fullMarkdown.indexOf('\n---\n', 4)
  if (closing === -1) throw new Error('Fixture frontmatter is unterminated')
  return fullMarkdown.slice(closing + 5)
}

async function descriptorFor(bodyMarkdown) {
  const sourceModule = await import('../../electron/shared/office-table-source-binding.mjs')
  const binding = await sourceModule.bindOfficeTableSources(
    bodyMarkdown,
    async (bytes) => crypto.createHash('sha256').update(bytes).digest('hex'),
  )
  if (binding.tables.length !== 50) throw new Error('Presentation fixture must bind exactly 50 tables')
  const modes = ['overflow', 'truncate', 'newline']
  const colors = ['#e11d48', '#16a34a', '#2563eb', '#9333ea']
  const tables = binding.tables.map((source, index) => {
    if (index === 48) {
      return {
        tableIndex: 48,
        sourceSha256: source.sourceSha256,
        logicalWidth: 3,
        columns: null,
        overflow: 'overflow',
        titleRow: false,
        borderWidth: 1,
        borderColor: 'default',
      }
    }
    if (index === 49) {
      return {
        tableIndex: 49,
        sourceSha256: source.sourceSha256,
        logicalWidth: 3,
        columns: [96, 96, 96],
        overflow: 'truncate',
        titleRow: false,
        borderWidth: 4,
        borderColor: '#004e89',
      }
    }
    const title = index >= 24
    const borderKind = Math.floor(index / 12) % 2
    const width = Math.floor(index / 3) % 4 + 1
    return {
      tableIndex: index,
      sourceSha256: source.sourceSha256,
      logicalWidth: 3,
      columns: [96, 96, 96],
      overflow: modes[index % 3],
      titleRow: title,
      borderWidth: width,
      borderColor: borderKind === 0 ? colors[width - 1] : null,
    }
  })
  return { markdownSha256: binding.markdownSha256, tables }
}

function createRunSignalController(signalTarget = process) {
  let interrupted = null
  let resolveInterruption
  const interruption = new Promise((resolve) => { resolveInterruption = resolve })
  const record = (signal) => {
    if (interrupted) return
    interrupted = signal
    resolveInterruption(signal)
  }
  const onSigint = () => record('SIGINT')
  const onSigterm = () => record('SIGTERM')
  signalTarget.on('SIGINT', onSigint)
  signalTarget.on('SIGTERM', onSigterm)
  return {
    dispose() {
      signalTarget.off('SIGINT', onSigint)
      signalTarget.off('SIGTERM', onSigterm)
    },
    get interrupted() { return interrupted },
    interruption,
    throwIfInterrupted() {
      if (interrupted) throw new Error(`Presentation output Electron interrupted by ${interrupted}`)
    },
  }
}

async function waitAtSignalCheckpoint(name, ownedRoot, signalController, { throwAfter = true } = {}) {
  if (process.env.OFFICE_PRESENTATION_SIGNAL_CHECKPOINT !== name) return
  process.stdout.write(`OFFICE_E2E_SIGNAL_CHECKPOINT=${name}:${ownedRoot}\n`)
  const keepAlive = setInterval(() => {}, 1_000)
  try {
    await signalController.interruption
  } finally {
    clearInterval(keepAlive)
  }
  if (throwAfter) signalController.throwIfInterrupted()
}

function waitForChild(child, timeoutMs, signalTarget = process, initialSignal = null) {
  return new Promise((resolve, reject) => {
    let settled = false
    let timedOut = false
    let interrupted = null
    let closeResult = null
    let lifecycleError = null
    let terminating = false
    let killTimer
    let pollTimer
    const finish = (callback, value) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      clearTimeout(killTimer)
      clearInterval(pollTimer)
      signalTarget.off('SIGINT', onSigint)
      signalTarget.off('SIGTERM', onSigterm)
      callback(value)
    }
    const treeAlive = () => {
      if (process.platform === 'win32' || !child.pid) return closeResult === null
      try {
        process.kill(-child.pid, 0)
        return true
      } catch (error) {
        if (error?.code === 'ESRCH') return false
        if (error?.code === 'EPERM') return true
        throw error
      }
    }
    const signalTree = (signal) => {
      if (!child.pid) return
      try {
        if (process.platform === 'win32') child.kill(signal)
        else process.kill(-child.pid, signal)
      } catch (error) {
        if (error?.code !== 'ESRCH') lifecycleError ??= error
      }
    }
    const evaluate = () => {
      if (settled || closeResult === null || treeAlive()) return
      if (lifecycleError) {
        finish(reject, lifecycleError)
      } else if (timedOut) {
        finish(reject, new Error(`Presentation output Electron timed out after ${timeoutMs}ms`))
      } else if (interrupted) {
        finish(reject, new Error(`Presentation output Electron interrupted by ${interrupted}`))
      } else if (closeResult.error) {
        finish(reject, closeResult.error)
      } else if (closeResult.code === 0 && closeResult.signal === null) {
        finish(resolve, closeResult)
      } else {
        finish(reject, new Error(`Presentation output Electron failed: code=${closeResult.code} signal=${closeResult.signal}`))
      }
    }
    const terminateTree = () => {
      if (terminating) return
      terminating = true
      signalTree('SIGTERM')
      killTimer = setTimeout(() => signalTree('SIGKILL'), 2_000)
      pollTimer = setInterval(evaluate, 50)
    }
    const onSignal = (signal) => {
      interrupted ??= signal
      terminateTree()
    }
    const onSigint = () => onSignal('SIGINT')
    const onSigterm = () => onSignal('SIGTERM')
    signalTarget.once('SIGINT', onSigint)
    signalTarget.once('SIGTERM', onSigterm)
    const timeout = setTimeout(() => {
      timedOut = true
      terminateTree()
    }, timeoutMs)
    if (initialSignal) queueMicrotask(() => onSignal(initialSignal))
    child.once('error', (error) => {
      closeResult = { error }
      terminateTree()
      evaluate()
    })
    child.once('close', (code, signal) => {
      closeResult = { code, signal }
      if (code !== 0 || signal !== null || treeAlive()) terminateTree()
      evaluate()
    })
  })
}

const PLATFORM_PID_MAX = process.platform === 'win32' ? 0xffff_ffff : 0x7fff_ffff

function isValidOwnedProcessId(pid) {
  return Number.isSafeInteger(pid)
    && pid > 1
    && pid <= PLATFORM_PID_MAX
    && pid !== process.pid
}

function discoverPendingConverterGroups(processListOutput, token) {
  const groups = []
  const marker = `FUSION_OFFICE_CONVERTER_TOKEN=${token}`
  for (const line of processListOutput.split('\n')) {
    const match = /^\s*(\d+)\s+(\d+)\s+(.*)$/.exec(line)
    if (!match || !match[3].split(/\s+/).includes(marker)) continue
    const pgidText = match[2]
    const pid = Number(pgidText)
    if (String(pid) !== pgidText || !isValidOwnedProcessId(pid)) {
      throw new Error(`Invalid pending converter group: ${pgidText}`)
    }
    groups.push(pid)
  }
  return groups
}

function registeredConverterGroups(registryDirectory) {
  const groups = new Map()
  const pending = []
  for (const name of fs.readdirSync(registryDirectory)) {
    const filename = path.join(registryDirectory, name)
    const stat = fs.lstatSync(filename)
    if (!stat.isFile() || stat.isSymbolicLink() || (stat.mode & 0o777) !== 0o600) {
      throw new Error(`Invalid converter registry entry: ${name}`)
    }
    const groupMatch = /^(\d+)\.pgid$/.exec(name)
    if (groupMatch) {
      const pid = Number(groupMatch[1])
      if (String(pid) !== groupMatch[1] || !isValidOwnedProcessId(pid)) {
        throw new Error(`Invalid converter registry entry: ${name}`)
      }
      if (fs.readFileSync(filename, 'ascii') !== `${pid}\n`) {
        throw new Error(`Invalid converter registry bytes: ${name}`)
      }
      const group = groups.get(pid) ?? { files: [], pid }
      group.files.push(filename)
      groups.set(pid, group)
      continue
    }
    const pendingMatch = /^([0-9a-f]{32})\.pending$/.exec(name)
    if (!pendingMatch || fs.readFileSync(filename, 'ascii') !== `${pendingMatch[1]}\n`) {
      throw new Error(`Invalid converter registry bytes: ${name}`)
    }
    pending.push({ filename, token: pendingMatch[1] })
  }
  if (pending.length && process.platform !== 'win32') {
    const processList = spawnSync('/bin/ps', ['eww', '-axo', 'pid=,pgid=,command='], {
      encoding: 'utf8',
      maxBuffer: 4 * 1024 * 1024,
    })
    if (processList.error) throw processList.error
    if (processList.status !== 0) throw new Error(`ps failed with code ${processList.status}`)
    for (const record of pending) {
      for (const pid of discoverPendingConverterGroups(processList.stdout, record.token)) {
        const group = groups.get(pid) ?? { files: [], pid }
        group.files.push(record.filename)
        groups.set(pid, group)
      }
      if (![...groups.values()].some((group) => group.files.includes(record.filename))) {
        fs.rmSync(record.filename, { force: true })
      }
    }
  } else if (pending.length) {
    throw new Error('Pending converter discovery is unavailable on Windows')
  }
  return [...groups.values()]
}

function posixGroupAlive(pid) {
  try {
    process.kill(-pid, 0)
    return true
  } catch (error) {
    if (error?.code === 'ESRCH') return false
    if (error?.code === 'EPERM') return true
    throw error
  }
}

function signalPosixGroup(pid, signal) {
  try {
    process.kill(-pid, signal)
  } catch (error) {
    if (error?.code !== 'ESRCH') throw error
  }
}

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))

async function forceWindowsTree(pid) {
  await new Promise((resolve, reject) => {
    const killer = spawn('taskkill', ['/pid', String(pid), '/T', '/F'], {
      stdio: 'ignore',
      windowsHide: true,
    })
    killer.once('error', reject)
    killer.once('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`taskkill failed with code ${code}`))
    })
  })
}

async function reapRegisteredConverterGroups(registryDirectory, killGraceMs = 2_000) {
  const groups = registeredConverterGroups(registryDirectory)
  for (const group of groups) {
    if (process.platform === 'win32') {
      await forceWindowsTree(group.pid)
    } else {
      if (posixGroupAlive(group.pid)) signalPosixGroup(group.pid, 'SIGTERM')
      const deadline = Date.now() + killGraceMs
      while (posixGroupAlive(group.pid) && Date.now() < deadline) await delay(25)
      if (posixGroupAlive(group.pid)) signalPosixGroup(group.pid, 'SIGKILL')
      while (posixGroupAlive(group.pid)) await delay(25)
    }
    for (const filename of group.files) fs.rmSync(filename, { force: true })
  }
  return groups.length
}

async function waitForChildTree(child, timeoutMs, {
  registryDirectory,
  signalTarget = process,
  converterKillGraceMs = 2_000,
  initialSignal = null,
} = {}) {
  let childError = null
  try {
    await waitForChild(child, timeoutMs, signalTarget, initialSignal)
  } catch (error) {
    childError = error
  }
  let reapedCount = 0
  try {
    reapedCount = await reapRegisteredConverterGroups(
      registryDirectory,
      converterKillGraceMs,
    )
  } catch (error) {
    if (childError) throw new AggregateError([childError, error], 'Presentation output tree cleanup failed')
    throw error
  }
  if (childError) {
    childError.presentationOutputTreeSettled = true
    throw childError
  }
  if (reapedCount !== 0) {
    const error = new Error('Presentation output left a registered converter group')
    error.presentationOutputTreeSettled = true
    throw error
  }
}

async function fsyncFile(filename) {
  const handle = await fs.promises.open(filename, 'r')
  try { await handle.sync() } finally { await handle.close() }
}

async function fsyncDirectory(directory) {
  const handle = await fs.promises.open(directory, 'r')
  try { await handle.sync() } finally { await handle.close() }
}

async function publishRetention(artifactRoot, runId, ownedRoot, signalController) {
  await fs.promises.mkdir(RETAINED_PARENT, { recursive: true, mode: 0o700 })
  const partial = path.join(RETAINED_PARENT, `.partial-${runId}`)
  const destination = path.join(RETAINED_PARENT, runId)
  let destinationCreated = false
  let partialCreated = false
  try {
    signalController.throwIfInterrupted()
    await fs.promises.mkdir(partial, { mode: 0o700 })
    partialCreated = true
    if (process.env.OFFICE_PRESENTATION_INJECT_MARKER_WRITE_FAILURE === '1') {
      const error = new Error('Injected retained marker write failure')
      error.code = 'EACCES'
      throw error
    }
    await fs.promises.writeFile(path.join(partial, MARKER_NAME), MARKER_BYTES, { mode: 0o600 })
    await waitAtSignalCheckpoint('retention-partial', ownedRoot, signalController)
    for (const name of RETAINED_FILES.slice(1)) {
      signalController.throwIfInterrupted()
      const source = path.join(artifactRoot, name)
      if (!(await fs.promises.lstat(source)).isFile()) throw new Error(`Missing retained artifact ${name}`)
      await fs.promises.copyFile(source, path.join(partial, name), fs.constants.COPYFILE_EXCL)
    }
    for (const name of RETAINED_FILES) {
      signalController.throwIfInterrupted()
      await fsyncFile(path.join(partial, name))
    }
    await fsyncDirectory(partial)
    await fsyncDirectory(RETAINED_PARENT)
    signalController.throwIfInterrupted()
    await fs.promises.rename(partial, destination)
    partialCreated = false
    destinationCreated = true
    await fsyncDirectory(RETAINED_PARENT)
    await new Promise((resolve) => setImmediate(resolve))
    signalController.throwIfInterrupted()
    return destination
  } catch (error) {
    const cleanupErrors = []
    const ownedTargets = [
      ...(partialCreated ? [partial] : []),
      ...(destinationCreated ? [destination] : []),
    ]
    for (const target of ownedTargets) {
      try {
        await fs.promises.rm(target, { recursive: true, force: false })
      } catch (cleanupError) {
        cleanupErrors.push(cleanupError)
      }
    }
    if (cleanupErrors.length) {
      throw new AggregateError(
        [error, ...cleanupErrors],
        'Retained artifact publication cleanup failed',
      )
    }
    throw error
  }
}

function formatError(error, indentation = '', seen = new Set()) {
  const diagnostic = error?.stack ?? String(error)
  if (!(error instanceof AggregateError)) return `${indentation}${diagnostic}`
  if (seen.has(error)) return `${indentation}[Circular AggregateError: ${error.message}]`
  seen.add(error)
  const members = error.errors.map((member, index) => {
    const rendered = formatError(member, `${indentation}  `, seen)
    return `${indentation}Cause ${index + 1}:\n${rendered}`
  })
  return [`${indentation}${diagnostic}`, ...members].join('\n')
}

function assertArtifacts(artifactRoot, fullMarkdown) {
  const actual = fs.readdirSync(artifactRoot).sort()
  const expected = RETAINED_FILES.slice(1).sort()
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`Unexpected artifact allowlist: ${actual.join(',')}`)
  }
  for (const name of actual) {
    const value = fs.lstatSync(path.join(artifactRoot, name))
    if (!value.isFile() || value.isSymbolicLink() || value.size === 0) {
      throw new Error(`Invalid artifact ${name}`)
    }
  }
  for (const name of ['oracle.pdf', 'preview-print.pdf', 'export.pdf', 'email.pdf']) {
    if (fs.readFileSync(path.join(artifactRoot, name)).subarray(0, 5).toString('ascii') !== '%PDF-') {
      throw new Error(`Invalid PDF artifact ${name}`)
    }
  }
  for (const name of ['print-layout.png', 'pdf-raster.png']) {
    if (fs.readFileSync(path.join(artifactRoot, name)).subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') {
      throw new Error(`Invalid PNG artifact ${name}`)
    }
  }
  for (const name of ['export.docx', 'email.docx']) {
    const bytes = fs.readFileSync(path.join(artifactRoot, name))
    if (bytes.subarray(0, 2).toString('ascii') !== 'PK') {
      throw new Error(`Invalid DOCX artifact ${name}`)
    }
    const entries = unzipSync(new Uint8Array(bytes))
    for (const required of ['[Content_Types].xml', '_rels/.rels', 'word/document.xml']) {
      if (!entries[required]?.length) throw new Error(`Missing DOCX part ${name}:${required}`)
    }
    const errors = []
    const document = new DOMParser({
      onError(level, message) {
        if (level !== 'warning') errors.push(message)
      },
    }).parseFromString(new TextDecoder().decode(entries['word/document.xml']), 'application/xml')
    if (errors.length || document.documentElement?.localName !== 'document') {
      throw new Error(`Invalid DOCX XML ${name}`)
    }
  }
  if (!fs.readFileSync(path.join(artifactRoot, 'email.md')).equals(Buffer.from(fullMarkdown, 'utf8'))) {
    throw new Error('Markdown attachment is not exact full frontmatter content')
  }
  const assertions = JSON.parse(fs.readFileSync(path.join(artifactRoot, 'assertions.json'), 'utf8'))
  if (assertions.scenario !== 'presentation-output/matrix') throw new Error('Wrong assertion scenario')
  const manifested = Object.keys(assertions.files ?? {}).sort()
  const expectedManifest = expected.filter((name) => name !== 'assertions.json')
  if (JSON.stringify(manifested) !== JSON.stringify(expectedManifest)) {
    throw new Error(`Wrong assertion file manifest: ${manifested.join(',')}`)
  }
  for (const name of manifested) {
    const bytes = fs.readFileSync(path.join(artifactRoot, name))
    const record = assertions.files[name]
    const digest = crypto.createHash('sha256').update(bytes).digest('hex')
    if (record?.bytes !== bytes.length || record?.sha256 !== digest) {
      throw new Error(`Artifact manifest mismatch: ${name}`)
    }
  }
  if (!assertions.passedAssertionGroups.includes('production-pdf-parse-raster')) {
    throw new Error('Raster assertion group missing')
  }
}

async function main() {
  const options = parseArguments(process.argv.slice(2))
  const signalController = createRunSignalController()
  let ownedRoot = null
  let published = null
  let childStarted = false
  let childTreeSettled = false
  let primaryError = null
  try {
    cleanPriorRetention()
    signalController.throwIfInterrupted()
    const runId = crypto.randomBytes(6).toString('hex')
    ownedRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-office-presentation-output-'))
    const userData = path.join(ownedRoot, 'user-data')
    const fixtureRoot = path.join(ownedRoot, 'fixture')
    const stagingRoot = path.join(ownedRoot, 'staging')
    const converterRegistry = path.join(stagingRoot, 'converter-groups')
    const artifactRoot = path.join(ownedRoot, 'artifacts')
    for (const directory of [userData, fixtureRoot, stagingRoot, converterRegistry, artifactRoot]) {
      fs.mkdirSync(directory, { recursive: true, mode: 0o700 })
    }
    const template = FIXTURE_SCENARIOS['presentation-output'].documents[0]
    const fullMarkdown = renderFixtureDocument('presentation-output', template, 1, 1)
    const bodyMarkdown = exactBody(fullMarkdown)
    const descriptor = await descriptorFor(bodyMarkdown)
    signalController.throwIfInterrupted()
    fs.writeFileSync(path.join(fixtureRoot, 'Presentation Output.md'), fullMarkdown, 'utf8')
    const sourcePath = path.join(stagingRoot, 'source.md')
    const fullMarkdownPath = path.join(stagingRoot, 'full-source.md')
    const descriptorPath = path.join(stagingRoot, 'descriptor.json')
    fs.writeFileSync(sourcePath, bodyMarkdown, 'utf8')
    fs.writeFileSync(fullMarkdownPath, fullMarkdown, 'utf8')
    fs.writeFileSync(descriptorPath, `${JSON.stringify(descriptor, null, 2)}\n`, 'utf8')
    await waitAtSignalCheckpoint('pre-child', ownedRoot, signalController)
    signalController.throwIfInterrupted()

    const require = createRequire(import.meta.url)
    const electronExecutable = require('electron')
    const smoke = fileURLToPath(new URL('../../electron/export/submodules/documents/presentation-output-electron-smoke.cjs', import.meta.url))
    const child = spawn(electronExecutable, [smoke], {
      detached: process.platform !== 'win32',
      stdio: 'inherit',
      env: {
        ...process.env,
        OFFICE_PRESENTATION_USER_DATA: userData,
        OFFICE_PRESENTATION_SOURCE: sourcePath,
        OFFICE_PRESENTATION_FULL_MARKDOWN: fullMarkdownPath,
        OFFICE_PRESENTATION_DESCRIPTOR: descriptorPath,
        OFFICE_PRESENTATION_ARTIFACTS: artifactRoot,
        OFFICE_PRESENTATION_STAGING_ROOT: stagingRoot,
        OFFICE_PRESENTATION_CONVERTER_REGISTRY: converterRegistry,
      },
    })
    childStarted = true
    try {
      await waitForChildTree(child, 180_000, {
        registryDirectory: converterRegistry,
        initialSignal: signalController.interrupted,
      })
      childTreeSettled = true
    } catch (error) {
      childTreeSettled = error?.presentationOutputTreeSettled === true
      throw error
    }
    signalController.throwIfInterrupted()
    await waitAtSignalCheckpoint('post-child', ownedRoot, signalController)
    signalController.throwIfInterrupted()
    assertArtifacts(artifactRoot, fullMarkdown)
    signalController.throwIfInterrupted()
    if (options.retain) {
      published = await publishRetention(
        artifactRoot,
        runId,
        ownedRoot,
        signalController,
      )
    }
    await new Promise((resolve) => setImmediate(resolve))
    signalController.throwIfInterrupted()
  } catch (error) {
    primaryError = error
  }

  const cleanupErrors = []
  if (ownedRoot && (!childStarted || childTreeSettled)) {
    try {
      await waitAtSignalCheckpoint(
        'final-cleanup',
        ownedRoot,
        signalController,
        { throwAfter: false },
      )
      await fs.promises.rm(ownedRoot, { recursive: true, force: true })
    } catch (error) {
      cleanupErrors.push(error)
    }
  }
  const injectedCleanupFailureCount = ['1', '2'].includes(
    process.env.OFFICE_PRESENTATION_INJECT_CLEANUP_FAILURES,
  )
    ? Number(process.env.OFFICE_PRESENTATION_INJECT_CLEANUP_FAILURES)
    : 0
  for (let index = 1; index <= injectedCleanupFailureCount; index += 1) {
    cleanupErrors.push(new Error(`Injected presentation cleanup failure ${index}`))
  }
  await new Promise((resolve) => setImmediate(resolve))
  if (!primaryError && signalController.interrupted) {
    primaryError = new Error(
      `Presentation output Electron interrupted by ${signalController.interrupted}`,
    )
  }
  if (published && (primaryError || cleanupErrors.length)) {
    try {
      await fs.promises.rm(published, { recursive: true, force: false })
      published = null
    } catch (error) {
      cleanupErrors.push(error)
    }
  }
  const cleanupError = cleanupErrors.length > 1
    ? new AggregateError(cleanupErrors, 'Presentation output cleanup failed')
    : cleanupErrors[0] ?? null

  if (primaryError && cleanupError) {
    signalController.dispose()
    throw new AggregateError(
      [primaryError, cleanupError],
      'Presentation output cleanup failed after a primary failure',
    )
  }
  if (primaryError) {
    signalController.dispose()
    throw primaryError
  }
  if (cleanupError) {
    signalController.dispose()
    throw cleanupError
  }
  if (published) process.stdout.write(`OFFICE_E2E_RETAINED_ARTIFACTS=${published}\n`)
  signalController.dispose()
}

const invokedAsMain = process.argv[1]
  && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href

if (invokedAsMain) {
  main().catch((error) => {
    process.stderr.write(`${formatError(error)}\n`)
    process.exitCode = 1
  })
}

export {
  discoverPendingConverterGroups,
  formatError,
  reapRegisteredConverterGroups,
  waitForChild,
  waitForChildTree,
}
