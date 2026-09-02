import fs from 'node:fs'
import path from 'node:path'

import { expect, test, type Page } from '@playwright/test'

import { resetOfficePlaywrightScenario } from './office/fixture-lifecycle.mjs'

const FIXTURE_FOLDER = '001-Fixtures'
const BASIC_DOCUMENT = 'Basic Tables.md'

type OutputCall = {
  channel: 'export' | 'email' | 'print'
  payload: Record<string, unknown>
}

async function openOfficeHome(page: Page) {
  await page.goto('/')
  await expect(page.locator('.rv-workspace-name')).toBeVisible()
  await expect.poll(async () => (
    await page.locator('.rv-office-shell').isVisible()
    && (
      await page.getByTitle(FIXTURE_FOLDER, { exact: true }).isVisible()
      || await page.getByTitle('Back', { exact: true }).isVisible()
    )
  )).toBe(true)
  await page.getByTitle('Office', { exact: true }).click()
  await expect(page.locator('.rv-office-shell')).toBeVisible()
  await expect(page.getByTitle(FIXTURE_FOLDER, { exact: true })).toBeVisible()
  return page.getByRole('button', { name: 'New', exact: true })
}

async function installOutputApi(page: Page) {
  await page.addInitScript(() => {
    const observed = window as typeof window & {
      __officeOutputCalls?: OutputCall[]
      __officeDeferNextEmail?: boolean
      __officeRejectNextEmail?: boolean
      __officeResolveEmail?: () => void
    }
    observed.__officeOutputCalls = []
    Object.defineProperty(window, 'electronAPI', {
      configurable: true,
      value: {
        exportDocument: async (payload: Record<string, unknown>) => {
          observed.__officeOutputCalls?.push({ channel: 'export', payload: structuredClone(payload) })
          const format = String(payload.format)
          return {
            success: true,
            base64: btoa(format === 'pdf' ? '%PDF-adopt-2' : 'PK-adopt-2'),
            filename: `${String(payload.filename)}.${format}`,
          }
        },
        printDocument: async (payload: Record<string, unknown>) => {
          observed.__officeOutputCalls?.push({ channel: 'print', payload: structuredClone(payload) })
          return { success: true }
        },
        sendDocumentEmail: (payload: Record<string, unknown>) => {
          observed.__officeOutputCalls?.push({ channel: 'email', payload: structuredClone(payload) })
          if (observed.__officeRejectNextEmail) {
            observed.__officeRejectNextEmail = false
            return Promise.reject(new Error('ADOPT.2 forced rejection'))
          }
          if (observed.__officeDeferNextEmail) {
            observed.__officeDeferNextEmail = false
            return new Promise((resolve) => {
              observed.__officeResolveEmail = () => resolve({ success: true })
            })
          }
          return Promise.resolve({ success: true })
        },
        capturePage: async () => null,
        captureRect: async () => null,
        showEmojiPanel: async () => ({ success: true }),
        onMenuAction: () => () => {},
        onBrowserUrlChanged: () => () => {},
        setWorkspaceRoot: () => {},
        setWorkspaceMenuState: () => {},
        listScreenshots: async () => [],
        readScreenshot: async () => ({ base64: '', mimeType: 'image/png' }),
      },
    })
  })
}

async function openOfficeDocument(page: Page) {
  await openOfficeHome(page)
  await page.getByTitle(FIXTURE_FOLDER, { exact: true }).click()
  await page.getByTitle(BASIC_DOCUMENT, { exact: true }).click()
  await expect(page.locator('.rv-office-document-page')).toBeVisible()
  return page.getByTitle('Export', { exact: true })
}

async function outputCalls(page: Page): Promise<OutputCall[]> {
  return page.evaluate(() => (
    (window as typeof window & { __officeOutputCalls?: OutputCall[] }).__officeOutputCalls ?? []
  ))
}

function officeFixtureFolderPath() {
  const fixtureRoot = process.env.FUSION_OFFICE_E2E_FIXTURE_ROOT
  if (!fixtureRoot) throw new Error('FUSION_OFFICE_E2E_FIXTURE_ROOT is not set')
  return path.join(fixtureRoot, 'workspace-a', 'ai', 'Office-E2E', 'Office', FIXTURE_FOLDER)
}

test.beforeEach(async () => {
  await resetOfficePlaywrightScenario({ scenario: 'basic', copies: 1, workspaces: 1 })
})

test.afterEach(async ({ page }) => {
  await page.close()
  await resetOfficePlaywrightScenario({ scenario: 'basic', copies: 1, workspaces: 1 })
})

test('Office New uses the shared root menu with exact descriptors and one create effect', async ({ page }) => {
  const sentMessages: Array<Record<string, unknown>> = []
  page.on('websocket', (socket) => socket.on('framesent', ({ payload }) => {
    if (typeof payload !== 'string') return
    try {
      sentMessages.push(JSON.parse(payload) as Record<string, unknown>)
    } catch {
      // Binary and non-JSON frames are unrelated to this public action check.
    }
  }))

  const trigger = await openOfficeHome(page)
  await page.getByTitle(FIXTURE_FOLDER, { exact: true }).click()
  await trigger.click()

  const menu = page.getByRole('menu', { name: 'Create or import' })
  await expect(menu).toBeVisible()
  await expect(menu).toHaveClass(/rv-menu-surface/)
  await expect(trigger).toHaveAttribute('aria-expanded', 'true')
  await expect(menu.getByRole('menuitem', { name: 'New folder', exact: true })).toBeFocused()
  expect(await menu.locator(':scope > *').evaluateAll((elements) => elements.map((element) => (
    element.getAttribute('role') === 'separator'
      ? 'separator'
      : {
          label: element.querySelector('.rv-menu-item-label')?.textContent,
          icon: element.querySelector('.rv-menu-item-icon')?.textContent,
        }
  )))).toEqual([
    { label: 'New folder', icon: 'create_new_folder' },
    'separator',
    { label: 'Import file', icon: 'upload_file' },
    { label: 'Import Folder', icon: 'drive_folder_upload' },
    'separator',
    { label: 'New Document', icon: 'description' },
  ])
  await expect(page.locator('.rv-office-new-dropdown, .rv-office-new-menu-item')).toHaveCount(0)

  const triggerBox = (await trigger.boundingBox())!
  const menuBox = (await menu.boundingBox())!
  expect(menuBox.y).toBeGreaterThanOrEqual(triggerBox.y + triggerBox.height + 3.5)

  for (const label of ['Import file', 'Import Folder']) {
    await test.step(`${label} remains inert`, async () => {
      await menu.getByRole('menuitem', { name: label, exact: true }).click()
      await expect(menu).toHaveCount(0)
      await expect(page.getByRole('dialog')).toHaveCount(0)
      await expect(trigger).toBeFocused()
      await trigger.click()
      await expect(menu).toBeVisible()
    })
  }
  await page.keyboard.press('Escape')

  const folderName = `Adopt1 Folder ${Date.now()}`
  await trigger.click()
  await menu.getByRole('menuitem', { name: 'New folder', exact: true }).click()
  const folderDialog = page.getByRole('dialog')
  const folderInput = folderDialog.getByLabel('Folder name')
  await expect(folderInput).toBeFocused()
  await folderInput.fill(folderName)
  await folderDialog.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(folderDialog).toHaveCount(0)
  await expect.poll(() => fs.existsSync(path.join(officeFixtureFolderPath(), folderName))).toBe(true)
  expect(sentMessages.filter(({ type }) => type === 'folder_create')).toHaveLength(1)

  const documentName = `Adopt1 Document ${Date.now()}`
  await trigger.click()
  await menu.getByRole('menuitem', { name: 'New Document', exact: true }).click()
  const documentDialog = page.getByRole('dialog')
  const documentInput = documentDialog.getByLabel('Document name')
  await expect(documentInput).toBeFocused()
  await documentInput.fill(documentName)
  await documentDialog.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(documentDialog).toHaveCount(0)
  const documentPath = path.join(officeFixtureFolderPath(), `${documentName}.md`)
  await expect.poll(() => fs.existsSync(documentPath)).toBe(true)
  await expect(page.locator('.rv-office-document-filename')).toContainText(`${documentName}.md`)
  expect(sentMessages.filter(({ type }) => type === 'document_create')).toHaveLength(1)
  await page.getByTitle('Back', { exact: true }).click()
  await page.locator('.rv-office-sidebar').getByRole('button', { name: 'Home', exact: true }).click()
  await expect(page.getByTitle(FIXTURE_FOLDER, { exact: true })).toBeVisible()
})

test('Office New keyboard cancellation, Tab, and outside focus follow the shared contract', async ({ page }) => {
  const trigger = await openOfficeHome(page)
  const menu = page.getByRole('menu', { name: 'Create or import' })
  const home = page.getByRole('button', { name: 'Home', exact: true })
  const search = page.getByRole('searchbox', { name: 'Search office documents' })

  await trigger.focus()
  await trigger.press('Enter')
  const newFolder = menu.getByRole('menuitem', { name: 'New folder', exact: true })
  const importFile = menu.getByRole('menuitem', { name: 'Import file', exact: true })
  const newDocument = menu.getByRole('menuitem', { name: 'New Document', exact: true })
  await expect(newFolder).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await expect(importFile).toBeFocused()
  await page.keyboard.press('End')
  await expect(newDocument).toBeFocused()
  await page.keyboard.press('Home')
  await expect(newFolder).toBeFocused()
  await page.keyboard.press('ArrowUp')
  await expect(newDocument).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(menu).toHaveCount(0)
  await expect(trigger).toBeFocused()
  await expect(trigger).toHaveAttribute('aria-expanded', 'false')

  await trigger.press('Space')
  await expect(newFolder).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(menu).toHaveCount(0)
  await expect(home).toBeFocused()

  await trigger.click()
  await expect(menu).toBeVisible()
  await search.click()
  await expect(menu).toHaveCount(0)
  await expect(search).toBeFocused()
})

test('Office New clamps in a constrained viewport and repeated opening fully tears down', async ({ page }) => {
  await page.addInitScript({ content: `
    (() => {
      const trackedTypes = new Set(['pointerdown', 'keydown', 'resize']);
      const active = { pointerdown: new Set(), keydown: new Set(), resize: new Set() };
      const add = window.addEventListener.bind(window);
      const remove = window.removeEventListener.bind(window);
      window.addEventListener = function(type, listener, options) {
        if (trackedTypes.has(type)) active[type].add(listener);
        return add(type, listener, options);
      };
      window.removeEventListener = function(type, listener, options) {
        if (trackedTypes.has(type)) active[type].delete(listener);
        return remove(type, listener, options);
      };
      window.__officeMenuListenerCounts = () => Object.fromEntries(
        Object.entries(active).map(([type, listeners]) => [type, listeners.size]),
      );
    })();
  ` })
  const trigger = await openOfficeHome(page)
  const menu = page.getByRole('menu', { name: 'Create or import' })
  const baseline = await page.evaluate(() => (window as any).__officeMenuListenerCounts())

  for (let iteration = 0; iteration < 6; iteration += 1) {
    await trigger.click()
    await expect(menu).toHaveCount(1)
    await expect.poll(() => page.evaluate(() => (window as any).__officeMenuListenerCounts()))
      .toEqual({
        pointerdown: baseline.pointerdown + 1,
        keydown: baseline.keydown + 1,
        resize: baseline.resize + 1,
      })
    await page.keyboard.press('Escape')
    await expect(page.locator('.rv-menu-surface')).toHaveCount(0)
    await expect.poll(() => page.evaluate(() => (window as any).__officeMenuListenerCounts()))
      .toEqual(baseline)
  }

  await trigger.click()
  await trigger.click()
  await expect(menu).toHaveCount(1)
  await expect.poll(() => page.evaluate(() => (window as any).__officeMenuListenerCounts()))
    .toEqual({
      pointerdown: baseline.pointerdown + 1,
      keydown: baseline.keydown + 1,
      resize: baseline.resize + 1,
    })
  await page.keyboard.press('Escape')
  await expect(page.locator('.rv-menu-surface')).toHaveCount(0)
  await expect.poll(() => page.evaluate(() => (window as any).__officeMenuListenerCounts()))
    .toEqual(baseline)

  await page.setViewportSize({ width: 230, height: 180 })
  await trigger.click()
  await expect(menu).toBeVisible()
  const viewport = page.viewportSize()!
  const box = (await menu.boundingBox())!
  expect(box.x).toBeGreaterThanOrEqual(7.5)
  expect(box.y).toBeGreaterThanOrEqual(7.5)
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width - 7.5)
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height - 7.5)
})

test('Office Export uses the shared nested tree with exact stable descriptors and hover entry', async ({ page }) => {
  await installOutputApi(page)
  const trigger = await openOfficeDocument(page)
  await trigger.click()

  const root = page.getByRole('menu', { name: 'Export document' })
  await expect(root).toBeVisible()
  await expect(root).toHaveClass(/rv-menu-surface/)
  await expect(trigger).toHaveAttribute('aria-expanded', 'true')
  await expect(root.getByRole('menuitem', { name: 'Export DOCX', exact: true })).toBeFocused()
  expect(await root.locator(':scope > *').evaluateAll((elements) => elements.map((element) => (
    element.getAttribute('role') === 'separator'
      ? { kind: 'separator', id: (element as HTMLElement).dataset.menuItemId }
      : {
          kind: 'action',
          id: (element as HTMLElement).dataset.menuItemId,
          label: element.querySelector('.rv-menu-item-label')?.textContent,
          icon: element.querySelector('.rv-menu-item-icon')?.textContent,
        }
  )))).toEqual([
    { kind: 'action', id: 'office-export-docx', label: 'Export DOCX', icon: 'description' },
    { kind: 'action', id: 'office-export-pdf', label: 'Export PDF', icon: 'picture_as_pdf' },
    { kind: 'action', id: 'office-export-markdown-email', label: 'Email Markdown', icon: 'markdown' },
    { kind: 'separator', id: 'office-export-separator-output' },
    { kind: 'action', id: 'office-export-preview-pdf', label: 'Preview PDF', icon: 'print' },
  ])

  await root.getByRole('menuitem', { name: 'Export DOCX', exact: true }).hover()
  const child = page.getByRole('menu', { name: 'Export DOCX' })
  await expect(child).toBeVisible()
  expect(await child.getByRole('menuitem').evaluateAll((elements) => elements.map((element) => ({
    id: (element as HTMLElement).dataset.menuItemId,
    label: element.querySelector('.rv-menu-item-label')?.textContent,
    icon: element.querySelector('.rv-menu-item-icon')?.textContent,
  })))).toEqual([
    { id: 'office-export-docx-email', label: 'Email', icon: 'attach_email' },
    { id: 'office-export-docx-folder', label: 'Folder', icon: 'drive_file_move' },
  ])
  await root.getByRole('menuitem', { name: 'Export PDF', exact: true }).hover()
  const pdfChild = page.getByRole('menu', { name: 'Export PDF' })
  await expect(child).toHaveCount(0)
  await expect(pdfChild.getByRole('menuitem')).toHaveCount(2)
  await expect(pdfChild.locator('[data-menu-item-id="office-export-pdf-email"]')).toHaveText(/Email/)
  await expect(pdfChild.locator('[data-menu-item-id="office-export-pdf-folder"]')).toHaveText(/Folder/)
  await expect(page.locator('.rv-office-export-dropdown, .rv-office-export-submenu')).toHaveCount(0)

  await page.keyboard.press('Escape')
  for (let iteration = 0; iteration < 3; iteration += 1) {
    await trigger.click()
    await expect(root).toHaveCount(1)
    await page.keyboard.press('Escape')
    await expect(page.locator('.rv-menu-surface')).toHaveCount(0)
  }
  await trigger.click()
  await page.getByTitle('Back', { exact: true }).click()
  await expect(page.locator('.rv-office-document-page')).toHaveCount(0)
  await expect(page.locator('.rv-menu-surface')).toHaveCount(0)
})

test('Office Export keyboard back, cancellation, Tab, and outside focus follow the shared contract', async ({ page }) => {
  await installOutputApi(page)
  const trigger = await openOfficeDocument(page)
  const root = page.getByRole('menu', { name: 'Export document' })
  const docx = root.getByRole('menuitem', { name: 'Export DOCX', exact: true })
  const pdf = root.getByRole('menuitem', { name: 'Export PDF', exact: true })

  await trigger.focus()
  await trigger.press('Enter')
  await expect(docx).toBeFocused()
  await page.keyboard.press('ArrowRight')
  const docxChild = page.getByRole('menu', { name: 'Export DOCX' })
  await expect(docxChild.getByRole('menuitem', { name: 'Email', exact: true })).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await expect(docxChild.getByRole('menuitem', { name: 'Folder', exact: true })).toBeFocused()
  await page.keyboard.press('ArrowLeft')
  await expect(docxChild).toHaveCount(0)
  await expect(docx).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await expect(pdf).toBeFocused()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('menu', { name: 'Export PDF' })
    .getByRole('menuitem', { name: 'Email', exact: true })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page.locator('.rv-menu-surface')).toHaveCount(0)
  await expect(trigger).toBeFocused()
  await expect(trigger).toHaveAttribute('aria-expanded', 'false')

  await trigger.press('Space')
  await page.keyboard.press('Tab')
  await expect(root).toHaveCount(0)
  await expect(page.getByTitle('Recent documents', { exact: true })).toBeFocused()

  await trigger.click()
  const copyPath = page.getByTitle('Copy path', { exact: true })
  await copyPath.click()
  await expect(root).toHaveCount(0)
  await expect(copyPath).toBeFocused()
})

test('Office Export root and nested surfaces clamp and flip inside a constrained viewport', async ({ page }) => {
  await installOutputApi(page)
  const trigger = await openOfficeDocument(page)
  await page.setViewportSize({ width: 430, height: 240 })
  await trigger.focus()
  await trigger.press('Enter')
  const root = page.getByRole('menu', { name: 'Export document' })
  await root.getByRole('menuitem', { name: 'Export PDF', exact: true }).hover()
  const child = page.getByRole('menu', { name: 'Export PDF' })
  await expect(child).toBeVisible()
  const viewport = page.viewportSize()!
  for (const surface of [root, child]) {
    const box = (await surface.boundingBox())!
    expect(box.x).toBeGreaterThanOrEqual(7.5)
    expect(box.y).toBeGreaterThanOrEqual(7.5)
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width - 7.5)
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height - 7.5)
  }
  const rootBox = (await root.boundingBox())!
  const childBox = (await child.boundingBox())!
  expect(childBox.x).toBeLessThan(rootBox.x)
})

test('Office Export disables and closes during pending output, blocks double activation, and keeps rejection on the Office error path', async ({ page }) => {
  await installOutputApi(page)
  const trigger = await openOfficeDocument(page)
  await page.evaluate(() => {
    (window as typeof window & { __officeDeferNextEmail?: boolean }).__officeDeferNextEmail = true
  })
  await trigger.click()
  const markdown = page.getByRole('menu', { name: 'Export document' })
    .getByRole('menuitem', { name: 'Email Markdown', exact: true })
  await markdown.evaluate((element) => {
    ;(element as HTMLButtonElement).click()
    ;(element as HTMLButtonElement).click()
  })

  await expect.poll(async () => (await outputCalls(page)).length).toBe(1)
  await expect(page.locator('.rv-menu-surface')).toHaveCount(0)
  await expect(trigger).toBeDisabled()
  await expect(trigger.locator('.material-symbols-outlined')).toHaveText('progress_activity')
  expect(await page.evaluate(() => document.activeElement?.closest('.rv-menu-surface') === null)).toBe(true)
  await trigger.click({ force: true })
  expect(await outputCalls(page)).toHaveLength(1)

  await page.evaluate(() => {
    const observed = window as typeof window & { __officeResolveEmail?: () => void }
    observed.__officeResolveEmail?.()
    delete observed.__officeResolveEmail
  })
  await expect(trigger).toBeEnabled()

  await page.evaluate(() => {
    (window as typeof window & { __officeRejectNextEmail?: boolean }).__officeRejectNextEmail = true
  })
  await trigger.click()
  await page.getByRole('menu', { name: 'Export document' })
    .getByRole('menuitem', { name: 'Email Markdown', exact: true }).click()
  await expect(page.locator('.rv-toast')).toHaveText('Send failed: ADOPT.2 forced rejection')
  await expect.poll(async () => (await outputCalls(page)).length).toBe(2)
  await expect(trigger).toBeEnabled()
  expect((await outputCalls(page)).map(({ channel }) => channel)).toEqual(['email', 'email'])
})
