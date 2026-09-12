import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

import { expect, test, type BrowserContext, type Page, type WebSocketRoute } from '@playwright/test'

import { OfficePaletteClientController, type OfficePaletteSocket } from '../src/lib/ws/office-palette-handlers'
import { useOfficePaletteStore } from '../src/state/officePaletteStore'
import type { WebSocketMessage } from '../src/types'
import { OFFICE_E2E_MACHINE, resetOfficePlaywrightScenario } from './office/fixture-lifecycle.mjs'
import { PALETTE_SELECTOR_SEEDS } from './office/palette-selector-fixtures.mjs'

type WireFrame = Record<string, unknown>
type WireFrames = { received: WireFrame[]; sent: WireFrame[] }
type WorkspaceSuffix = 'a' | 'b' | 'c'
type FileRequestType = 'file_tree_request' | 'file_content_request'

const EXTERNAL_A_BYTES = `${JSON.stringify({
  custom_colors: ['#aa0002', '#aa0003'],
  sync_enabled: false,
}, null, 2)}\n`
const LEGACY_KEY = 'rv-office-table-custom-colors'
const LEGACY_BYTES = '["#123456","#654321"]'

function sha256(bytes: Buffer | string): string {
  return crypto.createHash('sha256').update(bytes).digest('hex')
}

function fixtureRoot(): string {
  const root = process.env.FUSION_OFFICE_E2E_FIXTURE_ROOT
  if (!root) throw new Error('FUSION_OFFICE_E2E_FIXTURE_ROOT is not set')
  return path.resolve(root)
}

function fixturePath(...parts: string[]): string {
  const root = fixtureRoot()
  const candidate = path.resolve(root, ...parts)
  const relative = path.relative(root, candidate)
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Office rehydration test path escapes its isolated fixture root: ${candidate}`)
  }
  return candidate
}

function configPath(suffix: WorkspaceSuffix): string {
  return fixturePath(
    `workspace-${suffix}`,
    'ai',
    OFFICE_E2E_MACHINE,
    'System',
    'config',
    'colors.json',
  )
}

function assertExactBytes(suffix: WorkspaceSuffix, expected: string): void {
  const actual = fs.readFileSync(configPath(suffix))
  expect(actual).toEqual(Buffer.from(expected))
  expect(sha256(actual)).toBe(sha256(expected))
}

function atomicReplace(candidate: string, bytes: string): void {
  const root = fixtureRoot()
  const directory = path.dirname(candidate)
  const temporary = path.join(directory, `.colors-${crypto.randomUUID()}.tmp`)
  for (const pathToCheck of [candidate, directory, temporary]) {
    const relative = path.relative(root, path.resolve(pathToCheck))
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error(`Office rehydration external replacement escapes its fixture root: ${pathToCheck}`)
    }
  }
  const descriptor = fs.openSync(temporary, 'wx', 0o600)
  try {
    fs.writeFileSync(descriptor, bytes)
    fs.fsyncSync(descriptor)
  } finally {
    fs.closeSync(descriptor)
  }
  fs.renameSync(temporary, candidate)
  const directoryDescriptor = fs.openSync(directory, 'r')
  try {
    fs.fsyncSync(directoryDescriptor)
  } finally {
    fs.closeSync(directoryDescriptor)
  }
}

function resetOfficeViewState(suffix: WorkspaceSuffix): void {
  const statePath = fixturePath(
    `workspace-${suffix}`,
    'ai',
    OFFICE_E2E_MACHINE,
    'System',
    'Views',
    '001-office-viewer',
    'state',
    'state.json',
  )
  let state: Record<string, unknown> = {}
  try {
    state = JSON.parse(fs.readFileSync(statePath, 'utf8')) as Record<string, unknown>
  } catch {
    // The isolated fixture owns this state file; a missing file starts empty.
  }
  fs.writeFileSync(statePath, `${JSON.stringify({
    ...state,
    officeViewerMode: 'home',
    officeViewerCurrentFolder: null,
    officeViewerSelectedPath: null,
    activity: { recents: [] },
    collections: { starred: [] },
  }, null, 2)}\n`)
}

function setFixtureWorkspacePanel(suffix: WorkspaceSuffix, panel: string): void {
  const statePath = fixturePath(
    `workspace-${suffix}`,
    'ai',
    OFFICE_E2E_MACHINE,
    'System',
    'state',
    'state.json',
  )
  const state = JSON.parse(fs.readFileSync(statePath, 'utf8')) as WireFrame
  const workspace = typeof state.workspace === 'object' && state.workspace !== null
    ? state.workspace as WireFrame
    : {}
  fs.writeFileSync(statePath, `${JSON.stringify({
    ...state,
    workspace: { ...workspace, currentPanel: panel },
  }, null, 2)}\n`)
}

function setFixtureEmailSelection(suffix: WorkspaceSuffix, selectedPath: string): void {
  const statePath = fixturePath(
    `workspace-${suffix}`,
    'ai',
    OFFICE_E2E_MACHINE,
    'System',
    'Views',
    '003-email-viewer',
    'state',
    'state.json',
  )
  const state = JSON.parse(fs.readFileSync(statePath, 'utf8')) as WireFrame
  fs.writeFileSync(statePath, `${JSON.stringify({
    ...state,
    emailViewerMode: 'home',
    emailViewerCurrentFolder: '009-Email-Fixture',
    emailViewerSelectedPath: selectedPath,
  }, null, 2)}\n`)
}

function setFixtureCaptureRecent(suffix: WorkspaceSuffix, fileName: string): void {
  const statePath = fixturePath(
    `workspace-${suffix}`,
    'ai',
    OFFICE_E2E_MACHINE,
    'System',
    'Views',
    '002-capture-viewer',
    'state',
    'state.json',
  )
  const state = JSON.parse(fs.readFileSync(statePath, 'utf8')) as WireFrame
  fs.writeFileSync(statePath, `${JSON.stringify({
    ...state,
    activity: {
      recents: [{
        panel: 'capture-viewer',
        path: `001-Fixtures/${fileName}`,
        title: fileName,
        kind: 'document',
        folder: '001-Fixtures',
        extension: 'md',
        openedAt: new Date(0).toISOString(),
      }],
    },
  }, null, 2)}\n`)
}

async function waitForFixtureWorkspacePanel(
  suffix: WorkspaceSuffix,
  panel: string,
  timeoutMs = 10_000,
): Promise<void> {
  const statePath = fixturePath(
    `workspace-${suffix}`,
    'ai',
    OFFICE_E2E_MACHINE,
    'System',
    'state',
    'state.json',
  )
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const state = JSON.parse(fs.readFileSync(statePath, 'utf8')) as WireFrame
      if ((state.workspace as WireFrame | undefined)?.currentPanel === panel) return
    } catch {
      // The isolated state writer may be between atomic snapshots.
    }
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
  throw new Error(`Timed out waiting for workspace ${suffix} to persist panel ${panel}`)
}

function captureWireFrames(page: Page): WireFrames {
  const frames: WireFrames = { received: [], sent: [] }
  page.on('websocket', (socket) => {
    const capture = (target: WireFrame[], payload: string | Buffer) => {
      if (typeof payload !== 'string') return
      try {
        target.push(JSON.parse(payload) as WireFrame)
      } catch {
        // Ignore non-JSON traffic outside the Fusion wire protocol.
      }
    }
    socket.on('framesent', ({ payload }) => capture(frames.sent, payload))
    socket.on('framereceived', ({ payload }) => capture(frames.received, payload))
  })
  return frames
}

async function installLegacyProbe(context: BrowserContext): Promise<void> {
  await context.addInitScript(({ bytes, key }) => {
    const originalGet = Storage.prototype.getItem
    const originalSet = Storage.prototype.setItem
    const originalRemove = Storage.prototype.removeItem
    const originalClear = Storage.prototype.clear
    if (originalGet.call(window.localStorage, key) === null) originalSet.call(window.localStorage, key, bytes)
    const observed = window as typeof window & {
      __officeRehydrationLegacyAccesses?: string[]
      __officeRehydrationLegacyBytes?: () => string | null
    }
    observed.__officeRehydrationLegacyAccesses = []
    observed.__officeRehydrationLegacyBytes = () => originalGet.call(window.localStorage, key)
    Storage.prototype.getItem = function getItem(candidate) {
      if (this === window.localStorage && candidate === key) {
        observed.__officeRehydrationLegacyAccesses?.push('getItem')
      }
      return originalGet.call(this, candidate)
    }
    Storage.prototype.setItem = function setItem(candidate, value) {
      if (this === window.localStorage && candidate === key) {
        observed.__officeRehydrationLegacyAccesses?.push('setItem')
      }
      return originalSet.call(this, candidate, value)
    }
    Storage.prototype.removeItem = function removeItem(candidate) {
      if (this === window.localStorage && candidate === key) {
        observed.__officeRehydrationLegacyAccesses?.push('removeItem')
      }
      return originalRemove.call(this, candidate)
    }
    Storage.prototype.clear = function clear() {
      if (this === window.localStorage) observed.__officeRehydrationLegacyAccesses?.push('clear')
      return originalClear.call(this)
    }
  }, { bytes: LEGACY_BYTES, key: LEGACY_KEY })
}

async function legacyEvidence(page: Page): Promise<{ accesses: string[]; bytes: string | null }> {
  return page.evaluate(() => {
    const observed = window as typeof window & {
      __officeRehydrationLegacyAccesses?: string[]
      __officeRehydrationLegacyBytes?: () => string | null
    }
    return {
      accesses: observed.__officeRehydrationLegacyAccesses ?? [],
      bytes: observed.__officeRehydrationLegacyBytes?.() ?? null,
    }
  })
}

interface RoutedFileWire extends WireFrames {
  held: Array<{ frame: WireFrame; payload: string | Buffer }>
  injectedFailures: WireFrame[]
  holdWorkspaceId: string | null
  failNextTreeWorkspaceId: string | null
  failNextTreePanel: string | null
  failNextTreePath: string | null
  failNextContentWorkspaceId: string | null
  failNextContentPanel: string | null
  failNextContentPath: string | null
  releaseHeld: () => void
  refreshScreenshotPanels: () => void
}

async function routeFileWire(page: Page): Promise<RoutedFileWire> {
  const wire: RoutedFileWire = {
    received: [],
    sent: [],
    held: [],
    injectedFailures: [],
    holdWorkspaceId: null,
    failNextTreeWorkspaceId: null,
    failNextTreePanel: null,
    failNextTreePath: null,
    failNextContentWorkspaceId: null,
    failNextContentPanel: null,
    failNextContentPath: null,
    releaseHeld: () => {},
    refreshScreenshotPanels: () => {},
  }
  let browserSocket: WebSocketRoute | null = null

  await page.routeWebSocket(/.*/, (socket) => {
    browserSocket = socket
    const server = socket.connectToServer()
    wire.refreshScreenshotPanels = () => server.send(JSON.stringify({ type: 'screenshot:list' }))
    wire.releaseHeld = () => {
      const held = wire.held.splice(0)
      for (const item of held) socket.send(item.payload)
    }
    socket.onMessage((payload) => {
      if (typeof payload === 'string') {
        try {
          wire.sent.push(JSON.parse(payload) as WireFrame)
        } catch {
          // Forward non-JSON traffic unchanged.
        }
      }
      server.send(payload)
    })
    server.onMessage((payload) => {
      let frame: WireFrame | null = null
      if (typeof payload === 'string') {
        try {
          frame = JSON.parse(payload) as WireFrame
          wire.received.push(frame)
        } catch {
          // Forward non-JSON traffic unchanged.
        }
      }

      const isFileResponse = frame?.type === 'file_tree_response' || frame?.type === 'file_content_response'
      if (isFileResponse && frame?.workspaceId === wire.holdWorkspaceId) {
        wire.held.push({ frame, payload })
        return
      }
      if (
        frame?.type === 'file_tree_response'
        && frame.workspaceId === wire.failNextTreeWorkspaceId
        && (wire.failNextTreePanel === null || frame.panel === wire.failNextTreePanel)
        && (wire.failNextTreePath === null || frame.path === wire.failNextTreePath)
      ) {
        wire.failNextTreeWorkspaceId = null
        wire.failNextTreePanel = null
        wire.failNextTreePath = null
        const failure = {
          ...frame,
          success: false,
          nodes: undefined,
          error: 'Injected matching tree failure',
          code: 'EIO',
        }
        wire.injectedFailures.push(failure)
        socket.send(JSON.stringify(failure))
        return
      }
      if (
        frame?.type === 'file_content_response'
        && frame.workspaceId === wire.failNextContentWorkspaceId
        && (wire.failNextContentPanel === null || frame.panel === wire.failNextContentPanel)
        && (wire.failNextContentPath === null || frame.path === wire.failNextContentPath)
      ) {
        wire.failNextContentWorkspaceId = null
        wire.failNextContentPanel = null
        wire.failNextContentPath = null
        const failure = {
          ...frame,
          success: false,
          content: undefined,
          error: 'Injected matching content failure',
          code: 'EIO',
        }
        wire.injectedFailures.push(failure)
        socket.send(JSON.stringify(failure))
        return
      }
      socket.send(payload)
    })
  })

  wire.releaseHeld = () => {
    if (!browserSocket) throw new Error('Routed file WebSocket is not connected')
    const held = wire.held.splice(0)
    for (const item of held) browserSocket.send(item.payload)
  }
  return wire
}

async function waitForFrame(
  frames: WireFrame[],
  predicate: (frame: WireFrame) => boolean,
  from = 0,
  timeoutMs = 20_000,
): Promise<WireFrame> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const match = frames.slice(from).find(predicate)
    if (match) return match
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
  throw new Error(`Timed out waiting for wire frame after ${from}: ${JSON.stringify(frames.slice(from))}`)
}

function isPaletteRequest(frame: WireFrame, workspaceId: string): boolean {
  return frame.type === 'office:palette_get'
    && frame.workspaceId === workspaceId
    && typeof frame.requestId === 'string'
}

function isPaletteState(frame: WireFrame, workspaceId: string): boolean {
  return frame.type === 'office:palette_state'
    && frame.workspaceId === workspaceId
    && typeof frame.requestId === 'string'
    && frame.source === 'request'
    && frame.operation === 'get'
}

function isFileRequest(
  frame: WireFrame,
  type: FileRequestType,
  workspaceId: string,
  requestPath: string,
  panel = 'office-viewer',
): boolean {
  return frame.type === type
    && frame.panel === panel
    && frame.path === requestPath
    && frame.workspaceId === workspaceId
    && typeof frame.requestId === 'string'
    && Number.isSafeInteger(frame.generation)
}

function matchingFileResponse(frames: WireFrame[], request: WireFrame): WireFrame | undefined {
  const responseType = request.type === 'file_tree_request'
    ? 'file_tree_response'
    : 'file_content_response'
  return frames.find((frame) => (
    frame.type === responseType
    && frame.panel === request.panel
    && frame.path === request.path
    && frame.workspaceId === request.workspaceId
    && frame.requestId === request.requestId
    && frame.generation === request.generation
  ))
}

function expectOneFileRequest(
  frames: WireFrame[],
  from: number,
  type: FileRequestType,
  workspaceId: string,
  requestPath: string,
  panel = 'office-viewer',
): WireFrame {
  const requests = frames.slice(from).filter((frame) => (
    isFileRequest(frame, type, workspaceId, requestPath, panel)
  ))
  expect(requests).toHaveLength(1)
  return requests[0]
}

async function openOfficeHome(page: Page): Promise<void> {
  await page.getByTitle('Office', { exact: true }).click()
  const back = page.getByTitle('Back', { exact: true })
  if (await back.count()) await back.click()
  const home = page.getByTitle('Home', { exact: true })
  if (await home.count()) await home.click()
  await expect(page.getByTitle('001-Fixtures', { exact: true })).toBeVisible()
}

async function expectWorkspaceHomeListing(page: Page, suffix: WorkspaceSuffix): Promise<void> {
  const filenames: Record<WorkspaceSuffix, string> = {
    a: 'Palette-A.md',
    b: 'Palette-B.md',
    c: 'Palette-C.md',
  }
  await openOfficeHome(page)
  await page.getByTitle('001-Fixtures', { exact: true }).click()
  await expect(page.getByTitle(filenames[suffix], { exact: true })).toBeVisible()
  for (const other of ['a', 'b', 'c'] as const) {
    if (other !== suffix) await expect(page.getByTitle(filenames[other], { exact: true })).toHaveCount(0)
  }
  await page.getByTitle('Home', { exact: true }).click()
}

function assertNoRuntimePaletteBackgroundMachinery(): void {
  const runtimeServer = fixturePath('runtime', 'fusion-studio-server')
  const files = [
    path.join(runtimeServer, 'server.js'),
    path.join(runtimeServer, 'lib', 'startup.js'),
    ...fs.readdirSync(path.join(runtimeServer, 'lib', 'office'))
      .filter((entry) => entry.endsWith('.js'))
      .map((entry) => path.join(runtimeServer, 'lib', 'office', entry)),
  ]
  const source = files.map((file) => fs.readFileSync(file, 'utf8')).join('\n')
  expect(source).not.toMatch(/palette-(?:config-watcher|sync-coordinator|removal-journal)/)
  expect(source).not.toMatch(/watch_reconcile|registry_reconcile|REMOVAL_JOURNAL|SYNC_PARTIAL/)
}

async function assertFileBackedPicker(page: Page, expectedColors: string[]): Promise<void> {
  await openWorkspaceDocument(page, 'office-e2e-a', 'Office E2E A', 'Palette-A.md')
  const editor = page.locator('.rv-office-document-editor .milkdown .ProseMirror[contenteditable="true"]')
  await editor.locator('table.rv-office-table tbody > tr').nth(1).locator('td, th').first().click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Cell Background' }).click()
  await expect(page.locator('.rv-office-color-none')).toHaveCount(1)
  await expect(page.locator('.rv-office-color-grid .rv-office-color-swatch')).toHaveCount(80)
  await expect(page.locator('.rv-office-color-custom .rv-office-color-swatch')).toHaveCount(expectedColors.length)
  await expect(page.locator('.rv-office-color-custom .rv-office-color-add')).toHaveCount(1)
  for (const color of expectedColors) {
    await expect(page.locator(`.rv-office-color-custom .rv-office-color-swatch[title="${color}"]`)).toHaveCount(1)
  }
  await expect(page.getByRole('button', { name: 'Sync Disabled', exact: true })).toHaveCount(1)
  await expect(page.getByRole('button', { name: 'Remove', exact: true })).toHaveCount(0)
  await page.keyboard.press('Escape')
}

async function openWorkspaceDocument(
  page: Page,
  workspaceId: string,
  label: string,
  filename: string,
): Promise<void> {
  await ensureWorkspace(page, workspaceId, label)
  await openOfficeHome(page)
  await page.getByTitle('001-Fixtures', { exact: true }).click()
  await expect(page.getByTitle(filename, { exact: true })).toBeVisible()
  await page.getByTitle(filename, { exact: true }).click()
  await expect(page.locator('.rv-office-document-filename')).toContainText(filename)
}

async function ensureWorkspace(page: Page, workspaceId: string, label: string): Promise<void> {
  if (await page.locator('.rv-workspace-name').textContent() === label) return
  await page.getByTitle('Switch workspace').click()
  await page.locator(`.rv-workspace-ribbon-item[data-workspace-id="${workspaceId}"]`).click()
  await expect(page.locator('.rv-workspace-name')).toHaveText(label)
}

class RehydrationProjectionHarness {
  private activeWorkspaceId: string | null = null
  private nextRequestId: string | null = null
  private socket: OfficePaletteSocket
  private readonly controller: OfficePaletteClientController

  constructor() {
    useOfficePaletteStore.getState().reset()
    this.socket = {
      readyState: 1,
      send: () => {},
    }
    this.controller = new OfficePaletteClientController({
      createRequestId: () => {
        if (!this.nextRequestId) throw new Error('Rehydration projection request ID was not staged')
        return this.nextRequestId
      },
      getActiveWorkspaceId: () => this.activeWorkspaceId,
      getPaletteStore: () => useOfficePaletteStore.getState(),
    })
  }

  accept(workspaceId: string, request: WireFrame, response: WireFrame, initial = false): void {
    this.activeWorkspaceId = workspaceId
    this.nextRequestId = request.requestId as string
    if (initial) this.controller.onSocketOpen(this.socket)
    else this.controller.onWorkspaceChanged(workspaceId)
    this.nextRequestId = null
    expect(this.controller.handleMessage(response as WebSocketMessage)).toBe(true)
  }

  state(workspaceId: string) {
    return structuredClone(useOfficePaletteStore.getState().byWorkspace[workspaceId])
  }

  reset(): void {
    this.controller.onSocketClose(this.socket)
    useOfficePaletteStore.getState().reset()
  }
}

async function switchAndProject(
  page: Page,
  frames: WireFrames,
  projection: RehydrationProjectionHarness,
  workspaceId: string,
  label: string,
  expectedColors: string[],
  expectedSync: boolean,
  initial = false,
): Promise<void> {
  const sentFrom = frames.sent.length
  const receivedFrom = frames.received.length
  await ensureWorkspace(page, workspaceId, label)
  const request = await waitForFrame(
    frames.sent,
    (frame) => isPaletteRequest(frame, workspaceId),
    initial ? 0 : sentFrom,
  )
  const response = await waitForFrame(
    frames.received,
    (frame) => isPaletteState(frame, workspaceId) && frame.requestId === request.requestId,
    initial ? 0 : receivedFrom,
  )
  expect(response).toMatchObject({
    customColors: expectedColors,
    syncEnabled: expectedSync,
    availability: 'ready',
  })
  projection.accept(workspaceId, request, response, initial)
  expect(projection.state(workspaceId)).toMatchObject({
    customColors: expectedColors,
    syncEnabled: expectedSync,
    availability: 'ready',
    source: 'request',
  })
}

test('[slice 05S.2] selector workspace switches reread once and external drift waits for the next request', async ({ page }) => {
  test.setTimeout(120_000)
  await resetOfficePlaywrightScenario({
    scenario: 'palette', variant: 'local-selected', copies: 1, workspaces: 3,
  })
  const expected = PALETTE_SELECTOR_SEEDS['local-selected'].local
  assertExactBytes('a', expected.a)
  assertExactBytes('b', expected.b)
  assertExactBytes('c', expected.c)

  assertNoRuntimePaletteBackgroundMachinery()

  const frames = captureWireFrames(page)
  const projection = new RehydrationProjectionHarness()
  try {
    await page.goto('/')
    await switchAndProject(page, frames, projection, 'office-e2e-a', 'Office E2E A', ['#aa0001'], false, true)
    assertExactBytes('a', expected.a)
    assertExactBytes('b', expected.b)
    assertExactBytes('c', expected.c)

    await switchAndProject(page, frames, projection, 'office-e2e-b', 'Office E2E B', ['#00bb02'], false)
    await switchAndProject(page, frames, projection, 'office-e2e-c', 'Office E2E C', ['#000cc3'], false)
    await switchAndProject(page, frames, projection, 'office-e2e-a', 'Office E2E A', ['#aa0001'], false)
    assertExactBytes('a', expected.a)
    assertExactBytes('b', expected.b)
    assertExactBytes('c', expected.c)

    const receivedFrom = frames.received.length
    atomicReplace(configPath('a'), EXTERNAL_A_BYTES)
    await new Promise((resolve) => setTimeout(resolve, 750))
    expect(frames.received.slice(receivedFrom).filter((frame) => (
      frame.type === 'office:palette_state' || frame.type === 'office:palette_error'
    ))).toEqual([])
    expect(projection.state('office-e2e-a')).toMatchObject({ customColors: ['#aa0001'] })

    await switchAndProject(page, frames, projection, 'office-e2e-b', 'Office E2E B', ['#00bb02'], false)
    await switchAndProject(page, frames, projection, 'office-e2e-a', 'Office E2E A', ['#aa0002', '#aa0003'], false)
    assertExactBytes('a', EXTERNAL_A_BYTES)
    assertExactBytes('b', expected.b)
    assertExactBytes('c', expected.c)
    expect(frames.received.filter((frame) => (
      (frame.type === 'office:palette_state' || frame.type === 'office:palette_error')
      && frame.requestId === undefined
    ))).toEqual([])
  } finally {
    projection.reset()
  }
})

test('[slice 05S.2] cyclic Office rehydration keeps selector requests correlated across restart', async ({ context, page }) => {
  test.setTimeout(240_000)
  await resetOfficePlaywrightScenario({
    scenario: 'palette', variant: 'local-selected', copies: 1, workspaces: 3,
  })
  const expected = PALETTE_SELECTOR_SEEDS['local-selected'].local
  const expectedColors: Record<WorkspaceSuffix, string[]> = {
    a: ['#aa0001'],
    b: ['#00bb02'],
    c: ['#000cc3'],
  }
  const expectedSync: Record<WorkspaceSuffix, boolean> = { a: false, b: false, c: false }
  const workspaceId = (suffix: WorkspaceSuffix) => `office-e2e-${suffix}`
  const label = (suffix: WorkspaceSuffix) => `Office E2E ${suffix.toUpperCase()}`

  await installLegacyProbe(context)
  assertExactBytes('a', expected.a)
  assertExactBytes('b', expected.b)
  assertExactBytes('c', expected.c)
  assertNoRuntimePaletteBackgroundMachinery()

  let activePage = page
  let frames = captureWireFrames(activePage)
  let projection = new RehydrationProjectionHarness()
  const visitHome = async (suffix: WorkspaceSuffix, initial = false) => {
    await switchAndProject(
      activePage,
      frames,
      projection,
      workspaceId(suffix),
      label(suffix),
      expectedColors[suffix],
      expectedSync[suffix],
      initial,
    )
    await expectWorkspaceHomeListing(activePage, suffix)
  }

  try {
    await activePage.goto('/')
    await visitHome('a', true)
    await visitHome('b')
    await visitHome('c')
    await visitHome('a')
    assertExactBytes('a', expected.a)
    assertExactBytes('b', expected.b)
    assertExactBytes('c', expected.c)

    await visitHome('b')
    await visitHome('a')
    await openWorkspaceDocument(activePage, 'office-e2e-a', 'Office E2E A', 'Palette-A.md')
    await expect(activePage.locator('.rv-office-document-editor')).toContainText('Before palette-a.')

    await switchAndProject(
      activePage,
      frames,
      projection,
      'office-e2e-b',
      'Office E2E B',
      expectedColors.b,
      false,
    )
    await openOfficeHome(activePage)
    await activePage.getByTitle('001-Fixtures', { exact: true }).click()
    await activePage.getByTitle('Palette-B.md', { exact: true }).click()
    await expect(activePage.locator('.rv-office-document-filename')).toContainText('Palette-B.md')
    await expect(activePage.locator('.rv-office-document-editor')).toContainText('Before palette-b.')

    await switchAndProject(
      activePage,
      frames,
      projection,
      'office-e2e-a',
      'Office E2E A',
      expectedColors.a,
      false,
    )
    await expect(activePage.locator('.rv-office-document-filename')).toContainText('Palette-A.md')
    await expect(activePage.locator('.rv-office-document-editor')).toContainText('Before palette-a.')

    await switchAndProject(
      activePage,
      frames,
      projection,
      'office-e2e-b',
      'Office E2E B',
      expectedColors.b,
      false,
    )
    await switchAndProject(
      activePage,
      frames,
      projection,
      'office-e2e-a',
      'Office E2E A',
      expectedColors.a,
      false,
    )
    await expect(activePage.locator('.rv-office-document-filename')).toContainText('Palette-A.md')
    await expect(activePage.locator('.rv-office-document-editor')).not.toContainText('Before palette-b.')
    await assertFileBackedPicker(activePage, expectedColors.a)
    const legacyBeforeRestart = await legacyEvidence(activePage)
    expect(legacyBeforeRestart.bytes).toBe(LEGACY_BYTES)
    expect(sha256(legacyBeforeRestart.bytes ?? '')).toBe(sha256(LEGACY_BYTES))
    expect(legacyBeforeRestart.accesses).toEqual([])

    const receivedFrom = frames.received.length
    atomicReplace(configPath('a'), EXTERNAL_A_BYTES)
    await new Promise((resolve) => setTimeout(resolve, 750))
    expect(frames.received.slice(receivedFrom).filter((frame) => (
      frame.type === 'office:palette_state' || frame.type === 'office:palette_error'
    ))).toEqual([])
    expect(projection.state('office-e2e-a')).toMatchObject({ customColors: expectedColors.a })
    assertExactBytes('a', EXTERNAL_A_BYTES)
    assertExactBytes('b', expected.b)
    assertExactBytes('c', expected.c)

    await switchAndProject(
      activePage, frames, projection, 'office-e2e-b', 'Office E2E B', expectedColors.b, false,
    )
    await switchAndProject(
      activePage, frames, projection, 'office-e2e-a', 'Office E2E A', ['#aa0002', '#aa0003'], false,
    )

    projection.reset()
    await activePage.close()
    activePage = await context.newPage()
    frames = captureWireFrames(activePage)
    projection = new RehydrationProjectionHarness()
    await activePage.goto('/')
    await switchAndProject(
      activePage,
      frames,
      projection,
      'office-e2e-a',
      'Office E2E A',
      ['#aa0002', '#aa0003'],
      false,
      true,
    )
    await expectWorkspaceHomeListing(activePage, 'a')
    await assertFileBackedPicker(activePage, ['#aa0002', '#aa0003'])
    const legacyAfterRestart = await legacyEvidence(activePage)
    expect(legacyAfterRestart.bytes).toBe(LEGACY_BYTES)
    expect(sha256(legacyAfterRestart.bytes ?? '')).toBe(sha256(LEGACY_BYTES))
    expect(legacyAfterRestart.accesses).toEqual([])
    assertExactBytes('a', EXTERNAL_A_BYTES)
    assertExactBytes('b', expected.b)
    assertExactBytes('c', expected.c)
    for (const suffix of ['a', 'b', 'c'] as const) {
      expect(fs.readdirSync(path.dirname(configPath(suffix))).filter((entry) => entry.startsWith('.colors-'))).toEqual([])
    }
  } finally {
    projection.reset()
  }
})

test('[slice 04R.2] still-mounted Office Home rehydrates exactly once through A to B to C to A', async ({ page }) => {
  test.setTimeout(120_000)
  await resetOfficePlaywrightScenario({
    scenario: 'palette', variant: 'global-selected', copies: 1, workspaces: 3,
  })
  const frames = captureWireFrames(page)
  await page.goto('/')
  await ensureWorkspace(page, 'office-e2e-a', 'Office E2E A')
  await openOfficeHome(page)

  for (const [workspaceId, label] of [
    ['office-e2e-b', 'Office E2E B'],
    ['office-e2e-c', 'Office E2E C'],
  ] as const) {
    const sentFrom = frames.sent.length
    await ensureWorkspace(page, workspaceId, label)
    await waitForFrame(frames.received, (frame) => isPaletteState(frame, workspaceId))
    await expect(page.getByTitle('001-Fixtures', { exact: true })).toBeVisible()
    const request = expectOneFileRequest(
      frames.sent,
      sentFrom,
      'file_tree_request',
      workspaceId,
      '',
    )
    expect(matchingFileResponse(frames.received, request)).toMatchObject({ success: true })
  }

  const sentBeforeTargetReturn = frames.sent.length
  await ensureWorkspace(page, 'office-e2e-a', 'Office E2E A')
  await waitForFrame(frames.received, (frame) => isPaletteState(frame, 'office-e2e-a'))
  await expect(page.getByTitle('001-Fixtures', { exact: true })).toBeVisible()
  const targetRequest = expectOneFileRequest(
    frames.sent,
    sentBeforeTargetReturn,
    'file_tree_request',
    'office-e2e-a',
    '',
  )
  expect(matchingFileResponse(frames.received, targetRequest)).toMatchObject({ success: true })
  await expect(page.locator('.rv-office-loading')).toHaveCount(0)
})

test('[slice 04R.2] same-named nested folder and open document restore across rapid A to B to A while late B tree and content stay stale', async ({ page }) => {
  test.setTimeout(120_000)
  const wire = await routeFileWire(page)
  await page.goto('/')

  await openWorkspaceDocument(page, 'office-e2e-a', 'Office E2E A', 'Palette-A.md')
  await expect(page.locator('.rv-office-document-editor')).toContainText('Before palette-a.')
  await openWorkspaceDocument(page, 'office-e2e-b', 'Office E2E B', 'Palette-B.md')
  await expect(page.locator('.rv-office-document-editor')).toContainText('Before palette-b.')
  await ensureWorkspace(page, 'office-e2e-a', 'Office E2E A')
  await expect(page.locator('.rv-office-document-filename')).toContainText('Palette-A.md')
  await expect(page.locator('.rv-office-document-editor')).toContainText('Before palette-a.')

  wire.holdWorkspaceId = 'office-e2e-b'
  const sentBeforeB = wire.sent.length
  await ensureWorkspace(page, 'office-e2e-b', 'Office E2E B')
  await waitForFrame(wire.sent, (frame) => isFileRequest(
    frame,
    'file_tree_request',
    'office-e2e-b',
    '001-Fixtures',
  ), sentBeforeB)
  await waitForFrame(wire.sent, (frame) => isFileRequest(
    frame,
    'file_content_request',
    'office-e2e-b',
    '001-Fixtures/Palette-B.md',
  ), sentBeforeB)

  const sentBeforeFinalA = wire.sent.length
  await ensureWorkspace(page, 'office-e2e-a', 'Office E2E A')
  await expect(page.locator('.rv-office-document-filename')).toContainText('Palette-A.md')
  await expect(page.locator('.rv-office-document-editor')).toContainText('Before palette-a.')

  const finalATree = expectOneFileRequest(
    wire.sent,
    sentBeforeFinalA,
    'file_tree_request',
    'office-e2e-a',
    '001-Fixtures',
  )
  const finalAContent = expectOneFileRequest(
    wire.sent,
    sentBeforeFinalA,
    'file_content_request',
    'office-e2e-a',
    '001-Fixtures/Palette-A.md',
  )
  expect(finalATree.generation).toBe(finalAContent.generation)
  expect(matchingFileResponse(wire.received, finalATree)).toMatchObject({ success: true })
  expect(matchingFileResponse(wire.received, finalAContent)).toMatchObject({ success: true })

  const heldB = wire.held.map((item) => item.frame)
  expect(heldB.some((frame) => frame.type === 'file_tree_response')).toBe(true)
  expect(heldB.some((frame) => frame.type === 'file_content_response')).toBe(true)
  wire.holdWorkspaceId = null
  wire.releaseHeld()
  await new Promise((resolve) => setTimeout(resolve, 300))
  await expect(page.locator('.rv-workspace-name')).toHaveText('Office E2E A')
  await expect(page.locator('.rv-office-document-filename')).toContainText('Palette-A.md')
  await expect(page.locator('.rv-office-document-editor')).toContainText('Before palette-a.')
  await expect(page.locator('.rv-office-document-editor')).not.toContainText('Before palette-b.')
  await expect(page.locator('.rv-office-loading')).toHaveCount(0)
})

test('[slice 04R.2] matching tree and content failures each settle once to Home and a later healthy switch recovers', async ({ page }) => {
  test.setTimeout(120_000)
  resetOfficeViewState('a')
  const wire = await routeFileWire(page)
  await page.goto('/')

  await ensureWorkspace(page, 'office-e2e-a', 'Office E2E A')
  await openOfficeHome(page)
  wire.failNextContentWorkspaceId = 'office-e2e-a'
  wire.failNextContentPanel = 'office-viewer'
  wire.failNextContentPath = '001-Fixtures/Palette-A.md'
  const sentBeforeFolderFailure = wire.sent.length
  await page.getByTitle('001-Fixtures', { exact: true }).click()
  await expect(page.getByTitle('Palette-A.md', { exact: true })).toBeVisible()
  await expect(page.locator('.rv-office-loading')).toHaveCount(0)
  const failedFolderContent = expectOneFileRequest(
    wire.sent,
    sentBeforeFolderFailure,
    'file_content_request',
    'office-e2e-a',
    '001-Fixtures/Palette-A.md',
  )
  expect(wire.injectedFailures).toContainEqual(expect.objectContaining({
    type: 'file_content_response',
    requestId: failedFolderContent.requestId,
    workspaceId: failedFolderContent.workspaceId,
    generation: failedFolderContent.generation,
    success: false,
  }))

  wire.failNextContentWorkspaceId = 'office-e2e-a'
  wire.failNextContentPanel = 'office-viewer'
  wire.failNextContentPath = '001-Fixtures/Palette-A.md'
  const sentBeforeSearchFailure = wire.sent.length
  await page.getByRole('searchbox', { name: 'Search office documents' }).fill('Palette-A')
  await page.getByRole('searchbox', { name: 'Search office documents' }).press('Enter')
  const failedSearchRequest = await waitForFrame(wire.sent, (frame) => isFileRequest(
    frame,
    'file_content_request',
    'office-e2e-a',
    '001-Fixtures/Palette-A.md',
  ), sentBeforeSearchFailure)
  await waitForFrame(wire.injectedFailures, (frame) => (
    frame.type === 'file_content_response'
    && frame.requestId === failedSearchRequest.requestId
    && frame.success === false
  ))
  await expect(page.getByText('Searching...', { exact: true })).toHaveCount(0)
  await expect(page.getByTitle('Palette-A.md', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Clear office search' }).click()

  await openWorkspaceDocument(page, 'office-e2e-c', 'Office E2E C', 'Palette-C.md')
  await expect(page.locator('.rv-office-document-editor')).toContainText('Before palette-c.')
  await ensureWorkspace(page, 'office-e2e-a', 'Office E2E A')
  await openOfficeHome(page)

  wire.failNextContentWorkspaceId = 'office-e2e-c'
  wire.failNextContentPanel = 'office-viewer'
  wire.failNextContentPath = '001-Fixtures/Palette-C.md'
  const sentBeforeFailure = wire.sent.length
  await ensureWorkspace(page, 'office-e2e-c', 'Office E2E C')
  await expect(page.getByTitle('001-Fixtures', { exact: true })).toBeVisible()
  await expect(page.locator('.rv-office-loading')).toHaveCount(0)

  const failedRequest = expectOneFileRequest(
    wire.sent,
    sentBeforeFailure,
    'file_content_request',
    'office-e2e-c',
    '001-Fixtures/Palette-C.md',
  )
  const originalResponse = matchingFileResponse(wire.received, failedRequest)
  expect(originalResponse).toMatchObject({ success: true })
  expect(wire.injectedFailures).toContainEqual(expect.objectContaining({
    type: 'file_content_response',
    requestId: failedRequest.requestId,
    workspaceId: failedRequest.workspaceId,
    generation: failedRequest.generation,
    success: false,
  }))
  expect(wire.failNextContentWorkspaceId).toBeNull()
  await new Promise((resolve) => setTimeout(resolve, 300))
  expect(wire.sent.slice(sentBeforeFailure).filter((frame) => isFileRequest(
    frame,
    'file_content_request',
    'office-e2e-c',
    '001-Fixtures/Palette-C.md',
  ))).toHaveLength(1)

  wire.failNextTreeWorkspaceId = 'office-e2e-b'
  wire.failNextTreePanel = 'office-viewer'
  wire.failNextTreePath = '001-Fixtures'
  const sentBeforeTreeFailure = wire.sent.length
  await ensureWorkspace(page, 'office-e2e-b', 'Office E2E B')
  await expect(page.getByTitle('001-Fixtures', { exact: true })).toBeVisible()
  await expect(page.locator('.rv-office-loading')).toHaveCount(0)
  const failedTreeRequest = expectOneFileRequest(
    wire.sent,
    sentBeforeTreeFailure,
    'file_tree_request',
    'office-e2e-b',
    '001-Fixtures',
  )
  expect(wire.injectedFailures).toContainEqual(expect.objectContaining({
    type: 'file_tree_response',
    requestId: failedTreeRequest.requestId,
    workspaceId: failedTreeRequest.workspaceId,
    generation: failedTreeRequest.generation,
    success: false,
  }))
  await new Promise((resolve) => setTimeout(resolve, 300))
  expect(wire.sent.slice(sentBeforeTreeFailure).filter((frame) => isFileRequest(
    frame,
    'file_tree_request',
    'office-e2e-b',
    '001-Fixtures',
  ))).toHaveLength(1)

  const sentBeforeRecovery = wire.sent.length
  await ensureWorkspace(page, 'office-e2e-a', 'Office E2E A')
  await expect(page.getByTitle('001-Fixtures', { exact: true })).toBeVisible()
  const recoveryTree = expectOneFileRequest(
    wire.sent,
    sentBeforeRecovery,
    'file_tree_request',
    'office-e2e-a',
    '',
  )
  expect(matchingFileResponse(wire.received, recoveryTree)).toMatchObject({ success: true })
  await expect(page.locator('.rv-office-loading')).toHaveCount(0)
})

test('[slice 04R.2] matching Email selected and Capture recent content failures settle without loading or request loops', async ({ page }) => {
  test.setTimeout(120_000)
  const wire = await routeFileWire(page)
  await page.goto('/')
  await ensureWorkspace(page, 'office-e2e-a', 'Office E2E A')
  await openOfficeHome(page)
  await new Promise((resolve) => setTimeout(resolve, 150))

  setFixtureEmailSelection('b', '009-Email-Fixture/Email-B.md')
  wire.failNextContentWorkspaceId = 'office-e2e-b'
  wire.failNextContentPanel = 'email-viewer'
  wire.failNextContentPath = '009-Email-Fixture/Email-B.md'
  const sentFrom = wire.sent.length
  await ensureWorkspace(page, 'office-e2e-b', 'Office E2E B')
  const failedRequest = await waitForFrame(wire.sent, (frame) => isFileRequest(
    frame,
    'file_content_request',
    'office-e2e-b',
    '009-Email-Fixture/Email-B.md',
    'email-viewer',
  ), sentFrom)
  await page.getByTitle('Email', { exact: true }).click()
  await expect(page.locator('.rv-panel[data-panel="email-viewer"].active')).toBeVisible()
  await waitForFrame(wire.injectedFailures, (frame) => (
    frame.type === 'file_content_response'
    && frame.requestId === failedRequest.requestId
    && frame.workspaceId === failedRequest.workspaceId
    && frame.generation === failedRequest.generation
    && frame.success === false
  ))
  await expect(page.locator('.rv-email-loading')).toHaveCount(0)
  await expect(page.locator('.rv-email-title')).toHaveText('Home')
  expectOneFileRequest(
    wire.sent,
    sentFrom,
    'file_content_request',
    'office-e2e-b',
    '009-Email-Fixture/Email-B.md',
    'email-viewer',
  )

  setFixtureCaptureRecent('c', 'Capture-C.md')
  wire.failNextContentWorkspaceId = 'office-e2e-c'
  wire.failNextContentPanel = 'capture-viewer'
  wire.failNextContentPath = '001-Fixtures/Capture-C.md'
  const sentBeforeCaptureFailure = wire.sent.length
  await ensureWorkspace(page, 'office-e2e-c', 'Office E2E C')
  const failedCaptureRequest = await waitForFrame(wire.sent, (frame) => isFileRequest(
    frame,
    'file_content_request',
    'office-e2e-c',
    '001-Fixtures/Capture-C.md',
    'capture-viewer',
  ), sentBeforeCaptureFailure)
  await waitForFrame(wire.injectedFailures, (frame) => (
    frame.type === 'file_content_response'
    && frame.requestId === failedCaptureRequest.requestId
    && frame.workspaceId === failedCaptureRequest.workspaceId
    && frame.generation === failedCaptureRequest.generation
    && frame.success === false
  ))
  await new Promise((resolve) => setTimeout(resolve, 300))
  expectOneFileRequest(
    wire.sent,
    sentBeforeCaptureFailure,
    'file_content_request',
    'office-e2e-c',
    '001-Fixtures/Capture-C.md',
    'capture-viewer',
  )
})

test('[slice 04R.2] still-mounted Captures root consumes the shared generation across A to B to A', async ({ page }) => {
  test.setTimeout(120_000)
  try {
    const frames = await routeFileWire(page)
    await page.goto('/')
    await ensureWorkspace(page, 'office-e2e-a', 'Office E2E A')
    await page.locator('.rv-tool-btn[title="Captures"]').click()
    await expect(page.locator('.rv-panel[data-panel="capture-viewer"].active')).toBeVisible()
    await expect(page.getByTitle('Capture-A.md', { exact: true })).toBeVisible()
    await waitForFixtureWorkspacePanel('a', 'capture-viewer')

    await ensureWorkspace(page, 'office-e2e-b', 'Office E2E B')
    await page.locator('.rv-tool-btn[title="Captures"]').click()
    await expect(page.locator('.rv-panel[data-panel="capture-viewer"].active')).toBeVisible()
    await expect(page.getByTitle('Capture-B.md', { exact: true })).toBeVisible()
    await waitForFixtureWorkspacePanel('b', 'capture-viewer')
    setFixtureWorkspacePanel('a', 'office-viewer')
    await ensureWorkspace(page, 'office-e2e-a', 'Office E2E A')
    await expect(page.locator('.rv-panel[data-panel="office-viewer"].active')).toBeVisible()
    await page.locator('.rv-tool-btn[title="Captures"]').click()
    await expect(page.locator('.rv-panel[data-panel="capture-viewer"].active')).toBeVisible()
    await expect(page.getByTitle('Capture-A.md', { exact: true })).toBeVisible()
    await waitForFixtureWorkspacePanel('a', 'capture-viewer')
    await waitForFixtureWorkspacePanel('b', 'capture-viewer')
    const receivedFrom = frames.received.length
    frames.refreshScreenshotPanels()
    await waitForFrame(frames.received, (frame) => {
      if (frame.type !== 'screenshot:list' || !Array.isArray(frame.activePanels)) return false
      const panels = new Map(frame.activePanels.map((row) => [
        (row as WireFrame).workspaceId,
        (row as WireFrame).activePanelId,
      ]))
      return panels.get('office-e2e-a') === 'capture-viewer'
        && panels.get('office-e2e-b') === 'capture-viewer'
    }, receivedFrom)
    await new Promise((resolve) => setTimeout(resolve, 150))

    for (const [workspaceId, label, filename] of [
      ['office-e2e-b', 'Office E2E B', 'Capture-B.md'],
      ['office-e2e-a', 'Office E2E A', 'Capture-A.md'],
    ] as const) {
      const sentFrom = frames.sent.length
      await ensureWorkspace(page, workspaceId, label)
      await expect(page.locator('.rv-panel[data-panel="capture-viewer"].active')).toBeVisible()
      await expect(page.getByTitle(filename, { exact: true })).toBeVisible()
      const request = await waitForFrame(frames.sent, (frame) => isFileRequest(
        frame,
        'file_tree_request',
        workspaceId,
        '',
        'capture-viewer',
      ), sentFrom)
      expectOneFileRequest(
        frames.sent,
        sentFrom,
        'file_tree_request',
        workspaceId,
        '',
        'capture-viewer',
      )
      expect(matchingFileResponse(frames.received, request)).toBeDefined()
    }
  } finally {
    if (!page.isClosed()) await page.close()
    await new Promise((resolve) => setTimeout(resolve, 250))
    for (const suffix of ['a', 'b', 'c'] as const) setFixtureWorkspacePanel(suffix, 'office-viewer')
  }
})
