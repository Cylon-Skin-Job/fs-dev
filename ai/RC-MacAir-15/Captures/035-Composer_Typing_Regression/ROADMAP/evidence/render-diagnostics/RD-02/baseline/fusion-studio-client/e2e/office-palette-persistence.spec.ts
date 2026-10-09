import fs from 'node:fs'

import { expect, test } from '@playwright/test'

import { resetOfficePlaywrightScenario } from './office/fixture-lifecycle.mjs'
import {
  canonicalGlobalPalette,
  canonicalLocalPalette,
  PALETTE_SELECTOR_SEEDS,
} from './office/palette-selector-fixtures.mjs'
import {
  atomicReplace,
  capturePaletteWire,
  expectCustomColors,
  expectSnapshot,
  globalPath,
  localPath,
  openPaletteDocument,
  readJson,
  snapshot,
  waitForFrame,
} from './office/palette-selector-test-helpers'

test.describe('[slice 05S.3] isolated selected-source persistence', () => {
  test('true projects only machine-global colors while divergent local bytes stay exact', async ({ page }) => {
    await resetOfficePlaywrightScenario({
      scenario: 'palette', variant: 'global-selected', copies: 1, workspaces: 3,
    })
    const localBefore = snapshot(localPath('a'))
    const globalBefore = snapshot(globalPath())
    const frames = capturePaletteWire(page)
    await page.goto('/')
    const response = await waitForFrame(frames.received, (frame) => (
      frame.type === 'office:palette_state' && frame.workspaceId === 'office-e2e-a'
    ))
    expect(response).toMatchObject({
      customColors: ['#112233', '#445566'], syncEnabled: true, source: 'request', availability: 'ready',
    })
    const table = await openPaletteDocument(page)
    await expectCustomColors(page, table, ['#112233', '#445566'])
    await expect(page.locator('.rv-office-color-custom .rv-office-color-swatch[title="#aa0001"]')).toHaveCount(0)
    expectSnapshot(localPath('a'), localBefore)
    expectSnapshot(globalPath(), globalBefore)
  })

  test('false projects only local colors and an external change waits for a later request', async ({ page }) => {
    await resetOfficePlaywrightScenario({
      scenario: 'palette', variant: 'local-selected', copies: 1, workspaces: 3,
    })
    const globalBefore = snapshot(globalPath())
    const frames = capturePaletteWire(page)
    await page.goto('/')
    const table = await openPaletteDocument(page)
    await expectCustomColors(page, table, ['#aa0001'])
    await page.keyboard.press('Escape')

    const receivedFrom = frames.received.length
    const replacement = canonicalLocalPalette(['#aa0002', '#aa0003'], false)
    atomicReplace(localPath('a'), replacement)
    await new Promise((resolve) => setTimeout(resolve, 600))
    expect(frames.received.slice(receivedFrom).filter((frame) => (
      frame.type === 'office:palette_state' || frame.type === 'office:palette_error'
    ))).toEqual([])

    await page.getByTitle('Switch workspace').click()
    await page.locator('.rv-workspace-ribbon-item[data-workspace-id="office-e2e-b"]').click()
    await expect(page.locator('.rv-workspace-name')).toHaveText('Office E2E B')
    await page.getByTitle('Switch workspace').click()
    await page.locator('.rv-workspace-ribbon-item[data-workspace-id="office-e2e-a"]').click()
    await expect(page.locator('.rv-workspace-name')).toHaveText('Office E2E A')
    const refreshed = await waitForFrame(frames.received, (frame) => (
      frame.type === 'office:palette_state' && frame.workspaceId === 'office-e2e-a'
      && JSON.stringify(frame.customColors) === JSON.stringify(['#aa0002', '#aa0003'])
    ), receivedFrom)
    expect(refreshed.requestId).toEqual(expect.any(String))
    expect(fs.readFileSync(localPath('a'), 'utf8')).toBe(replacement)
    expectSnapshot(globalPath(), globalBefore)
  })

  test('malformed and read-only selected sources return clear errors and overwrite neither file', async ({ page }) => {
    await resetOfficePlaywrightScenario({
      scenario: 'palette', variant: 'selected-source-errors', copies: 1, workspaces: 3,
    })
    const malformedGlobal = snapshot(globalPath())
    const originalLocal = snapshot(localPath('a'))
    const frames = capturePaletteWire(page)
    await page.goto('/')
    const malformed = await waitForFrame(frames.received, (frame) => (
      frame.type === 'office:palette_error' && frame.workspaceId === 'office-e2e-a'
    ))
    expect(malformed).toMatchObject({ code: 'INVALID_SCHEMA', operation: 'get' })
    expectSnapshot(globalPath(), malformedGlobal)
    expectSnapshot(localPath('a'), originalLocal)

    atomicReplace(globalPath(), canonicalGlobalPalette(['#112233']))
    atomicReplace(localPath('a'), canonicalLocalPalette(['#aa0001'], false))
    await page.reload()
    const table = await openPaletteDocument(page)
    await expectCustomColors(page, table, ['#aa0001'])
    await page.keyboard.press('Escape')

    const localMode = fs.statSync(localPath('a')).mode & 0o7777
    fs.chmodSync(localPath('a'), 0o444)
    const localBefore = snapshot(localPath('a'))
    const globalBefore = snapshot(globalPath())
    try {
      const from = frames.received.length
      await page.reload()
      const readOnlyTable = await openPaletteDocument(page)
      await expectCustomColors(page, readOnlyTable, ['#aa0001'])
      await page.locator('.rv-office-color-add').click()
      await page.getByLabel('Custom color hex').fill('#123456')
      await page.getByTitle('Save custom color').click()
      const readOnly = await waitForFrame(frames.received, (frame) => (
        frame.type === 'office:palette_error' && frame.code === 'READ_ONLY'
      ), from)
      expect(readOnly).toMatchObject({ operation: 'add', workspaceId: 'office-e2e-a' })
      expectSnapshot(localPath('a'), localBefore)
      expectSnapshot(globalPath(), globalBefore)
    } finally {
      fs.chmodSync(localPath('a'), localMode)
    }
  })

  test('complete stable ordering remains on disk while the picker shows only the first 20', async ({ page }) => {
    await resetOfficePlaywrightScenario({
      scenario: 'palette', variant: 'global-selected', copies: 1, workspaces: 3,
    })
    const complete = Array.from({ length: 25 }, (_, index) => `#${index.toString(16).padStart(6, '0')}`)
    const bytes = canonicalGlobalPalette(complete)
    atomicReplace(globalPath(), bytes)
    await page.goto('/')
    const table = await openPaletteDocument(page)
    await expectCustomColors(page, table, complete)
    await expect(page.locator('.rv-office-color-add')).toHaveCount(0)
    expect(fs.readFileSync(globalPath(), 'utf8')).toBe(bytes)
    expect(readJson(localPath('a'))).toEqual(
      JSON.parse(PALETTE_SELECTOR_SEEDS['global-selected'].local.a),
    )
  })
})
