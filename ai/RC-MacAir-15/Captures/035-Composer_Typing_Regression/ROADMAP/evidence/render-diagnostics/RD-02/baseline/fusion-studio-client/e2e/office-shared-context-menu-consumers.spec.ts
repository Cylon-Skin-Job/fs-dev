import fs from 'node:fs'
import path from 'node:path'

import { expect, test } from '@playwright/test'

import { resetOfficePlaywrightScenario } from './office/fixture-lifecycle.mjs'
import {
  assertWithinViewport,
  BASIC_DOCUMENT,
  fixtureWorkspaceRoot,
  focusTrace,
  menuLabels,
  observeSentMessages,
  OFFICE_FOLDER,
  openApp,
  openOfficeHome,
  openPanel,
  resetSupportingFixtures,
  startFocusTrace,
} from './office/shared-context-menu-consumer-helpers'

test.beforeEach(async () => {
  await resetOfficePlaywrightScenario({ scenario: 'basic', copies: 1, workspaces: 1 })
  resetSupportingFixtures()
})

test.afterEach(async ({ page }) => {
  await page.close()
  await resetOfficePlaywrightScenario({ scenario: 'basic', copies: 1, workspaces: 1 })
  resetSupportingFixtures()
})

test('Office file and folder menus preserve descriptors, anchors, focus, collections, and collision', async ({ page }) => {
  const sent = observeSentMessages(page)
  const panel = await openOfficeHome(page)
  const folder = panel.locator(`.rv-office-folder-card[title="${OFFICE_FOLDER}"]`)

  const folderBox = (await folder.boundingBox())!
  const pointer = { x: folderBox.x + 24, y: folderBox.y + 20 }
  await page.mouse.click(pointer.x, pointer.y, { button: 'right' })
  let menu = page.getByRole('menu', { name: `Actions for ${OFFICE_FOLDER}` })
  await expect(menu).toHaveClass(/rv-menu-surface/)
  await expect(menu.getByRole('menuitem', { name: 'Pin folder', exact: true })).toBeFocused()
  expect(await menuLabels(menu)).toEqual(['Pin folder', 'Rename', 'Archive', 'Delete'])
  expect(await menu.locator('.rv-menu-item-icon').allTextContents()).toEqual([
    'push_pin', 'drive_file_rename', 'archive', 'delete',
  ])
  const pointerMenuBox = (await menu.boundingBox())!
  expect(Math.abs(pointerMenuBox.x - pointer.x)).toBeLessThanOrEqual(1)
  expect(Math.abs(pointerMenuBox.y - pointer.y)).toBeLessThanOrEqual(1)
  await page.keyboard.press('Escape')
  await expect(folder).toBeFocused()

  const folderMore = folder.getByRole('button', { name: `More actions for ${OFFICE_FOLDER}` })
  await folderMore.click()
  menu = page.getByRole('menu', { name: `Actions for ${OFFICE_FOLDER}` })
  const moreBox = (await folderMore.boundingBox())!
  const anchoredBox = (await menu.boundingBox())!
  const viewport = page.viewportSize()!
  const expectedAnchorX = Math.min(
    Math.max(8, moreBox.x),
    viewport.width - anchoredBox.width - 8,
  )
  const expectedAnchorY = Math.min(
    Math.max(8, moreBox.y + moreBox.height + 4),
    viewport.height - anchoredBox.height - 8,
  )
  expect(Math.abs(anchoredBox.x - expectedAnchorX)).toBeLessThanOrEqual(1)
  expect(Math.abs(anchoredBox.y - expectedAnchorY)).toBeLessThanOrEqual(1)
  await startFocusTrace(page)
  await page.keyboard.press('Tab')
  await expect(menu).toHaveCount(0)
  expect((await focusTrace(page))[0]).toBe(`More actions for ${OFFICE_FOLDER}`)

  await folderMore.click()
  menu = page.getByRole('menu', { name: `Actions for ${OFFICE_FOLDER}` })
  await menu.getByRole('menuitem', { name: 'Pin folder', exact: true }).click()
  await expect(menu).toHaveCount(0)
  await expect(folderMore).toBeFocused()
  await expect(panel.getByRole('button', { name: OFFICE_FOLDER, exact: true })).toBeVisible()
  expect(sent.filter(({ type }) => type === 'state:set')).toHaveLength(1)
  const officeStatePath = path.join(
    fixtureWorkspaceRoot(), 'System', 'Views', '001-office-viewer', 'state', 'state.json',
  )
  await expect.poll(() => (
    JSON.parse(fs.readFileSync(officeStatePath, 'utf8')).collections?.pinnedFolders?.length
  )).toBe(1)

  await folder.click()
  const file = panel.getByTitle(BASIC_DOCUMENT, { exact: true })
  await expect(file).toBeVisible()
  await file.click({ button: 'right', position: { x: 30, y: 30 } })
  menu = page.getByRole('menu', { name: `Actions for ${BASIC_DOCUMENT}` })
  expect(await menuLabels(menu)).toEqual(['Star', 'Rename', 'Archive', 'Delete'])
  expect(await menu.locator('.rv-menu-item-icon').allTextContents()).toEqual([
    'kid_star', 'drive_file_rename', 'archive', 'delete',
  ])
  await expect(menu.getByRole('menuitem', { name: 'Delete', exact: true }))
    .toHaveAttribute('data-tone', 'destructive')
  await startFocusTrace(page)
  await page.keyboard.press('Tab')
  await expect(menu).toHaveCount(0)
  expect((await focusTrace(page))[0]).toBe(BASIC_DOCUMENT)

  const fileMore = file.getByRole('button', { name: `More actions for ${BASIC_DOCUMENT}` })
  await fileMore.click()
  await page.getByRole('menu', { name: `Actions for ${BASIC_DOCUMENT}` })
    .getByRole('menuitem', { name: 'Star', exact: true }).click()
  await expect(fileMore).toBeFocused()
  await expect(file.locator('.rv-office-doc-tile-star')).toBeVisible()
  await expect.poll(() => (
    JSON.parse(fs.readFileSync(officeStatePath, 'utf8')).collections?.starred?.length
  )).toBe(1)

  await file.evaluate((element) => {
    element.dispatchEvent(new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX: window.innerWidth - 2,
      clientY: window.innerHeight - 2,
    }))
  })
  menu = page.getByRole('menu', { name: `Actions for ${BASIC_DOCUMENT}` })
  await assertWithinViewport(menu)
  await page.keyboard.press('Escape')
  await fileMore.click()
  await assertWithinViewport(menu)
})

test('Office file and folder mutations dispatch once and tolerate disappearing invocation targets', async ({ page }) => {
  const sent = observeSentMessages(page)
  const panel = await openOfficeHome(page)
  const officeRoot = path.join(fixtureWorkspaceRoot(), 'Office')

  const renameFolder = panel.getByTitle('Rename Folder', { exact: true })
  page.once('dialog', (dialog) => dialog.accept('Renamed Folder'))
  await renameFolder.getByRole('button', { name: 'More actions for Rename Folder' }).click()
  await page.getByRole('menu', { name: 'Actions for Rename Folder' })
    .getByRole('menuitem', { name: 'Rename', exact: true }).click()
  await expect.poll(() => fs.existsSync(path.join(officeRoot, 'Renamed Folder'))).toBe(true)
  expect(sent.filter(({ type }) => type === 'file:rename')).toHaveLength(1)
  await expect(page.locator('.rv-menu-surface')).toHaveCount(0)

  const archiveFolder = panel.getByTitle('Archive Folder', { exact: true })
  await archiveFolder.getByRole('button', { name: 'More actions for Archive Folder' }).click()
  await page.getByRole('menu', { name: 'Actions for Archive Folder' })
    .getByRole('menuitem', { name: 'Archive', exact: true }).click()
  await expect.poll(() => fs.existsSync(path.join(officeRoot, '999-Archive', 'Archive Folder'))).toBe(true)
  expect(sent.filter(({ type }) => type === 'file:move')).toHaveLength(1)

  const deleteFolder = panel.getByTitle('Delete Folder', { exact: true })
  page.once('dialog', (dialog) => dialog.accept())
  await deleteFolder.getByRole('button', { name: 'More actions for Delete Folder' }).click()
  await page.getByRole('menu', { name: 'Actions for Delete Folder' })
    .getByRole('menuitem', { name: 'Delete', exact: true }).click()
  await expect.poll(() => fs.existsSync(path.join(officeRoot, 'Delete Folder'))).toBe(false)
  expect(sent.filter(({ type }) => type === 'file:delete')).toHaveLength(1)

  await panel.getByTitle(OFFICE_FOLDER, { exact: true }).click()
  const archiveTarget = panel.getByTitle('Archive Target.md', { exact: true })
  await archiveTarget.getByRole('button', { name: 'More actions for Archive Target.md' }).click()
  await page.getByRole('menu', { name: 'Actions for Archive Target.md' })
    .getByRole('menuitem', { name: 'Archive', exact: true }).click()
  await expect.poll(() => fs.existsSync(path.join(officeRoot, '999-Archive', 'Archive Target.md'))).toBe(true)
  expect(sent.filter(({ type }) => type === 'file:move')).toHaveLength(2)

  const deleteTarget = panel.getByTitle('Delete Target.md', { exact: true })
  page.once('dialog', (dialog) => dialog.accept())
  await deleteTarget.getByRole('button', { name: 'More actions for Delete Target.md' }).click()
  await page.getByRole('menu', { name: 'Actions for Delete Target.md' })
    .getByRole('menuitem', { name: 'Delete', exact: true }).click()
  await expect.poll(() => fs.existsSync(path.join(officeRoot, OFFICE_FOLDER, 'Delete Target.md'))).toBe(false)
  expect(sent.filter(({ type }) => type === 'file:delete')).toHaveLength(2)

  await panel.getByTitle('Archive', { exact: true }).click()
  const alreadyArchived = panel.getByTitle('Already Archived.md', { exact: true })
  await alreadyArchived.getByRole('button', { name: 'More actions for Already Archived.md' }).click()
  const restoreItem = page.getByRole('menu', { name: 'Actions for Already Archived.md' })
    .getByRole('menuitem', { name: 'Restore', exact: true })
  await expect(restoreItem.locator('.rv-menu-item-icon')).toHaveText('unarchive')
  await restoreItem.click()
  await expect(page.getByText('Restore from the flat archive is not available', { exact: true })).toBeVisible()
  expect(sent.filter(({ type }) => type === 'file:move')).toHaveLength(2)
})

test('Capture TileRow, preview, and FilePage mounts use one shared button lifecycle', async ({ page }) => {
  const sent = observeSentMessages(page)
  await openApp(page)
  const panel = await openPanel(page, 'Captures')
  const tile = panel.getByTitle('Capture-A.md', { exact: true })
  await expect(tile).toBeVisible()
  const tileMore = tile.getByRole('button', { name: 'More actions for Capture-A.md' })
  await tileMore.click()
  let menu = page.getByRole('menu', { name: 'Actions for Capture-A.md' })
  await expect(menu).toHaveClass(/rv-menu-surface/)
  expect(await menuLabels(menu)).toEqual(['Rename', 'Make a Copy', 'Archive', 'Delete'])
  expect(await menu.locator('.rv-menu-item-icon').allTextContents()).toEqual([
    'drive_file_rename', 'note_stack_add', 'archive', 'delete',
  ])
  await page.keyboard.press('Escape')
  await expect(tileMore).toBeFocused()

  await tileMore.click()
  await menu.getByRole('menuitem', { name: 'Make a Copy', exact: true }).click()
  await expect(menu).toHaveCount(0)
  await expect(tileMore).toBeFocused()
  expect(fs.existsSync(path.join(fixtureWorkspaceRoot(), 'Captures', '001-Fixtures', 'Capture-A.md'))).toBe(true)

  await tile.click()
  const preview = panel.getByRole('dialog', { name: 'Preview Capture-A.md' })
  await expect(preview).toBeVisible()
  const previewMore = preview.getByRole('button', { name: 'More actions for Capture-A.md' })
  await previewMore.click()
  menu = page.getByRole('menu', { name: 'Actions for Capture-A.md' })
  await expect(menu).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(previewMore).toBeFocused()

  await preview.getByRole('button', { name: 'Open Capture-A.md full screen' }).click()
  await expect(preview).toHaveCount(0)
  await expect(panel.locator('.rv-file-page-view--capture')).toBeVisible()
  const pageMore = panel.getByRole('button', { name: 'More actions for Capture-A.md' })
  await pageMore.click()
  menu = page.getByRole('menu', { name: 'Actions for Capture-A.md' })
  await expect(menu).toBeVisible()
  await menu.getByRole('menuitem', { name: 'Archive', exact: true }).click()
  await expect.poll(() => fs.existsSync(path.join(
    fixtureWorkspaceRoot(), 'Captures', '999-Archive', 'Capture-A.md',
  ))).toBe(true)
  expect(sent.filter(({ type }) => type === 'file:move')).toHaveLength(1)
  await expect(menu).toHaveCount(0)
  await expect(panel.locator('.rv-file-page-view--capture')).toHaveCount(0)
})

test('Email pointer and ellipsis paths share actions while preserving exact cancellation and outside focus', async ({ page }) => {
  await openApp(page)
  const panel = await openPanel(page, 'Email')
  await panel.getByTitle('009-Email-Fixture', { exact: true }).click()
  const tile = panel.getByTitle('Email-A.md', { exact: true })
  await expect(tile).toBeVisible()

  await tile.click({ button: 'right', position: { x: 25, y: 25 } })
  let menu = page.getByRole('menu', { name: 'Actions for Email-A.md' })
  expect(await menuLabels(menu)).toEqual(['Star', 'Rename', 'Archive', 'Delete'])
  await page.keyboard.press('Escape')
  await expect(tile).toBeFocused()

  const more = tile.getByRole('button', { name: 'More actions for Email-A.md' })
  await more.click()
  menu = page.getByRole('menu', { name: 'Actions for Email-A.md' })
  expect(await menuLabels(menu)).toEqual(['Star', 'Rename', 'Archive', 'Delete'])
  await panel.getByRole('searchbox', { name: 'Search email documents' }).click()
  await expect(menu).toHaveCount(0)
  await expect(panel.getByRole('searchbox', { name: 'Search email documents' })).toBeFocused()
})

test('Ticket mount keeps Archive absent and closes safely when its trigger unmounts', async ({ page }) => {
  await page.addInitScript({ content: `
    (() => {
      const tracked = new Set(['pointerdown', 'keydown', 'resize']);
      const active = { pointerdown: new Set(), keydown: new Set(), resize: new Set() };
      const add = window.addEventListener.bind(window);
      const remove = window.removeEventListener.bind(window);
      window.addEventListener = function(type, listener, options) {
        if (tracked.has(type)) active[type].add(listener);
        return add(type, listener, options);
      };
      window.removeEventListener = function(type, listener, options) {
        if (tracked.has(type)) active[type].delete(listener);
        return remove(type, listener, options);
      };
      window.__adopt3MenuListeners = () => Object.fromEntries(
        Object.entries(active).map(([type, listeners]) => [type, listeners.size]),
      );
    })();
  ` })
  await openApp(page)
  const panel = await openPanel(page, 'Issues')
  await panel.getByText('Menu fixture A', { exact: true }).click()
  const detail = panel.getByRole('dialog', { name: 'Ticket E2E-A' })
  await detail.getByRole('button', { name: 'Expand E2E-A' }).click()
  await expect(panel.locator('.rv-ticket-full-page')).toBeVisible()
  const trigger = panel.getByRole('button', { name: 'More actions for E2E-A.md' })
  await trigger.click()
  let menu = page.getByRole('menu', { name: 'Actions for E2E-A.md' })
  expect(await menuLabels(menu)).toEqual(['Rename', 'Make a Copy', 'Delete'])
  await expect(menu.getByRole('menuitem', { name: 'Archive', exact: true })).toHaveCount(0)
  await page.keyboard.press('Escape')
  const baseline = await page.evaluate(() => (window as any).__adopt3MenuListeners())

  for (let iteration = 0; iteration < 3; iteration += 1) {
    await trigger.click()
    menu = page.getByRole('menu', { name: 'Actions for E2E-A.md' })
    expect(await menuLabels(menu)).toEqual(['Rename', 'Make a Copy', 'Delete'])
    await expect(menu.getByRole('menuitem', { name: 'Archive', exact: true })).toHaveCount(0)
    await page.keyboard.press('Escape')
    await expect.poll(() => page.evaluate(() => (window as any).__adopt3MenuListeners()))
      .toEqual(baseline)
  }

  await trigger.click()
  await page.evaluate(() => {
    (document.querySelector('.rv-ticket-full-page-back') as HTMLButtonElement)?.click()
  })
  await expect(panel.locator('.rv-ticket-full-page')).toHaveCount(0)
  await expect(page.locator('.rv-menu-surface')).toHaveCount(0)
  await expect.poll(() => page.evaluate(() => (window as any).__adopt3MenuListeners()))
    .toEqual(baseline)
})
