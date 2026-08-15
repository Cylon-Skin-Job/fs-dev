import fs from 'node:fs'
import path from 'node:path'

import { expect, test, type BrowserContext, type Page } from '@playwright/test'

import {
  OfficePaletteClientController,
  OfficePaletteMutationError,
  type OfficePaletteSocket,
} from '../src/lib/ws/office-palette-handlers'
import {
  OFFICE_PALETTE_VISIBLE_LIMIT,
  projectOfficePaletteColors,
  useOfficePaletteStore,
} from '../src/state/officePaletteStore'
import type { OfficePaletteOperation, WebSocketMessage } from '../src/types'
import { OFFICE_E2E_MACHINE, resetOfficePlaywrightScenario } from './office/fixture-lifecycle.mjs'

const LEGACY_KEY = 'rv-office-table-custom-colors'
const LEGACY_BYTES = '["#123456","#654321"]'

function colors(count: number): string[] {
  return Array.from({ length: count }, (_, index) => `#${index.toString(16).padStart(6, '0')}`)
}

function stateMessage(
  workspaceId: string,
  requestId: string,
  customColors: string[],
  operation: OfficePaletteOperation = 'get',
  syncEnabled = true,
): WebSocketMessage {
  return {
    type: 'office:palette_state',
    requestId,
    workspaceId,
    customColors,
    syncEnabled,
    source: operation === 'get' ? 'request' : 'mutation',
    operation,
    availability: 'ready',
    syncStatus: 'ok',
  } as WebSocketMessage
}

function safeErrorMessage(
  workspaceId: string,
  requestId: string,
  operation: OfficePaletteOperation,
  code: 'INVALID_SCHEMA' | 'READ_FAILED' | 'PALETTE_LIMIT',
  syncEnabled = true,
): WebSocketMessage {
  return {
    type: 'office:palette_error',
    requestId,
    workspaceId,
    operation,
    code,
    message: 'Safe palette error.',
    state: {
      customColors: [],
      syncEnabled,
      source: 'error',
      availability: 'unavailable',
      syncStatus: 'degraded',
    },
  } as WebSocketMessage
}

function makeHarness(initialWorkspaceId: string | null, requestIds: string[] = []) {
  let activeWorkspaceId = initialWorkspaceId
  const sent: Array<Record<string, unknown>> = []
  const socket: OfficePaletteSocket = {
    readyState: 1,
    send: (serialized) => sent.push(JSON.parse(serialized) as Record<string, unknown>),
  }
  const ids = [...requestIds]
  const controller = new OfficePaletteClientController({
    getActiveWorkspaceId: () => activeWorkspaceId,
    getPaletteStore: () => useOfficePaletteStore.getState(),
    createRequestId: () => ids.shift() ?? `request-${sent.length + 1}`,
  })
  const switchWorkspace = (workspaceId: string | null) => {
    activeWorkspaceId = workspaceId
    controller.onWorkspaceChanged(workspaceId)
  }
  return { controller, sent, socket, switchWorkspace }
}

test.beforeEach(() => {
  useOfficePaletteStore.getState().reset()
})

test.describe('[slice 05S.2] direct selector client protocol', () => {
  for (const count of [0, 19, 20, 21, 25]) {
    test(`projects ${count} selected colors to the authoritative first-20 surface`, () => {
      const projection = projectOfficePaletteColors(colors(count))
      expect(projection).toEqual(colors(count).slice(0, OFFICE_PALETTE_VISIBLE_LIMIT))
      expect(projection.length < OFFICE_PALETTE_VISIBLE_LIMIT).toBe(count < OFFICE_PALETTE_VISIBLE_LIMIT)
    })
  }

  test('requests once per open, switch, reconnect, and explicit refresh and rejects every stale reply', () => {
    const harness = makeHarness('workspace-a', ['a-open', 'b-switch', 'b-refresh', 'b-reconnect'])
    harness.controller.onSocketOpen(harness.socket)
    harness.controller.onWorkspaceChanged('workspace-a')
    expect(harness.sent).toEqual([
      { type: 'office:palette_get', requestId: 'a-open', workspaceId: 'workspace-a' },
    ])

    harness.switchWorkspace('workspace-b')
    harness.controller.handleMessage(stateMessage('workspace-a', 'a-open', ['#aaaaaa']))
    expect(useOfficePaletteStore.getState().byWorkspace['workspace-a']?.customColors).toEqual([])

    harness.controller.refreshCurrentState()
    harness.controller.handleMessage(stateMessage('workspace-b', 'b-switch', ['#bbbb01']))
    expect(useOfficePaletteStore.getState().byWorkspace['workspace-b']?.customColors).toEqual([])
    harness.controller.handleMessage(stateMessage('workspace-b', 'b-refresh', ['#bbbb02'], 'get', false))
    expect(useOfficePaletteStore.getState().byWorkspace['workspace-b']).toMatchObject({
      customColors: ['#bbbb02'], syncEnabled: false, source: 'request', isLoading: false,
    })

    harness.controller.onSocketClose(harness.socket)
    const replacement: OfficePaletteSocket = { ...harness.socket }
    harness.controller.onSocketOpen(replacement)
    harness.controller.handleMessage(stateMessage('workspace-b', 'b-refresh', ['#bbbb03']))
    expect(useOfficePaletteStore.getState().byWorkspace['workspace-b']?.customColors).toEqual(['#bbbb02'])
    harness.controller.handleMessage(stateMessage('workspace-b', 'b-reconnect', ['#bbbb04']))
    expect(useOfficePaletteStore.getState().byWorkspace['workspace-b']?.customColors).toEqual(['#bbbb04'])

    expect(harness.sent).toEqual([
      { type: 'office:palette_get', requestId: 'a-open', workspaceId: 'workspace-a' },
      { type: 'office:palette_get', requestId: 'b-switch', workspaceId: 'workspace-b' },
      { type: 'office:palette_get', requestId: 'b-refresh', workspaceId: 'workspace-b' },
      { type: 'office:palette_get', requestId: 'b-reconnect', workspaceId: 'workspace-b' },
    ])
  })

  test('sends exact Add, Remove, and selector intents and applies only matching acknowledgements', async () => {
    const harness = makeHarness('workspace-a', ['get', 'add', 'remove', 'toggle'])
    harness.controller.onSocketOpen(harness.socket)
    harness.controller.handleMessage(stateMessage('workspace-a', 'get', ['#100001'], 'get', false))

    const add = harness.controller.mutate('add', '#200002')
    harness.controller.handleMessage(stateMessage('workspace-a', 'add', ['#badbad'], 'remove', false))
    expect(useOfficePaletteStore.getState().byWorkspace['workspace-a']?.customColors).toEqual(['#100001'])
    harness.controller.handleMessage(stateMessage('workspace-a', 'add', ['#100001', '#200002'], 'add', false))
    await expect(add).resolves.toMatchObject({ operation: 'add', customColors: ['#100001', '#200002'] })

    const remove = harness.controller.mutate('remove', '#100001')
    harness.controller.handleMessage(stateMessage('workspace-a', 'remove', ['#200002'], 'remove', false))
    await expect(remove).resolves.toMatchObject({ operation: 'remove', customColors: ['#200002'] })

    const toggle = harness.controller.mutate('set_sync', true)
    harness.controller.handleMessage(stateMessage('workspace-a', 'toggle', ['#300003'], 'set_sync', true))
    await expect(toggle).resolves.toMatchObject({ operation: 'set_sync', syncEnabled: true })
    expect(useOfficePaletteStore.getState().byWorkspace['workspace-a']).toMatchObject({
      customColors: ['#300003'], syncEnabled: true, source: 'mutation', error: null,
    })
    expect(harness.sent.slice(1)).toEqual([
      { type: 'office:palette_add', requestId: 'add', workspaceId: 'workspace-a', color: '#200002' },
      { type: 'office:palette_remove', requestId: 'remove', workspaceId: 'workspace-a', color: '#100001' },
      { type: 'office:palette_set_sync', requestId: 'toggle', workspaceId: 'workspace-a', enabled: true },
    ])
  })

  test('serializes each workspace operation and ignores out-of-order operation acknowledgements', async () => {
    const harness = makeHarness('workspace-a', ['get', 'toggle', 'unused'])
    harness.controller.onSocketOpen(harness.socket)
    harness.controller.handleMessage(stateMessage('workspace-a', 'get', ['#100001'], 'get', false))

    const toggle = harness.controller.mutate('set_sync', true)
    const overlappingAdd = harness.controller.mutate('add', '#200002')
    await expect(overlappingAdd).rejects.toMatchObject({ code: 'INVALID_REQUEST', operation: 'add' })
    expect(harness.controller.refreshCurrentState()).toBeNull()
    expect(harness.sent.slice(1)).toEqual([
      { type: 'office:palette_set_sync', requestId: 'toggle', workspaceId: 'workspace-a', enabled: true },
    ])

    harness.controller.handleMessage(stateMessage('workspace-a', 'toggle', ['#badbad'], 'add', false))
    expect(useOfficePaletteStore.getState().byWorkspace['workspace-a']).toMatchObject({
      customColors: ['#100001'], syncEnabled: false, isLoading: true,
    })
    harness.controller.handleMessage(stateMessage('workspace-a', 'toggle', ['#300003'], 'set_sync', true))
    await expect(toggle).resolves.toMatchObject({ customColors: ['#300003'], syncEnabled: true })
    expect(useOfficePaletteStore.getState().byWorkspace['workspace-a']).toMatchObject({
      customColors: ['#300003'], syncEnabled: true, isLoading: false,
    })
  })

  test('keeps selected-source errors honest and rejects stale mutation targets without projection', async () => {
    const harness = makeHarness('workspace-a', ['get', 'add', 'b-get'])
    harness.controller.onSocketOpen(harness.socket)
    harness.controller.handleMessage(safeErrorMessage('workspace-a', 'get', 'get', 'INVALID_SCHEMA', false))
    expect(useOfficePaletteStore.getState().byWorkspace['workspace-a']).toMatchObject({
      customColors: [], syncEnabled: false, source: 'error', availability: 'unavailable',
      syncStatus: 'degraded', error: { code: 'INVALID_SCHEMA', operation: 'get' }, isLoading: false,
    })

    const mutation = harness.controller.mutate('add', '#123456')
    harness.switchWorkspace('workspace-b')
    await expect(mutation).rejects.toBeInstanceOf(OfficePaletteMutationError)
    harness.controller.handleMessage(stateMessage('workspace-a', 'add', ['#123456'], 'add', false))
    expect(useOfficePaletteStore.getState().byWorkspace['workspace-a']?.customColors).toEqual([])
  })

  test('consumes but never projects unsolicited or retired protocol shapes', () => {
    const harness = makeHarness('workspace-a', ['get'])
    harness.controller.onSocketOpen(harness.socket)
    const before = structuredClone(useOfficePaletteStore.getState().byWorkspace)
    const rejected = [
      { ...stateMessage('workspace-a', 'get', []), requestId: undefined },
      { ...stateMessage('workspace-a', 'get', []), source: 'watch', operation: 'watch_read' },
      { ...stateMessage('workspace-a', 'get', []), syncStatus: 'reconciling' },
      stateMessage('workspace-a', 'get', ['#badbad'], 'add'),
      { ...safeErrorMessage('workspace-a', 'get', 'get', 'READ_FAILED'), failedWorkspaceIds: ['workspace-b'] },
    ] as WebSocketMessage[]
    for (const message of rejected) expect(harness.controller.handleMessage(message)).toBe(true)
    expect(useOfficePaletteStore.getState().byWorkspace).toEqual(before)
    harness.controller.handleMessage(stateMessage('workspace-a', 'get', ['#100001']))
    expect(useOfficePaletteStore.getState().byWorkspace['workspace-a']?.customColors).toEqual(['#100001'])
  })

  test('production palette paths contain no retired protocol, legacy storage, or document scraping', () => {
    const root = process.cwd()
    const protocolFiles = [
      'src/types/index.ts',
      'src/state/officePaletteStore.ts',
      'src/lib/ws/office-palette-handlers.ts',
      'src/lib/ws-client.ts',
    ]
    const protocol = protocolFiles.map((file) => fs.readFileSync(path.join(root, file), 'utf8')).join('\n')
    expect(protocol).not.toMatch(/watch_read|registry_read|watch_reconcile|registry_reconcile|reconcile|retry/)
    expect(protocol).not.toMatch(/failedWorkspaceIds|unsolicitedRevision|REMOVAL_JOURNAL|SYNC_PARTIAL|SYNC_CONTRIBUTOR/)

    const picker = [
      'src/components/office/officeColorPopover.ts',
      'src/components/office/officeCustomColorEditor.ts',
      'src/components/office/useCrepeEditor.ts',
    ].map((file) => fs.readFileSync(path.join(root, file), 'utf8')).join('\n')
    expect(picker).not.toMatch(/localStorage|rv-office-table-custom-colors|scrapeMetadataHexColors|getDocumentColors/)
    for (const file of [
      'src/components/office/officeColorPopover.ts',
      'src/components/office/officeCustomColorEditor.ts',
      'src/components/office/officeGooglePalette.ts',
      'src/lib/ws/office-palette-handlers.ts',
      'src/state/officePaletteStore.ts',
    ]) {
      expect(fs.readFileSync(path.join(root, file), 'utf8').split('\n').length).toBeLessThanOrEqual(401)
    }
  })
})

function fixtureRoot(): string {
  const root = process.env.FUSION_OFFICE_E2E_FIXTURE_ROOT
  if (!root) throw new Error('FUSION_OFFICE_E2E_FIXTURE_ROOT is not set')
  return path.resolve(root)
}

function localPalettePath(): string {
  return path.join(
    fixtureRoot(), 'workspace-a', 'ai', OFFICE_E2E_MACHINE, 'System', 'config', 'colors.json',
  )
}

function globalPalettePath(): string {
  return path.join(
    fixtureRoot(), 'user-data', 'System_Manager', 'global-configs',
    'office-custom-color-pallete', 'colors.json',
  )
}

function readJson(candidate: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(candidate, 'utf8')) as Record<string, unknown>
}

async function installLegacyProbe(context: BrowserContext): Promise<void> {
  await context.addInitScript(({ key, bytes }) => {
    const get = Storage.prototype.getItem
    const set = Storage.prototype.setItem
    const remove = Storage.prototype.removeItem
    const clear = Storage.prototype.clear
    set.call(window.localStorage, key, bytes)
    const target = window as typeof window & {
      __paletteLegacyAccesses?: string[]
      __paletteLegacyBytes?: () => string | null
    }
    target.__paletteLegacyAccesses = []
    target.__paletteLegacyBytes = () => get.call(window.localStorage, key)
    Storage.prototype.getItem = function getItem(candidate) {
      if (this === window.localStorage && candidate === key) target.__paletteLegacyAccesses?.push('getItem')
      return get.call(this, candidate)
    }
    Storage.prototype.setItem = function setItem(candidate, value) {
      if (this === window.localStorage && candidate === key) target.__paletteLegacyAccesses?.push('setItem')
      return set.call(this, candidate, value)
    }
    Storage.prototype.removeItem = function removeItem(candidate) {
      if (this === window.localStorage && candidate === key) target.__paletteLegacyAccesses?.push('removeItem')
      return remove.call(this, candidate)
    }
    Storage.prototype.clear = function clearStorage() {
      if (this === window.localStorage) target.__paletteLegacyAccesses?.push('clear')
      return clear.call(this)
    }
  }, { key: LEGACY_KEY, bytes: LEGACY_BYTES })
}

async function openPalette(page: Page) {
  const editor = page.locator('.rv-office-document-editor .milkdown .ProseMirror[contenteditable="true"]')
  const table = editor.locator('table.rv-office-table').first()
  await table.locator('tbody > tr').nth(1).locator('td, th').first().click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Cell Background' }).click()
  return { editor, table }
}

test('[slice 05S.2] picker cutover Add Remove toggle Undo and legacy/config separation', async ({ context, page }) => {
  test.setTimeout(180_000)
  const paletteFrames: Array<{ direction: 'sent' | 'received', frame: Record<string, unknown> }> = []
  page.on('websocket', (socket) => {
    const capture = (direction: 'sent' | 'received', payload: string | Buffer) => {
      try {
        const frame = JSON.parse(payload.toString()) as Record<string, unknown>
        if (typeof frame.type === 'string' && frame.type.startsWith('office:palette_')) {
          paletteFrames.push({ direction, frame })
        }
      } catch {
        // Malformed protocol frames are covered by the controller tests above.
      }
    }
    socket.on('framesent', ({ payload }) => capture('sent', payload))
    socket.on('framereceived', ({ payload }) => capture('received', payload))
  })
  await resetOfficePlaywrightScenario({ scenario: 'palette', variant: 'local-selected', copies: 1, workspaces: 3 })
  const globalBefore = fs.readFileSync(globalPalettePath())
  await installLegacyProbe(context)
  await page.goto('/')
  await expect(page.locator('.rv-workspace-name')).toHaveText('Office E2E A')
  await page.getByTitle('Office', { exact: true }).click()
  await page.getByTitle('001-Fixtures', { exact: true }).click()
  await page.getByTitle('Palette-A.md', { exact: true }).click()

  const { editor, table } = await openPalette(page)
  const popover = page.locator('.rv-office-color-popover')
  await expect(popover.locator('.rv-office-color-none')).toHaveCount(1)
  await expect(popover.locator('.rv-office-color-grid .rv-office-color-swatch')).toHaveCount(80)
  await expect(popover.locator('.rv-office-color-sync')).toHaveAttribute('aria-label', 'Sync Disabled')
  await expect(popover.locator('.rv-office-color-custom .rv-office-color-swatch')).toHaveCount(1)
  await expect(popover.locator('.rv-office-color-add')).toHaveCount(1)
  const order = await popover.evaluate((element) => Array.from(element.children).map((child) => child.className))
  expect(order).toEqual([
    'rv-office-color-default-section',
    'rv-office-color-divider',
    'rv-office-color-sync',
    'rv-office-color-row rv-office-color-custom',
    'rv-office-color-custom-editor',
  ])

  await popover.locator('.rv-office-color-sync').click()
  await expect.poll(() => paletteFrames.filter(({ frame }) => frame.type === 'office:palette_set_sync')).toHaveLength(1)
  const syncIntent = paletteFrames.find(({ frame }) => frame.type === 'office:palette_set_sync')!.frame
  await expect.poll(() => paletteFrames.find(({ direction, frame }) => (
    direction === 'received' && frame.requestId === syncIntent.requestId
  ))?.frame).toMatchObject({
    type: 'office:palette_state', operation: 'set_sync', syncEnabled: true,
  })
  await expect.poll(() => readJson(localPalettePath()).sync_enabled).toBe(true)
  await expect(popover.locator('.rv-office-color-sync')).toHaveAttribute('aria-label', 'Sync Enabled')
  await expect(popover.locator('.rv-office-color-custom .rv-office-color-swatch')).toHaveCount(2)
  expect(readJson(localPalettePath())).toEqual({ custom_colors: ['#aa0001'], sync_enabled: true })
  expect(fs.readFileSync(globalPalettePath())).toEqual(globalBefore)
  await popover.locator('.rv-office-color-sync').click()
  await expect(popover.locator('.rv-office-color-sync')).toHaveAttribute('aria-label', 'Sync Disabled')
  await expect(popover.locator('.rv-office-color-custom .rv-office-color-swatch[title="#aa0001"]')).toHaveCount(1)

  await popover.locator('.rv-office-color-add').click()
  await popover.getByRole('textbox', { name: 'Custom color hex' }).fill('#123456')
  await popover.locator('.rv-office-color-commit').click()
  await expect.poll(() => readJson(localPalettePath()).custom_colors).toEqual(['#aa0001', '#123456'])
  await expect(popover).toHaveCount(0)
  const target = table.locator('tbody > tr').nth(1).locator('td, th').first()
  await expect.poll(() => target.evaluate((cell) => getComputedStyle(cell).backgroundColor)).toBe('rgb(18, 52, 86)')

  await openPalette(page)
  const custom = page.locator('.rv-office-color-custom .rv-office-color-swatch[title="#123456"]')
  await custom.focus()
  await custom.press('Shift+F10')
  await expect(page.getByRole('menuitem', { name: 'Remove', exact: true })).toHaveCount(1)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('menuitem', { name: 'Remove', exact: true })).toHaveCount(0)
  expect(readJson(localPalettePath()).custom_colors).toEqual(['#aa0001', '#123456'])
  await custom.click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Remove', exact: true }).click()
  await expect.poll(() => readJson(localPalettePath()).custom_colors).toEqual(['#aa0001'])
  await expect.poll(() => target.evaluate((cell) => getComputedStyle(cell).backgroundColor)).toBe('rgb(18, 52, 86)')

  await editor.focus()
  await page.keyboard.press('Meta+z')
  await expect.poll(() => target.evaluate((cell) => getComputedStyle(cell).backgroundColor)).not.toBe('rgb(18, 52, 86)')
  expect(readJson(localPalettePath()).custom_colors).toEqual(['#aa0001'])
  const legacy = await page.evaluate(() => {
    const targetWindow = window as typeof window & {
      __paletteLegacyAccesses?: string[]
      __paletteLegacyBytes?: () => string | null
    }
    return { accesses: targetWindow.__paletteLegacyAccesses, bytes: targetWindow.__paletteLegacyBytes?.() }
  })
  expect(legacy).toEqual({ accesses: [], bytes: LEGACY_BYTES })
})
