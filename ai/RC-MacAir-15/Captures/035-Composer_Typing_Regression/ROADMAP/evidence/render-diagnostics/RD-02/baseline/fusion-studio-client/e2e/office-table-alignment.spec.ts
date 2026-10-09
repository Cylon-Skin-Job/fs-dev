import fs from 'node:fs'

import { expect, test, type Locator, type Page } from '@playwright/test'

import {
  ALIGNMENT_CANONICAL,
} from './office/fixture-scenarios.mjs'
import { resetOfficePlaywrightScenario } from './office/fixture-lifecycle.mjs'
import {
  getDocumentTableStyles,
  getRawDocumentTableStyles,
  normalizeDocumentTableAlignment,
  parseDocumentSettings,
} from '../src/lib/front-matter'
import {
  prepareOfficePageAlignmentFlowChange,
  prepareOfficeTableAlignmentChange,
} from '../src/components/office/officeTableDisplay'
import {
  createOfficeDeferredMarkdownPublicationState,
  OfficeTableMetadataPublicationError,
  publishOfficeTableMetadataCombinedCallbacks,
  publishOfficeTableMetadataSnapshot,
  readOfficeTableMetadataSnapshot,
  registerOfficeTableMetadataBindings,
  type OfficeTableMetadataSnapshot,
} from '../src/components/office/officeTableHistory'
import {
  planOfficePageAlignmentFlow,
  resolveOfficePageAlignmentFlowValue,
} from '../src/components/office/officePageAlignmentFlow'
import {
  planOfficeTableResize,
  type OfficeTableAlignment,
} from '../src/components/office/officeTableResizePlan'
import { prepareOfficeTableResizeSnapshot } from '../src/components/office/officeTableGeometry'

const ALIGNMENT_FILENAME = 'Alignment.md'
const DUPLICATE_ALIGNMENT_FILENAME = 'Color Integrity.md'

type FixtureFile = {
  filename: string
  path: string
}

async function resetAlignmentFixture(): Promise<FixtureFile> {
  const files = await resetOfficePlaywrightScenario({
    scenario: 'alignment',
    copies: 1,
    workspaces: 1,
  })
  const fixture = files.find(({ filename }: FixtureFile) => filename === ALIGNMENT_FILENAME)
  expect(fixture).toBeTruthy()
  return fixture as FixtureFile
}

async function resetDuplicateAlignmentFixture(): Promise<FixtureFile> {
  const files = await resetOfficePlaywrightScenario({
    scenario: 'color-integrity',
    copies: 1,
    workspaces: 1,
  })
  const fixture = files.find(({ filename }: FixtureFile) => (
    filename === DUPLICATE_ALIGNMENT_FILENAME
  ))
  expect(fixture).toBeTruthy()
  return fixture as FixtureFile
}

function installSaveObservation(page: Page) {
  return page.addInitScript(() => {
    const originalSend = WebSocket.prototype.send
    const observed = window as typeof window & {
      __alignmentSaveCount?: number
      __alignmentMetadataEvents?: Record<string, number>
      __officeTableMetadataTestHook?: (event: string) => void
    }
    observed.__alignmentSaveCount = 0
    observed.__alignmentMetadataEvents = {}
    observed.__officeTableMetadataTestHook = (event) => {
      const events = observed.__alignmentMetadataEvents ?? {}
      events[event] = (events[event] ?? 0) + 1
      observed.__alignmentMetadataEvents = events
    }
    WebSocket.prototype.send = function observeAlignmentSaves(data) {
      if (typeof data === 'string') {
        try {
          const message = JSON.parse(data) as { type?: string }
          if (message.type === 'file_save') {
            observed.__alignmentSaveCount = (observed.__alignmentSaveCount ?? 0) + 1
          }
        } catch {
          // Preserve unrelated non-JSON WebSocket frames.
        }
      }
      return originalSend.call(this, data)
    }
  })
}

function resetAlignmentObservation(page: Page) {
  return page.evaluate(() => {
    const observed = window as typeof window & {
      __alignmentSaveCount?: number
      __alignmentMetadataEvents?: Record<string, number>
    }
    observed.__alignmentSaveCount = 0
    observed.__alignmentMetadataEvents = {}
  })
}

function readAlignmentObservation(page: Page) {
  return page.evaluate(() => {
    const observed = window as typeof window & {
      __alignmentSaveCount?: number
      __alignmentMetadataEvents?: Record<string, number>
    }
    return {
      saves: observed.__alignmentSaveCount ?? 0,
      events: observed.__alignmentMetadataEvents ?? {},
    }
  })
}

async function expectSingleAlignmentSave(page: Page) {
  await expect.poll(async () => (await readAlignmentObservation(page)).saves, {
    timeout: 15_000,
  }).toBe(1)
  await page.waitForTimeout(650)
  expect(await readAlignmentObservation(page)).toEqual({
    saves: 1,
    events: {
      step: 1,
      'plugin-publish': 1,
      'external-publish': 1,
    },
  })
}

async function expectSingleTextSave(page: Page) {
  await expect.poll(async () => (await readAlignmentObservation(page)).saves, {
    timeout: 15_000,
  }).toBe(1)
  await page.waitForTimeout(650)
  expect(await readAlignmentObservation(page)).toEqual({ saves: 1, events: {} })
}

async function expectNoAlignmentSave(page: Page) {
  await page.waitForTimeout(750)
  expect(await readAlignmentObservation(page)).toEqual({ saves: 0, events: {} })
  await expect(page.locator('.rv-office-document-dirty')).toHaveCount(0)
}

function readAlignmentDisk(filePath: string) {
  const parsed = parseDocumentSettings(fs.readFileSync(filePath, 'utf8'))
  return {
    body: parsed.body,
    metadata: parsed.frontmatter.metadata as Record<string, unknown>,
    styles: (getRawDocumentTableStyles(parsed.frontmatter) ?? []) as Array<Record<string, unknown>>,
  }
}

function replaceAlignmentTableStylesBlock(content: string, replacement?: string): string {
  const lines = content.split('\n')
  const start = lines.indexOf('  tableStyles:')
  expect(start).toBeGreaterThanOrEqual(0)
  let end = start + 1
  while (lines[end]?.startsWith('    - ')) end += 1
  lines.splice(start, end - start, ...(replacement ? [replacement] : []))
  return lines.join('\n')
}

async function openAlignmentDocument(page: Page, filename = ALIGNMENT_FILENAME) {
  await page.goto('/')
  await page.getByTitle('Office', { exact: true }).click()
  const folder = page.getByTitle('001-Fixtures', { exact: true })
  const document = page.getByTitle(filename, { exact: true })
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

type AlignmentGeometrySnapshot = {
  alignment: string | undefined
  columns: number[]
  minimum: number
  scale: number
  table: { left: number; right: number; width: number }
  wrapper: {
    left: number
    right: number
    width: number
    scrollLeft: number
    scrollWidth: number
  }
  firstDataCell: { width: number; height: number }
}

async function readAlignmentGeometry(table: Locator): Promise<AlignmentGeometrySnapshot> {
  return table.evaluate((node) => {
    const element = node as HTMLTableElement
    const wrapper = element.parentElement as HTMLElement
    const tableRect = element.getBoundingClientRect()
    const wrapperRect = wrapper.getBoundingClientRect()
    const scale = tableRect.width / element.offsetWidth
    const wrapperLeft = wrapperRect.left + wrapper.clientLeft * scale
    const firstDataCell = element.querySelector<HTMLTableCellElement>('tbody > tr > td')
    const dataRect = firstDataCell?.getBoundingClientRect()
    return {
      alignment: element.dataset.rvTableAlignment,
      columns: Array.from(
        element.querySelectorAll<HTMLTableColElement>(':scope > colgroup > col'),
      ).map((column) => Math.round(column.getBoundingClientRect().width / scale)),
      minimum: Number.parseFloat(
        element.style.getPropertyValue('--rv-office-table-cell-min-width'),
      ),
      scale,
      table: { left: tableRect.left, right: tableRect.right, width: tableRect.width },
      wrapper: {
        left: wrapperLeft,
        right: wrapperLeft + wrapper.clientWidth * scale,
        width: wrapper.clientWidth * scale,
        scrollLeft: wrapper.scrollLeft,
        scrollWidth: wrapper.scrollWidth,
      },
      firstDataCell: {
        width: dataRect?.width ?? 0,
        height: dataRect?.height ?? 0,
      },
    }
  })
}

function expectedOuterRect(
  start: AlignmentGeometrySnapshot,
  alignment: OfficeTableAlignment,
  effectiveDelta: number,
) {
  const q = effectiveDelta * start.scale
  if (alignment === 'left') {
    return { left: start.table.left, right: start.table.right + q }
  }
  if (alignment === 'right') {
    return { left: start.table.left - q, right: start.table.right }
  }
  return { left: start.table.left - q / 2, right: start.table.right + q / 2 }
}

function expectRectWithinLayoutPixel(
  actual: { left: number; right: number },
  expected: { left: number; right: number },
  scale: number,
) {
  const tolerance = scale
  expect(Math.abs(actual.left - expected.left)).toBeLessThanOrEqual(tolerance)
  expect(Math.abs(actual.right - expected.right)).toBeLessThanOrEqual(tolerance)
}

async function previewAndCommitAlignmentResize(
  page: Page,
  table: Locator,
  boundaryIndex: number,
  clientDelta: number,
  expectedColumns: number[],
) {
  await resetAlignmentObservation(page)
  await table.scrollIntoViewIfNeeded()
  const start = await readAlignmentGeometry(table)
  const tableBox = await table.boundingBox()
  if (!tableBox) throw new Error('Alignment resize table has no bounding box')
  await page.mouse.move(
    tableBox.x + tableBox.width / 2,
    tableBox.y + tableBox.height / 2,
  )
  const handle = page.locator(
    `.rv-office-table-overlay .rv-office-col-grab[data-boundary-index="${boundaryIndex}"]`,
  )
  await expect(handle).toBeVisible()
  const handleBox = await handle.boundingBox()
  if (!handleBox) throw new Error(`Alignment resize boundary ${boundaryIndex} is unavailable`)
  const startX = handleBox.x + handleBox.width / 2
  const startY = handleBox.y + handleBox.height / 2
  await page.mouse.move(startX, startY)
  await page.mouse.down()
  await page.mouse.move(startX + clientDelta, startY)
  await expect(handle).toHaveAttribute('data-active', 'true')
  const preview = {
    guideX: await handle.evaluate((node) => Number.parseFloat((node as HTMLElement).style.left)),
    table: (await readAlignmentGeometry(table)).table,
  }
  await page.mouse.up()
  await expect.poll(async () => ({
    columns: (await readAlignmentGeometry(table)).columns,
    observation: await readAlignmentObservation(page),
  })).toEqual({
    columns: expectedColumns,
    observation: {
      saves: 1,
      events: {
        step: 1,
        'plugin-publish': 1,
        'external-publish': 1,
      },
    },
  })
  return { start, preview, committed: await readAlignmentGeometry(table) }
}

async function chooseTableAlignment(
  page: Page,
  table: Locator,
  alignment: OfficeTableAlignment,
) {
  await table.locator('tbody > tr').last().locator('td, th').first().click({ button: 'right' })
  const rootMenu = page.getByRole('menu', { name: 'Table cell actions' })
  await expect(rootMenu).toBeVisible()
  await rootMenu.getByRole('menuitem', { name: 'Table', exact: true }).hover()
  const tableMenu = page.getByRole('menu', { name: 'Table', exact: true })
  await expect(tableMenu).toBeVisible()
  await tableMenu.getByRole('menuitemradio', {
    name: `Align table ${alignment}`,
    exact: true,
  }).click()
  await expect(table).toHaveAttribute('data-rv-table-alignment', alignment)
}

test.describe('[slice 10.1] table alignment normalization', () => {
  test('accepts only left, center, and right and otherwise resolves left', () => {
    expect([
      undefined,
      null,
      '',
      'LEFT',
      'justify',
      'left',
      'center',
      'right',
    ].map(normalizeDocumentTableAlignment)).toEqual([
      'left',
      'left',
      'left',
      'left',
      'left',
      'left',
      'center',
      'right',
    ])

    const parsed = parseDocumentSettings(ALIGNMENT_CANONICAL)
    expect(getDocumentTableStyles(parsed.frontmatter)?.map(({ tableAlignment }) => tableAlignment))
      .toEqual(['left', 'center', 'right', 'center', 'right'])
    expect(getRawDocumentTableStyles(parsed.frontmatter)).toEqual([
      { tableIndex: 0, fingerprint: 'fixture-align-0', tableAlignment: 'left' },
      { tableIndex: 1, fingerprint: 'fixture-align-1', tableAlignment: 'center' },
      { tableIndex: 2, fingerprint: 'fixture-align-2', tableAlignment: 'right' },
      { tableIndex: 3, fingerprint: 'fixture-align-3', tableAlignment: 'center' },
      { tableIndex: 4, fingerprint: 'fixture-align-4', tableAlignment: 'right' },
    ])
  })
})

test.describe('[slice 10.2] table alignment mutation preparation', () => {
  test('changes only the captured style entry and no-ops every already-effective selection', () => {
    const before = {
      tables: [{ tableIndex: 1, fingerprint: 'table-b', columns: [120, 140], style: { keep: true } }],
      tableColors: [{ tableIndex: 1, fingerprint: 'table-b', cells: { '1,1': '#123456' } }],
      tableStyles: [
        { tableIndex: 0, fingerprint: 'table-a', tableAlignment: 'right', sibling: 'exact' },
        {
          tableIndex: 1,
          fingerprint: 'table-b',
          tableAlignment: 'left',
          tableOverflow: 'newline',
          titleRow: true,
          borderWidth: 3,
          borderColor: '#abcdef',
          future: { nested: ['keep', 7] },
        },
        'opaque-style-entry',
      ],
    }
    const frozen = structuredClone(before)
    const target = { tableIndex: 1, fingerprint: 'table-b' }
    const changed = prepareOfficeTableAlignmentChange(before, target, 'center')

    expect(changed).toEqual({
      ...before,
      tableStyles: [
        before.tableStyles[0],
        { ...(before.tableStyles[1] as Record<string, unknown>), tableAlignment: 'center' },
        'opaque-style-entry',
      ],
    })
    expect(before).toEqual(frozen)
    expect(changed?.tables).toEqual(before.tables)
    expect(changed?.tableColors).toEqual(before.tableColors)
    expect(prepareOfficeTableAlignmentChange(before, target, 'left')).toBeNull()

    expect(prepareOfficeTableAlignmentChange(
      { ...before, tableStyles: [{ tableIndex: 1, fingerprint: 'table-b', future: 'keep' }] },
      target,
      'left',
    )).toBeNull()
    expect(prepareOfficeTableAlignmentChange(
      { ...before, tableStyles: [{ tableIndex: 1, fingerprint: 'table-b', tableAlignment: 'justify' }] },
      target,
      'left',
    )).toBeNull()
    expect(prepareOfficeTableAlignmentChange(
      { tables: before.tables, tableColors: before.tableColors },
      { tableIndex: 2, fingerprint: 'table-c' },
      'left',
    )).toBeNull()

    expect(prepareOfficeTableAlignmentChange(
      { ...before, tableStyles: [{ tableIndex: 1, fingerprint: 'table-b', future: 'keep' }] },
      target,
      'right',
    )?.tableStyles).toEqual([{
      tableIndex: 1,
      fingerprint: 'table-b',
      future: 'keep',
      tableAlignment: 'right',
    }])

    const duplicateTables = [
      { tableIndex: 0, fingerprint: 'duplicate' },
      { tableIndex: 1, fingerprint: 'duplicate' },
    ]
    const firstDuplicate = prepareOfficeTableAlignmentChange(
      { tableStyles: [] },
      duplicateTables[0],
      'center',
      duplicateTables,
    )
    const secondDuplicate = prepareOfficeTableAlignmentChange(
      firstDuplicate!,
      duplicateTables[1],
      'right',
      duplicateTables,
    )
    expect(secondDuplicate?.tableStyles).toEqual([
      { tableIndex: 0, fingerprint: 'duplicate', tableAlignment: 'center' },
      { tableIndex: 1, fingerprint: 'duplicate', tableAlignment: 'right' },
    ])
  })
})

test.describe('[slice 10.R] page alignment value-flow policy', () => {
  test('maps every page value and follows only the old effective value across every required sequence', () => {
    expect(['left', 'center', 'right', 'justify'].map(resolveOfficePageAlignmentFlowValue))
      .toEqual(['left', 'center', 'right', 'center'])

    const run = (
      oldAlignment: 'left' | 'center' | 'right' | 'justify',
      newAlignment: 'left' | 'center' | 'right' | 'justify',
      values: Array<'left' | 'center' | 'right'>,
    ) => planOfficePageAlignmentFlow(oldAlignment, newAlignment, values)

    expect(run('left', 'center', ['left', 'right']).values).toEqual(['center', 'right'])
    expect(run('center', 'right', ['center', 'right']).values).toEqual(['right', 'right'])
    expect(run('right', 'center', ['right', 'right']).values).toEqual(['center', 'center'])
    expect(run('center', 'justify', ['center', 'right'])).toMatchObject({
      oldValue: 'center', newValue: 'center', values: ['center', 'right'], changedIndexes: [],
    })
    expect(run('justify', 'center', ['center', 'left'])).toMatchObject({
      oldValue: 'center', newValue: 'center', values: ['center', 'left'], changedIndexes: [],
    })
    expect(run('left', 'justify', ['left', 'right']).values).toEqual(['center', 'right'])
    expect(run('justify', 'right', ['center', 'left']).values).toEqual(['right', 'left'])
    expect(run('center', 'left', ['center', 'right', 'left']).values)
      .toEqual(['left', 'right', 'left'])
    expect(run('center', 'right', ['center', 'left', 'right']).values)
      .toEqual(['right', 'left', 'right'])
  })

  test('prepares duplicate-aware follower metadata atomically and preserves every unrelated byte', () => {
    const liveTables = [
      { tableIndex: 0, fingerprint: 'duplicate' },
      { tableIndex: 1, fingerprint: 'duplicate' },
      { tableIndex: 2, fingerprint: 'unique-right' },
      { tableIndex: 3, fingerprint: 'invalid-follower' },
      { tableIndex: 4, fingerprint: 'keyless-follower' },
    ]
    const before = {
      pageAlignment: 'left' as const,
      tables: [{ futureLayout: { keep: true } }],
      tableColors: [{ futureColor: ['keep'] }],
      tableStyles: [
        { ...liveTables[0], tableAlignment: 'left', columns: [99], future: { keep: 1 } },
        { ...liveTables[1], tableAlignment: 'right', titleRow: true, future: { keep: 2 } },
        { ...liveTables[2], tableAlignment: 'right', borderWidth: 4 },
        { ...liveTables[3], tableAlignment: 'invalid', tableOverflow: 'newline' },
        'opaque-style',
      ],
    }
    const frozen = structuredClone(before)
    const changed = prepareOfficePageAlignmentFlowChange(before, 'center', liveTables)
    expect(changed).toEqual({
      ...before,
      pageAlignment: 'center',
      tableStyles: [
        { ...before.tableStyles[0] as object, tableAlignment: 'center' },
        before.tableStyles[1],
        before.tableStyles[2],
        before.tableStyles[3],
        'opaque-style',
      ],
    })
    expect(before).toEqual(frozen)
    expect(changed?.tables).toEqual(before.tables)
    expect(changed?.tableColors).toEqual(before.tableColors)

    const noTableChurn = prepareOfficePageAlignmentFlowChange(
      { ...before, pageAlignment: 'center' },
      'justify',
      liveTables,
    )
    expect(noTableChurn).toEqual({ ...before, pageAlignment: 'justify' })
    expect(noTableChurn?.tableStyles).toEqual(before.tableStyles)

    const directDefault = { tables: [], tableColors: [], pageAlignment: 'center' as const }
    expect(prepareOfficeTableAlignmentChange(
      directDefault,
      { tableIndex: 0, fingerprint: 'keyless' },
      'center',
    )).toBeNull()
    expect(prepareOfficeTableAlignmentChange(
      directDefault,
      { tableIndex: 0, fingerprint: 'keyless' },
      'left',
    )?.tableStyles).toEqual([{ tableIndex: 0, fingerprint: 'keyless', tableAlignment: 'left' }])
  })

  test('preserves absent malformed and non-follower raw style collections across page transitions', () => {
    const liveTables = [
      { tableIndex: 0, fingerprint: 'page-derived-a' },
      { tableIndex: 1, fingerprint: 'page-derived-b' },
    ]
    const cases: OfficeTableMetadataSnapshot[] = [
      { tables: [], tableColors: [], pageAlignment: 'left' },
      { tables: [], tableColors: [], tableStyles: 'opaque-scalar', pageAlignment: 'left' },
      {
        tables: [],
        tableColors: [],
        tableStyles: ['opaque-entry', { future: { keep: true } }],
        pageAlignment: 'left',
      },
    ]

    for (const before of cases) {
      const frozen = structuredClone(before)
      const changed = prepareOfficePageAlignmentFlowChange(before, 'center', liveTables)
      expect(changed).toEqual({ ...before, pageAlignment: 'center' })
      expect(Object.hasOwn(changed!, 'tableStyles')).toBe(Object.hasOwn(before, 'tableStyles'))
      expect(changed?.tableStyles).toEqual(before.tableStyles)
      expect(before).toEqual(frozen)

      const sameEffective = prepareOfficePageAlignmentFlowChange(
        { ...before, pageAlignment: 'center' },
        'justify',
        liveTables,
      )
      expect(sameEffective).toEqual({ ...before, pageAlignment: 'justify' })
      expect(Object.hasOwn(sameEffective!, 'tableStyles')).toBe(Object.hasOwn(before, 'tableStyles'))
      expect(sameEffective?.tableStyles).toEqual(before.tableStyles)
    }
  })

  test('nested newer style settlement prevents stale outer page publication', () => {
    const publication = createOfficeDeferredMarkdownPublicationState()
    const before: OfficeTableMetadataSnapshot = {
      tables: [{ exact: 'before-tables' }],
      tableColors: [{ exact: 'before-colors' }],
      tableStyles: [{ exact: 'before-styles' }],
      pageAlignment: 'left',
    }
    const outer: OfficeTableMetadataSnapshot = {
      tables: [{ exact: 'outer-tables' }],
      tableColors: [{ exact: 'outer-colors' }],
      tableStyles: [{ exact: 'outer-styles' }],
      pageAlignment: 'center',
    }
    const newer: OfficeTableMetadataSnapshot = {
      tables: [{ exact: 'newer-tables' }],
      tableColors: [{ exact: 'newer-colors' }],
      tableStyles: [{ exact: 'newer-styles' }],
      pageAlignment: 'right',
    }
    const outerToken = 10_000_000
    const newerToken = outerToken + 1
    let tables: unknown = structuredClone(before.tables)
    let colors: unknown = structuredClone(before.tableColors)
    let styles: unknown = structuredClone(before.tableStyles)
    let pageAlignment = before.pageAlignment
    const pagePublications: string[] = []
    const reports: unknown[] = []
    let nested = false
    let schedulers = 0

    const settle = (
      snapshot: OfficeTableMetadataSnapshot,
      previous: OfficeTableMetadataSnapshot,
      token: number,
    ): boolean => publishOfficeTableMetadataCombinedCallbacks({
      publication,
      snapshot,
      before: previous,
      token,
      publishTables: (next) => { tables = structuredClone(next) },
      publishTableColors: (next) => { colors = structuredClone(next) },
      publishTableStyles: (next) => {
        styles = structuredClone(next)
        if (token === outerToken && !nested) {
          nested = true
          expect(publication.prepare(newerToken)).toBe(true)
          expect(settle(newer, outer, newerToken)).toBe(true)
        }
      },
      publishPageAlignment: (alignment) => {
        pageAlignment = alignment
        pagePublications.push(`${token}:${alignment}`)
      },
      markDirtyAndScheduleSave: () => { schedulers += 1 },
      report: (error) => { reports.push(error) },
    })

    expect(publication.prepare(outerToken)).toBe(true)
    expect(settle(outer, before, outerToken)).toBe(false)
    expect(tables).toEqual(newer.tables)
    expect(colors).toEqual(newer.tableColors)
    expect(styles).toEqual(newer.tableStyles)
    expect(pageAlignment).toBe('right')
    expect(pagePublications).toEqual([`${newerToken}:right`])
    expect(schedulers).toBe(1)
    expect(reports).toEqual([])
    expect(publication.isCurrent(outerToken)).toBe(false)
    expect(publication.isCurrent(newerToken)).toBe(true)
  })

  test('failed page-flow settlement restores snapshot toolbar page and derived table attributes', () => {
    const root = {} as HTMLElement
    const publication = createOfficeDeferredMarkdownPublicationState()
    const liveTables = [
      { tableIndex: 0, fingerprint: 'explicit-left' },
      { tableIndex: 1, fingerprint: 'missing' },
      { tableIndex: 2, fingerprint: 'invalid' },
      { tableIndex: 3, fingerprint: 'keyless' },
    ]
    const before: OfficeTableMetadataSnapshot = {
      tables: [{ exact: 'before-tables' }],
      tableColors: [{ exact: 'before-colors' }],
      tableStyles: [
        { ...liveTables[0], tableAlignment: 'left' },
        { ...liveTables[2], tableAlignment: 'invalid', future: 'keep' },
      ],
      pageAlignment: 'center',
    }
    const after = prepareOfficePageAlignmentFlowChange(before, 'right', liveTables)
    expect(after).not.toBeNull()

    let tables: unknown = structuredClone(before.tables)
    let colors: unknown = structuredClone(before.tableColors)
    let styles: unknown = structuredClone(before.tableStyles)
    let internalPageAlignment = before.pageAlignment!
    let toolbarPageAlignment = before.pageAlignment!
    let renderedAttributes: string[] = []
    let schedulerAttempts = 0
    const reports: unknown[] = []
    const renderTableStyles = () => {
      const entries = Array.isArray(styles) ? styles : []
      renderedAttributes = liveTables.map(({ tableIndex }) => {
        const entry = entries.find((candidate) => (
          candidate && typeof candidate === 'object'
            && (candidate as { tableIndex?: unknown }).tableIndex === tableIndex
        )) as { tableAlignment?: unknown } | undefined
        return entry?.tableAlignment === 'left'
          || entry?.tableAlignment === 'center'
          || entry?.tableAlignment === 'right'
          ? entry.tableAlignment
          : resolveOfficePageAlignmentFlowValue(internalPageAlignment)
      })
    }
    renderTableStyles()
    expect(renderedAttributes).toEqual(['left', 'center', 'center', 'center'])

    const unregister = registerOfficeTableMetadataBindings(root, {
      readTables: () => tables,
      publishTables: (next) => { tables = structuredClone(next) },
      readTableColors: () => colors,
      publishTableColors: (next) => { colors = structuredClone(next) },
      readTableStyles: () => styles,
      publishTableStyles: (next) => {
        styles = structuredClone(next)
        renderTableStyles()
      },
      renderTableStyles,
      readPageAlignment: () => internalPageAlignment,
      publishPageAlignment: (alignment) => { internalPageAlignment = alignment },
      prepareDeferredSnapshot: (token) => publication.prepare(token),
      cancelDeferredSnapshot: (token, document) => publication.cancel(token, document),
      isCurrentSnapshot: (token) => publication.isCurrent(token),
      publishSnapshot: (next, previous, document, token) => (
        publishOfficeTableMetadataCombinedCallbacks({
          publication,
          snapshot: next,
          before: previous,
          document,
          token,
          publishTables: () => {},
          publishTableColors: () => {},
          publishTableStyles: () => {},
          publishPageAlignment: (alignment) => { toolbarPageAlignment = alignment },
          markDirtyAndScheduleSave: () => {
            schedulerAttempts += 1
            throw new Error('rejected page-flow settlement')
          },
          report: (error) => { reports.push(error) },
        })
      ),
    })
    try {
      expect(() => publishOfficeTableMetadataSnapshot(root, after!))
        .toThrow(OfficeTableMetadataPublicationError)
      expect(readOfficeTableMetadataSnapshot(root)).toEqual(before)
      expect(toolbarPageAlignment).toBe('center')
      expect(internalPageAlignment).toBe('center')
      expect(renderedAttributes).toEqual(['left', 'center', 'center', 'center'])
      expect(schedulerAttempts).toBe(1)
      expect(reports).toHaveLength(1)
      expect((reports[0] as Error).message).toBe('rejected page-flow settlement')
    } finally {
      unregister()
    }
  })
})

for (const rawStyles of [
  { label: 'absent', replacement: undefined, expected: undefined },
  { label: 'scalar', replacement: "  tableStyles: 'opaque-scalar'", expected: 'opaque-scalar' },
] as const) {
  test(`[slice 10.R] page flow preserves ${rawStyles.label} tableStyles through history save and reopen`, async ({ page }) => {
    test.setTimeout(240_000)
    const fixture = await resetAlignmentFixture()
    const seededText = replaceAlignmentTableStylesBlock(
      fs.readFileSync(fixture.path, 'utf8'),
      rawStyles.replacement,
    )
    fs.writeFileSync(fixture.path, seededText)
    await installSaveObservation(page)

    const readRawState = () => {
      const parsed = parseDocumentSettings(fs.readFileSync(fixture.path, 'utf8'))
      const metadata = parsed.frontmatter.metadata as Record<string, unknown>
      return {
        alignment: parsed.settings.alignment,
        hasTableStyles: Object.hasOwn(metadata, 'tableStyles'),
        tableStyles: getRawDocumentTableStyles(parsed.frontmatter),
      }
    }
    const expectedRawState = (alignment: 'left' | 'center') => ({
      alignment,
      hasTableStyles: rawStyles.label === 'scalar',
      tableStyles: rawStyles.expected,
    })
    const alignmentButton = (alignment: 'left' | 'center') => (
      page.locator('.rv-office-document-toolbar').getByTitle(`Align ${alignment}`, { exact: true })
    )

    try {
      let editor = await openAlignmentDocument(page)
      let tables = editor.locator('table.rv-office-table')
      await expect(tables).toHaveCount(6)
      await expect.poll(async () => tables.evaluateAll((elements) => elements.map(
        (node) => (node as HTMLTableElement).dataset.rvTableAlignment,
      ))).toEqual(Array(6).fill('left'))
      expect(readRawState()).toEqual(expectedRawState('left'))

      await resetAlignmentObservation(page)
      await alignmentButton('center').click()
      await expect(alignmentButton('center')).toHaveClass(/rv-office-toolbar-btn--active/)
      await expect.poll(async () => tables.evaluateAll((elements) => elements.map(
        (node) => (node as HTMLTableElement).dataset.rvTableAlignment,
      ))).toEqual(Array(6).fill('center'))
      await expectSingleAlignmentSave(page)
      expect(readRawState()).toEqual(expectedRawState('center'))

      await editor.focus()
      await resetAlignmentObservation(page)
      await page.keyboard.press('ControlOrMeta+z')
      await expect(alignmentButton('left')).toHaveClass(/rv-office-toolbar-btn--active/)
      await expectSingleAlignmentSave(page)
      expect(readRawState()).toEqual(expectedRawState('left'))

      await resetAlignmentObservation(page)
      await page.keyboard.press('ControlOrMeta+Shift+z')
      await expect(alignmentButton('center')).toHaveClass(/rv-office-toolbar-btn--active/)
      await expectSingleAlignmentSave(page)
      expect(readRawState()).toEqual(expectedRawState('center'))

      await page.getByTitle('Back', { exact: true }).click()
      editor = await openAlignmentDocument(page)
      tables = editor.locator('table.rv-office-table')
      await expect(tables).toHaveCount(6)
      await expect.poll(async () => tables.evaluateAll((elements) => elements.map(
        (node) => (node as HTMLTableElement).dataset.rvTableAlignment,
      ))).toEqual(Array(6).fill('center'))
      expect(readRawState()).toEqual(expectedRawState('center'))
    } finally {
      await page.close()
      await resetAlignmentFixture()
    }
  })
}

test('[slice 10.R] page alignment atomically flows values with pin rejoin history persistence and zero domain drift', async ({ page }) => {
  test.setTimeout(360_000)
  const fixture = await resetAlignmentFixture()
  const canonicalBytes = fs.readFileSync(fixture.path)
  const seededText = canonicalBytes.toString()
    .replace(
      "  preserveUnknown: 'keep-me'\n",
      [
        "  preserveUnknown: 'keep-me'",
        '  display:',
        '    font: { family: serif, size: 16 }',
        '    alignment: center',
        '    margins: { top: 72, bottom: 72, left: 90, right: 90 }',
        '',
      ].join('\n'),
    )
    .replace(
      "    - { tableIndex: 3, fingerprint: 'fixture-align-3', tableAlignment: 'center' }",
      "    - { tableIndex: 3, fingerprint: 'fixture-align-3', tableOverflow: 'newline', futureStyle: 'keep-missing' }",
    )
    .replace(
      "    - { tableIndex: 4, fingerprint: 'fixture-align-4', tableAlignment: 'right' }",
      "    - { tableIndex: 4, fingerprint: 'fixture-align-4', tableAlignment: 'invalid', borderWidth: 4, futureStyle: 'keep-invalid' }",
    )
  fs.writeFileSync(fixture.path, seededText)
  await installSaveObservation(page)
  await page.setViewportSize({ width: 1450, height: 720 })

  const pageAlignmentButton = (alignment: 'left' | 'center' | 'right' | 'justify') => (
    page.locator('.rv-office-document-toolbar').getByTitle(`Align ${alignment}`, { exact: true })
  )
  const readStyleValues = () => readAlignmentDisk(fixture.path).styles
    .filter((style) => Number.isInteger(style.tableIndex))
    .sort((left, right) => Number(left.tableIndex) - Number(right.tableIndex))
  const clickPageAlignment = async (alignment: 'left' | 'center' | 'right' | 'justify') => {
    await resetAlignmentObservation(page)
    await pageAlignmentButton(alignment).click()
    await expect(pageAlignmentButton(alignment)).toHaveClass(/rv-office-toolbar-btn--active/)
    await expectSingleAlignmentSave(page)
  }

  try {
    let editor = await openAlignmentDocument(page)
    let tables = editor.locator('table.rv-office-table')
    await expect(tables).toHaveCount(6)
    const initialDom = await tables.evaluateAll((elements) => elements.map((node) => {
      const table = node as HTMLTableElement
      return {
        html: table.innerHTML,
        columns: Array.from(table.querySelectorAll<HTMLTableColElement>(':scope > colgroup > col'))
          .map((column) => column.style.width),
      }
    }))
    const initialDisk = readAlignmentDisk(fixture.path)

    await expect.poll(async () => tables.evaluateAll((elements) => (
      elements.map((node) => (node as HTMLTableElement).dataset.rvTableAlignment)
    ))).toEqual(['left', 'center', 'right', 'center', 'center', 'center'])
    await expectNoAlignmentSave(page)
    expect(fs.readFileSync(fixture.path, 'utf8')).toBe(seededText)

    // Missing, invalid, and keyless values use the page-derived effective
    // default, including the direct already-effective no-op path.
    for (const tableIndex of [3, 4, 5]) {
      await resetAlignmentObservation(page)
      await tables.nth(tableIndex).locator('tbody > tr').last().locator('td, th').first()
        .click({ button: 'right' })
      const rootMenu = page.getByRole('menu', { name: 'Table cell actions' })
      await rootMenu.getByRole('menuitem', { name: 'Table', exact: true }).hover()
      const tableMenu = page.getByRole('menu', { name: 'Table', exact: true })
      await expect(tableMenu.getByRole('menuitemradio', { name: 'Align table center', exact: true }))
        .toHaveAttribute('aria-checked', 'true')
      await tableMenu.getByRole('menuitemradio', { name: 'Align table center', exact: true }).click()
      await expectNoAlignmentSave(page)
    }
    expect(fs.readFileSync(fixture.path, 'utf8')).toBe(seededText)

    await clickPageAlignment('left')
    await expect.poll(async () => tables.evaluateAll((elements) => elements.map(
      (node) => (node as HTMLTableElement).dataset.rvTableAlignment,
    ))).toEqual(['left', 'left', 'right', 'left', 'left', 'left'])

    await clickPageAlignment('center')
    await expect.poll(async () => tables.evaluateAll((elements) => elements.map(
      (node) => (node as HTMLTableElement).dataset.rvTableAlignment,
    ))).toEqual(['center', 'center', 'right', 'center', 'center', 'center'])

    await clickPageAlignment('right')
    await expect.poll(async () => tables.evaluateAll((elements) => elements.map(
      (node) => (node as HTMLTableElement).dataset.rvTableAlignment,
    ))).toEqual(['right', 'right', 'right', 'right', 'right', 'right'])

    await clickPageAlignment('center')
    await expect.poll(async () => tables.evaluateAll((elements) => elements.map(
      (node) => (node as HTMLTableElement).dataset.rvTableAlignment,
    ))).toEqual(['center', 'center', 'center', 'center', 'center', 'center'])

    const beforeJustifyStyles = structuredClone(readStyleValues())
    await clickPageAlignment('justify')
    expect(readStyleValues()).toEqual(beforeJustifyStyles)
    await clickPageAlignment('center')
    expect(readStyleValues()).toEqual(beforeJustifyStyles)

    await clickPageAlignment('left')
    await clickPageAlignment('justify')
    await expect.poll(async () => tables.evaluateAll((elements) => elements.map(
      (node) => (node as HTMLTableElement).dataset.rvTableAlignment,
    ))).toEqual(['center', 'center', 'center', 'center', 'center', 'center'])
    await clickPageAlignment('right')
    await expect.poll(async () => tables.evaluateAll((elements) => elements.map(
      (node) => (node as HTMLTableElement).dataset.rvTableAlignment,
    ))).toEqual(['right', 'right', 'right', 'right', 'right', 'right'])

    // Direct alignment pins only its target. Equality with a later page value
    // rejoins the value flow without any persistent pin flag.
    await resetAlignmentObservation(page)
    await chooseTableAlignment(page, tables.nth(0), 'left')
    await expectSingleAlignmentSave(page)
    await clickPageAlignment('center')
    await expect.poll(async () => tables.evaluateAll((elements) => elements.map(
      (node) => (node as HTMLTableElement).dataset.rvTableAlignment,
    ))).toEqual(['left', 'center', 'center', 'center', 'center', 'center'])
    await clickPageAlignment('left')
    await expect.poll(async () => tables.evaluateAll((elements) => elements.map(
      (node) => (node as HTMLTableElement).dataset.rvTableAlignment,
    ))).toEqual(['left', 'left', 'left', 'left', 'left', 'left'])
    await clickPageAlignment('right')
    await expect.poll(async () => tables.evaluateAll((elements) => elements.map(
      (node) => (node as HTMLTableElement).dataset.rvTableAlignment,
    ))).toEqual(['right', 'right', 'right', 'right', 'right', 'right'])

    // One direct action, one ordinary text action, and one page-flow action
    // remain exact adjacent native history units.
    await resetAlignmentObservation(page)
    await chooseTableAlignment(page, tables.nth(0), 'center')
    await expectSingleAlignmentSave(page)
    const paragraph = editor.locator('p').filter({ hasText: 'Before alignment.' }).first()
    await resetAlignmentObservation(page)
    await paragraph.click()
    await page.keyboard.press('End')
    await page.keyboard.type(' page-flow-history')
    await expectSingleTextSave(page)
    await clickPageAlignment('center')

    await resetAlignmentObservation(page)
    await page.getByTitle('Undo', { exact: true }).click()
    await expect(pageAlignmentButton('right')).toHaveClass(/rv-office-toolbar-btn--active/)
    await expect(tables.nth(0)).toHaveAttribute('data-rv-table-alignment', 'center')
    await expect(tables.nth(1)).toHaveAttribute('data-rv-table-alignment', 'right')
    await expect(paragraph).toContainText('page-flow-history')
    await expectSingleAlignmentSave(page)

    await resetAlignmentObservation(page)
    await page.getByTitle('Undo', { exact: true }).click()
    await expect(paragraph).toHaveText('Before alignment.')
    await expectSingleTextSave(page)

    await resetAlignmentObservation(page)
    await page.getByTitle('Undo', { exact: true }).click()
    await expect(tables.nth(0)).toHaveAttribute('data-rv-table-alignment', 'right')
    await expectSingleAlignmentSave(page)

    await resetAlignmentObservation(page)
    await page.getByTitle('Redo', { exact: true }).click()
    await expect(tables.nth(0)).toHaveAttribute('data-rv-table-alignment', 'center')
    await expectSingleAlignmentSave(page)
    await resetAlignmentObservation(page)
    await page.getByTitle('Redo', { exact: true }).click()
    await expect(paragraph).toContainText('page-flow-history')
    await expectSingleTextSave(page)
    await resetAlignmentObservation(page)
    await page.getByTitle('Redo', { exact: true }).click()
    await expect(pageAlignmentButton('center')).toHaveClass(/rv-office-toolbar-btn--active/)
    await expect(tables.nth(1)).toHaveAttribute('data-rv-table-alignment', 'center')
    await expectSingleAlignmentSave(page)

    const finalDisk = readAlignmentDisk(fixture.path)
    expect(finalDisk.metadata.tables).toEqual(initialDisk.metadata.tables)
    expect(finalDisk.metadata.tableColors).toEqual(initialDisk.metadata.tableColors)
    expect(finalDisk.metadata.preserveUnknown).toBe('keep-me')
    expect((finalDisk.metadata.display as { alignment?: string }).alignment).toBe('center')
    expect(finalDisk.body).toContain('Before alignment.')
    expect(finalDisk.body).toContain('page-flow-history')
    expect(readStyleValues().map((style) => style.tableAlignment))
      .toEqual(['center', 'center', 'center', undefined, 'invalid'])

    const finalDom = await tables.evaluateAll((elements) => elements.map((node) => {
      const table = node as HTMLTableElement
      return {
        html: table.innerHTML,
        columns: Array.from(table.querySelectorAll<HTMLTableColElement>(':scope > colgroup > col'))
          .map((column) => column.style.width),
      }
    }))
    expect(finalDom).toEqual(initialDom)

    await page.getByTitle('Back', { exact: true }).click()
    editor = await openAlignmentDocument(page)
    tables = editor.locator('table.rv-office-table')
    await expect(pageAlignmentButton('center')).toHaveClass(/rv-office-toolbar-btn--active/)
    await expect.poll(async () => tables.evaluateAll((elements) => elements.map(
      (node) => (node as HTMLTableElement).dataset.rvTableAlignment,
    ))).toEqual(['center', 'center', 'center', 'center', 'center', 'center'])
    expect((readAlignmentDisk(fixture.path).metadata.display as { alignment?: string }).alignment)
      .toBe('center')
  } finally {
    await page.close()
    fs.writeFileSync(fixture.path, canonicalBytes)
    await resetAlignmentFixture()
  }
})

test.describe('[slice 10.3] alignment-aware resize planning', () => {
  test('keeps exact anchored rectangles guides zoom conversion and square clamps', () => {
    const columns = [160, 160]
    const minimum = 40

    for (const scale of [0.8, 1.25]) {
      for (const alignment of ['left', 'center', 'right'] as const) {
        const tableRect = { left: 100, right: 100 + 320 * scale }
        const internal = planOfficeTableResize({
          columns,
          boundary: { kind: 'internal', index: 1 },
          startClientX: 0,
          clientX: 20 * scale,
          scale,
          minimum,
          tableRect,
        })
        expect(internal).toEqual(expect.objectContaining({
          columns: [180, 140],
          effectiveDelta: 20,
          tableWidth: 320,
          previewRect: tableRect,
          guideRect: {
            left: tableRect.left + 180 * scale,
            right: tableRect.left + 180 * scale,
          },
        }))

        for (const boundary of ['left-outer', 'right-outer'] as const) {
          const outwardClientDelta = boundary === 'left-outer' ? -20 * scale : 20 * scale
          const outward = planOfficeTableResize({
            columns,
            boundary: { kind: boundary },
            alignment,
            startClientX: 0,
            clientX: outwardClientDelta,
            scale,
            minimum,
            tableRect,
          })
          expect(outward).not.toBeNull()
          const q = 20 * scale
          const expectedRect = alignment === 'left'
            ? { left: tableRect.left, right: tableRect.right + q }
            : alignment === 'right'
              ? { left: tableRect.left - q, right: tableRect.right }
              : { left: tableRect.left - q / 2, right: tableRect.right + q / 2 }
          expect(outward).toEqual(expect.objectContaining({
            columns: boundary === 'left-outer' ? [180, 160] : [160, 180],
            effectiveDelta: 20,
            tableWidth: 340,
            previewRect: expectedRect,
            guideRect: boundary === 'left-outer'
              ? { left: expectedRect.left, right: expectedRect.left }
              : { left: expectedRect.right, right: expectedRect.right },
          }))

          const inwardClientDelta = boundary === 'left-outer' ? 10_000 : -10_000
          const clamped = planOfficeTableResize({
            columns,
            boundary: { kind: boundary },
            alignment,
            startClientX: 0,
            clientX: inwardClientDelta,
            scale,
            minimum,
            tableRect,
          })
          expect(clamped).not.toBeNull()
          const clampDelta = minimum - 160
          const clampQ = clampDelta * scale
          const clampedRect = alignment === 'left'
            ? { left: tableRect.left, right: tableRect.right + clampQ }
            : alignment === 'right'
              ? { left: tableRect.left - clampQ, right: tableRect.right }
              : {
                left: tableRect.left - clampQ / 2,
                right: tableRect.right + clampQ / 2,
              }
          expect(clamped).toEqual(expect.objectContaining({
            columns: boundary === 'left-outer' ? [minimum, 160] : [160, minimum],
            effectiveDelta: clampDelta,
            tableWidth: minimum + 160,
            previewRect: clampedRect,
            guideRect: boundary === 'left-outer'
              ? { left: clampedRect.left, right: clampedRect.left }
              : { left: clampedRect.right, right: clampedRect.right },
          }))
        }
      }
    }
  })

  test('isolates duplicate fingerprints while preserving unique stale-index fallback', () => {
    const duplicates = [
      { tableIndex: 0, fingerprint: 'same-header' },
      { tableIndex: 1, fingerprint: 'same-header' },
    ]
    const before = {
      tables: [],
      tableColors: [{ tableIndex: 1, fingerprint: 'same-header', cells: { '1,1': '#123456' } }],
      tableStyles: [{ tableIndex: 0, fingerprint: 'same-header', tableAlignment: 'center' }],
    }
    const first = prepareOfficeTableResizeSnapshot(before, duplicates[0], [180, 140], duplicates)
    const second = prepareOfficeTableResizeSnapshot(first!, duplicates[1], [130, 190], duplicates)
    expect(second).toEqual({
      tables: [
        { tableIndex: 0, fingerprint: 'same-header', columns: [180, 140] },
        { tableIndex: 1, fingerprint: 'same-header', columns: [130, 190] },
      ],
      tableColors: before.tableColors,
      tableStyles: before.tableStyles,
    })
    expect(before.tables).toEqual([])

    const unique = prepareOfficeTableResizeSnapshot(
      {
        tables: [{
          tableIndex: 7,
          fingerprint: 'unique-header',
          columns: [100, 100],
          future: 'keep',
        }],
        tableColors: before.tableColors,
      },
      { tableIndex: 2, fingerprint: 'unique-header' },
      [120, 80],
      [{ tableIndex: 2, fingerprint: 'unique-header' }],
    )
    expect(unique?.tables).toEqual([{
      tableIndex: 2,
      fingerprint: 'unique-header',
      columns: [120, 80],
      future: 'keep',
    }])
  })

})

test('[slice 10.1] seeded tables use wrapper-relative chrome placement without open writes or content drift', async ({ page }) => {
  const fixture = await resetAlignmentFixture()
  const bytesBefore = fs.readFileSync(fixture.path)
  const mtimeBefore = fs.statSync(fixture.path).mtimeMs
  await installSaveObservation(page)
  await page.setViewportSize({ width: 1450, height: 720 })

  try {
    const editor = await openAlignmentDocument(page)
    const tables = editor.locator('table.rv-office-table')
    await expect(tables).toHaveCount(6)
    await expect.poll(() => tables.evaluateAll((nodes) => (
      nodes.map((node) => (node as HTMLTableElement).dataset.rvTableAlignment)
    ))).toEqual(['left', 'center', 'right', 'center', 'right', 'left'])

    const evidence = await tables.evaluateAll((nodes) => nodes.map((node) => {
      const table = node as HTMLTableElement
      const wrapper = table.parentElement as HTMLElement
      const tableRect = table.getBoundingClientRect()
      const wrapperRect = wrapper.getBoundingClientRect()
      const style = getComputedStyle(table)
      const contentLeft = wrapperRect.left + wrapper.clientLeft
      return {
        alignment: table.dataset.rvTableAlignment,
        cells: Array.from(table.rows).flatMap((row) => (
          Array.from(row.cells).map((cell) => cell.textContent?.trim() ?? '')
        )),
        columnStyleWidths: Array.from(
          table.querySelectorAll<HTMLTableColElement>(':scope > colgroup > col'),
        ).map((column) => column.style.width),
        columnUsedWidths: Array.from(
          table.querySelectorAll<HTMLTableColElement>(':scope > colgroup > col'),
        ).map((column) => column.getBoundingClientRect().width),
        descendantAlignmentAttributes: table.querySelectorAll(
          ':is(th, td, tr)[data-rv-table-alignment]',
        ).length,
        descendantMarginWrites: Array.from(table.querySelectorAll<HTMLElement>('th, td, tr'))
          .filter((element) => (
            element.style.marginInlineStart || element.style.marginInlineEnd
          )).length,
        marginInlineEnd: Number.parseFloat(style.marginInlineEnd),
        marginInlineStart: Number.parseFloat(style.marginInlineStart),
        offsetWidth: table.offsetWidth,
        scrollLeft: wrapper.scrollLeft,
        scrollWidth: wrapper.scrollWidth,
        tableLeft: tableRect.left,
        tableRight: tableRect.right,
        textAlign: Array.from(table.querySelectorAll<HTMLElement>('th, td'))
          .map((cell) => getComputedStyle(cell).textAlign),
        wrapperClientWidth: wrapper.clientWidth,
        wrapperLeft: contentLeft,
        wrapperRight: contentLeft + wrapper.clientWidth,
      }
    }))

    expect(evidence.map(({ alignment }) => alignment))
      .toEqual(['left', 'center', 'right', 'center', 'right', 'left'])
    expect(evidence.map(({ offsetWidth }) => offsetWidth)).toEqual([320, 320, 320, 636, 840, 320])
    expect(evidence.map(({ columnStyleWidths }) => columnStyleWidths)).toEqual([
      ['160px', '160px'],
      ['160px', '160px'],
      ['160px', '160px'],
      ['318px', '318px'],
      ['420px', '420px'],
      ['160px', '160px'],
    ])
    for (const [index, tableEvidence] of evidence.entries()) {
      const expectedColumnWidth = [160, 160, 160, 318, 420, 160][index]
      for (const usedWidth of tableEvidence.columnUsedWidths) {
        expect(usedWidth).toBeCloseTo(expectedColumnWidth, 1)
      }
      expect(new Set(tableEvidence.textAlign)).toEqual(new Set(['left']))
      expect(tableEvidence.descendantAlignmentAttributes).toBe(0)
      expect(tableEvidence.descendantMarginWrites).toBe(0)
    }
    expect(evidence.map(({ cells }) => cells)).toEqual([
      ['align-left-h0', 'align-left-h1', 'align-left-r1c0', 'align-left-r1c1'],
      ['align-center-h0', 'align-center-h1', 'align-center-r1c0', 'align-center-r1c1'],
      ['align-right-h0', 'align-right-h1', 'align-right-r1c0', 'align-right-r1c1'],
      [
        'align-wrapper-width-h0',
        'align-wrapper-width-h1',
        'align-wrapper-width-r1c0',
        'align-wrapper-width-r1c1',
      ],
      [
        'align-oversized-h0',
        'align-oversized-h1',
        'align-oversized-r1c0',
        'align-oversized-r1c1',
      ],
      ['align-keyless-h0', 'align-keyless-h1', 'align-keyless-r1c0', 'align-keyless-r1c1'],
    ])

    const wrapperWidth = evidence[0].wrapperClientWidth
    expect(wrapperWidth).toBe(636)
    expect(evidence.every(({ wrapperClientWidth }) => wrapperClientWidth === wrapperWidth)).toBe(true)
    const freeSpace = wrapperWidth - 320
    expect(evidence[0].tableLeft).toBeCloseTo(evidence[0].wrapperLeft, 1)
    expect(evidence[0].marginInlineStart).toBeCloseTo(0, 1)
    expect(evidence[0].marginInlineEnd).toBeCloseTo(freeSpace, 1)
    expect(evidence[1].tableLeft).toBeCloseTo(evidence[1].wrapperLeft + freeSpace / 2, 1)
    expect(evidence[1].marginInlineStart).toBeCloseTo(freeSpace / 2, 1)
    expect(evidence[1].marginInlineEnd).toBeCloseTo(freeSpace / 2, 1)
    expect(evidence[2].tableRight).toBeCloseTo(evidence[2].wrapperRight, 1)
    expect(evidence[2].marginInlineStart).toBeCloseTo(freeSpace, 1)
    expect(evidence[2].marginInlineEnd).toBeCloseTo(0, 1)
    expect(evidence[3].tableLeft).toBeCloseTo(evidence[3].wrapperLeft, 1)
    expect(evidence[3].tableRight).toBeCloseTo(evidence[3].wrapperRight, 1)
    expect(evidence[3].marginInlineStart).toBeCloseTo(0, 1)
    expect(evidence[3].marginInlineEnd).toBeCloseTo(0, 1)
    expect(evidence[5].tableLeft).toBeCloseTo(evidence[5].wrapperLeft, 1)

    const oversized = evidence[4]
    expect(oversized.scrollLeft).toBe(0)
    expect(oversized.scrollWidth).toBe(840)
    expect(oversized.tableLeft).toBeCloseTo(oversized.wrapperLeft, 1)
    expect(oversized.marginInlineStart).toBeCloseTo(0, 1)
    expect(oversized.marginInlineEnd).toBeCloseTo(0, 1)
    const oversizedAtEnd = await tables.nth(4).evaluate((node) => {
      const table = node as HTMLTableElement
      const wrapper = table.parentElement as HTMLElement
      wrapper.scrollLeft = wrapper.scrollWidth - wrapper.clientWidth
      const tableRect = table.getBoundingClientRect()
      const wrapperRect = wrapper.getBoundingClientRect()
      return {
        maximumScroll: wrapper.scrollWidth - wrapper.clientWidth,
        scrollLeft: wrapper.scrollLeft,
        tableRight: tableRect.right,
        wrapperRight: wrapperRect.left + wrapper.clientLeft + wrapper.clientWidth,
      }
    })
    expect(oversizedAtEnd.maximumScroll).toBe(204)
    expect(oversizedAtEnd.scrollLeft).toBe(oversizedAtEnd.maximumScroll)
    expect(Math.abs(oversizedAtEnd.tableRight - oversizedAtEnd.wrapperRight))
      .toBeLessThanOrEqual(1)

    await page.waitForTimeout(900)
    expect(await page.evaluate(() => (
      (window as typeof window & { __alignmentSaveCount?: number }).__alignmentSaveCount ?? 0
    ))).toBe(0)
    expect(fs.readFileSync(fixture.path)).toEqual(bytesBefore)
    expect(fs.statSync(fixture.path).mtimeMs).toBe(mtimeBefore)
  } finally {
    await page.close()
    await resetOfficePlaywrightScenario({ scenario: 'alignment', copies: 1, workspaces: 1 })
  }
})

test('[slice 10.2] alignment radio group isolates targets with exact history persistence and stale-target failure', async ({ page }) => {
  test.setTimeout(300_000)
  const fixture = await resetAlignmentFixture()
  const canonicalBytes = fs.readFileSync(fixture.path)
  const seededText = canonicalBytes.toString()
    .replace(
      "  tableStyles:\n",
      "  tableColors:\n    - { tableIndex: 1, fingerprint: 'fixture-align-1', cells: { '1,1': '#123456' }, futureColor: 'keep-color' }\n  tableStyles:\n",
    )
    .replace(
      "    - { tableIndex: 0, fingerprint: 'fixture-align-0', tableAlignment: 'left' }",
      "    - { tableIndex: 0, fingerprint: 'fixture-align-0', tableAlignment: 'left', tableOverflow: 'newline', borderWidth: 3, borderColor: '#abcdef', futureStyle: 'keep-left' }",
    )
    .replace(
      "    - { tableIndex: 1, fingerprint: 'fixture-align-1', tableAlignment: 'center' }",
      "    - { tableIndex: 1, fingerprint: 'fixture-align-1', tableAlignment: 'center', tableOverflow: 'overflow', futureStyle: 'keep-center' }",
    )
    .replace(
      "    - { tableIndex: 2, fingerprint: 'fixture-align-2', tableAlignment: 'right' }",
      "    - { tableIndex: 2, fingerprint: 'fixture-align-2', tableAlignment: 'right', tableOverflow: 'overflow' }",
    )
    .replace(
      "    - { tableIndex: 3, fingerprint: 'fixture-align-3', tableAlignment: 'center' }",
      "    - { tableIndex: 3, fingerprint: 'fixture-align-3', tableOverflow: 'overflow' }",
    )
    .replace(
      "    - { tableIndex: 4, fingerprint: 'fixture-align-4', tableAlignment: 'right' }",
      "    - { tableIndex: 4, fingerprint: 'fixture-align-4', tableAlignment: 'justify', tableOverflow: 'overflow' }",
    )
  expect(seededText).not.toBe(canonicalBytes.toString())
  fs.writeFileSync(fixture.path, seededText)
  await installSaveObservation(page)
  await page.setViewportSize({ width: 1450, height: 720 })

  const rootMenu = page.getByRole('menu', { name: 'Table cell actions' })
  const tableMenu = page.getByRole('menu', { name: 'Table', exact: true })
  const alignmentChoice = (value: 'left' | 'center' | 'right') => tableMenu.getByRole(
    'menuitemradio',
    { name: `Align table ${value}`, exact: true },
  )
  const openTableMenu = async (
    tables: ReturnType<Page['locator']>,
    tableIndex: number,
    keyboard = false,
  ) => {
    await tables.nth(tableIndex).locator('tbody > tr').last().locator('td, th').first()
      .click({ button: 'right' })
    await expect(rootMenu).toBeVisible()
    const trigger = rootMenu.getByRole('menuitem', { name: 'Table', exact: true })
    if (keyboard) await page.keyboard.press('ArrowRight')
    else await trigger.hover()
    await expect(tableMenu).toBeVisible()
  }
  const chooseAlignment = async (
    tables: ReturnType<Page['locator']>,
    tableIndex: number,
    value: 'left' | 'center' | 'right',
    keyboard = false,
  ) => {
    await openTableMenu(tables, tableIndex, keyboard)
    const choice = alignmentChoice(value)
    if (keyboard) {
      await choice.focus()
      await page.keyboard.press('Enter')
    } else {
      await choice.click()
    }
    await expect(rootMenu).toHaveCount(0)
  }
  const tableEvidence = (table: ReturnType<Page['locator']>) => table.evaluate((node) => {
    const element = node as HTMLTableElement
    const wrapper = element.parentElement as HTMLElement
    const tableRect = element.getBoundingClientRect()
    const wrapperRect = wrapper.getBoundingClientRect()
    const wrapperLeft = wrapperRect.left + wrapper.clientLeft
    return {
      alignment: element.dataset.rvTableAlignment,
      cells: Array.from(element.querySelectorAll<HTMLElement>('th, td'))
        .map((cell) => cell.textContent?.trim() ?? ''),
      columnWidths: Array.from(element.querySelectorAll<HTMLTableColElement>(':scope > colgroup > col'))
        .map((column) => column.style.width),
      offsetWidth: element.offsetWidth,
      tableLeft: tableRect.left,
      tableRight: tableRect.right,
      textAlign: Array.from(element.querySelectorAll<HTMLElement>('th, td'))
        .map((cell) => getComputedStyle(cell).textAlign),
      wrapperLeft,
      wrapperRight: wrapperLeft + wrapper.clientWidth,
      wrapperWidth: wrapper.clientWidth,
    }
  })

  try {
    let editor = await openAlignmentDocument(page)
    let tables = editor.locator('table.rv-office-table')
    await expect(tables).toHaveCount(6)
    const initialEvidence = await Promise.all(Array.from({ length: 6 }, (_, index) => (
      tableEvidence(tables.nth(index))
    )))
    const initialDisk = readAlignmentDisk(fixture.path)

    await resetAlignmentObservation(page)
    await openTableMenu(tables, 0)
    const tableItems = tableMenu.locator(':scope > [role="menuitem"], :scope > [role="menuitemradio"]')
    await expect(tableItems).toHaveCount(8)
    await expect(tableMenu.locator(':scope > [role="separator"]')).toHaveCount(4)
    await expect(tableItems).toHaveText([
      'variable_addAdd title row',
      'border_allBorder size3pxchevron_right',
      'border_allBorder color#abcdef',
      'align_horizontal_leftAlign table leftcheck',
      'align_horizontal_centerAlign table center',
      'align_horizontal_rightAlign table right',
      'format_text_overflowOverflowNew linechevron_right',
      'deleteRemove table',
    ])
    await expect(alignmentChoice('left')).toHaveAttribute('aria-checked', 'true')
    await expect(alignmentChoice('center')).toHaveAttribute('aria-checked', 'false')
    await expect(alignmentChoice('right')).toHaveAttribute('aria-checked', 'false')
    await expect(alignmentChoice('left').locator('.material-symbols-outlined').first())
      .toHaveText('align_horizontal_left')
    await expect(alignmentChoice('center').locator('.material-symbols-outlined').first())
      .toHaveText('align_horizontal_center')
    await expect(alignmentChoice('right').locator('.material-symbols-outlined').first())
      .toHaveText('align_horizontal_right')
    await alignmentChoice('left').click()
    await expectNoAlignmentSave(page)
    expect(fs.readFileSync(fixture.path, 'utf8')).toBe(seededText)

    for (const tableIndex of [3, 4, 5]) {
      const beforeEffectiveLeft = fs.readFileSync(fixture.path)
      await resetAlignmentObservation(page)
      await openTableMenu(tables, tableIndex)
      await expect(alignmentChoice('left')).toHaveAttribute('aria-checked', 'true')
      await alignmentChoice('left').click()
      await expectNoAlignmentSave(page)
      expect(fs.readFileSync(fixture.path)).toEqual(beforeEffectiveLeft)
    }
    let disk = readAlignmentDisk(fixture.path)
    expect(disk.styles.find((style) => style.tableIndex === 3)).toEqual({
      tableIndex: 3,
      fingerprint: 'fixture-align-3',
      tableOverflow: 'overflow',
    })
    expect(disk.styles.find((style) => style.tableIndex === 4)).toEqual({
      tableIndex: 4,
      fingerprint: 'fixture-align-4',
      tableAlignment: 'justify',
      tableOverflow: 'overflow',
    })
    expect(disk.styles.find((style) => style.tableIndex === 5)).toBeUndefined()

    await resetAlignmentObservation(page)
    await chooseAlignment(tables, 0, 'center')
    await expect(tables.nth(0)).toHaveAttribute('data-rv-table-alignment', 'center')
    await expectSingleAlignmentSave(page)
    const centered = await tableEvidence(tables.nth(0))
    expect(centered.tableLeft).toBeCloseTo(
      centered.wrapperLeft + (centered.wrapperWidth - centered.offsetWidth) / 2,
      1,
    )
    disk = readAlignmentDisk(fixture.path)
    expect(disk.styles.find((style) => style.tableIndex === 0)).toEqual({
      tableIndex: 0,
      fingerprint: 'fixture-align-0',
      tableAlignment: 'center',
      tableOverflow: 'newline',
      borderWidth: 3,
      borderColor: '#abcdef',
      futureStyle: 'keep-left',
    })
    expect(disk.styles.find((style) => style.tableIndex === 1))
      .toEqual(initialDisk.styles.find((style) => style.tableIndex === 1))

    await resetAlignmentObservation(page)
    await openTableMenu(tables, 1, true)
    await expect(alignmentChoice('center')).toHaveAttribute('aria-checked', 'true')
    await alignmentChoice('right').focus()
    await page.keyboard.press('Enter')
    await expect(tables.nth(1)).toHaveAttribute('data-rv-table-alignment', 'right')
    await expectSingleAlignmentSave(page)
    const rightAligned = await tableEvidence(tables.nth(1))
    expect(rightAligned.tableRight).toBeCloseTo(rightAligned.wrapperRight, 1)
    disk = readAlignmentDisk(fixture.path)
    expect(disk.styles.find((style) => style.tableIndex === 1)).toEqual({
      tableIndex: 1,
      fingerprint: 'fixture-align-1',
      tableAlignment: 'right',
      tableOverflow: 'overflow',
      futureStyle: 'keep-center',
    })
    expect(disk.styles.find((style) => style.tableIndex === 0)?.tableAlignment).toBe('center')
    expect(disk.metadata.tableColors).toEqual([{
      tableIndex: 1,
      fingerprint: 'fixture-align-1',
      cells: { '1,1': '#123456' },
      futureColor: 'keep-color',
    }])
    expect(disk.metadata.tables).toEqual(initialDisk.metadata.tables)
    expect(disk.metadata.preserveUnknown).toBe('keep-me')

    const paragraph = editor.locator('p').filter({ hasText: 'Before alignment.' }).first()
    await resetAlignmentObservation(page)
    await paragraph.click()
    await page.keyboard.press('End')
    await page.keyboard.type(' history-unit')
    await expectSingleTextSave(page)
    expect(readAlignmentDisk(fixture.path).body).toContain('Before alignment. history-unit')

    await resetAlignmentObservation(page)
    await page.keyboard.press('ControlOrMeta+z')
    await expect(paragraph).toHaveText('Before alignment.')
    await expect(tables.nth(1)).toHaveAttribute('data-rv-table-alignment', 'right')
    await expectSingleTextSave(page)

    await resetAlignmentObservation(page)
    await page.keyboard.press('ControlOrMeta+z')
    await expect(tables.nth(1)).toHaveAttribute('data-rv-table-alignment', 'center')
    await expect(tables.nth(0)).toHaveAttribute('data-rv-table-alignment', 'center')
    await expectSingleAlignmentSave(page)

    await resetAlignmentObservation(page)
    await page.keyboard.press('ControlOrMeta+Shift+z')
    await expect(tables.nth(1)).toHaveAttribute('data-rv-table-alignment', 'right')
    await expectSingleAlignmentSave(page)

    await resetAlignmentObservation(page)
    await page.keyboard.press('ControlOrMeta+Shift+z')
    await expect(paragraph).toContainText('Before alignment. history-unit')
    await expectSingleTextSave(page)

    const beforeStale = fs.readFileSync(fixture.path)
    await resetAlignmentObservation(page)
    await openTableMenu(tables, 2)
    await alignmentChoice('left').evaluate((choice) => {
      const table = document.querySelectorAll<HTMLTableElement>('table.rv-office-table')[2]
      const cell = table?.rows.item(0)?.cells.item(0)
      if (!cell) throw new Error('stale-target probe cell is unavailable')
      const text = cell.textContent
      cell.textContent = `${text}-identity-shift`
      ;(choice as HTMLButtonElement).click()
      cell.textContent = text
    })
    await expectNoAlignmentSave(page)
    expect(fs.readFileSync(fixture.path)).toEqual(beforeStale)
    await page.keyboard.press('Escape')
    await expect(editor).toBeFocused()

    for (const [index, before] of initialEvidence.entries()) {
      const after = await tableEvidence(tables.nth(index))
      expect(after.columnWidths).toEqual(before.columnWidths)
      expect(after.offsetWidth).toBe(before.offsetWidth)
      expect(after.cells).toEqual(before.cells)
      expect(after.textAlign).toEqual(before.textAlign)
    }

    await page.getByTitle('Back', { exact: true }).click()
    editor = await openAlignmentDocument(page)
    tables = editor.locator('table.rv-office-table')
    await expect(tables.nth(0)).toHaveAttribute('data-rv-table-alignment', 'center')
    await expect(tables.nth(1)).toHaveAttribute('data-rv-table-alignment', 'right')
    await expect(tables.nth(3)).toHaveAttribute('data-rv-table-alignment', 'left')
    await expect(tables.nth(4)).toHaveAttribute('data-rv-table-alignment', 'left')
    await expect(tables.nth(5)).toHaveAttribute('data-rv-table-alignment', 'left')
    await expect(editor.locator('p').filter({ hasText: 'Before alignment. history-unit' }))
      .toHaveCount(1)
    await openTableMenu(tables, 1)
    await expect(alignmentChoice('right')).toHaveAttribute('aria-checked', 'true')
    await page.keyboard.press('Escape')
    disk = readAlignmentDisk(fixture.path)
    expect(disk.styles.find((style) => style.tableIndex === 0)?.tableAlignment).toBe('center')
    expect(disk.styles.find((style) => style.tableIndex === 1)?.tableAlignment).toBe('right')
    expect(disk.styles.find((style) => style.tableIndex === 3)?.tableAlignment).toBeUndefined()
    expect(disk.styles.find((style) => style.tableIndex === 4)?.tableAlignment).toBe('justify')
    expect(disk.styles.find((style) => style.tableIndex === 5)).toBeUndefined()
  } finally {
    await page.close()
    fs.writeFileSync(fixture.path, canonicalBytes)
    await resetAlignmentFixture()
  }
})

test('[slice 10.2] duplicate-header tables retain independent alignment entries and placement', async ({ page }) => {
  test.setTimeout(180_000)
  const fixture = await resetDuplicateAlignmentFixture()
  const initialDisk = readAlignmentDisk(fixture.path)
  await installSaveObservation(page)
  await page.setViewportSize({ width: 1450, height: 720 })

  const rootMenu = page.getByRole('menu', { name: 'Table cell actions' })
  const tableMenu = page.getByRole('menu', { name: 'Table', exact: true })
  const chooseAlignment = async (
    tables: ReturnType<Page['locator']>,
    tableIndex: number,
    value: 'center' | 'right',
  ) => {
    await tables.nth(tableIndex).locator('tbody > tr').last().locator('td, th').first()
      .click({ button: 'right' })
    await expect(rootMenu).toBeVisible()
    await rootMenu.getByRole('menuitem', { name: 'Table', exact: true }).hover()
    await expect(tableMenu).toBeVisible()
    await tableMenu.getByRole('menuitemradio', {
      name: `Align table ${value}`,
      exact: true,
    }).click()
    await expect(rootMenu).toHaveCount(0)
  }

  try {
    let editor = await openAlignmentDocument(page, DUPLICATE_ALIGNMENT_FILENAME)
    let tables = editor.locator('table.rv-office-table')
    await expect(tables).toHaveCount(2)
    await expect(tables.locator('thead, tbody').first()).toBeVisible()
    expect(await tables.evaluateAll((nodes) => nodes.map((node) => (
      Array.from((node as HTMLTableElement).rows.item(0)?.cells ?? [])
        .map((cell) => cell.textContent?.trim())
    )))).toEqual([
      ['duplicate-header-h0', 'duplicate-header-h1', 'duplicate-header-h2'],
      ['duplicate-header-h0', 'duplicate-header-h1', 'duplicate-header-h2'],
    ])
    await expect(tables.nth(0)).toHaveAttribute('data-rv-table-alignment', 'left')
    await expect(tables.nth(1)).toHaveAttribute('data-rv-table-alignment', 'left')

    await resetAlignmentObservation(page)
    await chooseAlignment(tables, 0, 'center')
    await expect(tables.nth(0)).toHaveAttribute('data-rv-table-alignment', 'center')
    await expect(tables.nth(1)).toHaveAttribute('data-rv-table-alignment', 'left')
    await expectSingleAlignmentSave(page)

    await resetAlignmentObservation(page)
    await chooseAlignment(tables, 1, 'right')
    await expect(tables.nth(0)).toHaveAttribute('data-rv-table-alignment', 'center')
    await expect(tables.nth(1)).toHaveAttribute('data-rv-table-alignment', 'right')
    await expectSingleAlignmentSave(page)

    let disk = readAlignmentDisk(fixture.path)
    const duplicateStyles = disk.styles.filter(({ tableIndex }) => (
      tableIndex === 0 || tableIndex === 1
    ))
    expect(duplicateStyles).toHaveLength(2)
    expect(duplicateStyles.map(({ tableIndex, tableAlignment }) => ({
      tableIndex,
      tableAlignment,
    }))).toEqual([
      { tableIndex: 0, tableAlignment: 'center' },
      { tableIndex: 1, tableAlignment: 'right' },
    ])
    expect(duplicateStyles[0].fingerprint).toBe(duplicateStyles[1].fingerprint)
    expect(disk.metadata.tables).toEqual(initialDisk.metadata.tables)
    expect(disk.metadata.tableColors).toEqual(initialDisk.metadata.tableColors)

    await page.getByTitle('Back', { exact: true }).click()
    editor = await openAlignmentDocument(page, DUPLICATE_ALIGNMENT_FILENAME)
    tables = editor.locator('table.rv-office-table')
    await expect(tables.nth(0)).toHaveAttribute('data-rv-table-alignment', 'center')
    await expect(tables.nth(1)).toHaveAttribute('data-rv-table-alignment', 'right')
    disk = readAlignmentDisk(fixture.path)
    expect(disk.styles.filter(({ tableIndex }) => tableIndex === 0 || tableIndex === 1))
      .toEqual(duplicateStyles)
  } finally {
    await page.close()
    await resetDuplicateAlignmentFixture()
  }
})

test('[slice 10.3] duplicate-header resizes stay target-only through history save and reopen', async ({ page }) => {
  test.setTimeout(240_000)
  const fixture = await resetDuplicateAlignmentFixture()
  const initialDisk = readAlignmentDisk(fixture.path)
  await installSaveObservation(page)
  await page.setViewportSize({ width: 1450, height: 720 })

  try {
    let editor = await openAlignmentDocument(page, DUPLICATE_ALIGNMENT_FILENAME)
    let tables = editor.locator('table.rv-office-table')
    await expect(tables).toHaveCount(2)
    await page.locator('.rv-office-document-editor').evaluate((element) => {
      ;(element as HTMLElement).style.setProperty('--editor-zoom', '1')
    })
    const initial = await Promise.all([
      readAlignmentGeometry(tables.nth(0)),
      readAlignmentGeometry(tables.nth(1)),
    ])
    const firstColumns = [...initial[0].columns]
    firstColumns[0] += 20
    firstColumns[1] -= 20
    await previewAndCommitAlignmentResize(page, tables.nth(0), 1, 20, firstColumns)
    expect((await readAlignmentGeometry(tables.nth(0))).columns).toEqual(firstColumns)
    expect((await readAlignmentGeometry(tables.nth(1))).columns).toEqual(initial[1].columns)

    let disk = readAlignmentDisk(fixture.path)
    let layouts = disk.metadata.tables as Array<Record<string, unknown>>
    expect(layouts).toHaveLength(1)
    expect(layouts[0]).toEqual(expect.objectContaining({ tableIndex: 0, columns: firstColumns }))

    const secondColumns = [...initial[1].columns]
    secondColumns[1] += 15
    secondColumns[2] -= 15
    await previewAndCommitAlignmentResize(page, tables.nth(1), 2, 15, secondColumns)
    expect((await readAlignmentGeometry(tables.nth(0))).columns).toEqual(firstColumns)
    expect((await readAlignmentGeometry(tables.nth(1))).columns).toEqual(secondColumns)

    disk = readAlignmentDisk(fixture.path)
    layouts = disk.metadata.tables as Array<Record<string, unknown>>
    expect(layouts).toHaveLength(2)
    expect(layouts.map(({ tableIndex, fingerprint, columns }) => ({
      tableIndex,
      fingerprint,
      columns,
    }))).toEqual([
      { tableIndex: 0, fingerprint: layouts[0].fingerprint, columns: firstColumns },
      { tableIndex: 1, fingerprint: layouts[0].fingerprint, columns: secondColumns },
    ])
    expect(disk.metadata.tableColors).toEqual(initialDisk.metadata.tableColors)
    expect(disk.styles).toEqual(initialDisk.styles)

    await editor.focus()
    await resetAlignmentObservation(page)
    await page.keyboard.press('ControlOrMeta+z')
    await expect.poll(async () => (await readAlignmentGeometry(tables.nth(1))).columns)
      .toEqual(initial[1].columns)
    expect((await readAlignmentGeometry(tables.nth(0))).columns).toEqual(firstColumns)
    await expectSingleAlignmentSave(page)

    await resetAlignmentObservation(page)
    await page.keyboard.press('ControlOrMeta+Shift+z')
    await expect.poll(async () => (await readAlignmentGeometry(tables.nth(1))).columns)
      .toEqual(secondColumns)
    expect((await readAlignmentGeometry(tables.nth(0))).columns).toEqual(firstColumns)
    await expectSingleAlignmentSave(page)

    const savedDisk = readAlignmentDisk(fixture.path)
    await page.getByTitle('Back', { exact: true }).click()
    editor = await openAlignmentDocument(page, DUPLICATE_ALIGNMENT_FILENAME)
    tables = editor.locator('table.rv-office-table')
    await expect(tables).toHaveCount(2)
    expect((await readAlignmentGeometry(tables.nth(0))).columns).toEqual(firstColumns)
    expect((await readAlignmentGeometry(tables.nth(1))).columns).toEqual(secondColumns)
    expect(readAlignmentDisk(fixture.path)).toEqual(savedDisk)
  } finally {
    await page.close()
    await resetDuplicateAlignmentFixture()
  }
})

test('[slice 10.3] live geometry honors every alignment through zoom clamp commit rebuild and reopen', async ({ page }) => {
  test.setTimeout(300_000)
  const fixture = await resetAlignmentFixture()
  const canonicalBytes = fs.readFileSync(fixture.path)
  const seededText = canonicalBytes.toString()
    .replace(
      "    - { tableIndex: 0, fingerprint: 'fixture-align-0', columns: [160, 160] }",
      "    - { tableIndex: 0, fingerprint: 'fixture-align-0', columns: [160, 160], style: { legacy: 'keep-layout' }, futureLayout: 'keep-layout' }",
    )
    .replace(
      "  tableStyles:\n",
      "  tableColors:\n    - { tableIndex: 1, fingerprint: 'fixture-align-1', cells: { '1,1': '#123456' }, futureColor: 'keep-color' }\n  tableStyles:\n",
    )
    .replace(
      "    - { tableIndex: 0, fingerprint: 'fixture-align-0', tableAlignment: 'left' }",
      "    - { tableIndex: 0, fingerprint: 'fixture-align-0', tableAlignment: 'left', tableOverflow: 'newline', titleRow: true, borderWidth: 4, borderColor: '#abcdef', futureStyle: { nested: 'keep-style' } }",
    )
  fs.writeFileSync(fixture.path, seededText)
  await installSaveObservation(page)
  await page.setViewportSize({ width: 1450, height: 760 })

  const alignments = ['left', 'center', 'right'] as const
  const nextAlignments = ['center', 'right', 'left'] as const

  try {
    let editor = await openAlignmentDocument(page)
    let tables = editor.locator('table.rv-office-table')
    await expect(tables).toHaveCount(6)
    const initialDisk = readAlignmentDisk(fixture.path)
    const initialBodies = await tables.evaluateAll((nodes) => nodes.map((node) => (
      Array.from((node as HTMLTableElement).rows).map((row) => (
        Array.from(row.cells).map((cell) => cell.textContent)
      ))
    )))

    await page.locator('.rv-office-document-editor').evaluate((element) => {
      ;(element as HTMLElement).style.setProperty('--editor-zoom', '1.25')
    })

    for (const [tableIndex, alignment] of alignments.entries()) {
      const table = tables.nth(tableIndex)
      await expect.poll(async () => (await readAlignmentGeometry(table)).scale).toBeCloseTo(1.25, 2)

      const internal = await previewAndCommitAlignmentResize(page, table, 1, 25, [180, 140])
      expect(internal.start.alignment).toBe(alignment)
      expectRectWithinLayoutPixel(internal.preview.table, internal.start.table, internal.start.scale)
      expect(internal.preview.guideX).toBeCloseTo(
        internal.start.table.left + 180 * internal.start.scale,
        1,
      )
      expectRectWithinLayoutPixel(internal.committed.table, internal.start.table, internal.start.scale)

      const leftOuter = await previewAndCommitAlignmentResize(page, table, 0, -25, [200, 140])
      const expectedLeftRect = expectedOuterRect(leftOuter.start, alignment, 20)
      expectRectWithinLayoutPixel(leftOuter.preview.table, leftOuter.start.table, leftOuter.start.scale)
      expect(leftOuter.preview.guideX).toBeCloseTo(expectedLeftRect.left, 1)
      expectRectWithinLayoutPixel(leftOuter.committed.table, expectedLeftRect, leftOuter.start.scale)

      const rightOuter = await previewAndCommitAlignmentResize(page, table, 2, 25, [200, 160])
      const expectedRightRect = expectedOuterRect(rightOuter.start, alignment, 20)
      expectRectWithinLayoutPixel(rightOuter.preview.table, rightOuter.start.table, rightOuter.start.scale)
      expect(rightOuter.preview.guideX).toBeCloseTo(expectedRightRect.right, 1)
      expectRectWithinLayoutPixel(rightOuter.committed.table, expectedRightRect, rightOuter.start.scale)
      expect(rightOuter.committed.alignment).toBe(alignment)
    }

    await page.locator('.rv-office-document-editor').evaluate((element) => {
      ;(element as HTMLElement).style.setProperty('--editor-zoom', '0.8')
    })

    const clampedWidths: number[][] = []
    for (const [tableIndex, alignment] of alignments.entries()) {
      const table = tables.nth(tableIndex)
      await expect.poll(async () => (await readAlignmentGeometry(table)).scale).toBeCloseTo(0.8, 2)
      const beforeClamp = await readAlignmentGeometry(table)
      expect(Number.isSafeInteger(beforeClamp.minimum)).toBe(true)
      expect(beforeClamp.minimum).toBeGreaterThan(0)

      const leftClamp = await previewAndCommitAlignmentResize(
        page,
        table,
        0,
        10_000,
        [beforeClamp.minimum, 160],
      )
      const expectedLeftClamp = expectedOuterRect(
        leftClamp.start,
        alignment,
        beforeClamp.minimum - 200,
      )
      expect(leftClamp.preview.guideX).toBeCloseTo(expectedLeftClamp.left, 1)
      expectRectWithinLayoutPixel(leftClamp.committed.table, expectedLeftClamp, leftClamp.start.scale)

      const rightClamp = await previewAndCommitAlignmentResize(
        page,
        table,
        2,
        -10_000,
        [beforeClamp.minimum, beforeClamp.minimum],
      )
      const expectedRightClamp = expectedOuterRect(
        rightClamp.start,
        alignment,
        beforeClamp.minimum - 160,
      )
      expect(rightClamp.preview.guideX).toBeCloseTo(expectedRightClamp.right, 1)
      expectRectWithinLayoutPixel(rightClamp.committed.table, expectedRightClamp, rightClamp.start.scale)
      expect(rightClamp.committed.alignment).toBe(alignment)
      expect(Math.abs(
        rightClamp.committed.firstDataCell.width / rightClamp.committed.scale
          - beforeClamp.minimum,
      )).toBeLessThanOrEqual(1)
      const dataHeight = rightClamp.committed.firstDataCell.height / rightClamp.committed.scale
      if (tableIndex === 0) {
        // This seeded New line table is deliberately content-expanded. Its
        // taller row must not feed back into the already-frozen width clamp.
        expect(dataHeight).toBeGreaterThan(beforeClamp.minimum)
      } else {
        expect(Math.abs(dataHeight - beforeClamp.minimum)).toBeLessThanOrEqual(1)
      }
      clampedWidths.push([beforeClamp.minimum, beforeClamp.minimum])
    }

    // The oversized right-aligned table keeps its stored alignment while its
    // internal resize remains reachable from scroll origin through scroll end.
    const oversized = tables.nth(4)
    await oversized.evaluate((node) => { (node.parentElement as HTMLElement).scrollLeft = 0 })
    const oversizedAtOrigin = await readAlignmentGeometry(oversized)
    expect(oversizedAtOrigin.alignment).toBe('right')
    expect(oversizedAtOrigin.wrapper.scrollLeft).toBe(0)
    expect(oversizedAtOrigin.table.left).toBeCloseTo(oversizedAtOrigin.wrapper.left, 1)
    await previewAndCommitAlignmentResize(page, oversized, 1, 16, [440, 400])
    const oversizedAfterResize = await readAlignmentGeometry(oversized)
    expect(oversizedAfterResize.alignment).toBe('right')
    expect(oversizedAfterResize.table.left).toBeCloseTo(oversizedAfterResize.wrapper.left, 1)
    const oversizedAtEnd = await oversized.evaluate((node) => {
      const table = node as HTMLTableElement
      const wrapper = table.parentElement as HTMLElement
      wrapper.scrollLeft = wrapper.scrollWidth - wrapper.clientWidth
      const tableRect = table.getBoundingClientRect()
      const wrapperRect = wrapper.getBoundingClientRect()
      const scale = tableRect.width / table.offsetWidth
      const wrapperRight = wrapperRect.left + wrapper.clientLeft * scale + wrapper.clientWidth * scale
      return {
        maximum: wrapper.scrollWidth - wrapper.clientWidth,
        scrollLeft: wrapper.scrollLeft,
        tableRight: tableRect.right,
        wrapperRight,
      }
    })
    expect(oversizedAtEnd.maximum).toBeGreaterThan(0)
    expect(Math.abs(oversizedAtEnd.scrollLeft - oversizedAtEnd.maximum)).toBeLessThanOrEqual(1)
    expect(Math.abs(oversizedAtEnd.tableRight - oversizedAtEnd.wrapperRight)).toBeLessThanOrEqual(1)
    await oversized.evaluate((node) => { (node.parentElement as HTMLElement).scrollLeft = 0 })

    const beforeAlignmentOnly = await Promise.all(
      alignments.map((_, index) => readAlignmentGeometry(tables.nth(index))),
    )
    for (const [tableIndex, nextAlignment] of nextAlignments.entries()) {
      await chooseTableAlignment(page, tables.nth(tableIndex), nextAlignment)
      const afterAlignment = await readAlignmentGeometry(tables.nth(tableIndex))
      expect(afterAlignment.columns).toEqual(beforeAlignmentOnly[tableIndex].columns)
      expect(afterAlignment.table.width).toBeCloseTo(
        beforeAlignmentOnly[tableIndex].table.width,
        1,
      )
    }

    await expect.poll(() => readAlignmentDisk(fixture.path).styles.slice(0, 3)
      .map(({ tableAlignment }) => tableAlignment)).toEqual(nextAlignments)
    await page.waitForTimeout(750)
    const savedDisk = readAlignmentDisk(fixture.path)
    const nonTableMarkdown = (body: string) => body.split('\n')
      .filter((line) => !line.trimStart().startsWith('|'))
      .join('\n')
      .trim()
    expect(nonTableMarkdown(savedDisk.body)).toBe(nonTableMarkdown(initialDisk.body))
    expect(savedDisk.metadata.tableColors).toEqual(initialDisk.metadata.tableColors)
    expect(savedDisk.metadata.preserveUnknown).toBe('keep-me')
    const savedLayouts = savedDisk.metadata.tables as Array<Record<string, unknown>>
    expect(savedLayouts[0]).toEqual(expect.objectContaining({
      columns: clampedWidths[0],
      style: { legacy: 'keep-layout' },
      futureLayout: 'keep-layout',
    }))
    expect(savedLayouts[1]).toEqual(expect.objectContaining({ columns: clampedWidths[1] }))
    expect(savedLayouts[2]).toEqual(expect.objectContaining({ columns: clampedWidths[2] }))
    expect(savedLayouts[4]).toEqual(expect.objectContaining({ columns: [440, 400] }))
    expect(savedDisk.styles[0]).toEqual(expect.objectContaining({
      tableAlignment: 'center',
      tableOverflow: 'newline',
      titleRow: true,
      borderWidth: 4,
      borderColor: '#abcdef',
      futureStyle: { nested: 'keep-style' },
    }))
    expect(savedDisk.styles.every((style) => (
      !Object.hasOwn(style, 'position') && !Object.hasOwn(style, 'offset')
    ))).toBe(true)
    expect(await tables.evaluateAll((nodes) => nodes.map((node) => (
      Array.from((node as HTMLTableElement).rows).map((row) => (
        Array.from(row.cells).map((cell) => cell.textContent)
      ))
    )))).toEqual(initialBodies)

    const beforeReopen = await Promise.all(
      alignments.map((_, index) => readAlignmentGeometry(tables.nth(index))),
    )
    await page.reload()
    editor = page.locator(
      '.rv-office-document-editor .milkdown .ProseMirror[contenteditable="true"]',
    )
    await expect(editor).toBeVisible()
    await page.locator('.rv-office-document-editor').evaluate((element) => {
      ;(element as HTMLElement).style.setProperty('--editor-zoom', '0.8')
    })
    tables = editor.locator('table.rv-office-table')
    await expect(tables).toHaveCount(6)
    for (const [tableIndex, alignment] of nextAlignments.entries()) {
      await expect(tables.nth(tableIndex)).toHaveAttribute('data-rv-table-alignment', alignment)
      const reopened = await readAlignmentGeometry(tables.nth(tableIndex))
      expect(reopened.columns).toEqual(clampedWidths[tableIndex])
      expectRectWithinLayoutPixel(reopened.table, beforeReopen[tableIndex].table, reopened.scale)
    }
    const reopenedOversized = await readAlignmentGeometry(tables.nth(4))
    expect(reopenedOversized.alignment).toBe('right')
    expect(reopenedOversized.columns).toEqual([440, 400])
    expect(reopenedOversized.wrapper.scrollLeft).toBe(0)
    expect(reopenedOversized.table.left).toBeCloseTo(reopenedOversized.wrapper.left, 1)
    expect(await tables.evaluateAll((nodes) => nodes.map((node) => (
      Array.from((node as HTMLTableElement).rows).map((row) => (
        Array.from(row.cells).map((cell) => cell.textContent)
      ))
    )))).toEqual(initialBodies)
    expect(readAlignmentDisk(fixture.path)).toEqual(savedDisk)
  } finally {
    await page.close()
    fs.writeFileSync(fixture.path, canonicalBytes)
    await resetAlignmentFixture()
  }
})
