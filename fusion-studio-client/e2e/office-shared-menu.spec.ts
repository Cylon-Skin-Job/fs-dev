import fs from 'node:fs'

import { expect, test, type Page } from '@playwright/test'

import { resetOfficePlaywrightScenario } from './office/fixture-lifecycle.mjs'
import {
  localPath,
  openPalette,
  openPaletteDocument,
} from './office/palette-selector-test-helpers'

async function openOfficeDocument(page: Page, filename: string) {
  await page.goto('/')
  await page.getByTitle('Office', { exact: true }).click()
  const folder = page.getByTitle('001-Fixtures', { exact: true })
  const document = page.getByTitle(filename, { exact: true })
  const editor = page.locator('.rv-office-document-editor .milkdown .ProseMirror[contenteditable="true"]')
  await expect.poll(async () => (
    await folder.isVisible() || await document.isVisible() || await editor.isVisible()
  ), { timeout: 15_000 }).toBe(true)
  if (await editor.isVisible()) {
    const openFilename = await page.locator('.rv-office-document-filename').textContent()
    if (openFilename?.includes(filename)) return editor
    await page.getByTitle('Back', { exact: true }).click()
  }
  if (!await document.isVisible()) {
    await page.locator('.rv-office-sidebar').getByRole('button', { name: 'Home', exact: true }).click()
    await expect(folder).toBeVisible()
    await folder.click({ force: true })
    await expect(document).toBeVisible()
  }
  await document.click({ force: true })
  await expect(editor).toBeVisible()
  return editor
}

async function expectSharedMenuTheme(
  page: Page,
  menu: ReturnType<Page['getByRole']>,
  colors: { background: string; foreground: string; border: string },
) {
  await expect(menu).toBeVisible()
  await expect(menu).toHaveClass(/rv-menu-surface/)
  await expect.poll(() => menu.evaluate((element) => {
    const style = getComputedStyle(element)
    return {
      background: style.backgroundColor,
      foreground: style.color,
      border: style.borderTopColor,
    }
  })).toEqual({
    background: colors.background,
    foreground: colors.foreground,
    border: colors.border,
  })
}

test('mounted Office insert and nested table menus use shared keyboard, collision, and external-grid ownership', async ({ page }) => {
  const files = await resetOfficePlaywrightScenario({
    scenario: 'structure', variant: 'metadata', copies: 1, workspaces: 1,
  })
  const fixture = files.find(({ filename }: { filename: string }) => filename === 'Structure-R5-C4.md')
  expect(fixture).toBeTruthy()
  const canonical = fs.readFileSync(fixture!.path)
  try {
    const editor = await openOfficeDocument(page, fixture!.filename)
    const paragraph = editor.locator('p').last()
    const viewport = page.viewportSize()!
    for (const point of [
      { x: 0, y: 0 },
      { x: viewport.width - 1, y: 0 },
      { x: 0, y: viewport.height - 1 },
      { x: viewport.width - 1, y: viewport.height - 1 },
    ]) {
      await paragraph.evaluate((target, coordinates) => target.dispatchEvent(new MouseEvent('contextmenu', {
        bubbles: true, cancelable: true, clientX: coordinates.x, clientY: coordinates.y, button: 2,
      })), point)
      const menu = page.getByRole('menu', { name: 'Insert content' })
      await expect(menu).toBeVisible()
      await expect(menu).toHaveClass(/rv-menu-surface/)
      const box = (await menu.boundingBox())!
      expect(box.x).toBeGreaterThanOrEqual(7.5)
      expect(box.y).toBeGreaterThanOrEqual(7.5)
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width - 7.5)
      expect(box.y + box.height).toBeLessThanOrEqual(viewport.height - 7.5)
      await page.keyboard.press('Escape')
    }

    await paragraph.click({ button: 'right' })
    const insertMenu = page.getByRole('menu', { name: 'Insert content' })
    const tableItem = insertMenu.getByRole('menuitem', { name: 'Table', exact: true })
    await expect(tableItem).toBeFocused()
    await page.keyboard.press('ArrowDown')
    await expect(insertMenu.getByRole('menuitem', { name: 'Image', exact: true })).toBeFocused()
    await page.keyboard.press('End')
    await expect(insertMenu.getByRole('menuitem', { name: 'Check List', exact: true })).toBeFocused()
    await page.keyboard.press('Home')
    await expect(tableItem).toBeFocused()
    await tableItem.hover()
    const grid = page.locator('.rv-office-table-grid-popover')
    await expect(grid).toBeVisible()
    await grid.hover()
    await tableItem.hover()
    await page.waitForTimeout(180)
    await expect(grid).toBeVisible()
    await grid.locator('.rv-office-table-grid-cell[data-row="3"][data-col="2"]').click()
    await expect(insertMenu).toHaveCount(0)
    await expect(grid).toHaveCount(0)
    await expect(editor.locator('table.rv-office-table')).toHaveCount(2)

    const existingTable = editor.locator('table.rv-office-table').first()
    await existingTable.locator('tbody > tr').nth(2).locator('td').nth(1).click({ button: 'right' })
    const rootMenu = page.getByRole('menu', { name: 'Table cell actions' })
    await expect(rootMenu).toHaveClass(/rv-menu-surface/)
    const settings = rootMenu.getByRole('menuitem', { name: 'Table', exact: true })
    await expect(settings).toBeFocused()
    await page.keyboard.press('ArrowRight')
    const tableMenu = page.getByRole('menu', { name: 'Table', exact: true })
    await expect(tableMenu).toBeVisible()
    await expect(tableMenu.getByRole('menuitem', { name: 'Add title row' })).toBeFocused()
    await page.keyboard.press('ArrowLeft')
    await expect(tableMenu).toHaveCount(0)
    await expect(settings).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(rootMenu).toHaveCount(0)
    await expect(editor).toBeFocused()
  } finally {
    await page.close()
    const reset = await resetOfficePlaywrightScenario({
      scenario: 'structure', variant: 'metadata', copies: 1, workspaces: 1,
    })
    const restored = reset.find(({ filename }: { filename: string }) => filename === fixture!.filename)
    expect(restored).toBeTruthy()
    expect(fs.readFileSync(restored!.path)).toEqual(canonical)
  }
})

test('mounted Office insert actions preserve their command mapping and public editor effects', async ({ page }) => {
  const files = await resetOfficePlaywrightScenario({
    scenario: 'structure', variant: 'metadata', copies: 1, workspaces: 1,
  })
  const fixture = files.find(({ filename }: { filename: string }) => filename === 'Structure-R5-C4.md')
  expect(fixture).toBeTruthy()
  const canonical = fs.readFileSync(fixture!.path)
  const cases = [
    { label: 'Table', selector: 'table.rv-office-table' },
    { label: 'Image', selector: '.milkdown-image-block' },
    { label: 'Divider', selector: 'hr' },
    { label: 'Bullet List', selector: 'ul:not(:has(li[data-item-type="task"]))' },
    { label: 'Ordered List', selector: 'ol' },
    { label: 'Check List', selector: '.milkdown-list-item-block .label.unchecked' },
  ] as const
  try {
    const editor = await openOfficeDocument(page, fixture!.filename)
    for (const action of cases) {
      await test.step(action.label, async () => {
        const effect = editor.locator(action.selector)
        const before = await effect.count()
        await editor.locator('p').last().click({ button: 'right' })
        const menu = page.getByRole('menu', { name: 'Insert content' })
        await expect(menu).toBeVisible()
        await menu.getByRole('menuitem', { name: action.label, exact: true }).click()
        await expect(menu).toHaveCount(0)
        await expect(effect).toHaveCount(before + 1)
      })
    }
  } finally {
    await page.close()
    const reset = await resetOfficePlaywrightScenario({
      scenario: 'structure', variant: 'metadata', copies: 1, workspaces: 1,
    })
    const restored = reset.find(({ filename }: { filename: string }) => filename === fixture!.filename)
    expect(restored).toBeTruthy()
    expect(fs.readFileSync(restored!.path)).toEqual(canonical)
  }
})

test('confirmed custom-color Add returns to the registered palette and waits for a later swatch click', async ({ page }) => {
  await resetOfficePlaywrightScenario({
    scenario: 'palette', variant: 'local-selected', copies: 1, workspaces: 3,
  })
  await page.goto('/')
  const table = await openPaletteDocument(page)
  const target = table.locator('tbody > tr').nth(1).locator('td, th').first()
  const before = await target.evaluate((cell) => getComputedStyle(cell).backgroundColor)
  await openPalette(page, table)
  const popover = page.locator('.rv-office-color-popover')
  await popover.locator('.rv-office-color-add').click()
  await popover.getByLabel('Custom color hex').fill('#123456')
  await popover.getByTitle('Save custom color').click()
  const swatch = popover.locator('.rv-office-color-custom .rv-office-color-swatch[title="#123456"]')
  await expect(swatch).toBeFocused()
  await expect(popover.locator('.rv-office-color-custom-editor')).toHaveAttribute('data-open', 'false')
  await expect.poll(() => target.evaluate((cell) => getComputedStyle(cell).backgroundColor)).toBe(before)
  await swatch.click()
  await expect(popover).toHaveCount(0)
  await expect(page.locator('.rv-menu-surface')).toHaveCount(0)
  await expect.poll(() => target.evaluate((cell) => getComputedStyle(cell).backgroundColor))
    .toBe('rgb(18, 52, 86)')
})

test('rejected custom-color Add keeps the mounted palette stable and applies nothing', async ({ page }) => {
  await resetOfficePlaywrightScenario({
    scenario: 'palette', variant: 'local-selected', copies: 1, workspaces: 3,
  })
  const palettePath = localPath('a')
  const originalMode = fs.statSync(palettePath).mode & 0o7777
  const originalBytes = fs.readFileSync(palettePath)
  try {
    await page.goto('/')
    const table = await openPaletteDocument(page)
    const target = table.locator('tbody > tr').nth(1).locator('td, th').first()
    const colorBeforeAdd = await target.evaluate((cell) => getComputedStyle(cell).backgroundColor)
    await openPalette(page, table)
    const rootMenu = page.getByRole('menu', { name: 'Table cell actions' })
    const popover = page.locator('.rv-office-color-popover')
    const editor = popover.locator('.rv-office-color-custom-editor')
    const commit = popover.getByTitle('Save custom color')
    fs.chmodSync(palettePath, 0o444)

    await popover.locator('.rv-office-color-add').click()
    await popover.getByLabel('Custom color hex').fill('#123456')
    await commit.click()

    await expect(page.locator('.rv-toast')).toContainText('The workspace palette is read-only.')
    await expect(rootMenu).toBeVisible()
    await expect(popover).toBeVisible()
    await expect(editor).toHaveAttribute('data-open', 'true')
    await expect(commit).toBeEnabled()
    await expect(popover.getByLabel('Custom color hex')).toHaveValue('#123456')
    await expect(popover.locator(
      '.rv-office-color-custom .rv-office-color-swatch[title="#123456"]',
    )).toHaveCount(0)
    await expect.poll(() => target.evaluate((cell) => getComputedStyle(cell).backgroundColor))
      .toBe(colorBeforeAdd)
    expect(fs.readFileSync(palettePath)).toEqual(originalBytes)
  } finally {
    fs.chmodSync(palettePath, originalMode)
  }
})

test('Office shared root and nested menus honor representative light and dark token contracts', async ({ page }) => {
  await resetOfficePlaywrightScenario({
    scenario: 'basic', copies: 1, workspaces: 1,
  })
  await page.goto('/')
  await expect(page.locator('.rv-workspace-name')).toBeVisible()
  await page.getByTitle('Office', { exact: true }).click()
  await expect(page.getByTitle('001-Fixtures', { exact: true })).toBeVisible()

  const themes = [
    {
      name: 'light',
      background: 'rgb(247, 248, 250)',
      foreground: 'rgb(17, 24, 39)',
      border: 'rgb(100, 116, 139)',
    },
    {
      name: 'dark',
      background: 'rgb(20, 27, 38)',
      foreground: 'rgb(226, 232, 240)',
      border: 'rgb(71, 85, 105)',
    },
  ] as const

  for (const theme of themes) {
    await test.step(theme.name, async () => {
      await page.evaluate((colors) => {
        const root = document.documentElement
        root.style.setProperty('--rv-menu-surface-bg', colors.background)
        root.style.setProperty('--rv-menu-foreground', colors.foreground)
        root.style.setProperty('--rv-menu-border-color', colors.border)
      }, theme)

      const newTrigger = page.getByRole('button', { name: 'New', exact: true })
      await newTrigger.click()
      await expectSharedMenuTheme(
        page,
        page.getByRole('menu', { name: 'Create or import' }),
        theme,
      )
      await page.keyboard.press('Escape')

      const folder = page.getByTitle('001-Fixtures', { exact: true })
      await folder.getByRole('button', { name: 'More actions for 001-Fixtures' }).click()
      await expectSharedMenuTheme(
        page,
        page.getByRole('menu', { name: 'Actions for 001-Fixtures' }),
        theme,
      )
      await page.keyboard.press('Escape')

      await folder.click()
      await page.getByTitle('Basic Tables.md', { exact: true }).click()
      const exportTrigger = page.getByTitle('Export', { exact: true })
      await exportTrigger.click()
      const exportRoot = page.getByRole('menu', { name: 'Export document' })
      await expectSharedMenuTheme(page, exportRoot, theme)
      await exportRoot.getByRole('menuitem', { name: 'Export DOCX', exact: true }).hover()
      await expectSharedMenuTheme(page, page.getByRole('menu', { name: 'Export DOCX' }), theme)
      await page.keyboard.press('Escape')

      await page.getByTitle('Back', { exact: true }).click()
      await page.locator('.rv-office-sidebar').getByRole('button', { name: 'Home', exact: true }).click()
      await expect(page.getByTitle('001-Fixtures', { exact: true })).toBeVisible()
    })
  }
})

test('Page Margins and Paper Brightness remain specialized form popovers', async ({ page }) => {
  await resetOfficePlaywrightScenario({
    scenario: 'basic', copies: 1, workspaces: 1,
  })
  await openOfficeDocument(page, 'Basic Tables.md')

  const marginTrigger = page.getByTitle('Page margins', { exact: true })
  await marginTrigger.click()
  const marginPopover = page.locator('.rv-office-margins-dropdown')
  await expect(marginPopover).toBeVisible()
  await expect(marginPopover.locator('input[type="number"]')).toHaveCount(4)
  await expect(marginPopover).not.toHaveAttribute('role', 'menu')
  await expect(marginPopover).not.toHaveClass(/rv-menu-surface/)

  const topMargin = marginPopover.locator('input[type="number"]').first()
  await topMargin.fill('81')
  await expect(page.locator('.rv-office-document-editor')).toHaveCSS('--doc-margin-top', '81px')

  const brightnessTrigger = page.getByRole('button', { name: 'Document brightness' })
  await brightnessTrigger.click()
  await expect(marginPopover).toHaveCount(0)
  const brightnessPopover = page.locator('.rv-paper-brightness-dropdown')
  await expect(brightnessPopover).toBeVisible()
  await expect(brightnessPopover).not.toHaveAttribute('role', 'menu')
  await expect(brightnessPopover).not.toHaveClass(/rv-menu-surface/)
  const slider = brightnessPopover.getByRole('slider', { name: 'Document brightness' })
  await expect(slider).toBeVisible()
  await slider.fill('55')
  await expect(page.locator('.rv-office-document-page')).not.toHaveCSS('--rv-office-paper-mute-alpha', '0')

  await page.keyboard.press('Escape')
  await expect(brightnessPopover).toHaveCount(0)
  await expect(page.locator('.rv-menu-surface')).toHaveCount(0)
})
