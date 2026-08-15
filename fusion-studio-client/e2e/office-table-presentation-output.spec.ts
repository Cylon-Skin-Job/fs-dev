import fs from 'node:fs'

import { expect, test, type Page } from '@playwright/test'

import { resetOfficePlaywrightScenario } from './office/fixture-lifecycle.mjs'
import { parseDocumentSettings } from '../src/lib/front-matter'

type FixtureFile = { filename: string; path: string }
type OutputCall = { channel: 'export' | 'email' | 'print'; payload: Record<string, unknown> }

async function installOutputApi(page: Page) {
  await page.addInitScript(() => {
    const observed = window as typeof window & {
      __officeOutputCalls?: Array<{ channel: string; payload: unknown }>
      __officeResolveMarkdownEmail?: () => void
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
            base64: btoa(format === 'pdf' ? '%PDF-office' : 'PK-office'),
            filename: `${String(payload.filename)}.${format}`,
          }
        },
        printDocument: async (payload: Record<string, unknown>) => {
          observed.__officeOutputCalls?.push({ channel: 'print', payload: structuredClone(payload) })
          return { success: true }
        },
        sendDocumentEmail: (payload: Record<string, unknown>) => {
          observed.__officeOutputCalls?.push({ channel: 'email', payload: structuredClone(payload) })
          if (payload.format !== 'markdown') return Promise.resolve({ success: true })
          return new Promise((resolve) => {
            observed.__officeResolveMarkdownEmail = () => resolve({ success: true })
          })
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

async function outputCalls(page: Page): Promise<OutputCall[]> {
  return page.evaluate(() => (
    (window as typeof window & { __officeOutputCalls?: OutputCall[] }).__officeOutputCalls ?? []
  ))
}

async function openOfficeDocument(page: Page, filename: string) {
  await page.goto('/')
  await page.getByTitle('Office', { exact: true }).click()
  const document = page.getByTitle(filename, { exact: true })
  const folder = page.getByTitle('001-Fixtures', { exact: true })
  const openDocument = page.locator('.rv-office-document-page')
  await expect(document.or(folder).or(openDocument)).toBeVisible({ timeout: 15_000 })
  if (await openDocument.isVisible()) await page.getByTitle('Back', { exact: true }).click()
  await expect(document.or(folder)).toBeVisible({ timeout: 15_000 })
  if (await folder.isVisible()) await folder.click()
  await document.click()
  await expect(page.locator('.rv-office-document-page')).toBeVisible()
  await expect(page.locator('.rv-office-document-editor table.rv-office-table')).toHaveCount(50)
}

function assertOfficePair(payload: Record<string, unknown>, expectedBody: string) {
  expect(payload.content).toBe(expectedBody)
  expect(payload.presentationMode).toBe('office-tables')
  const descriptor = payload.tablePresentation as { markdownSha256?: string; tables?: unknown[] }
  expect(descriptor.markdownSha256).toMatch(/^[0-9a-f]{64}$/)
  expect(descriptor.tables).toHaveLength(50)
}

test('[slice 11.4] Office Export exposes direct single-shot Markdown email by pointer and keyboard', async ({ page }) => {
  test.setTimeout(120_000)
  const files = await resetOfficePlaywrightScenario({
    scenario: 'presentation-output', copies: 2, workspaces: 1,
  }) as FixtureFile[]
  await installOutputApi(page)

  for (const [index, activation] of ['pointer', 'keyboard'].entries()) {
    const fixture = files[index]
    await openOfficeDocument(page, fixture.filename)
    const trigger = page.getByTitle('Export', { exact: true })
    if (activation === 'pointer') {
      await trigger.click()
    } else {
      await trigger.focus()
      await page.keyboard.press('Enter')
    }

    const dropdown = page.locator('.rv-office-export-dropdown')
    await expect(dropdown).toBeVisible()
    const topLevelActions = dropdown.locator(':scope > .rv-office-export-row > button, :scope > button')
    await expect(topLevelActions).toHaveCount(4)
    expect((await topLevelActions.allTextContents()).map((value) => value.replace(/\s+/g, ' ').trim())).toEqual([
      'descriptionExport DOCXchevron_right',
      'picture_as_pdfExport PDFchevron_right',
      'markdownEmail Markdown',
      'printPreview PDF',
    ])
    const markdown = dropdown.getByRole('button', { name: 'markdown Email Markdown', exact: true })
    await expect(markdown.locator('.material-symbols-outlined')).toHaveText('markdown')
    expect(await markdown.evaluate((element) => (
      element.parentElement?.classList.contains('rv-office-export-dropdown')
    ))).toBe(true)
    if (activation === 'pointer') {
      await markdown.click()
    } else {
      await markdown.focus()
      await page.keyboard.press('Space')
    }

    await expect(dropdown).toHaveCount(0)
    await expect.poll(async () => (await outputCalls(page)).length).toBe(1)
    await expect(trigger).toBeDisabled()
    await expect(trigger.locator('.material-symbols-outlined')).toHaveText('progress_activity')

    const parsed = parseDocumentSettings(fs.readFileSync(fixture.path, 'utf8'))
    const call = (await outputCalls(page))[0]
    expect(call.channel).toBe('email')
    expect(call.payload).toEqual({
      format: 'markdown',
      content: fs.readFileSync(fixture.path, 'utf8'),
      filename: fixture.filename.replace(/\.md$/i, ''),
    })
    expect(call.payload.content).toContain(parsed.body)
    expect(Object.hasOwn(call.payload, 'presentationMode')).toBe(false)
    expect(Object.hasOwn(call.payload, 'tablePresentation')).toBe(false)
    expect((await outputCalls(page)).filter(({ channel }) => channel !== 'email')).toHaveLength(0)

    await page.evaluate(() => {
      const observed = window as typeof window & { __officeResolveMarkdownEmail?: () => void }
      observed.__officeResolveMarkdownEmail?.()
      delete observed.__officeResolveMarkdownEmail
    })
    await expect(trigger).toBeEnabled()
    await page.getByTitle('Back', { exact: true }).click()
  }
})

test('[slice 11.4] every Office PDF DOCX and Print action sends the exact body plus required pair', async ({ page }) => {
  test.setTimeout(120_000)
  const [fixture] = await resetOfficePlaywrightScenario({
    scenario: 'presentation-output', copies: 1, workspaces: 1,
  }) as FixtureFile[]
  await installOutputApi(page)
  await openOfficeDocument(page, fixture.filename)
  const trigger = page.getByTitle('Export', { exact: true })

  const actions = [
    { parent: 'Export DOCX', child: 'Folder' },
    { parent: 'Export DOCX', child: 'Email' },
    { parent: 'Export PDF', child: 'Folder' },
    { parent: 'Export PDF', child: 'Email' },
  ]
  for (const action of actions) {
    await trigger.click()
    const row = page.locator('.rv-office-export-row').filter({ hasText: action.parent })
    await row.locator(':scope > button').hover()
    await row.locator('.rv-office-export-submenu').getByRole('button', { name: action.child }).click()
    await expect(trigger).toBeEnabled()
  }
  await trigger.click()
  await page.getByRole('button', { name: 'print Preview PDF', exact: true }).click()
  await expect(trigger).toBeEnabled()

  await expect.poll(async () => (await outputCalls(page)).length).toBe(5)
  const calls = await outputCalls(page)
  expect(calls.map(({ channel }) => channel)).toEqual(['export', 'email', 'export', 'email', 'print'])
  expect(calls.map(({ payload }) => payload.format ?? 'print')).toEqual([
    'docx', 'docx', 'pdf', 'pdf', 'print',
  ])
  const expectedBody = parseDocumentSettings(fs.readFileSync(fixture.path, 'utf8')).body
  for (const { payload } of calls) assertOfficePair(payload, expectedBody)
})
