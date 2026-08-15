import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'

import { Schema } from '@milkdown/kit/prose/model'
import { expect, test, type Page } from '@playwright/test'

import {
  BORDERS_CANONICAL,
} from './office/fixture-scenarios.mjs'
import {
  getRawDocumentTableStyles,
  normalizeDocumentTableBorderColor,
  normalizeDocumentTableBorderWidth,
  parseDocumentSettings,
} from '../src/lib/front-matter'
import {
  prepareOfficeTableBorderColorChange,
  prepareOfficeTableBorderWidthChange,
} from '../src/components/office/officeTableDisplay'
import {
  projectOfficeTableBorders,
  projectProseDocumentTableBorders,
} from '../src/components/office/officeTableBorderProjection'
import { resetOfficePlaywrightScenario } from './office/fixture-lifecycle.mjs'

const BORDERS_FILENAME = 'Borders.md'
const require = createRequire(import.meta.url)
const { PNG } = require('playwright-core/lib/utilsBundle') as {
  PNG: { sync: { read: (buffer: Buffer) => { width: number; height: number; data: Buffer } } }
}

type FixtureFile = { filename: string; path: string; id?: string }
type Rgb = readonly [number, number, number]

async function resetBordersFixture(): Promise<FixtureFile> {
  const files = await resetOfficePlaywrightScenario({
    scenario: 'borders',
    copies: 1,
    workspaces: 1,
  })
  const fixture = files.find(({ filename }: FixtureFile) => filename === BORDERS_FILENAME)
  expect(fixture).toBeTruthy()
  return fixture as FixtureFile
}

async function openBordersDocument(page: Page) {
  await page.goto('/')
  await page.getByTitle('Office', { exact: true }).click()
  const folder = page.getByTitle('001-Fixtures', { exact: true })
  const document = page.getByTitle(BORDERS_FILENAME, { exact: true })
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

function installReadOnlyWriteObservation(page: Page) {
  return page.addInitScript(() => {
    const originalSend = WebSocket.prototype.send
    const observed = window as typeof window & {
      __borderSaveCount?: number
      __borderMetadataEvents?: Record<string, number>
      __officeTableMetadataTestHook?: (event: string) => void
    }
    observed.__borderSaveCount = 0
    observed.__borderMetadataEvents = {}
    observed.__officeTableMetadataTestHook = (event) => {
      const events = observed.__borderMetadataEvents ?? {}
      events[event] = (events[event] ?? 0) + 1
      observed.__borderMetadataEvents = events
    }
    WebSocket.prototype.send = function observeBorderSaves(data) {
      if (typeof data === 'string') {
        try {
          const message = JSON.parse(data) as { type?: string }
          if (message.type === 'file_save') {
            observed.__borderSaveCount = (observed.__borderSaveCount ?? 0) + 1
          }
        } catch {
          // Preserve unrelated non-JSON WebSocket frames.
        }
      }
      return originalSend.call(this, data)
    }
  })
}

function resetBorderObservation(page: Page) {
  return page.evaluate(() => {
    const observed = window as typeof window & {
      __borderSaveCount?: number
      __borderMetadataEvents?: Record<string, number>
    }
    observed.__borderSaveCount = 0
    observed.__borderMetadataEvents = {}
  })
}

function readBorderObservation(page: Page) {
  return page.evaluate(() => {
    const observed = window as typeof window & {
      __borderSaveCount?: number
      __borderMetadataEvents?: Record<string, number>
    }
    return {
      saves: observed.__borderSaveCount ?? 0,
      events: observed.__borderMetadataEvents ?? {},
    }
  })
}

async function expectSingleBorderMetadataSave(page: Page) {
  await expect.poll(async () => (await readBorderObservation(page)).saves, {
    timeout: 15_000,
  }).toBe(1)
  await page.waitForTimeout(650)
  expect(await readBorderObservation(page)).toEqual({
    saves: 1,
    events: {
      step: 1,
      'plugin-publish': 1,
      'external-publish': 1,
    },
  })
}

async function expectNoBorderMetadataSave(page: Page) {
  await page.waitForTimeout(750)
  expect(await readBorderObservation(page)).toEqual({ saves: 0, events: {} })
}

function readBorderDisk(path: string) {
  const parsed = parseDocumentSettings(fs.readFileSync(path, 'utf8'))
  return {
    body: parsed.body,
    metadata: parsed.frontmatter.metadata as Record<string, unknown>,
    styles: (getRawDocumentTableStyles(parsed.frontmatter) ?? []) as Array<Record<string, unknown>>,
  }
}

function edgeRun(
  png: ReturnType<typeof PNG.sync.read>,
  color: Rgb,
  edge: 'top' | 'right' | 'bottom' | 'left',
  tolerance = 0,
) {
  const pixelMatches = (x: number, y: number) => {
    const offset = (y * png.width + x) * 4
    return Math.abs(png.data[offset] - color[0]) <= tolerance
      && Math.abs(png.data[offset + 1] - color[1]) <= tolerance
      && Math.abs(png.data[offset + 2] - color[2]) <= tolerance
      && png.data[offset + 3] === 255
  }
  const runCounts = new Map<number, number>()
  const along = edge === 'top' || edge === 'bottom' ? png.width : png.height
  const across = edge === 'top' || edge === 'bottom' ? png.height : png.width
  for (let position = 2; position < along - 2; position += 1) {
    let run = 0
    for (let depth = 0; depth < Math.min(8, across); depth += 1) {
      const x = edge === 'left'
        ? depth
        : edge === 'right' ? png.width - 1 - depth : position
      const y = edge === 'top'
        ? depth
        : edge === 'bottom' ? png.height - 1 - depth : position
      if (!pixelMatches(x, y)) break
      run += 1
    }
    runCounts.set(run, (runCounts.get(run) ?? 0) + 1)
  }
  return Array.from(runCounts.entries())
    .filter(([run]) => run > 0)
    .sort(([runA, countA], [runB, countB]) => countB - countA || runB - runA)[0]?.[0] ?? 0
}

function localStrokeRun(
  png: ReturnType<typeof PNG.sync.read>,
  color: Rgb,
  axis: 'horizontal' | 'vertical',
  boundary: number,
  along: number,
) {
  const pixelMatches = (x: number, y: number) => {
    const offset = (y * png.width + x) * 4
    return png.data[offset] === color[0]
      && png.data[offset + 1] === color[1]
      && png.data[offset + 2] === color[2]
      && png.data[offset + 3] === 255
  }
  let longest = 0
  for (let alongOffset = -2; alongOffset <= 2; alongOffset += 1) {
    let current = 0
    const start = Math.round(boundary) - 3
    const end = Math.round(boundary) + 8
    for (let across = start; across <= end; across += 1) {
      const x = axis === 'vertical' ? across : Math.round(along) + alongOffset
      const y = axis === 'horizontal' ? across : Math.round(along) + alongOffset
      if (x >= 0 && x < png.width && y >= 0 && y < png.height && pixelMatches(x, y)) {
        current += 1
        longest = Math.max(longest, current)
      } else {
        current = 0
      }
    }
  }
  return longest
}

test.describe('[slice 09.1] border normalization', () => {
  test('accepts only widths 1..4 and canonical six-digit colors or explicit null', () => {
    expect([-1, 0, 1, 2, 3, 4, 5, 99, '2', null].map(normalizeDocumentTableBorderWidth))
      .toEqual([1, 1, 1, 2, 3, 4, 1, 1, 1, 1])
    expect([
      undefined,
      '#004E89',
      '#004e89',
      '#fff',
      '#xyzxyz',
      ' #004e89 ',
      null,
    ].map(normalizeDocumentTableBorderColor)).toEqual([
      'default',
      '#004e89',
      '#004e89',
      'default',
      'default',
      'default',
      null,
    ])
  })
})

test.describe('[slice 09.2] border width metadata mutation', () => {
  test('canonicalizes only border siblings and preserves every other raw domain', () => {
    const before = {
      tables: [{ tableIndex: 1, fingerprint: 'table-b', columns: [100, 120] }],
      tableColors: [{ tableIndex: 1, fingerprint: 'table-b', cells: { '0,0': '#ffeeaa' } }],
      tableStyles: [
        {
          tableIndex: 0,
          fingerprint: 'table-a',
          borderWidth: 2,
          borderColor: null,
          sibling: 'untouched',
        },
        {
          tableIndex: 1,
          fingerprint: 'table-b',
          tableOverflow: 'newline',
          titleRow: true,
          tableAlignment: 'right',
          borderWidth: 99,
          borderColor: '#004E89',
          fixtureSeed: 'keep-border',
          future: { exact: ['bytes', 7] },
        },
        'opaque-style-entry',
      ],
    }
    const original = structuredClone(before)
    const target = { tableIndex: 1, fingerprint: 'table-b' }
    const after = prepareOfficeTableBorderWidthChange(before, target, 1)

    expect(after).toEqual({
      ...before,
      tableStyles: [
        before.tableStyles[0],
        {
          ...(before.tableStyles[1] as Record<string, unknown>),
          borderWidth: 1,
          borderColor: '#004e89',
        },
        'opaque-style-entry',
      ],
    })
    expect(before).toEqual(original)
    expect(after?.tables).toEqual(before.tables)
    expect(after?.tableColors).toEqual(before.tableColors)
    expect((after?.tableStyles as unknown[])[0]).toEqual(before.tableStyles[0])
    expect((after?.tableStyles as unknown[])[2]).toBe('opaque-style-entry')

    expect(prepareOfficeTableBorderWidthChange(
      {
        ...before,
        tableStyles: [{ ...(before.tableStyles[1] as Record<string, unknown>), borderWidth: 2 }],
      },
      target,
      2,
    )).toBeNull()

    const invalidColor = prepareOfficeTableBorderWidthChange({
      ...before,
      tableStyles: [{
        tableIndex: 1,
        fingerprint: 'table-b',
        borderWidth: 2,
        borderColor: '#xyzxyz',
        preserve: 'exact',
      }],
    }, target, 3)
    expect(invalidColor?.tableStyles).toEqual([{
      tableIndex: 1,
      fingerprint: 'table-b',
      borderWidth: 3,
      preserve: 'exact',
    }])

    const nullColor = prepareOfficeTableBorderWidthChange({
      tables: [],
      tableColors: [],
      tableStyles: [{ tableIndex: 1, fingerprint: 'table-b', borderColor: null }],
    }, target, 4)
    expect(nullColor?.tableStyles).toEqual([{
      tableIndex: 1,
      fingerprint: 'table-b',
      borderColor: null,
      borderWidth: 4,
    }])

    expect(prepareOfficeTableBorderWidthChange(
      { tables: [], tableColors: [] },
      { tableIndex: 2, fingerprint: 'table-c' },
      3,
    )?.tableStyles).toEqual([{
      tableIndex: 2,
      fingerprint: 'table-c',
      borderWidth: 3,
    }])
  })
})

test.describe('[slice 09.3] border color metadata mutation', () => {
  test('canonicalizes only the selected color and owned width sibling', () => {
    const before = {
      tables: [{ tableIndex: 11, fingerprint: 'fixture-border-title', columns: [100, 120, 140], style: { opaque: true } }],
      tableColors: [{ tableIndex: 11, fingerprint: 'fixture-border-title', cells: { '0,0': '#ffeeaa' } }],
      tableStyles: [
        { tableIndex: 3, fingerprint: 'other', borderWidth: 2, borderColor: null, keep: ['exact'] },
        {
          tableIndex: 11,
          fingerprint: 'fixture-border-title',
          titleRow: true,
          tableOverflow: 'newline',
          tableAlignment: 'right',
          borderWidth: 4,
          borderColor: '#4A86E8',
          fixtureSeed: 'keep-border-title',
          unknown: { nested: [1, null, 'opaque'] },
        },
        'opaque-style-entry',
      ],
      unknownSnapshot: { preserve: true },
    }
    const original = structuredClone(before)
    const target = { tableIndex: 11, fingerprint: 'fixture-border-title' }
    const real = prepareOfficeTableBorderColorChange(before, target, '#FF0000')
    expect(real).toEqual({
      ...before,
      tableStyles: [
        before.tableStyles[0],
        { ...(before.tableStyles[1] as Record<string, unknown>), borderColor: '#ff0000' },
        'opaque-style-entry',
      ],
    })
    expect(before).toEqual(original)
    expect(real?.tables).toEqual(before.tables)
    expect(real?.tableColors).toEqual(before.tableColors)
    expect(real?.unknownSnapshot).toEqual(before.unknownSnapshot)
    expect(prepareOfficeTableBorderColorChange(real!, target, '#ff0000')).toBeNull()

    const none = prepareOfficeTableBorderColorChange(real!, target, null)
    expect((none?.tableStyles as Array<Record<string, unknown>>)[1]).toEqual({
      ...(before.tableStyles[1] as Record<string, unknown>),
      borderColor: null,
    })
    expect(prepareOfficeTableBorderColorChange(none!, target, null)).toBeNull()

    expect(prepareOfficeTableBorderColorChange({
      tables: [],
      tableColors: [],
      tableStyles: [{ tableIndex: 2, fingerprint: 'invalid-width', borderWidth: 99, preserve: 'yes' }],
    }, { tableIndex: 2, fingerprint: 'invalid-width' }, '#112233')?.tableStyles).toEqual([{
      tableIndex: 2,
      fingerprint: 'invalid-width',
      borderColor: '#112233',
      preserve: 'yes',
    }])

    expect(prepareOfficeTableBorderColorChange({ tables: [], tableColors: [] }, {
      tableIndex: 0,
      fingerprint: 'missing-style',
    }, null)?.tableStyles).toEqual([{
      tableIndex: 0,
      fingerprint: 'missing-style',
      borderColor: null,
    }])
  })
})

test.describe('[slice 09.4] pure ordered border projection', () => {
  test('returns exactly width and color per live table without mutation or alignment exposure', () => {
    const tables = [
      { tableIndex: 8, fingerprint: 'live-a' },
      { tableIndex: 3, fingerprint: 'live-b' },
      { tableIndex: 9, fingerprint: 'live-c' },
      { tableIndex: 4, fingerprint: 'live-d' },
    ]
    const styles = [
      {
        tableIndex: 0,
        fingerprint: 'live-a',
        borderWidth: 4,
        borderColor: '#004E89',
        tableAlignment: 'right',
        titleRow: true,
        unknown: { exact: true },
      },
      {
        tableIndex: 1,
        fingerprint: 'stale-b',
        borderWidth: 2,
      },
      {
        tableIndex: 2,
        fingerprint: 'live-c',
        borderWidth: 99,
        borderColor: '#xyzxyz',
      },
      {
        tableIndex: 3,
        fingerprint: 'live-d',
        borderColor: null,
      },
    ]
    const originalTables = structuredClone(tables)
    const originalStyles = structuredClone(styles)

    expect(projectOfficeTableBorders(tables, styles)).toEqual([
      { borderWidth: 4, borderColor: '#004e89' },
      { borderWidth: 2, borderColor: 'default' },
      { borderWidth: 1, borderColor: 'default' },
      { borderWidth: 1, borderColor: null },
    ])
    expect(projectOfficeTableBorders(tables, undefined)).toEqual([
      { borderWidth: 1, borderColor: 'default' },
      { borderWidth: 1, borderColor: 'default' },
      { borderWidth: 1, borderColor: 'default' },
      { borderWidth: 1, borderColor: 'default' },
    ])
    for (const entry of projectOfficeTableBorders(tables, styles)) {
      expect(Object.keys(entry)).toEqual(['borderWidth', 'borderColor'])
      expect(entry).not.toHaveProperty('tableAlignment')
      expect(entry).not.toHaveProperty('tableIndex')
      expect(entry).not.toHaveProperty('fingerprint')
    }
    expect(tables).toEqual(originalTables)
    expect(styles).toEqual(originalStyles)
  })

  test('derives ProseMirror table order without adding output or identity fields', () => {
    const schema = new Schema({
      nodes: {
        doc: { content: 'table+' },
        paragraph: { content: 'text*' },
        text: {},
        table: { content: 'table_row+', tableRole: 'table' },
        table_row: { content: 'table_header+', tableRole: 'row' },
        table_header: {
          content: 'paragraph+',
          tableRole: 'header_cell',
          attrs: {
            colspan: { default: 1 },
            rowspan: { default: 1 },
            colwidth: { default: null },
          },
        },
      },
    })
    const paragraph = (value: string) => schema.nodes.paragraph.create(null, schema.text(value))
    const table = (headers: string[]) => schema.nodes.table.create(
      null,
      schema.nodes.table_row.create(
        null,
        headers.map((header) => schema.nodes.table_header.create(null, paragraph(header))),
      ),
    )
    const doc = schema.nodes.doc.create(null, [table(['a-0', 'a-1']), table(['b-0'])])
    const defaults = projectProseDocumentTableBorders(doc, undefined)
    expect(defaults).toEqual([
      { borderWidth: 1, borderColor: 'default' },
      { borderWidth: 1, borderColor: 'default' },
    ])
    expect(projectProseDocumentTableBorders(doc, [
      { tableIndex: 0, borderWidth: 3, borderColor: '#AA00CC', tableAlignment: 'center' },
      { tableIndex: 1, borderWidth: 4, borderColor: null, output: 'not-projected' },
    ])).toEqual([
      { borderWidth: 3, borderColor: '#aa00cc' },
      { borderWidth: 4, borderColor: null },
    ])
  })
})

test('[slice 09.1] canonical seeded borders render exact effective chrome pixels with no writes or geometry delta', async ({ page }) => {
  test.setTimeout(90_000)
  const fixture = await resetBordersFixture()
  const canonicalBytes = fs.readFileSync(fixture.path)
  const canonicalStat = fs.statSync(fixture.path)
  expect(canonicalBytes.toString()).toBe(BORDERS_CANONICAL)
  await installReadOnlyWriteObservation(page)

  try {
    const editor = await openBordersDocument(page)
    const tables = editor.locator('table.rv-office-table')
    await expect(tables).toHaveCount(12)
    await expect(tables.nth(11).locator(':scope > colgroup > col')).toHaveCount(3)
    await expect(tables.nth(11).locator('tbody > tr').first().locator('th'))
      .toHaveAttribute('colspan', '3')

    const effective = await tables.evaluateAll((elements) => elements.map((element) => {
      const table = element as HTMLTableElement
      const tableStyle = getComputedStyle(table)
      const cell = table.rows[0]?.cells[0]
      if (!cell) throw new Error('Seeded border table is missing its first cell')
      const pseudo = getComputedStyle(cell, '::after')
      return {
        widthVariable: tableStyle.getPropertyValue('--rv-office-table-border-width').trim(),
        colorVariable: tableStyle.getPropertyValue('--rv-office-table-border-color').trim(),
        colorState: table.dataset.rvTableBorderColor,
        styleState: table.dataset.rvTableBorderStyle,
        width: pseudo.borderTopWidth,
        style: pseudo.borderTopStyle,
        color: pseudo.borderTopColor,
      }
    }))
    expect(effective).toEqual([
      { widthVariable: '1px', colorVariable: 'rgba(28, 28, 28, 0.18)', colorState: 'default', styleState: 'solid', width: '1px', style: 'solid', color: 'rgba(28, 28, 28, 0.18)' },
      { widthVariable: '2px', colorVariable: 'rgba(28, 28, 28, 0.18)', colorState: 'default', styleState: 'solid', width: '2px', style: 'solid', color: 'rgba(28, 28, 28, 0.18)' },
      { widthVariable: '1px', colorVariable: '#004e89', colorState: 'color', styleState: 'solid', width: '1px', style: 'solid', color: 'rgb(0, 78, 137)' },
      { widthVariable: '1px', colorVariable: '#cccccc', colorState: 'none', styleState: 'dotted', width: '1px', style: 'dotted', color: 'rgb(204, 204, 204)' },
      { widthVariable: '4px', colorVariable: '#cccccc', colorState: 'none', styleState: 'dotted', width: '4px', style: 'dotted', color: 'rgb(204, 204, 204)' },
      { widthVariable: '1px', colorVariable: '#004e89', colorState: 'color', styleState: 'solid', width: '1px', style: 'solid', color: 'rgb(0, 78, 137)' },
      { widthVariable: '2px', colorVariable: 'rgba(28, 28, 28, 0.18)', colorState: 'default', styleState: 'solid', width: '2px', style: 'solid', color: 'rgba(28, 28, 28, 0.18)' },
      ...[1, 2, 3, 4, 4].map((width) => ({
        widthVariable: `${width}px`,
        colorVariable: '#4a86e8',
        colorState: 'color',
        styleState: 'solid',
        width: `${width}px`,
        style: 'solid',
        color: 'rgb(74, 134, 232)',
      })),
    ])

    const stored = getRawDocumentTableStyles(
      parseDocumentSettings(canonicalBytes.toString()).frontmatter,
    ) as Array<Record<string, unknown>>
    expect(stored).toHaveLength(11)
    expect(stored[0]).toEqual({ tableIndex: 1, fingerprint: 'fixture-border-1', borderWidth: 2 })
    expect(stored[2]).toEqual({ tableIndex: 3, fingerprint: 'fixture-border-3', borderColor: null })
    expect(stored[4]).toMatchObject({ borderWidth: 99, borderColor: '#004e89' })
    expect(stored[5]).toMatchObject({ borderWidth: 2, borderColor: '#xyzxyz' })
    expect(stored[10]).toEqual({
      tableIndex: 11,
      fingerprint: 'fixture-border-title',
      titleRow: true,
      tableOverflow: 'newline',
      tableAlignment: 'right',
      borderWidth: 4,
      borderColor: '#4a86e8',
      fixtureSeed: 'keep-border-title',
    })

    const comparableGeometry = await editor.evaluate((root) => (
      Array.from(root.querySelectorAll<HTMLTableElement>('table.rv-office-table'))
        .slice(7, 11)
        .map((table) => ({
          table: [table.getBoundingClientRect().width, table.getBoundingClientRect().height],
          rows: Array.from(table.rows).map((row) => [row.getBoundingClientRect().width, row.getBoundingClientRect().height]),
          cells: Array.from(table.querySelectorAll<HTMLTableCellElement>('th, td')).map((cell) => [
            cell.getBoundingClientRect().width,
            cell.getBoundingClientRect().height,
            getComputedStyle(cell).minWidth,
          ]),
        }))
    ))
    expect(comparableGeometry.slice(1)).toEqual([
      comparableGeometry[0],
      comparableGeometry[0],
      comparableGeometry[0],
    ])

    const target = tables.nth(7)
    const beforeTargetGeometry = await target.evaluate((table) => (
      Array.from(table.querySelectorAll<HTMLElement>(':scope, tr, th, td')).map((node) => {
        const rect = node.getBoundingClientRect()
        return [rect.width, rect.height, getComputedStyle(node).minWidth]
      })
    ))
    const siblingVariables = await tables.evaluateAll((elements) => elements.map((table) => (
      (table as HTMLElement).getAttribute('style')
    )))
    await target.evaluate((table) => {
      table.style.setProperty('--rv-office-table-border-width', '4px')
      table.style.setProperty('--rv-office-table-border-color', '#cccccc')
      table.dataset.rvTableBorderStyle = 'dotted'
      table.dataset.rvTableBorderColor = 'none'
    })
    expect(await target.evaluate((table) => (
      Array.from(table.querySelectorAll<HTMLElement>(':scope, tr, th, td')).map((node) => {
        const rect = node.getBoundingClientRect()
        return [rect.width, rect.height, getComputedStyle(node).minWidth]
      })
    ))).toEqual(beforeTargetGeometry)
    const changedVariables = await tables.evaluateAll((elements) => elements.map((table) => (
      (table as HTMLElement).getAttribute('style')
    )))
    expect(changedVariables.filter((value, index) => value !== siblingVariables[index])).toHaveLength(1)

    // Restore seeded chrome after the direct paint-only layout neutrality probe.
    await target.evaluate((table) => {
      table.style.setProperty('--rv-office-table-border-width', '1px')
      table.style.setProperty('--rv-office-table-border-color', '#4a86e8')
      table.dataset.rvTableBorderStyle = 'solid'
      table.dataset.rvTableBorderColor = 'color'
    })
    await expect(target).toHaveAttribute('data-rv-table-border-style', 'solid')
    await expect(target).toHaveAttribute('data-rv-table-border-color', 'color')

    const editableChrome = await tables.evaluateAll((elements) => elements.flatMap((table) => (
      Array.from(table.querySelectorAll<HTMLElement>('tr, th, td')).map((node) => ({
        className: node.getAttribute('class'),
        style: node.getAttribute('style'),
        borderWidth: node.getAttribute('data-rv-table-border-width'),
        borderColor: node.getAttribute('data-rv-table-border-color'),
        borderStyle: node.getAttribute('data-rv-table-border-style'),
      }))
    )))
    expect(editableChrome.every((node) => (
      !node.className?.includes('border')
      && !node.style?.includes('border')
      && !node.style?.includes('--rv-office-table-border')
      && node.borderWidth === null
      && node.borderColor === null
      && node.borderStyle === null
    ))).toBe(true)

    const blue = [74, 134, 232] as const
    for (const [index, width] of [[7, 1], [8, 2], [9, 3], [10, 4]] as const) {
      const table = tables.nth(index)
      const image = PNG.sync.read(await table.screenshot({ animations: 'disabled' }))
      expect(edgeRun(image, blue, 'top')).toBe(width)
      expect(edgeRun(image, blue, 'right')).toBe(width)
      expect(edgeRun(image, blue, 'bottom')).toBe(width)
      expect(edgeRun(image, blue, 'left')).toBe(width)
      const innerProbes = await table.evaluate((element) => {
        const tableRect = element.getBoundingClientRect()
        const topRight = element.rows[0].cells[1].getBoundingClientRect()
        const bottomLeft = element.rows[1].cells[0].getBoundingClientRect()
        return {
          vertical: [topRight.left - tableRect.left, topRight.top - tableRect.top + topRight.height * 0.75],
          horizontal: [bottomLeft.top - tableRect.top, bottomLeft.left - tableRect.left + bottomLeft.width * 0.75],
        }
      })
      expect(localStrokeRun(
        image,
        blue,
        'vertical',
        innerProbes.vertical[0],
        innerProbes.vertical[1],
      )).toBe(width)
      expect(localStrokeRun(
        image,
        blue,
        'horizontal',
        innerProbes.horizontal[0],
        innerProbes.horizontal[1],
      )).toBe(width)
      expect(await table.evaluate((element) => {
        const topLeft = getComputedStyle(element.rows[0].cells[0], '::after')
        const bottomRight = getComputedStyle(element.rows[1].cells[1], '::after')
        return {
          topLeft: [
            topLeft.borderTopWidth,
            topLeft.borderRightWidth,
            topLeft.borderBottomWidth,
            topLeft.borderLeftWidth,
          ],
          bottomRight: [
            bottomRight.borderTopWidth,
            bottomRight.borderRightWidth,
            bottomRight.borderBottomWidth,
            bottomRight.borderLeftWidth,
          ],
        }
      })).toEqual({
        topLeft: [`${width}px`, '0px', '0px', `${width}px`],
        bottomRight: [`${width}px`, `${width}px`, `${width}px`, `${width}px`],
      })
    }
    const dotted = PNG.sync.read(await tables.nth(4).screenshot({ animations: 'disabled' }))
    for (const edge of ['top', 'right', 'bottom', 'left'] as const) {
      expect(edgeRun(dotted, [204, 204, 204], edge, 16)).toBe(4)
    }

    const titleTable = tables.nth(11)
    expect(await titleTable.locator('tbody > tr').first().locator('th').evaluate((cell) => (
      getComputedStyle(cell).backgroundColor
    ))).toBe('rgb(255, 238, 170)')
    expect(await titleTable.locator('tbody > tr').nth(1).locator('td').evaluateAll((cells) => (
      cells.map((cell) => getComputedStyle(cell).backgroundColor)
    ))).toEqual(['rgba(0, 0, 0, 0)', 'rgb(214, 255, 214)', 'rgba(0, 0, 0, 0)'])

    await page.emulateMedia({ media: 'print' })
    for (const index of [3, 4]) {
      expect(await tables.nth(index).locator('tbody > tr').first().locator('th').first()
        .evaluate((cell) => getComputedStyle(cell, '::after').borderTopWidth)).toBe('0px')
    }
    expect(await tables.nth(10).locator('tbody > tr').first().locator('th').first()
      .evaluate((cell) => getComputedStyle(cell, '::after').borderTopWidth)).toBe('4px')

    await page.waitForTimeout(750)
    expect(await page.evaluate(() => (
      (window as typeof window & { __borderSaveCount?: number }).__borderSaveCount ?? 0
    ))).toBe(0)
    expect(fs.readFileSync(fixture.path)).toEqual(canonicalBytes)
    expect(fs.statSync(fixture.path).mtimeMs).toBe(canonicalStat.mtimeMs)
  } finally {
    await page.close()
    await resetBordersFixture()
  }
})

test('[slice 09.2] Border size menu persists every width with exact no-op canonicalization history and accessibility', async ({ page }) => {
  test.setTimeout(240_000)
  const fixture = await resetBordersFixture()
  const canonicalBytes = fs.readFileSync(fixture.path)
  const seededText = canonicalBytes.toString().replace(
    "fingerprint: 'fixture-border-2', borderColor: '#004e89'",
    "fingerprint: 'fixture-border-2', borderColor: '#004E89'",
  )
  expect(seededText).not.toBe(canonicalBytes.toString())
  fs.writeFileSync(fixture.path, seededText)
  await installReadOnlyWriteObservation(page)

  const rootMenu = page.getByRole('menu', { name: 'Table cell actions' })
  const tableMenu = page.getByRole('menu', { name: 'Table', exact: true })
  const borderMenu = page.getByRole('menu', { name: 'Border size', exact: true })
  const tableTarget = (editor: ReturnType<Page['locator']>, index: number) => (
    editor.locator('table.rv-office-table').nth(index)
  )
  const openRoot = async (editor: ReturnType<Page['locator']>, index: number) => {
    const cell = tableTarget(editor, index).locator('tbody > tr').last().locator('td, th').first()
    await cell.click({ button: 'right' })
    await expect(rootMenu).toBeVisible()
    await expect(rootMenu.getByRole('menuitem', { name: 'Table', exact: true })).toBeFocused()
  }
  const openBorderWithPointer = async (editor: ReturnType<Page['locator']>, index: number) => {
    await openRoot(editor, index)
    await rootMenu.getByRole('menuitem', { name: 'Table', exact: true }).hover()
    await expect(tableMenu).toBeVisible()
    const trigger = tableMenu.getByRole('menuitem', { name: /Border size: current width/ })
    await trigger.hover()
    await expect(borderMenu).toBeVisible()
    return trigger
  }
  const openBorderWithKeyboard = async (editor: ReturnType<Page['locator']>, index: number) => {
    await openRoot(editor, index)
    await page.keyboard.press('ArrowLeft')
    await expect(rootMenu.getByRole('menuitem', { name: 'Table', exact: true })).toBeFocused()
    await page.keyboard.press('ArrowRight')
    await expect(tableMenu).toBeVisible()
    await expect(tableMenu.getByRole('menuitem', { name: 'Add title row', exact: true })).toBeFocused()
    await page.keyboard.press('ArrowDown')
    const trigger = tableMenu.getByRole('menuitem', { name: /Border size: current width/ })
    await expect(trigger).toBeFocused()
    await page.keyboard.press('ArrowRight')
    await expect(borderMenu).toBeVisible()
    return trigger
  }
  const chooseWidth = async (
    editor: ReturnType<Page['locator']>,
    tableIndex: number,
    width: 1 | 2 | 3 | 4,
    keyboard = false,
  ) => {
    if (keyboard) {
      await openBorderWithKeyboard(editor, tableIndex)
      const choice = borderMenu.getByRole('menuitemradio', { name: `${width}px`, exact: true })
      await choice.focus()
      await page.keyboard.press('Enter')
    } else {
      await openBorderWithPointer(editor, tableIndex)
      await borderMenu.getByRole('menuitemradio', { name: `${width}px`, exact: true }).click()
    }
    await expect(rootMenu).toHaveCount(0)
    await expect(editor).toBeFocused()
  }
  const expectWidthOnDisk = (tableIndex: number, width: number) => {
    const disk = readBorderDisk(fixture.path)
    const style = disk.styles.find((entry) => entry.tableIndex === tableIndex)
    expect(style?.borderWidth).toBe(width)
    return { disk, style }
  }
  const expectSingleTextSave = async () => {
    await expect.poll(async () => (await readBorderObservation(page)).saves, {
      timeout: 15_000,
    }).toBe(1)
    await page.waitForTimeout(650)
    expect(await readBorderObservation(page)).toEqual({ saves: 1, events: {} })
  }

  try {
    let editor = await openBordersDocument(page)
    await expect(editor.locator('table.rv-office-table')).toHaveCount(12)
    const initialStyles = structuredClone(readBorderDisk(fixture.path).styles)

    await resetBorderObservation(page)
    const defaultTrigger = await openBorderWithPointer(editor, 0)
    await expect(defaultTrigger).toHaveAttribute('aria-label', 'Border size: current width 1px')
    await expect(defaultTrigger.locator('.material-symbols-outlined').first()).toHaveText('border_all')
    await expect(defaultTrigger.locator('.rv-office-table-context-current')).toHaveText('1px')
    await expect(tableMenu.locator(':scope > [role="menuitem"], :scope > [role="menuitemradio"]'))
      .toHaveCount(8)
    await expect(tableMenu.locator(':scope > [role="menuitem"], :scope > [role="menuitemradio"]'))
      .toHaveText([
      'variable_addAdd title row',
      'border_allBorder size1pxchevron_right',
      'border_allBorder colorDefault',
      'align_horizontal_leftAlign table leftcheck',
      'align_horizontal_centerAlign table center',
      'align_horizontal_rightAlign table right',
      'format_text_overflowOverflowOverflowchevron_right',
      'deleteRemove table',
    ])
    await expect(tableMenu.locator(':scope > [role="separator"]')).toHaveCount(4)
    await expect(tableMenu.getByRole('menuitem', { name: 'Border color: current color Default', exact: true }))
      .toHaveCount(1)
    await expect(tableMenu.getByRole('menuitemradio', { name: /Align table/ })).toHaveCount(3)
    const defaultChoices = borderMenu.getByRole('menuitemradio')
    await expect(defaultChoices).toHaveCount(4)
    await expect(defaultChoices).toHaveText(['check1px', '2px', '3px', '4px'])
    await expect(defaultChoices.nth(0)).toHaveAttribute('aria-checked', 'true')
    await expect(defaultChoices.nth(1)).toHaveAttribute('aria-checked', 'false')
    await expect(defaultChoices.nth(2)).toHaveAttribute('aria-checked', 'false')
    await expect(defaultChoices.nth(3)).toHaveAttribute('aria-checked', 'false')
    await defaultChoices.nth(0).click()
    await expectSingleBorderMetadataSave(page)
    expect(expectWidthOnDisk(0, 1).style).toMatchObject({ borderWidth: 1 })

    for (const [index, width] of ([2, 3, 4, 1] as const).entries()) {
      await resetBorderObservation(page)
      const beforeStyles = readBorderDisk(fixture.path).styles.filter((entry) => entry.tableIndex !== 0)
      await chooseWidth(editor, 0, width, index % 2 === 1)
      await expect(tableTarget(editor, 0)).toHaveCSS('--rv-office-table-border-width', `${width}px`)
      await expectSingleBorderMetadataSave(page)
      const { disk, style } = expectWidthOnDisk(0, width)
      expect(style).toMatchObject({ tableIndex: 0, borderWidth: width })
      expect(typeof style?.fingerprint).toBe('string')
      expect(disk.styles.filter((entry) => entry.tableIndex !== 0)).toEqual(beforeStyles)
      expect(disk.metadata.tables).toEqual([{ tableIndex: 11, fingerprint: 'fixture-border-title', columns: [100, 120, 140], style: { fixtureLegacy: 'keep-border-title-layout' } }])
      expect(disk.metadata.tableColors).toEqual([{ tableIndex: 11, fingerprint: 'fixture-border-title', cells: { '0,0': '#ffeeaa' }, columns: { '1': { color: '#d6ffd6', rank: 3 } } }])
      expect(disk.metadata.preserveUnknown).toBe('keep-me')

      await page.getByTitle('Back', { exact: true }).click()
      editor = await openBordersDocument(page)
      await expect(tableTarget(editor, 0)).toHaveCSS('--rv-office-table-border-width', `${width}px`)
      const reopenedTrigger = await openBorderWithPointer(editor, 0)
      await expect(reopenedTrigger).toHaveAttribute(
        'aria-label',
        `Border size: current width ${width}px`,
      )
      await expect(borderMenu.getByRole('menuitemradio', { name: `${width}px`, exact: true }))
        .toHaveAttribute('aria-checked', 'true')
      await page.keyboard.press('Escape')
      await expect(rootMenu).toHaveCount(0)
      await expect(editor).toBeFocused()
      expectWidthOnDisk(0, width)
    }

    await resetBorderObservation(page)
    const canonicalWidthBytes = fs.readFileSync(fixture.path)
    await chooseWidth(editor, 1, 2)
    await expectNoBorderMetadataSave(page)
    expect(fs.readFileSync(fixture.path)).toEqual(canonicalWidthBytes)

    await resetBorderObservation(page)
    const beforeInvalidWidth = readBorderDisk(fixture.path).styles
    await chooseWidth(editor, 5, 1)
    await expect(tableTarget(editor, 5)).toHaveCSS('--rv-office-table-border-width', '1px')
    await expectSingleBorderMetadataSave(page)
    const invalidWidthStyle = expectWidthOnDisk(5, 1).style
    expect(invalidWidthStyle).toMatchObject({ borderWidth: 1, borderColor: '#004e89' })
    expect(readBorderDisk(fixture.path).styles.filter((entry) => entry.tableIndex !== 5))
      .toEqual(beforeInvalidWidth.filter((entry) => entry.tableIndex !== 5))

    await resetBorderObservation(page)
    await chooseWidth(editor, 6, 3, true)
    await expect(tableTarget(editor, 6)).toHaveCSS('--rv-office-table-border-width', '3px')
    await expectSingleBorderMetadataSave(page)
    const invalidColorStyle = expectWidthOnDisk(6, 3).style
    expect(invalidColorStyle).not.toHaveProperty('borderColor')
    expect(invalidColorStyle).toMatchObject({ borderWidth: 3 })

    await resetBorderObservation(page)
    await chooseWidth(editor, 2, 2)
    await expectSingleBorderMetadataSave(page)
    expect(expectWidthOnDisk(2, 2).style).toMatchObject({ borderColor: '#004e89' })

    await resetBorderObservation(page)
    const noneTrigger = await openBorderWithPointer(editor, 4)
    await expect(noneTrigger).toHaveAttribute(
      'aria-label',
      'Border size: current width 4px. The editor guide uses 4px and output has no border.',
    )
    await borderMenu.getByRole('menuitemradio', { name: '2px', exact: true }).click()
    await expect(tableTarget(editor, 4)).toHaveCSS('--rv-office-table-border-width', '2px')
    await expect(tableTarget(editor, 4)).toHaveAttribute('data-rv-table-border-style', 'dotted')
    await expect(tableTarget(editor, 4)).toHaveAttribute('data-rv-table-border-color', 'none')
    await expectSingleBorderMetadataSave(page)
    expect(expectWidthOnDisk(4, 2).style).toMatchObject({ borderColor: null })

    await page.getByTitle('Back', { exact: true }).click()
    editor = await openBordersDocument(page)
    await expect(tableTarget(editor, 4)).toHaveCSS('--rv-office-table-border-width', '2px')
    const reopenedNoneTrigger = await openBorderWithKeyboard(editor, 4)
    await expect(reopenedNoneTrigger).toHaveAttribute(
      'aria-label',
      'Border size: current width 2px. The editor guide uses 2px and output has no border.',
    )
    await expect(borderMenu.getByRole('menuitemradio', { name: '2px', exact: true }))
      .toBeFocused()
    await page.keyboard.press('ArrowLeft')
    await expect(reopenedNoneTrigger).toBeFocused()
    await expect(borderMenu).toHaveCount(0)
    await page.keyboard.press('Escape')
    await expect(rootMenu).toHaveCount(0)
    await expect(editor).toBeFocused()

    await resetBorderObservation(page)
    await chooseWidth(editor, 4, 3)
    await expectSingleBorderMetadataSave(page)
    expect(expectWidthOnDisk(4, 3).style).toMatchObject({ borderColor: null })

    const beforeParagraph = editor.locator('p').filter({ hasText: 'Before borders.' }).first()
    await resetBorderObservation(page)
    await beforeParagraph.click()
    await page.keyboard.press('End')
    await page.keyboard.type(' history-unit')
    await expectSingleTextSave()
    expect(readBorderDisk(fixture.path).body).toContain('Before borders. history-unit')
    expectWidthOnDisk(4, 3)

    await resetBorderObservation(page)
    await page.keyboard.press('ControlOrMeta+z')
    await expect(beforeParagraph).toHaveText('Before borders.')
    await expect(tableTarget(editor, 4)).toHaveCSS('--rv-office-table-border-width', '3px')
    await expectSingleTextSave()
    expectWidthOnDisk(4, 3)

    await resetBorderObservation(page)
    await page.keyboard.press('ControlOrMeta+z')
    await expect(tableTarget(editor, 4)).toHaveCSS('--rv-office-table-border-width', '2px')
    await expectSingleBorderMetadataSave(page)
    expect(expectWidthOnDisk(4, 2).style).toMatchObject({ borderColor: null })

    await resetBorderObservation(page)
    await page.keyboard.press('ControlOrMeta+Shift+z')
    await expect(tableTarget(editor, 4)).toHaveCSS('--rv-office-table-border-width', '3px')
    await expectSingleBorderMetadataSave(page)
    expect(expectWidthOnDisk(4, 3).style).toMatchObject({ borderColor: null })

    await resetBorderObservation(page)
    await page.keyboard.press('ControlOrMeta+Shift+z')
    await expect(beforeParagraph).toContainText('Before borders. history-unit')
    await expectSingleTextSave()
    expect(readBorderDisk(fixture.path).body).toContain('Before borders. history-unit')
    expectWidthOnDisk(4, 3)

    await page.getByTitle('Back', { exact: true }).click()
    editor = await openBordersDocument(page)
    await expect(tableTarget(editor, 4)).toHaveCSS('--rv-office-table-border-width', '3px')
    await expect(editor.locator('p').filter({ hasText: 'Before borders. history-unit' })).toHaveCount(1)
    const finalNoneTrigger = await openBorderWithPointer(editor, 4)
    await expect(finalNoneTrigger).toHaveAttribute(
      'aria-label',
      'Border size: current width 3px. The editor guide uses 3px and output has no border.',
    )
    await expect(borderMenu.getByRole('menuitemradio', { name: '3px', exact: true }))
      .toHaveAttribute('aria-checked', 'true')
    await page.keyboard.press('Escape')
    expect(expectWidthOnDisk(4, 3).style).toMatchObject({ borderColor: null })

    expect(initialStyles.find((entry) => entry.tableIndex === 11)).toEqual(
      readBorderDisk(fixture.path).styles.find((entry) => entry.tableIndex === 11),
    )
  } finally {
    await page.close()
    fs.writeFileSync(fixture.path, canonicalBytes)
    await resetBordersFixture()
  }
})

test('[slice 09.3] Border color uses Default, Google, Custom, and None with exact history, print, and reopen state', async ({ page }) => {
  test.setTimeout(360_000)
  const fixture = await resetBordersFixture()
  const canonicalBytes = fs.readFileSync(fixture.path)
  const workspaceRoot = fixture.path.slice(0, fixture.path.indexOf(`${path.sep}ai${path.sep}`))
  const palettePath = path.join(
    workspaceRoot,
    'ai',
    'Office-E2E',
    'System',
    'config',
    'colors.json',
  )
  fs.mkdirSync(path.dirname(palettePath), { recursive: true })
  fs.writeFileSync(palettePath, `${JSON.stringify({
    custom_colors: ['#aa0001'],
    sync_enabled: false,
  }, null, 2)}\n`)
  await installReadOnlyWriteObservation(page)

  const rootMenu = page.getByRole('menu', { name: 'Table cell actions' })
  const tableMenu = page.getByRole('menu', { name: 'Table', exact: true })
  const popover = page.locator('.rv-office-color-popover')
  const tableTarget = (editor: ReturnType<Page['locator']>, index: number) => (
    editor.locator('table.rv-office-table').nth(index)
  )
  const openColorPicker = async (editor: ReturnType<Page['locator']>, tableIndex: number) => {
    const cell = tableTarget(editor, tableIndex).locator('tbody > tr').last().locator('td, th').first()
    await cell.click({ button: 'right' })
    await expect(rootMenu).toBeVisible()
    await rootMenu.getByRole('menuitem', { name: 'Table', exact: true }).hover()
    await expect(tableMenu).toBeVisible()
    const trigger = tableMenu.getByRole('menuitem', { name: /Border color: current color/ })
    await trigger.click()
    await expect(popover).toBeVisible()
    return trigger
  }
  const chooseColor = async (
    editor: ReturnType<Page['locator']>,
    tableIndex: number,
    color: string | null,
    custom = false,
  ) => {
    await openColorPicker(editor, tableIndex)
    if (color === null) {
      await popover.locator('.rv-office-color-none').click()
    } else {
      const source = custom ? '[data-palette-source="custom"]' : ''
      await popover.locator(`.rv-office-color-swatch${source}[title="${color}"]`).first().click()
    }
    await expect(popover).toHaveCount(0)
    await expect(rootMenu).toHaveCount(0)
    await expect(editor).toBeFocused()
  }
  const expectSingleTextSave = async () => {
    await expect.poll(async () => (await readBorderObservation(page)).saves, {
      timeout: 15_000,
    }).toBe(1)
    await page.waitForTimeout(650)
    expect(await readBorderObservation(page)).toEqual({ saves: 1, events: {} })
  }
  const expectStyleColor = (tableIndex: number, color: string | null) => {
    const style = readBorderDisk(fixture.path).styles.find((entry) => entry.tableIndex === tableIndex)
    expect(style?.borderColor).toBe(color)
    return style
  }
  const stylesExcept = (tableIndex: number) => (
    readBorderDisk(fixture.path).styles.filter((entry) => entry.tableIndex !== tableIndex)
  )
  const verifyPickerState = async (
    editor: ReturnType<Page['locator']>,
    tableIndex: number,
    summary: string,
    activeSelector: string,
  ) => {
    const trigger = await openColorPicker(editor, tableIndex)
    await expect(trigger).toHaveAttribute('aria-label', `Border color: current color ${summary}`)
    await expect(trigger.locator('.rv-office-table-context-current')).toHaveText(summary)
    await expect(popover.locator('[data-active="true"]')).toHaveCount(1)
    await expect(popover.locator(activeSelector)).toHaveAttribute('data-active', 'true')
    await page.keyboard.press('Escape')
    await expect(rootMenu).toHaveCount(0)
    await expect(editor).toBeFocused()
  }
  const interleaveAndVerifyHistory = async (
    editor: ReturnType<Page['locator']>,
    tableIndex: number,
    selectedColor: string | null,
    previousColor: string,
    suffix: string,
  ) => {
    const beforeParagraph = editor.locator('p').filter({ hasText: 'Before borders.' }).first()
    await resetBorderObservation(page)
    await beforeParagraph.click()
    await page.keyboard.press('End')
    await page.keyboard.type(suffix)
    await expectSingleTextSave()
    expect(readBorderDisk(fixture.path).body).toContain(suffix)

    await resetBorderObservation(page)
    await page.keyboard.press('ControlOrMeta+z')
    await expect(beforeParagraph).not.toContainText(suffix)
    await expectSingleTextSave()
    expectStyleColor(tableIndex, selectedColor)

    await resetBorderObservation(page)
    await page.keyboard.press('ControlOrMeta+z')
    await expect(tableTarget(editor, tableIndex)).toHaveCSS(
      '--rv-office-table-border-color',
      previousColor,
    )
    await expectSingleBorderMetadataSave(page)
    expectStyleColor(tableIndex, previousColor)

    await resetBorderObservation(page)
    await page.keyboard.press('ControlOrMeta+Shift+z')
    await expect(tableTarget(editor, tableIndex)).toHaveCSS(
      '--rv-office-table-border-color',
      selectedColor ?? '#cccccc',
    )
    await expectSingleBorderMetadataSave(page)
    expectStyleColor(tableIndex, selectedColor)

    await resetBorderObservation(page)
    await page.keyboard.press('ControlOrMeta+Shift+z')
    await expect(beforeParagraph).toContainText(suffix)
    await expectSingleTextSave()
    expectStyleColor(tableIndex, selectedColor)
  }

  try {
    let editor = await openBordersDocument(page)
    const initial = readBorderDisk(fixture.path)
    const initialTables = structuredClone(initial.metadata.tables)
    const initialColors = structuredClone(initial.metadata.tableColors)
    const initialTitleStyle = structuredClone(
      initial.styles.find((entry) => entry.tableIndex === 11),
    ) as Record<string, unknown>

    const defaultTrigger = await openColorPicker(editor, 0)
    await expect(defaultTrigger).toHaveAttribute(
      'aria-label',
      'Border color: current color Default',
    )
    await expect(defaultTrigger.locator('.rv-office-table-context-current')).toHaveText('Default')
    await expect(tableMenu.locator(':scope > [role="menuitem"], :scope > [role="menuitemradio"]'))
      .toHaveText([
      'variable_addAdd title row',
      'border_allBorder size1pxchevron_right',
      'border_allBorder colorDefault',
      'align_horizontal_leftAlign table leftcheck',
      'align_horizontal_centerAlign table center',
      'align_horizontal_rightAlign table right',
      'format_text_overflowOverflowOverflowchevron_right',
      'deleteRemove table',
    ])
    await expect(popover.locator('[data-active="true"]')).toHaveCount(0)
    await expect(popover.locator('.rv-office-color-none')).toHaveAttribute('aria-pressed', 'false')
    await expect(popover.getByRole('button', { name: /^(Default|Reset)$/ })).toHaveCount(0)
    await page.keyboard.press('Escape')

    const invalidTrigger = await openColorPicker(editor, 6)
    await expect(invalidTrigger).toHaveAttribute(
      'aria-label',
      'Border color: current color Default',
    )
    await expect(popover.locator('[data-active="true"]')).toHaveCount(0)
    await page.keyboard.press('Escape')

    const beforeInvalidSiblings = stylesExcept(6)
    await resetBorderObservation(page)
    await chooseColor(editor, 6, '#ff0000')
    await expect(tableTarget(editor, 6)).toHaveCSS('--rv-office-table-border-width', '2px')
    await expect(tableTarget(editor, 6)).toHaveCSS('--rv-office-table-border-color', '#ff0000')
    await expectSingleBorderMetadataSave(page)
    expect(expectStyleColor(6, '#ff0000')).toMatchObject({ borderWidth: 2 })
    expect(stylesExcept(6)).toEqual(beforeInvalidSiblings)

    const canonicalInvalidBytes = fs.readFileSync(fixture.path)
    await resetBorderObservation(page)
    await chooseColor(editor, 6, '#ff0000')
    await expectNoBorderMetadataSave(page)
    expect(fs.readFileSync(fixture.path)).toEqual(canonicalInvalidBytes)

    const beforeGoogleSiblings = stylesExcept(7)
    await resetBorderObservation(page)
    await chooseColor(editor, 7, '#ff0000')
    await expect(tableTarget(editor, 7)).toHaveCSS('--rv-office-table-border-width', '1px')
    await expect(tableTarget(editor, 7)).toHaveAttribute('data-rv-table-border-style', 'solid')
    await expectSingleBorderMetadataSave(page)
    expect(expectStyleColor(7, '#ff0000')).toMatchObject({ borderWidth: 1 })
    expect(stylesExcept(7)).toEqual(beforeGoogleSiblings)
    await interleaveAndVerifyHistory(editor, 7, '#ff0000', '#4a86e8', ' google-history')

    await page.getByTitle('Back', { exact: true }).click()
    editor = await openBordersDocument(page)
    await verifyPickerState(
      editor,
      7,
      '#ff0000',
      '.rv-office-color-swatch[title="#ff0000"]',
    )

    const beforeCustomSiblings = stylesExcept(8)
    await resetBorderObservation(page)
    await chooseColor(editor, 8, '#aa0001', true)
    await expect(tableTarget(editor, 8)).toHaveCSS('--rv-office-table-border-width', '2px')
    await expect(tableTarget(editor, 8)).toHaveCSS('--rv-office-table-border-color', '#aa0001')
    await expectSingleBorderMetadataSave(page)
    expect(expectStyleColor(8, '#aa0001')).toMatchObject({ borderWidth: 2 })
    expect(stylesExcept(8)).toEqual(beforeCustomSiblings)
    await interleaveAndVerifyHistory(editor, 8, '#aa0001', '#4a86e8', ' custom-history')

    await page.getByTitle('Back', { exact: true }).click()
    editor = await openBordersDocument(page)
    await verifyPickerState(
      editor,
      8,
      '#aa0001',
      '.rv-office-color-swatch[data-palette-source="custom"][title="#aa0001"]',
    )

    const beforeNoneSiblings = stylesExcept(11)
    await resetBorderObservation(page)
    await chooseColor(editor, 11, null)
    const titleTable = tableTarget(editor, 11)
    await expect(titleTable).toHaveCSS('--rv-office-table-border-width', '4px')
    await expect(titleTable).toHaveCSS('--rv-office-table-border-color', '#cccccc')
    await expect(titleTable).toHaveAttribute('data-rv-table-border-style', 'dotted')
    await expectSingleBorderMetadataSave(page)
    expect(expectStyleColor(11, null)).toEqual({ ...initialTitleStyle, borderColor: null })
    expect(stylesExcept(11)).toEqual(beforeNoneSiblings)
    await verifyPickerState(editor, 11, 'None', '.rv-office-color-none')

    await page.emulateMedia({ media: 'print' })
    expect(await titleTable.locator('tbody > tr').first().locator('th').evaluate((cell) => (
      getComputedStyle(cell, '::after').borderTopWidth
    ))).toBe('0px')
    await page.emulateMedia({ media: 'screen' })
    expect(await titleTable.locator('tbody > tr').first().locator('th').evaluate((cell) => {
      const style = getComputedStyle(cell, '::after')
      return [style.borderTopWidth, style.borderTopStyle, style.borderTopColor]
    })).toEqual(['4px', 'dotted', 'rgb(204, 204, 204)'])

    await interleaveAndVerifyHistory(editor, 11, null, '#4a86e8', ' none-history')
    await page.getByTitle('Back', { exact: true }).click()
    editor = await openBordersDocument(page)
    await verifyPickerState(editor, 11, 'None', '.rv-office-color-none')

    const beforeRealSiblings = stylesExcept(11)
    await resetBorderObservation(page)
    await chooseColor(editor, 11, '#ff0000')
    await expect(tableTarget(editor, 11)).toHaveCSS('--rv-office-table-border-width', '4px')
    await expect(tableTarget(editor, 11)).toHaveCSS('--rv-office-table-border-color', '#ff0000')
    await expect(tableTarget(editor, 11)).toHaveAttribute('data-rv-table-border-style', 'solid')
    await expectSingleBorderMetadataSave(page)
    expect(expectStyleColor(11, '#ff0000')).toEqual({
      ...initialTitleStyle,
      borderColor: '#ff0000',
    })
    expect(stylesExcept(11)).toEqual(beforeRealSiblings)

    await page.getByTitle('Back', { exact: true }).click()
    editor = await openBordersDocument(page)
    await verifyPickerState(
      editor,
      11,
      '#ff0000',
      '.rv-office-color-swatch[title="#ff0000"]',
    )
    await expect(tableTarget(editor, 11).locator('tbody > tr').first().locator('th'))
      .toHaveAttribute('colspan', '3')
    expect(readBorderDisk(fixture.path).metadata.tables).toEqual(initialTables)
    expect(readBorderDisk(fixture.path).metadata.tableColors).toEqual(initialColors)
    expect(readBorderDisk(fixture.path).metadata.preserveUnknown).toBe('keep-me')
  } finally {
    await page.close()
    fs.writeFileSync(fixture.path, canonicalBytes)
    await resetBordersFixture()
  }
})

test('[slice 09.3] detached and identity-shifted color targets fail closed without publication or save', async ({ page }) => {
  test.setTimeout(120_000)
  const fixture = await resetBordersFixture()
  const canonicalBytes = fs.readFileSync(fixture.path)
  await installReadOnlyWriteObservation(page)

  try {
    const editor = await openBordersDocument(page)
    const openCapturedPicker = async () => {
      const table = editor.locator('table.rv-office-table').nth(7)
      await table.locator('tbody > tr').last().locator('td').first().click({ button: 'right' })
      const rootMenu = page.getByRole('menu', { name: 'Table cell actions' })
      await rootMenu.getByRole('menuitem', { name: 'Table', exact: true }).hover()
      await page.getByRole('menu', { name: 'Table', exact: true })
        .getByRole('menuitem', { name: /Border color: current color/ }).click()
      await expect(page.locator('.rv-office-color-popover')).toBeVisible()
    }

    await openCapturedPicker()
    await page.evaluate(() => {
      const target = document.querySelectorAll<HTMLTableElement>('table.rv-office-table')[7]
      const choice = document.querySelector<HTMLButtonElement>(
        '.rv-office-color-popover .rv-office-color-swatch[title="#ff0000"]',
      )
      const parent = target?.parentNode
      const next = target?.nextSibling ?? null
      if (!target || !choice || !parent) throw new Error('detached color target controls unavailable')
      target.remove()
      choice.click()
      parent.insertBefore(target, next)
    })
    await expectNoBorderMetadataSave(page)
    expect(fs.readFileSync(fixture.path)).toEqual(canonicalBytes)
    await page.keyboard.press('Escape')

    await openCapturedPicker()
    await page.evaluate(() => {
      const target = document.querySelectorAll<HTMLTableElement>('table.rv-office-table')[7]
      const cell = target?.rows[0]?.cells[0]
      const choice = document.querySelector<HTMLButtonElement>(
        '.rv-office-color-popover .rv-office-color-swatch[title="#ff0000"]',
      )
      const text = cell?.textContent ?? ''
      if (!target || !cell || !choice) throw new Error('identity-shift color target controls unavailable')
      cell.textContent = `${text}-identity-shift`
      choice.click()
      cell.textContent = text
    })
    await expectNoBorderMetadataSave(page)
    expect(fs.readFileSync(fixture.path)).toEqual(canonicalBytes)
    await page.keyboard.press('Escape')
    await expect(editor).toBeFocused()
  } finally {
    await page.close()
    await resetBordersFixture()
  }
})

test('[slice 09.4] borders survive resize styles colors structure history rebuild print and reopen', async ({ page }) => {
  test.setTimeout(600_000)
  const fixture = await resetBordersFixture()
  const canonicalBytes = fs.readFileSync(fixture.path)
  await installReadOnlyWriteObservation(page)

  const rootMenu = page.getByRole('menu', { name: 'Table cell actions' })
  const tableMenu = page.getByRole('menu', { name: 'Table', exact: true })
  const borderMenu = page.getByRole('menu', { name: 'Border size', exact: true })
  const popover = page.locator('.rv-office-color-popover')
  const tableAt = (editor: ReturnType<Page['locator']>, index: number) => (
    editor.locator('table.rv-office-table').nth(index)
  )
  const cellAt = (
    table: ReturnType<Page['locator']>,
    row: number,
    column: number,
  ) => table.locator('tbody > tr').nth(row).locator('td, th').nth(column)
  const openRootMenu = async (
    table: ReturnType<Page['locator']>,
    row: number,
    column: number,
  ) => {
    const cell = cellAt(table, row, column)
    await cell.scrollIntoViewIfNeeded()
    await page.mouse.move(0, 0)
    // A spanning title cell's geometric center can coincide exactly with a
    // column-resize grab strip. Use an interior point, like a real pointer,
    // so the contextmenu event reaches the cell instead of resize chrome.
    await cell.click({ button: 'right', position: { x: 20, y: 12 }, timeout: 10_000 })
    await expect(rootMenu).toBeVisible()
  }
  const openTableMenu = async (
    table: ReturnType<Page['locator']>,
    row = table.locator('tbody > tr').count().then((count) => count - 1),
    column = 0,
  ) => {
    await openRootMenu(table, await row, column)
    await rootMenu.getByRole('menuitem', { name: 'Table', exact: true }).hover()
    await expect(tableMenu).toBeVisible()
  }
  const chooseWidth = async (
    table: ReturnType<Page['locator']>,
    width: 1 | 2 | 3 | 4,
  ) => {
    await openTableMenu(table)
    await tableMenu.getByRole('menuitem', { name: /Border size: current width/ }).hover()
    await expect(borderMenu).toBeVisible()
    await borderMenu.getByRole('menuitemradio', { name: `${width}px`, exact: true }).click()
  }
  const chooseBorderColor = async (
    table: ReturnType<Page['locator']>,
    color: string | null,
  ) => {
    await openTableMenu(table)
    await tableMenu.getByRole('menuitem', { name: /Border color: current color/ }).click()
    await expect(popover).toBeVisible()
    if (color === null) await popover.locator('.rv-office-color-none').click()
    else await popover.locator(`.rv-office-color-swatch[title="${color}"]`).first().click()
  }
  const chooseOverflow = async (
    table: ReturnType<Page['locator']>,
    mode: 'Overflow' | 'Truncate' | 'New line',
  ) => {
    await openTableMenu(table)
    await tableMenu.getByRole('menuitem', { name: /Overflow: current mode/ }).hover()
    await page.getByRole('menu', { name: 'Overflow', exact: true })
      .getByRole('menuitemradio', { name: mode, exact: true }).click()
  }
  const chooseBackground = async (
    table: ReturnType<Page['locator']>,
    row: number,
    column: number,
    scope: 'Cell' | 'Row' | 'Column',
    color: string,
  ) => {
    await openRootMenu(table, row, column)
    await rootMenu.getByRole('menuitem', { name: `${scope} Background`, exact: true }).click()
    await expect(popover).toBeVisible()
    await popover.locator(`.rv-office-color-swatch[title="${color}"]`).first().click()
  }
  const runStructureAction = async (
    table: ReturnType<Page['locator']>,
    row: number,
    column: number,
    action: string,
  ) => {
    await openRootMenu(table, row, column)
    await rootMenu.getByRole('menuitem', { name: action, exact: true }).click()
  }
  const captureUsedGeometry = (table: ReturnType<Page['locator']>) => table.evaluate((element) => (
    Array.from(element.querySelectorAll<HTMLElement>(':scope, col, tr, th, td')).map((node) => {
      const rect = node.getBoundingClientRect()
      return [node.tagName, rect.width, rect.height, getComputedStyle(node).minWidth]
    })
  ))
  const expectBorderEntry = (
    tableIndex: number,
    expected: Record<string, unknown>,
  ) => {
    const entry = readBorderDisk(fixture.path).styles.find((style) => style.tableIndex === tableIndex)
    expect(entry).toMatchObject(expected)
    return entry
  }
  const expectExactBorderChrome = async (
    table: ReturnType<Page['locator']>,
    width: number,
    color: string,
    state: 'color' | 'none',
    style: 'solid' | 'dotted',
  ) => {
    await expect(table).toHaveCSS('--rv-office-table-border-width', `${width}px`)
    await expect(table).toHaveCSS('--rv-office-table-border-color', color)
    await expect(table).toHaveAttribute('data-rv-table-border-color', state)
    await expect(table).toHaveAttribute('data-rv-table-border-style', style)
  }
  const hoverGeometry = async (table: ReturnType<Page['locator']>, handles: number) => {
    const box = await table.boundingBox()
    if (!box) throw new Error('Border regression table has no bounding box')
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await expect(page.locator('.rv-office-table-overlay .rv-office-col-grab')).toHaveCount(handles)
  }
  const dragBoundary = async (boundaryIndex: number, delta: number) => {
    const handle = page.locator('.rv-office-table-overlay .rv-office-col-grab').nth(boundaryIndex)
    const box = await handle.boundingBox()
    if (!box) throw new Error(`Border regression boundary ${boundaryIndex} has no box`)
    const x = box.x + box.width / 2
    const y = box.y + box.height / 2
    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.move(x + delta, y)
    await page.mouse.up()
  }
  const assertNoEditableBorderWrites = async (table: ReturnType<Page['locator']>) => {
    expect(await table.locator('tr, th, td').evaluateAll((nodes) => nodes.every((node) => {
      const style = node.getAttribute('style')
      return !node.getAttribute('class')?.includes('border')
        && !style?.includes('border')
        && !style?.includes('--rv-office-table-border')
        && !Array.from(node.attributes).some(({ name }) => name.startsWith('data-rv-table-border'))
    }))).toBe(true)
  }

  try {
    let editor = await openBordersDocument(page)
    let tables = editor.locator('table.rv-office-table')
    await expect(tables).toHaveCount(12)

    // Clamp table 0's right column to the canonical square minimum, then prove
    // every border transition is paint-only even at that geometry boundary.
    let squareTable = tableAt(editor, 0)
    await hoverGeometry(squareTable, 3)
    await resetBorderObservation(page)
    await dragBoundary(2, -10_000)
    await expectSingleBorderMetadataSave(page)
    const squareEvidence = await squareTable.evaluate((element) => {
      const table = element as HTMLTableElement
      const scale = table.getBoundingClientRect().width / table.offsetWidth
      const columns = Array.from(table.querySelectorAll<HTMLTableColElement>(':scope > colgroup > col'))
        .map((column) => column.getBoundingClientRect().width / scale)
      const dataCell = table.rows[1]?.cells[1]
      if (!dataCell) throw new Error('Square-minimum border table lacks its target cell')
      return {
        minimum: Number.parseFloat(table.style.getPropertyValue('--rv-office-table-cell-min-width')),
        column: columns[1],
        cellWidth: dataCell.getBoundingClientRect().width / scale,
        cellHeight: dataCell.getBoundingClientRect().height / scale,
      }
    })
    expect(squareEvidence.minimum).toBeGreaterThan(0)
    expect(Math.abs(squareEvidence.column - squareEvidence.minimum)).toBeLessThanOrEqual(1)
    expect(Math.abs(squareEvidence.cellWidth - squareEvidence.minimum)).toBeLessThanOrEqual(1)
    const squareGeometry = await captureUsedGeometry(squareTable)

    await resetBorderObservation(page)
    await chooseWidth(squareTable, 4)
    await expectSingleBorderMetadataSave(page)
    expect(await captureUsedGeometry(squareTable)).toEqual(squareGeometry)
    await resetBorderObservation(page)
    await chooseBorderColor(squareTable, '#ff0000')
    await expectSingleBorderMetadataSave(page)
    expect(await captureUsedGeometry(squareTable)).toEqual(squareGeometry)
    await expectExactBorderChrome(squareTable, 4, '#ff0000', 'color', 'solid')
    let pixels = PNG.sync.read(await squareTable.screenshot({ animations: 'disabled' }))
    for (const edge of ['top', 'right', 'bottom', 'left'] as const) {
      expect(edgeRun(pixels, [255, 0, 0], edge)).toBe(4)
    }

    await resetBorderObservation(page)
    await chooseBorderColor(squareTable, null)
    await expectSingleBorderMetadataSave(page)
    expect(await captureUsedGeometry(squareTable)).toEqual(squareGeometry)
    await expectExactBorderChrome(squareTable, 4, '#cccccc', 'none', 'dotted')
    pixels = PNG.sync.read(await squareTable.screenshot({ animations: 'disabled' }))
    for (const edge of ['top', 'right', 'bottom', 'left'] as const) {
      expect(edgeRun(pixels, [204, 204, 204], edge, 16)).toBe(4)
    }
    await page.emulateMedia({ media: 'print' })
    expect(await cellAt(squareTable, 0, 0).evaluate((cell) => (
      getComputedStyle(cell, '::after').borderTopWidth
    ))).toBe('0px')
    await page.emulateMedia({ media: 'screen' })

    await resetBorderObservation(page)
    await chooseWidth(squareTable, 1)
    await expectSingleBorderMetadataSave(page)
    expect(await captureUsedGeometry(squareTable)).toEqual(squareGeometry)
    await expectExactBorderChrome(squareTable, 1, '#cccccc', 'none', 'dotted')
    expect(expectBorderEntry(0, { borderWidth: 1, borderColor: null })).toHaveProperty('fingerprint')

    await resetBorderObservation(page)
    await page.keyboard.press('ControlOrMeta+z')
    await expectSingleBorderMetadataSave(page)
    await expectExactBorderChrome(squareTable, 4, '#cccccc', 'none', 'dotted')
    expect(await captureUsedGeometry(squareTable)).toEqual(squareGeometry)
    await resetBorderObservation(page)
    await page.keyboard.press('ControlOrMeta+Shift+z')
    await expectSingleBorderMetadataSave(page)
    await expectExactBorderChrome(squareTable, 1, '#cccccc', 'none', 'dotted')

    await openTableMenu(squareTable)
    const widthTrigger = tableMenu.getByRole('menuitem', { name: /Border size: current width/ })
    await expect(widthTrigger).toHaveAttribute(
      'aria-label',
      'Border size: current width 1px. The editor guide uses 1px and output has no border.',
    )
    await widthTrigger.hover()
    await expect(borderMenu.getByRole('menuitemradio', { name: '1px', exact: true }))
      .toHaveAttribute('aria-checked', 'true')
    await page.keyboard.press('ArrowLeft')
    await tableMenu.getByRole('menuitem', { name: 'Border color: current color None', exact: true }).click()
    await expect(popover.locator('.rv-office-color-none')).toHaveAttribute('data-active', 'true')
    await page.keyboard.press('Escape')

    // Interleave every accepted table domain on the seeded title table.
    let titleTable = tableAt(editor, 11)
    const initialTitleStyle = structuredClone(expectBorderEntry(11, {
      titleRow: true,
      tableOverflow: 'newline',
      tableAlignment: 'right',
      borderWidth: 4,
      borderColor: '#4a86e8',
      fixtureSeed: 'keep-border-title',
    })) as Record<string, unknown>
    await resetBorderObservation(page)
    await chooseOverflow(titleTable, 'Truncate')
    await expectSingleBorderMetadataSave(page)
    expectBorderEntry(11, {
      ...initialTitleStyle,
      tableOverflow: 'truncate',
    })
    await expectExactBorderChrome(titleTable, 4, '#4a86e8', 'color', 'solid')

    for (const [scope, row, column, color] of [
      ['Cell', 0, 0, '#ff0000'],
      ['Row', 2, 0, '#00ff00'],
      ['Column', 2, 1, '#0000ff'],
    ] as const) {
      await resetBorderObservation(page)
      await chooseBackground(titleTable, row, column, scope, color)
      await expectSingleBorderMetadataSave(page)
      expectBorderEntry(11, {
        tableAlignment: 'right',
        borderWidth: 4,
        borderColor: '#4a86e8',
      })
    }
    await expect(cellAt(titleTable, 0, 0)).toHaveCSS('background-color', 'rgb(255, 0, 0)')
    await expect(cellAt(titleTable, 2, 0)).toHaveCSS('background-color', 'rgb(0, 255, 0)')
    await expect(cellAt(titleTable, 2, 1)).toHaveCSS('background-color', 'rgb(0, 0, 255)')
    await expect(cellAt(titleTable, 2, 2)).toHaveCSS('background-color', 'rgb(0, 255, 0)')

    await hoverGeometry(titleTable, 4)
    const widthsBeforeResize = (readBorderDisk(fixture.path).metadata.tables as Array<Record<string, unknown>>)
      .find((entry) => entry.tableIndex === 11)?.columns as number[]
    await resetBorderObservation(page)
    await dragBoundary(1, 12)
    await expectSingleBorderMetadataSave(page)
    const widthsAfterResize = (readBorderDisk(fixture.path).metadata.tables as Array<Record<string, unknown>>)
      .find((entry) => entry.tableIndex === 11)?.columns as number[]
    expect(widthsAfterResize).not.toEqual(widthsBeforeResize)
    expect(widthsAfterResize.reduce((sum, width) => sum + width, 0))
      .toBe(widthsBeforeResize.reduce((sum, width) => sum + width, 0))
    expectBorderEntry(11, {
      tableAlignment: 'right', borderWidth: 4, borderColor: '#4a86e8', tableOverflow: 'truncate',
    })
    await resetBorderObservation(page)
    await page.keyboard.press('ControlOrMeta+z')
    await expectSingleBorderMetadataSave(page)
    expect((readBorderDisk(fixture.path).metadata.tables as Array<Record<string, unknown>>)
      .find((entry) => entry.tableIndex === 11)?.columns).toEqual(widthsBeforeResize)
    await resetBorderObservation(page)
    await page.keyboard.press('ControlOrMeta+Shift+z')
    await expectSingleBorderMetadataSave(page)
    expect((readBorderDisk(fixture.path).metadata.tables as Array<Record<string, unknown>>)
      .find((entry) => entry.tableIndex === 11)?.columns).toEqual(widthsAfterResize)

    await resetBorderObservation(page)
    await runStructureAction(titleTable, 1, 1, 'Insert Column Right')
    await expectSingleBorderMetadataSave(page)
    await expect(titleTable.locator(':scope > colgroup > col')).toHaveCount(4)
    await expect(cellAt(titleTable, 0, 0)).toHaveAttribute('colspan', '4')
    expectBorderEntry(11, {
      titleRow: true, tableAlignment: 'right', borderWidth: 4, borderColor: '#4a86e8',
    })
    await resetBorderObservation(page)
    await page.keyboard.press('ControlOrMeta+z')
    await expectSingleBorderMetadataSave(page)
    await expect(titleTable.locator(':scope > colgroup > col')).toHaveCount(3)
    await expect(cellAt(titleTable, 0, 0)).toHaveAttribute('colspan', '3')
    await resetBorderObservation(page)
    await page.keyboard.press('ControlOrMeta+Shift+z')
    await expectSingleBorderMetadataSave(page)
    await expect(titleTable.locator(':scope > colgroup > col')).toHaveCount(4)
    await resetBorderObservation(page)
    await runStructureAction(titleTable, 1, 1, 'Delete Column Right')
    await expectSingleBorderMetadataSave(page)
    await expect(titleTable.locator(':scope > colgroup > col')).toHaveCount(3)
    await expect(cellAt(titleTable, 0, 0)).toHaveAttribute('colspan', '3')

    await resetBorderObservation(page)
    await runStructureAction(titleTable, 1, 0, 'Insert Row Below')
    await expectSingleBorderMetadataSave(page)
    await expect(titleTable.locator('tbody > tr')).toHaveCount(4)
    await resetBorderObservation(page)
    await runStructureAction(titleTable, 1, 0, 'Delete Row Below')
    await expectSingleBorderMetadataSave(page)
    await expect(titleTable.locator('tbody > tr')).toHaveCount(3)
    expectBorderEntry(11, {
      titleRow: true,
      tableOverflow: 'truncate',
      tableAlignment: 'right',
      borderWidth: 4,
      borderColor: '#4a86e8',
      fixtureSeed: 'keep-border-title',
    })

    // Add and delete a title on a second bordered table, then exercise native
    // history so title-marker changes cannot wipe its border siblings.
    const ordinary = tableAt(editor, 10)
    await resetBorderObservation(page)
    await openTableMenu(ordinary, 0, 0)
    await tableMenu.getByRole('menuitem', { name: 'Add title row', exact: true }).click()
    await expectSingleBorderMetadataSave(page)
    await expect(ordinary.locator('tbody > tr')).toHaveCount(3)
    await expect(cellAt(ordinary, 0, 0)).toHaveAttribute('colspan', '2')
    expectBorderEntry(10, { titleRow: true, borderWidth: 4, borderColor: '#4a86e8' })
    await resetBorderObservation(page)
    await openRootMenu(ordinary, 0, 0)
    await rootMenu.getByRole('menuitem', { name: 'Delete Row', exact: true }).click()
    await expectSingleBorderMetadataSave(page)
    await expect(ordinary.locator('tbody > tr')).toHaveCount(2)
    const afterTitleDelete = expectBorderEntry(10, { borderWidth: 4, borderColor: '#4a86e8' })
    expect(afterTitleDelete).not.toHaveProperty('titleRow')
    await resetBorderObservation(page)
    await page.keyboard.press('ControlOrMeta+z')
    await expectSingleBorderMetadataSave(page)
    await expect(cellAt(ordinary, 0, 0)).toHaveAttribute('colspan', '2')
    expectBorderEntry(10, { titleRow: true, borderWidth: 4, borderColor: '#4a86e8' })
    await resetBorderObservation(page)
    await page.keyboard.press('ControlOrMeta+Shift+z')
    await expectSingleBorderMetadataSave(page)
    await expect(ordinary.locator('tbody > tr')).toHaveCount(2)
    expectBorderEntry(10, { borderWidth: 4, borderColor: '#4a86e8' })

    await assertNoEditableBorderWrites(squareTable)
    await assertNoEditableBorderWrites(titleTable)
    await assertNoEditableBorderWrites(ordinary)
    await page.emulateMedia({ media: 'print' })
    expect(await cellAt(squareTable, 0, 0).evaluate((cell) => (
      getComputedStyle(cell, '::after').borderTopWidth
    ))).toBe('0px')
    expect(await cellAt(titleTable, 0, 0).evaluate((cell) => {
      const style = getComputedStyle(cell, '::after')
      return [style.borderTopWidth, style.borderTopStyle, style.borderTopColor]
    })).toEqual(['4px', 'solid', 'rgb(74, 134, 232)'])
    await page.emulateMedia({ media: 'screen' })

    const beforeReopen = readBorderDisk(fixture.path)
    await page.getByTitle('Back', { exact: true }).click()
    editor = await openBordersDocument(page)
    tables = editor.locator('table.rv-office-table')
    squareTable = tableAt(editor, 0)
    titleTable = tableAt(editor, 11)
    await expectExactBorderChrome(squareTable, 1, '#cccccc', 'none', 'dotted')
    await expectExactBorderChrome(titleTable, 4, '#4a86e8', 'color', 'solid')
    await expect(titleTable.locator(':scope > colgroup > col')).toHaveCount(3)
    await expect(cellAt(titleTable, 0, 0)).toHaveAttribute('colspan', '3')
    await expect(titleTable).toHaveAttribute('data-rv-table-overflow', 'truncate')
    await expect(cellAt(titleTable, 0, 0)).toHaveCSS('background-color', 'rgb(255, 0, 0)')
    await expect(cellAt(titleTable, 2, 0)).toHaveCSS('background-color', 'rgb(0, 255, 0)')
    await expect(cellAt(titleTable, 2, 1)).toHaveCSS('background-color', 'rgb(0, 0, 255)')
    expect(readBorderDisk(fixture.path)).toEqual(beforeReopen)
    expectBorderEntry(11, {
      titleRow: true,
      tableOverflow: 'truncate',
      tableAlignment: 'right',
      borderWidth: 4,
      borderColor: '#4a86e8',
      fixtureSeed: 'keep-border-title',
    })
    expect(readBorderDisk(fixture.path).metadata.preserveUnknown).toBe('keep-me')
    await assertNoEditableBorderWrites(squareTable)
    await assertNoEditableBorderWrites(titleTable)
  } finally {
    await page.close()
    fs.writeFileSync(fixture.path, canonicalBytes)
    await resetBordersFixture()
  }
})

test('[slice 09.2] stale detached border target is rejected without metadata publication or save', async ({ page }) => {
  test.setTimeout(90_000)
  const fixture = await resetBordersFixture()
  const canonicalBytes = fs.readFileSync(fixture.path)
  await installReadOnlyWriteObservation(page)

  try {
    const editor = await openBordersDocument(page)
    const table = editor.locator('table.rv-office-table').nth(7)
    await table.locator('tbody > tr').last().locator('td').first().click({ button: 'right' })
    const rootMenu = page.getByRole('menu', { name: 'Table cell actions' })
    await rootMenu.getByRole('menuitem', { name: 'Table', exact: true }).hover()
    const tableMenu = page.getByRole('menu', { name: 'Table', exact: true })
    await tableMenu.getByRole('menuitem', { name: /Border size: current width/ }).hover()
    const borderMenu = page.getByRole('menu', { name: 'Border size', exact: true })
    await expect(borderMenu).toBeVisible()
    await page.evaluate(() => {
      const target = document.querySelectorAll<HTMLTableElement>('table.rv-office-table')[7]
      const choice = Array.from(document.querySelectorAll<HTMLButtonElement>(
        '[role="menu"][aria-label="Border size"] [role="menuitemradio"]',
      )).find((item) => item.textContent?.includes('4px'))
      const parent = target?.parentNode
      const next = target?.nextSibling ?? null
      if (!target || !choice || !parent) throw new Error('stale-target test controls are unavailable')
      target.remove()
      choice.click()
      parent.insertBefore(target, next)
    })
    await expectNoBorderMetadataSave(page)
    expect(fs.readFileSync(fixture.path)).toEqual(canonicalBytes)
    await expect(rootMenu).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(rootMenu).toHaveCount(0)
    await expect(editor).toBeFocused()
  } finally {
    await page.close()
    await resetBordersFixture()
  }
})
