import fs from 'node:fs'

import { Schema } from '@milkdown/kit/prose/model'
import { expect, test, type Page } from '@playwright/test'

import {
  DEFAULT_SETTINGS,
  getDocumentTableStyles,
  getRawDocumentTableStyles,
  parseDocumentSettings,
  serializeDocumentSettings,
  setDocumentTableStyles,
} from '../src/lib/front-matter'
import {
  escapeOfficeTableCellBreakText,
  serializeOfficeTableCellBreak,
  transformOfficeTableCellBreaks,
} from '../src/components/office/officeTableBreakCodec'
import { OfficeTableHardbreakNodeView } from '../src/components/office/officeTableHardbreak'
import { prepareOfficeTableOverflowChange } from '../src/components/office/officeTableDisplay'
import { transformOfficeTableMetadata } from '../src/components/office/officeTableMutations'
import {
  projectOfficeTableOverflowModes,
  projectProseDocumentTableOverflowModes,
} from '../src/components/office/officeTableOverflowProjection'
import { resetOfficePlaywrightScenario } from './office/fixture-lifecycle.mjs'

const OVERFLOW_FILENAME = 'Overflow.md'

type FixtureFile = {
  filename: string
  path: string
}

async function resetOverflowFixture(): Promise<FixtureFile> {
  const files = await resetOfficePlaywrightScenario({
    scenario: 'overflow',
    copies: 1,
    workspaces: 1,
  })
  const fixture = files.find(({ filename }: FixtureFile) => filename === OVERFLOW_FILENAME)
  expect(fixture).toBeTruthy()
  return fixture as FixtureFile
}

async function openOverflowDocument(page: Page) {
  await page.goto('/')
  await page.getByTitle('Office', { exact: true }).click()
  const folder = page.getByTitle('001-Fixtures', { exact: true })
  const document = page.getByTitle(OVERFLOW_FILENAME, { exact: true })
  const editor = page.locator(
    '.rv-office-document-editor .milkdown .ProseMirror[contenteditable="true"]',
  )
  await expect.poll(async () => (
    await folder.isVisible() || await document.isVisible() || await editor.isVisible()
  ), { timeout: 15_000 }).toBe(true)
  if (!await document.isVisible()) {
    await folder.click()
    await expect(document).toBeVisible()
  }
  await document.click()
  await expect(editor).toBeVisible()
  return editor
}

function installSaveObservation(page: Page) {
  return page.addInitScript(() => {
    const originalSend = WebSocket.prototype.send
    const observed = window as typeof window & {
      __overflowSaveCount?: number
      __overflowMetadataEvents?: Record<string, number>
      __officeTableMetadataTestHook?: (event: string) => void
    }
    observed.__overflowSaveCount = 0
    observed.__overflowMetadataEvents = {}
    observed.__officeTableMetadataTestHook = (event) => {
      const events = observed.__overflowMetadataEvents ?? {}
      events[event] = (events[event] ?? 0) + 1
      observed.__overflowMetadataEvents = events
    }
    WebSocket.prototype.send = function observeOverflowSave(data) {
      if (typeof data === 'string') {
        try {
          const message = JSON.parse(data) as { type?: string }
          if (message.type === 'file_save') {
            observed.__overflowSaveCount = (observed.__overflowSaveCount ?? 0) + 1
          }
        } catch {
          // Preserve unrelated non-JSON WebSocket frames.
        }
      }
      return originalSend.call(this, data)
    }
  })
}

function resetOverflowObservation(page: Page) {
  return page.evaluate(() => {
    const observed = window as typeof window & {
      __overflowSaveCount?: number
      __overflowMetadataEvents?: Record<string, number>
    }
    observed.__overflowSaveCount = 0
    observed.__overflowMetadataEvents = {}
  })
}

function readSaveCount(page: Page) {
  return page.evaluate(() => (
    (window as typeof window & { __overflowSaveCount?: number }).__overflowSaveCount ?? 0
  ))
}

function readMetadataEvents(page: Page) {
  return page.evaluate(() => (
    (window as typeof window & {
      __overflowMetadataEvents?: Record<string, number>
    }).__overflowMetadataEvents ?? {}
  ))
}

type OverflowMode = 'overflow' | 'truncate' | 'newline'

async function selectOverflowMode(
  page: Page,
  table: ReturnType<Page['locator']>,
  mode: 'Overflow' | 'Truncate' | 'New line',
) {
  const cell = table.locator('tbody > tr').last().locator('td, th').first()
  await cell.click({ button: 'right' })
  const rootMenu = page.getByRole('menu', { name: 'Table cell actions' })
  await expect(rootMenu).toBeVisible()
  await rootMenu.getByRole('menuitem', { name: 'Table', exact: true }).hover()
  const tableMenu = page.getByRole('menu', { name: 'Table', exact: true })
  await expect(tableMenu).toBeVisible()
  await tableMenu.getByRole('menuitem', { name: /Overflow: current mode/ }).hover()
  const overflowMenu = page.getByRole('menu', { name: 'Overflow', exact: true })
  await expect(overflowMenu).toBeVisible()
  await overflowMenu.getByRole('menuitemradio', { name: mode, exact: true }).click()
}

async function expectSingleOverflowSave(page: Page) {
  await expect.poll(() => readSaveCount(page), { timeout: 15_000 }).toBe(1)
  await page.waitForTimeout(650)
  expect(await readSaveCount(page)).toBe(1)
}

async function expectSingleOverflowMetadataSave(page: Page) {
  await expectSingleOverflowSave(page)
  expect(await readMetadataEvents(page)).toEqual({
    step: 1,
    'plugin-publish': 1,
    'external-publish': 1,
  })
}

function readOverflowDisk(path: string) {
  const bytes = fs.readFileSync(path)
  const parsed = parseDocumentSettings(bytes.toString())
  return {
    bytes,
    body: parsed.body,
    metadata: parsed.frontmatter.metadata as Record<string, unknown>,
    styles: getDocumentTableStyles(parsed.frontmatter) ?? [],
  }
}

test.describe('[slice 07.4] pure ordered overflow projection', () => {
  test('emits exactly one normalized three-field entry per table including defaults', () => {
    const tables = [
      { tableIndex: 7, fingerprint: 'table-live-a' },
      { tableIndex: 4, fingerprint: 'table-live-b' },
      { tableIndex: 9, fingerprint: 'table-live-c' },
    ]
    const styles = [
      {
        tableIndex: 1,
        fingerprint: 'stale-but-indexed-b',
        tableOverflow: 'truncate',
        titleRow: true,
        borderWidth: 4,
        future: { exact: true },
      },
      {
        tableIndex: 2,
        fingerprint: 'table-live-c',
        tableOverflow: 'invalid-future-mode',
        alignment: 'future-center',
      },
    ]
    const frozenTables = structuredClone(tables)
    const frozenStyles = structuredClone(styles)

    expect(projectOfficeTableOverflowModes(tables, styles)).toEqual([
      {
        tableIndex: 0,
        fingerprint: 'table-live-a',
        overflow: 'overflow',
      },
      {
        tableIndex: 1,
        fingerprint: 'table-live-b',
        overflow: 'truncate',
      },
      {
        tableIndex: 2,
        fingerprint: 'table-live-c',
        overflow: 'overflow',
      },
    ])
    expect(projectOfficeTableOverflowModes(tables, undefined)).toEqual([
      {
        tableIndex: 0,
        fingerprint: 'table-live-a',
        overflow: 'overflow',
      },
      {
        tableIndex: 1,
        fingerprint: 'table-live-b',
        overflow: 'overflow',
      },
      {
        tableIndex: 2,
        fingerprint: 'table-live-c',
        overflow: 'overflow',
      },
    ])
    expect(tables).toEqual(frozenTables)
    expect(styles).toEqual(frozenStyles)
    for (const entry of projectOfficeTableOverflowModes(tables, styles)) {
      expect(Object.keys(entry)).toEqual(['tableIndex', 'fingerprint', 'overflow'])
    }
  })

  test('derives serialized ProseMirror table order and identities without presentation data', () => {
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
    const paragraph = (value: string) => schema.nodes.paragraph.create(
      null,
      schema.text(value),
    )
    const table = (headers: string[]) => schema.nodes.table.create(
      null,
      schema.nodes.table_row.create(
        null,
        headers.map((header) => schema.nodes.table_header.create(
          null,
          paragraph(header),
        )),
      ),
    )
    const doc = schema.nodes.doc.create(null, [
      table(['serialized-a-0', 'serialized-a-1']),
      table(['serialized-b-0']),
    ])
    const defaults = projectProseDocumentTableOverflowModes(doc, undefined)
    expect(defaults).toEqual([
      {
        tableIndex: 0,
        fingerprint: expect.stringMatching(/^table-[a-z0-9]+$/),
        overflow: 'overflow',
      },
      {
        tableIndex: 1,
        fingerprint: expect.stringMatching(/^table-[a-z0-9]+$/),
        overflow: 'overflow',
      },
    ])
    expect(projectProseDocumentTableOverflowModes(doc, [{
      tableIndex: 1,
      fingerprint: defaults[1].fingerprint,
      tableOverflow: 'newline',
      future: 'not-projected',
    }])).toEqual([
      defaults[0],
      {
        tableIndex: 1,
        fingerprint: defaults[1].fingerprint,
        overflow: 'newline',
      },
    ])
  })
})

test.describe('[slice 07.3] structural table-style identity transform', () => {
  test('refreshes only the matched style identity with widths and colors in one snapshot', () => {
    const before = {
      tables: [
        {
          tableIndex: 0,
          fingerprint: 'before',
          columns: [96, 96],
          style: { opaqueLegacy: 'keep' },
        },
        { tableIndex: 1, fingerprint: 'sibling', columns: [88, 104] },
      ],
      tableColors: [
        {
          tableIndex: 0,
          fingerprint: 'before',
          cells: { '1,1': '#123456' },
          futureColor: { exact: true },
        },
        { tableIndex: 1, fingerprint: 'sibling', rows: { '1': '#abcdef' } },
      ],
      tableStyles: [
        {
          tableIndex: 0,
          fingerprint: 'before',
          tableOverflow: 'newline',
          titleRow: false,
          borderWidth: 3,
          alignment: 'future-center',
          futureStyle: { nested: ['exact', 7] },
        },
        {
          tableIndex: 1,
          fingerprint: 'sibling',
          tableOverflow: 'truncate',
          fixtureSeed: 'untouched',
        },
        'opaque-future-entry',
      ],
    }
    const frozen = structuredClone(before)
    const after = transformOfficeTableMetadata(
      before,
      { tableIndex: 0, fingerprint: 'before' },
      { tableIndex: 0, fingerprint: 'after' },
      { axis: 'column', action: 'insert', index: 1, anchorIndex: 0 },
      { rows: 2, columns: 3 },
      [
        { tableIndex: 0, fingerprint: 'before' },
        { tableIndex: 1, fingerprint: 'sibling' },
      ],
      [96, 96],
    )

    expect(before).toEqual(frozen)
    expect(after.tables[0]).toMatchObject({
      tableIndex: 0,
      fingerprint: 'after',
      columns: [96, 96, 96],
      style: { opaqueLegacy: 'keep' },
    })
    expect(after.tableColors[0]).toEqual({
      tableIndex: 0,
      fingerprint: 'after',
      cells: { '1,2': '#123456' },
      futureColor: { exact: true },
    })
    expect(after.tableStyles).toEqual([
      {
        ...before.tableStyles[0] as Record<string, unknown>,
        fingerprint: 'after',
      },
      before.tableStyles[1],
      'opaque-future-entry',
    ])

    const missing = transformOfficeTableMetadata(
      { tables: [], tableColors: [], tableStyles: [] },
      { tableIndex: 0, fingerprint: 'missing' },
      { tableIndex: 0, fingerprint: 'next' },
      { axis: 'row', action: 'insert', index: 1 },
      { rows: 3, columns: 2 },
    )
    expect(missing.tableStyles).toEqual([])
  })
})

test.describe('[slice 07.2] target-only overflow metadata action', () => {
  test('merges only tableOverflow and treats the effective active mode as a no-op', () => {
    const before = {
      tables: [{
        tableIndex: 1,
        fingerprint: 'table-b',
        columns: [96, 96],
        style: { legacy: 'keep' },
      }],
      tableColors: [{
        tableIndex: 1,
        fingerprint: 'table-b',
        cells: { '1,1': '#123456' },
      }],
      tableStyles: [
        {
          tableIndex: 0,
          fingerprint: 'table-a',
          tableOverflow: 'overflow',
          sibling: 'untouched',
        },
        {
          tableIndex: 1,
          fingerprint: 'table-b',
          tableOverflow: 'truncate',
          titleRow: true,
          borderWidth: 3,
          borderColor: '#abcdef',
          alignment: 'future-center',
          fixtureSeed: 'keep-overflow',
          future: { nested: ['exact', 7] },
        },
        'opaque-future-style-entry',
      ],
    }
    const original = structuredClone(before)
    const target = { tableIndex: 1, fingerprint: 'table-b' }
    const after = prepareOfficeTableOverflowChange(before, target, 'newline')

    expect(after).toEqual({
      ...before,
      tableStyles: [
        before.tableStyles[0],
        {
          ...(before.tableStyles[1] as Record<string, unknown>),
          tableOverflow: 'newline',
        },
        'opaque-future-style-entry',
      ],
    })
    expect(before).toEqual(original)
    expect(after?.tables).toEqual(before.tables)
    expect(after?.tableColors).toEqual(before.tableColors)
    expect((after?.tableStyles as unknown[])[0]).toEqual(before.tableStyles[0])
    expect((after?.tableStyles as unknown[])[2]).toBe('opaque-future-style-entry')

    expect(prepareOfficeTableOverflowChange(
      {
        ...before,
        tableStyles: [{
          tableIndex: 1,
          fingerprint: 'table-b',
          tableOverflow: 'invalid-future-value',
          future: 'keep',
        }],
      },
      target,
      'overflow',
    )).toBeNull()
    expect(prepareOfficeTableOverflowChange(
      { tables: before.tables, tableColors: before.tableColors },
      { tableIndex: 2, fingerprint: 'table-c' },
      'overflow',
    )).toBeNull()
    expect(prepareOfficeTableOverflowChange(
      { tables: before.tables, tableColors: before.tableColors },
      { tableIndex: 2, fingerprint: 'table-c' },
      'truncate',
    )).toMatchObject({
      tableStyles: [{
        tableIndex: 2,
        fingerprint: 'table-c',
        tableOverflow: 'truncate',
      }],
    })
  })
})

test.describe('[slice 07.1] normalized table display persistence', () => {
  test('normalizes table-wide enum fields and preserves sibling and unknown metadata', () => {
    const frontmatter = {
      name: 'Normalization',
      unknownOuter: { keep: ['exact', 7] },
      metadata: {
        preserveUnknown: 'keep-me',
        tables: [{ tableIndex: 0, columns: [96, 96], style: { legacy: true } }],
        tableColors: [{ tableIndex: 0, cells: { '0,0': '#112233' } }],
        tableStyles: [
          {
            tableIndex: 0,
            fingerprint: 'table-a',
            tableOverflow: 'overflow',
            titleRow: true,
            borderWidth: 3,
            alignment: 'future-center',
            unknownEntry: { exact: ['value', false] },
          },
          {
            tableIndex: 1,
            fingerprint: 'table-b',
            tableOverflow: 'truncate',
            fixtureSeed: 'keep-truncate',
          },
          {
            tableIndex: 2,
            fingerprint: 'table-c',
            tableOverflow: 'newline',
            fixtureSeed: 'keep-newline',
          },
          {
            tableIndex: 3,
            fingerprint: 'table-d',
            tableOverflow: 'invalid-future-value',
            fixtureSeed: 'keep-invalid',
          },
          {
            tableIndex: 4,
            fingerprint: 'table-e',
            fixtureSeed: 'keep-missing',
          },
        ],
      },
    }
    const before = structuredClone(frontmatter)
    const styles = getDocumentTableStyles(frontmatter)
    expect(styles?.map(({ tableOverflow }) => tableOverflow)).toEqual([
      'overflow',
      'truncate',
      'newline',
      'overflow',
      'overflow',
    ])
    expect(styles?.map(({ tableAlignment }) => tableAlignment)).toEqual([
      'left',
      'left',
      'left',
      'left',
      'left',
    ])
    expect(styles?.[0]).toMatchObject({
      titleRow: true,
      borderWidth: 3,
      alignment: 'future-center',
      unknownEntry: { exact: ['value', false] },
    })
    expect(frontmatter).toEqual(before)
    expect(getRawDocumentTableStyles(frontmatter)).toEqual(before.metadata.tableStyles)

    const updated = setDocumentTableStyles(frontmatter, styles)
    expect(updated).not.toBe(frontmatter)
    expect((updated.metadata as Record<string, unknown>).tables)
      .toEqual(before.metadata.tables)
    expect((updated.metadata as Record<string, unknown>).tableColors)
      .toEqual(before.metadata.tableColors)
    expect((updated.metadata as Record<string, unknown>).preserveUnknown).toBe('keep-me')
    expect(updated.unknownOuter).toEqual(before.unknownOuter)

    const serialized = serializeDocumentSettings(
      'Before.\n\n| A | B |\n| --- | --- |\n| C | D |\n\nAfter.',
      DEFAULT_SETTINGS,
      updated,
    )
    const reparsed = parseDocumentSettings(serialized)
    expect(getDocumentTableStyles(reparsed.frontmatter)).toEqual(styles)
    expect((reparsed.frontmatter.metadata as Record<string, unknown>).tables)
      .toEqual(before.metadata.tables)
    expect((reparsed.frontmatter.metadata as Record<string, unknown>).tableColors)
      .toEqual(before.metadata.tableColors)
    expect(reparsed.frontmatter.unknownOuter).toEqual(before.unknownOuter)
    expect(reparsed.body).toContain('| A | B |')

    expect(getDocumentTableStyles({ metadata: {} })).toBeUndefined()
    expect(setDocumentTableStyles({ metadata: { sibling: 'keep' } }, undefined)).toEqual({
      metadata: { sibling: 'keep' },
    })
    const rawMissingMode = [{
      tableIndex: 0,
      fingerprint: 'raw-missing-mode',
      futureStyle: { exact: true },
    }]
    expect((setDocumentTableStyles(
      { metadata: { sibling: 'keep' } },
      rawMissingMode,
    ).metadata as Record<string, unknown>).tableStyles).toEqual(rawMissingMode)
  })
})

test.describe('[slice 07.1] narrow table-cell break codec', () => {
  test('accepts only the four exact spellings in table cells and delegates outside breaks', () => {
    const tree = {
      type: 'root',
      children: [
        {
          type: 'table',
          children: [{
            type: 'tableRow',
            children: [{
              type: 'tableCell',
              children: [
                { type: 'html', value: '<br>' },
                { type: 'text', value: 'a' },
                { type: 'html', value: '<br/>' },
                { type: 'html', value: '<br />' },
                { type: 'html', value: '<br >' },
                { type: 'html', value: '<BR>' },
                { type: 'html', value: ' <br>' },
                { type: 'text', value: '<br>' },
              ],
            }],
          }],
        },
        { type: 'html', value: '<br>' },
      ],
    }
    transformOfficeTableCellBreaks(tree)
    const cellChildren = tree.children[0].children?.[0].children?.[0].children
    expect(cellChildren?.map(({ type }) => type)).toEqual([
      'break',
      'text',
      'break',
      'break',
      'break',
      'html',
      'html',
      'text',
    ])
    expect(tree.children[1]).toEqual({ type: 'html', value: '<br>' })

    expect(serializeOfficeTableCellBreak(
      { type: 'break' },
      { type: 'paragraph' } as never,
      { stack: ['tableCell', 'paragraph'], unsafe: [] } as never,
      { before: '', after: '' } as never,
    )).toBe('<br>')
    expect(serializeOfficeTableCellBreak(
      { type: 'break' },
      { type: 'paragraph' } as never,
      { stack: [], unsafe: [] } as never,
      { before: '', after: '' } as never,
    )).toBe('\\\n')
    expect(escapeOfficeTableCellBreakText(
      '<br>Escaped<br/>spellings<br /><br > <span>html</span>',
    )).toBe('\\<br>Escaped\\<br/>spellings\\<br />\\<br > <span>html</span>')
    expect(escapeOfficeTableCellBreakText('\\<br>already escaped')).toBe(
      '\\<br>already escaped',
    )
  })

  test('keeps one wrapper while synchronizing explicit and inline branches', () => {
    class FakeText {
      nodeType = 3
      textContent: string

      constructor(value: string) {
        this.textContent = value
      }

      remove() {}
    }

    class FakeElement {
      nodeType = 1
      tagName: string
      dataset: Record<string, string> = {}
      childNodes: Array<FakeElement | FakeText> = []

      constructor(tagName: string) {
        this.tagName = tagName.toUpperCase()
      }

      get firstChild() {
        return this.childNodes[0] ?? null
      }

      get firstElementChild() {
        return this.childNodes.find((node) => node instanceof FakeElement) ?? null
      }

      get textContent() {
        return this.childNodes.map((node) => node.textContent ?? '').join('')
      }

      replaceChildren(...nodes: Array<FakeElement | FakeText>) {
        this.childNodes = nodes
      }

      remove() {}
    }

    const originalDocument = globalThis.document
    const originalNode = globalThis.Node
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: {
        createElement: (name: string) => new FakeElement(name),
        createTextNode: (value: string) => new FakeText(value),
      },
    })
    Object.defineProperty(globalThis, 'Node', {
      configurable: true,
      value: { TEXT_NODE: 3 },
    })

    try {
      const type = {}
      const explicit = { type, attrs: { isInline: false } }
      const inline = { type, attrs: { isInline: true } }
      const view = new OfficeTableHardbreakNodeView(explicit as never)
      const wrapper = view.dom as unknown as FakeElement

      expect(wrapper.tagName).toBe('SPAN')
      expect(wrapper.dataset).toEqual({
        type: 'hardbreak',
        isInline: 'false',
        rvHardbreak: 'explicit',
      })
      expect(wrapper.childNodes).toHaveLength(1)
      expect((wrapper.firstElementChild as FakeElement).tagName).toBe('BR')

      expect(view.update(inline as never)).toBe(true)
      expect(view.dom).toBe(wrapper)
      expect(wrapper.dataset).toEqual({
        type: 'hardbreak',
        isInline: 'true',
        rvHardbreak: 'inline',
      })
      expect(wrapper.childNodes).toHaveLength(1)
      expect(wrapper.firstElementChild).toBeNull()
      expect(wrapper.firstChild?.nodeType).toBe(3)
      expect(wrapper.textContent).toBe(' ')

      expect(view.update(explicit as never)).toBe(true)
      expect(view.dom).toBe(wrapper)
      expect(wrapper.dataset.rvHardbreak).toBe('explicit')
      expect((wrapper.firstElementChild as FakeElement).tagName).toBe('BR')
      expect(view.update({ type: {}, attrs: { isInline: false } } as never)).toBe(false)
    } finally {
      Object.defineProperty(globalThis, 'document', {
        configurable: true,
        value: originalDocument,
      })
      Object.defineProperty(globalThis, 'Node', {
        configurable: true,
        value: originalNode,
      })
    }
  })
})

test('[slice 07.1] canonical overflow fixture opens with codec-first hardbreak and seeded display', async ({ page }) => {
  const fixture = await resetOverflowFixture()
  const canonicalBytes = fs.readFileSync(fixture.path)
  try {
    const editor = await openOverflowDocument(page)
    const explicitBreaks = editor.locator(
      'span[data-type="hardbreak"][data-is-inline="false"][data-rv-hardbreak="explicit"]',
    )
    await expect(explicitBreaks).toHaveCount(1)
    await expect(explicitBreaks.locator(':scope > br')).toHaveCount(1)

    const tables = editor.locator('table.rv-office-table')
    await expect(tables).toHaveCount(2)
    await expect(tables.nth(0)).toHaveAttribute('data-rv-table-overflow', 'overflow')
    await expect(tables.nth(1)).toHaveAttribute('data-rv-table-overflow', 'truncate')

    const evidence = await tables.evaluateAll((elements) => elements.map((element) => {
      const table = element as HTMLTableElement
      const tableStyle = getComputedStyle(table)
      const cell = table.rows[1]?.cells[table === elements[0] ? 0 : 1]
      const paragraph = cell?.querySelector('p')
      if (!cell || !paragraph) throw new Error('Canonical overflow cell is unavailable')
      const cellStyle = getComputedStyle(cell)
      const paragraphStyle = getComputedStyle(paragraph)
      const scale = table.getBoundingClientRect().width / table.offsetWidth
      return {
        tableLayout: tableStyle.tableLayout,
        tableWidth: Math.round(table.getBoundingClientRect().width / scale),
        columns: Array.from(table.querySelectorAll<HTMLTableColElement>(':scope > colgroup > col'))
          .map((column) => Math.round(column.getBoundingClientRect().width / scale)),
        cellOverflow: cellStyle.overflow,
        paragraph: {
          minWidth: paragraphStyle.minWidth,
          maxWidth: paragraphStyle.maxWidth,
          overflow: paragraphStyle.overflow,
          textOverflow: paragraphStyle.textOverflow,
          whiteSpace: paragraphStyle.whiteSpace,
        },
        forbiddenCellChrome: Array.from(table.querySelectorAll('td, th, tr')).map((node) => ({
          className: node.getAttribute('class'),
          overflow: (node as HTMLElement).style.overflow,
          textOverflow: (node as HTMLElement).style.textOverflow,
          whiteSpace: (node as HTMLElement).style.whiteSpace,
          height: (node as HTMLElement).style.height,
          tableOverflow: node.getAttribute('data-rv-table-overflow'),
        })),
      }
    }))
    expect(evidence).toEqual([
      {
        tableLayout: 'fixed',
        tableWidth: 192,
        columns: [96, 96],
        cellOverflow: 'hidden',
        paragraph: {
          minWidth: '0px',
          maxWidth: '100%',
          overflow: 'hidden',
          textOverflow: 'clip',
          whiteSpace: 'nowrap',
        },
        forbiddenCellChrome: expect.arrayContaining([
          {
            className: null,
            overflow: '',
            textOverflow: '',
            whiteSpace: '',
            height: '',
            tableOverflow: null,
          },
        ]),
      },
      {
        tableLayout: 'fixed',
        tableWidth: 192,
        columns: [96, 96],
        cellOverflow: 'hidden',
        paragraph: {
          minWidth: '0px',
          maxWidth: '100%',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        },
        forbiddenCellChrome: expect.arrayContaining([
          {
            className: null,
            overflow: '',
            textOverflow: '',
            whiteSpace: '',
            height: '',
            tableOverflow: null,
          },
        ]),
      },
    ])
    evidence.forEach(({ forbiddenCellChrome }) => {
      expect(forbiddenCellChrome.every(({
        className,
        overflow,
        textOverflow,
        whiteSpace,
        height,
        tableOverflow,
      }) => (
        className === null
        && overflow === ''
        && textOverflow === ''
        && whiteSpace === ''
        && height === ''
        && tableOverflow === null
      ))).toBe(true)
    })

    expect(await explicitBreaks.evaluate((wrapper) => ({
      brDisplay: getComputedStyle(wrapper.querySelector('br') as HTMLElement).display,
      pseudoContent: getComputedStyle(wrapper, '::after').content,
      textContent: wrapper.textContent,
    }))).toEqual({
      brDisplay: 'none',
      pseudoContent: '" "',
      textContent: '',
    })

    await tables.nth(0).evaluate((table) => {
      const replacement = table.cloneNode(true) as HTMLTableElement
      replacement.removeAttribute('data-rv-table-overflow')
      table.replaceWith(replacement)
    })
    await expect(tables.nth(0)).toHaveAttribute('data-rv-table-overflow', 'overflow')

    await page.waitForTimeout(750)
    expect(fs.readFileSync(fixture.path)).toEqual(canonicalBytes)
  } finally {
    await page.close()
    await resetOverflowFixture()
  }
})

test('[slice 07.1] table-cell break spellings and positions save canonically and reparse stably', async ({ page }) => {
  test.setTimeout(90_000)
  const fixture = await resetOverflowFixture()
  const canonicalBytes = fs.readFileSync(fixture.path)
  const codecSeed = [
    '---',
    "name: 'Overflow'",
    "description: 'Office E2E overflow/overflow'",
    'metadata:',
    "  fixtureScenario: 'overflow'",
    "  fixtureCase: 'overflow'",
    '  fixtureCopy: 1',
    "  preserveUnknown: 'keep-me'",
    '  tables:',
    "    - { tableIndex: 0, fingerprint: 'fixture-overflow-a', columns: [96, 96] }",
    '---',
    'Before codec.',
    '',
    'Outside explicit\\',
    'break.',
    '',
    'Outside soft',
    'break.',
    '',
    '| codec-h0 | codec-h1 |',
    '| --- | --- |',
    '| \\<br>Escaped <span>html</span> | <br>Lead<br/>Middle<br /><br > |',
    '',
    'After codec.',
    '',
  ].join('\n')
  fs.writeFileSync(fixture.path, codecSeed)
  await installSaveObservation(page)

  try {
    const editor = await openOverflowDocument(page)
    const table = editor.locator('table.rv-office-table')
    await expect(table).toHaveCount(1)
    const cells = table.locator('tbody > tr').nth(1).locator('td, th')
    await expect(cells).toHaveCount(2)
    await expect(cells.nth(0).locator('[data-rv-hardbreak]')).toHaveCount(0)
    await expect(cells.nth(0)).toContainText('<br>Escaped <span>html</span>')

    const explicit = cells.nth(1).locator(
      'span[data-type="hardbreak"][data-is-inline="false"][data-rv-hardbreak="explicit"]',
    )
    await expect(explicit).toHaveCount(4)
    expect(await cells.nth(1).locator('p').evaluate((paragraph) => (
      Array.from(paragraph.childNodes).flatMap((node) => {
        if (node.nodeType === Node.TEXT_NODE) return [`text:${node.textContent}`]
        const branch = (node as HTMLElement).dataset.rvHardbreak
        return branch ? [`break:${branch}`] : []
      })
    ))).toEqual([
      'break:explicit',
      'text:Lead',
      'break:explicit',
      'text:Middle',
      'break:explicit',
      'break:explicit',
    ])
    await expect(editor.locator('[data-rv-hardbreak="inline"]')).toHaveCount(1)
    await expect(editor.locator('[data-rv-hardbreak="explicit"]')).toHaveCount(5)

    const beforeParagraph = editor.locator('p').filter({ hasText: 'Before codec.' }).first()
    await beforeParagraph.click()
    await page.keyboard.press('End')
    await page.keyboard.type(' saved')
    await expect.poll(() => readSaveCount(page), { timeout: 15_000 }).toBeGreaterThanOrEqual(1)
    await expect.poll(() => fs.readFileSync(fixture.path, 'utf8'), { timeout: 15_000 })
      .toContain('Before codec. saved')

    const firstSerialization = fs.readFileSync(fixture.path)
    const firstText = firstSerialization.toString()
    const serializedTableRow = firstText.split('\n').find((line) => line.includes('Lead'))
    expect(serializedTableRow).toBeDefined()
    const serializedLiteralCell = serializedTableRow?.split('|')[1]?.trim()
    expect(serializedLiteralCell).toBe('\\<br>Escaped <span>html</span>')
    const serializedBreakCell = serializedTableRow?.split('|')[2]?.trim()
    expect(serializedBreakCell).toBe('<br>Lead<br>Middle<br><br>')
    expect(serializedBreakCell?.match(/<br>/g)).toHaveLength(4)
    expect(firstText).toContain('Outside explicit\\\nbreak.')
    expect(firstText).toContain('Outside soft\nbreak.')
    expect(firstText.split('\n').filter((line) => (
      /^\|\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|$/.test(line)
    ))).toHaveLength(1)

    await page.keyboard.press('ControlOrMeta+s')
    await expect.poll(() => readSaveCount(page), { timeout: 15_000 }).toBeGreaterThanOrEqual(2)
    expect(fs.readFileSync(fixture.path)).toEqual(firstSerialization)

    await page.getByTitle('Back', { exact: true }).click()
    const reopened = await openOverflowDocument(page)
    await expect(reopened.locator('table.rv-office-table')).toHaveCount(1)
    await expect(reopened.locator(
      'table.rv-office-table tbody > tr:nth-child(2) > td:nth-child(2) [data-rv-hardbreak="explicit"]',
    )).toHaveCount(4)
    const reopenedLiteralCell = reopened.locator(
      'table.rv-office-table tbody > tr:nth-child(2) > td:nth-child(1)',
    )
    await expect(reopenedLiteralCell.locator('[data-rv-hardbreak]')).toHaveCount(0)
    await expect(reopenedLiteralCell).toContainText('<br>Escaped <span>html</span>')
    await expect(reopened.locator('[data-rv-hardbreak="inline"]')).toHaveCount(1)
    await expect(reopened.locator('[data-rv-hardbreak="explicit"]')).toHaveCount(5)
    expect(fs.readFileSync(fixture.path)).toEqual(firstSerialization)
  } finally {
    await page.close()
    fs.writeFileSync(fixture.path, canonicalBytes)
    await resetOverflowFixture()
  }
})

test('[slice 07.2] Table Overflow submenu changes one target, saves once, and has independent history', async ({ page }) => {
  test.setTimeout(120_000)
  const fixture = await resetOverflowFixture()
  const canonicalBytes = fs.readFileSync(fixture.path)
  const canonicalText = canonicalBytes.toString()
  const canonicalStyleBlock = [
    '  tableStyles:',
    "    - { tableIndex: 1, fingerprint: 'fixture-overflow-b', tableOverflow: 'truncate', fixtureSeed: 'keep-overflow' }",
  ].join('\n')
  const seededStyleBlock = [
    '  tableColors:',
    "    - { tableIndex: 1, fingerprint: 'fixture-overflow-b', cells: { '1,1': '#123456' }, futureColor: 'keep-color' }",
    '  tableStyles:',
    "    - { tableIndex: 1, fingerprint: 'fixture-overflow-b', tableOverflow: 'truncate', fixtureSeed: 'keep-overflow', titleRow: false, borderWidth: 3, borderColor: '#abcdef', alignment: 'future-center', futureField: 'keep-style' }",
  ].join('\n')
  const seededText = canonicalText.replace(canonicalStyleBlock, seededStyleBlock)
  expect(seededText).not.toBe(canonicalText)
  fs.writeFileSync(fixture.path, seededText)
  await installSaveObservation(page)

  const readDisk = () => {
    const parsed = parseDocumentSettings(fs.readFileSync(fixture.path, 'utf8'))
    const metadata = parsed.frontmatter.metadata as Record<string, unknown>
    return {
      body: parsed.body,
      metadata,
      styles: getDocumentTableStyles(parsed.frontmatter),
    }
  }
  const expectTargetModeOnDisk = (mode: 'overflow' | 'truncate' | 'newline') => {
    const disk = readDisk()
    expect(disk.styles).toHaveLength(1)
    expect(disk.styles?.[0]).toEqual({
      tableIndex: 1,
      fingerprint: 'fixture-overflow-b',
      tableOverflow: mode,
      fixtureSeed: 'keep-overflow',
      titleRow: false,
      borderWidth: 3,
      borderColor: '#abcdef',
      tableAlignment: 'left',
      alignment: 'future-center',
      futureField: 'keep-style',
    })
    expect(disk.metadata.tables).toEqual([
      { tableIndex: 0, fingerprint: 'fixture-overflow-a', columns: [96, 96] },
      { tableIndex: 1, fingerprint: 'fixture-overflow-b', columns: [96, 96] },
    ])
    expect(disk.metadata.tableColors).toEqual([{
      tableIndex: 1,
      fingerprint: 'fixture-overflow-b',
      cells: { '1,1': '#123456' },
      futureColor: 'keep-color',
    }])
    expect(disk.metadata.preserveUnknown).toBe('keep-me')
    return disk
  }
  const expectOneMetadataEvent = async () => {
    await expect.poll(() => readSaveCount(page), { timeout: 15_000 }).toBe(1)
    await page.waitForTimeout(650)
    expect(await readSaveCount(page)).toBe(1)
    expect(await readMetadataEvents(page)).toEqual({
      step: 1,
      'plugin-publish': 1,
      'external-publish': 1,
    })
  }
  const expectOneTextSave = async () => {
    await expect.poll(() => readSaveCount(page), { timeout: 15_000 }).toBe(1)
    await page.waitForTimeout(650)
    expect(await readSaveCount(page)).toBe(1)
    expect(await readMetadataEvents(page)).toEqual({})
  }

  try {
    const editor = await openOverflowDocument(page)
    const tables = editor.locator('table.rv-office-table')
    await expect(tables).toHaveCount(2)
    const rootMenu = page.getByRole('menu', { name: 'Table cell actions' })
    const tableMenu = page.getByRole('menu', { name: 'Table', exact: true })
    const overflowMenu = page.getByRole('menu', { name: 'Overflow', exact: true })
    const targetCell = (tableIndex: number) => tables.nth(tableIndex)
      .locator('tbody > tr').nth(1).locator('td, th').nth(tableIndex === 0 ? 0 : 1)
    const openRoot = async (tableIndex: number) => {
      await targetCell(tableIndex).click({ button: 'right' })
      await expect(rootMenu).toBeVisible()
      await expect(rootMenu.getByRole('menuitem', { name: 'Table', exact: true })).toBeFocused()
    }
    const openTableWithKeyboard = async (tableIndex: number) => {
      await openRoot(tableIndex)
      await page.keyboard.press('ArrowRight')
      await expect(tableMenu).toBeVisible()
      await expect(tableMenu.getByRole('menuitem', { name: 'Add title row', exact: true }))
        .toBeFocused()
      await page.keyboard.press('ArrowDown')
      await page.keyboard.press('ArrowDown')
      await page.keyboard.press('ArrowDown')
      await page.keyboard.press('ArrowDown')
      await page.keyboard.press('ArrowDown')
      await page.keyboard.press('ArrowDown')
      const trigger = tableMenu.getByRole('menuitem', { name: /Overflow: current mode/ })
      await expect(trigger).toBeFocused()
      return trigger
    }
    const openOverflowWithPointer = async (tableIndex: number) => {
      await openRoot(tableIndex)
      await rootMenu.getByRole('menuitem', { name: 'Table', exact: true }).hover()
      await expect(tableMenu).toBeVisible()
      const trigger = tableMenu.getByRole('menuitem', { name: /Overflow: current mode/ })
      await trigger.hover()
      await expect(overflowMenu).toBeVisible()
      return trigger
    }

    await resetOverflowObservation(page)
    const defaultTrigger = await openOverflowWithPointer(0)
    await expect(defaultTrigger).toHaveAttribute('aria-label', 'Overflow: current mode Overflow')
    await expect(defaultTrigger.locator('.material-symbols-outlined').first())
      .toHaveText('format_text_overflow')
    await expect(defaultTrigger.locator('.rv-office-table-context-current'))
      .toHaveText('Overflow')
    const defaultChoices = overflowMenu.getByRole('menuitemradio')
    await expect(defaultChoices).toHaveCount(3)
    await expect(defaultChoices).toHaveText(['checkOverflow', 'Truncate', 'New line'])
    await expect(defaultChoices.nth(0)).toHaveAttribute('aria-checked', 'true')
    await expect(defaultChoices.nth(1)).toHaveAttribute('aria-checked', 'false')
    await expect(defaultChoices.nth(2)).toHaveAttribute('aria-checked', 'false')
    await defaultChoices.nth(0).click()
    await expect(rootMenu).toHaveCount(0)
    await expect(editor).toBeFocused()
    await page.waitForTimeout(750)
    expect(await readSaveCount(page)).toBe(0)
    expect(await readMetadataEvents(page)).toEqual({})
    expect(fs.readFileSync(fixture.path, 'utf8')).toBe(seededText)

    await resetOverflowObservation(page)
    await openRoot(1)
    await page.keyboard.press('ArrowLeft')
    await expect(rootMenu.getByRole('menuitem', { name: 'Table', exact: true })).toBeFocused()
    await page.keyboard.press('ArrowRight')
    await expect(tableMenu).toBeVisible()
    const tableItems = tableMenu.locator(
      ':scope > [role="menuitem"], :scope > [role="menuitemradio"]',
    )
    await expect(tableItems).toHaveCount(8)
    await expect(tableItems).toHaveText([
      'variable_addAdd title row',
      'border_allBorder size3pxchevron_right',
      'border_allBorder color#abcdef',
      'align_horizontal_leftAlign table leftcheck',
      'align_horizontal_centerAlign table center',
      'align_horizontal_rightAlign table right',
      'format_text_overflowOverflowTruncatechevron_right',
      'deleteRemove table',
    ])
    await expect(tableMenu.locator(':scope > [role="separator"]')).toHaveCount(4)
    const addTitle = tableMenu.getByRole('menuitem', { name: 'Add title row', exact: true })
    await expect(addTitle).toBeFocused()
    await expect(addTitle).toBeEnabled()
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('ArrowDown')
    const truncateTrigger = tableMenu.getByRole('menuitem', {
      name: 'Overflow: current mode Truncate',
      exact: true,
    })
    await expect(truncateTrigger).toBeFocused()
    await expect(tableMenu.getByRole('menuitem', { name: 'Remove table', exact: true }))
      .toBeVisible()
    for (const laterControl of ['Fit Text']) {
      await expect(page.getByRole('menuitem', { name: laterControl, exact: true }))
        .toHaveCount(0)
    }
    await expect(tableMenu.getByRole('menuitem', { name: /Border size: current width 3px/ }))
      .toHaveCount(1)
    await page.keyboard.press('ArrowRight')
    await expect(overflowMenu.getByRole('menuitemradio', { name: 'Truncate', exact: true }))
      .toBeFocused()
    await page.keyboard.press('ArrowLeft')
    await expect(truncateTrigger).toBeFocused()
    await expect(overflowMenu).toHaveCount(0)
    await page.keyboard.press('ArrowLeft')
    await expect(rootMenu.getByRole('menuitem', { name: 'Table', exact: true })).toBeFocused()
    await expect(tableMenu).toHaveCount(0)
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('ArrowRight')
    await overflowMenu.getByRole('menuitemradio', { name: 'Overflow', exact: true }).click()
    await expect(tables.nth(0)).toHaveAttribute('data-rv-table-overflow', 'overflow')
    await expect(tables.nth(1)).toHaveAttribute('data-rv-table-overflow', 'overflow')
    await expectOneMetadataEvent()
    expectTargetModeOnDisk('overflow')

    await resetOverflowObservation(page)
    await openTableWithKeyboard(1)
    await page.keyboard.press('ArrowRight')
    await expect(overflowMenu.getByRole('menuitemradio', { name: 'Overflow', exact: true }))
      .toBeFocused()
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('ArrowDown')
    await expect(overflowMenu.getByRole('menuitemradio', { name: 'New line', exact: true }))
      .toBeFocused()
    await page.keyboard.press('Enter')
    await expect(tables.nth(1)).toHaveAttribute('data-rv-table-overflow', 'newline')
    expect(await tables.nth(1).locator('tbody > tr').nth(1).locator('td').nth(1)
      .locator('p').evaluate((paragraph) => getComputedStyle(paragraph).whiteSpace)).toBe('normal')
    await expectOneMetadataEvent()
    expectTargetModeOnDisk('newline')

    await resetOverflowObservation(page)
    await openOverflowWithPointer(1)
    await overflowMenu.getByRole('menuitemradio', { name: 'Truncate', exact: true }).click()
    await expect(tables.nth(1)).toHaveAttribute('data-rv-table-overflow', 'truncate')
    expect(await tables.nth(1).locator('tbody > tr').nth(1).locator('td').nth(1)
      .locator('p').evaluate((paragraph) => getComputedStyle(paragraph).textOverflow))
      .toBe('ellipsis')
    await expectOneMetadataEvent()
    expectTargetModeOnDisk('truncate')

    const beforeActiveNoOp = fs.readFileSync(fixture.path)
    await resetOverflowObservation(page)
    await openOverflowWithPointer(1)
    await overflowMenu.getByRole('menuitemradio', { name: 'Truncate', exact: true }).click()
    await page.waitForTimeout(750)
    expect(await readSaveCount(page)).toBe(0)
    expect(await readMetadataEvents(page)).toEqual({})
    expect(fs.readFileSync(fixture.path)).toEqual(beforeActiveNoOp)

    await resetOverflowObservation(page)
    await openOverflowWithPointer(1)
    await overflowMenu.getByRole('menuitemradio', { name: 'New line', exact: true }).click()
    await expect(tables.nth(1)).toHaveAttribute('data-rv-table-overflow', 'newline')
    await expectOneMetadataEvent()
    expectTargetModeOnDisk('newline')

    const beforeParagraph = editor.locator('p').filter({ hasText: 'Before overflow.' }).first()
    await resetOverflowObservation(page)
    await beforeParagraph.click()
    await page.keyboard.press('End')
    await page.keyboard.type(' history-unit')
    await expect(beforeParagraph).toContainText('Before overflow. history-unit')
    await expectOneTextSave()
    expect(readDisk().body).toContain('Before overflow. history-unit')

    await resetOverflowObservation(page)
    await page.keyboard.press('ControlOrMeta+z')
    await expect(beforeParagraph).toHaveText('Before overflow.')
    await expect(tables.nth(1)).toHaveAttribute('data-rv-table-overflow', 'newline')
    await expectOneTextSave()
    expectTargetModeOnDisk('newline')
    expect(readDisk().body).not.toContain('history-unit')

    await resetOverflowObservation(page)
    await page.keyboard.press('ControlOrMeta+z')
    await expect(tables.nth(1)).toHaveAttribute('data-rv-table-overflow', 'truncate')
    await expect(beforeParagraph).toHaveText('Before overflow.')
    await expectOneMetadataEvent()
    expectTargetModeOnDisk('truncate')

    await resetOverflowObservation(page)
    await page.keyboard.press('ControlOrMeta+Shift+z')
    await expect(tables.nth(1)).toHaveAttribute('data-rv-table-overflow', 'newline')
    await expect(beforeParagraph).toHaveText('Before overflow.')
    await expectOneMetadataEvent()
    expectTargetModeOnDisk('newline')

    await resetOverflowObservation(page)
    await page.keyboard.press('ControlOrMeta+Shift+z')
    await expect(beforeParagraph).toContainText('Before overflow. history-unit')
    await expect(tables.nth(1)).toHaveAttribute('data-rv-table-overflow', 'newline')
    await expectOneTextSave()
    expect(readDisk().body).toContain('Before overflow. history-unit')
    expectTargetModeOnDisk('newline')

    await page.getByTitle('Back', { exact: true }).click()
    const reopened = await openOverflowDocument(page)
    const reopenedTables = reopened.locator('table.rv-office-table')
    await expect(reopenedTables.nth(0)).toHaveAttribute('data-rv-table-overflow', 'overflow')
    await expect(reopenedTables.nth(1)).toHaveAttribute('data-rv-table-overflow', 'newline')
    await expect(reopened.locator('p').filter({ hasText: 'Before overflow. history-unit' }))
      .toHaveCount(1)
    const reopenedParagraph = reopenedTables.nth(1)
      .locator('tbody > tr').nth(1).locator('td').nth(1).locator('p')
    expect(await reopenedParagraph.evaluate((paragraph) => ({
      whiteSpace: getComputedStyle(paragraph).whiteSpace,
      overflow: getComputedStyle(paragraph).overflow,
      textOverflow: getComputedStyle(paragraph).textOverflow,
    }))).toEqual({
      whiteSpace: 'normal',
      overflow: 'visible',
      textOverflow: 'clip',
    })
    await reopenedTables.nth(1).locator('tbody > tr').nth(1).locator('td').nth(1)
      .click({ button: 'right' })
    await page.getByRole('menu', { name: 'Table cell actions' })
      .getByRole('menuitem', { name: 'Table', exact: true }).hover()
    const reopenedTrigger = page.getByRole('menu', { name: 'Table', exact: true })
      .getByRole('menuitem', { name: 'Overflow: current mode New line', exact: true })
    await expect(reopenedTrigger).toBeVisible()
    await reopenedTrigger.hover()
    await expect(page.getByRole('menu', { name: 'Overflow', exact: true })
      .getByRole('menuitemradio', { name: 'New line', exact: true }))
      .toHaveAttribute('aria-checked', 'true')
    await page.keyboard.press('Escape')
    await expect(page.getByRole('menu', { name: 'Table cell actions' })).toHaveCount(0)
    await expect(reopened).toBeFocused()
    expectTargetModeOnDisk('newline')
  } finally {
    await page.close()
    fs.writeFileSync(fixture.path, canonicalBytes)
    await resetOverflowFixture()
  }
})

test('[slice 07.4] emulated print preserves ordered modes widths hardbreak pixels history and bytes', async ({
  context,
  page,
}) => {
  test.setTimeout(210_000)
  const fixture = await resetOverflowFixture()
  const canonicalBytes = fs.readFileSync(fixture.path)
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await installSaveObservation(page)

  const readPresentation = async (
    table: ReturnType<Page['locator']>,
    paragraph: ReturnType<Page['locator']>,
  ) => table.evaluate((tableNode, paragraphNode) => {
    const paragraphElement = paragraphNode as HTMLParagraphElement
    const cell = paragraphElement.closest<HTMLTableCellElement>('td, th')
    const wrapper = paragraphElement.querySelector<HTMLElement>(
      '[data-rv-hardbreak="explicit"]',
    )
    const br = wrapper?.querySelector('br')
    if (!cell) throw new Error('Overflow paragraph cell is unavailable')
    const tableElement = tableNode as HTMLTableElement
    const tableStyle = getComputedStyle(tableElement)
    const cellStyle = getComputedStyle(cell)
    const paragraphStyle = getComputedStyle(paragraphElement)
    const tableRect = tableElement.getBoundingClientRect()
    const scale = tableElement.offsetWidth > 0
      ? tableRect.width / tableElement.offsetWidth
      : 1
    const contentRange = document.createRange()
    contentRange.selectNodeContents(paragraphElement)
    const paragraphRect = paragraphElement.getBoundingClientRect()
    const lineBoxes = Array.from(contentRange.getClientRects())
      .filter(({ width, height }) => width > 0 && height > 0)
      .map((rect) => ({
        top: Math.round(((rect.top - paragraphRect.top) / scale) * 10) / 10,
        height: Math.round((rect.height / scale) * 10) / 10,
      }))
      .filter((box, index, all) => (
        all.findIndex((candidate) => (
          candidate.top === box.top && candidate.height === box.height
        )) === index
      ))

    let visualGap: number | null = null
    let referenceGap: number | null = null
    let neighboringLineDelta: number | null = null
    if (
      wrapper
      && wrapper.previousSibling instanceof Text
      && wrapper.nextSibling instanceof Text
    ) {
      const previous = wrapper.previousSibling
      const next = wrapper.nextSibling
      const characterRect = (text: Text, from: number, to: number) => {
        const range = document.createRange()
        range.setStart(text, from)
        range.setEnd(text, to)
        return range.getBoundingClientRect()
      }
      const previousRect = characterRect(previous, previous.length - 1, previous.length)
      const nextRect = characterRect(next, 0, 1)
      visualGap = (nextRect.left - previousRect.right) / scale
      neighboringLineDelta = Math.abs(previousRect.top - nextRect.top) / scale

      const reference = document.createElement('span')
      Object.assign(reference.style, {
        position: 'fixed',
        left: '-100000px',
        top: '0',
        whiteSpace: 'nowrap',
        font: paragraphStyle.font,
        fontKerning: paragraphStyle.fontKerning,
        fontFeatureSettings: paragraphStyle.fontFeatureSettings,
        fontVariationSettings: paragraphStyle.fontVariationSettings,
        letterSpacing: paragraphStyle.letterSpacing,
        wordSpacing: paragraphStyle.wordSpacing,
        zoom: String(scale),
      })
      const referenceBefore = document.createTextNode(previous.data.slice(-1))
      const referenceSpace = document.createTextNode(' ')
      const referenceAfter = document.createTextNode(next.data.slice(0, 1))
      reference.append(referenceBefore, referenceSpace, referenceAfter)
      document.body.appendChild(reference)
      const referenceBeforeRect = characterRect(referenceBefore, 0, 1)
      const referenceAfterRect = characterRect(referenceAfter, 0, 1)
      referenceGap = (referenceAfterRect.left - referenceBeforeRect.right) / scale
      reference.remove()
    }

    return {
      mode: tableElement.dataset.rvTableOverflow,
      tableLayout: tableStyle.tableLayout,
      tableWidth: Math.round(tableRect.width / scale),
      columns: Array.from(
        tableElement.querySelectorAll<HTMLTableColElement>(':scope > colgroup > col'),
      ).map((column) => Math.round(column.getBoundingClientRect().width / scale)),
      cellWidth: Math.round(cell.getBoundingClientRect().width / scale),
      cellOverflow: cellStyle.overflow,
      paragraph: {
        minWidth: paragraphStyle.minWidth,
        maxWidth: paragraphStyle.maxWidth,
        overflow: paragraphStyle.overflow,
        textOverflow: paragraphStyle.textOverflow,
        whiteSpace: paragraphStyle.whiteSpace,
        clientWidth: paragraphElement.clientWidth,
        scrollWidth: paragraphElement.scrollWidth,
        offsetHeight: paragraphElement.offsetHeight,
      },
      cellOffsetHeight: cell.offsetHeight,
      lineBoxes,
      visualGap,
      referenceGap,
      neighboringLineDelta,
      hardbreak: wrapper && br ? {
        wrapperCount: paragraphElement.querySelectorAll(
          '[data-rv-hardbreak="explicit"]',
        ).length,
        childBreakCount: wrapper.querySelectorAll(':scope > br').length,
        branch: wrapper.dataset.rvHardbreak,
        brDisplay: getComputedStyle(br).display,
        pseudoContent: getComputedStyle(wrapper, '::after').content,
      } : null,
      forbiddenInline: [cell.closest('tr'), cell, paragraphElement].map((element) => {
        const inline = (element as HTMLElement).style
        return {
          height: inline.height,
          minHeight: inline.minHeight,
          maxHeight: inline.maxHeight,
          overflow: inline.overflow,
          textOverflow: inline.textOverflow,
          whiteSpace: inline.whiteSpace,
        }
      }),
    }
  }, await paragraph.elementHandle())

  const expectSingleLine = (
    evidence: Awaited<ReturnType<typeof readPresentation>>,
    mode: 'overflow' | 'truncate',
  ) => {
    expect(evidence.mode).toBe(mode)
    expect(evidence.tableLayout).toBe('fixed')
    expect(evidence.tableWidth).toBe(192)
    expect(evidence.columns).toEqual([96, 96])
    expect(evidence.cellWidth).toBe(96)
    expect(evidence.cellOverflow).toBe('hidden')
    expect(evidence.paragraph).toMatchObject({
      minWidth: '0px',
      maxWidth: '100%',
      overflow: 'hidden',
      textOverflow: mode === 'truncate' ? 'ellipsis' : 'clip',
      whiteSpace: 'nowrap',
    })
    expect(evidence.paragraph.scrollWidth).toBeGreaterThan(evidence.paragraph.clientWidth)
    expect(evidence.lineBoxes).toHaveLength(1)
    expect(evidence.hardbreak).toEqual({
      wrapperCount: 1,
      childBreakCount: 1,
      branch: 'explicit',
      brDisplay: 'none',
      pseudoContent: '" "',
    })
    expect(evidence.neighboringLineDelta).not.toBeNull()
    expect(evidence.neighboringLineDelta!).toBeLessThan(0.75)
    expect(evidence.visualGap).not.toBeNull()
    expect(evidence.referenceGap).not.toBeNull()
    expect(Math.abs(evidence.visualGap! - evidence.referenceGap!)).toBeLessThan(0.75)
  }
  const expectNewLine = (
    evidence: Awaited<ReturnType<typeof readPresentation>>,
    singleLine: Awaited<ReturnType<typeof readPresentation>>,
  ) => {
    expect(evidence.mode).toBe('newline')
    expect(evidence.tableLayout).toBe('fixed')
    expect(evidence.tableWidth).toBe(192)
    expect(evidence.columns).toEqual([96, 96])
    expect(evidence.cellWidth).toBe(96)
    expect(evidence.cellOverflow).toBe('visible')
    expect(evidence.paragraph).toMatchObject({
      overflow: 'visible',
      textOverflow: 'clip',
      whiteSpace: 'normal',
    })
    expect(evidence.lineBoxes.length).toBeGreaterThanOrEqual(2)
    expect(evidence.paragraph.offsetHeight).toBeGreaterThan(singleLine.paragraph.offsetHeight)
    expect(evidence.cellOffsetHeight).toBeGreaterThan(singleLine.cellOffsetHeight)
    expect(evidence.hardbreak).toEqual({
      wrapperCount: 1,
      childBreakCount: 1,
      branch: 'explicit',
      brDisplay: 'inline',
      pseudoContent: 'none',
    })
  }
  const expectMediaParity = (
    screen: Awaited<ReturnType<typeof readPresentation>>,
    print: Awaited<ReturnType<typeof readPresentation>>,
  ) => {
    expect(print).toEqual(screen)
  }
  const copyParagraph = async (paragraph: ReturnType<Page['locator']>) => {
    await paragraph.evaluate((node) => {
      const range = document.createRange()
      range.selectNodeContents(node)
      const selection = document.getSelection()
      selection?.removeAllRanges()
      selection?.addRange(range)
    })
    await page.keyboard.press('ControlOrMeta+c')
    return page.evaluate(() => navigator.clipboard.readText())
  }
  const expectNoForbiddenInline = (
    evidence: Awaited<ReturnType<typeof readPresentation>>,
  ) => {
    expect(evidence.forbiddenInline).toEqual([
      { height: '', minHeight: '', maxHeight: '', overflow: '', textOverflow: '', whiteSpace: '' },
      { height: '', minHeight: '', maxHeight: '', overflow: '', textOverflow: '', whiteSpace: '' },
      { height: '', minHeight: '', maxHeight: '', overflow: '', textOverflow: '', whiteSpace: '' },
    ])
  }

  try {
    const editor = await openOverflowDocument(page)
    const tables = editor.locator('table.rv-office-table')
    await expect(tables).toHaveCount(2)
    const target = tables.nth(0)
    const explicitParagraph = target.locator('tbody > tr').nth(1)
      .locator('td').nth(0).locator('p')
    const seededParagraph = tables.nth(1).locator('tbody > tr').nth(1)
      .locator('td').nth(1).locator('p')
    const wrapper = explicitParagraph.locator('[data-rv-hardbreak="explicit"]')
    const stableWrapper = await wrapper.elementHandle()
    expect(stableWrapper).not.toBeNull()
    const forbiddenBefore = await tables.locator('tr, th, td').evaluateAll((nodes) => (
      nodes.map((node) => ({
        tag: node.tagName,
        attributes: Array.from(node.attributes).map(({ name, value }) => [name, value]),
      }))
    ))

    await expect(target).toHaveAttribute('data-rv-table-overflow', 'overflow')
    await expect(tables.nth(1)).toHaveAttribute('data-rv-table-overflow', 'truncate')
    const screenDefault = await readPresentation(target, explicitParagraph)
    const screenSeeded = await readPresentation(tables.nth(1), seededParagraph)
    expectSingleLine(screenDefault, 'overflow')
    expect(screenSeeded.mode).toBe('truncate')
    expect(screenSeeded.tableWidth).toBe(192)
    expect(screenSeeded.columns).toEqual([96, 96])
    expect(screenSeeded.paragraph).toMatchObject({
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    })
    expect(screenSeeded.paragraph.scrollWidth).toBeGreaterThan(
      screenSeeded.paragraph.clientWidth,
    )
    expectNoForbiddenInline(screenDefault)
    const screenOverflowPixels = await explicitParagraph.screenshot({
      animations: 'disabled',
    })
    const defaultBytes = fs.readFileSync(fixture.path)
    expect(defaultBytes).toEqual(canonicalBytes)

    await page.emulateMedia({ media: 'print' })
    const printDefault = await readPresentation(target, explicitParagraph)
    const printSeeded = await readPresentation(tables.nth(1), seededParagraph)
    expectSingleLine(printDefault, 'overflow')
    expectMediaParity(screenDefault, printDefault)
    expectMediaParity(screenSeeded, printSeeded)
    expect(await wrapper.evaluate((node, original) => node === original, stableWrapper)).toBe(true)
    expect(fs.readFileSync(fixture.path)).toEqual(defaultBytes)
    const printOverflowPixels = await explicitParagraph.screenshot({
      animations: 'disabled',
    })
    const overflowCopy = await copyParagraph(explicitParagraph)
    expect(overflowCopy).toContain('FirstLineSegmentABCDEFGHIJ')
    expect(overflowCopy).toContain('SecondLineSegmentKLMNOPQRST')

    await page.emulateMedia({ media: 'screen' })
    await resetOverflowObservation(page)
    await selectOverflowMode(page, target, 'Truncate')
    await expectSingleOverflowMetadataSave(page)
    const truncateBytes = fs.readFileSync(fixture.path)
    const screenTruncate = await readPresentation(target, explicitParagraph)
    expectSingleLine(screenTruncate, 'truncate')
    expectNoForbiddenInline(screenTruncate)
    const screenTruncatePixels = await explicitParagraph.screenshot({
      animations: 'disabled',
    })
    expect(screenTruncatePixels.equals(screenOverflowPixels)).toBe(false)
    expect(await copyParagraph(explicitParagraph)).toBe(overflowCopy)

    await page.emulateMedia({ media: 'print' })
    const printTruncate = await readPresentation(target, explicitParagraph)
    expectSingleLine(printTruncate, 'truncate')
    expectMediaParity(screenTruncate, printTruncate)
    const printTruncatePixels = await explicitParagraph.screenshot({
      animations: 'disabled',
    })
    expect(printTruncatePixels.equals(printOverflowPixels)).toBe(false)
    expect(await copyParagraph(explicitParagraph)).toBe(overflowCopy)
    expect(await wrapper.evaluate((node, original) => node === original, stableWrapper)).toBe(true)
    expect(fs.readFileSync(fixture.path)).toEqual(truncateBytes)

    await page.emulateMedia({ media: 'screen' })
    await resetOverflowObservation(page)
    await selectOverflowMode(page, target, 'New line')
    await expectSingleOverflowMetadataSave(page)
    const newlineBytes = fs.readFileSync(fixture.path)
    const screenNewline = await readPresentation(target, explicitParagraph)
    expectNewLine(screenNewline, screenTruncate)
    expectNoForbiddenInline(screenNewline)
    expect(await copyParagraph(explicitParagraph)).toBe(overflowCopy)

    await page.emulateMedia({ media: 'print' })
    const printNewline = await readPresentation(target, explicitParagraph)
    expectNewLine(printNewline, printTruncate)
    expectMediaParity(screenNewline, printNewline)
    expect(await copyParagraph(explicitParagraph)).toBe(overflowCopy)
    expect(await wrapper.evaluate((node, original) => node === original, stableWrapper)).toBe(true)
    expect(fs.readFileSync(fixture.path)).toEqual(newlineBytes)

    await resetOverflowObservation(page)
    await page.keyboard.press('ControlOrMeta+z')
    await expect(target).toHaveAttribute('data-rv-table-overflow', 'truncate')
    await expectSingleOverflowMetadataSave(page)
    expectSingleLine(await readPresentation(target, explicitParagraph), 'truncate')

    await resetOverflowObservation(page)
    await page.keyboard.press('ControlOrMeta+Shift+z')
    await expect(target).toHaveAttribute('data-rv-table-overflow', 'newline')
    await expectSingleOverflowMetadataSave(page)
    expectNewLine(
      await readPresentation(target, explicitParagraph),
      printTruncate,
    )
    const finalDisk = readOverflowDisk(fixture.path)
    expect(finalDisk.body.match(/<br>/g) ?? []).toHaveLength(1)
    expect(finalDisk.body).toContain(
      'FirstLineSegmentABCDEFGHIJ<br>SecondLineSegmentKLMNOPQRST',
    )
    expect(finalDisk.styles.find(({ tableIndex }) => tableIndex === 0)?.tableOverflow)
      .toBe('newline')
    expect(finalDisk.styles.find(({ tableIndex }) => tableIndex === 1)?.tableOverflow)
      .toBe('truncate')
    expect(JSON.stringify(finalDisk.metadata)).not.toMatch(/rowHeight|rowHeights/)
    const beforeReopen = finalDisk.bytes

    await page.emulateMedia({ media: 'screen' })
    await page.getByTitle('Back', { exact: true }).click()
    const reopened = await openOverflowDocument(page)
    const reopenedTables = reopened.locator('table.rv-office-table')
    await expect(reopenedTables.nth(0)).toHaveAttribute(
      'data-rv-table-overflow',
      'newline',
    )
    await expect(reopenedTables.nth(1)).toHaveAttribute(
      'data-rv-table-overflow',
      'truncate',
    )
    const reopenedParagraph = reopenedTables.nth(0).locator('tbody > tr').nth(1)
      .locator('td').nth(0).locator('p')
    const reopenedScreen = await readPresentation(
      reopenedTables.nth(0),
      reopenedParagraph,
    )
    await page.emulateMedia({ media: 'print' })
    const reopenedPrint = await readPresentation(
      reopenedTables.nth(0),
      reopenedParagraph,
    )
    expectMediaParity(reopenedScreen, reopenedPrint)
    expect(fs.readFileSync(fixture.path)).toEqual(beforeReopen)

    const forbiddenAfter = await reopenedTables.locator('tr, th, td').evaluateAll(
      (nodes) => nodes.map((node) => ({
        tag: node.tagName,
        attributes: Array.from(node.attributes).map(({ name, value }) => [name, value]),
      })),
    )
    expect(forbiddenAfter).toEqual(forbiddenBefore)
    await expect(reopened.locator('[data-rv-hardbreak="explicit"]')).toHaveCount(1)
    await expect(reopened.locator('[data-rv-hardbreak="explicit"] > br')).toHaveCount(1)
  } finally {
    await page.emulateMedia({ media: 'screen' }).catch(() => {})
    await page.close()
    fs.writeFileSync(fixture.path, canonicalBytes)
    await resetOverflowFixture()
  }
})

test('[slice 07.3] explicit-break transitions retain one stable semantic node with exact visual modes', async ({ page }) => {
  test.setTimeout(150_000)
  const fixture = await resetOverflowFixture()
  const canonicalBytes = fs.readFileSync(fixture.path)
  await installSaveObservation(page)

  const readPresentation = async (paragraph: ReturnType<Page['locator']>) => paragraph.evaluate(
    (node) => {
      const wrapper = node.querySelector<HTMLElement>('[data-rv-hardbreak="explicit"]')
      const br = wrapper?.querySelector('br')
      const previous = wrapper?.previousSibling
      const next = wrapper?.nextSibling
      if (!wrapper || !br || !(previous instanceof Text) || !(next instanceof Text)) return null

      const characterRect = (text: Text, from: number, to: number) => {
        const range = document.createRange()
        range.setStart(text, from)
        range.setEnd(text, to)
        return range.getBoundingClientRect()
      }
      const previousRect = characterRect(
        previous,
        Math.max(0, previous.length - 1),
        previous.length,
      )
      const nextRect = characterRect(next, 0, Math.min(1, next.length))
      const contentRange = document.createRange()
      contentRange.selectNodeContents(node)
      const lineTops = Array.from(contentRange.getClientRects())
        .filter(({ width, height }) => width > 0 && height > 0)
        .map(({ top }) => Math.round(top * 10) / 10)
        .filter((top, index, all) => all.indexOf(top) === index)

      const style = getComputedStyle(node)
      const reference = document.createElement('span')
      Object.assign(reference.style, {
        position: 'fixed',
        left: '-100000px',
        top: '0',
        whiteSpace: 'nowrap',
        font: style.font,
        fontKerning: style.fontKerning,
        fontFeatureSettings: style.fontFeatureSettings,
        fontVariationSettings: style.fontVariationSettings,
        letterSpacing: style.letterSpacing,
        wordSpacing: style.wordSpacing,
      })
      const referenceBefore = document.createTextNode(previous.data.slice(-1))
      const referenceSpace = document.createTextNode(' ')
      const referenceAfter = document.createTextNode(next.data.slice(0, 1))
      reference.append(referenceBefore, referenceSpace, referenceAfter)
      document.body.appendChild(reference)
      const referenceBeforeRect = characterRect(referenceBefore, 0, referenceBefore.length)
      const referenceAfterRect = characterRect(referenceAfter, 0, referenceAfter.length)
      const referenceGap = referenceAfterRect.left - referenceBeforeRect.right
      reference.remove()

      return {
        semanticSentence: Array.from(node.childNodes).map((child) => (
          child === wrapper ? ' ' : child.textContent ?? ''
        )).join(''),
        scrollWidth: node.scrollWidth,
        clientWidth: node.clientWidth,
        paragraphHeight: node.getBoundingClientRect().height,
        cellHeight: node.closest('td, th')?.getBoundingClientRect().height ?? 0,
        lineTops,
        neighboringLineDelta: Math.abs(previousRect.top - nextRect.top),
        visualGap: nextRect.left - previousRect.right,
        referenceGap,
        brDisplay: getComputedStyle(br).display,
        pseudoContent: getComputedStyle(wrapper, '::after').content,
        wrapperHtml: wrapper.outerHTML,
        textOverflow: style.textOverflow,
        whiteSpace: style.whiteSpace,
        forbiddenInlineStyles: [node.closest('tr'), node.closest('td, th'), node].map(
          (element) => {
            const inline = (element as HTMLElement | null)?.style
            return inline ? {
              height: inline.height,
              minHeight: inline.minHeight,
              maxHeight: inline.maxHeight,
              overflow: inline.overflow,
              textOverflow: inline.textOverflow,
              whiteSpace: inline.whiteSpace,
            } : null
          },
        ),
      }
    },
  )
  const expectSingleLine = (evidence: NonNullable<Awaited<ReturnType<typeof readPresentation>>>) => {
    expect(evidence.semanticSentence)
      .toBe('FirstLineSegmentABCDEFGHIJ SecondLineSegmentKLMNOPQRST')
    expect(evidence.scrollWidth).toBeGreaterThan(evidence.clientWidth)
    expect(evidence.lineTops).toHaveLength(1)
    expect(evidence.neighboringLineDelta).toBeLessThan(0.75)
    expect(Math.abs(evidence.visualGap - evidence.referenceGap)).toBeLessThan(0.75)
    expect(evidence.brDisplay).toBe('none')
    expect(evidence.pseudoContent).toBe('" "')
    expect(evidence.forbiddenInlineStyles).toEqual([
      { height: '', minHeight: '', maxHeight: '', overflow: '', textOverflow: '', whiteSpace: '' },
      { height: '', minHeight: '', maxHeight: '', overflow: '', textOverflow: '', whiteSpace: '' },
      { height: '', minHeight: '', maxHeight: '', overflow: '', textOverflow: '', whiteSpace: '' },
    ])
  }
  const expectModeOnDisk = (mode: OverflowMode) => {
    const disk = readOverflowDisk(fixture.path)
    expect(disk.body.match(/<br>/g) ?? []).toHaveLength(1)
    expect(disk.body).toContain(
      'FirstLineSegmentABCDEFGHIJ<br>SecondLineSegmentKLMNOPQRST',
    )
    expect(disk.styles.find(({ tableIndex }) => tableIndex === 0)?.tableOverflow).toBe(mode)
    expect(JSON.stringify(disk.metadata)).not.toMatch(/rowHeight|rowHeights/)
    return disk
  }

  try {
    const editor = await openOverflowDocument(page)
    const tables = editor.locator('table.rv-office-table')
    const target = tables.nth(0)
    const paragraph = target.locator('tbody > tr').nth(1).locator('td').nth(0).locator('p')
    const wrapper = paragraph.locator('[data-rv-hardbreak="explicit"]')
    await expect(wrapper).toHaveCount(1)
    await expect(wrapper.locator(':scope > br')).toHaveCount(1)
    const stableWrapper = await wrapper.elementHandle()
    expect(stableWrapper).not.toBeNull()

    const forbiddenBefore = await target.locator('tr, th, td').evaluateAll((nodes) => (
      nodes.map((node) => ({
        tag: node.tagName,
        attributes: Array.from(node.attributes).map(({ name, value }) => [name, value]),
      }))
    ))
    const overflowEvidence = await readPresentation(paragraph)
    expect(overflowEvidence).not.toBeNull()
    expectSingleLine(overflowEvidence!)
    expect(overflowEvidence?.textOverflow).toBe('clip')
    expect(overflowEvidence?.whiteSpace).toBe('nowrap')
    const overflowPixels = await paragraph.screenshot({ animations: 'disabled' })

    await resetOverflowObservation(page)
    await selectOverflowMode(page, target, 'New line')
    await expect(target).toHaveAttribute('data-rv-table-overflow', 'newline')
    await expectSingleOverflowMetadataSave(page)
    const newlineEvidence = await readPresentation(paragraph)
    expect(newlineEvidence).not.toBeNull()
    expect(newlineEvidence?.semanticSentence)
      .toBe('FirstLineSegmentABCDEFGHIJ SecondLineSegmentKLMNOPQRST')
    expect(newlineEvidence?.wrapperHtml)
      .toContain('data-rv-hardbreak="explicit"')
    expect(newlineEvidence?.wrapperHtml).toContain('<br>')
    expect(newlineEvidence?.brDisplay).not.toBe('none')
    expect(newlineEvidence?.pseudoContent).toBe('none')
    expect(newlineEvidence?.lineTops.length).toBeGreaterThanOrEqual(2)
    expect(newlineEvidence?.paragraphHeight).toBeGreaterThan(overflowEvidence!.paragraphHeight)
    expect(newlineEvidence?.cellHeight).toBeGreaterThan(overflowEvidence!.cellHeight)
    expect(newlineEvidence?.forbiddenInlineStyles).toEqual([
      { height: '', minHeight: '', maxHeight: '', overflow: '', textOverflow: '', whiteSpace: '' },
      { height: '', minHeight: '', maxHeight: '', overflow: '', textOverflow: '', whiteSpace: '' },
      { height: '', minHeight: '', maxHeight: '', overflow: '', textOverflow: '', whiteSpace: '' },
    ])
    expect(await wrapper.evaluate((node, original) => node === original, stableWrapper)).toBe(true)
    expectModeOnDisk('newline')

    await resetOverflowObservation(page)
    await selectOverflowMode(page, target, 'Truncate')
    await expect(target).toHaveAttribute('data-rv-table-overflow', 'truncate')
    await expectSingleOverflowMetadataSave(page)
    const truncateEvidence = await readPresentation(paragraph)
    expect(truncateEvidence).not.toBeNull()
    expectSingleLine(truncateEvidence!)
    expect(truncateEvidence?.textOverflow).toBe('ellipsis')
    expect(truncateEvidence?.paragraphHeight).toBe(overflowEvidence?.paragraphHeight)
    expect(truncateEvidence?.cellHeight).toBe(overflowEvidence?.cellHeight)
    expect(await wrapper.evaluate((node, original) => node === original, stableWrapper)).toBe(true)
    const truncatePixels = await paragraph.screenshot({ animations: 'disabled' })
    expect(truncatePixels.length).toBeGreaterThan(0)
    expect(truncatePixels.equals(overflowPixels)).toBe(false)
    expectModeOnDisk('truncate')

    await resetOverflowObservation(page)
    await selectOverflowMode(page, target, 'New line')
    await expect(target).toHaveAttribute('data-rv-table-overflow', 'newline')
    await expectSingleOverflowMetadataSave(page)
    expect((await readPresentation(paragraph))?.lineTops.length).toBeGreaterThanOrEqual(2)
    expect(await wrapper.evaluate((node, original) => node === original, stableWrapper)).toBe(true)
    expectModeOnDisk('newline')

    await resetOverflowObservation(page)
    await selectOverflowMode(page, target, 'Overflow')
    await expect(target).toHaveAttribute('data-rv-table-overflow', 'overflow')
    await expectSingleOverflowMetadataSave(page)
    const returnedOverflow = await readPresentation(paragraph)
    expect(returnedOverflow).not.toBeNull()
    expectSingleLine(returnedOverflow!)
    expect(returnedOverflow?.textOverflow).toBe('clip')
    expect(returnedOverflow?.paragraphHeight).toBe(overflowEvidence?.paragraphHeight)
    expect(returnedOverflow?.cellHeight).toBe(overflowEvidence?.cellHeight)
    expect(await paragraph.screenshot({ animations: 'disabled' })).toEqual(overflowPixels)
    expect(await wrapper.evaluate((node, original) => node === original, stableWrapper)).toBe(true)
    expectModeOnDisk('overflow')

    await resetOverflowObservation(page)
    await page.keyboard.press('ControlOrMeta+z')
    await expect(target).toHaveAttribute('data-rv-table-overflow', 'newline')
    await expectSingleOverflowMetadataSave(page)
    expect((await readPresentation(paragraph))?.lineTops.length).toBeGreaterThanOrEqual(2)
    expectModeOnDisk('newline')

    await resetOverflowObservation(page)
    await page.keyboard.press('ControlOrMeta+Shift+z')
    await expect(target).toHaveAttribute('data-rv-table-overflow', 'overflow')
    await expectSingleOverflowMetadataSave(page)
    expectSingleLine((await readPresentation(paragraph))!)
    expectModeOnDisk('overflow')

    const forbiddenAfter = await target.locator('tr, th, td').evaluateAll((nodes) => (
      nodes.map((node) => ({
        tag: node.tagName,
        attributes: Array.from(node.attributes).map(({ name, value }) => [name, value]),
      }))
    ))
    expect(forbiddenAfter).toEqual(forbiddenBefore)
    await expect(editor.locator('[data-rv-hardbreak="explicit"]')).toHaveCount(1)
    await expect(wrapper.locator(':scope > br')).toHaveCount(1)
  } finally {
    await page.close()
    fs.writeFileSync(fixture.path, canonicalBytes)
    await resetOverflowFixture()
  }
})

test('[slice 07.3] structure rebuild insertion removal history and reopen preserve table modes', async ({ page }) => {
  test.setTimeout(240_000)
  const fixture = await resetOverflowFixture()
  const canonicalBytes = fs.readFileSync(fixture.path)
  const canonicalText = canonicalBytes.toString()
  const canonicalStyleBlock = [
    '  tableStyles:',
    "    - { tableIndex: 1, fingerprint: 'fixture-overflow-b', tableOverflow: 'truncate', fixtureSeed: 'keep-overflow' }",
  ].join('\n')
  const seededStyleBlock = [
    '  tableColors:',
    "    - { tableIndex: 0, fingerprint: 'fixture-overflow-a', cells: { '1,1': '#123456' }, futureColor: 'keep-color' }",
    '  tableStyles:',
    "    - { tableIndex: 0, fingerprint: 'fixture-overflow-a', tableOverflow: 'newline', futureStyle: 'keep-a' }",
    "    - { tableIndex: 1, fingerprint: 'fixture-overflow-b', tableOverflow: 'truncate', fixtureSeed: 'keep-overflow' }",
  ].join('\n')
  const seededText = canonicalText.replace(canonicalStyleBlock, seededStyleBlock)
  expect(seededText).not.toBe(canonicalText)
  fs.writeFileSync(fixture.path, seededText)
  await installSaveObservation(page)

  const assertModes = async (
    tables: ReturnType<Page['locator']>,
    modes: readonly OverflowMode[],
  ) => {
    await expect(tables).toHaveCount(modes.length)
    for (const [index, mode] of modes.entries()) {
      await expect(tables.nth(index)).toHaveAttribute('data-rv-table-overflow', mode)
    }
  }
  const assertCollectionIndices = (
    expected: {
      tables: number[]
      tableColors: number[]
      tableStyles: number[]
    },
  ) => {
    const { metadata } = readOverflowDisk(fixture.path)
    for (const collection of ['tables', 'tableColors', 'tableStyles'] as const) {
      expect((metadata[collection] as Array<Record<string, unknown>>)
        .map(({ tableIndex }) => tableIndex)).toEqual(expected[collection])
    }
  }
  const assertDiskState = (expected: ReturnType<typeof readOverflowDisk>) => {
    const actual = readOverflowDisk(fixture.path)
    expect(actual.bytes).toEqual(expected.bytes)
    expect(actual.body).toBe(expected.body)
    for (const collection of ['tables', 'tableColors', 'tableStyles'] as const) {
      expect(actual.metadata[collection]).toEqual(expected.metadata[collection])
    }
    expect(actual.styles).toEqual(expected.styles)
  }
  const runStructureAction = async (
    table: ReturnType<Page['locator']>,
    row: number,
    column: number,
    action: string,
  ) => {
    await table.locator('tbody > tr').nth(row).locator('td, th').nth(column)
      .click({ button: 'right' })
    await page.getByRole('menu', { name: 'Table cell actions' })
      .getByRole('menuitem', { name: action, exact: true }).click()
  }
  const insertAtHeading = async (heading: string) => {
    await page.getByRole('heading', { name: heading, exact: true }).click({ button: 'right' })
    const menu = page.locator('.rv-office-insert-context-menu')
    await expect(menu).toBeVisible()
    await menu.locator('[data-office-insert="table"]').hover()
    const grid = page.locator('.rv-office-table-grid-popover')
    await expect(grid).toBeVisible()
    await grid.locator('[data-row="2"][data-col="2"]').click()
  }
  const removeTable = async (table: ReturnType<Page['locator']>) => {
    await table.locator('tbody > tr').last().locator('td, th').first()
      .click({ button: 'right' })
    const rootMenu = page.getByRole('menu', { name: 'Table cell actions' })
    await rootMenu.getByRole('menuitem', { name: 'Table', exact: true }).hover()
    await page.getByRole('menu', { name: 'Table', exact: true })
      .getByRole('menuitem', { name: 'Remove table', exact: true }).click()
    await page.getByRole('dialog', { name: 'Remove table', exact: true })
      .getByRole('button', { name: 'Remove table', exact: true }).click()
  }

  try {
    const editor = await openOverflowDocument(page)
    const tables = editor.locator('table.rv-office-table')
    await assertModes(tables, ['newline', 'truncate'])
    await page.waitForTimeout(750)
    expect(await readSaveCount(page)).toBe(0)

    const header = tables.nth(0).locator('tbody > tr').first().locator('th').first()
    await resetOverflowObservation(page)
    await header.click()
    await page.keyboard.press('End')
    await page.keyboard.type('-rebuilt')
    await expect(header).toHaveText('overflow-a-h0-rebuilt')
    await expectSingleOverflowSave(page)
    expect(await readMetadataEvents(page)).toEqual({})
    await assertModes(tables, ['newline', 'truncate'])

    await resetOverflowObservation(page)
    await page.keyboard.press('ControlOrMeta+z')
    await expect(header).toHaveText('overflow-a-h0')
    await expectSingleOverflowSave(page)
    expect(await readMetadataEvents(page)).toEqual({})
    await assertModes(tables, ['newline', 'truncate'])

    await resetOverflowObservation(page)
    await page.keyboard.press('ControlOrMeta+Shift+z')
    await expect(header).toHaveText('overflow-a-h0-rebuilt')
    await expectSingleOverflowSave(page)
    expect(await readMetadataEvents(page)).toEqual({})
    await assertModes(tables, ['newline', 'truncate'])
    const beforeHeaderMutation = readOverflowDisk(fixture.path)

    await resetOverflowObservation(page)
    await runStructureAction(tables.nth(0), 0, 0, 'Insert Row Above')
    await expect(tables.nth(0).locator('tbody > tr')).toHaveCount(3)
    await expectSingleOverflowMetadataSave(page)
    await assertModes(tables, ['newline', 'truncate'])
    let disk = readOverflowDisk(fixture.path)
    const insertedRowLayout = (disk.metadata.tables as Array<Record<string, unknown>>)[0]
    const insertedRowColor = (disk.metadata.tableColors as Array<Record<string, unknown>>)[0]
    const insertedRowStyle = (disk.metadata.tableStyles as Array<Record<string, unknown>>)[0]
    expect(insertedRowLayout.fingerprint).toBe(insertedRowColor.fingerprint)
    expect(insertedRowLayout.fingerprint).toBe(insertedRowStyle.fingerprint)
    expect(insertedRowStyle.tableOverflow).toBe('newline')
    expect(insertedRowStyle.futureStyle).toBe('keep-a')
    expect(insertedRowStyle.fingerprint)
      .not.toBe((beforeHeaderMutation.metadata.tableStyles as Array<Record<string, unknown>>)[0]
        .fingerprint)
    const insertedRowDisk = disk

    await resetOverflowObservation(page)
    await page.keyboard.press('ControlOrMeta+z')
    await expect(tables.nth(0).locator('tbody > tr')).toHaveCount(2)
    await expectSingleOverflowMetadataSave(page)
    await assertModes(tables, ['newline', 'truncate'])
    assertDiskState(beforeHeaderMutation)

    await resetOverflowObservation(page)
    await page.keyboard.press('ControlOrMeta+Shift+z')
    await expect(tables.nth(0).locator('tbody > tr')).toHaveCount(3)
    await expectSingleOverflowMetadataSave(page)
    await assertModes(tables, ['newline', 'truncate'])
    assertDiskState(insertedRowDisk)

    await resetOverflowObservation(page)
    await runStructureAction(tables.nth(0), 1, 0, 'Delete Row Above')
    await expect(tables.nth(0).locator('tbody > tr')).toHaveCount(2)
    await expectSingleOverflowMetadataSave(page)
    await assertModes(tables, ['newline', 'truncate'])
    disk = readOverflowDisk(fixture.path)
    const restoredRowLayout = (disk.metadata.tables as Array<Record<string, unknown>>)[0]
    const restoredRowColor = (disk.metadata.tableColors as Array<Record<string, unknown>>)[0]
    const restoredRowStyle = (disk.metadata.tableStyles as Array<Record<string, unknown>>)[0]
    expect(restoredRowLayout.fingerprint).toBe(restoredRowColor.fingerprint)
    expect(restoredRowLayout.fingerprint).toBe(restoredRowStyle.fingerprint)
    expect(restoredRowStyle.tableOverflow).toBe('newline')
    const restoredRowDisk = disk

    await resetOverflowObservation(page)
    await runStructureAction(tables.nth(0), 1, 0, 'Insert Column Right')
    await expect(tables.nth(0).locator('colgroup > col')).toHaveCount(3)
    await expectSingleOverflowMetadataSave(page)
    await assertModes(tables, ['newline', 'truncate'])
    disk = readOverflowDisk(fixture.path)
    const insertedColumnLayout = (disk.metadata.tables as Array<Record<string, unknown>>)[0]
    const insertedColumnColor = (disk.metadata.tableColors as Array<Record<string, unknown>>)[0]
    const insertedColumnStyle = (disk.metadata.tableStyles as Array<Record<string, unknown>>)[0]
    expect(insertedColumnLayout.fingerprint).toBe(insertedColumnColor.fingerprint)
    expect(insertedColumnLayout.fingerprint).toBe(insertedColumnStyle.fingerprint)
    expect(insertedColumnLayout.columns).toEqual([96, 96, 96])
    expect(insertedColumnStyle.tableOverflow).toBe('newline')
    const insertedColumnDisk = disk

    await resetOverflowObservation(page)
    await page.keyboard.press('ControlOrMeta+z')
    await expect(tables.nth(0).locator('colgroup > col')).toHaveCount(2)
    await expectSingleOverflowMetadataSave(page)
    await assertModes(tables, ['newline', 'truncate'])
    assertDiskState(restoredRowDisk)

    await resetOverflowObservation(page)
    await page.keyboard.press('ControlOrMeta+Shift+z')
    await expect(tables.nth(0).locator('colgroup > col')).toHaveCount(3)
    await expectSingleOverflowMetadataSave(page)
    await assertModes(tables, ['newline', 'truncate'])
    assertDiskState(insertedColumnDisk)

    await resetOverflowObservation(page)
    await runStructureAction(tables.nth(0), 1, 0, 'Delete Column Right')
    await expect(tables.nth(0).locator('colgroup > col')).toHaveCount(2)
    await expectSingleOverflowMetadataSave(page)
    await assertModes(tables, ['newline', 'truncate'])
    disk = readOverflowDisk(fixture.path)
    const restoredColumnLayout = (disk.metadata.tables as Array<Record<string, unknown>>)[0]
    const restoredColumnColor = (disk.metadata.tableColors as Array<Record<string, unknown>>)[0]
    const restoredColumnStyle = (disk.metadata.tableStyles as Array<Record<string, unknown>>)[0]
    expect(restoredColumnLayout.fingerprint).toBe(restoredColumnColor.fingerprint)
    expect(restoredColumnLayout.fingerprint).toBe(restoredColumnStyle.fingerprint)
    expect(restoredColumnLayout.columns).toEqual([96, 96])
    expect(restoredColumnStyle.tableOverflow).toBe('newline')

    await resetOverflowObservation(page)
    await insertAtHeading('overflow-a')
    await expectSingleOverflowMetadataSave(page)
    await assertModes(tables, ['overflow', 'newline', 'truncate'])
    assertCollectionIndices({
      tables: [1, 2],
      tableColors: [1],
      tableStyles: [1, 2],
    })
    await expect(tables.nth(0).locator('[data-rv-hardbreak]')).toHaveCount(0)

    await resetOverflowObservation(page)
    await removeTable(tables.nth(0))
    await expectSingleOverflowMetadataSave(page)
    await assertModes(tables, ['newline', 'truncate'])
    assertCollectionIndices({
      tables: [0, 1],
      tableColors: [0],
      tableStyles: [0, 1],
    })

    await resetOverflowObservation(page)
    await insertAtHeading('overflow-b')
    await expectSingleOverflowMetadataSave(page)
    await assertModes(tables, ['newline', 'overflow', 'truncate'])
    assertCollectionIndices({
      tables: [0, 2],
      tableColors: [0],
      tableStyles: [0, 2],
    })

    await resetOverflowObservation(page)
    await removeTable(tables.nth(1))
    await expectSingleOverflowMetadataSave(page)
    await assertModes(tables, ['newline', 'truncate'])
    assertCollectionIndices({
      tables: [0, 1],
      tableColors: [0],
      tableStyles: [0, 1],
    })

    disk = readOverflowDisk(fixture.path)
    expect(disk.body).toContain('overflow-a-h0-rebuilt')
    expect(disk.body.match(/<br>/g) ?? []).toHaveLength(1)
    expect(disk.styles.map(({ tableOverflow }) => tableOverflow))
      .toEqual(['newline', 'truncate'])
    expect(JSON.stringify(disk.metadata)).not.toMatch(/rowHeight|rowHeights/)
    for (const node of await tables.locator('tr, th, td').all()) {
      expect(await node.getAttribute('height')).toBeNull()
      expect(await node.evaluate((element) => {
        const inline = (element as HTMLElement).style
        return {
          height: inline.height,
          minHeight: inline.minHeight,
          maxHeight: inline.maxHeight,
          overflow: inline.overflow,
          textOverflow: inline.textOverflow,
          whiteSpace: inline.whiteSpace,
        }
      })).toEqual({
        height: '',
        minHeight: '',
        maxHeight: '',
        overflow: '',
        textOverflow: '',
        whiteSpace: '',
      })
    }

    await page.getByTitle('Back', { exact: true }).click()
    const reopened = await openOverflowDocument(page)
    const reopenedTables = reopened.locator('table.rv-office-table')
    await assertModes(reopenedTables, ['newline', 'truncate'])
    await expect(reopenedTables.nth(0).locator('tbody > tr').first().locator('th').first())
      .toHaveText('overflow-a-h0-rebuilt')
    await expect(reopened.locator('[data-rv-hardbreak="explicit"]')).toHaveCount(1)
    await expect(reopened.locator('[data-rv-hardbreak="explicit"] > br')).toHaveCount(1)
    expect(readOverflowDisk(fixture.path).bytes).toEqual(disk.bytes)
  } finally {
    await page.close()
    fs.writeFileSync(fixture.path, canonicalBytes)
    await resetOverflowFixture()
  }
})
