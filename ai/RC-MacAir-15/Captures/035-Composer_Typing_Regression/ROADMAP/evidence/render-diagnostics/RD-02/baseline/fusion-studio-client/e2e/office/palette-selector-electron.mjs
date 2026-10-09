import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

import { OFFICE_E2E_MACHINE, captureOfficeFixtureMode } from './fixture-lifecycle.mjs'
import {
  OFFICE_E2E_OTHER_MACHINE,
  PALETTE_SELECTOR_SEEDS,
  canonicalGlobalPalette,
  canonicalLocalPalette,
  globalPalettePath,
  localPalettePath,
} from './palette-selector-fixtures.mjs'

const require = createRequire(import.meta.url)
const WebSocket = require('../../../fusion-studio-server/node_modules/ws')

function localPath(fixture, suffix, machineName = OFFICE_E2E_MACHINE) {
  return localPalettePath(fixture.workspaceRoots[suffix], machineName)
}

function globalPath(fixture) {
  return globalPalettePath(fixture.appUserData)
}

function snapshot(candidate) {
  const bytes = fs.readFileSync(candidate)
  return Object.freeze({ bytes, sha256: crypto.createHash('sha256').update(bytes).digest('hex') })
}

function assertSnapshot(candidate, expected, label) {
  const actual = snapshot(candidate)
  assert.equal(actual.sha256, expected.sha256, `${label} hash changed`)
  assert.deepEqual(actual.bytes, expected.bytes, `${label} bytes changed`)
}

function readJson(candidate) {
  return JSON.parse(fs.readFileSync(candidate, 'utf8'))
}

async function waitFor(read, accept, label, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs
  let value
  while (Date.now() < deadline) {
    try {
      value = await read()
      if (accept(value)) return value
    } catch { /* retry atomic/UI transition */ }
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  throw new Error(`Timed out waiting for ${label}: ${JSON.stringify(value)}`)
}

async function observer(fixture) {
  const port = await waitFor(
    () => Number(fs.readFileSync(path.join(fixture.appUserData, 'server.port'), 'utf8').trim()),
    (value) => Number.isInteger(value) && value > 0,
    'isolated server port',
  )
  const socket = new WebSocket(`ws://127.0.0.1:${port}`)
  const frames = []
  socket.on('message', (bytes) => {
    try {
      const frame = JSON.parse(bytes.toString())
      if (String(frame.type).startsWith('office:palette_')) frames.push(frame)
    } catch { /* unrelated frame */ }
  })
  await new Promise((resolve, reject) => {
    socket.once('open', resolve)
    socket.once('error', reject)
  })
  return Object.freeze({
    frames,
    request(frame) {
      const from = frames.length
      socket.send(JSON.stringify(frame))
      return waitFor(
        () => frames.slice(from).find((candidate) => candidate.requestId === frame.requestId),
        Boolean,
        `${frame.requestId} response`,
      )
    },
    close: () => new Promise((resolve) => {
      if (socket.readyState === WebSocket.CLOSED) return resolve()
      socket.once('close', resolve)
      socket.close()
    }),
  })
}

async function ensureWorkspace(page, suffix) {
  const label = `Office E2E ${suffix.toUpperCase()}`
  if (await page.locator('.rv-workspace-name').textContent() === label) return
  await page.getByTitle('Switch workspace').click()
  await page.locator(`.rv-workspace-ribbon-item[data-workspace-id="office-e2e-${suffix}"]`).click()
  await page.locator('.rv-workspace-name').filter({ hasText: label }).waitFor()
}

async function openDocument(page, suffix = 'a') {
  await ensureWorkspace(page, suffix)
  const expected = `Palette-${suffix.toUpperCase()}.md`
  const filename = page.locator('.rv-office-document-filename')
  const editor = page.locator('.rv-office-document-editor .milkdown .ProseMirror[contenteditable="true"]')
  if (!(await filename.isVisible()) || !(await filename.textContent())?.includes(expected)) {
    await page.getByTitle('Office', { exact: true }).click()
    const back = page.getByTitle('Back', { exact: true })
    if (await back.count()) await back.click()
    const home = page.getByTitle('Home', { exact: true })
    if (await home.count()) await home.click()
    const folder = page.getByTitle('001-Fixtures', { exact: true })
    const file = page.getByTitle(expected, { exact: true })
    if (!(await file.isVisible())) await folder.click()
    await file.click()
    await filename.filter({ hasText: expected }).waitFor()
  }
  return editor.locator('table.rv-office-table').first()
}

async function openPalette(page, table) {
  if (await page.locator('.rv-office-color-popover').count()) await page.keyboard.press('Escape')
  await table.locator('tbody > tr').nth(1).locator('td, th').first().click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Cell Background' }).click()
  await page.locator('.rv-office-color-popover').waitFor()
}

async function assertColors(page, table, colors) {
  await openPalette(page, table)
  assert.equal(await page.locator('.rv-office-color-custom .rv-office-color-swatch').count(), Math.min(20, colors.length))
  for (const color of colors.slice(0, 20)) {
    assert.equal(await page.locator(`.rv-office-color-custom .rv-office-color-swatch[title="${color}"]`).count(), 1)
  }
}

async function add(page, table, color) {
  await openPalette(page, table)
  await page.locator('.rv-office-color-add').click()
  await page.getByLabel('Custom color hex').fill(color)
  await page.getByTitle('Save custom color').click()
}

async function remove(page, table, color) {
  await openPalette(page, table)
  await page.locator(`.rv-office-color-custom .rv-office-color-swatch[title="${color}"]`).click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Remove', exact: true }).click()
}

async function toggle(page, table, enable) {
  await openPalette(page, table)
  await page.getByRole('button', { name: enable ? 'Sync Disabled' : 'Sync Enabled', exact: true }).click()
}

export function preparePaletteElectronRelaunch(fixture, variant, relaunch) {
  if (variant !== 'machine-move' || relaunch !== 2) return OFFICE_E2E_MACHINE
  fs.writeFileSync(globalPath(fixture), PALETTE_SELECTOR_SEEDS['machine-move'].otherMachineGlobal)
  return OFFICE_E2E_OTHER_MACHINE
}

export async function runPaletteSelectorElectronVariant({ fixture, page, relaunch, variant }) {
  const local = localPath(fixture, 'a', variant === 'machine-move' && relaunch === 2
    ? OFFICE_E2E_OTHER_MACHINE
    : OFFICE_E2E_MACHINE)
  const global = globalPath(fixture)
  let table = await openDocument(page)
  if (variant === 'global-selected') {
    const localBefore = snapshot(local)
    await assertColors(page, table, ['#112233', '#445566'])
    assert.equal(await page.locator('.rv-office-color-swatch[title="#aa0001"]').count(), 0)
    assertSnapshot(local, localBefore, 'divergent local')
  } else if (variant === 'local-selected') {
    const globalBefore = snapshot(global)
    await assertColors(page, table, ['#aa0001'])
    assertSnapshot(global, globalBefore, 'unselected global')
  } else if (variant === 'selected-mutations') {
    const globalBefore = snapshot(global)
    await add(page, table, '#123456')
    await waitFor(() => readJson(local).custom_colors, (value) => value.includes('#123456'), 'local add')
    assertSnapshot(global, globalBefore, 'global after local add')
    await remove(page, table, '#aa0001')
    await waitFor(() => readJson(local).custom_colors, (value) => !value.includes('#aa0001'), 'local remove')
    assertSnapshot(global, globalBefore, 'global after local remove')
    await toggle(page, table, true)
    await waitFor(() => readJson(local).sync_enabled, Boolean, 'sync enabled before global mutations')
    const localBeforeGlobal = snapshot(local)
    await add(page, table, '#234567')
    await waitFor(() => readJson(global).custom_colors, (value) => value.includes('#234567'), 'global add')
    assertSnapshot(local, localBeforeGlobal, 'local after global add')
    await remove(page, table, '#112233')
    await waitFor(() => readJson(global).custom_colors, (value) => !value.includes('#112233'), 'global remove')
    assertSnapshot(local, localBeforeGlobal, 'local after global remove')
  } else if (variant === 'toggle-selector') {
    const localArray = [...readJson(local).custom_colors]
    const globalArray = [...readJson(global).custom_colors]
    await assertColors(page, table, localArray)
    await toggle(page, table, true)
    await waitFor(() => readJson(local).sync_enabled, Boolean, 'sync enabled')
    assert.deepEqual(readJson(local).custom_colors, localArray)
    assert.deepEqual(readJson(global).custom_colors, globalArray)
    await assertColors(page, table, globalArray)
    await toggle(page, table, false)
    await waitFor(() => !readJson(local).sync_enabled, Boolean, 'sync disabled')
    assert.deepEqual(readJson(local).custom_colors, localArray)
    assert.deepEqual(readJson(global).custom_colors, globalArray)
    await assertColors(page, table, localArray)
  } else if (variant === 'workspace-cycle') {
    const passive = await observer(fixture)
    try {
      for (const [suffix, colors] of [['a', ['#112233']], ['b', ['#00bb02']], ['c', ['#112233']], ['a', ['#112233']]]) {
        table = await openDocument(page, suffix)
        await assertColors(page, table, colors)
        await page.keyboard.press('Escape')
      }
      await ensureWorkspace(page, 'b')
      const from = passive.frames.length
      fs.writeFileSync(global, canonicalGlobalPalette(['#334455']))
      fs.writeFileSync(localPath(fixture, 'b'), canonicalLocalPalette(['#00bb03'], false))
      await new Promise((resolve) => setTimeout(resolve, 600))
      assert.deepEqual(passive.frames.slice(from), [])
      table = await openDocument(page, 'a'); await assertColors(page, table, ['#334455']); await page.keyboard.press('Escape')
      table = await openDocument(page, 'b'); await assertColors(page, table, ['#00bb03'])
    } finally { await passive.close() }
  } else if (variant === 'machine-move') {
    if (relaunch === 1) await assertColors(page, table, ['#112233'])
    else {
      await assertColors(page, table, ['#778899'])
      await toggle(page, table, false)
      await waitFor(() => !readJson(local).sync_enabled, Boolean, 'other-machine local selector')
      await assertColors(page, table, ['#abcdef'])
    }
  } else if (variant === 'selected-source-errors') {
    const probe = await observer(fixture)
    const globalBefore = snapshot(global)
    const localBefore = snapshot(local)
    try {
      const malformed = await probe.request({ type: 'office:palette_get', requestId: 'electron-malformed', workspaceId: 'office-e2e-a' })
      assert.equal(malformed.code, 'INVALID_SCHEMA')
      assertSnapshot(global, globalBefore, 'malformed global')
      assertSnapshot(local, localBefore, 'ignored local')
      fs.writeFileSync(global, canonicalGlobalPalette(['#112233']))
      fs.writeFileSync(local, canonicalLocalPalette(['#aa0001'], false))
      const mode = fs.statSync(local).mode & 0o7777
      captureOfficeFixtureMode(fixture, local)
      fs.chmodSync(local, 0o444)
      const readOnlyLocal = snapshot(local)
      const validGlobal = snapshot(global)
      const failure = await probe.request({ type: 'office:palette_add', requestId: 'electron-read-only', workspaceId: 'office-e2e-a', color: '#123456' })
      assert.equal(failure.code, 'READ_ONLY')
      assertSnapshot(local, readOnlyLocal, 'read-only local')
      assertSnapshot(global, validGlobal, 'unselected global')
      fs.chmodSync(local, mode)
    } finally { await probe.close() }
  } else if (variant === 'shutdown-cleanup') {
    await assertColors(page, table, ['#112233'])
    assertNoRetiredPaletteArtifacts(fixture.root)
  } else {
    throw new Error(`Unhandled selector Electron variant: ${variant}`)
  }
}

export function assertNoRetiredPaletteArtifacts(root) {
  const forbidden = /palette-(?:config-watcher|sync-coordinator|removal-journal)|office-palette-removal-journal|\.colors\.json\..+\.tmp$/
  const matches = []
  const visit = (candidate) => {
    if (!fs.existsSync(candidate)) return
    for (const entry of fs.readdirSync(candidate, { withFileTypes: true })) {
      const child = path.join(candidate, entry.name)
      if (forbidden.test(entry.name)) matches.push(child)
      if (entry.isDirectory()) visit(child)
    }
  }
  visit(root)
  assert.deepEqual(matches, [], 'retired palette watcher/coordinator/journal/temp artifacts')
}

export function paletteSelectorFileEvidence(fixture, machineName = OFFICE_E2E_MACHINE) {
  const candidates = [
    ['global', globalPath(fixture)],
    ...Object.keys(fixture.workspaceRoots).sort().map((suffix) => [
      `local-${suffix}`,
      localPath(fixture, suffix, machineName),
    ]),
  ]
  return candidates.map(([kind, candidate]) => {
    if (!fs.existsSync(candidate)) return { kind, path: candidate, missing: true }
    const state = snapshot(candidate)
    return {
      kind,
      path: candidate,
      sha256: state.sha256,
      utf8: state.bytes.toString('utf8'),
    }
  })
}
