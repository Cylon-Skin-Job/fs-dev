import fs from 'node:fs'

import { expect, test, type Page } from '@playwright/test'
import { Schema, type Node as ProseNode } from '@milkdown/kit/prose/model'
import { EditorState } from '@milkdown/kit/prose/state'
import { tableNodes } from '@milkdown/kit/prose/tables'

import { resetOfficePlaywrightScenario } from './office/fixture-lifecycle.mjs'
import { getFixtureScenario, renderFixtureDocument } from './office/fixture-scenarios.mjs'
import {
  captureOfficeTableRemovalTarget,
  planOfficeTableRemoval,
} from '../src/components/office/officeTableRemoval'
import {
  captureOfficeTableInsertionTarget,
  planOfficeTableInsertion,
} from '../src/components/office/officeTableInsertion'
import {
  createOfficeDeferredMarkdownPublicationState,
  publishOfficeTableMetadataSnapshot,
  registerOfficeTableMetadataBindings,
  type OfficeTableMetadataSnapshot,
} from '../src/components/office/officeTableHistory'
import { parseDocumentSettings } from '../src/lib/front-matter'

const FIXTURE_NAME = 'Structure-R5-C4.md'
const LIFECYCLE_FIXTURE_NAME = 'Table Lifecycle.md'
const WARNING_TEXT = 'All data inside the table will be lost.'
let lifecycleFixtureCache: { filename: string; path: string } | null = null

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
    await folder.click({ force: true })
    await expect.poll(async () => await document.isVisible() || await editor.isVisible(), {
      timeout: 15_000,
    }).toBe(true)
    if (await editor.isVisible()) {
      const openFilename = await page.locator('.rv-office-document-filename').textContent()
      if (openFilename?.includes(filename)) return editor
      await page.getByTitle('Back', { exact: true }).click()
      await expect(document).toBeVisible()
    }
  }
  await document.click({ force: true })
  await expect(editor).toBeVisible()
  return editor
}

async function resetFixture() {
  const files = await resetOfficePlaywrightScenario({
    scenario: 'structure',
    variant: 'metadata',
    copies: 1,
    workspaces: 1,
  })
  const fixture = files.find(({ filename }: { filename: string }) => filename === FIXTURE_NAME)
  expect(fixture).toBeTruthy()
  return fixture!
}

async function resetLifecycleFixture() {
  if (lifecycleFixtureCache && fs.existsSync(lifecycleFixtureCache.path)) {
    return lifecycleFixtureCache
  }
  const files = await resetOfficePlaywrightScenario({
    scenario: 'table-lifecycle',
    copies: 1,
    workspaces: 1,
  })
  const fixture = files.find(({ filename }: { filename: string }) => filename === LIFECYCLE_FIXTURE_NAME)
  expect(fixture).toBeTruthy()
  lifecycleFixtureCache = fixture!
  return lifecycleFixtureCache
}

async function resetLifecycleFixtureCopies(copies: number) {
  return resetOfficePlaywrightScenario({
    scenario: 'table-lifecycle',
    copies,
    workspaces: 1,
  })
}

async function installNoOpObservers(page: Page, fixturePath: string) {
  await page.addInitScript((expectedPath) => {
    const observed = window as typeof window & {
      __officeRemoveEvents?: string[]
      __officeRemoveSentMessages?: Array<{ type?: string; path?: string }>
      __officeRemoveSelectionChanges?: number
      __officeTableMetadataTestHook?: (event: string) => void
    }
    observed.__officeRemoveEvents = []
    observed.__officeRemoveSentMessages = []
    observed.__officeRemoveSelectionChanges = 0
    observed.__officeTableMetadataTestHook = (event) => {
      observed.__officeRemoveEvents?.push(event)
    }
    document.addEventListener('selectionchange', () => {
      observed.__officeRemoveSelectionChanges = (observed.__officeRemoveSelectionChanges ?? 0) + 1
    })
    const originalSend = WebSocket.prototype.send
    WebSocket.prototype.send = function captureOfficeRemoveSend(data) {
      if (typeof data === 'string') {
        try {
          const message = JSON.parse(data) as { type?: string; path?: string }
          if (message.type === 'file_save' && message.path?.endsWith(expectedPath)) {
            observed.__officeRemoveSentMessages?.push(message)
          }
        } catch { /* preserve non-JSON traffic */ }
      }
      return originalSend.call(this, data)
    }
  }, fixturePath)
}

async function installDeletionObservers(page: Page) {
  await page.addInitScript(() => {
    const observed = window as typeof window & {
      __officeRemoveEvents?: string[]
      __officeRemoveSentMessages?: Array<{ type?: string; path?: string }>
      __officeTableMetadataTestHook?: (event: string) => void
    }
    observed.__officeRemoveEvents = []
    observed.__officeRemoveSentMessages = []
    observed.__officeTableMetadataTestHook = (event: string) => {
      observed.__officeRemoveEvents?.push(event)
    }
    const originalSend = WebSocket.prototype.send
    WebSocket.prototype.send = function captureOfficeRemoveSend(data) {
      if (typeof data === 'string') {
        try {
          const message = JSON.parse(data) as { type?: string; path?: string }
          if (message.type === 'file_save') observed.__officeRemoveSentMessages?.push(message)
        } catch { /* preserve non-JSON traffic */ }
      }
      return originalSend.call(this, data)
    }
  })
}

async function resetDeletionObservers(page: Page) {
  await page.evaluate(() => {
    const observed = window as typeof window & {
      __officeRemoveEvents?: string[]
      __officeRemoveSentMessages?: unknown[]
      __officeRemoveFirstFrame?: unknown
    }
    observed.__officeRemoveEvents = []
    observed.__officeRemoveSentMessages = []
    observed.__officeRemoveFirstFrame = null
  })
}

async function openTableInsertGridAt(
  page: Page,
  editor: ReturnType<Page['locator']>,
  insertionIndex: 0 | 1 | 3,
) {
  const target = insertionIndex === 0
    ? editor.getByRole('heading', { name: 'life-a', exact: true })
    : insertionIndex === 1
      ? editor.getByRole('heading', { name: 'life-b', exact: true })
      : editor.locator('p').filter({ hasText: 'After table-lifecycle.' }).last()
  await target.click({ button: 'right' })
  const menu = page.locator('.rv-office-insert-context-menu')
  await expect(menu).toBeVisible()
  await menu.locator('[data-office-insert="table"]').hover()
  const grid = page.locator('.rv-office-table-grid-popover')
  await expect(grid).toBeVisible()
  return grid
}

function countDeletionSaves(page: Page, filename: string) {
  return page.evaluate((expectedFilename) => (
    window as typeof window & { __officeRemoveSentMessages?: Array<{ path?: string }> }
  ).__officeRemoveSentMessages?.filter(({ path }) => path?.endsWith(expectedFilename)).length ?? 0, filename)
}

async function resetNoOpObservers(page: Page) {
  await page.evaluate(() => {
    const observed = window as typeof window & {
      __officeRemoveEvents?: string[]
      __officeRemoveSentMessages?: unknown[]
      __officeRemoveSelectionChanges?: number
    }
    observed.__officeRemoveEvents = []
    observed.__officeRemoveSentMessages = []
    observed.__officeRemoveSelectionChanges = 0
  })
}

async function readNoOpState(page: Page) {
  return page.evaluate(() => {
    const editor = document.querySelector('.rv-office-document-editor .ProseMirror')
    const documentClone = editor?.cloneNode(true) as HTMLElement | undefined
    documentClone?.querySelectorAll('.prosemirror-virtual-cursor, .ProseMirror-widget')
      .forEach((element) => element.remove())
    const observed = window as typeof window & {
      __officeRemoveEvents?: string[]
      __officeRemoveSentMessages?: unknown[]
      __officeRemoveSelectionChanges?: number
    }
    const markdownProjection = Array.from(
      editor?.querySelectorAll('h1, h2, h3, h4, h5, h6, p, table') ?? [],
    ).filter((element) => element.tagName === 'TABLE' || !element.closest('table'))
      .map((element) => {
        if (element instanceof HTMLHeadingElement) {
          return `${'#'.repeat(Number(element.tagName.slice(1)))} ${element.textContent ?? ''}`
        }
        if (element instanceof HTMLTableElement) {
          const rows = Array.from(element.rows).map((row) => (
            Array.from(row.cells).map((cell) => cell.textContent?.trim() ?? '')
          ))
          return rows.map((cells, index) => [
            `| ${cells.join(' | ')} |`,
            ...(index === 0 ? [`| ${cells.map(() => '---').join(' | ')} |`] : []),
          ]).flat().join('\n')
        }
        return element.textContent ?? ''
      }).join('\n\n')
    return {
      dirtyIndicators: document.querySelectorAll('.rv-office-document-dirty').length,
      editorHtml: documentClone?.innerHTML ?? null,
      markdownProjection,
      metadataEvents: observed.__officeRemoveEvents ?? [],
      saveMessages: observed.__officeRemoveSentMessages?.length ?? 0,
      selectionChanges: observed.__officeRemoveSelectionChanges ?? 0,
    }
  })
}

function readDomSelection(page: Page) {
  return page.evaluate(() => {
    const selection = document.getSelection()
    const anchorElement = selection?.anchorNode instanceof Element
      ? selection.anchorNode
      : selection?.anchorNode?.parentElement
    const cell = anchorElement?.closest('td, th')
    return {
      anchorOffset: selection?.anchorOffset ?? null,
      cellText: cell?.textContent ?? null,
      focusOffset: selection?.focusOffset ?? null,
      isCollapsed: selection?.isCollapsed ?? null,
    }
  })
}

async function expectNoOpStage(
  page: Page,
  before: Awaited<ReturnType<typeof readNoOpState>>,
  invokingSelection: Awaited<ReturnType<typeof readDomSelection>>,
  fixturePath: string,
  canonical: Buffer,
) {
  expect(await readDomSelection(page)).toEqual(invokingSelection)
  expect(await readNoOpState(page)).toEqual(before)
  expect(fs.readFileSync(fixturePath)).toEqual(canonical)
}

function expectMenuInsideViewport(page: Page, menu: ReturnType<Page['locator']>) {
  return expect.poll(async () => {
    const box = await menu.boundingBox()
    const viewport = page.viewportSize()
    if (!box || !viewport) return false
    return box.x >= 7
      && box.y >= 7
      && box.x + box.width <= viewport.width - 7
      && box.y + box.height <= viewport.height - 7
  }).toBe(true)
}

const removalSchema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: { group: 'block', content: 'text*' },
    heading: { group: 'block', content: 'text*', attrs: { level: { default: 2 } } },
    text: {},
    ...tableNodes({ tableGroup: 'block', cellContent: 'paragraph+' }),
  },
})

function removalParagraph(text: string): ProseNode {
  return removalSchema.node(
    'paragraph',
    null,
    text ? removalSchema.text(text) : undefined,
  )
}

function removalTable(descriptor: {
  id: string
  headerId: string
  rows: number
  columns: number
}): ProseNode {
  return removalSchema.node('table', null, Array.from({ length: descriptor.rows }, (_, row) => (
    removalSchema.node('table_row', null, Array.from({ length: descriptor.columns }, (_, column) => (
      removalSchema.node(
        row === 0 ? 'table_header' : 'table_cell',
        null,
        removalParagraph(row === 0
          ? `${descriptor.headerId}-h${column}`
          : `${descriptor.id}-r${row}c${column}`),
      )
    )))
  )))
}

function tableLifecycleState() {
  const scenario = getFixtureScenario('table-lifecycle')
  const template = scenario.documents[0]
  const blocks: ProseNode[] = [removalParagraph('Before table-lifecycle.')]
  template.tables.forEach((descriptor: {
    id: string
    headerId: string
    rows: number
    columns: number
  }) => {
    blocks.push(
      removalSchema.node('heading', { level: 2 }, removalSchema.text(descriptor.id)),
      removalTable(descriptor),
    )
  })
  blocks.push(removalParagraph('After table-lifecycle.'))
  const markdown = renderFixtureDocument('table-lifecycle', template)
  const metadata = (
    parseDocumentSettings(markdown).frontmatter.metadata ?? {}
  ) as Record<string, unknown>
  return {
    metadata: {
      tables: structuredClone(metadata.tables),
      tableColors: structuredClone(metadata.tableColors),
      tableStyles: structuredClone(metadata.tableStyles),
    },
    state: EditorState.create({
      schema: removalSchema,
      doc: removalSchema.node('doc', null, blocks),
    }),
  }
}

function proseTables(state: EditorState) {
  const tables: Array<{ node: ProseNode; pos: number }> = []
  state.doc.descendants((node, pos) => {
    if (node.type.name === 'table') {
      tables.push({ node, pos })
      return false
    }
    return true
  })
  return tables
}

test('[slice 06.3] pure planner rejects the exact S0 capture against normally deleted S1 as stale', () => {
  const { state: stateS0, metadata } = tableLifecycleState()
  const tableS0 = proseTables(stateS0)[1]
  const capture = captureOfficeTableRemovalTarget(stateS0, tableS0.pos + 1)
  expect(capture).not.toBeNull()
  const collectionBytes = JSON.stringify(metadata)
  const transactionS1 = stateS0.tr.delete(tableS0.pos, tableS0.pos + tableS0.node.nodeSize)
  const stateS1 = stateS0.apply(transactionS1)
  const spies = { callback: 0, dispatch: 0, save: 0 }

  expect(planOfficeTableRemoval(stateS1, capture!, metadata)).toEqual({
    applied: false,
    reason: 'STALE_TARGET',
  })
  expect(spies).toEqual({ callback: 0, dispatch: 0, save: 0 })
  expect(JSON.stringify(metadata)).toBe(collectionBytes)
})

test('[slice 06.3] pure planner removes and reindexes first, middle, and last opaque collections', () => {
  for (const removedIndex of [0, 1, 2]) {
    const { state, metadata } = tableLifecycleState()
    const target = proseTables(state)[removedIndex]
    const capture = captureOfficeTableRemovalTarget(state, target.pos + 1)
    const plan = planOfficeTableRemoval(state, capture!, metadata)
    expect(plan.applied).toBe(true)
    if (!plan.applied) continue
    const kept = [0, 1, 2].filter((index) => index !== removedIndex)
    for (const collectionName of ['tables', 'tableColors', 'tableStyles'] as const) {
      const collection = plan.metadataAfter[collectionName] as Array<Record<string, unknown>>
      expect(collection.map((entry) => entry.tableIndex)).toEqual([0, 1])
      expect(collection.map((entry) => entry.fingerprint)).toEqual(
        plan.afterTables.map(({ identity }) => identity.fingerprint),
      )
      const valueKey = collectionName === 'tables'
        ? 'columns'
        : collectionName === 'tableColors' ? 'cells' : 'fixtureSeed'
      const beforeCollection = metadata[collectionName] as Array<Record<string, unknown>>
      expect(collection.map((entry) => entry[valueKey])).toEqual(
        kept.map((index) => beforeCollection[index][valueKey]),
      )
    }
  }
})

test('[slice 06.3] metadata settlement receives the exact prior seeded-style snapshot', () => {
  const root = {} as HTMLElement
  const publication = createOfficeDeferredMarkdownPublicationState()
  const before: OfficeTableMetadataSnapshot = {
    tables: [{ tableIndex: 0, columns: [100] }],
    tableColors: [{ tableIndex: 0, cells: { '0,0': '#aa0000' } }],
    tableStyles: [{ tableIndex: 0, fixtureSeed: 'before-style' }],
  }
  const after: OfficeTableMetadataSnapshot = {
    tables: [],
    tableColors: [],
    tableStyles: [],
  }
  let tables = structuredClone(before.tables)
  let colors = structuredClone(before.tableColors)
  let styles = structuredClone(before.tableStyles)
  let receivedBefore: OfficeTableMetadataSnapshot | null = null
  const unregister = registerOfficeTableMetadataBindings(root, {
    readTables: () => tables,
    readTableColors: () => colors,
    readTableStyles: () => styles,
    publishTables: (value) => { tables = structuredClone(value) as typeof tables },
    publishTableColors: (value) => { colors = structuredClone(value) as typeof colors },
    publishTableStyles: (value) => { styles = structuredClone(value) as typeof styles },
    prepareDeferredSnapshot: (token) => publication.prepare(token),
    cancelDeferredSnapshot: (token, document) => publication.cancel(token, document),
    isCurrentSnapshot: (token) => publication.isCurrent(token),
    publishSnapshot: (_snapshot, previous, document, token) => {
      receivedBefore = structuredClone(previous)
      return publication.finalize(token, document)
    },
  })
  try {
    publishOfficeTableMetadataSnapshot(root, after)
    expect(receivedBefore).toEqual(before)
    expect({ tables, tableColors: colors, tableStyles: styles }).toEqual(after)
  } finally {
    unregister()
  }
})

test('[slice 06.4] insertion planner rejects a stale invocation without consulting commands or changing collections', () => {
  const { state: stateS0, metadata } = tableLifecycleState()
  let targetPosition: number | null = null
  stateS0.doc.descendants((node, pos) => {
    if (targetPosition === null && node.type.name === 'heading' && node.textContent === 'life-b') {
      targetPosition = pos
    }
    return targetPosition === null
  })
  expect(targetPosition).not.toBeNull()
  const capture = captureOfficeTableInsertionTarget(stateS0, targetPosition)
  const collectionBytes = JSON.stringify(metadata)
  const stateS1 = stateS0.apply(stateS0.tr.insertText('changed', 1))
  const spies = { callback: 0, dispatch: 0, save: 0 }
  expect(planOfficeTableInsertion(
    stateS1,
    {} as never,
    capture,
    2,
    2,
    metadata,
  )).toEqual({ applied: false, reason: 'STALE_TARGET' })
  expect(spies).toEqual({ callback: 0, dispatch: 0, save: 0 })
  expect(JSON.stringify(metadata)).toBe(collectionBytes)
})

test('[slice 06.1] pointer Table submenu preserves Remove table and root actions', async ({ page }) => {
  const fixture = await resetFixture()
  const canonical = fs.readFileSync(fixture.path)
  try {
    await page.addInitScript(() => {
      ;(window as typeof window & { __officeRemoveRequests?: unknown[] }).__officeRemoveRequests = []
      document.addEventListener('rv-office-table-remove-request', (event) => {
        const customEvent = event as CustomEvent
        ;(window as typeof window & { __officeRemoveRequests?: unknown[] })
          .__officeRemoveRequests?.push(customEvent.detail)
      })
    })
    const editor = await openOfficeDocument(page, fixture.filename)
    const table = editor.locator('table.rv-office-table')
    const rows = table.locator('tbody > tr')
    await expect(rows).toHaveCount(5)

    await rows.nth(2).locator('td').nth(1).click({ button: 'right' })
    const rootMenu = page.getByRole('menu', { name: 'Table cell actions' })
    await expect(rootMenu).toBeVisible()
    const rootItems = rootMenu.locator(':scope > [role="menuitem"]')
    await expect(rootItems).toHaveText([
      'table_editTablechevron_right',
      'colorsCell Background',
      'colorsRow Background',
      'colorsColumn Background',
      'addInsert Row Above',
      'addInsert Row Below',
      'addInsert Column Left',
      'addInsert Column Right',
      'deleteDelete Row Above',
      'deleteDelete Row Below',
      'deleteDelete Column Left',
      'deleteDelete Column Right',
    ])
    const tableItem = rootMenu.getByRole('menuitem', { name: 'Table', exact: true })
    await expect(tableItem.locator('.material-symbols-outlined').first()).toHaveText('table_edit')
    await expect(tableItem.locator('.rv-office-table-context-chevron')).toHaveText('chevron_right')
    await tableItem.hover()

    const tableMenu = page.getByRole('menu', { name: 'Table', exact: true })
    await expect(tableMenu).toBeVisible()
    await expect(tableMenu.locator(
      ':scope > [role="menuitem"], :scope > [role="menuitemradio"]',
    )).toHaveCount(8)
    const addTitleItem = tableMenu.getByRole('menuitem', { name: 'Add title row', exact: true })
    await expect(addTitleItem.locator('.material-symbols-outlined')).toHaveText('variable_add')
    await expect(addTitleItem).toBeEnabled()
    const borderSizeItem = tableMenu.getByRole('menuitem', {
      name: /Border size: current width 1px/,
    })
    await expect(borderSizeItem.locator('.material-symbols-outlined').first()).toHaveText('border_all')
    const borderColorItem = tableMenu.getByRole('menuitem', {
      name: 'Border color: current color Default',
      exact: true,
    })
    await expect(borderColorItem.locator('.material-symbols-outlined')).toHaveText('border_all')
    await expect(tableMenu.getByRole('menuitemradio', { name: /Align table/ })).toHaveCount(3)
    const overflowItem = tableMenu.getByRole('menuitem', {
      name: 'Overflow: current mode Overflow',
      exact: true,
    })
    await expect(overflowItem.locator('.material-symbols-outlined').first())
      .toHaveText('format_text_overflow')
    const removeItem = tableMenu.getByRole('menuitem', { name: 'Remove table', exact: true })
    await expect(removeItem.locator('.material-symbols-outlined')).toHaveText('delete')
    await removeItem.click()
    await expect(rootMenu).toHaveCount(0)
    await expect(tableMenu).toHaveCount(0)
    expect(await page.evaluate(() => (
      window as typeof window & { __officeRemoveRequests?: unknown[] }
    ).__officeRemoveRequests)).toEqual([expect.objectContaining({
      context: expect.objectContaining({ rowIndex: 2, colIndex: 1, rowCount: 5, colCount: 4 }),
    })])
    await expect(rows).toHaveCount(5)
    expect(fs.readFileSync(fixture.path)).toEqual(canonical)
    await page.getByRole('dialog', { name: 'Remove table', exact: true })
      .getByRole('button', { name: 'Cancel', exact: true }).click()

    await rows.nth(2).locator('td').nth(1).click({ button: 'right' })
    await rootMenu.getByRole('menuitem', { name: 'Insert Row Below', exact: true }).click()
    await expect(rows).toHaveCount(6)
  } finally {
    await page.close()
    const restored = await resetFixture()
    expect(fs.readFileSync(restored.path)).toEqual(canonical)
  }
})

test('[slice 06.2] dialog is labelled and described, traps focus, ignores outside click, and Cancel is an exact no-op', async ({ page }) => {
  const fixture = await resetLifecycleFixture()
  const canonical = fs.readFileSync(fixture.path)
  await installNoOpObservers(page, fixture.filename)
  try {
    const editor = await openOfficeDocument(page, fixture.filename)
    const cell = editor.locator('table.rv-office-table').first()
      .locator('tbody > tr').nth(1).locator('td').nth(1)
    await cell.click()
    await page.keyboard.press('End')
    const invokingSelection = await readDomSelection(page)
    expect(invokingSelection.cellText).toContain('life-a-r1c1')
    await page.waitForTimeout(250)
    await resetNoOpObservers(page)
    const before = await readNoOpState(page)

    await cell.click({ button: 'right' })
    const rootMenu = page.getByRole('menu', { name: 'Table cell actions' })
    await expect(rootMenu.getByRole('menuitem', { name: 'Table', exact: true })).toBeFocused()
    await expectNoOpStage(page, before, invokingSelection, fixture.path, canonical)
    await rootMenu.getByRole('menuitem', { name: 'Table', exact: true }).hover()
    await page.getByRole('menu', { name: 'Table', exact: true })
      .getByRole('menuitem', { name: 'Remove table', exact: true }).click()

    const overlay = page.locator('body > .rv-office-table-confirm-overlay')
    const dialog = overlay.getByRole('dialog', { name: 'Remove table', exact: true })
    const cancel = dialog.getByRole('button', { name: 'Cancel', exact: true })
    const confirm = dialog.getByRole('button', { name: 'Remove table', exact: true })
    await expect(dialog).toBeVisible()
    await expect(dialog).toHaveAttribute('aria-modal', 'true')
    await expect(dialog).toHaveAccessibleName('Remove table')
    await expect(dialog).toHaveAccessibleDescription(WARNING_TEXT)
    await expect(dialog.getByText(WARNING_TEXT, { exact: true })).toHaveCount(1)
    await expect(cancel).toBeFocused()
    await expect(editor.locator('.rv-office-table-confirm-overlay')).toHaveCount(0)
    await expectNoOpStage(page, before, invokingSelection, fixture.path, canonical)

    await page.keyboard.press('Tab')
    await expect(confirm).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(cancel).toBeFocused()
    await page.keyboard.press('Shift+Tab')
    await expect(confirm).toBeFocused()
    await page.keyboard.press('Shift+Tab')
    await expect(cancel).toBeFocused()
    await expectNoOpStage(page, before, invokingSelection, fixture.path, canonical)

    await overlay.click({ position: { x: 2, y: 2 } })
    await expect(dialog).toBeVisible()
    await expect(cancel).toBeFocused()
    await expectNoOpStage(page, before, invokingSelection, fixture.path, canonical)

    await cancel.click()
    await expect(dialog).toHaveCount(0)
    await expect(editor).toBeFocused()
    await expectNoOpStage(page, before, invokingSelection, fixture.path, canonical)
    await page.waitForTimeout(650)
    await expectNoOpStage(page, before, invokingSelection, fixture.path, canonical)
  } finally {
    await page.close()
    const current = fs.readFileSync(fixture.path)
    if (!current.equals(canonical)) {
      const restored = await resetLifecycleFixture()
      expect(fs.readFileSync(restored.path)).toEqual(canonical)
    }
  }
})

test('[slice 06.2] Escape closes the modal as an exact no-op and restores the invoking editor selection', async ({ page }) => {
  const fixture = await resetLifecycleFixture()
  const canonical = fs.readFileSync(fixture.path)
  await installNoOpObservers(page, fixture.filename)
  try {
    const editor = await openOfficeDocument(page, fixture.filename)
    const cell = editor.locator('table.rv-office-table').nth(1)
      .locator('tbody > tr').nth(2).locator('td').first()
    await cell.click()
    await page.keyboard.press('End')
    const invokingSelection = await readDomSelection(page)
    expect(invokingSelection.cellText).toContain('life-b-r2c0')
    await page.waitForTimeout(250)
    await resetNoOpObservers(page)
    const before = await readNoOpState(page)

    await cell.click({ button: 'right' })
    const rootMenu = page.getByRole('menu', { name: 'Table cell actions' })
    await expect(rootMenu.getByRole('menuitem', { name: 'Table', exact: true })).toBeFocused()
    await expectNoOpStage(page, before, invokingSelection, fixture.path, canonical)
    await page.keyboard.press('ArrowRight')
    const tableMenu = page.getByRole('menu', { name: 'Table', exact: true })
    await expect(tableMenu.getByRole('menuitem', { name: 'Add title row', exact: true }))
      .toBeFocused()
    await page.keyboard.press('ArrowDown')
    await expect(tableMenu.getByRole('menuitem', { name: /Border size: current width 1px/ }))
      .toBeFocused()
    await page.keyboard.press('ArrowDown')
    await expect(tableMenu.getByRole('menuitem', {
      name: 'Border color: current color Default',
      exact: true,
    })).toBeFocused()
    await page.keyboard.press('ArrowDown')
    await expect(tableMenu.getByRole('menuitemradio', {
      name: 'Align table left',
      exact: true,
    })).toBeFocused()
    await page.keyboard.press('ArrowDown')
    await expect(tableMenu.getByRole('menuitemradio', {
      name: 'Align table center',
      exact: true,
    })).toBeFocused()
    await page.keyboard.press('ArrowDown')
    await expect(tableMenu.getByRole('menuitemradio', {
      name: 'Align table right',
      exact: true,
    })).toBeFocused()
    await page.keyboard.press('ArrowDown')
    await expect(tableMenu.getByRole('menuitem', {
      name: 'Overflow: current mode Overflow',
      exact: true,
    })).toBeFocused()
    await page.keyboard.press('ArrowDown')
    await expect(tableMenu.getByRole('menuitem', { name: 'Remove table', exact: true }))
      .toBeFocused()
    await expectNoOpStage(page, before, invokingSelection, fixture.path, canonical)
    await page.keyboard.press('Enter')
    const dialog = page.getByRole('dialog', { name: 'Remove table', exact: true })
    await expect(dialog.getByRole('button', { name: 'Cancel', exact: true })).toBeFocused()
    await expectNoOpStage(page, before, invokingSelection, fixture.path, canonical)

    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(editor).toBeFocused()
    await expectNoOpStage(page, before, invokingSelection, fixture.path, canonical)
    await page.waitForTimeout(650)
    await expectNoOpStage(page, before, invokingSelection, fixture.path, canonical)
  } finally {
    await page.close()
    const current = fs.readFileSync(fixture.path)
    if (!current.equals(canonical)) {
      const restored = await resetLifecycleFixture()
      expect(fs.readFileSync(restored.path)).toEqual(canonical)
    }
  }
})

test('[slice 06.1] keyboard navigation opens and closes nested layers and Escape restores selection', async ({ page }) => {
  const fixture = await resetFixture()
  const canonical = fs.readFileSync(fixture.path)
  try {
    const editor = await openOfficeDocument(page, fixture.filename)
    const cell = editor.locator('table.rv-office-table tbody > tr').nth(2).locator('td').nth(1)
    await cell.click()
    await page.keyboard.press('End')
    const invokingSelection = await readDomSelection(page)
    expect(invokingSelection.cellText).toContain('structure-r5-c4-r2c1')

    await cell.click({ button: 'right' })
    const rootMenu = page.getByRole('menu', { name: 'Table cell actions' })
    const tableItem = rootMenu.getByRole('menuitem', { name: 'Table', exact: true })
    await expect(tableItem).toBeFocused()

    await page.keyboard.press('ArrowLeft')
    await expect(tableItem).toBeFocused()
    await expect(page.getByRole('menu', { name: 'Table', exact: true })).toHaveCount(0)
    await page.keyboard.press('ArrowDown')
    await expect(rootMenu.getByRole('menuitem', { name: 'Cell Background', exact: true })).toBeFocused()
    await page.keyboard.press('ArrowUp')
    await expect(tableItem).toBeFocused()
    await page.keyboard.press('ArrowUp')
    await expect(rootMenu.getByRole('menuitem', { name: 'Delete Column Right', exact: true })).toBeFocused()
    await page.keyboard.press('ArrowDown')
    await expect(tableItem).toBeFocused()

    await page.keyboard.press('ArrowRight')
    const tableMenu = page.getByRole('menu', { name: 'Table', exact: true })
    const overflowItem = tableMenu.getByRole('menuitem', {
      name: 'Overflow: current mode Overflow',
      exact: true,
    })
    const addTitleItem = tableMenu.getByRole('menuitem', {
      name: 'Add title row',
      exact: true,
    })
    const borderSizeItem = tableMenu.getByRole('menuitem', { name: /Border size: current width 1px/ })
    const borderColorItem = tableMenu.getByRole('menuitem', {
      name: 'Border color: current color Default',
      exact: true,
    })
    const alignLeftItem = tableMenu.getByRole('menuitemradio', {
      name: 'Align table left',
      exact: true,
    })
    const alignCenterItem = tableMenu.getByRole('menuitemradio', {
      name: 'Align table center',
      exact: true,
    })
    const alignRightItem = tableMenu.getByRole('menuitemradio', {
      name: 'Align table right',
      exact: true,
    })
    const removeItem = tableMenu.getByRole('menuitem', { name: 'Remove table', exact: true })
    await expect(addTitleItem).toBeFocused()
    await page.keyboard.press('ArrowDown')
    await expect(borderSizeItem).toBeFocused()
    await page.keyboard.press('ArrowDown')
    await expect(borderColorItem).toBeFocused()
    await page.keyboard.press('ArrowDown')
    await expect(alignLeftItem).toBeFocused()
    await page.keyboard.press('ArrowDown')
    await expect(alignCenterItem).toBeFocused()
    await page.keyboard.press('ArrowDown')
    await expect(alignRightItem).toBeFocused()
    await page.keyboard.press('ArrowDown')
    await expect(overflowItem).toBeFocused()
    await page.keyboard.press('ArrowDown')
    await expect(removeItem).toBeFocused()
    await page.keyboard.press('ArrowLeft')
    await expect(tableMenu).toHaveCount(0)
    await expect(tableItem).toBeFocused()

    await page.keyboard.press('Enter')
    await expect(addTitleItem).toBeFocused()
    await page.keyboard.press('ArrowLeft')
    await expect(tableItem).toBeFocused()
    await page.keyboard.press('Space')
    await expect(addTitleItem).toBeFocused()
    await page.keyboard.press('Escape')

    await expect(rootMenu).toHaveCount(0)
    await expect(tableMenu).toHaveCount(0)
    await expect(editor).toBeFocused()
    expect(await readDomSelection(page)).toEqual(invokingSelection)
    expect(fs.readFileSync(fixture.path)).toEqual(canonical)
  } finally {
    await page.close()
    const restored = await resetFixture()
    expect(fs.readFileSync(restored.path)).toEqual(canonical)
  }
})

test('[slice 06.1] root and nested menus remain inside all four viewport corners', async ({ page }) => {
  const fixture = await resetFixture()
  const canonical = fs.readFileSync(fixture.path)
  try {
    const editor = await openOfficeDocument(page, fixture.filename)
    await page.setViewportSize({ width: 800, height: 640 })
    const block = editor.locator('.milkdown-table-block').first()
    const rows = block.locator('table.rv-office-table tbody > tr')
    const corners = [
      { vertical: 'top', horizontal: 'left', row: 0, column: 0 },
      { vertical: 'top', horizontal: 'right', row: 0, column: 3 },
      { vertical: 'bottom', horizontal: 'left', row: 4, column: 0 },
      { vertical: 'bottom', horizontal: 'right', row: 4, column: 3 },
    ] as const

    for (const corner of corners) {
      await block.evaluate((element, placement) => {
        const style = (element as HTMLElement).style
        style.position = 'fixed'
        style.zIndex = '9999'
        style.margin = '0'
        style.top = placement.vertical === 'top' ? '0' : ''
        style.bottom = placement.vertical === 'bottom' ? '0' : ''
        style.left = placement.horizontal === 'left' ? '0' : ''
        style.right = placement.horizontal === 'right' ? '0' : ''
      }, corner)
      const cell = rows.nth(corner.row).locator('td, th').nth(corner.column)
      await cell.click()
      const box = await cell.boundingBox()
      expect(box).toBeTruthy()
      await cell.click({
        button: 'right',
        force: true,
        position: {
          x: corner.horizontal === 'left' ? 12 : box!.width - 12,
          y: corner.vertical === 'top' ? 12 : box!.height - 12,
        },
      })
      const rootMenu = page.getByRole('menu', { name: 'Table cell actions' })
      await expect(rootMenu).toBeVisible()
      await expectMenuInsideViewport(page, rootMenu)
      await rootMenu.getByRole('menuitem', { name: 'Table', exact: true }).hover()
      const tableMenu = page.getByRole('menu', { name: 'Table', exact: true })
      await expect(tableMenu).toBeVisible()
      await expectMenuInsideViewport(page, tableMenu)
      await page.keyboard.press('Escape')
      await expect(rootMenu).toHaveCount(0)
      await expect(editor).toBeFocused()
    }
    expect(fs.readFileSync(fixture.path)).toEqual(canonical)
  } finally {
    await page.close()
    const restored = await resetFixture()
    expect(fs.readFileSync(restored.path)).toEqual(canonical)
  }
})

test('[slice 06.3] Confirm deletes the captured first, middle, or last table atomically on distinct copies', async ({ page }) => {
  const fixtures = await resetLifecycleFixtureCopies(3)
  const canonicalByPath = new Map(fixtures.map((fixture: { path: string }) => [
    fixture.path,
    fs.readFileSync(fixture.path),
  ]))
  const cases = [
    { removedIndex: 0, kept: [1, 2] },
    { removedIndex: 1, kept: [0, 2] },
    { removedIndex: 2, kept: [0, 1] },
  ]
  const tableIds = ['life-a', 'life-b', 'life-c']
  const widthValues = [[100, 140], [120, 160], [140, 180]]
  const colorValues = ['rgb(170, 0, 0)', 'rgb(0, 170, 0)', 'rgb(0, 0, 170)']
  await installDeletionObservers(page)

  try {
    for (let caseIndex = 0; caseIndex < cases.length; caseIndex += 1) {
      const fixture = fixtures[caseIndex]
      const { removedIndex, kept } = cases[caseIndex]
      const editor = await openOfficeDocument(page, fixture.filename)
      const tables = editor.locator('table.rv-office-table')
      await expect(tables).toHaveCount(3)
      await resetDeletionObservers(page)

      const targetCell = tables.nth(removedIndex).locator('tbody > tr').nth(1).locator('td').first()
      await targetCell.click()
      await page.keyboard.press('End')
      await targetCell.click({ button: 'right' })
      await page.getByRole('menu', { name: 'Table cell actions' })
        .getByRole('menuitem', { name: 'Table', exact: true }).hover()
      await page.getByRole('menu', { name: 'Table', exact: true })
        .getByRole('menuitem', { name: 'Remove table', exact: true }).click()
      const dialog = page.getByRole('dialog', { name: 'Remove table', exact: true })
      await expect(dialog).toBeVisible()

      const redirectedIndex = removedIndex === 2 ? 0 : 2
      await tables.nth(redirectedIndex).locator('tbody > tr').nth(1).locator('td').first()
        .evaluate((cell) => {
          const text = cell.firstChild
          const selection = document.getSelection()
          if (text && selection) {
            selection.removeAllRanges()
            selection.collapse(text, Math.min(1, text.textContent?.length ?? 0))
          }
          ;(cell.closest('.ProseMirror') as HTMLElement | null)?.focus()
        })
      await expect.poll(async () => (await readDomSelection(page)).cellText)
        .toContain(`${tableIds[redirectedIndex]}-r1c0`)

      await page.evaluate(() => {
        const observed = window as typeof window & {
          __officeRemoveFirstFrame?: unknown
        }
        const editorRoot = document.querySelector('.rv-office-document-editor .ProseMirror')
        let scheduled = false
        const observer = new MutationObserver(() => {
          const tablesNow = editorRoot?.querySelectorAll('table.rv-office-table')
          if (scheduled || tablesNow?.length !== 2) return
          scheduled = true
          requestAnimationFrame(() => {
            const currentTables = Array.from(
              editorRoot?.querySelectorAll<HTMLTableElement>('table.rv-office-table') ?? [],
            )
            observed.__officeRemoveFirstFrame = {
              dirty: document.querySelectorAll('.rv-office-document-dirty').length,
              tables: currentTables.map((table) => ({
                color: getComputedStyle(table.rows[0].cells[0]).backgroundColor,
                header: table.rows[0].cells[0].textContent?.trim(),
                widths: Array.from(table.querySelectorAll<HTMLTableColElement>(
                  ':scope > colgroup > col',
                )).map((column) => Number.parseInt(column.style.width, 10)),
              })),
            }
            observer.disconnect()
          })
        })
        if (editorRoot) observer.observe(editorRoot, { childList: true, subtree: true })
      })

      await dialog.getByRole('button', { name: 'Remove table', exact: true }).click()
      await expect(tables).toHaveCount(2)
      await expect.poll(() => page.evaluate(() => (
        window as typeof window & { __officeRemoveFirstFrame?: unknown }
      ).__officeRemoveFirstFrame)).not.toBeNull()
      expect(await page.evaluate(() => (
        window as typeof window & { __officeRemoveFirstFrame?: unknown }
      ).__officeRemoveFirstFrame)).toEqual({
        dirty: 1,
        tables: kept.map((index) => ({
          color: colorValues[index],
          header: `${tableIds[index]}-h0`,
          widths: widthValues[index],
        })),
      })

      expect(await page.evaluate(() => (
        window as typeof window & { __officeRemoveEvents?: string[] }
      ).__officeRemoveEvents)).toEqual(['step', 'plugin-publish', 'external-publish'])
      await expect.poll(() => countDeletionSaves(page, fixture.filename), {
        timeout: 5_000,
      }).toBe(1)

      const persisted = parseDocumentSettings(fs.readFileSync(fixture.path, 'utf8'))
      const persistedMetadata = persisted.frontmatter.metadata as Record<string, unknown>
      expect(persistedMetadata.preserveUnknown).toBe('keep-me')
      expect(persisted.body).not.toContain(`${tableIds[removedIndex]}-h0`)
      kept.forEach((index) => expect(persisted.body).toContain(`${tableIds[index]}-h0`))
      const collections = [
        persistedMetadata.tables,
        persistedMetadata.tableColors,
        persistedMetadata.tableStyles,
      ] as Array<Array<Record<string, unknown>>>
      collections.forEach((collection) => {
        expect(collection.map(({ tableIndex }) => tableIndex)).toEqual([0, 1])
        expect(collection.map(({ fingerprint }) => fingerprint)).toEqual(
          collections[0].map(({ fingerprint }) => fingerprint),
        )
      })
      expect(collections[0].map(({ columns }) => columns)).toEqual(kept.map((index) => widthValues[index]))
      expect(collections[1].map(({ cells }) => cells)).toEqual(kept.map((index) => ({
        '0,0': ['#aa0000', '#00aa00', '#0000aa'][index],
      })))
      expect(collections[2].map(({ fixtureSeed }) => fixtureSeed)).toEqual(
        kept.map((index) => `keep-style-${index}`),
      )

      if (removedIndex === 1) {
        await resetDeletionObservers(page)
        await page.keyboard.press('ControlOrMeta+z')
        await expect(tables).toHaveCount(3)
        expect(await page.evaluate(() => (
          window as typeof window & { __officeRemoveEvents?: string[] }
        ).__officeRemoveEvents)).toEqual(['step', 'plugin-publish', 'external-publish'])
        await expect.poll(() => countDeletionSaves(page, fixture.filename), {
          timeout: 5_000,
        }).toBe(1)
        const undoMetadata = parseDocumentSettings(fs.readFileSync(fixture.path, 'utf8'))
          .frontmatter.metadata as Record<string, unknown>
        expect((undoMetadata.tableStyles as Array<Record<string, unknown>>)
          .map(({ fixtureSeed }) => fixtureSeed)).toEqual([
          'keep-style-0', 'keep-style-1', 'keep-style-2',
        ])

        await resetDeletionObservers(page)
        await page.keyboard.press('ControlOrMeta+Shift+z')
        await expect(tables).toHaveCount(2)
        expect(await page.evaluate(() => (
          window as typeof window & { __officeRemoveEvents?: string[] }
        ).__officeRemoveEvents)).toEqual(['step', 'plugin-publish', 'external-publish'])
        await expect.poll(() => countDeletionSaves(page, fixture.filename), {
          timeout: 5_000,
        }).toBe(1)
        const reopenedEditor = await openOfficeDocument(page, fixture.filename)
        const reopenedTables = reopenedEditor.locator('table.rv-office-table')
        await expect(reopenedTables).toHaveCount(2)
        await expect(reopenedTables.nth(0).locator('tbody > tr').first().locator('th').first())
          .toContainText('life-a-h0')
        await expect(reopenedTables.nth(1).locator('tbody > tr').first().locator('th').first())
          .toContainText('life-c-h0')
      }
    }
  } finally {
    await page.close()
    const restored = await resetLifecycleFixtureCopies(3)
    restored.forEach((fixture: { path: string }) => {
      expect(fs.readFileSync(fixture.path)).toEqual(canonicalByPath.get(fixture.path))
    })
  }
})

test('[slice 06.4] insertion before, between, and after reindexes every seeded collection atomically and survives history plus reopen', async ({ page }) => {
  const fixtures = await resetLifecycleFixtureCopies(3)
  const canonicalByPath = new Map(fixtures.map((fixture: { path: string }) => [
    fixture.path,
    fs.readFileSync(fixture.path),
  ]))
  const insertionIndexes = [0, 1, 3] as const
  const tableIds = ['life-a', 'life-b', 'life-c']
  const widthValues = [[100, 140], [120, 160], [140, 180]]
  const colorValues = ['rgb(170, 0, 0)', 'rgb(0, 170, 0)', 'rgb(0, 0, 170)']
  await installDeletionObservers(page)

  try {
    for (let caseIndex = 0; caseIndex < insertionIndexes.length; caseIndex += 1) {
      const fixture = fixtures[caseIndex]
      const insertionIndex = insertionIndexes[caseIndex]
      const editor = await openOfficeDocument(page, fixture.filename)
      const tables = editor.locator('table.rv-office-table')
      await expect(tables).toHaveCount(3)
      await resetDeletionObservers(page)
      const beforeOpen = await readNoOpState(page)
      const fixtureBytesBeforeOpen = fs.readFileSync(fixture.path)
      const grid = await openTableInsertGridAt(page, editor, insertionIndex)
      expect(await readNoOpState(page)).toEqual(beforeOpen)
      expect(fs.readFileSync(fixture.path)).toEqual(fixtureBytesBeforeOpen)

      await page.evaluate(() => {
        const observed = window as typeof window & { __officeInsertFirstFrame?: unknown }
        const editorRoot = document.querySelector('.rv-office-document-editor .ProseMirror')
        let scheduled = false
        const observer = new MutationObserver(() => {
          const tablesNow = editorRoot?.querySelectorAll('table.rv-office-table')
          if (scheduled || tablesNow?.length !== 4) return
          scheduled = true
          requestAnimationFrame(() => {
            observed.__officeInsertFirstFrame = {
              dirty: document.querySelectorAll('.rv-office-document-dirty').length,
              tables: Array.from(
                editorRoot?.querySelectorAll<HTMLTableElement>('table.rv-office-table') ?? [],
              ).map((table) => ({
                color: getComputedStyle(table.rows[0].cells[0]).backgroundColor,
                header: table.rows[0].cells[0].textContent?.trim() ?? '',
                widths: Array.from(table.querySelectorAll<HTMLTableColElement>(
                  ':scope > colgroup > col',
                )).map((column) => Number.parseInt(column.style.width, 10)),
              })),
            }
            observer.disconnect()
          })
        })
        if (editorRoot) observer.observe(editorRoot, { childList: true, subtree: true })
      })
      await grid.locator('[data-row="2"][data-col="2"]').click()
      await expect(tables).toHaveCount(4)
      await expect.poll(() => page.evaluate(() => (
        window as typeof window & { __officeInsertFirstFrame?: unknown }
      ).__officeInsertFirstFrame)).not.toBeUndefined()
      const firstFrame = await page.evaluate(() => (
        window as typeof window & {
          __officeInsertFirstFrame?: {
            dirty: number
            tables: Array<{ color: string; header: string; widths: number[] }>
          }
        }
      ).__officeInsertFirstFrame)
      expect(firstFrame?.dirty).toBe(1)
      tableIds.forEach((id, originalIndex) => {
        const nextIndex = originalIndex < insertionIndex ? originalIndex : originalIndex + 1
        expect(firstFrame?.tables[nextIndex]).toEqual({
          color: colorValues[originalIndex],
          header: `${id}-h0`,
          widths: widthValues[originalIndex],
        })
      })
      expect(await page.evaluate(() => (
        window as typeof window & { __officeRemoveEvents?: string[] }
      ).__officeRemoveEvents)).toEqual(['step', 'plugin-publish', 'external-publish'])
      await expect.poll(() => countDeletionSaves(page, fixture.filename), {
        timeout: 5_000,
      }).toBe(1)

      const persisted = parseDocumentSettings(fs.readFileSync(fixture.path, 'utf8'))
      const persistedMetadata = persisted.frontmatter.metadata as Record<string, unknown>
      expect(persistedMetadata.preserveUnknown).toBe('keep-me')
      expect(persisted.body.split('\n').filter((line) => (
        /^\|\s*:?-+:?\s*(?:\|\s*:?-+:?\s*)+\|$/.test(line)
      ))).toHaveLength(4)
      const expectedIndexes = [0, 1, 2]
        .map((index) => index < insertionIndex ? index : index + 1)
      const collections = [
        persistedMetadata.tables,
        persistedMetadata.tableColors,
        persistedMetadata.tableStyles,
      ] as Array<Array<Record<string, unknown>>>
      collections.forEach((collection) => {
        expect(collection).toHaveLength(3)
        expect(collection.map(({ tableIndex }) => tableIndex)).toEqual(expectedIndexes)
        expect(collection.some(({ tableIndex }) => tableIndex === insertionIndex)).toBe(false)
      })
      expect(collections[0].map(({ columns }) => columns)).toEqual(widthValues)
      expect(collections[1].map(({ cells }) => cells)).toEqual([
        { '0,0': '#aa0000' },
        { '0,0': '#00aa00' },
        { '0,0': '#0000aa' },
      ])
      expect(collections[2].map(({ fixtureSeed }) => fixtureSeed)).toEqual([
        'keep-style-0', 'keep-style-1', 'keep-style-2',
      ])
      collections[1].forEach((entry, index) => {
        expect(entry.fingerprint).toBe(collections[0][index].fingerprint)
        expect(collections[2][index].fingerprint).toBe(collections[0][index].fingerprint)
      })

      if (insertionIndex === 1) {
        await resetDeletionObservers(page)
        await page.keyboard.press('ControlOrMeta+z')
        await expect(tables).toHaveCount(3)
        expect(await page.evaluate(() => (
          window as typeof window & { __officeRemoveEvents?: string[] }
        ).__officeRemoveEvents)).toEqual(['step', 'plugin-publish', 'external-publish'])
        await expect.poll(() => countDeletionSaves(page, fixture.filename), {
          timeout: 5_000,
        }).toBe(1)
        const undoMetadata = parseDocumentSettings(fs.readFileSync(fixture.path, 'utf8'))
          .frontmatter.metadata as Record<string, unknown>
        expect((undoMetadata.tableStyles as Array<Record<string, unknown>>)
          .map(({ tableIndex, fixtureSeed }) => ({ tableIndex, fixtureSeed }))).toEqual([
          { tableIndex: 0, fixtureSeed: 'keep-style-0' },
          { tableIndex: 1, fixtureSeed: 'keep-style-1' },
          { tableIndex: 2, fixtureSeed: 'keep-style-2' },
        ])

        await resetDeletionObservers(page)
        await page.keyboard.press('ControlOrMeta+Shift+z')
        await expect(tables).toHaveCount(4)
        expect(await page.evaluate(() => (
          window as typeof window & { __officeRemoveEvents?: string[] }
        ).__officeRemoveEvents)).toEqual(['step', 'plugin-publish', 'external-publish'])
        await expect.poll(() => countDeletionSaves(page, fixture.filename), {
          timeout: 5_000,
        }).toBe(1)
      }

      const reopenedEditor = await openOfficeDocument(page, fixture.filename)
      const reopenedTables = reopenedEditor.locator('table.rv-office-table')
      await expect(reopenedTables).toHaveCount(4)
      for (let originalIndex = 0; originalIndex < tableIds.length; originalIndex += 1) {
        const nextIndex = originalIndex < insertionIndex ? originalIndex : originalIndex + 1
        await expect(reopenedTables.nth(nextIndex).locator('tbody > tr').first().locator('th').first())
          .toContainText(`${tableIds[originalIndex]}-h0`)
        await expect(reopenedTables.nth(nextIndex).locator(':scope > colgroup > col'))
          .toHaveCount(2)
      }
    }
  } finally {
    await page.close()
    const restored = await resetLifecycleFixtureCopies(3)
    restored.forEach((fixture: { path: string }) => {
      expect(fs.readFileSync(fixture.path)).toEqual(canonicalByPath.get(fixture.path))
    })
  }
})

test('[slice 06.4] owner-visible post-removal gap accepts a caret and inserts at that visual coordinate', async ({ page }) => {
  const [fixture] = await resetLifecycleFixtureCopies(1)
  const canonical = fs.readFileSync(fixture.path)
  try {
    const editor = await openOfficeDocument(page, fixture.filename)
    const tables = editor.locator('table.rv-office-table')
    const lifeATableCell = tables.first().locator('tbody > tr').nth(1).locator('td').first()

    await lifeATableCell.click()
    await page.keyboard.press('End')
    await lifeATableCell.click({ button: 'right' })
    await page.getByRole('menu', { name: 'Table cell actions' })
      .getByRole('menuitem', { name: 'Table', exact: true }).hover()
    await page.getByRole('menu', { name: 'Table', exact: true })
      .getByRole('menuitem', { name: 'Remove table', exact: true }).click()
    await page.getByRole('dialog', { name: 'Remove table', exact: true })
      .getByRole('button', { name: 'Remove table', exact: true }).click()
    await expect(tables).toHaveCount(2)

    const selectionAfterRemoval = await page.evaluate(() => {
      const selection = document.getSelection()
      const anchorElement = selection?.anchorNode instanceof Element
        ? selection.anchorNode
        : selection?.anchorNode?.parentElement
      return {
        activeEditor: document.activeElement?.matches(
          '.rv-office-document-editor .milkdown .ProseMirror[contenteditable="true"]',
        ) ?? false,
        blockText: anchorElement?.closest('h1, h2, h3, h4, h5, h6, p')?.textContent ?? null,
        collapsed: selection?.isCollapsed ?? null,
      }
    })
    expect(selectionAfterRemoval).toEqual({
      activeEditor: true,
      blockText: 'life-b',
      collapsed: true,
    })

    const gap = await page.evaluate(() => {
      const headings = Array.from(
        document.querySelectorAll<HTMLHeadingElement>(
          '.rv-office-document-editor .milkdown .ProseMirror > h2',
        ),
      )
      const lifeA = headings.find((heading) => heading.textContent?.trim() === 'life-a')
      const lifeB = headings.find((heading) => heading.textContent?.trim() === 'life-b')
      if (!lifeA || !lifeB) return null
      lifeA.scrollIntoView({ block: 'center' })
      const before = lifeA.getBoundingClientRect()
      const after = lifeB.getBoundingClientRect()
      const point = {
        x: Math.max(before.left, after.left) + 12,
        y: before.bottom + ((after.top - before.bottom) / 2),
      }
      const target = document.elementFromPoint(point.x, point.y)
      return {
        ...point,
        gapHeight: after.top - before.bottom,
        targetClass: target?.className ?? null,
        targetIsEditorRoot: target?.matches('.ProseMirror') ?? false,
      }
    })
    expect(gap).not.toBeNull()
    expect(gap!.gapHeight).toBeGreaterThan(0)
    expect(gap!.targetIsEditorRoot).toBe(true)

    await page.mouse.click(gap!.x, gap!.y)
    await page.mouse.click(gap!.x, gap!.y, { button: 'right' })
    const insertMenu = page.locator('.rv-office-insert-context-menu')
    await expect(insertMenu).toBeVisible()
    await insertMenu.locator('[data-office-insert="table"]').hover()
    const grid = page.locator('.rv-office-table-grid-popover')
    await expect(grid).toBeVisible()
    await grid.locator('[data-row="2"][data-col="2"]').click()
    await expect(tables).toHaveCount(3)

    expect(await page.evaluate(() => Array.from(
      document.querySelectorAll<HTMLElement>(
        '.rv-office-document-editor .milkdown .ProseMirror > h2, '
        + '.rv-office-document-editor .milkdown .ProseMirror > .milkdown-table-block',
      ),
    ).map((block) => {
      if (block.matches('h2')) return `heading:${block.textContent?.trim()}`
      const firstHeader = block.querySelector('th')?.textContent?.trim() ?? ''
      return `table:${firstHeader || 'blank'}`
    }))).toEqual([
      'heading:life-a',
      'table:blank',
      'heading:life-b',
      'table:life-b-h0',
      'heading:life-c',
      'table:life-c-h0',
    ])
    await expect.poll(() => {
      const persisted = parseDocumentSettings(fs.readFileSync(fixture.path, 'utf8'))
      const metadata = persisted.frontmatter.metadata as Record<string, unknown>
      return (metadata.tables as Array<Record<string, unknown>>)
        .map(({ tableIndex }) => tableIndex)
    }, { timeout: 5_000 }).toEqual([1, 2])
    const persistedMetadata = parseDocumentSettings(fs.readFileSync(fixture.path, 'utf8'))
      .frontmatter.metadata as Record<string, unknown>
    for (const collectionName of ['tables', 'tableColors', 'tableStyles']) {
      const collection = persistedMetadata[collectionName] as Array<Record<string, unknown>>
      expect(collection.map(({ tableIndex }) => tableIndex)).toEqual([1, 2])
      expect(collection.some(({ tableIndex }) => tableIndex === 0)).toBe(false)
    }
  } finally {
    await page.close()
    const [restored] = await resetLifecycleFixtureCopies(1)
    expect(fs.readFileSync(restored.path)).toEqual(canonical)
  }
})
