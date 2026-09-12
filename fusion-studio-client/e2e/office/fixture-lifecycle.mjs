import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
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

function createFixtureRoot(requestedRoot) {
  const safeTemporaryRoot = assertOfficeFixturePathSafe(os.tmpdir())
  const root = requestedRoot
    ? validateRequestedFixtureRoot(requestedRoot)
    : fs.mkdtempSync(path.join(safeTemporaryRoot, 'fusion-office-e2e-'))
  if (requestedRoot) fs.mkdirSync(root, { mode: 0o700 })
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

function cloneOwnedTree(sourceRoot, destinationRoot, excludedPaths = new Set(), excludePath = () => false) {
  function cloneEntry(source, destination, relative) {
    const stat = fs.lstatSync(source)
    if (stat.isDirectory()) {
      fs.mkdirSync(destination, { mode: stat.mode, recursive: true })
      for (const name of fs.readdirSync(source).sort()) {
        const childRelative = relative ? `${relative}/${name}` : name
        if (excludedPaths.has(childRelative) || excludePath(childRelative)) continue
        cloneEntry(path.join(source, name), path.join(destination, name), childRelative)
      }
      fs.chmodSync(destination, stat.mode)
      return
    }
    if (stat.isSymbolicLink()) {
      fs.symlinkSync(fs.readlinkSync(source), destination)
      if (typeof fs.lchmodSync === 'function') fs.lchmodSync(destination, stat.mode)
      return
    }
    if (!stat.isFile()) throw new Error(`Unsupported Office runtime clone entry: ${source}`)
    fs.copyFileSync(source, destination, fs.constants.COPYFILE_FICLONE)
    fs.chmodSync(destination, stat.mode)
  }
  cloneEntry(sourceRoot, destinationRoot, '')
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

  const stagingRoot = assertFixtureOwnedPath(
    fixture,
    path.join(fixture.root, `runtime-staging-${randomUUID()}`),
  )
  const runtime = runtimeLayoutResult(stagingRoot)
  try {
    fs.mkdirSync(stagingRoot)
    cloneOwnedTree(path.join(serverRoot, 'lib'), path.join(runtime.runtimeServerRoot, 'lib'))
    for (const filename of serverRootFiles) {
      fs.copyFileSync(path.join(serverRoot, filename), path.join(runtime.runtimeServerRoot, filename))
    }
    fs.mkdirSync(path.join(runtime.runtimeServerRoot, 'data'), { recursive: true })
    cloneOwnedTree(
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
      cloneOwnedTree(source, destination)
    }
    for (const filename of clientRootFiles) {
      fs.copyFileSync(path.join(clientRoot, filename), path.join(runtime.runtimeClientRoot, filename))
    }
    cloneOwnedTree(
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
    const marker = runtimeExpectedMarker(runtime)
    if (!runtimeIdentityMatches(marker.identity)) {
      throw new Error('Office E2E runtime source changed while its fixture-owned clone was being created')
    }
    if (!runtimeSourceMatchesMarker(runtime, marker)) {
      throw new Error('Office E2E runtime source changed before its fixture-owned clone was committed')
    }
    fs.writeFileSync(path.join(stagingRoot, runtimeMarkerName), `${JSON.stringify(marker)}\n`, { flag: 'wx' })
    fs.renameSync(stagingRoot, runtimeRoot)
  } catch (error) {
    fs.rmSync(stagingRoot, { recursive: true, force: true })
    throw error
  }
  return runtimeLayoutResult(runtimeRoot)
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
