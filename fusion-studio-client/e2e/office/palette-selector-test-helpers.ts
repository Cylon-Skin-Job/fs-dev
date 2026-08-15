import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

import { expect, type Page } from '@playwright/test'

import { OFFICE_E2E_MACHINE } from './fixture-lifecycle.mjs'
import { globalPalettePath, localPalettePath } from './palette-selector-fixtures.mjs'

export type WorkspaceSuffix = 'a' | 'b' | 'c'
export type PaletteFrame = Record<string, unknown>

export function fixtureRoot(): string {
  const root = process.env.FUSION_OFFICE_E2E_FIXTURE_ROOT
  if (!root) throw new Error('FUSION_OFFICE_E2E_FIXTURE_ROOT is not set')
  return path.resolve(root)
}

export function fixturePath(candidate: string): string {
  const root = fixtureRoot()
  const resolved = path.resolve(candidate)
  const relative = path.relative(root, resolved)
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Palette test path escapes its isolated fixture root: ${resolved}`)
  }
  return resolved
}

export function localPath(suffix: WorkspaceSuffix, machineName = OFFICE_E2E_MACHINE): string {
  return fixturePath(localPalettePath(path.join(fixtureRoot(), `workspace-${suffix}`), machineName))
}

export function globalPath(): string {
  return fixturePath(globalPalettePath(path.join(fixtureRoot(), 'user-data')))
}

export function readJson(candidate: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(fixturePath(candidate), 'utf8')) as Record<string, unknown>
}

export function snapshot(candidate: string): { bytes: Buffer; sha256: string } {
  const bytes = fs.readFileSync(fixturePath(candidate))
  return { bytes, sha256: crypto.createHash('sha256').update(bytes).digest('hex') }
}

export function expectSnapshot(candidate: string, expected: ReturnType<typeof snapshot>): void {
  const actual = snapshot(candidate)
  expect(actual.sha256).toBe(expected.sha256)
  expect(actual.bytes).toEqual(expected.bytes)
}

export function atomicReplace(candidate: string, bytes: string): void {
  const destination = fixturePath(candidate)
  const directory = fixturePath(path.dirname(destination))
  fs.mkdirSync(directory, { recursive: true })
  const temporary = fixturePath(path.join(directory, `.selector-${crypto.randomUUID()}.tmp`))
  const handle = fs.openSync(temporary, 'wx', 0o600)
  try {
    fs.writeFileSync(handle, bytes)
    fs.fsyncSync(handle)
  } finally {
    fs.closeSync(handle)
  }
  fs.renameSync(temporary, destination)
}

export function capturePaletteWire(page: Page): { received: PaletteFrame[]; sent: PaletteFrame[] } {
  const frames = { received: [] as PaletteFrame[], sent: [] as PaletteFrame[] }
  page.on('websocket', (socket) => {
    const capture = (target: PaletteFrame[], payload: string | Buffer) => {
      if (typeof payload !== 'string') return
      try {
        const frame = JSON.parse(payload) as PaletteFrame
        if (String(frame.type).startsWith('office:palette_')) target.push(frame)
      } catch { /* unrelated wire traffic */ }
    }
    socket.on('framesent', ({ payload }) => capture(frames.sent, payload))
    socket.on('framereceived', ({ payload }) => capture(frames.received, payload))
  })
  return frames
}

export async function waitForFrame(
  frames: PaletteFrame[],
  predicate: (frame: PaletteFrame) => boolean,
  from = 0,
): Promise<PaletteFrame> {
  let match: PaletteFrame | undefined
  await expect.poll(() => {
    match = frames.slice(from).find(predicate)
    return Boolean(match)
  }, { timeout: 15_000 }).toBe(true)
  return match!
}

export async function ensureWorkspace(page: Page, suffix: WorkspaceSuffix): Promise<void> {
  const label = `Office E2E ${suffix.toUpperCase()}`
  if (await page.locator('.rv-workspace-name').textContent() === label) return
  await page.getByTitle('Switch workspace').click()
  await page.locator(`.rv-workspace-ribbon-item[data-workspace-id="office-e2e-${suffix}"]`).click()
  await expect(page.locator('.rv-workspace-name')).toHaveText(label)
}

export async function openPaletteDocument(page: Page, suffix: WorkspaceSuffix = 'a') {
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
    await expect(filename).toContainText(expected)
  }
  await expect(editor).toContainText(`Before palette-${suffix}.`)
  return editor.locator('table.rv-office-table').first()
}

export async function openPalette(page: Page, table: ReturnType<Page['locator']>): Promise<void> {
  if (await page.locator('.rv-office-color-popover').count()) await page.keyboard.press('Escape')
  await table.locator('tbody > tr').nth(1).locator('td, th').first().click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Cell Background' }).click()
  await expect(page.locator('.rv-office-color-popover')).toBeVisible()
}

export async function expectCustomColors(page: Page, table: ReturnType<Page['locator']>, colors: string[]) {
  await openPalette(page, table)
  const swatches = page.locator('.rv-office-color-custom .rv-office-color-swatch')
  await expect(swatches).toHaveCount(Math.min(colors.length, 20))
  for (const color of colors.slice(0, 20)) {
    await expect(page.locator(`.rv-office-color-custom .rv-office-color-swatch[title="${color}"]`)).toHaveCount(1)
  }
  await expect(page.locator('.rv-office-color-add')).toHaveCount(colors.length < 20 ? 1 : 0)
}

export async function addColor(page: Page, table: ReturnType<Page['locator']>, color: string): Promise<void> {
  await openPalette(page, table)
  await page.locator('.rv-office-color-add').click()
  await page.getByLabel('Custom color hex').fill(color)
  await page.getByTitle('Save custom color').click()
}

export async function removeColor(page: Page, table: ReturnType<Page['locator']>, color: string): Promise<void> {
  await openPalette(page, table)
  await page.locator(`.rv-office-color-custom .rv-office-color-swatch[title="${color}"]`).click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Remove', exact: true }).click()
}

export async function toggleSync(page: Page, table: ReturnType<Page['locator']>, enabled: boolean): Promise<void> {
  await openPalette(page, table)
  const current = enabled ? 'Sync Disabled' : 'Sync Enabled'
  await page.getByRole('button', { name: current, exact: true }).click()
}
