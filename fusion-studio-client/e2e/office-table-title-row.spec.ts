import fs from 'node:fs'

import { expect, test, type Page } from '@playwright/test'
import { Schema } from '@milkdown/kit/prose/model'
import { EditorState, type Transaction } from '@milkdown/kit/prose/state'
import { tableNodes } from '@milkdown/kit/prose/tables'

import {
  DEFAULT_SETTINGS,
  getRawDocumentTableStyles,
  hasDocumentTableTitleRow,
  parseDocumentSettings,
  serializeDocumentSettings,
} from '../src/lib/front-matter'
import {
  OFFICE_TABLE_TITLE_STALE,
  OFFICE_TABLE_TITLE_VALID,
  transformOfficeTableTitles,
} from '../src/components/office/officeTableTitleCodec'
import {
  getOfficeTableMutationForAction,
  isOfficeTableMutationForbiddenForVerifiedTitle,
} from '../src/components/office/officeTableContextMenu'
import { registerOfficeTableMetadataBindings } from '../src/components/office/officeTableHistory'
import {
  createOfficeTableMutationCommand,
  runStockOfficeTableMutation,
} from '../src/components/office/officeTableMutations'
import { resetOfficePlaywrightScenario } from './office/fixture-lifecycle.mjs'

const TITLE_ROW_FILENAME = 'Title Row.md'

const titleCoordinatorNodes = tableNodes({
  tableGroup: 'block',
  cellContent: 'paragraph+',
  cellAttributes: { alignment: { default: 'left' } },
})
const titleCoordinatorSchema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: { group: 'block', content: 'text*' },
    text: {},
    table: {
      ...titleCoordinatorNodes.table,
      content: 'table_header_row table_row+',
      attrs: {
        officeTitleRowState: { default: null },
        officeTitleDiagnostic: { default: null },
      },
    },
    table_header_row: { ...titleCoordinatorNodes.table_row, content: 'table_header*' },
    table_row: { ...titleCoordinatorNodes.table_row, content: 'table_cell*' },
    table_header: titleCoordinatorNodes.table_header,
    table_cell: titleCoordinatorNodes.table_cell,
  },
})

function titleCoordinatorTable(dataRowCount = 1) {
  const paragraph = (value: string) => titleCoordinatorSchema.node(
    'paragraph',
    null,
    titleCoordinatorSchema.text(value),
  )
  const row = (prefix: string) => titleCoordinatorSchema.node(
    'table_row',
    null,
    Array.from({ length: 3 }, (_, column) => titleCoordinatorSchema.node(
      'table_cell',
      { alignment: 'left' },
      paragraph(`${prefix}${column}`),
    )),
  )
  return titleCoordinatorSchema.node('table', {
    officeTitleRowState: OFFICE_TABLE_TITLE_VALID,
    officeTitleDiagnostic: null,
  }, [
    titleCoordinatorSchema.node('table_header_row', null, [
      titleCoordinatorSchema.node(
        'table_header',
        { alignment: 'left', colspan: 3 },
        paragraph('Title'),
      ),
    ]),
    row('H'),
    ...Array.from({ length: dataRowCount }, (_, index) => row(`D${index}`)),
  ])
}

type FixtureFile = {
  filename: string
  path: string
}

async function resetTitleRowFixture(): Promise<FixtureFile> {
  const files = await resetOfficePlaywrightScenario({
    scenario: 'title-row',
    copies: 1,
    workspaces: 1,
  })
  const fixture = files.find(({ filename }: FixtureFile) => filename === TITLE_ROW_FILENAME)
  expect(fixture).toBeTruthy()
  return fixture as FixtureFile
}

async function openTitleRowDocument(page: Page) {
  await page.goto('/')
  await page.getByTitle('Office', { exact: true }).click()
  const folder = page.getByTitle('001-Fixtures', { exact: true })
  const document = page.getByTitle(TITLE_ROW_FILENAME, { exact: true })
  const editor = page.locator(
    '.rv-office-document-editor .milkdown .ProseMirror[contenteditable="true"]',
  )
  await expect.poll(async () => (
    await folder.isVisible() || await document.isVisible() || await editor.isVisible()
  ), { timeout: 15_000 }).toBe(true)
  if (!await document.isVisible() && !await editor.isVisible()) {
    await folder.click()
    await expect(document).toBeVisible()
  }
  if (!await editor.isVisible()) await document.click()
  await expect(editor).toBeVisible()
  return editor
}

function installSaveObservation(page: Page) {
  return page.addInitScript(() => {
    const originalSend = WebSocket.prototype.send
    const observed = window as typeof window & { __titleRowSaveCount?: number }
    observed.__titleRowSaveCount = 0
    WebSocket.prototype.send = function observeTitleRowSave(data) {
      if (typeof data === 'string') {
        try {
          const message = JSON.parse(data) as { type?: string }
          if (message.type === 'file_save') {
            observed.__titleRowSaveCount = (observed.__titleRowSaveCount ?? 0) + 1
          }
        } catch {
          // Preserve unrelated non-JSON WebSocket frames.
        }
      }
      return originalSend.call(this, data)
    }
  })
}

function readSaveCount(page: Page) {
  return page.evaluate(() => (
    (window as typeof window & { __titleRowSaveCount?: number }).__titleRowSaveCount ?? 0
  ))
}

async function installMetadataEventObservation(page: Page) {
  await page.evaluate(() => {
    const observed = window as typeof window & {
      __titleRowMetadataEvents?: string[]
      __officeTableMetadataTestHook?: (event: string) => void
    }
    observed.__titleRowMetadataEvents = []
    observed.__officeTableMetadataTestHook = (event) => {
      observed.__titleRowMetadataEvents?.push(event)
    }
  })
}

function installMetadataInitObservation(page: Page) {
  return page.addInitScript(() => {
    const observed = window as typeof window & {
      __titleRowMetadataEvents?: string[]
      __officeTableMetadataTestHook?: (event: string) => void
    }
    observed.__titleRowMetadataEvents = []
    observed.__officeTableMetadataTestHook = (event) => {
      observed.__titleRowMetadataEvents?.push(event)
    }
  })
}

function readMetadataEvents(page: Page) {
  return page.evaluate(() => (
    (window as typeof window & { __titleRowMetadataEvents?: string[] })
      .__titleRowMetadataEvents ?? []
  ))
}

async function openCellContextMenu(page: Page, cell: ReturnType<Page['locator']>) {
  await cell.click({ button: 'right' })
  const rootMenu = page.getByRole('menu', { name: 'Table cell actions' })
  await expect(rootMenu).toBeVisible()
  return rootMenu
}

async function openTableSubmenu(page: Page) {
  const rootMenu = page.getByRole('menu', { name: 'Table cell actions' })
  await rootMenu.getByRole('menuitem', { name: 'Table', exact: true }).hover()
  const tableMenu = page.getByRole('menu', { name: 'Table', exact: true })
  await expect(tableMenu).toBeVisible()
  return tableMenu
}

async function expectSelectionInside(cell: ReturnType<Page['locator']>) {
  await expect.poll(() => cell.evaluate((element) => {
    const selection = window.getSelection()
    return Boolean(selection?.anchorNode && element.contains(selection.anchorNode))
      && document.activeElement?.classList.contains('ProseMirror') === true
  })).toBe(true)
}

async function runRootTableAction(
  page: Page,
  cell: ReturnType<Page['locator']>,
  label: string,
) {
  const menu = await openCellContextMenu(page, cell)
  const item = menu.getByRole('menuitem', { name: label, exact: true })
  await expect(item).toBeEnabled()
  await item.click()
}

async function expectLogicalGeometry(
  page: Page,
  table: ReturnType<Page['locator']>,
  width: number,
) {
  await expect(table.locator('colgroup > col')).toHaveCount(width)
  const box = await table.boundingBox()
  expect(box).toBeTruthy()
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2)
  const handles = page.locator('.rv-office-table-overlay .rv-office-col-grab')
  await expect(handles).toHaveCount(width + 1)
  await expect.poll(() => handles.evaluateAll((elements) => (
    elements.filter((element) => getComputedStyle(element).display !== 'none').length
  ))).toBe(width + 1)
  const widths = await table.evaluate((element) => {
    const tableWidth = element.getBoundingClientRect().width
    const columnWidth = Array.from(element.querySelectorAll(':scope > colgroup > col'))
      .reduce((sum, column) => sum + column.getBoundingClientRect().width, 0)
    const firstRow = element.querySelector('tbody > tr:first-child')
    const firstCell = firstRow?.querySelector('th')
    const spanningTitleWidth = firstRow?.children.length === 1
      && firstCell instanceof HTMLTableCellElement
      && firstCell.colSpan === element.querySelectorAll(':scope > colgroup > col').length
      ? firstCell.getBoundingClientRect().width
      : null
    return { tableWidth, columnWidth, spanningTitleWidth }
  })
  expect(Math.abs(widths.tableWidth - widths.columnWidth)).toBeLessThanOrEqual(1)
  if (widths.spanningTitleWidth !== null) {
    expect(Math.abs(widths.spanningTitleWidth - widths.columnWidth)).toBeLessThanOrEqual(1)
  }
}

test.describe('[slice 08.1] literal title marker and lossless surrogate classification', () => {
  test('activates literal true only, collapses valid headers, and quarantines stale shapes', () => {
    const tree = {
      type: 'root',
      children: [
        {
          type: 'table',
          align: ['left', 'right', 'center'],
          children: [
            { type: 'tableRow', children: [
              { type: 'tableCell', children: [{ type: 'text', value: 'Title' }] },
              { type: 'tableCell', children: [] },
              { type: 'tableCell', children: [] },
            ] },
            { type: 'tableRow', children: [
              { type: 'tableCell', children: [{ type: 'text', value: 'Name' }] },
              { type: 'tableCell', children: [{ type: 'text', value: 'Q1' }] },
              { type: 'tableCell', children: [{ type: 'text', value: 'Q2' }] },
            ] },
            { type: 'tableRow', children: [
              { type: 'tableCell', children: [{ type: 'text', value: 'Alpha' }] },
              { type: 'tableCell', children: [{ type: 'text', value: '10' }] },
              { type: 'tableCell', children: [{ type: 'text', value: '20' }] },
            ] },
          ],
        },
        {
          type: 'table',
          align: [null, null, null],
          children: [
            { type: 'tableRow', children: [
              { type: 'tableCell', children: [{ type: 'text', value: 'Stale' }] },
              { type: 'tableCell', children: [{ type: 'text', value: 'KEEP ME' }] },
              { type: 'tableCell', children: [] },
            ] },
            { type: 'tableRow', children: [
              { type: 'tableCell', children: [{ type: 'text', value: 'A' }] },
              { type: 'tableCell', children: [{ type: 'text', value: 'B' }] },
              { type: 'tableCell', children: [{ type: 'text', value: 'C' }] },
            ] },
          ],
        },
      ],
    }
    const staleBefore = structuredClone(tree.children[1].children)
    const styles = [
      { tableIndex: 0, titleRow: true, tableOverflow: 'newline', future: 'keep' },
      { tableIndex: 1, titleRow: true, tableOverflow: 'truncate', future: 'keep-stale' },
      { tableIndex: 2, titleRow: 'true' },
    ]

    const outcomes = transformOfficeTableTitles(tree, styles)
    expect(outcomes).toEqual([
      { tableIndex: 0, state: OFFICE_TABLE_TITLE_VALID, diagnostic: null, logicalWidth: 3 },
      {
        tableIndex: 1,
        state: OFFICE_TABLE_TITLE_STALE,
        diagnostic: 'continuation-content',
        logicalWidth: 3,
      },
    ])
    expect(tree.children[0].children[0].children).toHaveLength(1)
    expect(tree.children[0].children[0].children[0].officeTitleColspan).toBe(3)
    expect(tree.children[1].children).toEqual(staleBefore)
    expect(hasDocumentTableTitleRow(styles[0])).toBe(true)
    expect(hasDocumentTableTitleRow(styles[2])).toBe(false)
  })

  test('frontmatter normalization and serialization preserve literal and invalid marker bytes', () => {
    const source = {
      name: 'Marker preservation',
      metadata: {
        preserveUnknown: 'keep-me',
        tableStyles: [
          { tableIndex: 0, titleRow: true, tableOverflow: 'newline', future: 'keep' },
          { tableIndex: 1, titleRow: 'true', tableOverflow: 'future-mode', future: 'keep-2' },
        ],
      },
    }
    const serialized = serializeDocumentSettings('Body.', DEFAULT_SETTINGS, source)
    const reparsed = parseDocumentSettings(serialized)
    expect(getRawDocumentTableStyles(reparsed.frontmatter)).toEqual(
      (source.metadata as Record<string, unknown>).tableStyles,
    )
    expect((reparsed.frontmatter.metadata as Record<string, unknown>).preserveUnknown)
      .toBe('keep-me')
  })
})

test('[slice 08.1] first frame rehydrates one valid title and quarantines stale tables without open effects', async ({ page }) => {
  const fixture = await resetTitleRowFixture()
  const canonicalBytes = fs.readFileSync(fixture.path)
  await installSaveObservation(page)
  const editor = await openTitleRowDocument(page)
  const tables = editor.locator('table.rv-office-table')
  await expect(tables).toHaveCount(5)

  await expect(tables.nth(0).locator('tbody > tr').first().locator('th')).toHaveCount(3)
  await expect(tables.nth(0)).not.toHaveAttribute('data-rv-title-row-state', /.+/)

  await expect(tables.nth(1)).toHaveAttribute('data-rv-title-row-state', 'valid')
  const titleHeader = tables.nth(1).locator('tbody > tr').first().locator('th')
  await expect(titleHeader).toHaveCount(1)
  await expect(titleHeader).toHaveAttribute('colspan', '3')
  await expect(titleHeader).toHaveText('Quarterly Results')
  await expect(tables.nth(1).locator('colgroup > col')).toHaveCount(3)
  await expect(tables.nth(1).locator('tbody > tr').nth(1).locator('td')).toHaveText(['Name', 'Q1', 'Q2'])

  await expect(tables.nth(2).locator('tbody > tr').first().locator('th')).toHaveCount(1)
  await expect(tables.nth(2)).not.toHaveAttribute('data-rv-title-row-state', /.+/)

  await expect(tables.nth(3)).toHaveAttribute('data-rv-title-row-state', 'stale')
  await expect(tables.nth(3)).toHaveAttribute(
    'data-rv-title-row-diagnostic',
    'continuation-content',
  )
  await expect(tables.nth(3).locator('tbody > tr').first().locator('th')).toHaveText([
    'Stale Title',
    'KEEP ME',
    '',
  ])

  await expect(tables.nth(4)).toHaveAttribute('data-rv-title-row-state', 'stale')
  await expect(tables.nth(4)).toHaveAttribute(
    'data-rv-title-row-diagnostic',
    'too-few-physical-rows',
  )
  await expect(tables.nth(4).locator('tbody > tr').first().locator('th')).toHaveCount(3)

  await titleHeader.click()
  await page.keyboard.press('ControlOrMeta+z')
  await expect(tables.nth(1)).toHaveAttribute('data-rv-title-row-state', 'valid')
  await expect(titleHeader).toHaveAttribute('colspan', '3')
  await page.waitForTimeout(800)
  expect(await readSaveCount(page)).toBe(0)
  await expect(page.locator('.rv-office-document-dirty')).toHaveCount(0)
  expect(fs.readFileSync(fixture.path)).toEqual(canonicalBytes)
})

test('[slice 08.1] valid title saves one GFM surrogate with stable second serialization and no content loss', async ({ page }) => {
  const fixture = await resetTitleRowFixture()
  await installSaveObservation(page)
  await openTitleRowDocument(page)

  await page.keyboard.press('ControlOrMeta+s')
  await expect.poll(() => readSaveCount(page), { timeout: 15_000 }).toBe(1)
  const firstSerialization = fs.readFileSync(fixture.path)
  const first = parseDocumentSettings(firstSerialization.toString())
  expect(first.body).toMatch(/\| Quarterly Results\s+\|\s*\|\s*\|/)
  expect(first.body).toMatch(/\|\s*:-+\s*\|\s*-+:\s*\|\s*:-+:\s*\|/)
  expect(first.body).toMatch(/\| Name\s+\| Q1\s*\|\s*Q2\s*\|/)
  expect(first.body).toMatch(/\| Stale Title\s*\| KEEP ME\s*\|\s*\|/)
  expect(first.body).toMatch(/\| Two Row Marked Title\s*\|\s*\|\s*\|/)
  expect((first.frontmatter.metadata as Record<string, unknown>).preserveUnknown).toBe('keep-me')
  expect(getRawDocumentTableStyles(first.frontmatter)).toEqual([
    {
      tableIndex: 1,
      fingerprint: 'fixture-title-valid',
      titleRow: true,
      tableOverflow: 'newline',
      fixtureSeed: 'keep-title-valid',
    },
    {
      tableIndex: 3,
      fingerprint: 'fixture-title-stale',
      titleRow: true,
      tableOverflow: 'truncate',
      fixtureSeed: 'keep-title-stale',
    },
    {
      tableIndex: 4,
      fingerprint: 'fixture-title-two-row-stale',
      titleRow: true,
      tableOverflow: 'overflow',
      fixtureSeed: 'keep-title-two-row-stale',
    },
  ])

  await page.getByTitle('Back', { exact: true }).click()
  const reopened = await openTitleRowDocument(page)
  await expect(reopened.locator('table.rv-office-table').nth(1))
    .toHaveAttribute('data-rv-title-row-state', 'valid')
  await expect(reopened.locator('table.rv-office-table').nth(4))
    .toHaveAttribute('data-rv-title-row-diagnostic', 'too-few-physical-rows')
  expect(fs.readFileSync(fixture.path)).toEqual(firstSerialization)
  expect(await readSaveCount(page)).toBe(0)

  await page.keyboard.press('ControlOrMeta+s')
  await expect.poll(() => readSaveCount(page), { timeout: 15_000 }).toBe(1)
  expect(fs.readFileSync(fixture.path)).toEqual(firstSerialization)
})

test('[slice 08.2] pointer Add title row is one composite event with exact history and persistence', async ({ page }) => {
  const fixture = await resetTitleRowFixture()
  await installSaveObservation(page)
  const editor = await openTitleRowDocument(page)
  const table = editor.locator('table.rv-office-table').nth(0)
  const headerCells = table.locator('tbody > tr').first().locator('th')
  await installMetadataEventObservation(page)

  await openCellContextMenu(page, headerCells.nth(1))
  const tableMenu = await openTableSubmenu(page)
  const menuShape = await tableMenu.evaluate((element) => Array.from(element.children).map((child) => (
    child.getAttribute('role') === 'separator'
      ? { kind: 'separator' }
      : {
        kind: 'item',
        label: child.textContent?.trim(),
        icon: child.querySelector('.material-symbols-outlined')?.textContent,
      }
  )))
  expect(menuShape).toEqual([
    { kind: 'item', label: 'variable_addAdd title row', icon: 'variable_add' },
    { kind: 'separator' },
    { kind: 'item', label: 'border_allBorder size1pxchevron_right', icon: 'border_all' },
    { kind: 'item', label: 'border_allBorder colorDefault', icon: 'border_all' },
    { kind: 'separator' },
    { kind: 'item', label: 'align_horizontal_leftAlign table leftcheck', icon: 'align_horizontal_left' },
    { kind: 'item', label: 'align_horizontal_centerAlign table center', icon: 'align_horizontal_center' },
    { kind: 'item', label: 'align_horizontal_rightAlign table right', icon: 'align_horizontal_right' },
    { kind: 'separator' },
    { kind: 'item', label: 'format_text_overflowOverflowOverflowchevron_right', icon: 'format_text_overflow' },
    { kind: 'separator' },
    { kind: 'item', label: 'deleteRemove table', icon: 'delete' },
  ])
  const addTitle = tableMenu.getByRole('menuitem', { name: 'Add title row', exact: true })
  await expect(addTitle).toBeEnabled()
  await addTitle.click()

  const title = table.locator('tbody > tr').first().locator('th')
  await expect(title).toHaveCount(1)
  await expect(title).toHaveAttribute('colspan', '3')
  await expect(title).toHaveText('')
  await expect(table).toHaveAttribute('data-rv-title-row-state', 'valid')
  await expect(table.locator('colgroup > col')).toHaveCount(3)
  await expect(table.locator('tbody > tr').nth(1).locator('td')).toHaveText([
    'ordinary-h0', 'ordinary-h1', 'ordinary-h2',
  ])
  await expectSelectionInside(title)
  await expect.poll(() => readMetadataEvents(page)).toEqual([
    'step', 'plugin-publish', 'external-publish',
  ])

  await page.keyboard.type('Annual summary')
  await expect(title).toHaveText('Annual summary')
  await page.keyboard.press('ControlOrMeta+z')
  await expect(title).toHaveText('')
  await expect(table).toHaveAttribute('data-rv-title-row-state', 'valid')
  await page.keyboard.press('ControlOrMeta+z')
  await expect(headerCells).toHaveText(['ordinary-h0', 'ordinary-h1', 'ordinary-h2'])
  await expect(table).not.toHaveAttribute('data-rv-title-row-state', /.+/)
  await page.keyboard.press('ControlOrMeta+Shift+z')
  await expect(title).toHaveCount(1)
  await expect(title).toHaveText('')
  await page.keyboard.press('ControlOrMeta+Shift+z')
  await expect(title).toHaveText('Annual summary')

  await expect.poll(() => readSaveCount(page), { timeout: 15_000 }).toBe(1)
  const saved = parseDocumentSettings(fs.readFileSync(fixture.path, 'utf8'))
  const metadata = saved.frontmatter.metadata as Record<string, unknown>
  const styles = getRawDocumentTableStyles(saved.frontmatter) as Array<Record<string, unknown>>
  const addedStyle = styles.find((entry) => entry.tableIndex === 0)
  expect(addedStyle).toEqual({
    tableIndex: 0,
    fingerprint: expect.any(String),
    titleRow: true,
  })
  expect(metadata.preserveUnknown).toBe('keep-me')
  expect((metadata.tables as Array<Record<string, unknown>>).find((entry) => entry.tableIndex === 0)?.columns)
    .toEqual([90, 110, 130])
  expect((metadata.tableColors as Array<Record<string, unknown>>).find((entry) => entry.tableIndex === 0)?.cells)
    .toEqual({ '1,0': '#d6ebff' })
  expect(saved.body).toMatch(/\| Annual summary\s+\|\s+\|\s+\|/)
  expect(saved.body).toMatch(/\| ordinary-h0\s+\| ordinary-h1\s+\| ordinary-h2\s+\|/)

  await installMetadataEventObservation(page)
  const titleRootMenu = await openCellContextMenu(page, title)
  await titleRootMenu.getByRole('menuitem', { name: 'Delete Row', exact: true }).click()
  await expect(table.locator('tbody > tr').first().locator('th')).toHaveText([
    'ordinary-h0', 'ordinary-h1', 'ordinary-h2',
  ])
  await expect(table).not.toHaveAttribute('data-rv-title-row-state', /.+/)
  await expect.poll(() => readMetadataEvents(page)).toEqual([
    'step', 'plugin-publish', 'external-publish',
  ])
  await expect.poll(() => readSaveCount(page), { timeout: 15_000 }).toBe(2)
  const restored = parseDocumentSettings(fs.readFileSync(fixture.path, 'utf8'))
  const restoredStyles = getRawDocumentTableStyles(restored.frontmatter) as Array<Record<string, unknown>>
  expect(restoredStyles.some((entry) => entry.tableIndex === 0)).toBe(false)
  expect(restored.body).toMatch(/\| ordinary-h0\s+\| ordinary-h1\s+\| ordinary-h2\s+\|/)
})

test('[slice 08.2] keyboard Add replaces a stale marker losslessly and disabled tables are exact no-ops', async ({ page }) => {
  await resetTitleRowFixture()
  const editor = await openTitleRowDocument(page)
  const tables = editor.locator('table.rv-office-table')

  for (const tableIndex of [1, 2]) {
    const table = tables.nth(tableIndex)
    const topCell = table.locator('tbody > tr').first().locator('th').first()
    const before = await table.locator('tbody > tr').evaluateAll((rows) => rows.map((row) => row.textContent))
    await openCellContextMenu(page, topCell)
    const tableMenu = await openTableSubmenu(page)
    const addTitle = tableMenu.getByRole('menuitem', { name: 'Add title row', exact: true })
    await expect(addTitle).toBeDisabled()
    await expect(addTitle).toHaveAttribute('aria-disabled', 'true')
    await expect(addTitle).not.toHaveAttribute('title', /.+/)
    await expect(addTitle).not.toHaveAttribute('aria-label', /.+/)
    await addTitle.evaluate((button: HTMLButtonElement) => button.click())
    await page.keyboard.press('Escape')
    await expect(table.locator('tbody > tr')).toHaveText(before)
  }

  const stale = tables.nth(3)
  const staleHeader = stale.locator('tbody > tr').first().locator('th')
  await openCellContextMenu(page, staleHeader.nth(1))
  await page.keyboard.press('ArrowRight')
  const addTitle = page.getByRole('menu', { name: 'Table', exact: true })
    .getByRole('menuitem', { name: 'Add title row', exact: true })
  await expect(addTitle).toBeFocused()
  await page.keyboard.press('Enter')

  const title = stale.locator('tbody > tr').first().locator('th')
  await expect(title).toHaveCount(1)
  await expect(title).toHaveAttribute('colspan', '3')
  await expect(stale).toHaveAttribute('data-rv-title-row-state', 'valid')
  await expect(stale).not.toHaveAttribute('data-rv-title-row-diagnostic', /.+/)
  await expect(stale.locator('tbody > tr').nth(1).locator('td')).toHaveText([
    'Stale Title', 'KEEP ME', '',
  ])
  await expectSelectionInside(title)
})

test('[slice 08.2] verified title context has exact disabled controls and pointer Delete Row history', async ({ page }) => {
  const fixture = await resetTitleRowFixture()
  await installSaveObservation(page)
  const editor = await openTitleRowDocument(page)
  const table = editor.locator('table.rv-office-table').nth(1)
  const title = table.locator('tbody > tr').first().locator('th')
  await installMetadataEventObservation(page)

  const rootMenu = await openCellContextMenu(page, title)
  const tableMenu = await openTableSubmenu(page)
  const disabledLabels = [
    'Add title row',
    'Insert Row Above',
    'Delete Row Above',
    'Insert Column Left',
    'Insert Column Right',
    'Delete Column Left',
    'Delete Column Right',
  ]
  for (const label of disabledLabels) {
    const item = label === 'Add title row'
      ? tableMenu.getByRole('menuitem', { name: label, exact: true })
      : rootMenu.getByRole('menuitem', { name: label, exact: true })
    await expect(item).toBeDisabled()
    await expect(item).toHaveAttribute('aria-disabled', 'true')
    await expect(item).not.toHaveAttribute('title', /.+/)
    await expect(item).not.toHaveAttribute('aria-label', /.+/)
  }
  const deleteRow = rootMenu.getByRole('menuitem', { name: 'Delete Row', exact: true })
  await expect(deleteRow).toBeEnabled()
  await expect(deleteRow.locator('.material-symbols-outlined')).toHaveText('delete')
  const rootLabels = await rootMenu.getByRole('menuitem').allTextContents()
  expect(rootLabels.indexOf('deleteDelete Row') + 1).toBe(rootLabels.indexOf('deleteDelete Row Above'))
  await deleteRow.click()

  const promoted = table.locator('tbody > tr').first().locator('th')
  await expect(promoted).toHaveText(['Name', 'Q1', 'Q2'])
  await expect(table).not.toHaveAttribute('data-rv-title-row-state', /.+/)
  await expect(rootMenu).toHaveCount(0)
  await expectSelectionInside(promoted.first())
  await expect.poll(() => readMetadataEvents(page)).toEqual([
    'step', 'plugin-publish', 'external-publish',
  ])

  await page.keyboard.type(' promoted')
  await expect(promoted.first()).toHaveText(' promotedName')
  await page.keyboard.press('ControlOrMeta+z')
  await expect(promoted.first()).toHaveText('Name')
  await page.keyboard.press('ControlOrMeta+z')
  await expect(title).toHaveText('Quarterly Results')
  await expect(table).toHaveAttribute('data-rv-title-row-state', 'valid')
  await page.keyboard.press('ControlOrMeta+Shift+z')
  await expect(promoted).toHaveText(['Name', 'Q1', 'Q2'])
  await page.keyboard.press('ControlOrMeta+Shift+z')
  await expect(promoted.first()).toHaveText(' promotedName')

  await expect.poll(() => readSaveCount(page), { timeout: 15_000 }).toBe(1)
  const saved = parseDocumentSettings(fs.readFileSync(fixture.path, 'utf8'))
  const styles = getRawDocumentTableStyles(saved.frontmatter) as Array<Record<string, unknown>>
  expect(styles.find((entry) => entry.tableIndex === 1)).toMatchObject({
    tableIndex: 1,
    tableOverflow: 'newline',
    fixtureSeed: 'keep-title-valid',
  })
  expect(styles.find((entry) => entry.tableIndex === 1)).not.toHaveProperty('titleRow')
  const metadata = saved.frontmatter.metadata as Record<string, unknown>
  expect((metadata.tables as Array<Record<string, unknown>>).find((entry) => entry.tableIndex === 1)?.columns)
    .toEqual([100, 120, 140])
  expect((metadata.tableColors as Array<Record<string, unknown>>).find((entry) => entry.tableIndex === 1))
    .toMatchObject({ columns: { '1': { color: '#d6ffd6', rank: 3 } } })
  expect((metadata.tableColors as Array<Record<string, unknown>>).find((entry) => entry.tableIndex === 1))
    .not.toHaveProperty('cells')
})

test('[slice 08.2] keyboard Delete Row restores promoted focus and remains absent outside title context', async ({ page }) => {
  await resetTitleRowFixture()
  const editor = await openTitleRowDocument(page)
  const tables = editor.locator('table.rv-office-table')

  for (const tableIndex of [0, 3, 4]) {
    const table = tables.nth(tableIndex)
    await openCellContextMenu(page, table.locator('tbody > tr').first().locator('th').first())
    await expect(page.getByRole('menu', { name: 'Table cell actions' })
      .getByRole('menuitem', { name: 'Delete Row', exact: true })).toHaveCount(0)
    await page.keyboard.press('Escape')
  }

  const titleTable = tables.nth(1)
  await openCellContextMenu(page, titleTable.locator('tbody > tr').first().locator('th'))
  const deleteRow = page.getByRole('menu', { name: 'Table cell actions' })
    .getByRole('menuitem', { name: 'Delete Row', exact: true })
  await deleteRow.focus()
  await page.keyboard.press('Enter')
  const promoted = titleTable.locator('tbody > tr').first().locator('th')
  await expect(promoted).toHaveText(['Name', 'Q1', 'Q2'])
  await expectSelectionInside(promoted.first())
  await expect(page.getByRole('menu', { name: 'Table cell actions' })).toHaveCount(0)
})

test('[slice 08.3] ordinary and title header deletion promote exactly and reindex colors in one event', async ({ page }) => {
  const fixture = await resetTitleRowFixture()
  await installSaveObservation(page)
  const editor = await openTitleRowDocument(page)
  const tables = editor.locator('table.rv-office-table')

  const ordinary = tables.nth(0)
  await installMetadataEventObservation(page)
  await runRootTableAction(
    page,
    ordinary.locator('tbody > tr').nth(1).locator('td').nth(1),
    'Delete Row Above',
  )
  await expect(ordinary.locator('tbody > tr')).toHaveCount(2)
  await expect(ordinary.locator('tbody > tr').first().locator('th')).toHaveText([
    'ordinary-r1c0', 'ordinary-r1c1', 'ordinary-r1c2',
  ])
  await expect(ordinary.locator('tbody > tr').nth(1).locator('td')).toHaveText([
    'ordinary-r2c0', 'ordinary-r2c1', 'ordinary-r2c2',
  ])
  await expect(tables.nth(3)).toHaveAttribute('data-rv-title-row-state', 'stale')
  await expect(tables.nth(3)).toHaveAttribute('data-rv-title-row-diagnostic', 'continuation-content')
  await expect(tables.nth(4)).toHaveAttribute('data-rv-title-row-state', 'stale')
  await expect(tables.nth(4)).toHaveAttribute('data-rv-title-row-diagnostic', 'too-few-physical-rows')
  await expect.poll(() => readMetadataEvents(page)).toEqual([
    'step', 'plugin-publish', 'external-publish',
  ])
  await expect.poll(() => readSaveCount(page), { timeout: 15_000 }).toBe(1)
  let saved = parseDocumentSettings(fs.readFileSync(fixture.path, 'utf8'))
  let metadata = saved.frontmatter.metadata as Record<string, unknown>
  expect((metadata.tables as Array<Record<string, unknown>>)
    .find((entry) => entry.tableIndex === 0)?.columns).toEqual([90, 110, 130])
  expect((metadata.tableColors as Array<Record<string, unknown>>)
    .some((entry) => entry.tableIndex === 0)).toBe(false)
  const siblingStyles = getRawDocumentTableStyles(saved.frontmatter) as Array<Record<string, unknown>>
  expect(siblingStyles.find((entry) => entry.tableIndex === 3)?.titleRow).toBe(true)
  expect(siblingStyles.find((entry) => entry.tableIndex === 4)?.titleRow).toBe(true)

  await openCellContextMenu(page, ordinary.locator('tbody > tr').first().locator('th').first())
  const ordinaryTableMenu = await openTableSubmenu(page)
  await expect(ordinaryTableMenu.getByRole('menuitem', { name: 'Add title row', exact: true }))
    .toBeEnabled()
  await page.keyboard.press('Escape')

  const titleTable = tables.nth(1)
  await installMetadataEventObservation(page)
  await runRootTableAction(
    page,
    titleTable.locator('tbody > tr').first().locator('th'),
    'Delete Row',
  )
  await expect(titleTable.locator('tbody > tr')).toHaveCount(2)
  await expect(titleTable.locator('tbody > tr').first().locator('th')).toHaveText(['Name', 'Q1', 'Q2'])
  await expect(titleTable).not.toHaveAttribute('data-rv-title-row-state', /.+/)
  await expect.poll(() => readMetadataEvents(page)).toEqual([
    'step', 'plugin-publish', 'external-publish',
  ])
  await expectLogicalGeometry(page, titleTable, 3)
  const promotedColors = await titleTable.locator('tbody > tr').first().locator('th')
    .evaluateAll((cells) => cells.map((cell) => getComputedStyle(cell).backgroundColor))
  expect(promotedColors[0]).not.toBe('rgb(255, 238, 170)')
  expect(promotedColors[1]).toBe('rgb(214, 255, 214)')

  await page.keyboard.press('ControlOrMeta+z')
  await expect(titleTable).toHaveAttribute('data-rv-title-row-state', 'valid')
  await expect(titleTable.locator('tbody > tr').first().locator('th')).toHaveAttribute('colspan', '3')
  await page.keyboard.press('ControlOrMeta+Shift+z')
  await expect(titleTable.locator('tbody > tr').first().locator('th')).toHaveText(['Name', 'Q1', 'Q2'])

  await expect.poll(() => readSaveCount(page), { timeout: 15_000 }).toBe(2)
  saved = parseDocumentSettings(fs.readFileSync(fixture.path, 'utf8'))
  metadata = saved.frontmatter.metadata as Record<string, unknown>
  const titleStyle = (getRawDocumentTableStyles(saved.frontmatter) as Array<Record<string, unknown>>)
    .find((entry) => entry.tableIndex === 1)
  expect(titleStyle).toMatchObject({ tableOverflow: 'newline', fixtureSeed: 'keep-title-valid' })
  expect(titleStyle).not.toHaveProperty('titleRow')
  expect((metadata.tables as Array<Record<string, unknown>>)
    .find((entry) => entry.tableIndex === 1)?.columns).toEqual([100, 120, 140])
  expect((metadata.tableColors as Array<Record<string, unknown>>)
    .find((entry) => entry.tableIndex === 1)).toMatchObject({
    columns: { '1': { color: '#d6ffd6', rank: 3 } },
  })
})

test('[slice 08.3] title column mutations retain the literal marker through width one and restore logical span', async ({ page }) => {
  const fixture = await resetTitleRowFixture()
  await installSaveObservation(page)
  const editor = await openTitleRowDocument(page)
  const table = editor.locator('table.rv-office-table').nth(1)
  const title = table.locator('tbody > tr').first().locator('th')

  await expectLogicalGeometry(page, table, 3)
  await installMetadataEventObservation(page)
  await runRootTableAction(page, table.locator('tbody > tr').nth(1).locator('td').nth(2), 'Delete Column Left')
  await expect(title).toHaveAttribute('colspan', '2')
  await expectLogicalGeometry(page, table, 2)
  await expect.poll(() => readMetadataEvents(page)).toEqual([
    'step', 'plugin-publish', 'external-publish',
  ])
  await installMetadataEventObservation(page)
  await runRootTableAction(page, table.locator('tbody > tr').nth(1).locator('td').nth(1), 'Delete Column Left')
  await expect.poll(() => title.evaluate((cell: HTMLTableCellElement) => cell.colSpan)).toBe(1)
  await expectLogicalGeometry(page, table, 1)
  await expect(table).toHaveAttribute('data-rv-title-row-state', 'valid')
  await expect.poll(() => readMetadataEvents(page)).toEqual([
    'step', 'plugin-publish', 'external-publish',
  ])

  const widthOneSaveCount = await readSaveCount(page)
  await page.keyboard.press('ControlOrMeta+s')
  await expect.poll(() => readSaveCount(page), { timeout: 15_000 })
    .toBeGreaterThan(widthOneSaveCount)
  let saved = parseDocumentSettings(fs.readFileSync(fixture.path, 'utf8'))
  let styles = getRawDocumentTableStyles(saved.frontmatter) as Array<Record<string, unknown>>
  expect(styles.find((entry) => entry.tableIndex === 1)?.titleRow).toBe(true)
  let metadata = saved.frontmatter.metadata as Record<string, unknown>
  expect((metadata.tables as Array<Record<string, unknown>>)
    .find((entry) => entry.tableIndex === 1)?.columns).toEqual([140])

  await runRootTableAction(page, table.locator('tbody > tr').nth(1).locator('td'), 'Insert Column Right')
  await expect(title).toHaveAttribute('colspan', '2')
  await expectLogicalGeometry(page, table, 2)
  await expect(table).toHaveAttribute('data-rv-title-row-state', 'valid')
  await page.keyboard.press('ControlOrMeta+z')
  await expect.poll(() => title.evaluate((cell: HTMLTableCellElement) => cell.colSpan)).toBe(1)
  await page.keyboard.press('ControlOrMeta+Shift+z')
  await expect(title).toHaveAttribute('colspan', '2')
  await expectSelectionInside(table.locator('tbody > tr').nth(1).locator('td').first())

  const restoredWidthSaveCount = await readSaveCount(page)
  await page.keyboard.press('ControlOrMeta+s')
  await expect.poll(() => readSaveCount(page), { timeout: 15_000 })
    .toBeGreaterThan(restoredWidthSaveCount)
  saved = parseDocumentSettings(fs.readFileSync(fixture.path, 'utf8'))
  styles = getRawDocumentTableStyles(saved.frontmatter) as Array<Record<string, unknown>>
  expect(styles.find((entry) => entry.tableIndex === 1)?.titleRow).toBe(true)
  metadata = saved.frontmatter.metadata as Record<string, unknown>
  expect((metadata.tables as Array<Record<string, unknown>>)
    .find((entry) => entry.tableIndex === 1)?.columns).toEqual([140, 140])

  await page.getByTitle('Back', { exact: true }).click()
  const reopened = await openTitleRowDocument(page)
  const reopenedTable = reopened.locator('table.rv-office-table').nth(1)
  await expect(reopenedTable).toHaveAttribute('data-rv-title-row-state', 'valid')
  await expect(reopenedTable.locator('tbody > tr').first().locator('th')).toHaveAttribute('colspan', '2')
  await expectLogicalGeometry(page, reopenedTable, 2)
})

test('[slice 08.3] verified title rejects programmatic row insertion above before all effects', () => {
  for (const dataRowCount of [1, 2]) {
    const initialState = EditorState.create({
      schema: titleCoordinatorSchema,
      doc: titleCoordinatorSchema.node('doc', null, [titleCoordinatorTable(dataRowCount)]),
    })
    const root = {} as HTMLElement
    const metadata = {
      tables: [{ tableIndex: 0, columns: [100, 110, 120], fixtureSeed: 'keep-table' }],
      tableColors: [{ tableIndex: 0, rows: { 0: '#123456' }, fixtureSeed: 'keep-color' }],
      tableStyles: [{ tableIndex: 0, titleRow: true, fixtureSeed: 'keep-style' }],
    }
    const metadataBefore = structuredClone(metadata)
    let metadataPublicationEffects = 0
    let dirtyEffects = 0
    let saveEffects = 0
    const unregister = registerOfficeTableMetadataBindings(root, {
      readTables: () => structuredClone(metadata.tables),
      publishTables: () => { metadataPublicationEffects += 1 },
      readTableColors: () => structuredClone(metadata.tableColors),
      publishTableColors: () => { metadataPublicationEffects += 1 },
      readTableStyles: () => structuredClone(metadata.tableStyles),
      publishTableStyles: () => { metadataPublicationEffects += 1 },
      prepareDeferredSnapshot: () => true,
      cancelDeferredSnapshot: () => true,
      isCurrentSnapshot: () => true,
      publishSnapshot: () => {
        metadataPublicationEffects += 1
        dirtyEffects += 1
        saveEffects += 1
        return true
      },
    })
    const observed = globalThis as typeof globalThis & {
      __officeTableMetadataTestHook?: (event: string) => void
    }
    const priorHook = observed.__officeTableMetadataTestHook
    const metadataEvents: string[] = []
    observed.__officeTableMetadataTestHook = (event) => { metadataEvents.push(event) }

    let selectionCalls = 0
    let selectionCaptureDispatches = 0
    let commandCalls = 0
    let commandCaptureDispatches = 0
    let liveDispatches = 0
    const view = {
      state: initialState,
      dispatch(transaction: Transaction) {
        liveDispatches += 1
        this.state = this.state.applyTransaction(transaction).state
      },
    }
    const mutation = { axis: 'row', action: 'insert', index: 0 } as const
    const exactCommand = createOfficeTableMutationCommand(0, mutation)
    expect(exactCommand).toBeTruthy()
    try {
      const result = runStockOfficeTableMutation({
        root,
        view: view as never,
        commands: {} as never,
        tablePos: 0,
        mutation,
        selectionCommand: (state, captureDispatch) => {
          selectionCalls += 1
          captureDispatch?.(state.tr.setMeta('selection-capture', true))
          selectionCaptureDispatches += 1
          return true
        },
        mutationCommand: (state, captureDispatch) => {
          commandCalls += 1
          return exactCommand!(state, (transaction) => {
            commandCaptureDispatches += 1
            captureDispatch?.(transaction)
          })
        },
      })
      expect(result).toMatchObject({
        applied: false,
        reason: 'invalid-plan',
        before: { rows: dataRowCount + 2, columns: 3 },
        expected: { rows: dataRowCount + 3, columns: 3 },
      })
      expect(selectionCalls).toBe(0)
      expect(selectionCaptureDispatches).toBe(0)
      expect(commandCalls).toBe(0)
      expect(commandCaptureDispatches).toBe(0)
      expect(liveDispatches).toBe(0)
      expect(metadataEvents).toEqual([])
      expect(metadataPublicationEffects).toBe(0)
      expect(dirtyEffects).toBe(0)
      expect(saveEffects).toBe(0)
      expect(view.state.doc.eq(initialState.doc)).toBe(true)
      expect(metadata).toEqual(metadataBefore)
    } finally {
      if (priorHook) observed.__officeTableMetadataTestHook = priorHook
      else delete observed.__officeTableMetadataTestHook
      unregister()
    }
  }
})

test('[slice 08.3] generic row deletion cannot remove or underflow a verified title table', async ({ page }) => {
  const initialState = EditorState.create({
    schema: titleCoordinatorSchema,
    doc: titleCoordinatorSchema.node('doc', null, [titleCoordinatorTable()]),
  })
  let dispatches = 0
  let commandCalls = 0
  const view = {
    state: initialState,
    dispatch(transaction: Transaction) {
      dispatches += 1
      this.state = this.state.applyTransaction(transaction).state
    },
  }
  for (const index of [0, 1]) {
    const mutation = { axis: 'row', action: 'delete', index } as const
    const result = runStockOfficeTableMutation({
      root: {} as HTMLElement,
      view: view as never,
      commands: {} as never,
      tablePos: 0,
      mutation,
      mutationCommand: () => {
        commandCalls += 1
        return true
      },
    })
    expect(result).toMatchObject({
      applied: false,
      reason: 'invalid-plan',
      before: { rows: 3, columns: 3 },
      expected: { rows: 2, columns: 3 },
    })
  }
  expect(commandCalls).toBe(0)
  expect(dispatches).toBe(0)
  expect(view.state.doc.eq(initialState.doc)).toBe(true)
  const explicitTitleDelete = runStockOfficeTableMutation({
    root: {} as HTMLElement,
    view: view as never,
    commands: {} as never,
    tablePos: 0,
    mutation: { axis: 'row', action: 'delete', index: 0 },
    titleRowAction: 'delete',
    mutationCommand: () => {
      commandCalls += 1
      return true
    },
  })
  expect(explicitTitleDelete).toMatchObject({ applied: false, reason: 'transaction-count' })
  expect(commandCalls).toBe(1)
  expect(dispatches).toBe(0)
  const inconsistentTitleDelete = runStockOfficeTableMutation({
    root: {} as HTMLElement,
    view: view as never,
    commands: {} as never,
    tablePos: 0,
    mutation: { axis: 'row', action: 'delete', index: 1 },
    titleRowAction: 'delete',
    mutationCommand: () => {
      commandCalls += 1
      return true
    },
  })
  expect(inconsistentTitleDelete).toMatchObject({ applied: false, reason: 'invalid-plan' })
  expect(commandCalls).toBe(1)
  expect(dispatches).toBe(0)

  const fourRowState = EditorState.create({
    schema: titleCoordinatorSchema,
    doc: titleCoordinatorSchema.node('doc', null, [titleCoordinatorTable(2)]),
  })
  let selectionCalls = 0
  let captureDispatches = 0
  let fourRowCommandCalls = 0
  let fourRowLiveDispatches = 0
  const fourRowView = {
    state: fourRowState,
    dispatch(transaction: Transaction) {
      fourRowLiveDispatches += 1
      this.state = this.state.applyTransaction(transaction).state
    },
  }
  const fourRowInconsistentDelete = runStockOfficeTableMutation({
    root: {} as HTMLElement,
    view: fourRowView as never,
    commands: {} as never,
    tablePos: 0,
    mutation: { axis: 'row', action: 'delete', index: 1 },
    titleRowAction: 'delete',
    selectionCommand: (state, captureDispatch) => {
      selectionCalls += 1
      captureDispatch?.(state.tr.setMeta('selection-capture', true))
      captureDispatches += 1
      return true
    },
    mutationCommand: () => {
      fourRowCommandCalls += 1
      return true
    },
  })
  expect(fourRowInconsistentDelete).toMatchObject({ applied: false, reason: 'invalid-plan' })
  expect(selectionCalls).toBe(0)
  expect(captureDispatches).toBe(0)
  expect(fourRowCommandCalls).toBe(0)
  expect(fourRowLiveDispatches).toBe(0)
  expect(fourRowView.state.doc.eq(fourRowState.doc)).toBe(true)

  const fixture = await resetTitleRowFixture()
  await installSaveObservation(page)
  const editor = await openTitleRowDocument(page)
  const table = editor.locator('table.rv-office-table').nth(1)
  const title = table.locator('tbody > tr').first().locator('th')
  const rowOne = table.locator('tbody > tr').nth(1).locator('td').first()

  const rowOneContext = {
    rowIndex: 1,
    rowEndIndex: 2,
    colIndex: 0,
    colEndIndex: 1,
    rowCount: 3,
    colCount: 3,
    tablePos: 1,
    verifiedTitleTable: true,
    verifiedTitleContext: false,
  }
  const deleteAbove = getOfficeTableMutationForAction(rowOneContext, 'delete-row-above')
  const deleteBelow = getOfficeTableMutationForAction(rowOneContext, 'delete-row-below')
  expect(deleteAbove).toMatchObject({ axis: 'row', action: 'delete', index: 0 })
  expect(deleteBelow).toMatchObject({ axis: 'row', action: 'delete', index: 2 })
  expect(isOfficeTableMutationForbiddenForVerifiedTitle(rowOneContext, deleteAbove!)).toBe(true)
  expect(isOfficeTableMutationForbiddenForVerifiedTitle(rowOneContext, deleteBelow!)).toBe(true)

  await installMetadataEventObservation(page)
  let menu = await openCellContextMenu(page, rowOne)
  const deleteTitleAbove = menu.getByRole('menuitem', { name: 'Delete Row Above', exact: true })
  await expect(deleteTitleAbove).toBeDisabled()
  await expect(deleteTitleAbove).toHaveAttribute('aria-disabled', 'true')
  await deleteTitleAbove.evaluate((button: HTMLButtonElement) => button.click())
  await page.keyboard.press('Escape')

  menu = await openCellContextMenu(page, title)
  const underflowFromTitle = menu.getByRole('menuitem', { name: 'Delete Row Below', exact: true })
  await expect(underflowFromTitle).toBeDisabled()
  await expect(underflowFromTitle).toHaveAttribute('aria-disabled', 'true')
  await underflowFromTitle.evaluate((button: HTMLButtonElement) => button.click())
  await page.keyboard.press('Escape')

  menu = await openCellContextMenu(page, rowOne)
  const underflowFromData = menu.getByRole('menuitem', { name: 'Delete Row Below', exact: true })
  await expect(underflowFromData).toBeDisabled()
  await underflowFromData.evaluate((button: HTMLButtonElement) => button.click())
  await page.keyboard.press('Escape')

  await expect(table.locator('tbody > tr')).toHaveCount(3)
  await expect(title).toHaveText('Quarterly Results')
  await expect(table).toHaveAttribute('data-rv-title-row-state', 'valid')
  await expect.poll(() => readMetadataEvents(page)).toEqual([])
  await page.waitForTimeout(650)
  expect(await readSaveCount(page)).toBe(0)
  let saved = parseDocumentSettings(fs.readFileSync(fixture.path, 'utf8'))
  expect((getRawDocumentTableStyles(saved.frontmatter) as Array<Record<string, unknown>>)
    .find((entry) => entry.tableIndex === 1)?.titleRow).toBe(true)

  await page.getByTitle('Back', { exact: true }).click()
  await resetTitleRowFixture()
  fs.writeFileSync(fixture.path, fs.readFileSync(fixture.path, 'utf8').replace(
    '| Alpha | 10 | 20 |\n\n| one-column-h0 |',
    '| Alpha | 10 | 20 |\n| Beta | 30 | 40 |\n\n| one-column-h0 |',
  ))
  const reopened = await openTitleRowDocument(page)
  const fourRowTable = reopened.locator('table.rv-office-table').nth(1)
  await runRootTableAction(
    page,
    fourRowTable.locator('tbody > tr').nth(1).locator('td').first(),
    'Delete Row Below',
  )
  await expect(fourRowTable.locator('tbody > tr')).toHaveCount(3)
  await expect(fourRowTable.locator('tbody > tr').nth(2).locator('td')).toHaveText([
    'Beta', '30', '40',
  ])
  await expect(fourRowTable).toHaveAttribute('data-rv-title-row-state', 'valid')
  await expect.poll(() => readSaveCount(page), { timeout: 15_000 }).toBeGreaterThanOrEqual(1)
  saved = parseDocumentSettings(fs.readFileSync(fixture.path, 'utf8'))
  expect((getRawDocumentTableStyles(saved.frontmatter) as Array<Record<string, unknown>>)
    .find((entry) => entry.tableIndex === 1)?.titleRow).toBe(true)
})

test('[slice 08.3] stale row and column structure clear quarantine in the composite event with exact history', async ({ page }) => {
  const fixture = await resetTitleRowFixture()
  await installSaveObservation(page)
  let editor = await openTitleRowDocument(page)
  let stale = editor.locator('table.rv-office-table').nth(3)

  await installMetadataEventObservation(page)
  await runRootTableAction(page, stale.locator('tbody > tr').first().locator('th').nth(1), 'Insert Row Below')
  await expect(stale.locator('tbody > tr')).toHaveCount(3)
  await expect(stale).not.toHaveAttribute('data-rv-title-row-state', /.+/)
  await expect.poll(() => readMetadataEvents(page)).toEqual([
    'step', 'plugin-publish', 'external-publish',
  ])
  await page.keyboard.press('ControlOrMeta+z')
  await expect(stale.locator('tbody > tr')).toHaveCount(2)
  await expect(stale).toHaveAttribute('data-rv-title-row-state', 'stale')
  await expect(stale).toHaveAttribute('data-rv-title-row-diagnostic', 'continuation-content')
  await page.keyboard.press('ControlOrMeta+Shift+z')
  await expect(stale.locator('tbody > tr')).toHaveCount(3)
  await expect(stale).not.toHaveAttribute('data-rv-title-row-state', /.+/)
  await expect.poll(() => readSaveCount(page), { timeout: 15_000 }).toBeGreaterThanOrEqual(1)
  let saved = parseDocumentSettings(fs.readFileSync(fixture.path, 'utf8'))
  let style = (getRawDocumentTableStyles(saved.frontmatter) as Array<Record<string, unknown>>)
    .find((entry) => entry.tableIndex === 3)
  expect(style).toMatchObject({ tableOverflow: 'truncate', fixtureSeed: 'keep-title-stale' })
  expect(style).not.toHaveProperty('titleRow')

  await page.getByTitle('Back', { exact: true }).click()
  editor = await openTitleRowDocument(page)
  stale = editor.locator('table.rv-office-table').nth(3)
  await expect(stale.locator('tbody > tr')).toHaveCount(3)
  await expect(stale).not.toHaveAttribute('data-rv-title-row-state', /.+/)
  await expect(stale).not.toHaveAttribute('data-rv-title-row-diagnostic', /.+/)

  await page.getByTitle('Back', { exact: true }).click()
  await resetTitleRowFixture()
  editor = await openTitleRowDocument(page)
  stale = editor.locator('table.rv-office-table').nth(4)
  await installMetadataEventObservation(page)
  await runRootTableAction(page, stale.locator('tbody > tr').first().locator('th').nth(1), 'Insert Column Right')
  await expect(stale.locator('colgroup > col')).toHaveCount(4)
  await expect(stale).not.toHaveAttribute('data-rv-title-row-state', /.+/)
  await expect.poll(() => readMetadataEvents(page)).toEqual([
    'step', 'plugin-publish', 'external-publish',
  ])
  await page.keyboard.press('ControlOrMeta+z')
  await expect(stale.locator('colgroup > col')).toHaveCount(3)
  await expect(stale).toHaveAttribute('data-rv-title-row-state', 'stale')
  await expect(stale).toHaveAttribute('data-rv-title-row-diagnostic', 'too-few-physical-rows')
  await page.keyboard.press('ControlOrMeta+Shift+z')
  await expect(stale.locator('colgroup > col')).toHaveCount(4)
  await expect(stale).not.toHaveAttribute('data-rv-title-row-state', /.+/)
  await expect.poll(() => readSaveCount(page), { timeout: 15_000 }).toBeGreaterThanOrEqual(1)
  saved = parseDocumentSettings(fs.readFileSync(fixture.path, 'utf8'))
  style = (getRawDocumentTableStyles(saved.frontmatter) as Array<Record<string, unknown>>)
    .find((entry) => entry.tableIndex === 4)
  expect(style).toEqual(expect.objectContaining({
    tableOverflow: 'overflow',
    fixtureSeed: 'keep-title-two-row-stale',
  }))
  expect(style).not.toHaveProperty('titleRow')

  await page.getByTitle('Back', { exact: true }).click()
  await resetTitleRowFixture()
  editor = await openTitleRowDocument(page)
  stale = editor.locator('table.rv-office-table').nth(4)
  await runRootTableAction(page, stale.locator('tbody > tr').first().locator('th').nth(1), 'Delete Column Right')
  await expect(stale.locator('colgroup > col')).toHaveCount(2)
  await expect(stale).not.toHaveAttribute('data-rv-title-row-state', /.+/)
  await page.keyboard.press('ControlOrMeta+z')
  await expect(stale.locator('colgroup > col')).toHaveCount(3)
  await expect(stale).toHaveAttribute('data-rv-title-row-state', 'stale')
  await page.keyboard.press('ControlOrMeta+Shift+z')
  await expect(stale.locator('colgroup > col')).toHaveCount(2)
  await expect(stale).not.toHaveAttribute('data-rv-title-row-state', /.+/)

  await page.getByTitle('Back', { exact: true }).click()
  await resetTitleRowFixture()
  fs.writeFileSync(fixture.path, fs.readFileSync(fixture.path, 'utf8').replace(
    '| stale-r1c0 | stale-r1c1 | stale-r1c2 |\n\n| Two Row Marked Title',
    '| stale-r1c0 | stale-r1c1 | stale-r1c2 |\n| stale-r2c0 | stale-r2c1 | stale-r2c2 |\n\n| Two Row Marked Title',
  ))
  editor = await openTitleRowDocument(page)
  stale = editor.locator('table.rv-office-table').nth(3)
  await runRootTableAction(page, stale.locator('tbody > tr').first().locator('th').first(), 'Delete Row Below')
  await expect(stale.locator('tbody > tr')).toHaveCount(2)
  await expect(stale.locator('tbody > tr').nth(1).locator('td')).toHaveText([
    'stale-r2c0', 'stale-r2c1', 'stale-r2c2',
  ])
  await expect(stale).not.toHaveAttribute('data-rv-title-row-state', /.+/)
  await page.keyboard.press('ControlOrMeta+z')
  await expect(stale.locator('tbody > tr')).toHaveCount(3)
  await expect(stale).toHaveAttribute('data-rv-title-row-state', 'stale')
  await page.keyboard.press('ControlOrMeta+Shift+z')
  await expect(stale.locator('tbody > tr')).toHaveCount(2)
  await expect(stale).not.toHaveAttribute('data-rv-title-row-state', /.+/)
})

test('[slice 08.3] stale generic row-zero insertion and deletion are conventional, guarded, and history exact', async ({ page }) => {
  const fixture = await resetTitleRowFixture()
  await installSaveObservation(page)
  let editor = await openTitleRowDocument(page)
  let stale = editor.locator('table.rv-office-table').nth(3)

  await runRootTableAction(page, stale.locator('tbody > tr').first().locator('th').first(), 'Insert Row Above')
  await expect(stale.locator('tbody > tr')).toHaveCount(3)
  await expect(stale.locator('tbody > tr').first().locator('th')).toHaveText(['', '', ''])
  await expect(stale.locator('tbody > tr').nth(1).locator('td')).toHaveText([
    'Stale Title', 'KEEP ME', '',
  ])
  await expect(stale).not.toHaveAttribute('data-rv-title-row-state', /.+/)
  await page.keyboard.press('ControlOrMeta+z')
  await expect(stale.locator('tbody > tr')).toHaveCount(2)
  await expect(stale).toHaveAttribute('data-rv-title-row-state', 'stale')

  await page.getByTitle('Back', { exact: true }).click()
  await resetTitleRowFixture()
  const seeded = fs.readFileSync(fixture.path, 'utf8').replace(
    '| stale-r1c0 | stale-r1c1 | stale-r1c2 |\n\n| Two Row Marked Title',
    '| stale-r1c0 | stale-r1c1 | stale-r1c2 |\n| stale-r2c0 | stale-r2c1 | stale-r2c2 |\n\n| Two Row Marked Title',
  )
  fs.writeFileSync(fixture.path, seeded)
  editor = await openTitleRowDocument(page)
  stale = editor.locator('table.rv-office-table').nth(3)
  await expect(stale.locator('tbody > tr')).toHaveCount(3)
  await expect(stale).toHaveAttribute('data-rv-title-row-state', 'stale')
  await runRootTableAction(page, stale.locator('tbody > tr').nth(1).locator('td').first(), 'Delete Row Above')
  await expect(stale.locator('tbody > tr')).toHaveCount(2)
  await expect(stale.locator('tbody > tr').first().locator('th')).toHaveText([
    'stale-r1c0', 'stale-r1c1', 'stale-r1c2',
  ])
  await expect(stale.locator('tbody > tr').nth(1).locator('td')).toHaveText([
    'stale-r2c0', 'stale-r2c1', 'stale-r2c2',
  ])
  await expect(stale).not.toHaveAttribute('data-rv-title-row-state', /.+/)
  await page.keyboard.press('ControlOrMeta+z')
  await expect(stale.locator('tbody > tr').first().locator('th')).toHaveText([
    'Stale Title', 'KEEP ME', '',
  ])
  await expect(stale).toHaveAttribute('data-rv-title-row-state', 'stale')
  await page.keyboard.press('ControlOrMeta+Shift+z')
  await expect(stale.locator('tbody > tr').first().locator('th')).toHaveText([
    'stale-r1c0', 'stale-r1c1', 'stale-r1c2',
  ])
})

test('[slice 08.3] row-zero content cleanup is pre-applied with one metadata Step and survives reopen', async ({ page }) => {
  const fixture = await resetTitleRowFixture()
  await installSaveObservation(page)
  const editor = await openTitleRowDocument(page)
  const stale = editor.locator('table.rv-office-table').nth(3)
  const continuation = stale.locator('tbody > tr').first().locator('th').nth(1)
  await installMetadataEventObservation(page)

  await continuation.selectText()
  await page.keyboard.press('Backspace')
  await expect(continuation).toHaveText('')
  await expect(stale).not.toHaveAttribute('data-rv-title-row-state', /.+/)
  await expect(stale).not.toHaveAttribute('data-rv-title-row-diagnostic', /.+/)
  await expectSelectionInside(continuation)
  await expect.poll(() => readMetadataEvents(page)).toEqual([
    'quarantine-preflight', 'step', 'plugin-publish', 'external-publish',
  ])

  await page.keyboard.press('ControlOrMeta+z')
  await expect(continuation).toHaveText('KEEP ME')
  await expect(stale).toHaveAttribute('data-rv-title-row-state', 'stale')
  await expect(stale).toHaveAttribute('data-rv-title-row-diagnostic', 'continuation-content')
  await expectSelectionInside(continuation)
  await page.keyboard.press('ControlOrMeta+Shift+z')
  await expect(continuation).toHaveText('')
  await expect(stale).not.toHaveAttribute('data-rv-title-row-state', /.+/)
  await expectSelectionInside(continuation)

  await expect.poll(() => readSaveCount(page), { timeout: 15_000 }).toBeGreaterThanOrEqual(1)
  const saved = parseDocumentSettings(fs.readFileSync(fixture.path, 'utf8'))
  const style = (getRawDocumentTableStyles(saved.frontmatter) as Array<Record<string, unknown>>)
    .find((entry) => entry.tableIndex === 3)
  expect(style).toMatchObject({ tableOverflow: 'truncate', fixtureSeed: 'keep-title-stale' })
  expect(style).not.toHaveProperty('titleRow')

  await page.getByTitle('Back', { exact: true }).click()
  const reopened = await openTitleRowDocument(page)
  const reopenedStale = reopened.locator('table.rv-office-table').nth(3)
  await expect(reopenedStale).not.toHaveAttribute('data-rv-title-row-state', /.+/)
  await expect(reopenedStale.locator('tbody > tr').first().locator('th')).toHaveText([
    'Stale Title', '', '',
  ])
})

test('[slice 08.3] initialization span normalization preserves stale quarantine without history or save', async ({ page }) => {
  const fixture = await resetTitleRowFixture()
  const seeded = fs.readFileSync(fixture.path, 'utf8').replace(
    '| Stale Title | KEEP ME |  |',
    '| <span style="font-size: 1.2em">Stale Title</span> | KEEP ME |  |',
  )
  fs.writeFileSync(fixture.path, seeded)
  await installSaveObservation(page)
  await installMetadataInitObservation(page)

  const editor = await openTitleRowDocument(page)
  const stale = editor.locator('table.rv-office-table').nth(3)
  const styledTitle = stale.locator('tbody > tr').first().locator('th').first()
    .locator('span[style*="font-size"]')
  await expect(styledTitle).toHaveText('Stale Title')
  await expect(stale).toHaveAttribute('data-rv-title-row-state', 'stale')
  await expect(stale).toHaveAttribute('data-rv-title-row-diagnostic', 'continuation-content')
  await expect(page.locator('.rv-office-document-dirty')).toHaveCount(0)
  await expect.poll(() => readMetadataEvents(page)).toEqual([])

  await page.keyboard.press('ControlOrMeta+z')
  await expect(styledTitle).toHaveText('Stale Title')
  await expect(stale).toHaveAttribute('data-rv-title-row-state', 'stale')
  await page.waitForTimeout(650)
  expect(await readSaveCount(page)).toBe(0)
  expect(fs.readFileSync(fixture.path, 'utf8')).toBe(seeded)
  const saved = parseDocumentSettings(fs.readFileSync(fixture.path, 'utf8'))
  expect((getRawDocumentTableStyles(saved.frontmatter) as Array<Record<string, unknown>>)
    .find((entry) => entry.tableIndex === 3)?.titleRow).toBe(true)
})

test('[slice 08.3] outside-row-zero text and presentation preserve quarantine while explicit Add replaces it', async ({ page }) => {
  const fixture = await resetTitleRowFixture()
  await installSaveObservation(page)
  const editor = await openTitleRowDocument(page)
  const stale = editor.locator('table.rv-office-table').nth(3)
  const dataCell = stale.locator('tbody > tr').nth(1).locator('td').first()

  await dataCell.click()
  await page.keyboard.press('End')
  await page.keyboard.type(' outside')
  await expect(dataCell).toHaveText('stale-r1c0 outside')
  await expect(stale).toHaveAttribute('data-rv-title-row-state', 'stale')
  await expect(stale).toHaveAttribute('data-rv-title-row-diagnostic', 'continuation-content')

  await openCellContextMenu(page, dataCell)
  await openTableSubmenu(page)
  const overflow = page.getByRole('menu', { name: 'Table', exact: true })
    .getByRole('menuitem', { name: /Overflow: current mode Truncate/ })
  await overflow.hover()
  await page.getByRole('menu', { name: 'Overflow', exact: true })
    .getByRole('menuitemradio', { name: 'New line', exact: true }).click()
  await expect(stale).toHaveAttribute('data-rv-title-row-state', 'stale')
  await expect(stale).toHaveAttribute('data-rv-title-row-diagnostic', 'continuation-content')
  await expect.poll(() => readSaveCount(page), { timeout: 15_000 }).toBeGreaterThanOrEqual(1)
  let saved = parseDocumentSettings(fs.readFileSync(fixture.path, 'utf8'))
  let style = (getRawDocumentTableStyles(saved.frontmatter) as Array<Record<string, unknown>>)
    .find((entry) => entry.tableIndex === 3)
  expect(style?.titleRow).toBe(true)

  await openCellContextMenu(page, stale.locator('tbody > tr').first().locator('th').nth(1))
  const tableMenu = await openTableSubmenu(page)
  await tableMenu.getByRole('menuitem', { name: 'Add title row', exact: true }).click()
  const title = stale.locator('tbody > tr').first().locator('th')
  await expect(title).toHaveCount(1)
  await expect(title).toHaveAttribute('colspan', '3')
  await expect(stale.locator('tbody > tr').nth(1).locator('td')).toHaveText([
    'Stale Title', 'KEEP ME', '',
  ])
  await expect(stale).toHaveAttribute('data-rv-title-row-state', 'valid')
  await page.keyboard.press('ControlOrMeta+z')
  await expect(stale).toHaveAttribute('data-rv-title-row-state', 'stale')
  await expect(stale.locator('tbody > tr').first().locator('th')).toHaveText([
    'Stale Title', 'KEEP ME', '',
  ])
  await page.keyboard.press('ControlOrMeta+Shift+z')
  await expect(stale).toHaveAttribute('data-rv-title-row-state', 'valid')
  await expect.poll(() => readSaveCount(page), { timeout: 15_000 }).toBeGreaterThanOrEqual(1)
  saved = parseDocumentSettings(fs.readFileSync(fixture.path, 'utf8'))
  style = (getRawDocumentTableStyles(saved.frontmatter) as Array<Record<string, unknown>>)
    .find((entry) => entry.tableIndex === 3)
  expect(style).toMatchObject({
    titleRow: true,
    tableOverflow: 'newline',
    fixtureSeed: 'keep-title-stale',
  })
})

test('[slice 08.4] cumulative title edits save and reopen every canonical table without cross-domain loss', async ({ page }) => {
  const fixture = await resetTitleRowFixture()
  await installSaveObservation(page)
  let editor = await openTitleRowDocument(page)
  let tables = editor.locator('table.rv-office-table')
  await expect(tables).toHaveCount(5)

  const ordinary = tables.nth(0)
  await openCellContextMenu(page, ordinary.locator('tbody > tr').first().locator('th').nth(1))
  const ordinaryTableMenu = await openTableSubmenu(page)
  await ordinaryTableMenu.getByRole('menuitem', { name: 'Add title row', exact: true }).click()
  const addedTitle = ordinary.locator('tbody > tr').first().locator('th')
  await page.keyboard.type('Cumulative title')
  await expect(addedTitle).toHaveText('Cumulative title')
  await page.keyboard.press('ControlOrMeta+z')
  await expect(addedTitle).toHaveText('')
  await page.keyboard.press('ControlOrMeta+Shift+z')
  await expect(addedTitle).toHaveText('Cumulative title')

  const seededTitle = tables.nth(1).locator('tbody > tr').first().locator('th')
  await seededTitle.click()
  await page.keyboard.press('End')
  await page.keyboard.type(' FY26')
  await expect(seededTitle).toHaveText('Quarterly Results FY26')
  await page.keyboard.press('ControlOrMeta+z')
  await expect(seededTitle).toHaveText('Quarterly Results')
  await page.keyboard.press('ControlOrMeta+Shift+z')
  await expect(seededTitle).toHaveText('Quarterly Results FY26')

  const oneColumn = tables.nth(2)
  await openCellContextMenu(page, oneColumn.locator('tbody > tr').first().locator('th'))
  const oneColumnTableMenu = await openTableSubmenu(page)
  const disabledAdd = oneColumnTableMenu.getByRole('menuitem', {
    name: 'Add title row',
    exact: true,
  })
  await expect(disabledAdd).toBeDisabled()
  await disabledAdd.evaluate((button: HTMLButtonElement) => button.click())
  await page.keyboard.press('Escape')
  await expect(oneColumn.locator('tbody > tr').first().locator('th')).toHaveText('one-column-h0')

  const staleContinuation = tables.nth(3)
  const staleData = staleContinuation.locator('tbody > tr').nth(1).locator('td').first()
  await staleData.click()
  await page.keyboard.press('End')
  await page.keyboard.type(' outside')
  await expect(staleContinuation).toHaveAttribute('data-rv-title-row-state', 'stale')
  await expect(staleContinuation).toHaveAttribute(
    'data-rv-title-row-diagnostic',
    'continuation-content',
  )
  await expect(tables.nth(4)).toHaveAttribute('data-rv-title-row-state', 'stale')
  await expect(tables.nth(4)).toHaveAttribute(
    'data-rv-title-row-diagnostic',
    'too-few-physical-rows',
  )

  const saveCountBeforeManual = await readSaveCount(page)
  await page.keyboard.press('ControlOrMeta+s')
  await expect.poll(() => readSaveCount(page), { timeout: 15_000 })
    .toBeGreaterThan(saveCountBeforeManual)
  const persisted = fs.readFileSync(fixture.path)
  const saved = parseDocumentSettings(persisted.toString())
  expect(saved.body).not.toMatch(/<table\b/i)
  expect(saved.body).toMatch(/\| Cumulative title\s+\|\s+\|\s+\|/)
  expect(saved.body).toMatch(/\| ordinary-h0\s+\| ordinary-h1\s+\| ordinary-h2\s+\|/)
  expect(saved.body).toMatch(/\| Quarterly Results FY26\s+\|\s+\|\s+\|/)
  expect(saved.body).toMatch(/\|\s*:-+\s*\|\s*-+:\s*\|\s*:-+:\s*\|/)
  expect(saved.body).toMatch(/\| Stale Title\s*\| KEEP ME\s*\|\s*\|/)
  expect(saved.body).toMatch(/\| stale-r1c0 outside\s*\| stale-r1c1\s*\| stale-r1c2\s*\|/)
  expect(saved.body).toMatch(/\| Two Row Marked Title\s*\|\s*\|\s*\|/)

  const metadata = saved.frontmatter.metadata as Record<string, unknown>
  expect(metadata.preserveUnknown).toBe('keep-me')
  expect(metadata.tables).toEqual(expect.arrayContaining([
    expect.objectContaining({ tableIndex: 0, columns: [90, 110, 130] }),
    expect.objectContaining({ tableIndex: 1, columns: [100, 120, 140] }),
    expect.objectContaining({ tableIndex: 4, columns: [95, 115, 135] }),
  ]))
  expect(metadata.tableColors).toEqual(expect.arrayContaining([
    expect.objectContaining({ tableIndex: 0, cells: { '1,0': '#d6ebff' } }),
    expect.objectContaining({
      tableIndex: 1,
      cells: { '0,0': '#ffeeaa' },
      columns: { '1': { color: '#d6ffd6', rank: 3 } },
    }),
  ]))
  const styles = getRawDocumentTableStyles(saved.frontmatter) as Array<Record<string, unknown>>
  expect(styles).toEqual(expect.arrayContaining([
    expect.objectContaining({ tableIndex: 0, titleRow: true }),
    expect.objectContaining({
      tableIndex: 1,
      titleRow: true,
      tableOverflow: 'newline',
      fixtureSeed: 'keep-title-valid',
    }),
    expect.objectContaining({
      tableIndex: 3,
      titleRow: true,
      tableOverflow: 'truncate',
      fixtureSeed: 'keep-title-stale',
    }),
    expect.objectContaining({
      tableIndex: 4,
      titleRow: true,
      tableOverflow: 'overflow',
      fixtureSeed: 'keep-title-two-row-stale',
    }),
  ]))

  await page.getByTitle('Back', { exact: true }).click()
  editor = await openTitleRowDocument(page)
  tables = editor.locator('table.rv-office-table')
  await expect(tables).toHaveCount(5)
  await expect(tables.nth(0)).toHaveAttribute('data-rv-title-row-state', 'valid')
  await expect(tables.nth(0).locator('tbody > tr').first().locator('th'))
    .toHaveText('Cumulative title')
  await expect(tables.nth(1)).toHaveAttribute('data-rv-title-row-state', 'valid')
  await expect(tables.nth(1).locator('tbody > tr').first().locator('th'))
    .toHaveText('Quarterly Results FY26')
  await expect(tables.nth(2).locator('tbody > tr').first().locator('th'))
    .toHaveText('one-column-h0')
  await expect(tables.nth(3)).toHaveAttribute('data-rv-title-row-state', 'stale')
  await expect(tables.nth(3)).toHaveAttribute(
    'data-rv-title-row-diagnostic',
    'continuation-content',
  )
  await expect(tables.nth(3).locator('tbody > tr').first().locator('th')).toHaveText([
    'Stale Title', 'KEEP ME', '',
  ])
  await expect(tables.nth(3).locator('tbody > tr').nth(1).locator('td').first())
    .toHaveText('stale-r1c0 outside')
  await expect(tables.nth(4)).toHaveAttribute('data-rv-title-row-state', 'stale')
  await expect(tables.nth(4)).toHaveAttribute(
    'data-rv-title-row-diagnostic',
    'too-few-physical-rows',
  )
  await expect(tables.nth(4).locator('tbody > tr').first().locator('th')).toHaveText([
    'Two Row Marked Title', '', '',
  ])

  await expectLogicalGeometry(page, tables.nth(0), 3)
  await expectLogicalGeometry(page, tables.nth(1), 3)
  await expect.poll(() => tables.nth(1).locator('tbody > tr').first().locator('th').evaluate(
    (cell) => getComputedStyle(cell).backgroundColor,
  )).toBe('rgb(255, 238, 170)')
  const forbiddenEditableWrites = await tables.locator('tbody > tr, tbody > tr > th, tbody > tr > td')
    .evaluateAll((elements) => elements.flatMap((element) => {
      const htmlElement = element as HTMLElement
      const dataAttributes = Array.from(element.attributes)
        .filter(({ name }) => name.startsWith('data-rv-'))
        .map(({ name }) => name)
      const forbiddenStyles = ['background-color', 'width', 'height', 'min-height', 'max-height']
        .filter((name) => htmlElement.style.getPropertyValue(name) !== '')
      return dataAttributes.length || forbiddenStyles.length
        ? [{ tag: element.tagName, dataAttributes, forbiddenStyles }]
        : []
    }))
  expect(forbiddenEditableWrites).toEqual([])

  await page.waitForTimeout(800)
  expect(await readSaveCount(page)).toBe(0)
  await expect(page.locator('.rv-office-document-dirty')).toHaveCount(0)
  expect(fs.readFileSync(fixture.path)).toEqual(persisted)
})
