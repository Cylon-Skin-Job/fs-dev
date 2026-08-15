import fs from 'node:fs'
import path from 'node:path'

import { expect, test, type Page } from '@playwright/test'

import { resetOfficePlaywrightScenario } from './office/fixture-lifecycle.mjs'

const FIXTURE_WORKSPACE_ID = 'office-e2e-a'
const FIXTURE_WORKSPACE_LABEL = 'Office E2E A'
const FIXTURE_DOCUMENT_NAME = 'Basic Tables.md'

let fixtureDocumentPath = ''
let canonicalFixtureBytes: Buffer

function assertIsolatedFixtureDocument(filePath: string) {
  const fixtureRoot = process.env.FUSION_OFFICE_E2E_FIXTURE_ROOT
  if (!fixtureRoot) throw new Error('FUSION_OFFICE_E2E_FIXTURE_ROOT is not set')

  const relativePath = path.relative(path.resolve(fixtureRoot), path.resolve(filePath))
  if (!relativePath || relativePath === '..' || relativePath.startsWith(`..${path.sep}`) || path.isAbsolute(relativePath)) {
    throw new Error('Office smoke document is outside its isolated fixture root')
  }
  expect(relativePath.split(path.sep)).toEqual(expect.arrayContaining([
    'workspace-a',
    'ai',
    'Office-E2E',
    'Office',
    '001-Fixtures',
    FIXTURE_DOCUMENT_NAME,
  ]))
}

function waitForSuccessfulSave(page: Page, expectedPath: string) {
  return new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timed out waiting for the normal file_save_response')), 30_000)

    page.on('websocket', (socket) => {
      socket.on('framereceived', ({ payload }) => {
        if (typeof payload !== 'string') return
        try {
          const message = JSON.parse(payload) as Record<string, unknown>
          if (message.type !== 'file_save_response' || message.panel !== 'office-viewer' || message.path !== expectedPath) return
          clearTimeout(timeout)
          if (message.success === true) resolve()
          else reject(new Error(`Office save failed: ${String(message.error ?? 'unknown error')}`))
        } catch {
          // Other WebSocket frames are not part of this assertion.
        }
      })
    })
  })
}

test.beforeEach(async () => {
  const files = await resetOfficePlaywrightScenario({ scenario: 'basic', copies: 1, workspaces: 1 })
  expect(files).toHaveLength(1)
  expect(files[0].filename).toBe(FIXTURE_DOCUMENT_NAME)
  fixtureDocumentPath = files[0].path
  assertIsolatedFixtureDocument(fixtureDocumentPath)
  canonicalFixtureBytes = fs.readFileSync(fixtureDocumentPath)
})

test.afterEach(async ({ page }) => {
  await page.close()
  const files = await resetOfficePlaywrightScenario({ scenario: 'basic', copies: 1, workspaces: 1 })
  expect(files).toHaveLength(1)
  assertIsolatedFixtureDocument(files[0].path)
  expect(fs.readFileSync(files[0].path)).toEqual(canonicalFixtureBytes)
})

test('[slice 07.4] expected cleanup trace probe', async ({ page }) => {
  test.skip(
    process.env.FUSION_OFFICE_E2E_EXPECTED_TRACE_FAILURE !== '1',
    'Only the fixture-lifecycle child regression enables this expected failure',
  )
  await page.setContent('<p>Office cleanup trace probe</p>')
  throw new Error('Expected Office Playwright trace failure')
})

test('[slice 00.3] isolated Office opens the real editor and persists a harmless edit', async ({ page }) => {
  const uniqueEdit = `office-e2e-${Date.now()}-${test.info().retry}`
  const relativeDocumentPath = '001-Fixtures/Basic Tables.md'
  const saveResponse = waitForSuccessfulSave(page, relativeDocumentPath)

  await page.goto('/')
  await expect(page.locator('.rv-workspace-name')).toHaveText(FIXTURE_WORKSPACE_LABEL)

  await page.getByTitle('Switch workspace').click()
  const ribbonItems = page.locator('.rv-workspace-ribbon-item[data-workspace-id]')
  await expect(ribbonItems).toHaveCount(3)
  await expect(ribbonItems.nth(0)).toHaveAttribute('data-workspace-id', FIXTURE_WORKSPACE_ID)
  await expect(ribbonItems.nth(0)).toHaveClass(/\bis-active\b/)
  await page.locator('.rv-workspace-ribbon-scrim').click()

  await page.getByTitle('Office', { exact: true }).click()
  await expect(page.locator('.rv-office-shell')).toBeVisible()
  await page.getByTitle('001-Fixtures', { exact: true }).click()
  await page.getByTitle(FIXTURE_DOCUMENT_NAME, { exact: true }).click()

  const documentPage = page.locator('.rv-office-document-page')
  await expect(documentPage).toBeVisible()
  await expect(documentPage.locator('.rv-office-document-filename')).toContainText(FIXTURE_DOCUMENT_NAME)

  const editor = documentPage.locator('.rv-office-document-editor .milkdown .ProseMirror[contenteditable="true"]')
  await expect(editor).toBeVisible()
  const tables = editor.locator('table.rv-office-table')
  await expect(tables).toHaveCount(2)
  await expect(tables.nth(0)).toBeVisible()
  await expect(tables.nth(0)).toContainText('basic-a-r1c0')
  await expect(tables.nth(1)).toBeVisible()
  await expect(tables.nth(1)).toContainText('basic-b-r1c0')

  const beforeParagraph = editor.locator('p').filter({ hasText: 'Before basic.' }).first()
  await expect(beforeParagraph).toBeVisible()
  await beforeParagraph.click()
  await page.keyboard.press('End')
  await page.keyboard.type(` ${uniqueEdit}`)
  await expect(editor).toContainText(uniqueEdit)

  await saveResponse
  await expect.poll(() => fs.readFileSync(fixtureDocumentPath, 'utf8')).toContain(uniqueEdit)
})
