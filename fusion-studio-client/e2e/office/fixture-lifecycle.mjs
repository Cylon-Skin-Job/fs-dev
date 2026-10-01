import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn, spawnSync } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

import { copyFilename, getFixtureScenario, renderFixtureDocument } from './fixture-scenarios.mjs'
import {
  OFFICE_E2E_OTHER_MACHINE,
  globalPalettePath,
  localPalettePath,
  resetPaletteSelectorFixture,
} from './palette-selector-fixtures.mjs'
// Shared resource-bound surface (R3/R4). Importing bounds into the staging
// module is the one safe ESM cycle in this harness: harness-bounds.mjs imports
// fixture-lifecycle.mjs for lifetime cleanup, and this module only reads the
// bound values inside function bodies, so both modules finish evaluating before
// any bound is consumed.
import {
  OFFICE_E2E_JANITOR_SWEPT_MARKER,
  OFFICE_E2E_LOW_DISK_MARKER,
  OFFICE_E2E_RESOURCE_MISSING_MARKER,
  OFFICE_E2E_STAGED_BYTES_MARKER,
  officeE2eDiskHeadroomBytes,
} from './harness-bounds.mjs'

export const OFFICE_E2E_MACHINE = 'Office-E2E'
export const OFFICE_E2E_DIAGNOSTIC_TAIL_BYTES = 65_536
export const OFFICE_E2E_WORKSPACES = Object.freeze([
  Object.freeze({
    id: 'office-e2e-a',
    suffix: 'a',
    label: 'Office E2E A',
    icon: 'description',
    description: 'Isolated Office fixture A',
    sortOrder: 0,
    type: 'code',
    ribbonVisible: true,
    ribbonSortOrder: 0,
  }),
  Object.freeze({
    id: 'office-e2e-b',
    suffix: 'b',
    label: 'Office E2E B',
    icon: 'description',
    description: 'Isolated Office fixture B',
    sortOrder: 1,
    type: 'code',
    ribbonVisible: true,
    ribbonSortOrder: 1,
  }),
  Object.freeze({
    id: 'office-e2e-c',
    suffix: 'c',
    label: 'Office E2E C',
    icon: 'description',
    description: 'Isolated Office fixture C',
    sortOrder: 2,
    type: 'code',
    ribbonVisible: true,
    ribbonSortOrder: 2,
  }),
])

const require = createRequire(import.meta.url)
const moduleDirectory = path.dirname(fileURLToPath(import.meta.url))
const repositoryRoot = path.resolve(moduleDirectory, '..', '..', '..')
const clientRoot = path.join(repositoryRoot, 'fusion-studio-client')
const serverRoot = path.join(repositoryRoot, 'fusion-studio-server')
const liveAiRoot = path.join(repositoryRoot, 'ai')
const normalServerDataRoot = path.join(serverRoot, 'data')
const runtimeMarkerName = '.office-e2e-runtime-complete.json'
const fixtureInternals = new WeakMap()
const processLifecycleInternals = new WeakMap()
const retainedOfficeRoots = new Set()
// Process-lifecycle registrations still owned by this process. Parent-loss and
// deadline cleanup enumerate this set so no owned child group or fixture root
// is left behind without an explicit report.
const activeProcessLifecycles = new Set()
let activeFixture = null

function installOfficeDependencyWriteGuard() {
  const fs = require('node:fs')
  const path = require('node:path')
  const { fileURLToPath } = require('node:url')
  const protectedRoots = Object.freeze(
    JSON.parse(process.env.FUSION_OFFICE_E2E_READ_ONLY_ROOTS || '[]')
      .map((candidate) => fs.realpathSync(candidate)),
  )

  function canonicalPath(candidate) {
    const pathname = candidate instanceof URL ? fileURLToPath(candidate) : String(candidate)
    let cursor = path.resolve(pathname)
    const tail = []
    while (!fs.existsSync(cursor)) {
      const parent = path.dirname(cursor)
      if (parent === cursor) break
      tail.unshift(path.basename(cursor))
      cursor = parent
    }
    return path.join(fs.realpathSync(cursor), ...tail)
  }

  function isWithin(candidate, root) {
    const relative = path.relative(root, candidate)
    return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
  }

  function assertWritable(candidate, operation) {
    if (typeof candidate !== 'string' && !Buffer.isBuffer(candidate) && !(candidate instanceof URL)) return
    const canonical = canonicalPath(candidate)
    if (!protectedRoots.some((root) => isWithin(canonical, root))) return
    const error = new Error(`Office E2E blocked ${operation} inside read-only dependency root: ${canonical}`)
    error.code = 'OFFICE_E2E_DEPENDENCY_WRITE'
    throw error
  }

  function flagsCanWrite(flags) {
    if (typeof flags === 'string') return /[+awx]/.test(flags)
    if (!Number.isInteger(flags)) return false
    const writeMask = fs.constants.O_WRONLY
      | fs.constants.O_RDWR
      | fs.constants.O_CREAT
      | fs.constants.O_TRUNC
      | fs.constants.O_APPEND
    return (flags & writeMask) !== 0
  }

  function guardPathMethod(target, name, indexes = [0]) {
    const original = target[name]
    if (typeof original !== 'function') return
    target[name] = function guardedPathMethod(...args) {
      for (const index of indexes) assertWritable(args[index], `fs.${name}`)
      return original.apply(this, args)
    }
  }

  for (const name of [
    'appendFile', 'appendFileSync', 'chmod', 'chmodSync', 'chown', 'chownSync',
    'lchown', 'lchownSync', 'lutimes', 'lutimesSync', 'mkdir', 'mkdirSync',
    'mkdtemp', 'mkdtempSync', 'rm', 'rmSync', 'rmdir', 'rmdirSync', 'truncate',
    'truncateSync', 'unlink', 'unlinkSync', 'utimes', 'utimesSync', 'writeFile',
    'writeFileSync',
  ]) guardPathMethod(fs, name)
  for (const name of ['copyFile', 'copyFileSync', 'cp', 'cpSync', 'link', 'linkSync', 'symlink', 'symlinkSync']) {
    guardPathMethod(fs, name, [1])
  }
  for (const name of ['rename', 'renameSync']) guardPathMethod(fs, name, [0, 1])
  for (const name of ['open', 'openSync']) {
    const original = fs[name]
    fs[name] = function guardedOpen(candidate, flags, ...args) {
      if (flagsCanWrite(flags)) assertWritable(candidate, `fs.${name}`)
      return original.call(this, candidate, flags, ...args)
    }
  }
  const originalCreateWriteStream = fs.createWriteStream
  fs.createWriteStream = function guardedCreateWriteStream(candidate, ...args) {
    assertWritable(candidate, 'fs.createWriteStream')
    return originalCreateWriteStream.call(this, candidate, ...args)
  }
  if (fs.promises) {
    for (const name of [
      'appendFile', 'chmod', 'chown', 'lchown', 'lutimes', 'mkdir', 'mkdtemp', 'rm',
      'rmdir', 'truncate', 'unlink', 'utimes', 'writeFile',
    ]) guardPathMethod(fs.promises, name)
    for (const name of ['copyFile', 'cp', 'link', 'symlink']) guardPathMethod(fs.promises, name, [1])
    guardPathMethod(fs.promises, 'rename', [0, 1])
    const originalOpen = fs.promises.open
    fs.promises.open = function guardedPromisesOpen(candidate, flags, ...args) {
      if (flagsCanWrite(flags)) assertWritable(candidate, 'fs.promises.open')
      return originalOpen.call(this, candidate, flags, ...args)
    }
  }

}

const dependencyWriteGuardBytes = `'use strict'\n;(${installOfficeDependencyWriteGuard.toString()})()\n`

function canonicalExistingPath(candidate) {
  const resolved = path.resolve(candidate)
  let cursor = resolved
  const tail = []
  while (!fs.existsSync(cursor)) {
    const parent = path.dirname(cursor)
    if (parent === cursor) break
    tail.unshift(path.basename(cursor))
    cursor = parent
  }
  const canonicalBase = fs.realpathSync(cursor)
  return path.join(canonicalBase, ...tail)
}

function isWithin(candidate, root) {
  const relative = path.relative(root, candidate)
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
}

function pathSafetyError(message) {
  const error = new Error(message)
  error.code = 'OFFICE_E2E_PATH_SAFETY'
  return error
}

export function assertOfficeFixturePathSafe(candidate) {
  const canonicalCandidate = canonicalExistingPath(candidate)
  const forbiddenRoots = [liveAiRoot, normalServerDataRoot].map(canonicalExistingPath)
  const forbidden = forbiddenRoots.find((root) => isWithin(canonicalCandidate, root))
  if (forbidden) {
    throw pathSafetyError(`Unsafe Office E2E fixture path resolves inside a protected root: ${forbidden}`)
  }
  return canonicalCandidate
}

function assertFixtureOwnedPath(fixture, candidate) {
  const internal = assertFixtureActive(fixture)
  const canonicalRoot = assertOfficeFixturePathSafe(internal.allocatedRoot)
  const canonicalCandidate = assertOfficeFixturePathSafe(candidate)
  if (!isWithin(canonicalCandidate, canonicalRoot)) {
    throw pathSafetyError(`Office E2E fixture path escapes its allocated root: ${canonicalCandidate}`)
  }
  return canonicalCandidate
}

function resetServerModules() {
  const modulePaths = [
    path.join(serverRoot, 'lib', 'workspace', 'registry-service.js'),
    path.join(serverRoot, 'lib', 'db.js'),
  ]
  for (const modulePath of modulePaths) {
    const resolved = require.resolve(modulePath)
    delete require.cache[resolved]
  }
}

function scaffoldOfficeProject({ projectPath, viewIds, machineName }) {
  const readiness = require(path.join(serverRoot, 'lib', 'views', 'readiness-runtime.js'))
  const { createViewReadinessCoordinator } = require(
    path.join(serverRoot, 'lib', 'views', 'readiness-coordinator.js'),
  )
  readiness.installViewReadinessOwner(createViewReadinessCoordinator({
    machineIdentity: machineName,
    migrationService: {
      ensureReady: async () => {
        throw new Error('Office fixture registered readiness is installed by its isolated server')
      },
    },
  }))
  const createService = require(path.join(serverRoot, 'lib', 'workspace', 'create-service.js'))
  return createService.scaffoldProject({ projectPath, viewIds, machineName })
}

export function createOfficePlaywrightRunPaths(requestedRoot) {
  const safeTemporaryRoot = assertOfficeFixturePathSafe(os.tmpdir())
  const root = requestedRoot
    ? validateRequestedFixtureRoot(requestedRoot)
    : path.join(safeTemporaryRoot, `fusion-office-e2e-${randomUUID()}`)
  return Object.freeze({
    root,
    outputDir: path.join(root, 'playwright-output'),
  })
}

function validateRequestedFixtureRoot(candidate) {
  if (typeof candidate !== 'string' || !path.isAbsolute(candidate)) {
    throw new Error('Office fixture root must be an absolute path')
  }
  const safeTemporaryRoot = assertOfficeFixturePathSafe(os.tmpdir())
  const safeCandidate = assertOfficeFixturePathSafe(candidate)
  if (path.dirname(safeCandidate) !== safeTemporaryRoot || !path.basename(safeCandidate).startsWith('fusion-office-e2e-')) {
    throw pathSafetyError('Office fixture root must be a direct fusion-office-e2e child of the temporary directory')
  }
  return safeCandidate
}

// Ownership lease for the stale-root sweep: the run that created a root keeps
// its pid here so a later suite start can distinguish an abandoned root from a
// live one without following anything inside the directory.
function writeOfficeFixtureOwnerFile(root) {
  fs.writeFileSync(
    path.join(root, officeE2eOwnerFileName),
    `${JSON.stringify({ pid: process.pid, startedAt: Date.now() })}\n`,
    { flag: 'w', mode: 0o600 },
  )
}

function createFixtureRoot(requestedRoot) {
  const safeTemporaryRoot = assertOfficeFixturePathSafe(os.tmpdir())
  const root = requestedRoot
    ? validateRequestedFixtureRoot(requestedRoot)
    : fs.mkdtempSync(path.join(safeTemporaryRoot, 'fusion-office-e2e-'))
  if (requestedRoot) fs.mkdirSync(root, { mode: 0o700 })
  writeOfficeFixtureOwnerFile(root)
  return assertOfficeFixturePathSafe(root)
}

function workspacePaths(root, workspaces) {
  return Object.fromEntries(workspaces.map((workspace) => [
    workspace.suffix,
    assertOfficeFixturePathSafe(path.join(root, `workspace-${workspace.suffix}`)),
  ]))
}

function scenarioDocumentPath(workspaceRoot, filename, machineName = OFFICE_E2E_MACHINE) {
  return path.join(workspaceRoot, 'ai', machineName, 'Office', '001-Fixtures', filename)
}

function resolveScenarioSelection(scenarioId, options) {
  const copies = options.copies ?? 1
  if (!Number.isInteger(copies) || copies < 1 || copies > 32) {
    throw new Error('Office fixture copies must be an integer from 1 through 32')
  }
  const scenario = getFixtureScenario(scenarioId)
  const requestedVariant = options.variant
  const variant = requestedVariant ?? (scenarioId === 'palette' ? 'global-selected' : null)
  if (variant !== null && !scenario.variants.includes(variant)) {
    throw new Error(`Unknown Office fixture ${scenarioId} variant: ${variant}`)
  }
  return { copies, scenario, variant }
}

export function validateOfficeFixtureOptions(options = {}) {
  const workspaceCount = options.workspaces ?? 1
  if (!Number.isInteger(workspaceCount) || workspaceCount < 1 || workspaceCount > 3) {
    throw new Error('Office fixture workspace count must be 1, 2, or 3')
  }
  const scenarioId = options.scenario ?? 'basic'
  const selection = resolveScenarioSelection(scenarioId, {
    copies: options.copies,
    variant: options.variant,
  })
  if (selection.scenario.requiredWorkspaces !== undefined
    && workspaceCount !== selection.scenario.requiredWorkspaces) {
    throw new Error(
      `Office fixture ${scenarioId} requires --workspaces=${selection.scenario.requiredWorkspaces}`,
    )
  }
  const selectedWorkspaces = OFFICE_E2E_WORKSPACES.slice(0, workspaceCount)
  assertScenarioWorkspacesAvailable(
    selection.scenario,
    Object.fromEntries(selectedWorkspaces.map(({ suffix }) => [suffix, true])),
  )
  const validated = {
    copies: selection.copies,
    scenario: scenarioId,
    workspaces: workspaceCount,
  }
  if (options.root !== undefined) validated.root = validateRequestedFixtureRoot(options.root)
  if (selection.variant !== null) validated.variant = selection.variant
  return Object.freeze(validated)
}

function assertScenarioWorkspacesAvailable(scenario, workspaceRoots) {
  const unavailableWorkspace = scenario.documents.find(({ workspace }) => !workspaceRoots[workspace])?.workspace
  if (unavailableWorkspace) {
    throw new Error(`Scenario requires unavailable workspace ${unavailableWorkspace}`)
  }
}

function assertFixtureActive(fixture) {
  const internal = fixture && fixtureInternals.get(fixture)
  if (!internal || internal.closed || internal.teardownStarted) throw new Error('Office fixture is not active')
  return internal
}

async function seedRegistry(db, registry, workspaces, paths) {
  for (const existing of await registry.list()) await registry.remove(existing.id)
  for (const workspace of workspaces) {
    await registry.add({ ...workspace, repoPath: paths[workspace.suffix] })
  }
  await db('system_config')
    .insert({
      key: 'last_active_workspace_id',
      value: OFFICE_E2E_WORKSPACES[0].id,
      updated_at: Date.now(),
    })
    .onConflict('key')
    .merge(['value', 'updated_at'])
}

function resetOfficeScenarioFiles(fixtureRoot, appUserData, workspaceRoots, scenarioId, options) {
  const { copies, scenario, variant } = resolveScenarioSelection(scenarioId, options)
  const canonicalRoot = assertOfficeFixturePathSafe(fixtureRoot)
  assertScenarioWorkspacesAvailable(scenario, workspaceRoots)
  const assertOwned = (candidate) => {
    const canonicalCandidate = assertOfficeFixturePathSafe(candidate)
    if (!isWithin(canonicalCandidate, canonicalRoot)) {
      throw pathSafetyError(`Office E2E fixture path escapes its allocated root: ${canonicalCandidate}`)
    }
    return canonicalCandidate
  }
  const scenarioMachines = variant === 'machine-move'
    ? [OFFICE_E2E_MACHINE, OFFICE_E2E_OTHER_MACHINE]
    : [OFFICE_E2E_MACHINE]
  const resetTargets = Object.values(workspaceRoots).flatMap((workspaceRoot) => (
    scenarioMachines.map((machineName) => ({
      documentsRoot: path.join(workspaceRoot, 'ai', machineName, 'Office', '001-Fixtures'),
      viewStatePath: path.join(
        workspaceRoot,
        'ai',
        machineName,
        'System',
        'Views',
        '001-office-viewer',
        'state',
        'state.json',
      ),
    }))
  ))
  for (const { documentsRoot, viewStatePath } of resetTargets) {
    assertOwned(documentsRoot)
    assertOwned(viewStatePath)
  }
  for (const { documentsRoot, viewStatePath } of resetTargets) {
    let viewState = {}
    try {
      const parsed = JSON.parse(fs.readFileSync(viewStatePath, 'utf8'))
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) viewState = parsed
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
    }
    fs.mkdirSync(path.dirname(viewStatePath), { recursive: true })
    fs.writeFileSync(viewStatePath, `${JSON.stringify({
      ...viewState,
      officeViewerMode: 'home',
      officeViewerCurrentFolder: null,
      officeViewerSelectedPath: null,
    }, null, 2)}\n`, { encoding: 'utf8', flag: 'w' })
    fs.rmSync(documentsRoot, { recursive: true, force: true })
  }
  const stalePaletteFiles = [globalPalettePath(appUserData)]
  for (const workspaceRoot of Object.values(workspaceRoots)) {
    stalePaletteFiles.push(
      localPalettePath(workspaceRoot, OFFICE_E2E_MACHINE),
      localPalettePath(workspaceRoot, OFFICE_E2E_OTHER_MACHINE),
    )
  }
  for (const candidate of stalePaletteFiles) {
    assertOwned(candidate)
    fs.rmSync(candidate, { force: true })
  }

  const files = []
  for (const template of scenario.documents) {
    const workspaceRoot = workspaceRoots[template.workspace]
    const documentsRoot = path.join(workspaceRoot, 'ai', OFFICE_E2E_MACHINE, 'Office', '001-Fixtures')
    fs.mkdirSync(documentsRoot, { recursive: true })
    for (let copy = 1; copy <= copies; copy += 1) {
      const filename = copyFilename(template.filename, copy, copies)
      const filePath = scenarioDocumentPath(workspaceRoot, filename)
      assertOwned(filePath)
      const bytes = renderFixtureDocument(scenarioId, template, copy, copies, variant)
      fs.writeFileSync(filePath, bytes, { encoding: 'utf8', flag: 'w' })
      if (variant === 'machine-move') {
        const transportedPath = scenarioDocumentPath(workspaceRoot, filename, OFFICE_E2E_OTHER_MACHINE)
        assertOwned(transportedPath)
        fs.mkdirSync(path.dirname(transportedPath), { recursive: true })
        fs.writeFileSync(transportedPath, bytes, { encoding: 'utf8', flag: 'w' })
      }
      files.push(Object.freeze({
        workspaceId: `office-e2e-${template.workspace}`,
        filename,
        fileId: `${template.workspace}:${filename}`,
        path: filePath,
      }))
    }
  }

  let paletteFiles = Object.freeze([])
  const paletteVariant = scenarioId === 'palette' ? variant : scenario.paletteVariant
  if (paletteVariant) {
    paletteFiles = resetPaletteSelectorFixture({
      appUserData,
      assertOwned,
      machineName: OFFICE_E2E_MACHINE,
      variant: paletteVariant,
      workspaceRoots,
    })
  }
  return Object.freeze({
    files: Object.freeze(files),
    paletteFiles,
    scenario: scenarioId,
    variant,
  })
}

export async function resetOfficeFixtureScenario(fixture, scenarioId = 'basic', options = {}) {
  const internal = assertFixtureActive(fixture)
  const reset = resetOfficeScenarioFiles(
    internal.allocatedRoot,
    fixture.appUserData,
    fixture.workspaceRoots,
    scenarioId,
    options,
  )
  fixture.scenario = reset.scenario
  fixture.variant = reset.variant
  fixture.scenarioFiles = reset.files
  fixture.scenarioPaletteFiles = reset.paletteFiles
  return fixture.scenarioFiles
}

export async function resetOfficePlaywrightScenario(options = {}) {
  const fixtureRoot = process.env.FUSION_OFFICE_E2E_FIXTURE_ROOT
  if (!fixtureRoot) throw new Error('FUSION_OFFICE_E2E_FIXTURE_ROOT is not set')
  const workspaceCount = options.workspaces ?? Number(process.env.FUSION_OFFICE_E2E_WORKSPACES ?? '1')
  const scenario = options.scenario ?? process.env.FUSION_OFFICE_E2E_SCENARIO ?? 'basic'
  const copies = options.copies ?? Number(process.env.FUSION_OFFICE_E2E_COPIES ?? '1')
  const variant = options.variant ?? process.env.FUSION_OFFICE_E2E_VARIANT
  const validated = validateOfficeFixtureOptions({ copies, scenario, variant, workspaces: workspaceCount })
  const selected = OFFICE_E2E_WORKSPACES.slice(0, validated.workspaces)
  const workspaceRoots = workspacePaths(validateRequestedFixtureRoot(fixtureRoot), selected)
  const reset = resetOfficeScenarioFiles(fixtureRoot, path.join(fixtureRoot, 'user-data'), workspaceRoots, validated.scenario, {
    copies: validated.copies,
    variant: validated.variant,
  })
  return reset.files
}

export async function createOfficeFixture(options = {}) {
  const validated = validateOfficeFixtureOptions(options)
  const workspaceCount = validated.workspaces
  const scenarioId = validated.scenario
  const selectedWorkspaces = OFFICE_E2E_WORKSPACES.slice(0, workspaceCount)
  if (activeFixture) throw new Error('An Office fixture is already active in this process')
  // R3: the disk preflight runs before the fixture root is allocated, so a
  // low-disk machine creates no owned directory at all.
  assertOfficeE2eDiskHeadroom({ environment: process.env })

  const root = createFixtureRoot(validated.root)
  const priorEnvironment = {
    appUserData: process.env.FUSION_APP_USER_DATA,
    localMachine: process.env.FUSION_LOCAL_MACHINE,
  }
  const appUserData = assertOfficeFixturePathSafe(path.join(root, 'user-data'))
  const paths = workspacePaths(root, selectedWorkspaces)
  const fixture = {
    root,
    appUserData,
    machineName: OFFICE_E2E_MACHINE,
    workspaceRoots: paths,
    workspaceIds: Object.freeze(selectedWorkspaces.map(({ id }) => id)),
    scenario: null,
    variant: null,
    scenarioFiles: Object.freeze([]),
    scenarioPaletteFiles: Object.freeze([]),
    dbPath: path.join(appUserData, 'server-data', 'fusion.db'),
  }
  fixtureInternals.set(fixture, {
    allocatedRoot: root,
    closed: false,
    dbModule: null,
    destroying: false,
    capturedModes: new Map(),
    priorEnvironment,
    teardownStarted: false,
  })
  activeFixture = fixture

  if (process.env.FUSION_OFFICE_E2E_SETUP_SIGNAL_PROBE === '1') {
    console.log(`OFFICE_E2E_SETUP_PROBE_ROOT=${fixture.root}`)
    console.log(`OFFICE_E2E_SETUP_PROBE_PID=${process.pid}`)
    await new Promise(() => setInterval(() => {}, 1_000))
  }

  try {
    process.env.FUSION_APP_USER_DATA = appUserData
    process.env.FUSION_LOCAL_MACHINE = OFFICE_E2E_MACHINE
    for (const workspace of selectedWorkspaces) {
      assertOfficeFixturePathSafe(paths[workspace.suffix])
      scaffoldOfficeProject({
        projectPath: paths[workspace.suffix],
        viewIds: ['office-viewer'],
        machineName: OFFICE_E2E_MACHINE,
      })
      if (scenarioId === 'palette' && validated.variant === 'machine-move') {
        scaffoldOfficeProject({
          projectPath: paths[workspace.suffix],
          viewIds: ['office-viewer'],
          machineName: OFFICE_E2E_OTHER_MACHINE,
        })
      }
    }

    resetServerModules()
    const dbModule = require(path.join(serverRoot, 'lib', 'db.js'))
    const registry = require(path.join(serverRoot, 'lib', 'workspace', 'registry-service.js'))
    fixtureInternals.get(fixture).dbModule = dbModule
    const db = await dbModule.initDb()
    await seedRegistry(db, registry, selectedWorkspaces, paths)
    await resetOfficeFixtureScenario(fixture, scenarioId, {
      copies: options.copies ?? 1,
      variant: options.variant,
    })

    fixture.registryRows = Object.freeze(await registry.list())
    fixture.lastActiveWorkspaceId = (await db('system_config').where('key', 'last_active_workspace_id').first())?.value ?? null
    return fixture
  } catch (setupError) {
    try {
      await destroyOfficeFixture(fixture)
    } catch (firstCleanupError) {
      try {
        await destroyOfficeFixture(fixture)
      } catch (retryCleanupError) {
        const aggregate = new AggregateError(
          [setupError, firstCleanupError, retryCleanupError],
          'Office fixture setup failed and cleanup could not complete',
          { cause: setupError },
        )
        Object.defineProperty(aggregate, 'fixture', { value: fixture })
        throw aggregate
      }
    }
    throw setupError
  }
}

export function captureOfficeFixtureMode(fixture, candidate) {
  const internal = assertFixtureActive(fixture)
  const safePath = assertFixtureOwnedPath(fixture, candidate)
  if (!internal.capturedModes.has(safePath)) {
    internal.capturedModes.set(safePath, fs.statSync(safePath).mode & 0o7777)
  }
  return internal.capturedModes.get(safePath)
}

const ownedCacheDirectories = new Set(['.cache', '.tmp', '.vite', '.vite-temp'])
// Keep the isolated server clone aligned with package.json's packaged-server filter.
// Electron's separately packaged resource model remains part of the owned client clone.
const packagedServerNodeModuleExclusion = /^nodejs-whisper\/cpp\/whisper\.cpp\/models\/[^/]+\.bin$/

function isPackagedServerNodeModuleExclusion(relative) {
  return packagedServerNodeModuleExclusion.test(relative)
}

// Runtime staging must not duplicate large owned bytes. APFS copy-on-write is
// requested explicitly for large files; Node's plain `COPYFILE_FICLONE` silently
// falls back to a real byte copy on this platform, so the staged runtime grew by
// gigabytes per run and interrupted runs left that behind. Small files keep the
// ordinary copy path.
const OFFICE_E2E_LARGE_CLONE_FILE_MIN_BYTES = 4 * 1024 * 1024
const officeE2eOwnerFileName = '.office-e2e-owner.json'

function removeDestinationFile(destination) {
  try {
    fs.rmSync(destination, { force: true })
  } catch {
    // Best-effort: the caller falls through to another copy strategy.
  }
}

// Copy one owned file, preferring a genuine copy-on-write clone for large files:
// `COPYFILE_FICLONE_FORCE`, then macOS `cp -c`, then an ordinary copy. The mode
// is always applied explicitly so permission parity is preserved. Returns the
// strategy used (observability/testing only; callers ignore it).
export function cloneFilePreservingMode(source, destination, mode) {
  if (fs.lstatSync(source).size >= OFFICE_E2E_LARGE_CLONE_FILE_MIN_BYTES) {
    try {
      fs.copyFileSync(source, destination, fs.constants.COPYFILE_FICLONE_FORCE)
      fs.chmodSync(destination, mode)
      return 'ficlone_force'
    } catch {
      removeDestinationFile(destination)
    }
    if (process.platform === 'darwin') {
      const result = spawnSync('/bin/cp', ['-c', '--', source, destination], { stdio: 'ignore' })
      if (result.status === 0 && fs.existsSync(destination)) {
        fs.chmodSync(destination, mode)
        return 'cp_c'
      }
      removeDestinationFile(destination)
    }
  }
  fs.copyFileSync(source, destination, fs.constants.COPYFILE_FICLONE)
  fs.chmodSync(destination, mode)
  return 'copy'
}

// One traversal shared by the runtime clone and the pre-staging inventory walk.
// `visit` is called pre-order, so directory handlers can create the destination
// before their children are visited. Keeping clone and measurement on the same
// walk is what guarantees the preflight byte count matches what staging copies.
function walkOwnedTree(source, relative, excludedPaths, excludePath, visit) {
  const stat = fs.lstatSync(source)
  if (stat.isDirectory()) {
    visit({ kind: 'directory', relative, source, stat })
    for (const name of fs.readdirSync(source).sort()) {
      const childRelative = relative ? `${relative}/${name}` : name
      if (excludedPaths.has(childRelative) || excludePath(childRelative)) continue
      walkOwnedTree(path.join(source, name), childRelative, excludedPaths, excludePath, visit)
    }
    return
  }
  if (stat.isSymbolicLink()) {
    visit({ kind: 'symlink', relative, source, stat })
    return
  }
  if (!stat.isFile()) throw new Error(`Unsupported Office runtime clone entry: ${source}`)
  visit({ kind: 'file', relative, source, stat })
}

// Clone one owned tree, returning the logical bytes of every file written. The
// return value feeds the R3 `OFFICE_E2E_STAGED_BYTES` report without a second
// walk of the staged result.
function cloneOwnedTree(sourceRoot, destinationRoot, excludedPaths = new Set(), excludePath = () => false) {
  let logicalBytes = 0
  walkOwnedTree(sourceRoot, '', excludedPaths, excludePath, ({ kind, relative, source, stat }) => {
    const destination = relative ? path.join(destinationRoot, relative) : destinationRoot
    if (kind === 'directory') {
      fs.mkdirSync(destination, { mode: stat.mode, recursive: true })
      fs.chmodSync(destination, stat.mode)
      return
    }
    if (kind === 'symlink') {
      fs.symlinkSync(fs.readlinkSync(source), destination)
      if (typeof fs.lchmodSync === 'function') fs.lchmodSync(destination, stat.mode)
      return
    }
    cloneFilePreservingMode(source, destination, stat.mode)
    logicalBytes += stat.size
  })
  return logicalBytes
}

// The clone inventory: every file the runtime staging walk would copy, in the
// same order, with its logical size. `key` is a stable clone-destination bucket
// so callers can materialize a subset without relative-path collisions.
function officeRuntimeCloneInventory() {
  const inventory = []
  const collect = (key, sourceRoot, excludedPaths = new Set(), excludePath = () => false) => {
    walkOwnedTree(sourceRoot, '', excludedPaths, excludePath, ({ kind, relative, source, stat }) => {
      if (kind !== 'file') return
      inventory.push(Object.freeze({ key, relative, size: stat.size, source }))
    })
  }
  collect('server-lib', path.join(serverRoot, 'lib'))
  collect('server-node-modules', path.join(serverRoot, 'node_modules'), ownedCacheDirectories, isPackagedServerNodeModuleExclusion)
  collect('client-electron', path.join(clientRoot, 'electron'))
  collect('client-public', path.join(clientRoot, 'public'))
  collect('client-src', path.join(clientRoot, 'src'))
  collect('client-node-modules', path.join(clientRoot, 'node_modules'), ownedCacheDirectories)
  return Object.freeze(inventory)
}

// The logical bytes of every file runtime staging will write, plus the small
// root files and the dependency write guard. The source trees rarely change
// within one harness process, so the walk is memoized; pass `{ fresh: true }`
// to bypass the memo and compare against the live source at assertion time.
let stagedLogicalBytesMeasurement = null
export function measureOfficeRuntimeStagedLogicalBytes(options = {}) {
  if (options.fresh !== true && stagedLogicalBytesMeasurement !== null) {
    return stagedLogicalBytesMeasurement
  }
  let total = Buffer.byteLength(dependencyWriteGuardBytes)
  for (const entry of officeRuntimeCloneInventory()) total += entry.size
  for (const filename of serverRootFiles) total += fs.lstatSync(path.join(serverRoot, filename)).size
  for (const filename of clientRootFiles) total += fs.lstatSync(path.join(clientRoot, filename)).size
  stagedLogicalBytesMeasurement = total
  return total
}

// Owned files large enough for the clone path (R3 CoW probe). Excludes the
// packaged whisper model exactly as staging does.
export function listOfficeRuntimeCloneCandidates(minimumBytes = OFFICE_E2E_LARGE_CLONE_FILE_MIN_BYTES) {
  if (!Number.isSafeInteger(minimumBytes) || minimumBytes < 0) {
    throw new TypeError('Office runtime clone candidates require a non-negative minimum byte size')
  }
  return Object.freeze(
    officeRuntimeCloneInventory()
      .filter((entry) => entry.size >= minimumBytes)
      .map((entry) => Object.freeze({ ...entry })),
  )
}

// R3 disk preflight: free space must cover the planned staged logical bytes plus
// the configured headroom. Called before the fixture root is allocated and again
// before any (re)staging, so an under-resourced machine fails with a stable
// marker before a single owned byte is written.
export function assertOfficeE2eDiskHeadroom(options = {}) {
  const environment = options.environment ?? process.env
  const stagedBytes = options.stagedBytes ?? measureOfficeRuntimeStagedLogicalBytes()
  const headroomBytes = options.headroomBytes ?? officeE2eDiskHeadroomBytes(environment)
  if (!Number.isFinite(stagedBytes) || stagedBytes < 0 || !Number.isFinite(headroomBytes) || headroomBytes < 0) {
    throw new TypeError('Office E2E disk preflight requires non-negative staged and headroom byte counts')
  }
  const requiredBytes = stagedBytes + headroomBytes
  const stats = fs.statfsSync(assertOfficeFixturePathSafe(os.tmpdir()))
  const freeBytes = stats.bavail * stats.bsize
  if (freeBytes < requiredBytes) {
    console.log(`${OFFICE_E2E_LOW_DISK_MARKER} free_bytes=${freeBytes} required_bytes=${requiredBytes}`)
    const error = new Error(
      `Office E2E staging requires ${requiredBytes} free bytes (staged=${stagedBytes} headroom=${headroomBytes}) but only ${freeBytes} are available`,
    )
    error.code = OFFICE_E2E_LOW_DISK_MARKER
    error.freeBytes = freeBytes
    error.headroomBytes = headroomBytes
    error.requiredBytes = requiredBytes
    error.stagedBytes = stagedBytes
    throw error
  }
  return Object.freeze({ freeBytes, headroomBytes, requiredBytes, stagedBytes })
}

function assertTreeSymlinksContained(root) {
  const canonicalRoot = fs.realpathSync(root)
  function visit(candidate) {
    const stat = fs.lstatSync(candidate)
    if (stat.isSymbolicLink()) {
      const target = fs.realpathSync(candidate)
      if (!isWithin(target, canonicalRoot)) {
        throw new Error(`Office runtime symlink escapes fixture-owned clone: ${candidate} -> ${target}`)
      }
      return
    }
    if (stat.isDirectory()) {
      for (const name of fs.readdirSync(candidate)) visit(path.join(candidate, name))
    }
  }
  visit(root)
}

function runtimeLayoutResult(runtimeRoot) {
  const runtimeServerRoot = path.join(runtimeRoot, 'fusion-studio-server')
  const runtimeClientRoot = path.join(runtimeRoot, 'fusion-studio-client')
  return Object.freeze({
    dependencyWriteGuard: path.join(runtimeRoot, 'dependency-write-guard.cjs'),
    runtimeClientRoot,
    runtimeRoot,
    runtimeServerRoot,
    serverEntry: path.join(runtimeServerRoot, 'server.js'),
  })
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

function treeIdentity(root, excludedPaths = new Set(), excludePath = () => false) {
  const hash = createHash('sha256')
  const buffer = Buffer.allocUnsafe(1024 * 1024)
  function updateFile(candidate) {
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
  }
  function visit(candidate, relative) {
    const stat = fs.lstatSync(candidate)
    if (stat.isDirectory()) {
      hash.update(`directory\0${relative}\0${stat.mode & 0o7777}\0`)
      for (const name of fs.readdirSync(candidate).sort()) {
        const childRelative = relative ? `${relative}/${name}` : name
        if (excludedPaths.has(childRelative) || excludePath(childRelative)) continue
        visit(path.join(candidate, name), childRelative)
      }
      return
    }
    if (stat.isSymbolicLink()) {
      hash.update(`symlink\0${relative}\0${stat.mode & 0o7777}\0${fs.readlinkSync(candidate)}\0`)
      return
    }
    if (!stat.isFile()) throw new Error(`Unsupported Office runtime tree entry: ${candidate}`)
    hash.update(`file\0${relative}\0${stat.mode & 0o7777}\0`)
    updateFile(candidate)
    hash.update('\0')
  }
  visit(root, '')
  return hash.digest('hex')
}

const serverRootFiles = Object.freeze(['package.json', 'package-lock.json', 'server.js'])
const clientRootFiles = Object.freeze([
  'index.html',
  'package.json',
  'package-lock.json',
  'tsconfig.json',
  'tsconfig.app.json',
  'tsconfig.node.json',
  'vite.config.ts',
])

function runtimeIdentity(runtime) {
  const files = [
    [runtime.dependencyWriteGuard, Buffer.from(dependencyWriteGuardBytes), 0o666 & ~process.umask()],
    ...serverRootFiles.map((filename) => [
      path.join(runtime.runtimeServerRoot, filename),
      fs.readFileSync(path.join(serverRoot, filename)),
      fs.lstatSync(path.join(serverRoot, filename)).mode & 0o7777,
    ]),
    ...clientRootFiles.map((filename) => [
      path.join(runtime.runtimeClientRoot, filename),
      fs.readFileSync(path.join(clientRoot, filename)),
      fs.lstatSync(path.join(clientRoot, filename)).mode & 0o7777,
    ]),
  ]
  return {
    files: Object.fromEntries(files.map(([filename, expectedBytes, expectedMode]) => {
      const stat = fs.lstatSync(filename)
      return [
        path.relative(runtime.runtimeRoot, filename),
        {
          actual: stat.isFile() && !stat.isSymbolicLink()
            ? `${sha256(fs.readFileSync(filename))}:${stat.mode & 0o7777}`
            : null,
          expected: `${sha256(expectedBytes)}:${expectedMode}`,
        },
      ]
    })),
    trees: {
      'fusion-studio-client/electron': {
        actual: treeIdentity(path.join(runtime.runtimeClientRoot, 'electron')),
        expected: treeIdentity(path.join(clientRoot, 'electron')),
      },
      'fusion-studio-client/node_modules': {
        actual: treeIdentity(path.join(runtime.runtimeClientRoot, 'node_modules'), ownedCacheDirectories),
        expected: treeIdentity(path.join(clientRoot, 'node_modules'), ownedCacheDirectories),
      },
      'fusion-studio-client/public': {
        actual: treeIdentity(path.join(runtime.runtimeClientRoot, 'public')),
        expected: treeIdentity(path.join(clientRoot, 'public')),
      },
      'fusion-studio-client/src': {
        actual: treeIdentity(path.join(runtime.runtimeClientRoot, 'src')),
        expected: treeIdentity(path.join(clientRoot, 'src')),
      },
      'fusion-studio-server/lib': {
        actual: treeIdentity(path.join(runtime.runtimeServerRoot, 'lib')),
        expected: treeIdentity(path.join(serverRoot, 'lib')),
      },
      'fusion-studio-server/node_modules': {
        actual: treeIdentity(
          path.join(runtime.runtimeServerRoot, 'node_modules'),
          ownedCacheDirectories,
          isPackagedServerNodeModuleExclusion,
        ),
        expected: treeIdentity(
          path.join(serverRoot, 'node_modules'),
          ownedCacheDirectories,
          isPackagedServerNodeModuleExclusion,
        ),
      },
    },
  }
}

function runtimeExpectedMarker(runtime) {
  const identity = runtimeIdentity(runtime)
  return { identity, version: 4 }
}

function runtimeIdentityMatches(identity) {
  return Object.values(identity.files).every(({ actual, expected }) => actual === expected)
    && Object.values(identity.trees).every(({ actual, expected }) => actual === expected)
}

function runtimeSourceMatchesMarker(runtime, marker) {
  const sourceFiles = [
    ...serverRootFiles.map((filename) => [
      path.join(runtime.runtimeServerRoot, filename),
      path.join(serverRoot, filename),
    ]),
    ...clientRootFiles.map((filename) => [
      path.join(runtime.runtimeClientRoot, filename),
      path.join(clientRoot, filename),
    ]),
  ]
  for (const [runtimeFile, sourceFile] of sourceFiles) {
    const stat = fs.lstatSync(sourceFile)
    const current = `${sha256(fs.readFileSync(sourceFile))}:${stat.mode & 0o7777}`
    const relative = path.relative(runtime.runtimeRoot, runtimeFile)
    if (marker.identity.files[relative]?.expected !== current) return false
  }
  const sourceTrees = {
    'fusion-studio-client/electron': treeIdentity(path.join(clientRoot, 'electron')),
    'fusion-studio-client/node_modules': treeIdentity(path.join(clientRoot, 'node_modules'), ownedCacheDirectories),
    'fusion-studio-client/public': treeIdentity(path.join(clientRoot, 'public')),
    'fusion-studio-client/src': treeIdentity(path.join(clientRoot, 'src')),
    'fusion-studio-server/lib': treeIdentity(path.join(serverRoot, 'lib')),
    'fusion-studio-server/node_modules': treeIdentity(
      path.join(serverRoot, 'node_modules'),
      ownedCacheDirectories,
      isPackagedServerNodeModuleExclusion,
    ),
  }
  return Object.entries(sourceTrees)
    .every(([name, current]) => marker.identity.trees[name]?.expected === current)
}

function validRuntimeLayout(fixture, runtimeRoot) {
  try {
    const marker = JSON.parse(fs.readFileSync(path.join(runtimeRoot, runtimeMarkerName), 'utf8'))
    const runtime = runtimeLayoutResult(runtimeRoot)
    const expectedMarker = runtimeExpectedMarker(runtime)
    if (!runtimeIdentityMatches(expectedMarker.identity)) return false
    if (JSON.stringify(marker) !== JSON.stringify(expectedMarker)) return false
    for (const candidate of [
      path.join(runtime.runtimeServerRoot, 'lib'),
      path.join(runtime.runtimeServerRoot, 'node_modules', '.tmp'),
      path.join(runtime.runtimeClientRoot, 'electron'),
      path.join(runtime.runtimeClientRoot, 'src'),
      path.join(runtime.runtimeClientRoot, 'node_modules', '.tmp'),
      path.join(runtime.runtimeClientRoot, 'node_modules', '.vite-temp'),
    ]) {
      assertFixtureOwnedPath(fixture, candidate)
      if (!fs.lstatSync(candidate).isDirectory() || fs.lstatSync(candidate).isSymbolicLink()) return false
    }
    const resources = path.join(runtime.runtimeClientRoot, 'electron', 'resources')
    if (!fs.lstatSync(resources).isDirectory() || fs.lstatSync(resources).isSymbolicLink()) return false
    for (const tree of [
      path.join(runtime.runtimeServerRoot, 'node_modules'),
      path.join(runtime.runtimeClientRoot, 'node_modules'),
      resources,
    ]) assertTreeSymlinksContained(tree)
    return fs.statSync(path.join(runtime.runtimeClientRoot, 'node_modules')).isDirectory()
      && !fs.lstatSync(path.join(runtime.runtimeClientRoot, 'node_modules')).isSymbolicLink()
      && fs.statSync(path.join(runtime.runtimeServerRoot, 'node_modules')).isDirectory()
      && !fs.lstatSync(path.join(runtime.runtimeServerRoot, 'node_modules')).isSymbolicLink()
  } catch {
    return false
  }
}

export function createOfficeRuntimeLayout(fixture) {
  assertFixtureActive(fixture)
  const runtimeRoot = assertFixtureOwnedPath(fixture, path.join(fixture.root, 'runtime'))
  if (validRuntimeLayout(fixture, runtimeRoot)) return runtimeLayoutResult(runtimeRoot)
  if (fs.existsSync(runtimeRoot)) fs.rmSync(runtimeRoot, { recursive: true, force: true })

  // R3: never begin staging without room for the planned staged bytes plus
  // headroom. The fixture root already exists, so this is the re-staging guard;
  // createOfficeFixture runs the same preflight before allocating anything.
  assertOfficeE2eDiskHeadroom({ environment: process.env })

  const stagingRoot = assertFixtureOwnedPath(
    fixture,
    path.join(fixture.root, `runtime-staging-${randomUUID()}`),
  )
  const runtime = runtimeLayoutResult(stagingRoot)
  let stagedLogicalBytes = 0
  try {
    fs.mkdirSync(stagingRoot)
    stagedLogicalBytes += cloneOwnedTree(path.join(serverRoot, 'lib'), path.join(runtime.runtimeServerRoot, 'lib'))
    for (const filename of serverRootFiles) {
      const source = path.join(serverRoot, filename)
      fs.copyFileSync(source, path.join(runtime.runtimeServerRoot, filename))
      stagedLogicalBytes += fs.lstatSync(source).size
    }
    fs.mkdirSync(path.join(runtime.runtimeServerRoot, 'data'), { recursive: true })
    stagedLogicalBytes += cloneOwnedTree(
      path.join(serverRoot, 'node_modules'),
      path.join(runtime.runtimeServerRoot, 'node_modules'),
      ownedCacheDirectories,
      isPackagedServerNodeModuleExclusion,
    )
    for (const directory of ownedCacheDirectories) {
      fs.mkdirSync(path.join(runtime.runtimeServerRoot, 'node_modules', directory))
    }

    for (const directory of ['electron', 'public', 'src']) {
      const source = path.join(clientRoot, directory)
      const destination = path.join(runtime.runtimeClientRoot, directory)
      stagedLogicalBytes += cloneOwnedTree(source, destination)
    }
    for (const filename of clientRootFiles) {
      const source = path.join(clientRoot, filename)
      fs.copyFileSync(source, path.join(runtime.runtimeClientRoot, filename))
      stagedLogicalBytes += fs.lstatSync(source).size
    }
    stagedLogicalBytes += cloneOwnedTree(
      path.join(clientRoot, 'node_modules'),
      path.join(runtime.runtimeClientRoot, 'node_modules'),
      ownedCacheDirectories,
    )
    for (const directory of ownedCacheDirectories) {
      fs.mkdirSync(path.join(runtime.runtimeClientRoot, 'node_modules', directory))
    }
    for (const tree of [
      path.join(runtime.runtimeServerRoot, 'node_modules'),
      path.join(runtime.runtimeClientRoot, 'node_modules'),
      path.join(runtime.runtimeClientRoot, 'electron', 'resources'),
    ]) assertTreeSymlinksContained(tree)
    fs.writeFileSync(runtime.dependencyWriteGuard, dependencyWriteGuardBytes, { flag: 'wx' })
    stagedLogicalBytes += Buffer.byteLength(dependencyWriteGuardBytes)
    const marker = runtimeExpectedMarker(runtime)
    if (!runtimeIdentityMatches(marker.identity)) {
      throw new Error('Office E2E runtime source changed while its fixture-owned clone was being created')
    }
    if (!runtimeSourceMatchesMarker(runtime, marker)) {
      throw new Error('Office E2E runtime source changed before its fixture-owned clone was committed')
    }
    fs.writeFileSync(path.join(stagingRoot, runtimeMarkerName), `${JSON.stringify(marker)}\n`, { flag: 'wx' })
    fs.renameSync(stagingRoot, runtimeRoot)
    console.log(`${OFFICE_E2E_STAGED_BYTES_MARKER}=${stagedLogicalBytes}`)
  } catch (error) {
    fs.rmSync(stagingRoot, { recursive: true, force: true })
    throw error
  }
  return runtimeLayoutResult(runtimeRoot)
}

// R4: the transcription runtime the server lazily initializes expects its model
// inside nodejs-whisper and a built whisper-cli. The staged clone deliberately
// excludes model *.bin files (package.json packaged-server filter), so the
// harness provisions the model itself from the developer cache and verifies both
// assets before any isolated server/Electron lane is spawned. A missing asset
// fails the lane closed; the server's npx/cmake fallback is never reached.
export const OFFICE_E2E_WHISPER_CACHE_ENV = 'FUSION_OFFICE_E2E_WHISPER_CACHE'
// Mirrors DEFAULT_MODEL in fusion-studio-server/lib/transcription/index.js.
export const OFFICE_E2E_WHISPER_MODEL_FILE = 'ggml-large-v3-turbo.bin'
export const OFFICE_E2E_WHISPER_SETUP_HINT = 'npx nodejs-whisper download large-v3-turbo'
const officeE2eWhisperCppRelative = path.join('node_modules', 'nodejs-whisper', 'cpp', 'whisper.cpp')
const officeE2eWhisperCliRelative = path.join(officeE2eWhisperCppRelative, 'build', 'bin', 'whisper-cli')
const officeE2eWhisperModelRelative = path.join(
  officeE2eWhisperCppRelative,
  'models',
  OFFICE_E2E_WHISPER_MODEL_FILE,
)

export function officeWhisperCacheDirectory(environment = process.env) {
  const configured = environment[OFFICE_E2E_WHISPER_CACHE_ENV]
  if (typeof configured === 'string' && configured.length > 0) return path.resolve(configured)
  return path.join(os.homedir(), '.whisper')
}

// The transcription runtime is present exactly when the staged clone carries the
// nodejs-whisper package. When it is absent there is nothing to verify.
export function officeTranscriptionRuntimePresent(runtime) {
  if (!runtime?.runtimeServerRoot) return false
  return fs.existsSync(path.join(runtime.runtimeServerRoot, 'node_modules', 'nodejs-whisper'))
}

export function officeRuntimeLaneAssetRequirements(runtime) {
  return Object.freeze({
    modelPath: path.join(runtime.runtimeServerRoot, officeE2eWhisperModelRelative),
    whisperCliPath: path.join(runtime.runtimeServerRoot, officeE2eWhisperCliRelative),
  })
}

function officeResourceMissingError(pathname, hint, detail) {
  console.log(`${OFFICE_E2E_RESOURCE_MISSING_MARKER} path=${pathname} hint=${hint}`)
  const error = new Error(
    `Office E2E required runtime asset missing (${detail}): ${pathname}; run: ${hint}`,
  )
  error.code = OFFICE_E2E_RESOURCE_MISSING_MARKER
  error.hint = hint
  error.path = pathname
  return error
}

function assertOfficeRuntimeAssetFile(pathname, hint) {
  let stat
  try {
    stat = fs.lstatSync(pathname)
  } catch {
    throw officeResourceMissingError(pathname, hint, 'not found')
  }
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw officeResourceMissingError(pathname, hint, 'not a regular file')
  }
  return stat
}

// Supply the required model from the developer cache with a hardlink (or a CoW
// clone when a hardlink is impossible) so the physical delta stays within R3's
// ceiling. Products of a missing cache are left missing for the verifier below.
export function provisionOfficeRuntimeTranscriptionAssets(runtime, options = {}) {
  if (!officeTranscriptionRuntimePresent(runtime)) {
    return Object.freeze({ modelPath: null, provisioned: false })
  }
  const environment = options.environment ?? process.env
  const { modelPath } = officeRuntimeLaneAssetRequirements(runtime)
  if (fs.existsSync(modelPath)) return Object.freeze({ modelPath, provisioned: false })
  const cacheDirectory = options.cacheDirectory ?? officeWhisperCacheDirectory(environment)
  const cacheModelPath = path.join(cacheDirectory, OFFICE_E2E_WHISPER_MODEL_FILE)
  let cacheStat
  try {
    cacheStat = fs.lstatSync(cacheModelPath)
  } catch {
    return Object.freeze({ modelPath, provisioned: false })
  }
  if (!cacheStat.isFile() || cacheStat.isSymbolicLink()) {
    return Object.freeze({ modelPath, provisioned: false })
  }
  fs.mkdirSync(path.dirname(modelPath), { recursive: true })
  try {
    fs.linkSync(cacheModelPath, modelPath)
  } catch {
    try {
      cloneFilePreservingMode(cacheModelPath, modelPath, cacheStat.mode & 0o7777)
    } catch {
      removeDestinationFile(modelPath)
      return Object.freeze({ modelPath, provisioned: false })
    }
  }
  return Object.freeze({ modelPath, provisioned: true })
}

// Fail closed unless every required asset is present in the staged tree.
export function assertOfficeRuntimeLaneAssets(runtime) {
  if (!officeTranscriptionRuntimePresent(runtime)) return Object.freeze({ enforced: false })
  const { modelPath, whisperCliPath } = officeRuntimeLaneAssetRequirements(runtime)
  assertOfficeRuntimeAssetFile(whisperCliPath, OFFICE_E2E_WHISPER_SETUP_HINT)
  assertOfficeRuntimeAssetFile(modelPath, OFFICE_E2E_WHISPER_SETUP_HINT)
  return Object.freeze({ enforced: true, modelPath, whisperCliPath })
}

// R4 lane integration: provision first, then verify. Callers invoke this before
// spawning any isolated server or Electron lane; a throw is a classified
// fail-closed with the OFFICE_E2E_RESOURCE_MISSING marker already printed.
export function prepareOfficeRuntimeLaneAssets(runtime, options = {}) {
  const provisioning = provisionOfficeRuntimeTranscriptionAssets(runtime, options)
  const assertion = assertOfficeRuntimeLaneAssets(runtime)
  return Object.freeze({ ...assertion, provisioned: provisioning.provisioned })
}

export function officeRuntimeEnvironment(runtime, environment = process.env) {
  const existingNodeOptions = environment.NODE_OPTIONS?.trim()
  const guardOption = `--require=${runtime.dependencyWriteGuard}`
  return Object.freeze({
    ...environment,
    FUSION_OFFICE_E2E_READ_ONLY_ROOTS: JSON.stringify([
      path.join(clientRoot, 'electron', 'resources'),
      path.join(clientRoot, 'node_modules'),
      path.join(serverRoot, 'node_modules'),
    ]),
    NODE_OPTIONS: existingNodeOptions ? `${existingNodeOptions} ${guardOption}` : guardOption,
  })
}

async function restoreOfficeFixtureModes(internal) {
  const entries = [...internal.capturedModes.entries()].reverse()
  for (const [candidate, mode] of entries) {
    const canonicalRoot = assertOfficeFixturePathSafe(internal.allocatedRoot)
    const canonicalCandidate = assertOfficeFixturePathSafe(candidate)
    if (!isWithin(canonicalCandidate, canonicalRoot)) {
      throw pathSafetyError(`Office E2E fixture path escapes its allocated root: ${canonicalCandidate}`)
    }
    if (fs.existsSync(candidate)) fs.chmodSync(candidate, mode)
  }
  internal.capturedModes.clear()
}

async function finalizeOfficeFixture(fixture, retain) {
  const internal = fixture && fixtureInternals.get(fixture)
  if (!internal || internal.closed) return
  if (internal.destroying) throw new Error('Office fixture teardown is already in progress')
  internal.teardownStarted = true
  internal.destroying = true
  let cleanupError = null
  let databaseClosed = internal.dbModule === null
  try {
    await restoreOfficeFixtureModes(internal)
  } catch (error) {
    cleanupError = error
    retain = false
  }
  try {
    await internal.dbModule?.closeDb()
    databaseClosed = true
  } catch (error) {
    cleanupError ??= error
    retain = false
  }
  try {
    if (internal.priorEnvironment.appUserData === undefined) delete process.env.FUSION_APP_USER_DATA
    else process.env.FUSION_APP_USER_DATA = internal.priorEnvironment.appUserData
    if (internal.priorEnvironment.localMachine === undefined) delete process.env.FUSION_LOCAL_MACHINE
    else process.env.FUSION_LOCAL_MACHINE = internal.priorEnvironment.localMachine
    if (databaseClosed) resetServerModules()
    if (!retain) {
      assertOfficeFixturePathSafe(internal.allocatedRoot)
      fs.rmSync(internal.allocatedRoot, { recursive: true, force: true })
    }
  } catch (error) {
    cleanupError ??= error
  } finally {
    internal.destroying = false
  }
  if (cleanupError) throw cleanupError
  internal.closed = true
  if (activeFixture === fixture) activeFixture = null
}

export async function destroyOfficeFixture(fixture) {
  await finalizeOfficeFixture(fixture, false)
}

function assertProcessLifecycleActive(lifecycle) {
  const internal = lifecycle && processLifecycleInternals.get(lifecycle)
  if (!internal || internal.finalized || internal.finalizationPromise) {
    throw new Error('Office process lifecycle is not active')
  }
  return internal
}

function childCompletion(child) {
  return new Promise((resolve, reject) => {
    child.once('error', reject)
    child.once('exit', (code, signal) => resolve({ code, signal }))
  })
}

function childSpawned(child) {
  return new Promise((resolve, reject) => {
    child.once('spawn', resolve)
    child.once('error', reject)
  })
}

function signalChildGroup(child, signal) {
  if (!Number.isInteger(child.pid)) return
  try {
    if (process.platform === 'win32') {
      if (child.exitCode !== null || child.signalCode !== null) return
      child.kill(signal)
    }
    else {
      if ((child.exitCode !== null || child.signalCode !== null) && !isChildGroupAlive(child)) return
      process.kill(-child.pid, signal)
    }
  } catch (error) {
    if (error.code === 'ESRCH') return
    if (error.code === 'EPERM' && (child.exitCode !== null || child.signalCode !== null)) {
      try {
        process.kill(-child.pid, 0)
      } catch (probeError) {
        if (probeError.code === 'ESRCH') return
      }
    }
    throw error
  }
}

function isChildGroupAlive(child) {
  if (!Number.isInteger(child.pid)) return false
  if (process.platform === 'win32') return child.exitCode === null && child.signalCode === null
  try {
    process.kill(-child.pid, 0)
    return true
  } catch (error) {
    if (error.code === 'ESRCH') return false
    if (error.code === 'EPERM') return true
    throw error
  }
}

async function waitForChildExit(record, timeoutMs) {
  let timeout
  const timedOut = new Promise((resolve) => {
    timeout = setTimeout(() => resolve(null), timeoutMs)
  })
  const result = await Promise.race([record.completion, timedOut])
  clearTimeout(timeout)
  return result
}

async function waitForChildGroupExit(record, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  await waitForChildExit(record, timeoutMs)
  while (isChildGroupAlive(record.child) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
  return !isChildGroupAlive(record.child)
}

export async function waitForOfficeUrl(url, options = {}) {
  const timeoutMs = options.timeoutMs ?? 30_000
  const deadline = Date.now() + timeoutMs
  let lastError = null
  while (Date.now() < deadline) {
    const abort = options.abort?.()
    if (abort?.error) throw abort.error
    if (abort?.result) {
      throw new Error(`Office child exited before URL readiness: ${JSON.stringify(abort.result)}`)
    }
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1_000) })
      if (response.ok) return response
      lastError = new Error(`readiness URL returned HTTP ${response.status}`)
    } catch (error) {
      lastError = error
    }
    const settled = options.abort?.()
    if (settled?.error) throw settled.error
    if (settled?.result) {
      throw new Error(`Office child exited before URL readiness: ${JSON.stringify(settled.result)}`)
    }
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  throw new Error(`Office process readiness timed out for ${url}: ${lastError?.message ?? 'no response'}`)
}

export async function createOfficeProcessLifecycle(options = {}) {
  validateOfficeFixtureOptions(options)
  const fixture = await createOfficeFixture(options)
  const lifecycle = Object.freeze({ fixture })
  processLifecycleInternals.set(lifecycle, {
    children: new Set(),
    finalizationPromise: null,
    finalResult: null,
    finalized: false,
    signalReceived: false,
  })
  activeProcessLifecycles.add(lifecycle)
  return lifecycle
}

export function startOfficeOwnedProcess(lifecycle, command, args = [], options = {}) {
  const internal = assertProcessLifecycleActive(lifecycle)
  const piped = Boolean(options.captureOutput || options.readyPattern || options.readyUrl)
  const child = spawn(command, args, {
    cwd: options.cwd,
    detached: process.platform !== 'win32',
    env: options.env ?? process.env,
    stdio: piped ? ['ignore', 'pipe', 'pipe'] : (options.stdio ?? 'inherit'),
  })
  const record = {
    child,
    completion: childCompletion(child),
    spawned: childSpawned(child),
  }
  // Callers await the lifecycle milestone that matters to their launch path.
  // Keep the other independently rejecting promise observed without changing
  // the rejection either promise delivers to a later await.
  record.completion.catch(() => {})
  record.spawned.catch(() => {})
  internal.children.add(record)
  record.completion.then(
    () => {
      if (!isChildGroupAlive(child)) internal.children.delete(record)
    },
    () => internal.children.delete(record),
  )

  let ready = Promise.resolve()
  let stdoutTail = Buffer.alloc(0)
  let stderrTail = Buffer.alloc(0)
  let stdoutTruncated = false
  let stderrTruncated = false
  const appendTail = (current, chunk, markTruncated) => {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    const combined = Buffer.concat([current, bytes])
    if (combined.length <= OFFICE_E2E_DIAGNOSTIC_TAIL_BYTES) return combined
    markTruncated()
    return combined.subarray(combined.length - OFFICE_E2E_DIAGNOSTIC_TAIL_BYTES)
  }
  if (piped) {
    let output = ''
    child.stdout.on('data', (chunk) => {
      stdoutTail = appendTail(stdoutTail, chunk, () => { stdoutTruncated = true })
      const text = chunk.toString()
      output = `${output}${text}`.slice(-65_536)
      if (options.forwardOutput !== false) process.stdout.write(text)
    })
    child.stderr.on('data', (chunk) => {
      stderrTail = appendTail(stderrTail, chunk, () => { stderrTruncated = true })
      if (options.forwardOutput !== false) process.stderr.write(chunk)
    })
    let childSettlement = null
    record.completion.then(
      (result) => { childSettlement = { result } },
      (error) => { childSettlement = { error } },
    )
    ready = (async () => {
      if (options.readyPattern) {
        const deadline = Date.now() + (options.readyTimeoutMs ?? 30_000)
        while (true) {
          options.readyPattern.lastIndex = 0
          if (options.readyPattern.test(output)) break
          const exited = await Promise.race([
            record.completion.then((result) => ({ result })),
            new Promise((resolve) => setTimeout(() => resolve(null), 25)),
          ])
          if (exited) throw new Error(`Office child exited before readiness: ${JSON.stringify(exited.result)}`)
          if (Date.now() >= deadline) throw new Error(`Office child readiness output timed out: ${options.readyPattern}`)
        }
      }
      if (options.readyUrl) {
        await waitForOfficeUrl(options.readyUrl, {
          abort: () => childSettlement,
          timeoutMs: options.readyTimeoutMs,
        })
      }
    })()
    ready.catch(() => {})
  }
  const readOutput = () => Object.freeze({
    stderr: stderrTail.toString('utf8'),
    stderrTruncated,
    stdout: stdoutTail.toString('utf8'),
    stdoutTruncated,
  })
  return Object.freeze({
    child,
    completion: record.completion,
    readOutput,
    ready,
    spawned: record.spawned,
  })
}

export async function stopOfficeOwnedProcesses(lifecycle) {
  const internal = lifecycle && processLifecycleInternals.get(lifecycle)
  if (!internal || internal.finalized) return
  const records = [...internal.children]
  for (const record of records) signalChildGroup(record.child, 'SIGTERM')
  for (const record of records) {
    if (await waitForChildGroupExit(record, 5_000)) continue
    signalChildGroup(record.child, 'SIGKILL')
    if (!await waitForChildGroupExit(record, 5_000)) {
      throw new Error(`Office child process group ${record.child.pid} remained alive after SIGKILL`)
    }
  }
  internal.children.clear()
}

export async function activateOfficeFixtureA(fixture) {
  const internal = assertFixtureActive(fixture)
  const db = await internal.dbModule.initDb()
  await db('system_config')
    .insert({
      key: 'last_active_workspace_id',
      value: OFFICE_E2E_WORKSPACES[0].id,
      updated_at: Date.now(),
    })
    .onConflict('key')
    .merge(['value', 'updated_at'])
}

export async function finalizeOfficeProcessLifecycle(lifecycle, options = {}) {
  const internal = lifecycle && processLifecycleInternals.get(lifecycle)
  const reason = options.reason ?? 'orderly'
  if (!internal) return Object.freeze({ retained: false, root: null })
  if (reason === 'signal') internal.signalReceived = true
  if (internal.finalized) {
    activeProcessLifecycles.delete(lifecycle)
    if (internal.signalReceived && internal.finalResult?.retained) {
      retainedOfficeRoots.delete(lifecycle.fixture.root)
      fs.rmSync(validateRequestedFixtureRoot(lifecycle.fixture.root), { recursive: true, force: true })
      internal.finalResult = Object.freeze({ retained: false, root: lifecycle.fixture.root })
    }
    return internal.finalResult ?? Object.freeze({ retained: false, root: lifecycle.fixture.root })
  }
  if (internal.finalizationPromise) return internal.finalizationPromise

  internal.finalizationPromise = (async () => {
    let cleanupError = null
    try {
      await stopOfficeOwnedProcesses(lifecycle)
    } catch (error) {
      cleanupError = error
    }
    const retainRequested = process.env.FUSION_OFFICE_E2E_RETAIN === '1'
    const retainAllowed = !cleanupError
      && !internal.signalReceived
      && (reason === 'orderly' || reason === 'assertion')
    let retained = retainRequested && retainAllowed
    try {
      await finalizeOfficeFixture(lifecycle.fixture, retained)
    } catch (error) {
      cleanupError ??= error
    }
    if (cleanupError) {
      try {
        await finalizeOfficeFixture(lifecycle.fixture, false)
      } catch (retryError) {
        throw new AggregateError([cleanupError, retryError], 'Office process lifecycle cleanup failed')
      }
      throw cleanupError
    }
    if (retained && internal.signalReceived) {
      retained = false
      fs.rmSync(validateRequestedFixtureRoot(lifecycle.fixture.root), { recursive: true, force: true })
    }
    internal.finalized = true
    activeProcessLifecycles.delete(lifecycle)
    if (retained) {
      retainedOfficeRoots.add(lifecycle.fixture.root)
      console.log(`OFFICE_E2E_RETAINED_ROOT=${lifecycle.fixture.root}`)
    } else {
      retainedOfficeRoots.delete(lifecycle.fixture.root)
    }
    internal.finalResult = Object.freeze({ retained, root: lifecycle.fixture.root })
    return internal.finalResult
  })()
  return internal.finalizationPromise
}

// Enumerate the fixture/runtime roots this process still owns. Used by the
// parent-loss and wall-clock deadline diagnostics so an operator can see
// exactly what was active when the harness self-terminated.
export function activeOfficeHarnessRoots() {
  const roots = new Set()
  if (activeFixture) {
    const internal = fixtureInternals.get(activeFixture)
    if (internal?.allocatedRoot) roots.add(internal.allocatedRoot)
  }
  for (const lifecycle of activeProcessLifecycles) {
    if (lifecycle.fixture?.root) roots.add(lifecycle.fixture.root)
  }
  return Object.freeze([...roots])
}

export function activeOfficeHarnessProcessIds() {
  const pids = []
  for (const lifecycle of activeProcessLifecycles) {
    const internal = processLifecycleInternals.get(lifecycle)
    for (const record of internal?.children ?? []) {
      if (Number.isInteger(record.child?.pid)) pids.push(record.child.pid)
    }
  }
  return Object.freeze(pids)
}

function raceCleanupDeadline(promise, deadline) {
  const remaining = Math.max(0, deadline - Date.now())
  if (remaining <= 0) return Promise.resolve({ timedOut: true })
  return new Promise((resolve) => {
    let settled = false
    // Deliberately ref'd: bounded cleanup must run to completion (or its
    // deadline) and report before the process exits.
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      resolve({ timedOut: true })
    }, remaining)
    Promise.resolve(promise).then(
      (value) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        resolve({ timedOut: false, value })
      },
      (error) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        resolve({ timedOut: false, error })
      },
    )
  })
}

// Bounded fail-safe cleanup shared by the SIGTERM-class parent-loss path and
// the wall-clock deadline path. Every owned lifecycle and fixture is finalized
// with signal semantics (never retained). Anything that cannot finish inside
// the deadline is force-killed, left for the stale-root sweep with its owner
// lease intact, and reported in `retainedRoots` - never silently dropped.
export async function cleanupActiveOfficeHarness(options) {
  const reason = options?.reason ?? 'signal'
  const deadlineMs = options?.deadlineMs
  if (!Number.isSafeInteger(deadlineMs) || deadlineMs <= 0) {
    throw new TypeError('Office harness cleanup requires a positive integer deadlineMs')
  }
  const startedAt = Date.now()
  const deadline = startedAt + deadlineMs
  const roots = activeOfficeHarnessRoots()
  const childPids = activeOfficeHarnessProcessIds()
  const cleanedRoots = []
  const retainedRoots = []
  const failures = []

  for (const lifecycle of [...activeProcessLifecycles]) {
    const root = lifecycle.fixture?.root ?? null
    const internal = processLifecycleInternals.get(lifecycle)
    if (internal) internal.signalReceived = true
    const outcome = await raceCleanupDeadline(
      finalizeOfficeProcessLifecycle(lifecycle, { reason: 'signal' }),
      deadline,
    )
    if (outcome.timedOut) {
      for (const record of [...(processLifecycleInternals.get(lifecycle)?.children ?? [])]) {
        try { signalChildGroup(record.child, 'SIGKILL') } catch { /* child group already gone */ }
      }
      if (root) retainedRoots.push(root)
      failures.push(Object.freeze({ phase: 'lifecycle-deadline', root }))
    } else if (outcome.error) {
      if (root) retainedRoots.push(root)
      failures.push(Object.freeze({ error: outcome.error, phase: 'lifecycle-cleanup', root }))
    } else if (root) {
      cleanedRoots.push(root)
    }
  }

  if (activeFixture) {
    const fixture = activeFixture
    const root = fixtureInternals.get(fixture)?.allocatedRoot ?? fixture.root ?? null
    const outcome = await raceCleanupDeadline(destroyOfficeFixture(fixture), deadline)
    if (outcome.timedOut) {
      if (root) retainedRoots.push(root)
      failures.push(Object.freeze({ phase: 'fixture-deadline', root }))
    } else if (outcome.error) {
      if (root) retainedRoots.push(root)
      failures.push(Object.freeze({ error: outcome.error, phase: 'fixture-cleanup', root }))
    } else if (root) {
      cleanedRoots.push(root)
    }
  }

  return Object.freeze({
    childPids,
    cleanedRoots: Object.freeze([...new Set(cleanedRoots)]),
    durationMs: Date.now() - startedAt,
    failures: Object.freeze(failures),
    reason,
    retainedRoots: Object.freeze([...new Set(retainedRoots)]),
    roots,
  })
}

export function cleanupOfficePlaywrightRunRoot(root) {
  const safeRoot = validateRequestedFixtureRoot(root)
  if (!shouldCleanupOfficePlaywrightRunRoot(safeRoot)) return false
  retainedOfficeRoots.delete(safeRoot)
  fs.rmSync(safeRoot, { recursive: true, force: true })
  return true
}

export function shouldCleanupOfficePlaywrightRunRoot(root) {
  const safeRoot = validateRequestedFixtureRoot(root)
  return process.env.FUSION_OFFICE_E2E_RETAIN !== '1' || !retainedOfficeRoots.has(safeRoot)
}

const officeE2eRootPrefix = 'fusion-office-e2e-'
const OFFICE_E2E_DEFAULT_STALE_ROOT_MAX_AGE_MS = 6 * 60 * 60 * 1000

function officeE2eStaleRootMaxAgeMs(environment) {
  const raw = environment.FUSION_OFFICE_E2E_SWEEP_MAX_AGE_MS
  if (raw === undefined || raw === '') return OFFICE_E2E_DEFAULT_STALE_ROOT_MAX_AGE_MS
  if (!/^(0|[1-9]\d*)$/.test(raw)) {
    throw new Error('FUSION_OFFICE_E2E_SWEEP_MAX_AGE_MS must be a non-negative integer')
  }
  return Number(raw)
}

function officeFixtureOwnerPid(root) {
  try {
    const owner = JSON.parse(fs.readFileSync(path.join(root, officeE2eOwnerFileName), 'utf8'))
    return Number.isInteger(owner?.pid) && owner.pid > 0 ? owner.pid : null
  } catch {
    return null
  }
}

function officeFixtureOwnerIsLive(pid) {
  if (pid === null) return false
  if (pid === process.pid) return true
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    // A process we may not signal still exists; only ESRCH means it is gone.
    return error?.code === 'EPERM'
  }
}

// Sweep abandoned `fusion-office-e2e-*` run roots left behind by interrupted
// suites. A root is removed only when it is a direct directory child of the
// temporary directory (never a symlink), older than the age threshold, not the
// current run, and not owned by a live process. Set
// FUSION_OFFICE_E2E_SWEEP=0 to disable, or FUSION_OFFICE_E2E_SWEEP_MAX_AGE_MS
// to change the age threshold.
export function sweepStaleOfficeFixtureRoots(options = {}) {
  const environment = options.environment ?? process.env
  if (environment.FUSION_OFFICE_E2E_SWEEP === '0') {
    return Object.freeze({ removed: Object.freeze([]), skipped: Object.freeze([]) })
  }
  const temporaryRoot = assertOfficeFixturePathSafe(os.tmpdir())
  const currentRoot = options.currentRoot ? validateRequestedFixtureRoot(options.currentRoot) : null
  const maxAgeMs = options.maxAgeMs ?? officeE2eStaleRootMaxAgeMs(environment)
  const now = options.now ?? Date.now()
  const namePrefix = options.namePrefix ?? officeE2eRootPrefix
  const removed = []
  const skipped = []
  for (const name of fs.readdirSync(temporaryRoot)) {
    if (!name.startsWith(officeE2eRootPrefix) || !name.startsWith(namePrefix)) continue
    const candidate = path.join(temporaryRoot, name)
    let stat
    try {
      stat = fs.lstatSync(candidate)
    } catch {
      continue
    }
    if (stat.isSymbolicLink() || !stat.isDirectory()) continue
    let safeCandidate
    try {
      safeCandidate = validateRequestedFixtureRoot(candidate)
    } catch {
      continue
    }
    if (currentRoot && safeCandidate === currentRoot) {
      skipped.push(safeCandidate)
      continue
    }
    if (officeFixtureOwnerIsLive(officeFixtureOwnerPid(safeCandidate))) {
      skipped.push(safeCandidate)
      continue
    }
    if (now - stat.mtimeMs < maxAgeMs) {
      skipped.push(safeCandidate)
      continue
    }
    try {
      fs.rmSync(safeCandidate, { recursive: true, force: true })
      removed.push(safeCandidate)
      console.log(`OFFICE_E2E_SWEPT_STALE_ROOT=${safeCandidate}`)
    } catch (error) {
      console.warn(`OFFICE_E2E_SWEEP_FAILED=${safeCandidate} (${error?.code ?? error?.message ?? 'error'})`)
    }
  }
  return Object.freeze({ removed: Object.freeze(removed), skipped: Object.freeze(skipped) })
}

// R5 janitor: documented harness-owned prefix list for *empty* leftover
// directories (packaging/verification shells). Only direct children of a
// temporary root with one of these exact prefixes are ever considered, and only
// empty ones are removed. Unmatched names, model caches, ~/.whisper, non-empty
// directories, and symlinks are never touched.
const officeE2eEmptyShellPrefixes = Object.freeze([
  'fusion-spec00a-',
])

// The janitor scans the process temporary root and, when it is a distinct
// directory, the system temporary root (`/tmp` on macOS), where the observed
// `fusion-spec00a-*` packaging shells were left. Symlinks at the root path are
// resolved once; nothing inside a candidate is ever followed.
function officeE2eJanitorRoots() {
  const roots = []
  const seen = new Set()
  for (const candidate of [os.tmpdir(), '/tmp']) {
    let canonical
    try {
      canonical = fs.realpathSync(candidate)
    } catch {
      continue
    }
    if (seen.has(canonical)) continue
    seen.add(canonical)
    roots.push(canonical)
  }
  return roots
}

// Remove empty, age-gated, harness-owned shells. Set FUSION_OFFICE_E2E_SWEEP=0
// to disable or FUSION_OFFICE_E2E_SWEEP_MAX_AGE_MS to change the age gate; the
// existing `fusion-office-e2e-*` stale-root sweep semantics are unchanged.
export function sweepOfficeHarnessEmptyShells(options = {}) {
  const environment = options.environment ?? process.env
  if (environment.FUSION_OFFICE_E2E_SWEEP === '0') {
    return Object.freeze({ removed: Object.freeze([]), skipped: Object.freeze([]) })
  }
  const maxAgeMs = options.maxAgeMs ?? officeE2eStaleRootMaxAgeMs(environment)
  const now = options.now ?? Date.now()
  const prefixes = options.prefixes ?? officeE2eEmptyShellPrefixes
  const tempRoots = options.tempRoots ?? officeE2eJanitorRoots()
  const removed = []
  const skipped = []
  for (const temporaryRoot of tempRoots) {
    let names
    try {
      names = fs.readdirSync(temporaryRoot)
    } catch {
      continue
    }
    for (const name of names) {
      if (!prefixes.some((prefix) => name.startsWith(prefix))) continue
      const candidate = path.join(temporaryRoot, name)
      let stat
      try {
        stat = fs.lstatSync(candidate)
      } catch {
        continue
      }
      // Never follow symlinks, never leave the direct-child level, never touch
      // files or unmatched names.
      if (stat.isSymbolicLink() || !stat.isDirectory()) continue
      if (path.dirname(candidate) !== temporaryRoot) continue
      if (officeFixtureOwnerIsLive(officeFixtureOwnerPid(candidate))) {
        skipped.push(candidate)
        continue
      }
      if (now - stat.mtimeMs < maxAgeMs) {
        skipped.push(candidate)
        continue
      }
      let entries
      try {
        entries = fs.readdirSync(candidate)
      } catch {
        continue
      }
      // Empty-only: rmdirSync cannot remove a non-empty directory even if the
      // emptiness check above raced a writer.
      if (entries.length > 0) continue
      try {
        fs.rmdirSync(candidate)
        removed.push(candidate)
        console.log(`OFFICE_E2E_JANITOR_REMOVED=${candidate}`)
      } catch (error) {
        console.warn(`OFFICE_E2E_JANITOR_FAILED=${candidate} (${error?.code ?? error?.message ?? 'error'})`)
      }
    }
  }
  if (removed.length > 0) {
    console.log(`${OFFICE_E2E_JANITOR_SWEPT_MARKER}=${removed.length}`)
  }
  return Object.freeze({ removed: Object.freeze(removed), skipped: Object.freeze(skipped) })
}

export async function withOfficeProcessLifecycle(options, action) {
  let lifecycle
  try {
    lifecycle = await createOfficeProcessLifecycle(options)
    const value = await action(lifecycle)
    await finalizeOfficeProcessLifecycle(lifecycle, { reason: 'orderly' })
    return value
  } catch (error) {
    const reason = error?.code === 'OFFICE_E2E_PATH_SAFETY' ? 'safety' : 'assertion'
    if (lifecycle) {
      try {
        await finalizeOfficeProcessLifecycle(lifecycle, { reason })
      } catch (cleanupError) {
        throw new AggregateError(
          [error, cleanupError],
          'Office lifecycle action and cleanup both failed',
          { cause: error },
        )
      }
    }
    throw error
  }
}

export function installOfficeSignalCleanup(initialLifecycle = null) {
  let lifecycle = initialLifecycle
  let handling = false
  const handlers = new Map()
  for (const [signal, exitCode] of [['SIGINT', 130], ['SIGTERM', 143]]) {
    const handler = async () => {
      if (handling) return
      handling = true
      const internal = lifecycle ? processLifecycleInternals.get(lifecycle) : null
      if (internal) internal.signalReceived = true
      try {
        if (lifecycle) {
          await finalizeOfficeProcessLifecycle(lifecycle, { reason: 'signal' })
        } else if (activeFixture) {
          await destroyOfficeFixture(activeFixture)
        }
      } catch (error) {
        console.error(error)
      }
      process.exit(exitCode)
    }
    handlers.set(signal, handler)
    process.on(signal, handler)
  }
  const remove = () => {
    for (const [signal, handler] of handlers) process.off(signal, handler)
  }
  remove.attach = (candidate) => {
    lifecycle = candidate
  }
  return remove
}
