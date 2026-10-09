import fs from 'node:fs'

import { expect, test } from '@playwright/test'

import { resetOfficePlaywrightScenario } from './office/fixture-lifecycle.mjs'
import { canonicalGlobalPalette, canonicalLocalPalette } from './office/palette-selector-fixtures.mjs'
import {
  addColor,
  atomicReplace,
  capturePaletteWire,
  ensureWorkspace,
  expectCustomColors,
  expectSnapshot,
  globalPath,
  localPath,
  openPaletteDocument,
  readJson,
  removeColor,
  snapshot,
  toggleSync,
  waitForFrame,
  type WorkspaceSuffix,
} from './office/palette-selector-test-helpers'

test.describe('[slice 05S.3] selected-source interaction', () => {
  test('Add and Remove mutate only the selected file; toggle preserves both arrays and switches immediately', async ({ page }) => {
    test.setTimeout(180_000)
    await resetOfficePlaywrightScenario({
      scenario: 'palette', variant: 'selected-mutations', copies: 1, workspaces: 3,
    })
    await page.goto('/')
    const table = await openPaletteDocument(page)
    const globalInitial = snapshot(globalPath())

    await addColor(page, table, '#123456')
    await expect.poll(() => readJson(localPath('a')).custom_colors).toEqual(['#aa0001', '#aa0002', '#123456'])
    expectSnapshot(globalPath(), globalInitial)
    await removeColor(page, table, '#aa0001')
    await expect.poll(() => readJson(localPath('a')).custom_colors).toEqual(['#aa0002', '#123456'])
    expectSnapshot(globalPath(), globalInitial)

    const localArrayBeforeToggle = [...readJson(localPath('a')).custom_colors as string[]]
    await toggleSync(page, table, true)
    await expect.poll(() => readJson(localPath('a')).sync_enabled).toBe(true)
    expect(readJson(localPath('a')).custom_colors).toEqual(localArrayBeforeToggle)
    expectSnapshot(globalPath(), globalInitial)
    await expectCustomColors(page, table, ['#112233', '#445566'])
    await page.keyboard.press('Escape')

    const localAfterToggle = snapshot(localPath('a'))
    await addColor(page, table, '#234567')
    await expect.poll(() => readJson(globalPath()).custom_colors).toEqual(['#112233', '#445566', '#234567'])
    expectSnapshot(localPath('a'), localAfterToggle)
    await removeColor(page, table, '#112233')
    await expect.poll(() => readJson(globalPath()).custom_colors).toEqual(['#445566', '#234567'])
    expectSnapshot(localPath('a'), localAfterToggle)

    const globalAfterMutations = snapshot(globalPath())
    await toggleSync(page, table, false)
    await expect.poll(() => readJson(localPath('a')).sync_enabled).toBe(false)
    expect(readJson(localPath('a')).custom_colors).toEqual(localArrayBeforeToggle)
    expectSnapshot(globalPath(), globalAfterMutations)
    await expectCustomColors(page, table, localArrayBeforeToggle)
  })

  test('cyclic workspace switching rereads the selected target without unsolicited palette frames', async ({ page }) => {
    test.setTimeout(180_000)
    await resetOfficePlaywrightScenario({
      scenario: 'palette', variant: 'workspace-cycle', copies: 1, workspaces: 3,
    })
    const frames = capturePaletteWire(page)
    await page.goto('/')
    const expected: Record<WorkspaceSuffix, string[]> = {
      a: ['#112233'],
      b: ['#00bb02'],
      c: ['#112233'],
    }
    for (const suffix of ['a', 'b', 'c', 'a'] as const) {
      const from = frames.received.length
      const table = await openPaletteDocument(page, suffix)
      await waitForFrame(frames.received, (frame) => (
        frame.type === 'office:palette_state' && frame.workspaceId === `office-e2e-${suffix}`
        && Object.hasOwn(frame, 'requestId')
      ), suffix === 'a' && from === 0 ? 0 : from)
      await expectCustomColors(page, table, expected[suffix])
      await page.keyboard.press('Escape')
    }

    await ensureWorkspace(page, 'b')
    const from = frames.received.length
    atomicReplace(globalPath(), canonicalGlobalPalette(['#334455']))
    atomicReplace(localPath('b'), canonicalLocalPalette(['#00bb03'], false))
    await new Promise((resolve) => setTimeout(resolve, 600))
    expect(frames.received.slice(from).filter((frame) => (
      frame.type === 'office:palette_state' || frame.type === 'office:palette_error'
    ))).toEqual([])

    const aTable = await openPaletteDocument(page, 'a')
    await expectCustomColors(page, aTable, ['#334455'])
    await page.keyboard.press('Escape')
    const bTable = await openPaletteDocument(page, 'b')
    await expectCustomColors(page, bTable, ['#00bb03'])
    await page.keyboard.press('Escape')
    expect(frames.received.filter((frame) => (
      (frame.type === 'office:palette_state' || frame.type === 'office:palette_error')
      && !Object.hasOwn(frame, 'requestId')
    ))).toEqual([])
    expect(fs.existsSync(globalPath())).toBe(true)
    await ensureWorkspace(page, 'a')
  })
})
