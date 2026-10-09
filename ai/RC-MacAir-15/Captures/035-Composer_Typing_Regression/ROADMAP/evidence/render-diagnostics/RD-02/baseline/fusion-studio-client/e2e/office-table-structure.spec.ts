import fs from 'node:fs'
import path from 'node:path'

import { expect, test, type Page } from '@playwright/test'
import { Schema, type Node as ProseNode } from '@milkdown/kit/prose/model'
import { EditorState, Plugin, type Transaction } from '@milkdown/kit/prose/state'
import { closeHistory, history, redo, undo } from '@milkdown/kit/prose/history'
import {
  CellSelection,
  TableMap,
  addColumnAfter,
  addColumnBefore,
  addRowAfter,
  deleteColumn,
  deleteRow,
  tableNodes,
} from '@milkdown/kit/prose/tables'
import { Step as ProseStep } from '@milkdown/kit/prose/transform'
import { build } from 'vite'

import {
  buildOfficeTableRowBoundaryTransaction,
  captureOfficeCommand,
  completeOfficeTableColumnWidths,
  createOfficeTableMutationCommand,
  createOfficeTableRowBoundaryCommand,
  createOfficeTableRowMutationCommand,
  OfficeTableMutationInvariantError,
  planOfficeTableMutation,
  requiresOfficeTableExactBoundaryFallback,
  runCertifiedStockOfficeTableMutation,
  runStockOfficeTableMutation,
  transformOfficeTableMetadata,
  verifyOfficeTableDimensions,
  verifyOfficeTableColumnMutationStructure,
  verifyOfficeTableMutationStructure,
  verifyOfficeTableRowMutationStructure,
  type OfficeTableDimensions,
  type OfficeTableStructureMutation,
} from '../src/components/office/officeTableMutations'
import {
  getLogicalTableCellContext,
  getOfficeTableActionDisabledReason,
  getOfficeTableMutationForAction,
} from '../src/components/office/officeTableContextMenu'
import {
  OfficeTableMetadataStep,
  OfficeTableMetadataPublicationError,
  createOfficeDeferredMarkdownPublicationState,
  createOfficeDirtySaveScheduler,
  createOfficeTableMetadataProsePlugin,
  cancelOfficeTableMetadataExternalSnapshot,
  deferOfficeTableMetadataExternalPublication,
  publishOfficeTableMetadataCombinedCallbacks,
  publishOfficeTableMetadataExternalSnapshot,
  publishOfficeTableMetadataSnapshot,
  registerOfficeTableMetadataBindings,
  snapshotsEqual,
  type OfficeTableMetadataSnapshot,
} from '../src/components/office/officeTableHistory'
import { fingerprintProseTable } from '../src/components/office/officeTableIdentity'
import { resetOfficePlaywrightScenario } from './office/fixture-lifecycle.mjs'
import { getFixtureScenario, renderFixtureDocument } from './office/fixture-scenarios.mjs'
import {
  getDocumentTableColors,
  getDocumentTableLayouts,
  parseDocumentSettings,
  parseMarkdownFrontmatter,
  serializeDocumentSettings,
  setDocumentTableColors,
  setDocumentTableLayouts,
} from '../src/lib/front-matter'

const schema = new Schema({
  nodes: {
    doc: { content: 'paragraph+' },
    paragraph: { content: 'text*', toDOM: () => ['p', 0] },
    text: {},
  },
})

function dispatchState(stateRef: { current: EditorState }, transaction: Parameters<EditorState['apply']>[0]) {
  stateRef.current = stateRef.current.applyTransaction(transaction).state
}

test.describe('[slice 01.1] pure mutation planning and dimension verification', () => {
  const dimensions: OfficeTableDimensions = { rows: 5, columns: 4 }
  const cases: Array<{ mutation: OfficeTableStructureMutation; expected: OfficeTableDimensions }> = [
    { mutation: { axis: 'row', action: 'insert', index: 0 }, expected: { rows: 6, columns: 4 } },
    { mutation: { axis: 'row', action: 'insert', index: 2 }, expected: { rows: 6, columns: 4 } },
    { mutation: { axis: 'row', action: 'insert', index: 5 }, expected: { rows: 6, columns: 4 } },
    { mutation: { axis: 'row', action: 'delete', index: 0 }, expected: { rows: 4, columns: 4 } },
    { mutation: { axis: 'row', action: 'delete', index: 2 }, expected: { rows: 4, columns: 4 } },
    { mutation: { axis: 'row', action: 'delete', index: 4 }, expected: { rows: 4, columns: 4 } },
    { mutation: { axis: 'column', action: 'insert', index: 0, anchorIndex: 0 }, expected: { rows: 5, columns: 5 } },
    { mutation: { axis: 'column', action: 'insert', index: 2, anchorIndex: 2 }, expected: { rows: 5, columns: 5 } },
    { mutation: { axis: 'column', action: 'insert', index: 4, anchorIndex: 3 }, expected: { rows: 5, columns: 5 } },
    { mutation: { axis: 'column', action: 'delete', index: 0 }, expected: { rows: 5, columns: 3 } },
    { mutation: { axis: 'column', action: 'delete', index: 2 }, expected: { rows: 5, columns: 3 } },
    { mutation: { axis: 'column', action: 'delete', index: 3 }, expected: { rows: 5, columns: 3 } },
  ]

  for (const { mutation, expected } of cases) {
    test(`${mutation.axis} ${mutation.action} at ${mutation.index}`, () => {
      expect(planOfficeTableMutation(dimensions, mutation)?.expected).toEqual(expected)
      expect(verifyOfficeTableDimensions(dimensions, expected, mutation)).toBe(true)
      expect(verifyOfficeTableDimensions(dimensions, dimensions, mutation)).toBe(false)
    })
  }

  test('rejects invalid and minimum-breaking plans', () => {
    expect(planOfficeTableMutation(dimensions, { axis: 'row', action: 'delete', index: 5 })).toBeNull()
    expect(planOfficeTableMutation(dimensions, {
      axis: 'column', action: 'insert', index: 5, anchorIndex: 3,
    })).toBeNull()
    expect(planOfficeTableMutation(dimensions, {
      axis: 'column', action: 'insert', index: 2, anchorIndex: 4,
    })).toBeNull()
    expect(planOfficeTableMutation({ rows: 2, columns: 1 }, { axis: 'row', action: 'delete', index: 1 })).toBeNull()
    expect(planOfficeTableMutation({ rows: 2, columns: 1 }, { axis: 'column', action: 'delete', index: 0 })).toBeNull()
  })

  test('false and no-op command results produce no proposed mutation transaction', () => {
    const state = EditorState.create({
      schema,
      doc: schema.node('doc', null, [schema.node('paragraph', null, schema.text('A'))]),
    })
    expect(captureOfficeCommand(state, () => false)).toEqual({ accepted: false, transactions: [] })
    expect(captureOfficeCommand(state, () => true)).toEqual({ accepted: true, transactions: [] })
  })
})

const coordinatorSchema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: { group: 'block', content: 'text*' },
    text: {},
    ...tableNodes({ tableGroup: 'block', cellContent: 'paragraph+' }),
  },
})

const rowBoundaryNodes = tableNodes({
  tableGroup: 'block',
  cellContent: 'paragraph+',
  cellAttributes: { alignment: { default: 'left' } },
})

const rowBoundarySchema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: { group: 'block', content: 'text*' },
    text: {},
    table: { ...rowBoundaryNodes.table, content: 'table_header_row table_row+' },
    table_header_row: { ...rowBoundaryNodes.table_row, content: 'table_header*' },
    table_row: { ...rowBoundaryNodes.table_row, content: 'table_cell*' },
    table_header: rowBoundaryNodes.table_header,
    table_cell: rowBoundaryNodes.table_cell,
  },
})

function rowBoundaryParagraph(text: string): ProseNode {
  return rowBoundarySchema.node(
    'paragraph',
    null,
    text ? rowBoundarySchema.text(text) : undefined,
  )
}

function rowBoundaryTable(rows: number, columns = 3): ProseNode {
  const alignments = ['left', 'center', 'right']
  const header = rowBoundarySchema.node('table_header_row', null, Array.from(
    { length: columns },
    (_, column) => rowBoundarySchema.node(
      'table_header',
      { alignment: alignments[column % alignments.length] },
      rowBoundaryParagraph(`H${column}`),
    ),
  ))
  const data = Array.from({ length: rows - 1 }, (_, dataIndex) => rowBoundarySchema.node(
    'table_row',
    null,
    Array.from({ length: columns }, (_, column) => rowBoundarySchema.node(
      'table_cell',
      { alignment: alignments[(column + dataIndex + 1) % alignments.length] },
      rowBoundaryParagraph(`${String.fromCharCode(65 + dataIndex)}${column}`),
    )),
  ))
  return rowBoundarySchema.node('table', null, [header, ...data])
}

function rowBoundaryRowEvidence(table: ProseNode) {
  return Array.from({ length: table.childCount }, (_, rowIndex) => {
    const row = table.child(rowIndex)
    return {
      type: row.type.name,
      cells: Array.from({ length: row.childCount }, (_, cellIndex) => {
        const cell = row.child(cellIndex)
        return { type: cell.type.name, text: cell.textContent, attrs: { ...cell.attrs } }
      }),
    }
  })
}

function rowBoundaryLogicalText(table: ProseNode) {
  const map = TableMap.get(table)
  return Array.from({ length: map.height }, (_, rowIndex) => (
    Array.from({ length: map.width }, (_, columnIndex) => (
      table.nodeAt(map.map[rowIndex * map.width + columnIndex])?.textContent ?? null
    ))
  ))
}

function createRowBoundaryHistoryHarness(
  table: ProseNode,
  before: OfficeTableMetadataSnapshot,
) {
  const snapshot = structuredClone(before)
  const root = {} as HTMLElement
  let activeToken = 0
  let dispatches = 0
  const publicationFrames: Array<{
    fingerprint: string
    snapshot: OfficeTableMetadataSnapshot
  }> = []
  const unregister = registerOfficeTableMetadataBindings(root, {
    readTables: () => structuredClone(snapshot.tables),
    readTableColors: () => structuredClone(snapshot.tableColors),
    publishTables: (tables) => { snapshot.tables = structuredClone(tables) },
    publishTableColors: (colors) => { snapshot.tableColors = structuredClone(colors) },
    prepareDeferredSnapshot: (token) => {
      activeToken = token
      return true
    },
    cancelDeferredSnapshot: (token) => token === activeToken,
    isCurrentSnapshot: (token) => token === activeToken,
    publishSnapshot: (_next, _before, document, token) => {
      if (token !== activeToken) return false
      publicationFrames.push({
        fingerprint: fingerprintProseTable(document.child(0)),
        snapshot: structuredClone(snapshot),
      })
      return true
    },
  })
  const metadataPlugin = createOfficeTableMetadataProsePlugin((next, document, deferExternal, token) => {
    publishOfficeTableMetadataSnapshot(root, next, document, { deferExternal, token })
  })
  const initialDocument = rowBoundarySchema.node('doc', null, [table])
  const view = {
    state: EditorState.create({
      schema: rowBoundarySchema,
      doc: initialDocument,
      plugins: [history(), metadataPlugin],
    }),
    dispatch(transaction: Transaction) {
      dispatches += 1
      this.state = this.state.applyTransaction(transaction).state
    },
  }
  const selectionKey = {} as never
  const commands = {
    get: () => () => (state: EditorState, dispatch?: (transaction: Transaction) => void) => {
      dispatch?.(state.tr.setMeta('exact-row-boundary-selection', true))
      return true
    },
  }
  return {
    root,
    snapshot,
    publicationFrames,
    initialDocument,
    view,
    selectionKey,
    commands,
    dispatchCount: () => dispatches,
    unregister,
  }
}

test.describe('[slice 01.2] pure schema-header row boundary transactions', () => {
  for (const rows of [2, 3, 5]) {
    test(`top insertion preserves one ${rows}-row table and demotes the former header in order`, () => {
      const table = rowBoundaryTable(rows)
      const state = EditorState.create({
        schema: rowBoundarySchema,
        doc: rowBoundarySchema.node('doc', null, [table]),
      })
      const transaction = buildOfficeTableRowBoundaryTransaction(
        state,
        0,
        { axis: 'row', action: 'insert', index: 0 },
      )
      expect(transaction).not.toBeNull()
      const nextDocument = transaction!.doc
      expect(nextDocument.childCount).toBe(1)
      const nextTable = nextDocument.child(0)
      expect(nextTable.type.name).toBe('table')
      expect(TableMap.get(nextTable)).toMatchObject({ height: rows + 1, width: 3 })
      const evidence = rowBoundaryRowEvidence(nextTable)
      expect(evidence[0].type).toBe('table_header_row')
      expect(evidence[0].cells.map(({ type }) => type)).toEqual([
        'table_header', 'table_header', 'table_header',
      ])
      expect(evidence[0].cells.map(({ text }) => text)).toEqual(['', '', ''])
      expect(evidence[0].cells.map(({ attrs }) => attrs.alignment)).toEqual(['left', 'center', 'right'])
      expect(evidence[1].type).toBe('table_row')
      expect(evidence[1].cells.map(({ type }) => type)).toEqual(['table_cell', 'table_cell', 'table_cell'])
      expect(evidence[1].cells.map(({ text }) => text)).toEqual(['H0', 'H1', 'H2'])
      expect(evidence.slice(2).map((row) => row.cells.map(({ text }) => text)))
        .toEqual(rowBoundaryRowEvidence(table).slice(1).map((row) => row.cells.map(({ text }) => text)))
    })
  }

  for (const rows of [3, 5]) {
    test(`header deletion promotes physical row 1 in a ${rows}-row table without reordering later rows`, () => {
      const table = rowBoundaryTable(rows)
      const state = EditorState.create({
        schema: rowBoundarySchema,
        doc: rowBoundarySchema.node('doc', null, [table]),
      })
      const transaction = buildOfficeTableRowBoundaryTransaction(
        state,
        0,
        { axis: 'row', action: 'delete', index: 0 },
      )
      expect(transaction).not.toBeNull()
      const nextTable = transaction!.doc.child(0)
      expect(TableMap.get(nextTable)).toMatchObject({ height: rows - 1, width: 3 })
      const evidence = rowBoundaryRowEvidence(nextTable)
      expect(evidence[0].type).toBe('table_header_row')
      expect(evidence[0].cells.map(({ type }) => type)).toEqual([
        'table_header', 'table_header', 'table_header',
      ])
      expect(evidence.map((row) => row.cells.map(({ text }) => text)))
        .toEqual(rowBoundaryRowEvidence(table).slice(1).map((row) => row.cells.map(({ text }) => text)))
    })
  }

  test('two-row header deletion is rejected without a proposed transaction', () => {
    const state = EditorState.create({
      schema: rowBoundarySchema,
      doc: rowBoundarySchema.node('doc', null, [rowBoundaryTable(2)]),
    })
    expect(buildOfficeTableRowBoundaryTransaction(
      state,
      0,
      { axis: 'row', action: 'delete', index: 0 },
    )).toBeNull()
  })

  test('top insertion and header promotion preserve physical span shape, content, and alignment attrs', () => {
    const header = rowBoundarySchema.node('table_header_row', null, [
      rowBoundarySchema.node(
        'table_header',
        { alignment: 'center', colspan: 2, rowspan: 1 },
        rowBoundaryParagraph('H-span'),
      ),
      rowBoundarySchema.node('table_header', { alignment: 'right' }, rowBoundaryParagraph('H-right')),
    ])
    const promoted = rowBoundarySchema.node('table_row', null, [
      rowBoundarySchema.node(
        'table_cell',
        { alignment: 'center', colspan: 2, rowspan: 2 },
        rowBoundaryParagraph('A-span'),
      ),
      rowBoundarySchema.node('table_cell', { alignment: 'right' }, rowBoundaryParagraph('A-right')),
    ])
    const last = rowBoundarySchema.node('table_row', null, [
      rowBoundarySchema.node('table_cell', { alignment: 'right' }, rowBoundaryParagraph('B-right')),
    ])
    const table = rowBoundarySchema.node('table', null, [header, promoted, last])
    const state = EditorState.create({
      schema: rowBoundarySchema,
      doc: rowBoundarySchema.node('doc', null, [table]),
    })
    const inserted = buildOfficeTableRowBoundaryTransaction(
      state,
      0,
      { axis: 'row', action: 'insert', index: 0 },
    )!.doc.child(0)
    expect(TableMap.get(inserted)).toMatchObject({ height: 4, width: 3 })
    const insertedRows = rowBoundaryRowEvidence(inserted)
    expect(insertedRows[0].cells.map(({ attrs }) => attrs.alignment)).toEqual(['center', 'center', 'right'])
    expect(insertedRows[1].cells.map(({ text, attrs }) => ({
      text, alignment: attrs.alignment, colspan: attrs.colspan, rowspan: attrs.rowspan,
    }))).toEqual([
      { text: 'H-span', alignment: 'center', colspan: 2, rowspan: 1 },
      { text: 'H-right', alignment: 'right', colspan: 1, rowspan: 1 },
    ])

    const deleted = buildOfficeTableRowBoundaryTransaction(
      state,
      0,
      { axis: 'row', action: 'delete', index: 0 },
    )!.doc.child(0)
    expect(TableMap.get(deleted)).toMatchObject({ height: 2, width: 3 })
    const deletedRows = rowBoundaryRowEvidence(deleted)
    expect(deletedRows[0].cells.map(({ text, attrs }) => ({
      text, alignment: attrs.alignment, colspan: attrs.colspan, rowspan: attrs.rowspan,
    }))).toEqual([
      { text: 'A-span', alignment: 'center', colspan: 2, rowspan: 2 },
      { text: 'A-right', alignment: 'right', colspan: 1, rowspan: 1 },
    ])
    expect(deletedRows[1].cells.map(({ text }) => text)).toEqual(['B-right'])
  })
})

test('[slice 01.1] header deletion blanks a wider deeper outgoing span without shifting promoted logical cells', () => {
  const table = rowBoundarySchema.node('table', null, [
    rowBoundarySchema.node('table_header_row', null, [
      rowBoundarySchema.node(
        'table_header',
        { alignment: 'center', colspan: 2, rowspan: 3 },
        rowBoundaryParagraph('deleted-wide-deep-header'),
      ),
      rowBoundarySchema.node('table_header', { alignment: 'left' }, rowBoundaryParagraph('H2')),
      rowBoundarySchema.node('table_header', { alignment: 'right' }, rowBoundaryParagraph('H3')),
    ]),
    rowBoundarySchema.node('table_row', null, [
      rowBoundarySchema.node('table_cell', { alignment: 'left' }, rowBoundaryParagraph('A2')),
      rowBoundarySchema.node('table_cell', { alignment: 'right' }, rowBoundaryParagraph('A3')),
    ]),
    rowBoundarySchema.node('table_row', null, [
      rowBoundarySchema.node('table_cell', { alignment: 'center' }, rowBoundaryParagraph('B2')),
      rowBoundarySchema.node('table_cell', { alignment: 'right' }, rowBoundaryParagraph('B3')),
    ]),
    rowBoundarySchema.node('table_row', null, [
      rowBoundarySchema.node('table_cell', { alignment: 'left' }, rowBoundaryParagraph('C0')),
      rowBoundarySchema.node('table_cell', { alignment: 'center' }, rowBoundaryParagraph('C1')),
      rowBoundarySchema.node('table_cell', { alignment: 'right' }, rowBoundaryParagraph('C2')),
      rowBoundarySchema.node('table_cell', { alignment: 'left' }, rowBoundaryParagraph('C3')),
    ]),
  ])
  const initialMap = TableMap.get(table)
  expect(initialMap).toMatchObject({ height: 4, width: 4, problems: null })

  const state = EditorState.create({
    schema: rowBoundarySchema,
    doc: rowBoundarySchema.node('doc', null, [table]),
  })
  const transaction = buildOfficeTableRowBoundaryTransaction(
    state,
    0,
    { axis: 'row', action: 'delete', index: 0 },
  )
  expect(transaction).not.toBeNull()
  const promoted = transaction!.doc.child(0)
  expect(TableMap.get(promoted)).toMatchObject({ height: 3, width: 4, problems: null })
  expect(rowBoundaryLogicalText(promoted)).toEqual([
    ['', '', 'A2', 'A3'],
    ['', '', 'B2', 'B3'],
    ['C0', 'C1', 'C2', 'C3'],
  ])
  expect(rowBoundaryRowEvidence(promoted)).toEqual([
    {
      type: 'table_header_row',
      cells: [
        {
          type: 'table_header',
          text: '',
          attrs: { alignment: 'center', colspan: 2, rowspan: 2, colwidth: null },
        },
        {
          type: 'table_header',
          text: 'A2',
          attrs: { alignment: 'left', colspan: 1, rowspan: 1, colwidth: null },
        },
        {
          type: 'table_header',
          text: 'A3',
          attrs: { alignment: 'right', colspan: 1, rowspan: 1, colwidth: null },
        },
      ],
    },
    {
      type: 'table_row',
      cells: [
        {
          type: 'table_cell',
          text: 'B2',
          attrs: { alignment: 'center', colspan: 1, rowspan: 1, colwidth: null },
        },
        {
          type: 'table_cell',
          text: 'B3',
          attrs: { alignment: 'right', colspan: 1, rowspan: 1, colwidth: null },
        },
      ],
    },
    {
      type: 'table_row',
      cells: [
        {
          type: 'table_cell',
          text: 'C0',
          attrs: { alignment: 'left', colspan: 1, rowspan: 1, colwidth: null },
        },
        {
          type: 'table_cell',
          text: 'C1',
          attrs: { alignment: 'center', colspan: 1, rowspan: 1, colwidth: null },
        },
        {
          type: 'table_cell',
          text: 'C2',
          attrs: { alignment: 'right', colspan: 1, rowspan: 1, colwidth: null },
        },
        {
          type: 'table_cell',
          text: 'C3',
          attrs: { alignment: 'left', colspan: 1, rowspan: 1, colwidth: null },
        },
      ],
    },
  ])
})

test('[slice 01.1] rowspan header deletion is coherent with exact metadata through Forward Undo Redo', () => {
  const table = rowBoundarySchema.node('table', null, [
    rowBoundarySchema.node('table_header_row', null, [
      rowBoundarySchema.node(
        'table_header',
        { alignment: 'left', colspan: 1, rowspan: 2 },
        rowBoundaryParagraph('H-span'),
      ),
      rowBoundarySchema.node('table_header', { alignment: 'center' }, rowBoundaryParagraph('H1')),
      rowBoundarySchema.node('table_header', { alignment: 'right' }, rowBoundaryParagraph('H2')),
    ]),
    rowBoundarySchema.node('table_row', null, [
      rowBoundarySchema.node('table_cell', { alignment: 'center' }, rowBoundaryParagraph('A1')),
      rowBoundarySchema.node('table_cell', { alignment: 'right' }, rowBoundaryParagraph('A2')),
    ]),
    rowBoundarySchema.node('table_row', null, [
      rowBoundarySchema.node('table_cell', { alignment: 'left' }, rowBoundaryParagraph('B0')),
      rowBoundarySchema.node('table_cell', { alignment: 'center' }, rowBoundaryParagraph('B1')),
      rowBoundarySchema.node('table_cell', { alignment: 'right' }, rowBoundaryParagraph('B2')),
    ]),
  ])
  expect(TableMap.get(table)).toMatchObject({ height: 3, width: 3, problems: null })
  expect(rowBoundaryLogicalText(table)).toEqual([
    ['H-span', 'H1', 'H2'],
    ['H-span', 'A1', 'A2'],
    ['B0', 'B1', 'B2'],
  ])

  const initialIdentity = { tableIndex: 0, fingerprint: fingerprintProseTable(table) }
  const before: OfficeTableMetadataSnapshot = {
    tables: [{ ...initialIdentity, columns: [70, 90, 110], opaqueLayout: { keep: true } }],
    tableColors: [{
      ...initialIdentity,
      cells: {
        '0,0': '#101010',
        '1,1': '#112233',
        '1,2': '#223344',
        '2,0': '#334455',
      },
      opaqueColor: { keep: true },
    }],
  }
  const snapshot = structuredClone(before)
  const root = {} as HTMLElement
  let activeToken = 0
  const publicationFrames: Array<{
    fingerprint: string
    snapshot: OfficeTableMetadataSnapshot
  }> = []
  const unregister = registerOfficeTableMetadataBindings(root, {
    readTables: () => structuredClone(snapshot.tables),
    readTableColors: () => structuredClone(snapshot.tableColors),
    publishTables: (tables) => { snapshot.tables = structuredClone(tables) },
    publishTableColors: (colors) => { snapshot.tableColors = structuredClone(colors) },
    prepareDeferredSnapshot: (token) => {
      activeToken = token
      return true
    },
    cancelDeferredSnapshot: (token) => token === activeToken,
    isCurrentSnapshot: (token) => token === activeToken,
    publishSnapshot: (_next, _before, document, token) => {
      if (token !== activeToken) return false
      publicationFrames.push({
        fingerprint: fingerprintProseTable(document.child(0)),
        snapshot: structuredClone(snapshot),
      })
      return true
    },
  })
  const metadataPlugin = createOfficeTableMetadataProsePlugin((next, document, deferExternal, token) => {
    publishOfficeTableMetadataSnapshot(root, next, document, { deferExternal, token })
  })
  const initialDocument = rowBoundarySchema.node('doc', null, [table])
  const view = {
    state: EditorState.create({
      schema: rowBoundarySchema,
      doc: initialDocument,
      plugins: [history(), metadataPlugin],
    }),
    dispatch(transaction: Transaction) {
      this.state = this.state.applyTransaction(transaction).state
    },
  }
  const selectionKey = {} as never
  const commands = {
    get: () => () => (state: EditorState, dispatch?: (transaction: Transaction) => void) => {
      dispatch?.(state.tr.setMeta('rowspan-header-selection', true))
      return true
    },
  }
  const mutation = { axis: 'row', action: 'delete', index: 0 } as const
  const mutationCommand = createOfficeTableRowBoundaryCommand(0, mutation)!

  try {
    const result = runStockOfficeTableMutation({
      root,
      view: view as never,
      commands: commands as never,
      tablePos: 0,
      selectionIndex: 0,
      mutation,
      selectionCommandKey: selectionKey,
      mutationCommand,
    })
    expect(result).toMatchObject({ applied: true, reason: 'applied' })
    const forwardDocument = view.state.doc
    const forwardTable = forwardDocument.child(0)
    expect(TableMap.get(forwardTable)).toMatchObject({ height: 2, width: 3, problems: null })
    expect(rowBoundaryLogicalText(forwardTable)).toEqual([
      ['', 'A1', 'A2'],
      ['B0', 'B1', 'B2'],
    ])
    expect(rowBoundaryRowEvidence(forwardTable)[0]).toEqual({
      type: 'table_header_row',
      cells: [
        {
          type: 'table_header',
          text: '',
          attrs: { alignment: 'left', colspan: 1, rowspan: 1, colwidth: null },
        },
        {
          type: 'table_header',
          text: 'A1',
          attrs: { alignment: 'center', colspan: 1, rowspan: 1, colwidth: null },
        },
        {
          type: 'table_header',
          text: 'A2',
          attrs: { alignment: 'right', colspan: 1, rowspan: 1, colwidth: null },
        },
      ],
    })
    expect(snapshot.tables).toEqual([{
      tableIndex: 0,
      fingerprint: fingerprintProseTable(forwardTable),
      columns: [70, 90, 110],
      opaqueLayout: { keep: true },
    }])
    expect(snapshot.tableColors).toEqual([{
      tableIndex: 0,
      fingerprint: fingerprintProseTable(forwardTable),
      cells: {
        '0,1': '#112233',
        '0,2': '#223344',
        '1,0': '#334455',
      },
      opaqueColor: { keep: true },
    }])
    const forwardSnapshot = structuredClone(snapshot)
    expect(publicationFrames).toEqual([{
      fingerprint: fingerprintProseTable(forwardTable),
      snapshot: forwardSnapshot,
    }])

    expect(undo(view.state, (transaction) => view.dispatch(transaction))).toBe(true)
    expect(view.state.doc.eq(initialDocument)).toBe(true)
    expect(snapshot).toEqual(before)
    expect(publicationFrames).toHaveLength(2)
    expect(publicationFrames[1]).toEqual({
      fingerprint: initialIdentity.fingerprint,
      snapshot: before,
    })

    expect(redo(view.state, (transaction) => view.dispatch(transaction))).toBe(true)
    expect(view.state.doc.eq(forwardDocument)).toBe(true)
    expect(snapshot).toEqual(forwardSnapshot)
    expect(publicationFrames).toHaveLength(3)
    expect(publicationFrames[2]).toEqual({
      fingerprint: fingerprintProseTable(forwardTable),
      snapshot: forwardSnapshot,
    })
  } finally {
    unregister()
  }
})

test('[slice 01.1] insert Below a clicked rowspan uses rowEnd exact metadata through Forward Undo Redo', () => {
  const clicked = rowBoundarySchema.node(
    'table_header',
    { alignment: 'left', rowspan: 2 },
    rowBoundaryParagraph('clicked-rowspan'),
  )
  const table = rowBoundarySchema.node('table', null, [
    rowBoundarySchema.node('table_header_row', null, [
      clicked,
      rowBoundarySchema.node('table_header', { alignment: 'center' }, rowBoundaryParagraph('H1')),
      rowBoundarySchema.node('table_header', { alignment: 'right' }, rowBoundaryParagraph('H2')),
    ]),
    rowBoundarySchema.node('table_row', null, [
      rowBoundarySchema.node('table_cell', { alignment: 'right' }, rowBoundaryParagraph('A1')),
      rowBoundarySchema.node('table_cell', { alignment: 'left' }, rowBoundaryParagraph('A2')),
    ]),
    rowBoundarySchema.node('table_row', null, [
      rowBoundarySchema.node('table_cell', { alignment: 'right' }, rowBoundaryParagraph('B0')),
      rowBoundarySchema.node('table_cell', { alignment: 'left' }, rowBoundaryParagraph('B1')),
      rowBoundarySchema.node('table_cell', { alignment: 'center' }, rowBoundaryParagraph('B2')),
    ]),
    rowBoundarySchema.node('table_row', null, [
      rowBoundarySchema.node('table_cell', { alignment: 'center' }, rowBoundaryParagraph('C0')),
      rowBoundarySchema.node('table_cell', { alignment: 'right' }, rowBoundaryParagraph('C1')),
      rowBoundarySchema.node('table_cell', { alignment: 'left' }, rowBoundaryParagraph('C2')),
    ]),
  ])
  const logical = getLogicalTableCellContext(table, clicked)!
  const mutation = getOfficeTableMutationForAction({
    ...logical,
    rowCount: 4,
    colCount: 3,
    tablePos: 0,
  }, 'insert-row-below')
  expect(logical.rowEndIndex).toBe(2)
  expect(mutation).toEqual({ axis: 'row', action: 'insert', index: 2 })

  const initialIdentity = { tableIndex: 0, fingerprint: fingerprintProseTable(table) }
  const before: OfficeTableMetadataSnapshot = {
    tables: [{ ...initialIdentity, columns: [70, 90, 110], opaqueLayout: { keep: true } }],
    tableColors: [{
      ...initialIdentity,
      cells: {
        '0,0': '#101010',
        '1,1': '#112233',
        '2,0': '#223344',
        '3,2': '#334455',
      },
      rows: { '2': { color: '#445566', rank: 4 } },
      opaqueColor: { keep: true },
    }],
  }
  const harness = createRowBoundaryHistoryHarness(table, before)
  try {
    const result = runStockOfficeTableMutation({
      root: harness.root,
      view: harness.view as never,
      commands: harness.commands as never,
      tablePos: 0,
      selectionIndex: logical.rowIndex,
      mutation: mutation!,
      selectionCommandKey: harness.selectionKey,
      mutationCommand: createOfficeTableRowMutationCommand(0, mutation!)!,
    })
    expect(result).toMatchObject({
      applied: true,
      reason: 'applied',
      mutation: { axis: 'row', action: 'insert', index: 2 },
      next: { rows: 5, columns: 3 },
    })
    expect(harness.dispatchCount()).toBe(1)
    const forwardDocument = harness.view.state.doc
    const forwardTable = forwardDocument.child(0)
    expect(TableMap.get(forwardTable)).toMatchObject({ height: 5, width: 3, problems: null })
    expect(rowBoundaryLogicalText(forwardTable)).toEqual([
      ['clicked-rowspan', 'H1', 'H2'],
      ['clicked-rowspan', 'A1', 'A2'],
      ['', '', ''],
      ['B0', 'B1', 'B2'],
      ['C0', 'C1', 'C2'],
    ])
    expect(rowBoundaryRowEvidence(forwardTable)[0].cells[0]).toMatchObject({
      text: 'clicked-rowspan',
      attrs: { alignment: 'left', colspan: 1, rowspan: 2, colwidth: null },
    })
    expect(rowBoundaryRowEvidence(forwardTable)[2]).toEqual({
      type: 'table_row',
      cells: [
        {
          type: 'table_cell', text: '',
          attrs: { alignment: 'left', colspan: 1, rowspan: 1, colwidth: null },
        },
        {
          type: 'table_cell', text: '',
          attrs: { alignment: 'center', colspan: 1, rowspan: 1, colwidth: null },
        },
        {
          type: 'table_cell', text: '',
          attrs: { alignment: 'right', colspan: 1, rowspan: 1, colwidth: null },
        },
      ],
    })
    const forwardIdentity = { tableIndex: 0, fingerprint: fingerprintProseTable(forwardTable) }
    expect(harness.snapshot).toEqual({
      tables: [{ ...forwardIdentity, columns: [70, 90, 110], opaqueLayout: { keep: true } }],
      tableColors: [{
        ...forwardIdentity,
        cells: {
          '0,0': '#101010',
          '1,1': '#112233',
          '3,0': '#223344',
          '4,2': '#334455',
        },
        rows: { '3': { color: '#445566', rank: 4 } },
        opaqueColor: { keep: true },
      }],
    })
    expect(harness.snapshot.tableColors[0]).not.toMatchObject({ cells: { '2,0': expect.anything() } })
    const forwardSnapshot = structuredClone(harness.snapshot)
    expect(harness.publicationFrames).toEqual([{
      fingerprint: forwardIdentity.fingerprint,
      snapshot: forwardSnapshot,
    }])

    expect(undo(harness.view.state, (transaction) => harness.view.dispatch(transaction))).toBe(true)
    expect(harness.view.state.doc.eq(harness.initialDocument)).toBe(true)
    expect(harness.snapshot).toEqual(before)
    expect(harness.publicationFrames[1]).toEqual({
      fingerprint: initialIdentity.fingerprint,
      snapshot: before,
    })

    expect(redo(harness.view.state, (transaction) => harness.view.dispatch(transaction))).toBe(true)
    expect(harness.view.state.doc.eq(forwardDocument)).toBe(true)
    expect(harness.snapshot).toEqual(forwardSnapshot)
    expect(harness.publicationFrames[2]).toEqual({
      fingerprint: forwardIdentity.fingerprint,
      snapshot: forwardSnapshot,
    })
    expect(harness.publicationFrames).toHaveLength(3)
  } finally {
    harness.unregister()
  }
})

test('[slice 01.2] delete Below a one-row clicked cell removes one boundary across another rowspan', () => {
  const spanningHeader = rowBoundarySchema.node(
    'table_header',
    { alignment: 'center', colspan: 2, rowspan: 3 },
    rowBoundaryParagraph('other-rowspan'),
  )
  const clicked = rowBoundarySchema.node(
    'table_header',
    { alignment: 'right' },
    rowBoundaryParagraph('clicked-one-row'),
  )
  const table = rowBoundarySchema.node('table', null, [
    rowBoundarySchema.node('table_header_row', null, [spanningHeader, clicked]),
    rowBoundarySchema.node('table_row', null, [
      rowBoundarySchema.node('table_cell', { alignment: 'left' }, rowBoundaryParagraph('deleted-A2')),
    ]),
    rowBoundarySchema.node('table_row', null, [
      rowBoundarySchema.node('table_cell', { alignment: 'right' }, rowBoundaryParagraph('survivor-B2')),
    ]),
    rowBoundarySchema.node('table_row', null, [
      rowBoundarySchema.node('table_cell', { alignment: 'left' }, rowBoundaryParagraph('C0')),
      rowBoundarySchema.node('table_cell', { alignment: 'center' }, rowBoundaryParagraph('C1')),
      rowBoundarySchema.node('table_cell', { alignment: 'right' }, rowBoundaryParagraph('C2')),
    ]),
  ])
  const logical = getLogicalTableCellContext(table, clicked)!
  const mutation = getOfficeTableMutationForAction({
    ...logical, rowCount: 4, colCount: 3, tablePos: 0,
  }, 'delete-row-below')!
  expect(logical).toEqual({ rowIndex: 0, rowEndIndex: 1, colIndex: 2, colEndIndex: 3 })
  expect(mutation).toEqual({ axis: 'row', action: 'delete', index: 1 })

  const initialIdentity = { tableIndex: 0, fingerprint: fingerprintProseTable(table) }
  const before: OfficeTableMetadataSnapshot = {
    tables: [{ ...initialIdentity, columns: [70, 90, 110] }],
    tableColors: [{
      ...initialIdentity,
      cells: {
        '0,0': '#101010',
        '1,2': '#112233',
        '2,2': '#223344',
        '3,0': '#334455',
      },
    }],
  }
  const harness = createRowBoundaryHistoryHarness(table, before)
  try {
    const result = runStockOfficeTableMutation({
      root: harness.root,
      view: harness.view as never,
      commands: harness.commands as never,
      tablePos: 0,
      selectionIndex: logical.rowIndex,
      mutation,
      selectionCommandKey: harness.selectionKey,
      mutationCommand: createOfficeTableRowMutationCommand(0, mutation)!,
    })
    expect(result).toMatchObject({
      applied: true,
      mutation: { axis: 'row', action: 'delete', index: 1 },
      next: { rows: 3, columns: 3 },
    })
    const forwardDocument = harness.view.state.doc
    const forwardTable = forwardDocument.child(0)
    expect(rowBoundaryLogicalText(forwardTable)).toEqual([
      ['other-rowspan', 'other-rowspan', 'clicked-one-row'],
      ['other-rowspan', 'other-rowspan', 'survivor-B2'],
      ['C0', 'C1', 'C2'],
    ])
    expect(rowBoundaryRowEvidence(forwardTable)).toEqual([
      {
        type: 'table_header_row',
        cells: [
          {
            type: 'table_header', text: 'other-rowspan',
            attrs: { alignment: 'center', colspan: 2, rowspan: 2, colwidth: null },
          },
          {
            type: 'table_header', text: 'clicked-one-row',
            attrs: { alignment: 'right', colspan: 1, rowspan: 1, colwidth: null },
          },
        ],
      },
      {
        type: 'table_row',
        cells: [{
          type: 'table_cell', text: 'survivor-B2',
          attrs: { alignment: 'right', colspan: 1, rowspan: 1, colwidth: null },
        }],
      },
      {
        type: 'table_row',
        cells: [
          {
            type: 'table_cell', text: 'C0',
            attrs: { alignment: 'left', colspan: 1, rowspan: 1, colwidth: null },
          },
          {
            type: 'table_cell', text: 'C1',
            attrs: { alignment: 'center', colspan: 1, rowspan: 1, colwidth: null },
          },
          {
            type: 'table_cell', text: 'C2',
            attrs: { alignment: 'right', colspan: 1, rowspan: 1, colwidth: null },
          },
        ],
      },
    ])
    const forwardIdentity = { tableIndex: 0, fingerprint: fingerprintProseTable(forwardTable) }
    expect(harness.snapshot).toEqual({
      tables: [{ ...forwardIdentity, columns: [70, 90, 110] }],
      tableColors: [{
        ...forwardIdentity,
        cells: {
          '0,0': '#101010',
          '1,2': '#223344',
          '2,0': '#334455',
        },
      }],
    })
    const forwardSnapshot = structuredClone(harness.snapshot)
    expect(undo(harness.view.state, (transaction) => harness.view.dispatch(transaction))).toBe(true)
    expect(harness.view.state.doc.eq(harness.initialDocument)).toBe(true)
    expect(harness.snapshot).toEqual(before)
    expect(redo(harness.view.state, (transaction) => harness.view.dispatch(transaction))).toBe(true)
    expect(harness.view.state.doc.eq(forwardDocument)).toBe(true)
    expect(harness.snapshot).toEqual(forwardSnapshot)
  } finally {
    harness.unregister()
  }
})

test('[slice 01.1] deleting a data-row-origin rowspan preserves its content attrs span and color origin', () => {
  const continuing = rowBoundarySchema.node(
    'table_cell',
    { alignment: 'center', colspan: 2, rowspan: 2, colwidth: null },
    rowBoundaryParagraph('preserved-data-origin'),
  )
  const table = rowBoundarySchema.node('table', null, [
    rowBoundarySchema.node('table_header_row', null, [
      rowBoundarySchema.node('table_header', { alignment: 'left' }, rowBoundaryParagraph('H0')),
      rowBoundarySchema.node('table_header', { alignment: 'center' }, rowBoundaryParagraph('H1')),
      rowBoundarySchema.node('table_header', { alignment: 'right' }, rowBoundaryParagraph('H2')),
    ]),
    rowBoundarySchema.node('table_row', null, [
      continuing,
      rowBoundarySchema.node('table_cell', { alignment: 'right' }, rowBoundaryParagraph('deleted-peer')),
    ]),
    rowBoundarySchema.node('table_row', null, [
      rowBoundarySchema.node('table_cell', { alignment: 'left' }, rowBoundaryParagraph('shifted-peer')),
    ]),
    rowBoundarySchema.node('table_row', null, [
      rowBoundarySchema.node('table_cell', { alignment: 'left' }, rowBoundaryParagraph('last-0')),
      rowBoundarySchema.node('table_cell', { alignment: 'center' }, rowBoundaryParagraph('last-1')),
      rowBoundarySchema.node('table_cell', { alignment: 'right' }, rowBoundaryParagraph('last-2')),
    ]),
  ])
  const mutation = { axis: 'row', action: 'delete', index: 1 } as const
  const initialIdentity = { tableIndex: 0, fingerprint: fingerprintProseTable(table) }
  const before: OfficeTableMetadataSnapshot = {
    tables: [{ ...initialIdentity, columns: [80, 120, 100] }],
    tableColors: [{
      ...initialIdentity,
      cells: {
        '1,0': '#101010',
        '1,1': '#202020',
        '1,2': '#303030',
        '2,2': '#404040',
        '3,0': '#505050',
      },
    }],
  }
  const harness = createRowBoundaryHistoryHarness(table, before)
  try {
    const result = runStockOfficeTableMutation({
      root: harness.root,
      view: harness.view as never,
      commands: harness.commands as never,
      tablePos: 0,
      selectionIndex: 1,
      mutation,
      selectionCommandKey: harness.selectionKey,
      mutationCommand: createOfficeTableRowMutationCommand(0, mutation)!,
    })
    expect(result).toMatchObject({ applied: true, reason: 'applied' })
    const forwardTable = harness.view.state.doc.child(0)
    expect(rowBoundaryLogicalText(forwardTable)).toEqual([
      ['H0', 'H1', 'H2'],
      ['preserved-data-origin', 'preserved-data-origin', 'shifted-peer'],
      ['last-0', 'last-1', 'last-2'],
    ])
    expect(rowBoundaryRowEvidence(forwardTable)[1]).toEqual({
      type: 'table_row',
      cells: [
        {
          type: 'table_cell', text: 'preserved-data-origin',
          attrs: { alignment: 'center', colspan: 2, rowspan: 1, colwidth: null },
        },
        {
          type: 'table_cell', text: 'shifted-peer',
          attrs: { alignment: 'left', colspan: 1, rowspan: 1, colwidth: null },
        },
      ],
    })
    const forwardIdentity = { tableIndex: 0, fingerprint: fingerprintProseTable(forwardTable) }
    expect(harness.snapshot.tableColors).toEqual([{
      ...forwardIdentity,
      cells: {
        '1,2': '#404040',
        '2,0': '#505050',
      },
    }])
  } finally {
    harness.unregister()
  }
})

function registeredRowCommands(
  selectionKey: never,
  mutationKey: never,
  mutationCommand: (state: EditorState, dispatch?: (transaction: Transaction) => void) => boolean,
  counters: { selections: number; mutations: number },
) {
  return {
    get: (key: never) => key === selectionKey
      ? (payload: { index: number }) => (
        state: EditorState,
        dispatch?: (transaction: Transaction) => void,
      ) => {
        counters.selections += 1
        const table = state.doc.child(0)
        const map = TableMap.get(table)
        const first = map.positionAt(payload.index, 0, table)
        const last = map.positionAt(payload.index, map.width - 1, table)
        dispatch?.(state.tr.setSelection(CellSelection.rowSelection(
          state.doc.resolve(1 + last),
          state.doc.resolve(1 + first),
        )))
        return true
      }
      : () => (state: EditorState, dispatch?: (transaction: Transaction) => void) => {
        if (key !== mutationKey) return false
        counters.mutations += 1
        return mutationCommand(state, dispatch)
      },
  }
}

test('[slice 01.1] certified production path prefers an exact registered stock proposal', () => {
  const cell = (type: 'table_header' | 'table_cell', text: string) => rowBoundarySchema.node(
    type,
    { alignment: 'left' },
    rowBoundaryParagraph(text),
  )
  const table = rowBoundarySchema.node('table', null, [
    rowBoundarySchema.node('table_header_row', null, [0, 1, 2].map((column) => (
      cell('table_header', `H${column}`)
    ))),
    rowBoundarySchema.node('table_row', null, [0, 1, 2].map((column) => (
      cell('table_cell', `A${column}`)
    ))),
    rowBoundarySchema.node('table_row', null, [0, 1, 2].map((column) => (
      cell('table_cell', `B${column}`)
    ))),
  ])
  const mutation = { axis: 'row', action: 'insert', index: 2 } as const
  expect(requiresOfficeTableExactBoundaryFallback(table, mutation)).toBe(false)
  const harness = createRowBoundaryHistoryHarness(table, { tables: [], tableColors: [] })
  const selectionKey = {} as never
  const mutationKey = {} as never
  const counters = { selections: 0, mutations: 0 }
  const commands = registeredRowCommands(selectionKey, mutationKey, addRowAfter, counters)
  try {
    const result = runCertifiedStockOfficeTableMutation({
      root: harness.root,
      view: harness.view as never,
      commands: commands as never,
      tablePos: 0,
      selectionIndex: 1,
      mutation,
      selectionCommandKey: selectionKey,
      mutationCommandKey: mutationKey,
    })
    expect(result).toMatchObject({ applied: true, reason: 'applied' })
    expect(counters).toEqual({ selections: 1, mutations: 1 })
    expect(harness.dispatchCount()).toBe(1)
    expect(rowBoundaryLogicalText(harness.view.state.doc.child(0))).toEqual([
      ['H0', 'H1', 'H2'],
      ['A0', 'A1', 'A2'],
      ['', '', ''],
      ['B0', 'B1', 'B2'],
    ])
  } finally {
    harness.unregister()
  }
})

test('[slice 01.1] certified production path falls back once for a span-expanded stock deletion', () => {
  const table = rowBoundarySchema.node('table', null, [
    rowBoundarySchema.node('table_header_row', null, [
      rowBoundarySchema.node('table_header', { alignment: 'left' }, rowBoundaryParagraph('H0')),
      rowBoundarySchema.node('table_header', { alignment: 'center' }, rowBoundaryParagraph('H1')),
      rowBoundarySchema.node('table_header', { alignment: 'right' }, rowBoundaryParagraph('H2')),
    ]),
    rowBoundarySchema.node('table_row', null, [
      rowBoundarySchema.node(
        'table_cell',
        { alignment: 'center', colspan: 2, rowspan: 2 },
        rowBoundaryParagraph('preserved-span'),
      ),
      rowBoundarySchema.node('table_cell', { alignment: 'right' }, rowBoundaryParagraph('deleted-peer')),
    ]),
    rowBoundarySchema.node('table_row', null, [
      rowBoundarySchema.node('table_cell', { alignment: 'left' }, rowBoundaryParagraph('shifted-peer')),
    ]),
    rowBoundarySchema.node('table_row', null, [
      rowBoundarySchema.node('table_cell', { alignment: 'left' }, rowBoundaryParagraph('last-0')),
      rowBoundarySchema.node('table_cell', { alignment: 'center' }, rowBoundaryParagraph('last-1')),
      rowBoundarySchema.node('table_cell', { alignment: 'right' }, rowBoundaryParagraph('last-2')),
    ]),
  ])
  const mutation = { axis: 'row', action: 'delete', index: 1 } as const
  expect(requiresOfficeTableExactBoundaryFallback(table, mutation)).toBe(true)
  const harness = createRowBoundaryHistoryHarness(table, { tables: [], tableColors: [] })
  const selectionKey = {} as never
  const mutationKey = {} as never
  const counters = { selections: 0, mutations: 0 }
  const commands = registeredRowCommands(selectionKey, mutationKey, deleteRow, counters)
  try {
    const result = runCertifiedStockOfficeTableMutation({
      root: harness.root,
      view: harness.view as never,
      commands: commands as never,
      tablePos: 0,
      selectionIndex: 1,
      mutation,
      selectionCommandKey: selectionKey,
      mutationCommandKey: mutationKey,
    })
    expect(result).toMatchObject({ applied: true, reason: 'applied' })
    expect(counters).toEqual({ selections: 1, mutations: 1 })
    expect(harness.dispatchCount()).toBe(1)
    expect(rowBoundaryLogicalText(harness.view.state.doc.child(0))).toEqual([
      ['H0', 'H1', 'H2'],
      ['preserved-span', 'preserved-span', 'shifted-peer'],
      ['last-0', 'last-1', 'last-2'],
    ])
  } finally {
    harness.unregister()
  }
})

test('[slice 01.1] certified production path rejects an ordinary wrong index without fallback effects', () => {
  const table = rowBoundaryTable(4)
  const declared = { axis: 'row', action: 'insert', index: 2 } as const
  expect(requiresOfficeTableExactBoundaryFallback(table, declared)).toBe(false)
  const harness = createRowBoundaryHistoryHarness(table, { tables: [], tableColors: [] })
  const selectionKey = {} as never
  const mutationKey = {} as never
  const counters = { selections: 0, mutations: 0 }
  const wrongCommand = createOfficeTableRowMutationCommand(0, { ...declared, index: 1 })!
  const commands = registeredRowCommands(selectionKey, mutationKey, wrongCommand, counters)
  try {
    const result = runCertifiedStockOfficeTableMutation({
      root: harness.root,
      view: harness.view as never,
      commands: commands as never,
      tablePos: 0,
      selectionIndex: 1,
      mutation: declared,
      selectionCommandKey: selectionKey,
      mutationCommandKey: mutationKey,
    })
    expect(result).toMatchObject({ applied: false, reason: 'preflight-failed' })
    expect(counters).toEqual({ selections: 1, mutations: 1 })
    expect(harness.dispatchCount()).toBe(0)
    expect(harness.view.state.doc.eq(harness.initialDocument)).toBe(true)
    expect(harness.snapshot).toEqual({ tables: [], tableColors: [] })
  } finally {
    harness.unregister()
  }
})

test('[slice 01.1] structural preflight distinguishes the declared row index from a coherent same-dimension proposal', () => {
  const table = rowBoundaryTable(4)
  const state = EditorState.create({
    schema: rowBoundarySchema,
    doc: rowBoundarySchema.node('doc', null, [table]),
  })
  const declared = { axis: 'row', action: 'insert', index: 2 } as const
  const correct = captureOfficeCommand(
    state,
    createOfficeTableRowMutationCommand(0, declared)!,
  ).transactions[0]?.doc.child(0)
  const wrongIndex = captureOfficeCommand(
    state,
    createOfficeTableRowMutationCommand(0, { ...declared, index: 1 })!,
  ).transactions[0]?.doc.child(0)
  expect(correct).toBeTruthy()
  expect(wrongIndex).toBeTruthy()
  expect(TableMap.get(correct!)).toMatchObject({ width: 3, height: 5, problems: null })
  expect(TableMap.get(wrongIndex!)).toMatchObject({ width: 3, height: 5, problems: null })
  expect(verifyOfficeTableRowMutationStructure(table, correct!, declared)).toBe(true)
  expect(verifyOfficeTableRowMutationStructure(table, wrongIndex!, declared)).toBe(false)
  expect(rowBoundaryLogicalText(correct!)).toEqual([
    ['H0', 'H1', 'H2'],
    ['A0', 'A1', 'A2'],
    ['', '', ''],
    ['B0', 'B1', 'B2'],
    ['C0', 'C1', 'C2'],
  ])
  expect(rowBoundaryLogicalText(wrongIndex!)).toEqual([
    ['H0', 'H1', 'H2'],
    ['', '', ''],
    ['A0', 'A1', 'A2'],
    ['B0', 'B1', 'B2'],
    ['C0', 'C1', 'C2'],
  ])
})

test('[slice 01.1] structural preflight distinguishes the declared column index from a coherent same-dimension proposal', () => {
  const table = coordinatorTable(4, 4)
  const state = EditorState.create({
    schema: coordinatorSchema,
    doc: coordinatorSchema.node('doc', null, [table]),
  })
  const declared = { axis: 'column', action: 'insert', index: 2, anchorIndex: 2 } as const
  const correct = captureOfficeCommand(
    state,
    createOfficeTableMutationCommand(0, declared)!,
  ).transactions[0]?.doc.child(0)
  const wrongIndex = captureOfficeCommand(
    state,
    createOfficeTableMutationCommand(0, { ...declared, index: 1, anchorIndex: 1 })!,
  ).transactions[0]?.doc.child(0)
  expect(correct).toBeTruthy()
  expect(wrongIndex).toBeTruthy()
  expect(TableMap.get(correct!)).toMatchObject({ width: 5, height: 4, problems: null })
  expect(TableMap.get(wrongIndex!)).toMatchObject({ width: 5, height: 4, problems: null })
  expect(verifyOfficeTableColumnMutationStructure(table, correct!, declared)).toBe(true)
  expect(verifyOfficeTableColumnMutationStructure(table, wrongIndex!, declared)).toBe(false)
  expect(verifyOfficeTableMutationStructure(table, correct!, declared)).toBe(true)
  expect(physicalTableText(correct!)[0]).toEqual(['target-0-0', 'target-0-1', '', 'target-0-2', 'target-0-3'])
  expect(physicalTableText(wrongIndex!)[0]).toEqual(['target-0-0', '', 'target-0-1', 'target-0-2', 'target-0-3'])
})

const wrapperNodes = tableNodes({ tableGroup: 'block', cellContent: 'paragraph+' })
const wrapperSchema = new Schema({
  nodes: {
    doc: { content: 'block+', marks: '_' },
    paragraph: { group: 'block', content: 'text*' },
    text: {},
    table: {
      ...wrapperNodes.table,
      attrs: { ledger: { default: 'table-default' } },
      marks: '_',
    },
    table_row: {
      ...wrapperNodes.table_row,
      attrs: { ledger: { default: 'row-default' } },
      marks: '_',
    },
    table_header: wrapperNodes.table_header,
    table_cell: wrapperNodes.table_cell,
  },
  marks: { audit: {} },
})

test('[slice 01.1] structural oracle preserves table and survivor row wrapper attrs and marks', () => {
  const paragraph = (text: string) => wrapperSchema.node('paragraph', null, wrapperSchema.text(text))
  const audit = wrapperSchema.mark('audit')
  const rows = Array.from({ length: 3 }, (_, row) => wrapperSchema.node(
    'table_row',
    { ledger: `row-${row}` },
    Array.from({ length: 3 }, (_, column) => wrapperSchema.node(
      row === 0 ? 'table_header' : 'table_cell',
      null,
      paragraph(`${row}-${column}`),
    )),
    [audit],
  ))
  const table = wrapperSchema.node('table', { ledger: 'table-kept' }, rows, [audit])
  const mutation = { axis: 'row', action: 'insert', index: 1 } as const
  const state = EditorState.create({
    schema: wrapperSchema,
    doc: wrapperSchema.node('doc', null, [table]),
  })
  const correctDocument = captureOfficeCommand(
    state,
    createOfficeTableRowMutationCommand(0, mutation)!,
  ).transactions[0]!.doc
  const correct = correctDocument.child(0)
  expect(verifyOfficeTableRowMutationStructure(table, correct, mutation)).toBe(true)

  const correctState = EditorState.create({ schema: wrapperSchema, doc: correctDocument })
  const wrongTableAttrs = correctState.tr.setNodeMarkup(
    0,
    undefined,
    { ledger: 'table-tampered' },
    correct.marks,
  ).doc.child(0)
  const wrongTableMarks = correctState.tr.setNodeMarkup(
    0,
    undefined,
    correct.attrs,
    [],
  ).doc.child(0)
  const firstRow = correct.child(0)
  const wrongRowAttrs = correctState.tr.setNodeMarkup(
    1,
    undefined,
    { ledger: 'row-tampered' },
    firstRow.marks,
  ).doc.child(0)
  const wrongRowMarks = correctState.tr.setNodeMarkup(
    1,
    undefined,
    firstRow.attrs,
    [],
  ).doc.child(0)
  for (const wrong of [wrongTableAttrs, wrongTableMarks, wrongRowAttrs, wrongRowMarks]) {
    expect(verifyOfficeTableRowMutationStructure(table, wrong, mutation)).toBe(false)
  }
})

function coordinatorTable(rows: number, columns: number, prefix = 'target'): ProseNode {
  const paragraph = (text: string) => coordinatorSchema.node(
    'paragraph', null, text ? coordinatorSchema.text(text) : undefined,
  )
  return coordinatorSchema.node('table', null, Array.from({ length: rows }, (_, row) => (
    coordinatorSchema.node('table_row', null, Array.from({ length: columns }, (_, column) => (
      coordinatorSchema.node(row === 0 ? 'table_header' : 'table_cell', null, paragraph(`${prefix}-${row}-${column}`))
    )))
  )))
}

type CoordinatorFault =
  | 'selection-false' | 'selection-zero' | 'selection-multiple'
  | 'command-false' | 'command-zero' | 'command-multiple'
  | 'wrong-delta' | 'wrong-index' | 'wrong-table' | 'wrong-envelope'
  | 'metadata-unavailable' | 'post-dispatch-mismatch'
  | 'external-false'

function runCoordinatorCase(
  fault?: CoordinatorFault,
  mutation: OfficeTableStructureMutation = { axis: 'row', action: 'insert', index: 1 },
) {
  const beforeSnapshot: OfficeTableMetadataSnapshot = {
    tables: [{ tableIndex: 0, fingerprint: 'unused', columns: [70, 90, 110, 130] }],
    tableColors: [{
      tableIndex: 0,
      fingerprint: 'unused',
      cells: { '1,1': '#112233' },
      columns: { '1': { color: '#445566', rank: 1 } },
    }],
  }
  const snapshot = structuredClone(beforeSnapshot)
  let rendererPublications = 0
  let externalPublications = 0
  let dirtySignals = 0
  let timerSchedules = 0
  let preparedDocuments = 0
  let preparedToken: number | null = null
  let settledToken: number | null = null
  let activeToken: number | null = null
  let tableStorePublications = 0
  let colorStorePublications = 0
  let dispatches = 0
  const root = {} as HTMLElement
  const plugin = createOfficeTableMetadataProsePlugin((next, document, deferExternal, token) => {
    rendererPublications += 1
    publishOfficeTableMetadataSnapshot(root, next, document, { deferExternal, token })
  })
  const beforeDimensions = { rows: 5, columns: 4 }
  const initialDoc = coordinatorSchema.node('doc', null, fault === 'wrong-table'
    ? [coordinatorTable(5, 4), coordinatorTable(5, 4, 'other')]
    : fault === 'wrong-envelope'
      ? [
        coordinatorTable(5, 4),
        coordinatorSchema.node('paragraph', null, coordinatorSchema.text('outside-target')),
      ]
      : [coordinatorTable(5, 4)])
  const initialState = EditorState.create({ schema: coordinatorSchema, doc: initialDoc, plugins: [history(), plugin] })
  const view = {
    state: initialState,
    dispatch(transaction: Parameters<EditorState['applyTransaction']>[0]) {
      dispatches += 1
      this.state = this.state.applyTransaction(transaction).state
      if (fault === 'post-dispatch-mismatch') this.state = initialState
    },
  }

  const unregister = fault === 'metadata-unavailable' ? () => {} : registerOfficeTableMetadataBindings(root, {
    readTables: () => structuredClone(snapshot.tables),
    readTableColors: () => structuredClone(snapshot.tableColors),
    publishTables: (tables) => {
      tableStorePublications += 1
      snapshot.tables = structuredClone(tables)
    },
    publishTableColors: (colors) => {
      colorStorePublications += 1
      snapshot.tableColors = structuredClone(colors)
    },
    prepareDeferredSnapshot: (token) => {
      preparedDocuments += 1
      preparedToken = token
      activeToken = token
      return true
    },
    cancelDeferredSnapshot: (token) => {
      if (activeToken !== token) return false
      settledToken = token
      return true
    },
    isCurrentSnapshot: (token) => activeToken === token,
    publishSnapshot: (_next, _before, _document, token) => {
      if (activeToken !== token) return false
      if (fault === 'external-false') return false
      settledToken = token
      externalPublications += 1
      dirtySignals += 1
      timerSchedules += 1
      return true
    },
  })

  const selectionKey = {} as never
  const mutationKey = {} as never
  const selectionCommand = () => (state: EditorState, dispatch?: (transaction: Transaction) => void) => {
    if (fault === 'selection-false') return false
    if (fault === 'selection-zero') return true
    dispatch?.(state.tr.setMeta('selection-capture', 1))
    if (fault === 'selection-multiple') dispatch?.(state.tr.setMeta('selection-capture', 2))
    return true
  }
  const mutationCommand = () => (state: EditorState, dispatch?: (transaction: Transaction) => void) => {
    if (fault === 'command-false') return false
    if (fault === 'command-zero') return true
    if (fault !== 'wrong-delta' && fault !== 'wrong-table') {
      const exactMutation: OfficeTableStructureMutation = fault === 'wrong-index'
        ? { ...mutation, index: mutation.index === 1 ? 2 : 1 }
        : mutation
      const exactCommand = createOfficeTableMutationCommand(0, exactMutation)
      if (!exactCommand) return false
      if (fault === 'wrong-envelope') {
        let captured: Transaction | undefined
        const accepted = exactCommand(state, (transaction) => { captured = transaction })
        if (!accepted || !captured) return false
        const paragraphTextPosition = captured.doc.child(0).nodeSize + 1
        captured.insertText('tampered-', paragraphTextPosition)
        dispatch?.(captured)
        return true
      }
      const accepted = exactCommand(state, dispatch)
      if (fault === 'command-multiple') dispatch?.(state.tr.setMeta('mutation-capture', 2))
      return accepted
    }
    let transaction = state.tr
    if (fault === 'wrong-table') {
      const firstSize = state.doc.child(0).nodeSize
      transaction = transaction.replaceWith(firstSize, firstSize + state.doc.child(1).nodeSize, coordinatorTable(6, 4, 'other'))
    } else {
      const expected = planOfficeTableMutation(beforeDimensions, mutation)!.expected
      const rows = fault === 'wrong-delta' && mutation.axis === 'row' ? expected.rows + 1 : expected.rows
      const columns = fault === 'wrong-delta' && mutation.axis === 'column'
        ? expected.columns + 1
        : expected.columns
      transaction = transaction.replaceWith(0, state.doc.child(0).nodeSize, coordinatorTable(rows, columns))
    }
    dispatch?.(transaction)
    if (fault === 'command-multiple') dispatch?.(state.tr.setMeta('mutation-capture', 2))
    return true
  }
  const commands = {
    get: (key: never) => (key === selectionKey ? selectionCommand : mutationCommand),
  }

  try {
    let result
    let error: unknown
    try {
      result = runStockOfficeTableMutation({
      root,
      view: view as never,
      commands: commands as never,
      tablePos: 0,
      selectionIndex: 1,
      mutation,
      selectionCommandKey: selectionKey,
      mutationCommandKey: mutationKey,
      })
    } catch (caught) {
      error = caught
    }
    return {
      result,
      error,
      dispatches,
      rendererPublications,
      externalPublications,
      dirtySignals,
      timerSchedules,
      preparedDocuments,
      preparedToken,
      settledToken,
      tableStorePublications,
      colorStorePublications,
      beforeSnapshot,
      snapshot,
      doc: view.state.doc.toJSON(),
      initialDoc: initialState.doc.toJSON(),
    }
  } finally {
    unregister()
  }
}

test.describe('[slice 01.1] coordinator rejects capture and preflight failures without side effects', () => {
  const preDispatchCases: Array<[CoordinatorFault, string]> = [
    ['selection-false', 'selection-failed'],
    ['selection-zero', 'selection-failed'],
    ['selection-multiple', 'selection-failed'],
    ['command-false', 'command-rejected'],
    ['command-zero', 'transaction-count'],
    ['command-multiple', 'transaction-count'],
    ['wrong-delta', 'preflight-failed'],
    ['wrong-index', 'preflight-failed'],
    ['wrong-table', 'preflight-failed'],
    ['wrong-envelope', 'preflight-failed'],
    ['metadata-unavailable', 'metadata-unavailable'],
  ]

  for (const [fault, reason] of preDispatchCases) {
    test(`${fault} preserves document and metadata bytes with zero dispatch/callback/save proxies`, () => {
      const evidence = runCoordinatorCase(fault)
      expect(evidence.result).toMatchObject({ applied: false, reason })
      expect(evidence.dispatches).toBe(0)
      expect(evidence.rendererPublications).toBe(0)
      expect(evidence.externalPublications).toBe(0)
      expect(evidence.dirtySignals).toBe(0)
      expect(evidence.timerSchedules).toBe(0)
      expect(evidence.tableStorePublications).toBe(0)
      expect(evidence.colorStorePublications).toBe(0)
      expect(JSON.stringify(evidence.doc)).toBe(JSON.stringify(evidence.initialDoc))
      expect(JSON.stringify(evidence.snapshot)).toBe(JSON.stringify(evidence.beforeSnapshot))
    })
  }

  test('wrong same-dimension column index is rejected with zero document metadata or publication effects', () => {
    const evidence = runCoordinatorCase(
      'wrong-index',
      { axis: 'column', action: 'insert', index: 1, anchorIndex: 1 },
    )
    expect(evidence.result).toMatchObject({ applied: false, reason: 'preflight-failed' })
    expect(evidence.dispatches).toBe(0)
    expect(evidence.rendererPublications).toBe(0)
    expect(evidence.externalPublications).toBe(0)
    expect(evidence.dirtySignals).toBe(0)
    expect(evidence.timerSchedules).toBe(0)
    expect(evidence.tableStorePublications).toBe(0)
    expect(evidence.colorStorePublications).toBe(0)
    expect(evidence.doc).toEqual(evidence.initialDoc)
    expect(evidence.snapshot).toEqual(evidence.beforeSnapshot)
  })

  test('accepted composite dispatches once and publishes one renderer snapshot with both controller stores ready', () => {
    const evidence = runCoordinatorCase()
    expect(evidence.result).toMatchObject({ applied: true, reason: 'applied' })
    expect(evidence.dispatches).toBe(1)
    expect(evidence.rendererPublications).toBe(1)
    expect(evidence.preparedDocuments).toBe(1)
    expect(evidence.preparedToken).toBe(evidence.settledToken)
    expect(evidence.externalPublications).toBe(1)
    expect(evidence.dirtySignals).toBe(1)
    expect(evidence.timerSchedules).toBe(1)
    expect(evidence.tableStorePublications).toBe(1)
    expect(evidence.colorStorePublications).toBe(1)
    expect(evidence.result.metadataAfter).toEqual(evidence.snapshot)
  })

  test('post-dispatch defensive mismatch publishes renderer state but no external callback, dirty, or timer', () => {
    const evidence = runCoordinatorCase('post-dispatch-mismatch')
    expect(evidence.result).toBeUndefined()
    expect(evidence.error).toBeInstanceOf(OfficeTableMutationInvariantError)
    expect((evidence.error as OfficeTableMutationInvariantError).result).toMatchObject({
      applied: false,
      reason: 'live-verification-failed',
    })
    expect(evidence.dispatches).toBe(1)
    expect(evidence.rendererPublications).toBe(1)
    expect(evidence.preparedDocuments).toBe(1)
    expect(evidence.preparedToken).toBe(evidence.settledToken)
    expect(evidence.tableStorePublications).toBe(2)
    expect(evidence.colorStorePublications).toBe(2)
    expect(evidence.snapshot).toEqual(evidence.beforeSnapshot)
    expect(evidence.externalPublications).toBe(0)
    expect(evidence.dirtySignals).toBe(0)
    expect(evidence.timerSchedules).toBe(0)
  })

  test('deferred Forward false settlement is BLOCKED and never reports applied', () => {
    const evidence = runCoordinatorCase('external-false')
    expect(evidence.result).toBeUndefined()
    expect(evidence.error).toBeInstanceOf(OfficeTableMutationInvariantError)
    expect((evidence.error as OfficeTableMutationInvariantError).result).toMatchObject({
      applied: false,
      reason: 'live-verification-failed',
    })
    expect(evidence.dispatches).toBe(1)
    expect(evidence.rendererPublications).toBe(1)
    expect(evidence.tableStorePublications).toBe(2)
    expect(evidence.colorStorePublications).toBe(2)
    expect(evidence.snapshot).toEqual(evidence.beforeSnapshot)
    expect(evidence.externalPublications).toBe(0)
    expect(evidence.dirtySignals).toBe(0)
    expect(evidence.timerSchedules).toBe(0)
    expect(evidence.preparedToken).toBe(evidence.settledToken)
  })

  const coordinatorMatrix: OfficeTableStructureMutation[] = [
    { axis: 'row', action: 'insert', index: 0 },
    { axis: 'row', action: 'insert', index: 2 },
    { axis: 'row', action: 'insert', index: 5 },
    { axis: 'row', action: 'delete', index: 0 },
    { axis: 'row', action: 'delete', index: 2 },
    { axis: 'row', action: 'delete', index: 4 },
    { axis: 'column', action: 'insert', index: 0, anchorIndex: 0 },
    { axis: 'column', action: 'insert', index: 2, anchorIndex: 2 },
    { axis: 'column', action: 'insert', index: 4, anchorIndex: 3 },
    { axis: 'column', action: 'delete', index: 0 },
    { axis: 'column', action: 'delete', index: 2 },
    { axis: 'column', action: 'delete', index: 3 },
  ]
  for (const mutation of coordinatorMatrix) {
    test(`coordinator applies ${mutation.axis} ${mutation.action} at ${mutation.index} exactly once`, () => {
      const evidence = runCoordinatorCase(undefined, mutation)
      expect(evidence.error).toBeUndefined()
      expect(evidence.result).toMatchObject({ applied: true, reason: 'applied' })
      expect(evidence.dispatches).toBe(1)
      expect(evidence.rendererPublications).toBe(1)
      expect(evidence.externalPublications).toBe(1)
      expect(evidence.tableStorePublications).toBe(1)
      expect(evidence.colorStorePublications).toBe(1)
    })
  }
})

test('[slice 01.3] rejected column command creates no document metadata dirty or save side effect', () => {
  const evidence = runCoordinatorCase(
    'command-false',
    { axis: 'column', action: 'insert', index: 2, anchorIndex: 1 },
  )
  expect(evidence.result).toMatchObject({ applied: false, reason: 'command-rejected' })
  expect(evidence.error).toBeUndefined()
  expect(evidence.dispatches).toBe(0)
  expect(evidence.rendererPublications).toBe(0)
  expect(evidence.externalPublications).toBe(0)
  expect(evidence.dirtySignals).toBe(0)
  expect(evidence.timerSchedules).toBe(0)
  expect(evidence.tableStorePublications).toBe(0)
  expect(evidence.colorStorePublications).toBe(0)
  expect(evidence.doc).toEqual(evidence.initialDoc)
  expect(evidence.snapshot).toEqual(evidence.beforeSnapshot)
})

test('[slice 01.1] live appended-document mismatch cancels real listener autosave without stale suppression', async () => {
  const root = {} as HTMLElement
  const publication = createOfficeDeferredMarkdownPublicationState()
  const initialSnapshot: OfficeTableMetadataSnapshot = {
    tables: [{ tableIndex: 0, fingerprint: 'initial', columns: [70, 90, 110, 130] }],
    tableColors: [],
  }
  const snapshot = structuredClone(initialSnapshot)
  let rendererTablePublications = 0
  let rendererColorPublications = 0
  let externalPublications = 0
  let dirtySignals = 0
  let timerSchedules = 0
  let saves = 0
  let timer: ReturnType<typeof setTimeout> | null = null
  let scheduledCallback: (() => void) | null = null
  const markDirtyAndScheduleSave = createOfficeDirtySaveScheduler({
    filePath: 'appended-mismatch.md',
    setIsDirty: (dirty) => { if (dirty) dirtySignals += 1 },
    setDirty: () => {},
    getSessionStart: () => null,
    setSessionStart: () => {},
    getTimer: () => timer,
    setTimer: (next) => { timer = next },
    checkpointDue: () => false,
    save: () => { saves += 1 },
    schedule: (callback) => {
      timerSchedules += 1
      scheduledCallback = callback
      return { testTimer: timerSchedules } as unknown as ReturnType<typeof setTimeout>
    },
    cancel: () => {},
  })
  const metadataPlugin = createOfficeTableMetadataProsePlugin((next, document, deferExternal, token) => {
    publishOfficeTableMetadataSnapshot(root, next, document, { deferExternal, token })
  })
  const appendedMismatchPlugin = new Plugin({
    appendTransaction: (transactions, _oldState, newState) => {
      const hasMetadataStep = transactions.some((transaction) => transaction.steps.some(
        (step) => step instanceof OfficeTableMetadataStep,
      ))
      if (!hasMetadataStep || transactions.some((transaction) => transaction.getMeta('appended-live-mismatch'))) {
        return null
      }
      return newState.tr
        .replaceWith(0, newState.doc.child(0).nodeSize, coordinatorTable(7, 4, 'appended-live'))
        .setMeta('appended-live-mismatch', true)
        .setMeta('addToHistory', false)
    },
  })
  const initialState = EditorState.create({
    schema: coordinatorSchema,
    doc: coordinatorSchema.node('doc', null, [coordinatorTable(5, 4)]),
    plugins: [history(), metadataPlugin, appendedMismatchPlugin],
  })
  let synchronousMarkdownSuppressed = false
  let asynchronousMarkdownSuppressed = false
  const publishMarkdown = (document: ProseNode) => {
    if (publication.suppressMarkdown(document)) return true
    markDirtyAndScheduleSave()
    return false
  }
  const pendingAsyncPublications: Promise<void>[] = []
  const view = {
    state: initialState,
    dispatch(transaction: Transaction) {
      this.state = this.state.applyTransaction(transaction).state
      const actualLiveDocument = this.state.doc
      synchronousMarkdownSuppressed = publishMarkdown(actualLiveDocument)
      pendingAsyncPublications.push(Promise.resolve().then(() => {
        asynchronousMarkdownSuppressed = publishMarkdown(actualLiveDocument)
      }))
    },
  }
  const unregister = registerOfficeTableMetadataBindings(root, {
    readTables: () => structuredClone(snapshot.tables),
    readTableColors: () => structuredClone(snapshot.tableColors),
    publishTables: (tables) => {
      rendererTablePublications += 1
      snapshot.tables = structuredClone(tables)
    },
    publishTableColors: (colors) => {
      rendererColorPublications += 1
      snapshot.tableColors = structuredClone(colors)
    },
    prepareDeferredSnapshot: (token) => publication.prepare(token),
    cancelDeferredSnapshot: (token, document) => publication.cancel(token, document),
    isCurrentSnapshot: (token) => publication.isCurrent(token),
    publishSnapshot: (_next, _before, document, token) => {
      if (!publication.finalize(token, document)) return false
      externalPublications += 1
      markDirtyAndScheduleSave()
      return true
    },
  })
  const selectionKey = {} as never
  const mutationKey = {} as never
  const mutation: OfficeTableStructureMutation = { axis: 'row', action: 'insert', index: 1 }
  const commands = {
    get: (key: never) => key === selectionKey
      ? () => (state: EditorState, dispatch?: (transaction: Transaction) => void) => {
        dispatch?.(state.tr.setMeta('selection-capture', true))
        return true
      }
      : () => createOfficeTableRowMutationCommand(0, mutation)!,
  }
  try {
    let error: unknown
    try {
      runStockOfficeTableMutation({
        root,
        view: view as never,
        commands: commands as never,
        tablePos: 0,
        selectionIndex: 1,
        mutation,
        selectionCommandKey: selectionKey,
        mutationCommandKey: mutationKey,
      })
    } catch (caught) {
      error = caught
    }
    await Promise.all(pendingAsyncPublications)
    expect(error).toBeInstanceOf(OfficeTableMutationInvariantError)
    expect((error as Error).message).toContain('BLOCKED')
    expect((error as OfficeTableMutationInvariantError).result.reason).toBe('live-verification-failed')
    expect(rendererTablePublications).toBe(2)
    expect(rendererColorPublications).toBe(2)
    expect(snapshot).toEqual(initialSnapshot)
    expect(externalPublications).toBe(0)
    expect(synchronousMarkdownSuppressed).toBe(true)
    expect(asynchronousMarkdownSuppressed).toBe(true)
    expect(dirtySignals).toBe(0)
    expect(timerSchedules).toBe(0)
    expect(saves).toBe(0)

    let firstTextPos = -1
    view.state.doc.descendants((node, pos) => {
      if (firstTextPos < 0 && node.isText) firstTextPos = pos + node.nodeSize
    })
    expect(firstTextPos).toBeGreaterThan(0)
    view.state = view.state.apply(view.state.tr.insertText('-unrelated', firstTextPos))
    expect(publishMarkdown(view.state.doc)).toBe(false)
    expect(dirtySignals).toBe(1)
    expect(timerSchedules).toBe(1)
    expect(saves).toBe(0)
    expect(scheduledCallback).not.toBeNull()
    ;(scheduledCallback as () => void)()
    expect(saves).toBe(1)
  } finally {
    unregister()
  }
})

test('[slice 01.1] deferred publication tokens reject nested stale and duplicate settlement', () => {
  const publication = createOfficeDeferredMarkdownPublicationState()
  const document = (text: string) => schema.node('doc', null, [
    schema.node('paragraph', null, schema.text(text)),
  ])
  const first = document('first')
  const second = document('second')
  const unrelated = document('unrelated')

  expect(publication.prepare(10)).toBe(true)
  expect(publication.suppressMarkdown(second)).toBe(true)
  expect(publication.prepare(11)).toBe(true)
  expect(publication.finalize(10, first)).toBe(false)
  expect(publication.cancel(10, first)).toBe(false)
  expect(publication.finalize(11, second)).toBe(true)
  expect(publication.finalize(11, second)).toBe(false)
  expect(publication.cancel(11, second)).toBe(false)
  expect(publication.suppressMarkdown(second)).toBe(true)
  expect(publication.suppressMarkdown(unrelated)).toBe(false)
  expect(publication.prepare(11)).toBe(false)
  expect(publication.finalize(11, second)).toBe(false)
  expect(publication.cancel(11, second)).toBe(false)

  expect(publication.prepare(12)).toBe(true)
  expect(publication.cancel(12, first)).toBe(true)
  expect(publication.suppressMarkdown(first)).toBe(true)
  expect(publication.prepare(13)).toBe(true)
  expect(publication.cancel(12, first)).toBe(false)
  expect(publication.finalize(13, second)).toBe(true)
  expect(publication.suppressMarkdown(second)).toBe(true)
  expect(publication.suppressMarkdown(unrelated)).toBe(false)
})

test('[slice 01.1] deferred internal renderer failure cancels its matching operation token', () => {
  const root = {} as HTMLElement
  const publication = createOfficeDeferredMarkdownPublicationState()
  const currentDocument = schema.node('doc', null, [schema.node('paragraph', null, schema.text('current'))])
  const unrelatedDocument = schema.node('doc', null, [schema.node('paragraph', null, schema.text('next'))])
  let preparedToken: number | null = null
  let cancelledToken: number | null = null
  let colorPublications = 0
  const unregister = registerOfficeTableMetadataBindings(root, {
    readTables: () => [],
    readTableColors: () => [],
    publishTables: () => { throw new Error('renderer tables') },
    publishTableColors: () => { colorPublications += 1 },
    prepareDeferredSnapshot: (token) => {
      preparedToken = token
      return publication.prepare(token)
    },
    cancelDeferredSnapshot: (token, document) => {
      cancelledToken = token
      return publication.cancel(token, document)
    },
    isCurrentSnapshot: (token) => publication.isCurrent(token),
  })
  try {
    let error: unknown
    try {
      publishOfficeTableMetadataSnapshot(
        root,
        { tables: [], tableColors: [] },
        currentDocument,
        { deferExternal: true, token: 1_000_000 },
      )
    } catch (caught) {
      error = caught
    }
    expect(error).toBeInstanceOf(OfficeTableMetadataPublicationError)
    expect(((error as Error & { cause?: Error }).cause)?.message).toBe('renderer tables')
    expect(preparedToken).toBe(1_000_000)
    expect(cancelledToken).toBe(preparedToken)
    expect(colorPublications).toBe(0)
    expect(publication.suppressMarkdown(currentDocument)).toBe(true)
    expect(publication.suppressMarkdown(unrelatedDocument)).toBe(false)
  } finally {
    unregister()
  }
})

test('[slice 01.1] stale and duplicate attached Forward tokens abort before renderer publication', () => {
  const root = {} as HTMLElement
  const publication = createOfficeDeferredMarkdownPublicationState()
  const snapshot: OfficeTableMetadataSnapshot = { tables: [], tableColors: [] }
  let tables: unknown = []
  let colors: unknown = []
  let rendererTables = 0
  let rendererColors = 0
  let external = 0
  let dirty = 0
  let timers = 0
  let cancels = 0
  const unregister = registerOfficeTableMetadataBindings(root, {
    readTables: () => tables,
    readTableColors: () => colors,
    publishTables: (next) => {
      rendererTables += 1
      tables = structuredClone(next)
    },
    publishTableColors: (next) => {
      rendererColors += 1
      colors = structuredClone(next)
    },
    prepareDeferredSnapshot: (token) => publication.prepare(token),
    cancelDeferredSnapshot: (token, document) => {
      cancels += 1
      return publication.cancel(token, document)
    },
    isCurrentSnapshot: (token) => publication.isCurrent(token),
    publishSnapshot: (_next, _before, document, token) => {
      if (!publication.finalize(token, document)) return false
      external += 1
      dirty += 1
      timers += 1
      return true
    },
  })
  const stateRef = {
    current: EditorState.create({
      schema,
      doc: schema.node('doc', null, [schema.node('paragraph', null, schema.text('A'))]),
      plugins: [history(), createOfficeTableMetadataProsePlugin(
        (next, document, deferExternal, token) => publishOfficeTableMetadataSnapshot(
          root,
          next,
          document,
          { deferExternal, token },
        ),
      )],
    }),
  }
  const oldForward = stateRef.current.tr
  oldForward.step(new OfficeTableMetadataStep(snapshot, snapshot))
  const oldToken = deferOfficeTableMetadataExternalPublication(oldForward)
  const newerForward = stateRef.current.tr
  newerForward.step(new OfficeTableMetadataStep(snapshot, snapshot))
  const newerToken = deferOfficeTableMetadataExternalPublication(newerForward)
  expect(oldToken).toBeLessThan(newerToken)
  try {
    expect(() => dispatchState(stateRef, newerForward)).not.toThrow()
    publishOfficeTableMetadataExternalSnapshot(root, snapshot, stateRef.current.doc, newerToken)
    expect(rendererTables).toBe(1)
    expect(rendererColors).toBe(1)
    expect(external).toBe(1)
    expect(dirty).toBe(1)
    expect(timers).toBe(1)
    expect(cancels).toBe(0)

    for (const rejected of [newerForward, oldForward]) {
      let error: unknown
      try {
        dispatchState(stateRef, rejected)
      } catch (caught) {
        error = caught
      }
      expect(error).toBeInstanceOf(OfficeTableMetadataPublicationError)
      expect((error as Error).message).toContain('BLOCKED')
      expect(rendererTables).toBe(1)
      expect(rendererColors).toBe(1)
      expect(external).toBe(1)
      expect(dirty).toBe(1)
      expect(timers).toBe(1)
      expect(cancels).toBe(0)
    }
    expect(publication.suppressMarkdown(stateRef.current.doc)).toBe(true)
    stateRef.current = stateRef.current.apply(stateRef.current.tr.insertText('X', 2))
    expect(publication.suppressMarkdown(stateRef.current.doc)).toBe(false)
  } finally {
    unregister()
  }
})

for (const failure of ['tables', 'colors', 'colors-rollback'] as const) {
  test(`[slice 01.1] ${failure} internal failure restores both metadata domains before BLOCKED`, () => {
    const root = {} as HTMLElement
    const publication = createOfficeDeferredMarkdownPublicationState()
    const before: OfficeTableMetadataSnapshot = {
      tables: [{ exact: 'before-tables' }], tableColors: [{ exact: 'before-colors' }],
    }
    const after: OfficeTableMetadataSnapshot = {
      tables: [{ exact: 'after-tables' }], tableColors: [{ exact: 'after-colors' }],
    }
    let tables: unknown = structuredClone(before.tables)
    let colors: unknown = structuredClone(before.tableColors)
    let external = 0
    let reports = 0
    const originalError = console.error
    console.error = () => { reports += 1 }
    const unregister = registerOfficeTableMetadataBindings(root, {
      readTables: () => tables,
      readTableColors: () => colors,
      publishTables: (next) => {
        tables = structuredClone(next)
        if (failure === 'tables' && (next as Array<{ exact: string }>)[0]?.exact === 'after-tables') {
          throw new Error('tables-after-mutation')
        }
      },
      publishTableColors: (next) => {
        colors = structuredClone(next)
        const exact = (next as Array<{ exact: string }>)[0]?.exact
        if (failure !== 'tables' && exact === 'after-colors') throw new Error('colors-after-mutation')
        if (failure === 'colors-rollback' && exact === 'before-colors') throw new Error('colors-rollback')
      },
      prepareDeferredSnapshot: (token) => publication.prepare(token),
      cancelDeferredSnapshot: (token, document) => publication.cancel(token, document),
      isCurrentSnapshot: (token) => publication.isCurrent(token),
      publishSnapshot: (_next, _before, document, token) => {
        external += 1
        return publication.finalize(token, document)
      },
    })
    try {
      expect(() => publishOfficeTableMetadataSnapshot(root, after)).toThrow(OfficeTableMetadataPublicationError)
      expect(tables).toEqual(before.tables)
      expect(colors).toEqual(before.tableColors)
      expect(external).toBe(0)
      expect(reports).toBe(failure === 'colors-rollback' ? 1 : 0)
    } finally {
      unregister()
      console.error = originalError
    }
  })
}

test('[slice 01.1] prepare throw after state mutation cancels without writing or swallowing next text', () => {
  const root = {} as HTMLElement
  const publication = createOfficeDeferredMarkdownPublicationState()
  const current = schema.node('doc', null, [schema.node('paragraph', null, schema.text('current'))])
  const next = schema.node('doc', null, [schema.node('paragraph', null, schema.text('next'))])
  let writes = 0
  let cancels = 0
  const unregister = registerOfficeTableMetadataBindings(root, {
    readTables: () => [],
    readTableColors: () => [],
    publishTables: () => { writes += 1 },
    publishTableColors: () => { writes += 1 },
    prepareDeferredSnapshot: (token) => {
      publication.prepare(token)
      throw new Error('prepare-after-mutation')
    },
    cancelDeferredSnapshot: (token, document) => {
      cancels += 1
      return publication.cancel(token, document)
    },
    isCurrentSnapshot: (token) => publication.isCurrent(token),
    publishSnapshot: () => true,
  })
  try {
    expect(() => publishOfficeTableMetadataSnapshot(root, { tables: [], tableColors: [] }, current))
      .toThrow(OfficeTableMetadataPublicationError)
    expect(writes).toBe(0)
    expect(cancels).toBe(1)
    expect(publication.suppressMarkdown(current)).toBe(true)
    expect(publication.suppressMarkdown(next)).toBe(false)
  } finally {
    unregister()
  }
})

test('[slice 01.1] nested newer metadata operation prevents stale outer domain and external writes', () => {
  const root = {} as HTMLElement
  const publication = createOfficeDeferredMarkdownPublicationState()
  const before: OfficeTableMetadataSnapshot = {
    tables: [{ exact: 'before-tables' }], tableColors: [{ exact: 'before-colors' }],
  }
  const outer: OfficeTableMetadataSnapshot = {
    tables: [{ exact: 'outer-tables' }], tableColors: [{ exact: 'outer-colors' }],
  }
  const newer: OfficeTableMetadataSnapshot = {
    tables: [{ exact: 'newer-tables' }], tableColors: [{ exact: 'newer-colors' }],
  }
  const tokenState = EditorState.create({ schema, doc: schema.node('doc', null, [schema.node('paragraph')]) })
  const outerToken = deferOfficeTableMetadataExternalPublication(tokenState.tr)
  const newerToken = deferOfficeTableMetadataExternalPublication(tokenState.tr)
  let tables: unknown = structuredClone(before.tables)
  let colors: unknown = structuredClone(before.tableColors)
  let nested = false
  let external = 0
  let dirty = 0
  const unregister = registerOfficeTableMetadataBindings(root, {
    readTables: () => tables,
    readTableColors: () => colors,
    publishTables: (next) => {
      tables = structuredClone(next)
      if (!nested && (next as Array<{ exact: string }>)[0]?.exact === 'outer-tables') {
        nested = true
        publishOfficeTableMetadataSnapshot(root, newer, undefined, { token: newerToken })
      }
    },
    publishTableColors: (next) => { colors = structuredClone(next) },
    prepareDeferredSnapshot: (token) => publication.prepare(token),
    cancelDeferredSnapshot: (token, document) => publication.cancel(token, document),
    isCurrentSnapshot: (token) => publication.isCurrent(token),
    publishSnapshot: (_next, _before, document, token) => {
      if (!publication.finalize(token, document)) return false
      external += 1
      dirty += 1
      return true
    },
  })
  try {
    expect(() => publishOfficeTableMetadataSnapshot(
      root, outer, undefined, { deferExternal: true, token: outerToken },
    )).toThrow(OfficeTableMetadataPublicationError)
    expect(tables).toEqual(newer.tables)
    expect(colors).toEqual(newer.tableColors)
    expect(external).toBe(1)
    expect(dirty).toBe(1)
    expect(publication.isCurrent(newerToken)).toBe(true)
  } finally {
    unregister()
  }
})

test.describe('[slice 01.1] nested newer deferred rollback ownership survives stale outer abort', () => {
  for (const outcome of ['false', 'throw', 'cancel', 'success'] as const) {
    test(`${outcome} settles only the newer pending operation`, () => {
      const root = {} as HTMLElement
      const publication = createOfficeDeferredMarkdownPublicationState()
      const before: OfficeTableMetadataSnapshot = {
        tables: [{ exact: 'before-tables' }],
        tableColors: [{ exact: 'before-colors' }],
      }
      const outer: OfficeTableMetadataSnapshot = {
        tables: [{ exact: 'outer-tables' }],
        tableColors: [{ exact: 'outer-colors' }],
      }
      const newer: OfficeTableMetadataSnapshot = {
        tables: [{ exact: 'newer-tables' }],
        tableColors: [{ exact: 'newer-colors' }],
      }
      const tokenState = EditorState.create({
        schema,
        doc: schema.node('doc', null, [schema.node('paragraph')]),
      })
      const outerToken = deferOfficeTableMetadataExternalPublication(tokenState.tr)
      const newerToken = deferOfficeTableMetadataExternalPublication(tokenState.tr)
      let tables: unknown = structuredClone(before.tables)
      let colors: unknown = structuredClone(before.tableColors)
      let preNewer: OfficeTableMetadataSnapshot | null = null
      let nested = false
      const externalTokens: number[] = []
      let externalSuccesses = 0
      let dirty = 0
      let saves = 0
      const unregister = registerOfficeTableMetadataBindings(root, {
        readTables: () => tables,
        readTableColors: () => colors,
        publishTables: (next) => {
          tables = structuredClone(next)
          if (!nested && (next as Array<{ exact: string }>)[0]?.exact === 'outer-tables') {
            nested = true
            preNewer = {
              tables: structuredClone(tables),
              tableColors: structuredClone(colors),
            }
            publishOfficeTableMetadataSnapshot(root, newer, undefined, {
              deferExternal: true,
              token: newerToken,
            })
          }
        },
        publishTableColors: (next) => { colors = structuredClone(next) },
        prepareDeferredSnapshot: (token) => publication.prepare(token),
        cancelDeferredSnapshot: (token, document) => publication.cancel(token, document),
        isCurrentSnapshot: (token) => publication.isCurrent(token),
        publishSnapshot: (_next, _before, document, token) => {
          externalTokens.push(token)
          if (outcome === 'false') return false
          if (outcome === 'throw') throw new Error('newer external settlement failed')
          if (!publication.finalize(token, document)) return false
          externalSuccesses += 1
          dirty += 1
          saves += 1
          return true
        },
      })
      try {
        expect(() => publishOfficeTableMetadataSnapshot(root, outer, undefined, {
          deferExternal: true,
          token: outerToken,
        })).toThrow(OfficeTableMetadataPublicationError)
        expect(tables).toEqual(newer.tables)
        expect(colors).toEqual(newer.tableColors)
        expect(publication.isCurrent(newerToken)).toBe(true)

        if (outcome === 'cancel') {
          expect(cancelOfficeTableMetadataExternalSnapshot(root, newerToken)).toBe(true)
        } else if (outcome === 'throw') {
          expect(() => publishOfficeTableMetadataExternalSnapshot(root, newer, undefined, newerToken))
            .toThrow(OfficeTableMetadataPublicationError)
        } else {
          expect(publishOfficeTableMetadataExternalSnapshot(root, newer, undefined, newerToken))
            .toBe(outcome === 'success')
        }

        expect(externalTokens).not.toContain(outerToken)
        expect(externalTokens).toHaveLength(outcome === 'cancel' ? 0 : 1)
        expect(externalSuccesses).toBe(outcome === 'success' ? 1 : 0)
        expect(dirty).toBe(outcome === 'success' ? 1 : 0)
        expect(saves).toBe(outcome === 'success' ? 1 : 0)
        if (outcome === 'success') {
          expect(tables).toEqual(newer.tables)
          expect(colors).toEqual(newer.tableColors)
        } else {
          expect({ tables, tableColors: colors }).toEqual(preNewer)
        }
        expect(publication.isCurrent(outerToken)).toBe(false)
        expect(publication.isCurrent(newerToken)).toBe(true)
        expect(publication.cancel(outerToken)).toBe(false)
        expect(publication.cancel(newerToken)).toBe(false)
      } finally {
        unregister()
      }
    })
  }
})

test.describe('[slice 01.1] immutable color, width, identity, and pruning transforms', () => {
  const target = { tableIndex: 0, fingerprint: 'before' }
  const nextIdentity = { tableIndex: 0, fingerprint: 'after' }

  test('row insert shifts exact coordinates, prunes malformed ranges, and isolates other tables', () => {
    const before: OfficeTableMetadataSnapshot = {
      tables: [
        { tableIndex: 0, fingerprint: 'before', columns: [90, 110], style: { future: 'keep' } },
        { tableIndex: 1, fingerprint: 'other', columns: [70] },
      ],
      tableColors: [
        {
          tableIndex: 0,
          fingerprint: 'before',
          cells: { '0,0': '#111111', '1,1': '#222222', '9,9': '#999999', malformed: '#aaaaaa' },
          rows: { '1': { color: '#333333', rank: 2 }, '8': { color: '#888888', rank: 8 } },
          columns: { '1': { color: '#444444', rank: 3 }, '7': { color: '#777777', rank: 7 } },
        },
        { tableIndex: 1, fingerprint: 'other', cells: { '0,0': '#abcdef' } },
      ],
    }
    const frozen = structuredClone(before)
    const after = transformOfficeTableMetadata(
      before,
      target,
      nextIdentity,
      { axis: 'row', action: 'insert', index: 1 },
      { rows: 4, columns: 2 },
    )

    expect(before).toEqual(frozen)
    expect(after.tables[0]).toEqual({
      tableIndex: 0,
      fingerprint: 'after',
      columns: [90, 110],
      style: { future: 'keep' },
    })
    expect(after.tables[1]).toEqual(before.tables[1])
    expect(after.tableColors[0]).toEqual({
      tableIndex: 0,
      fingerprint: 'after',
      cells: { '0,0': '#111111', '2,1': '#222222' },
      rows: { '2': { color: '#333333', rank: 2 } },
      columns: { '1': { color: '#444444', rank: 3 } },
    })
    expect(after.tableColors[1]).toEqual(before.tableColors[1])
  })

  test('malformed target colors are dormant in before, pruned only in after, and exactly invertible', () => {
    const malformedTarget = {
      tableIndex: 0,
      fingerprint: 'before',
      cells: {
        '0,0': '#AABBCC',
        '1,1': 'red',
        '1,0': 42,
        '9,9': '#112233',
        malformed: '#334455',
      },
      rows: {
        '0': { color: '#123456', rank: 3 },
        '1': { color: '#zzzzzz', rank: 4 },
        '2': { color: '#654321', rank: '5' },
        '3': 'bad-shape',
        '9': { color: '#abcdef', rank: 9 },
      },
      columns: {
        '0': { color: '#fedcba', rank: 2 },
        '-1': { color: '#111111', rank: 1 },
        bogus: { color: '#222222', rank: 2 },
        '1': null,
        '8': { color: '#333333', rank: 8 },
      },
      future: { untouched: true },
    }
    const sibling = {
      tableIndex: 1,
      fingerprint: 'sibling',
      cells: { broken: 7 },
      rows: 'preserve-this-malformed-shape',
      future: ['exact'],
    } as unknown as OfficeTableMetadataSnapshot['tableColors'][number]
    const before: OfficeTableMetadataSnapshot = {
      tables: [{ tableIndex: 0, fingerprint: 'before', columns: [80, 90] }],
      tableColors: [malformedTarget, sibling],
    }
    const frozen = structuredClone(before)
    const after = transformOfficeTableMetadata(
      before,
      target,
      nextIdentity,
      { axis: 'row', action: 'insert', index: 1 },
      { rows: 4, columns: 2 },
    )
    expect(before).toEqual(frozen)
    expect(after.tableColors[0]).toEqual({
      tableIndex: 0,
      fingerprint: 'after',
      cells: { '0,0': '#aabbcc' },
      rows: { '0': { color: '#123456', rank: 3 } },
      columns: { '0': { color: '#fedcba', rank: 2 } },
      future: { untouched: true },
    })
    expect(after.tableColors[1]).toEqual(sibling)

    const forward = new OfficeTableMetadataStep(before, after)
    const undoStep = forward.invert(coordinatorTable(4, 2)) as OfficeTableMetadataStep
    const redoStep = undoStep.invert(coordinatorTable(3, 2)) as OfficeTableMetadataStep
    expect(undoStep.after).toEqual(frozen)
    expect(redoStep.after).toEqual(after)
  })

  const columnCases: Array<{
    label: string
    mutation: OfficeTableStructureMutation
    widths: number[]
    cells: Record<string, string> | undefined
    columns: Record<string, { color: string; rank: number }> | undefined
  }> = [
    { label: 'insert left of first', mutation: { axis: 'column', action: 'insert', index: 0, anchorIndex: 0 }, widths: [70, 70, 90, 110, 130], cells: { '2,3': '#ffcccc' }, columns: { '4': { color: '#e6ccff', rank: 5 } } },
    { label: 'insert left of middle', mutation: { axis: 'column', action: 'insert', index: 2, anchorIndex: 2 }, widths: [70, 90, 110, 110, 130], cells: { '2,3': '#ffcccc' }, columns: { '4': { color: '#e6ccff', rank: 5 } } },
    { label: 'insert right of middle', mutation: { axis: 'column', action: 'insert', index: 2, anchorIndex: 1 }, widths: [70, 90, 90, 110, 130], cells: { '2,3': '#ffcccc' }, columns: { '4': { color: '#e6ccff', rank: 5 } } },
    { label: 'insert right of last', mutation: { axis: 'column', action: 'insert', index: 4, anchorIndex: 3 }, widths: [70, 90, 110, 130, 130], cells: { '2,2': '#ffcccc' }, columns: { '3': { color: '#e6ccff', rank: 5 } } },
    { label: 'delete first', mutation: { axis: 'column', action: 'delete', index: 0 }, widths: [90, 110, 130], cells: { '2,1': '#ffcccc' }, columns: { '2': { color: '#e6ccff', rank: 5 } } },
    { label: 'delete middle color cell', mutation: { axis: 'column', action: 'delete', index: 2 }, widths: [70, 90, 130], cells: undefined, columns: { '2': { color: '#e6ccff', rank: 5 } } },
    { label: 'delete last color column', mutation: { axis: 'column', action: 'delete', index: 3 }, widths: [70, 90, 110], cells: { '2,2': '#ffcccc' }, columns: undefined },
  ]

  for (const columnCase of columnCases) {
    test(`${columnCase.label} copies the selected anchor or removes the exact width/color coordinate`, () => {
      const before: OfficeTableMetadataSnapshot = {
        tables: [{ tableIndex: 0, fingerprint: 'before', columns: [70, 90, 110, 130] }],
        tableColors: [{
          tableIndex: 0,
          fingerprint: 'before',
          cells: { '2,2': '#ffcccc' },
          columns: { '3': { color: '#e6ccff', rank: 5 } },
        }],
      }
      const columns = columnCase.mutation.action === 'insert' ? 5 : 3
      const after = transformOfficeTableMetadata(
        before,
        target,
        nextIdentity,
        columnCase.mutation,
        { rows: 5, columns },
      )
      expect(after.tables[0].columns).toEqual(columnCase.widths)
      expect(after.tables[0].fingerprint).toBe('after')
      expect(after.tableColors[0]?.cells).toEqual(columnCase.cells)
      expect(after.tableColors[0]?.columns).toEqual(columnCase.columns)
    })
  }

  const rawWidthCases: Array<{
    label: string
    mutation: OfficeTableStructureMutation
    expected: number[]
  }> = [
    { label: 'insert first', mutation: { axis: 'column', action: 'insert', index: 0, anchorIndex: 0 }, expected: [70, 70, 90, 110, 130] },
    { label: 'insert middle', mutation: { axis: 'column', action: 'insert', index: 2, anchorIndex: 1 }, expected: [70, 90, 90, 110, 130] },
    { label: 'insert last', mutation: { axis: 'column', action: 'insert', index: 4, anchorIndex: 3 }, expected: [70, 90, 110, 130, 130] },
    { label: 'delete first', mutation: { axis: 'column', action: 'delete', index: 0 }, expected: [90, 110, 130] },
    { label: 'delete middle', mutation: { axis: 'column', action: 'delete', index: 2 }, expected: [70, 90, 130] },
    { label: 'delete last', mutation: { axis: 'column', action: 'delete', index: 3 }, expected: [70, 90, 110] },
  ]

  for (const widthCase of rawWidthCases) {
    test(`raw partial/null/hole/non-number widths survive Step.before and clean ${widthCase.label} after`, () => {
      const rawColumns: unknown[] = [70, null, undefined, 'malformed']
      delete rawColumns[2]
      const before: OfficeTableMetadataSnapshot = {
        tables: [
          { tableIndex: 0, fingerprint: 'before', columns: rawColumns },
          { tableIndex: 1, fingerprint: 'sibling', columns: [33, null] },
        ],
        tableColors: [],
      }
      const frozen = structuredClone(before)
      const measured = [70, 90, 110, 130]
      const liveTables = [
        { tableIndex: 0, fingerprint: 'before' },
        { tableIndex: 1, fingerprint: 'sibling' },
      ]
      const after = transformOfficeTableMetadata(
        before,
        target,
        nextIdentity,
        widthCase.mutation,
        { rows: 5, columns: widthCase.mutation.action === 'insert' ? 5 : 3 },
        liveTables,
        measured,
      )
      const step = new OfficeTableMetadataStep(before, after)
      expect(before).toEqual(frozen)
      expect(step.before).toEqual(frozen)
      expect(2 in (step.before.tables[0].columns as unknown[])).toBe(false)
      expect(step.before.tables[0].columns).toEqual(rawColumns)
      expect(after.tables[0].columns).toEqual(widthCase.expected)
      expect(after.tables[1]).toEqual(before.tables[1])
      expect((after.tables[0].columns as unknown[]).every(
        (value) => typeof value === 'number' && Number.isFinite(value),
      )).toBe(true)
    })
  }

  for (const mutation of [
    { axis: 'row', action: 'insert', index: 1 },
    { axis: 'row', action: 'delete', index: 1 },
  ] as const) {
    test(`raw layout bytes and slots survive row ${mutation.action} while identity refreshes`, () => {
      const rawColumns: unknown[] = [70, null, undefined, 'malformed']
      delete rawColumns[2]
      const before: OfficeTableMetadataSnapshot = {
        tables: [{
          tableIndex: 0,
          fingerprint: 'before',
          columns: rawColumns,
          rows: [33, null, 'dormant'],
          style: { future: ['exact'] },
          opaque: { preserve: true },
        }],
        tableColors: [],
      }
      const frozen = structuredClone(before)
      const after = transformOfficeTableMetadata(
        before,
        target,
        nextIdentity,
        mutation,
        { rows: mutation.action === 'insert' ? 6 : 4, columns: 4 },
        [{ tableIndex: 0, fingerprint: 'before' }],
        [71, 91, 111, 131],
      )
      expect(before).toEqual(frozen)
      expect(after.tables[0]).toEqual({ ...frozen.tables[0], fingerprint: 'after' })
      expect(2 in (after.tables[0].columns as unknown[])).toBe(false)
      expect(after.tables[0].columns).toEqual(rawColumns)
      expect(new OfficeTableMetadataStep(before, after).invert(coordinatorTable(5, 4)).toJSON())
        .toEqual(new OfficeTableMetadataStep(after, before).toJSON())
    })
  }

  test('finite completion fallback never emits undefined when measured widths are unavailable', () => {
    expect(completeOfficeTableColumnWidths([72], 4)).toEqual([72, 72, 72, 72])
    expect(completeOfficeTableColumnWidths([], 3)).toEqual([96, 96, 96])
    expect(completeOfficeTableColumnWidths([80], 3, [80, 100, 120])).toEqual([80, 100, 120])
    expect(completeOfficeTableColumnWidths([70, null, 'bad', 130], 4, [71, 91, 111, 131]))
      .toEqual([70, 91, 111, 130])
  })

  test('finite sub-min widths clamp to the ratified minimum before exact-index insertion', () => {
    expect(completeOfficeTableColumnWidths([10, 120], 2, [40, 120], 40))
      .toEqual([40, 120])
    expect(completeOfficeTableColumnWidths([70, null, 'bad', 130], 4, [71, 91, 111, 131], 40))
      .toEqual([70, 91, 111, 130])

    const before: OfficeTableMetadataSnapshot = {
      tables: [{
        tableIndex: 0,
        fingerprint: 'before',
        columns: [10, 120],
        opaque: { exact: ['preserve', 7] },
      }],
      tableColors: [{ tableIndex: 0, fingerprint: 'before', future: 'preserve' }],
    }
    const inserted = transformOfficeTableMetadata(
      before,
      target,
      nextIdentity,
      { axis: 'column', action: 'insert', index: 1, anchorIndex: 0 },
      { rows: 3, columns: 3 },
      [{ tableIndex: 0, fingerprint: 'before' }],
      [40, 120],
      40,
    )
    expect(inserted.tables).toEqual([expect.objectContaining({
      tableIndex: 0,
      fingerprint: 'after',
      columns: [40, 40, 120],
      opaque: { exact: ['preserve', 7] },
    })])
    expect(inserted.tableColors).toEqual([
      { tableIndex: 0, fingerprint: 'after', future: 'preserve' },
    ])
    expect(before.tables[0].columns).toEqual([10, 120])
  })

  test('missing target metadata stays missing and never creates layout or color entries', () => {
    const before: OfficeTableMetadataSnapshot = { tables: [], tableColors: [] }
    expect(transformOfficeTableMetadata(
      before,
      target,
      nextIdentity,
      { axis: 'column', action: 'insert', index: 0, anchorIndex: 0 },
      { rows: 2, columns: 2 },
    )).toEqual(before)
  })

  test('row delete removes exact row coordinates and shifts later rows without touching columns', () => {
    const before: OfficeTableMetadataSnapshot = {
      tables: [{ tableIndex: 0, fingerprint: 'before', columns: [80, 120] }],
      tableColors: [{
        tableIndex: 0,
        fingerprint: 'before',
        cells: { '0,0': '#000000', '2,1': '#222222', '4,0': '#444444' },
        rows: {
          '0': { color: '#100000', rank: 1 },
          '2': { color: '#200000', rank: 2 },
          '4': { color: '#400000', rank: 4 },
        },
        columns: { '1': { color: '#abcdef', rank: 5 } },
      }],
    }
    const after = transformOfficeTableMetadata(
      before,
      target,
      nextIdentity,
      { axis: 'row', action: 'delete', index: 2 },
      { rows: 4, columns: 2 },
    )
    expect(after.tableColors[0]).toMatchObject({
      cells: { '0,0': '#000000', '3,0': '#444444' },
      rows: {
        '0': { color: '#100000', rank: 1 },
        '3': { color: '#400000', rank: 4 },
      },
      columns: { '1': { color: '#abcdef', rank: 5 } },
    })
  })

  test('duplicate fingerprints and mixed missing domains never redirect a target to its sibling', () => {
    const before: OfficeTableMetadataSnapshot = {
      tables: [{ tableIndex: 1, fingerprint: 'duplicate', columns: [33, 44] }],
      tableColors: [
        { tableIndex: 0, fingerprint: 'target', cells: { '1,0': '#101010' } },
        { tableIndex: 1, fingerprint: 'target', cells: { '1,0': '#202020' } },
      ],
    }
    const frozen = structuredClone(before)
    const after = transformOfficeTableMetadata(
      before,
      { tableIndex: 0, fingerprint: 'duplicate' },
      { tableIndex: 0, fingerprint: 'after' },
      { axis: 'column', action: 'insert', index: 1, anchorIndex: 0 },
      { rows: 2, columns: 2 },
    )
    expect(after.tables).toEqual(before.tables)
    expect(after.tableColors[0]).toMatchObject({
      tableIndex: 0,
      fingerprint: 'after',
      cells: { '1,0': '#101010' },
    })
    expect(after.tableColors[1]).toEqual(before.tableColors[1])
    expect(before).toEqual(frozen)
  })

  test('unique live fingerprint refreshes a stale index ahead of a competing current-index entry', () => {
    const before: OfficeTableMetadataSnapshot = {
      tables: [
        { tableIndex: 0, fingerprint: 'competitor', columns: [10, 20] },
        { tableIndex: 9, fingerprint: 'unique-target', columns: [80, 120] },
      ],
      tableColors: [
        { tableIndex: 0, fingerprint: 'competitor', cells: { '1,0': '#aaaaaa' } },
        { tableIndex: 9, fingerprint: 'unique-target', cells: { '1,1': '#bbbbbb' } },
      ],
    }
    const after = transformOfficeTableMetadata(
      before,
      { tableIndex: 0, fingerprint: 'unique-target' },
      { tableIndex: 0, fingerprint: 'next-target' },
      { axis: 'column', action: 'insert', index: 1, anchorIndex: 0 },
      { rows: 2, columns: 3 },
      [
        { tableIndex: 0, fingerprint: 'unique-target' },
        { tableIndex: 1, fingerprint: 'other-live' },
      ],
    )
    expect(after.tables[0]).toEqual(before.tables[0])
    expect(after.tables[1]).toEqual({
      tableIndex: 0,
      fingerprint: 'next-target',
      columns: [80, 80, 120],
    })
    expect(after.tableColors[0]).toEqual(before.tableColors[0])
    expect(after.tableColors[1]).toEqual({
      tableIndex: 0,
      fingerprint: 'next-target',
      cells: { '1,2': '#bbbbbb' },
    })
  })

  test('duplicate live fingerprints use exact entries without cross-table mutation', () => {
    const before: OfficeTableMetadataSnapshot = {
      tables: [
        { tableIndex: 0, fingerprint: 'duplicate', columns: [50, 60] },
        { tableIndex: 1, fingerprint: 'duplicate', columns: [70, 80] },
      ],
      tableColors: [
        { tableIndex: 0, fingerprint: 'duplicate', cells: { '1,0': '#111111' } },
        { tableIndex: 1, fingerprint: 'duplicate', cells: { '1,0': '#222222' } },
      ],
    }
    const after = transformOfficeTableMetadata(
      before,
      { tableIndex: 1, fingerprint: 'duplicate' },
      { tableIndex: 1, fingerprint: 'next' },
      { axis: 'row', action: 'insert', index: 1 },
      { rows: 3, columns: 2 },
      [
        { tableIndex: 0, fingerprint: 'duplicate' },
        { tableIndex: 1, fingerprint: 'duplicate' },
      ],
    )
    expect(after.tables[0]).toEqual(before.tables[0])
    expect(after.tableColors[0]).toEqual(before.tableColors[0])
    expect(after.tables[1]).toMatchObject({ tableIndex: 1, fingerprint: 'next' })
    expect(after.tableColors[1]).toMatchObject({ cells: { '2,0': '#222222' } })
  })

  test('duplicate live fingerprint with missing target metadata never consumes the sibling entry', () => {
    const before: OfficeTableMetadataSnapshot = {
      tables: [{ tableIndex: 1, fingerprint: 'duplicate', columns: [70, 80] }],
      tableColors: [{ tableIndex: 1, fingerprint: 'duplicate', cells: { '1,0': '#222222' } }],
    }
    const after = transformOfficeTableMetadata(
      before,
      { tableIndex: 0, fingerprint: 'duplicate' },
      { tableIndex: 0, fingerprint: 'next' },
      { axis: 'row', action: 'insert', index: 1 },
      { rows: 3, columns: 2 },
      [
        { tableIndex: 0, fingerprint: 'duplicate' },
        { tableIndex: 1, fingerprint: 'duplicate' },
      ],
    )
    expect(after).toEqual(before)
  })

  test('current physical index is the fallback after a header fingerprint change', () => {
    const before: OfficeTableMetadataSnapshot = {
      tables: [{ tableIndex: 0, fingerprint: 'old-header', columns: [80, 120] }],
      tableColors: [{ tableIndex: 0, fingerprint: 'old-header', cells: { '1,0': '#111111' } }],
    }
    const after = transformOfficeTableMetadata(
      before,
      { tableIndex: 0, fingerprint: 'new-header' },
      { tableIndex: 0, fingerprint: 'after' },
      { axis: 'row', action: 'insert', index: 1 },
      { rows: 3, columns: 2 },
      [{ tableIndex: 0, fingerprint: 'new-header' }],
    )
    expect(after.tables[0]).toMatchObject({ fingerprint: 'after', columns: [80, 120] })
    expect(after.tableColors[0]).toMatchObject({ fingerprint: 'after', cells: { '2,0': '#111111' } })
  })
})

test('[slice 01.1] logical table addressing uses TableMap coordinates across rowspan and colspan', () => {
  const paragraph = (text: string) => coordinatorSchema.node(
    'paragraph', null, coordinatorSchema.text(text),
  )
  const spanning = coordinatorSchema.node('table_header', { colspan: 2, rowspan: 2, colwidth: null }, paragraph('span'))
  const trailing = coordinatorSchema.node('table_header', null, paragraph('trail'))
  const rowspanFollower = coordinatorSchema.node('table_cell', null, paragraph('follower'))
  const table = coordinatorSchema.node('table', null, [
    coordinatorSchema.node('table_row', null, [spanning, trailing]),
    coordinatorSchema.node('table_row', null, [rowspanFollower]),
    coordinatorSchema.node('table_row', null, [
      coordinatorSchema.node('table_cell', null, paragraph('a')),
      coordinatorSchema.node('table_cell', null, paragraph('b')),
      coordinatorSchema.node('table_cell', null, paragraph('c')),
    ]),
  ])
  expect(getLogicalTableCellContext(table, spanning)).toEqual({
    rowIndex: 0, rowEndIndex: 2, colIndex: 0, colEndIndex: 2,
  })
  expect(getLogicalTableCellContext(table, trailing)).toEqual({
    rowIndex: 0, rowEndIndex: 1, colIndex: 2, colEndIndex: 3,
  })
  expect(getLogicalTableCellContext(table, rowspanFollower)).toEqual({
    rowIndex: 1, rowEndIndex: 2, colIndex: 2, colEndIndex: 3,
  })
  expect(getLogicalTableCellContext(table, table.child(2).child(2)))
    .toEqual({ rowIndex: 2, rowEndIndex: 3, colIndex: 2, colEndIndex: 3 })
})

test('[slice 01.2] row actions address Below at the clicked rowspan bottom boundary', () => {
  const paragraph = (text: string) => coordinatorSchema.node(
    'paragraph', null, coordinatorSchema.text(text),
  )
  const spanning = coordinatorSchema.node(
    'table_header',
    { colspan: 2, rowspan: 2, colwidth: null },
    paragraph('clicked span'),
  )
  const table = coordinatorSchema.node('table', null, [
    coordinatorSchema.node('table_row', null, [
      spanning,
      coordinatorSchema.node('table_header', null, paragraph('H2')),
    ]),
    coordinatorSchema.node('table_row', null, [
      coordinatorSchema.node('table_cell', null, paragraph('A2')),
    ]),
    coordinatorSchema.node('table_row', null, [0, 1, 2].map((column) => (
      coordinatorSchema.node('table_cell', null, paragraph(`B${column}`))
    ))),
  ])
  const logical = getLogicalTableCellContext(table, spanning)
  expect(logical).toEqual({ rowIndex: 0, rowEndIndex: 2, colIndex: 0, colEndIndex: 2 })
  const context = { ...logical!, rowCount: 3, colCount: 3, tablePos: 1 }
  expect(getOfficeTableMutationForAction(context, 'insert-row-below')).toEqual({
    axis: 'row', action: 'insert', index: 2,
  })
  expect(getOfficeTableMutationForAction(context, 'delete-row-below')).toEqual({
    axis: 'row', action: 'delete', index: 2,
  })
  const bottomSpanningContext = { ...context, rowEndIndex: context.rowCount }
  expect(getOfficeTableMutationForAction(bottomSpanningContext, 'insert-row-below')).toEqual({
    axis: 'row', action: 'insert', index: 3,
  })
  expect(getOfficeTableMutationForAction(bottomSpanningContext, 'delete-row-below')).toBeNull()
  expect(getOfficeTableActionDisabledReason(bottomSpanningContext, 'delete-row-below'))
    .toBe('There is no adjacent row below this cell to delete.')
})

test('[slice 01.3] spanning-cell column actions use exact TableMap left and right logical boundaries', () => {
  const paragraph = (text: string) => coordinatorSchema.node(
    'paragraph', null, coordinatorSchema.text(text),
  )
  const spanning = coordinatorSchema.node(
    'table_header',
    { colspan: 2, rowspan: 2, colwidth: null },
    paragraph('logical columns 1 and 2'),
  )
  const table = coordinatorSchema.node('table', null, [
    coordinatorSchema.node('table_row', null, [
      coordinatorSchema.node('table_header', null, paragraph('column 0')),
      spanning,
      coordinatorSchema.node('table_header', null, paragraph('column 3')),
    ]),
    coordinatorSchema.node('table_row', null, [
      coordinatorSchema.node('table_cell', null, paragraph('rowspan follower column 0')),
      coordinatorSchema.node('table_cell', null, paragraph('rowspan follower column 3')),
    ]),
  ])
  expect(TableMap.get(table)).toMatchObject({ width: 4, height: 2 })
  const logical = getLogicalTableCellContext(table, spanning)
  expect(logical).toEqual({ rowIndex: 0, rowEndIndex: 2, colIndex: 1, colEndIndex: 3 })
  const context = {
    ...logical!, rowCount: 2, colCount: 4, tablePos: 1,
  }
  expect(getOfficeTableMutationForAction(context, 'insert-col-left')).toEqual({
    axis: 'column', action: 'insert', index: 1, anchorIndex: 1,
  })
  expect(getOfficeTableMutationForAction(context, 'insert-col-right')).toEqual({
    axis: 'column', action: 'insert', index: 3, anchorIndex: 2,
  })
  expect(getOfficeTableMutationForAction(context, 'delete-col-left')).toEqual({
    axis: 'column', action: 'delete', index: 0,
  })
  expect(getOfficeTableMutationForAction(context, 'delete-col-right')).toEqual({
    axis: 'column', action: 'delete', index: 3,
  })
  expect(getLogicalTableCellContext(table, table.child(1).child(1)))
    .toEqual({ rowIndex: 1, rowEndIndex: 2, colIndex: 3, colEndIndex: 4 })
})

function spanningColumnTable() {
  const paragraph = (text: string) => coordinatorSchema.node(
    'paragraph', null, text ? coordinatorSchema.text(text) : undefined,
  )
  return coordinatorSchema.node('table', null, [
    coordinatorSchema.node('table_row', null, [
      coordinatorSchema.node('table_header', null, paragraph('h0')),
      coordinatorSchema.node(
        'table_header',
        { colspan: 2, rowspan: 2, colwidth: null },
        paragraph('span-1-2'),
      ),
      coordinatorSchema.node('table_header', null, paragraph('h3')),
    ]),
    coordinatorSchema.node('table_row', null, [
      coordinatorSchema.node('table_cell', null, paragraph('r1c0')),
      coordinatorSchema.node('table_cell', null, paragraph('r1c3')),
    ]),
    coordinatorSchema.node('table_row', null, [0, 1, 2, 3].map((column) => (
      coordinatorSchema.node('table_cell', null, paragraph(`r2c${column}`))
    ))),
  ])
}

function physicalTableText(table: ProseNode) {
  return Array.from({ length: table.childCount }, (_, rowIndex) => {
    const row = table.child(rowIndex)
    return Array.from({ length: row.childCount }, (_, cellIndex) => row.child(cellIndex).textContent)
  })
}

type SpanningColumnCommandCase = {
  label: string
  action: 'insert-col-left' | 'insert-col-right' | 'delete-col-left' | 'delete-col-right'
  expectedWidths: number[]
  expectedCells: Record<string, string> | undefined
  expectedColumns: Record<string, { color: string; rank: number }> | undefined
  expectedText: string[][]
}

const spanningColumnCommandCases: SpanningColumnCommandCase[] = [
  {
    label: 'Insert Column Left before colspan left edge',
    action: 'insert-col-left',
    expectedWidths: [70, 90, 90, 110, 130],
    expectedCells: { '1,4': '#112233', '2,3': '#223344' },
    expectedColumns: { '4': { color: '#445566', rank: 4 } },
    expectedText: [
      ['h0', '', 'span-1-2', 'h3'],
      ['r1c0', '', 'r1c3'],
      ['r2c0', '', 'r2c1', 'r2c2', 'r2c3'],
    ],
  },
  {
    label: 'Insert Column Right after colspan right edge',
    action: 'insert-col-right',
    expectedWidths: [70, 90, 110, 110, 130],
    expectedCells: { '1,4': '#112233', '2,2': '#223344' },
    expectedColumns: { '4': { color: '#445566', rank: 4 } },
    expectedText: [
      ['h0', 'span-1-2', '', 'h3'],
      ['r1c0', '', 'r1c3'],
      ['r2c0', 'r2c1', 'r2c2', '', 'r2c3'],
    ],
  },
  {
    label: 'Delete Column Left removes only adjacent first column',
    action: 'delete-col-left',
    expectedWidths: [90, 110, 130],
    expectedCells: { '1,2': '#112233', '2,1': '#223344' },
    expectedColumns: { '2': { color: '#445566', rank: 4 } },
    expectedText: [
      ['span-1-2', 'h3'],
      ['r1c3'],
      ['r2c1', 'r2c2', 'r2c3'],
    ],
  },
  {
    label: 'Delete Column Right removes only adjacent last column',
    action: 'delete-col-right',
    expectedWidths: [70, 90, 110],
    expectedCells: { '2,2': '#223344' },
    expectedColumns: undefined,
    expectedText: [
      ['h0', 'span-1-2'],
      ['r1c0'],
      ['r2c0', 'r2c1', 'r2c2'],
    ],
  },
]

for (const commandCase of spanningColumnCommandCases) {
  test(`[slice 01.3] production colspan command ${commandCase.label} is exact through Undo and Redo`, () => {
    const table = spanningColumnTable()
    const initialDocument = coordinatorSchema.node('doc', null, [table])
    const before: OfficeTableMetadataSnapshot = {
      tables: [{ tableIndex: 0, fingerprint: 'before', columns: [70, 90, 110, 130] }],
      tableColors: [{
        tableIndex: 0,
        fingerprint: 'before',
        cells: { '1,3': '#112233', '2,2': '#223344' },
        columns: { '3': { color: '#445566', rank: 4 } },
      }],
    }
    const snapshot = structuredClone(before)
    const root = {} as HTMLElement
    let externalPublications = 0
    let activeToken = 0
    const unregister = registerOfficeTableMetadataBindings(root, {
      readTables: () => structuredClone(snapshot.tables),
      readTableColors: () => structuredClone(snapshot.tableColors),
      publishTables: (tables) => { snapshot.tables = structuredClone(tables) },
      publishTableColors: (colors) => { snapshot.tableColors = structuredClone(colors) },
      prepareDeferredSnapshot: (token) => {
        activeToken = token
        return true
      },
      cancelDeferredSnapshot: () => true,
      isCurrentSnapshot: (token) => token === activeToken,
      publishSnapshot: () => {
        externalPublications += 1
        return true
      },
    })
    const metadataPlugin = createOfficeTableMetadataProsePlugin((next, document, deferExternal, token) => {
      publishOfficeTableMetadataSnapshot(root, next, document, { deferExternal, token })
    })
    const view = {
      state: EditorState.create({
        schema: coordinatorSchema,
        doc: initialDocument,
        plugins: [history(), metadataPlugin],
      }),
      dispatch(transaction: Transaction) {
        this.state = this.state.applyTransaction(transaction).state
      },
    }
    const logical = getLogicalTableCellContext(table, table.child(0).child(1))!
    const context = { ...logical, rowCount: 3, colCount: 4, tablePos: 1 }
    const mutation = getOfficeTableMutationForAction(context, commandCase.action)!
    const selectionIndex = mutation.action === 'delete' ? mutation.index : context.colIndex
    const selectionKey = {} as never
    const commands = {
      get: () => (payload: { index: number }) => (
        state: EditorState,
        dispatch?: (transaction: Transaction) => void,
      ) => {
        const selectedTable = state.doc.child(0)
        const map = TableMap.get(selectedTable)
        const first = map.positionAt(0, payload.index, selectedTable)
        const last = map.positionAt(map.height - 1, payload.index, selectedTable)
        const selection = CellSelection.colSelection(
          state.doc.resolve(1 + last),
          state.doc.resolve(1 + first),
        )
        dispatch?.(state.tr.setSelection(selection))
        return true
      },
    }
    const mutationCommand = commandCase.action === 'insert-col-left'
      ? addColumnBefore
      : commandCase.action === 'insert-col-right'
        ? addColumnAfter
        : deleteColumn

    try {
      const result = runStockOfficeTableMutation({
        root,
        view: view as never,
        commands: commands as never,
        tablePos: 1,
        selectionIndex,
        mutation,
        selectionCommandKey: selectionKey,
        mutationCommand,
      })
      expect(result).toMatchObject({ applied: true, reason: 'applied' })
      expect(TableMap.get(view.state.doc.child(0))).toMatchObject({
        height: 3,
        width: commandCase.expectedWidths.length,
      })
      expect(physicalTableText(view.state.doc.child(0))).toEqual(commandCase.expectedText)
      expect(snapshot.tables[0]).toEqual(expect.objectContaining({ columns: commandCase.expectedWidths }))
      expect(snapshot.tableColors[0]?.cells).toEqual(commandCase.expectedCells)
      expect(snapshot.tableColors[0]?.columns).toEqual(commandCase.expectedColumns)
      expect(snapshot.tables[0]?.fingerprint).toBe(snapshot.tableColors[0]?.fingerprint)
      expect(externalPublications).toBe(1)
      const forwardDocument = view.state.doc
      const forwardSnapshot = structuredClone(snapshot)

      expect(undo(view.state, (transaction) => view.dispatch(transaction))).toBe(true)
      expect(view.state.doc.eq(initialDocument)).toBe(true)
      expect(snapshot).toEqual(before)
      expect(externalPublications).toBe(2)

      expect(redo(view.state, (transaction) => view.dispatch(transaction))).toBe(true)
      expect(view.state.doc.eq(forwardDocument)).toBe(true)
      expect(snapshot).toEqual(forwardSnapshot)
      expect(externalPublications).toBe(3)
    } finally {
      unregister()
    }
  })
}

test('[slice 01.1] frontmatter reads and unrelated writes preserve raw dormant table metadata', () => {
  const rawTables = [{
    tableIndex: 0,
    fingerprint: 'raw',
    columns: [70, null, 'bad', 130],
    future: { layout: true },
  }]
  const rawColors = [{
    tableIndex: 0,
    fingerprint: 'raw',
    cells: { '0,0': '#ABCDEF', '1,1': 'red', bad: 42 },
    rows: { '0': { color: '#123456', rank: 'bad' }, '1': 'shape' },
    columns: 'malformed-map-shape',
    future: { colors: true },
  }]
  const frontmatter = { metadata: { tables: rawTables, tableColors: rawColors, sibling: 'untouched' } }
  const layouts = getDocumentTableLayouts(frontmatter)
  const colors = getDocumentTableColors(frontmatter)
  expect(layouts).toEqual(rawTables)
  expect(colors).toEqual(rawColors)
  const withTables = setDocumentTableLayouts(frontmatter, layouts)
  const withColors = setDocumentTableColors(withTables, colors)
  expect(withColors).toEqual(frontmatter)
})

test('[slice 01.1] empty collection setters merge explicit presence without materializing missing keys', () => {
  const missing = { metadata: { sibling: 'exact' } }
  const missingRoundTrip = setDocumentTableColors(
    setDocumentTableLayouts(missing, getDocumentTableLayouts(missing)),
    getDocumentTableColors(missing),
  )
  expect(missingRoundTrip).toEqual(missing)
  expect(Object.hasOwn(missingRoundTrip.metadata, 'tables')).toBe(false)
  expect(Object.hasOwn(missingRoundTrip.metadata, 'tableColors')).toBe(false)

  const explicit = { metadata: { tables: [], tableColors: [], sibling: 'exact' } }
  const explicitRoundTrip = setDocumentTableColors(
    setDocumentTableLayouts(explicit, getDocumentTableLayouts(explicit)),
    getDocumentTableColors(explicit),
  )
  expect(explicitRoundTrip).toEqual(explicit)
  expect(setDocumentTableLayouts({ metadata: { tables: [{ tableIndex: 0 }] } }, []))
    .toEqual({ metadata: {} })
  expect(setDocumentTableColors({ metadata: { tableColors: [{ tableIndex: 0 }] } }, []))
    .toEqual({ metadata: {} })

  const emptyStep = new OfficeTableMetadataStep(
    { tables: [], tableColors: [] },
    { tables: [], tableColors: [] },
  )
  const decoded = OfficeTableMetadataStep.fromJSON(schema, emptyStep.toJSON())
  expect(decoded.before).toEqual({ tables: [], tableColors: [] })
  expect(decoded.after).toEqual({ tables: [], tableColors: [] })
  expect(setDocumentTableColors(
    setDocumentTableLayouts(explicit, decoded.after.tables),
    decoded.after.tableColors,
  )).toEqual(explicit)
  expect(setDocumentTableColors(
    setDocumentTableLayouts(missing, decoded.after.tables),
    decoded.after.tableColors,
  )).toEqual(missing)
})

test('[slice 01.1] metadata Step JSON codec losslessly roundtrips raw YAML-supported values', () => {
  const nullPrototype = Object.assign(Object.create(null) as Record<string, unknown>, {
    exact: 'null-prototype',
    missing: undefined,
  })
  const afterNullPrototype = Object.assign(Object.create(null) as Record<string, unknown>, {
    exact: 'after-null-prototype',
  })
  const sparse = new Array(8)
  sparse[0] = undefined
  sparse[2] = null
  sparse[3] = Number.NaN
  sparse[4] = Number.POSITIVE_INFINITY
  sparse[5] = Number.NEGATIVE_INFINITY
  sparse[6] = -0
  sparse[7] = 'tail'
  const before: OfficeTableMetadataSnapshot = {
    tables: [{
      tableIndex: 0,
      fingerprint: 'raw',
      sparse,
      date: new Date('2025-03-04T05:06:07.890Z'),
      bytes: new Uint8Array([0, 127, 255]),
      binary: Buffer.from([4, 5, 6]),
      reservedLookingKeys: {
        encoding: 'office-table-metadata/raw-v1',
        object: ['number', 'nan'],
      },
      nullPrototype,
    }],
    tableColors: { missing: undefined, false: false, empty: '' },
  }
  const after: OfficeTableMetadataSnapshot = {
    tables: ['valid', 0, true],
    tableColors: [{ cells: { '0,0': '#112233' }, nullPrototype: afterNullPrototype }],
  }
  const step = new OfficeTableMetadataStep(before, after)
  expect(step.before).not.toBe(before)
  expect(step.before.tables).not.toBe(before.tables)
  expect(step.before).not.toHaveProperty('encoding')
  const storedTarget = (step.before.tables as Array<Record<string, unknown>>)[0]
  expect(Buffer.isBuffer(storedTarget.binary)).toBe(true)
  expect(storedTarget.bytes).toBeInstanceOf(Uint8Array)
  expect(Buffer.isBuffer(storedTarget.bytes)).toBe(false)
  expect(Object.getPrototypeOf(storedTarget.nullPrototype)).toBeNull()
  ;(before.tables as Array<Record<string, unknown>>)[0].binary = Buffer.from([99])
  ;((before.tables as Array<Record<string, unknown>>)[0].bytes as Uint8Array)[0] = 99
  nullPrototype.exact = 'mutated-source'
  afterNullPrototype.exact = 'mutated-after-source'
  expect(Array.from(
    ((step.before.tables as Array<Record<string, unknown>>)[0].binary as Uint8Array),
  )).toEqual([4, 5, 6])
  expect(((step.before.tables as Array<Record<string, unknown>>)[0].nullPrototype as Record<string, unknown>).exact)
    .toBe('null-prototype')
  expect(Object.getPrototypeOf(
    ((step.after.tableColors as Array<Record<string, unknown>>)[0].nullPrototype as object),
  )).toBeNull()
  expect(((step.after.tableColors as Array<Record<string, unknown>>)[0].nullPrototype as Record<string, unknown>).exact)
    .toBe('after-null-prototype')
  const exposed = (step.before.tables as Array<Record<string, unknown>>)[0]
  ;(exposed.binary as Uint8Array)[0] = 88
  ;(exposed.bytes as Uint8Array)[0] = 88
  ;(exposed.date as Date).setTime(0)
  ;(exposed.nullPrototype as Record<string, unknown>).exact = 'mutated-getter'
  const protectedTarget = (step.before.tables as Array<Record<string, unknown>>)[0]
  expect(Array.from(protectedTarget.binary as Uint8Array)).toEqual([4, 5, 6])
  expect(Array.from(protectedTarget.bytes as Uint8Array)).toEqual([0, 127, 255])
  expect((protectedTarget.date as Date).toISOString()).toBe('2025-03-04T05:06:07.890Z')
  expect((protectedTarget.nullPrototype as Record<string, unknown>).exact).toBe('null-prototype')
  expect(Object.getPrototypeOf(protectedTarget.nullPrototype)).toBeNull()

  const wire = JSON.parse(JSON.stringify(step.toJSON())) as Record<string, unknown>
  const decoded = ProseStep.fromJSON(schema, wire) as OfficeTableMetadataStep
  expect(decoded).toBeInstanceOf(OfficeTableMetadataStep)
  const decodedTarget = (decoded.before.tables as Array<Record<string, unknown>>)[0]
  const decodedSparse = decodedTarget.sparse as unknown[]
  expect(decodedSparse).toHaveLength(8)
  expect(0 in decodedSparse).toBe(true)
  expect(decodedSparse[0]).toBeUndefined()
  expect(1 in decodedSparse).toBe(false)
  expect(decodedSparse[2]).toBeNull()
  expect(Number.isNaN(decodedSparse[3])).toBe(true)
  expect(decodedSparse[4]).toBe(Number.POSITIVE_INFINITY)
  expect(decodedSparse[5]).toBe(Number.NEGATIVE_INFINITY)
  expect(Object.is(decodedSparse[6], -0)).toBe(true)
  expect(decodedSparse[7]).toBe('tail')
  expect(decodedTarget.date).toBeInstanceOf(Date)
  expect((decodedTarget.date as Date).toISOString()).toBe('2025-03-04T05:06:07.890Z')
  expect(decodedTarget.bytes).toBeInstanceOf(Uint8Array)
  expect(Array.from(decodedTarget.bytes as Uint8Array)).toEqual([0, 127, 255])
  expect(Buffer.isBuffer(decodedTarget.binary)).toBe(true)
  expect(Array.from(decodedTarget.binary as Uint8Array)).toEqual([4, 5, 6])
  expect(decodedTarget.reservedLookingKeys).toEqual({
    encoding: 'office-table-metadata/raw-v1',
    object: ['number', 'nan'],
  })
  expect(Object.getPrototypeOf(decodedTarget.nullPrototype)).toBeNull()
  expect((decodedTarget.nullPrototype as Record<string, unknown>).exact).toBe('null-prototype')
  expect(Object.getPrototypeOf(
    ((decoded.after.tableColors as Array<Record<string, unknown>>)[0].nullPrototype as object),
  )).toBeNull()
  expect(snapshotsEqual(decoded.before, step.before)).toBe(true)
  expect(snapshotsEqual(decoded.after, step.after)).toBe(true)

  const inverseWire = JSON.parse(JSON.stringify(decoded.invert().toJSON())) as Record<string, unknown>
  const inverse = OfficeTableMetadataStep.fromJSON(schema, inverseWire)
  expect(snapshotsEqual(inverse.before, step.after)).toBe(true)
  expect(snapshotsEqual(inverse.after, step.before)).toBe(true)
  expect(Object.getPrototypeOf(
    ((inverse.before.tableColors as Array<Record<string, unknown>>)[0].nullPrototype as object),
  )).toBeNull()
  expect(Object.getPrototypeOf(
    ((inverse.after.tables as Array<Record<string, unknown>>)[0].nullPrototype as object),
  )).toBeNull()

  const snapshot = (tables: unknown): OfficeTableMetadataSnapshot => ({ tables, tableColors: [] })
  expect(snapshotsEqual(snapshot(new Array(1)), snapshot([null]))).toBe(false)
  expect(snapshotsEqual(snapshot([Number.NaN]), snapshot([null]))).toBe(false)
  expect(snapshotsEqual(snapshot([Number.POSITIVE_INFINITY]), snapshot([Number.NEGATIVE_INFINITY]))).toBe(false)
  expect(snapshotsEqual(snapshot([new Date(0)]), snapshot([new Date(0).toISOString()]))).toBe(false)
  expect(snapshotsEqual(snapshot([new Uint8Array([1, 2])]), snapshot([new Uint8Array([1, 3])]))).toBe(false)
  expect(snapshotsEqual(snapshot([Buffer.from([1, 2])]), snapshot([new Uint8Array([1, 2])]))).toBe(false)
  expect(snapshotsEqual(
    snapshot([Object.assign(Object.create(null), { exact: 1 })]),
    snapshot([{ exact: 1 }]),
  )).toBe(false)

  const ordinary = new OfficeTableMetadataStep(after, before)
  const ordinaryDecoded = OfficeTableMetadataStep.fromJSON(
    schema,
    JSON.parse(JSON.stringify(ordinary.toJSON())) as Record<string, unknown>,
  )
  expect(snapshotsEqual(ordinaryDecoded.before, after)).toBe(true)
  expect(snapshotsEqual(ordinaryDecoded.after, before)).toBe(true)

  const cyclic: Record<string, unknown> = {}
  cyclic.self = cyclic
  expect(() => new OfficeTableMetadataStep(snapshot([cyclic]), snapshot([]))).toThrow(/cyclic value/)
  expect(() => new OfficeTableMetadataStep(snapshot([1n]), snapshot([]))).toThrow(/type bigint/)
  const accessor = Object.defineProperty({}, 'value', { enumerable: true, get: () => 1 })
  expect(() => new OfficeTableMetadataStep(snapshot([accessor]), snapshot([]))).toThrow(/accessor/)
  const customArray: unknown[] = []
  Object.defineProperty(customArray, 'hidden', { value: true })
  expect(() => new OfficeTableMetadataStep(snapshot(customArray), snapshot([]))).toThrow(/array property/)
})

test('[slice 01.1] raw table collections preserve malformed scalars and opaque ordered siblings', () => {
  const scalarFrontmatter = {
    metadata: { tables: 'opaque-layout-scalar', tableColors: 17, sibling: { exact: true } },
  }
  const scalarLayouts = getDocumentTableLayouts(scalarFrontmatter)
  const scalarColors = getDocumentTableColors(scalarFrontmatter)
  expect(scalarLayouts).toBe('opaque-layout-scalar')
  expect(scalarColors).toBe(17)
  expect(setDocumentTableColors(
    setDocumentTableLayouts(scalarFrontmatter, scalarLayouts),
    scalarColors,
  )).toEqual(scalarFrontmatter)
  expect(transformOfficeTableMetadata(
    { tables: scalarLayouts, tableColors: scalarColors },
    { tableIndex: 0, fingerprint: 'live-target' },
    { tableIndex: 0, fingerprint: 'refreshed-target' },
    { axis: 'row', action: 'insert', index: 1 },
    { rows: 4, columns: 2 },
    [{ tableIndex: 0, fingerprint: 'live-target' }],
  )).toEqual({ tables: scalarLayouts, tableColors: scalarColors })

  const malformedTargetLayout = {
    tableIndex: 'not-an-index', fingerprint: '   ', columns: [81, null], targetOpaque: 'layout',
  }
  const unrelatedLayout = {
    tableIndex: -4, fingerprint: false, columns: [44], unrelatedOpaque: { exact: true },
  }
  const malformedTargetColors = {
    tableIndex: null, fingerprint: [], cells: { '1,0': '#112233' }, targetOpaque: 'colors',
  }
  const unrelatedColors = {
    tableIndex: 'later', fingerprint: ' ', rows: 'opaque-map', unrelatedOpaque: ['exact'],
  }
  const before: OfficeTableMetadataSnapshot = {
    tables: [malformedTargetLayout, 'layout-between', 91, unrelatedLayout, 'layout-after'],
    tableColors: [malformedTargetColors, false, 'color-between', unrelatedColors, null],
  }
  const after = transformOfficeTableMetadata(
    before,
    { tableIndex: 0, fingerprint: 'live-target' },
    { tableIndex: 0, fingerprint: 'refreshed-target' },
    { axis: 'row', action: 'insert', index: 1 },
    { rows: 4, columns: 2 },
    [
      { tableIndex: 0, fingerprint: 'live-target' },
      { tableIndex: 1, fingerprint: 'live-unrelated' },
    ],
  )
  expect(after.tables).toEqual([
    { ...malformedTargetLayout, tableIndex: 0, fingerprint: 'refreshed-target' },
    'layout-between',
    91,
    unrelatedLayout,
    'layout-after',
  ])
  expect(after.tableColors).toEqual([
    {
      ...malformedTargetColors,
      tableIndex: 0,
      fingerprint: 'refreshed-target',
      cells: { '2,0': '#112233' },
    },
    false,
    'color-between',
    unrelatedColors,
    null,
  ])
  expect(before.tables).toEqual([
    malformedTargetLayout, 'layout-between', 91, unrelatedLayout, 'layout-after',
  ])
  expect(before.tableColors).toEqual([
    malformedTargetColors, false, 'color-between', unrelatedColors, null,
  ])
  const step = new OfficeTableMetadataStep(before, after)
  expect(step.before).toEqual(before)
  expect(step.invert(schema.node('doc', null, [schema.node('paragraph')])).toJSON()).toEqual(
    new OfficeTableMetadataStep(after, before).toJSON(),
  )

  const opaqueBeforeMalformed = {
    tables: ['opaque-before', malformedTargetLayout],
    tableColors: [false, malformedTargetColors],
  }
  expect(transformOfficeTableMetadata(
    opaqueBeforeMalformed,
    { tableIndex: 0, fingerprint: 'live-target' },
    { tableIndex: 0, fingerprint: 'refreshed-target' },
    { axis: 'row', action: 'insert', index: 1 },
    { rows: 4, columns: 2 },
    [{ tableIndex: 0, fingerprint: 'live-target' }],
  )).toEqual(opaqueBeforeMalformed)

  const explicitTargetAfterOpaque = {
    tables: ['opaque-before', {
      tableIndex: 0, fingerprint: 'live-target', columns: [80, 90], exact: 'target',
    }, 'opaque-after'],
    tableColors: [false, {
      tableIndex: 0, fingerprint: 'live-target', cells: { '1,0': '#112233' }, exact: 'target',
    }, null],
  }
  expect(transformOfficeTableMetadata(
    explicitTargetAfterOpaque,
    { tableIndex: 0, fingerprint: 'live-target' },
    { tableIndex: 0, fingerprint: 'refreshed-target' },
    { axis: 'row', action: 'insert', index: 1 },
    { rows: 4, columns: 2 },
    [{ tableIndex: 0, fingerprint: 'live-target' }],
  )).toEqual({
    tables: ['opaque-before', {
      tableIndex: 0, fingerprint: 'refreshed-target', columns: [80, 90], exact: 'target',
    }, 'opaque-after'],
    tableColors: [false, {
      tableIndex: 0,
      fingerprint: 'refreshed-target',
      cells: { '2,0': '#112233' },
      exact: 'target',
    }, null],
  })

  const opaqueObjectsAroundTarget = {
    tables: [
      { future: 'opaque-before' },
      { tableIndex: 0, fingerprint: [], columns: [80, null], exact: 'target' },
      { future: 'opaque-between' },
      { tableIndex: 'unrelated', rows: 'opaque-domain', exact: 'unrelated' },
      { future: 'opaque-after' },
    ],
    tableColors: [
      { future: 'opaque-before' },
      { tableIndex: 0, fingerprint: null, cells: { '1,0': '#112233' }, exact: 'target' },
      { future: 'opaque-between' },
      { fingerprint: false, columns: 'opaque-domain', exact: 'unrelated' },
      { future: 'opaque-after' },
    ],
  }
  expect(transformOfficeTableMetadata(
    opaqueObjectsAroundTarget,
    { tableIndex: 0, fingerprint: 'live-target' },
    { tableIndex: 0, fingerprint: 'refreshed-target' },
    { axis: 'row', action: 'insert', index: 1 },
    { rows: 4, columns: 2 },
    [{ tableIndex: 0, fingerprint: 'live-target' }],
  )).toEqual({
    tables: [
      { future: 'opaque-before' },
      {
        tableIndex: 0,
        fingerprint: 'refreshed-target',
        columns: [80, null],
        exact: 'target',
      },
      { future: 'opaque-between' },
      { tableIndex: 'unrelated', rows: 'opaque-domain', exact: 'unrelated' },
      { future: 'opaque-after' },
    ],
    tableColors: [
      { future: 'opaque-before' },
      {
        tableIndex: 0,
        fingerprint: 'refreshed-target',
        cells: { '2,0': '#112233' },
        exact: 'target',
      },
      { future: 'opaque-between' },
      { fingerprint: false, columns: 'opaque-domain', exact: 'unrelated' },
      { future: 'opaque-after' },
    ],
  })

  expect(transformOfficeTableMetadata(
    {
      tables: [],
      tableColors: [{
        tableIndex: 'raw', fingerprint: null, cells: 'malformed-map', future: { exact: true },
      }],
    },
    { tableIndex: 0, fingerprint: 'live-target' },
    { tableIndex: 0, fingerprint: 'refreshed-target' },
    { axis: 'row', action: 'insert', index: 1 },
    { rows: 4, columns: 2 },
    [{ tableIndex: 0, fingerprint: 'live-target' }],
  ).tableColors).toEqual([{
    tableIndex: 0,
    fingerprint: 'refreshed-target',
    future: { exact: true },
  }])
})

test('[slice 01.1] metadata Step is invertible, synchronous, history-native, and body-neutral', () => {
  const before: OfficeTableMetadataSnapshot = {
    tables: [{ tableIndex: 0, fingerprint: 'before', columns: [80] }],
    tableColors: [{ tableIndex: 0, fingerprint: 'before', cells: { '1,0': '#ffeeaa' } }],
  }
  const after: OfficeTableMetadataSnapshot = {
    tables: [{ tableIndex: 0, fingerprint: 'after', columns: [80, 80] }],
    tableColors: [{ tableIndex: 0, fingerprint: 'after', cells: { '1,1': '#ffeeaa' } }],
  }
  const publications: OfficeTableMetadataSnapshot[] = []
  const stateRef = {
    current: EditorState.create({
      schema,
      doc: schema.node('doc', null, [schema.node('paragraph', null, schema.text('A'))]),
      plugins: [history(), createOfficeTableMetadataProsePlugin((snapshot) => publications.push(snapshot))],
    }),
  }

  const structure = closeHistory(stateRef.current.tr.insertText('B', 2))
  structure.step(new OfficeTableMetadataStep(before, after))
  dispatchState(stateRef, structure)
  expect(publications).toEqual([after])
  expect(stateRef.current.doc.textContent).toBe('AB')
  expect(JSON.stringify(stateRef.current.doc.toJSON())).not.toContain('officeTableMetadata')

  const textOnly = stateRef.current.tr.insertText('C', 3)
  dispatchState(stateRef, textOnly)
  expect(publications).toHaveLength(1)
  expect(undo(stateRef.current, (transaction) => dispatchState(stateRef, transaction))).toBe(true)
  expect(stateRef.current.doc.textContent).toBe('AB')
  expect(publications).toHaveLength(1)
  expect(undo(stateRef.current, (transaction) => dispatchState(stateRef, transaction))).toBe(true)
  expect(stateRef.current.doc.textContent).toBe('A')
  expect(publications.at(-1)).toEqual(before)
  expect(redo(stateRef.current, (transaction) => dispatchState(stateRef, transaction))).toBe(true)
  expect(publications.at(-1)).toEqual(after)

  const encoded = new OfficeTableMetadataStep(before, after).toJSON()
  expect(OfficeTableMetadataStep.fromJSON(schema, encoded).invert(stateRef.current.doc).toJSON()).toEqual(
    new OfficeTableMetadataStep(after, before).toJSON(),
  )
})

test('[slice 01.1] equal metadata snapshots still publish one combined production event on forward undo and redo', () => {
  const snapshot: OfficeTableMetadataSnapshot = {
    tables: [],
    tableColors: [],
  }
  const root = {} as HTMLElement
  let tables: OfficeTableMetadataSnapshot['tables'] = []
  let colors: OfficeTableMetadataSnapshot['tableColors'] = []
  const combined: OfficeTableMetadataSnapshot[] = []
  const publication = createOfficeDeferredMarkdownPublicationState()
  const unregister = registerOfficeTableMetadataBindings(root, {
    readTables: () => tables,
    readTableColors: () => colors,
    publishTables: (next) => { tables = structuredClone(next) },
    publishTableColors: (next) => { colors = structuredClone(next) },
    prepareDeferredSnapshot: (token) => publication.prepare(token),
    cancelDeferredSnapshot: (token, document) => publication.cancel(token, document),
    isCurrentSnapshot: (token) => publication.isCurrent(token),
    publishSnapshot: (next, _before, document, token) => {
      if (!publication.finalize(token, document)) return false
      combined.push(structuredClone(next))
      return true
    },
  })
  const stateRef = {
    current: EditorState.create({
      schema,
      doc: schema.node('doc', null, [schema.node('paragraph', null, schema.text('A'))]),
      plugins: [history(), createOfficeTableMetadataProsePlugin(
        (next, document, deferExternal, token) => publishOfficeTableMetadataSnapshot(
          root, next, document, { deferExternal, token },
        ),
      )],
    }),
  }
  try {
    expect(combined).toHaveLength(0)
    const transaction = closeHistory(stateRef.current.tr.insertText('B', 2))
    transaction.step(new OfficeTableMetadataStep(snapshot, snapshot))
    dispatchState(stateRef, transaction)
    expect(combined).toEqual([snapshot])
    expect(undo(stateRef.current, (next) => dispatchState(stateRef, next))).toBe(true)
    expect(combined).toEqual([snapshot, snapshot])
    expect(redo(stateRef.current, (next) => dispatchState(stateRef, next))).toBe(true)
    expect(combined).toEqual([snapshot, snapshot, snapshot])
    expect(JSON.stringify(stateRef.current.doc.toJSON())).not.toContain('officeTableMetadata')
  } finally {
    unregister()
  }
})

for (const failure of ['tables', 'colors', 'scheduler', 'restoration'] as const) {
  test(`[slice 01.1] combined external ${failure} failure restores exact before state without acknowledgement`, () => {
    const publication = createOfficeDeferredMarkdownPublicationState()
    const before: OfficeTableMetadataSnapshot = {
      tables: [{ exact: 'before-tables' }],
      tableColors: [{ exact: 'before-colors' }],
    }
    const after: OfficeTableMetadataSnapshot = {
      tables: [{ exact: 'after-tables' }],
      tableColors: [{ exact: 'after-colors' }],
    }
    const tokenState = EditorState.create({ schema, doc: schema.node('doc', null, [schema.node('paragraph')]) })
    const token = deferOfficeTableMetadataExternalPublication(tokenState.tr)
    const original = new Error(`${failure} original failure`)
    const restoration = new Error('restoration failure')
    const reports: unknown[] = []
    let tables: unknown = structuredClone(before.tables)
    let colors: unknown = structuredClone(before.tableColors)
    let tableAttempts = 0
    let colorAttempts = 0
    let schedulerAttempts = 0
    let saves = 0
    expect(publication.prepare(token)).toBe(true)

    const settled = publishOfficeTableMetadataCombinedCallbacks({
      publication,
      snapshot: after,
      before,
      token,
      publishTables: (next) => {
        tableAttempts += 1
        tables = structuredClone(next)
        if (failure === 'tables'
          && (next as Array<{ exact: string }>)[0]?.exact === 'after-tables') throw original
      },
      publishTableColors: (next) => {
        colorAttempts += 1
        colors = structuredClone(next)
        const exact = (next as Array<{ exact: string }>)[0]?.exact
        if (failure === 'colors' && exact === 'after-colors') throw original
        if (failure === 'restoration' && exact === 'before-colors') throw restoration
      },
      markDirtyAndScheduleSave: () => {
        schedulerAttempts += 1
        if (failure === 'scheduler' || failure === 'restoration') throw original
        saves += 1
      },
      report: (error) => { reports.push(error) },
    })

    expect(settled).toBe(false)
    expect(tables).toEqual(before.tables)
    expect(colors).toEqual(before.tableColors)
    expect(tableAttempts).toBe(2)
    expect(colorAttempts).toBe(2)
    expect(schedulerAttempts).toBe(failure === 'tables' || failure === 'colors' ? 0 : 1)
    expect(saves).toBe(0)
    expect(reports[0]).toBe(original)
    expect(reports).toEqual(failure === 'restoration' ? [original, restoration] : [original])
  })
}

test('[slice 01.1] newer complete operation preempts stale outer external fanout without contamination', () => {
  const root = {} as HTMLElement
  const publication = createOfficeDeferredMarkdownPublicationState()
  const before: OfficeTableMetadataSnapshot = {
    tables: [{ exact: 'before-tables' }], tableColors: [{ exact: 'before-colors' }],
  }
  const outer: OfficeTableMetadataSnapshot = {
    tables: [{ exact: 'outer-tables' }], tableColors: [{ exact: 'outer-colors' }],
  }
  const newer: OfficeTableMetadataSnapshot = {
    tables: [{ exact: 'newer-tables' }], tableColors: [{ exact: 'newer-colors' }],
  }
  const tokenState = EditorState.create({ schema, doc: schema.node('doc', null, [schema.node('paragraph')]) })
  const outerToken = deferOfficeTableMetadataExternalPublication(tokenState.tr)
  const newerToken = deferOfficeTableMetadataExternalPublication(tokenState.tr)
  let tables: unknown = structuredClone(before.tables)
  let colors: unknown = structuredClone(before.tableColors)
  let externalTables: unknown = structuredClone(before.tables)
  let externalColors: unknown = structuredClone(before.tableColors)
  let nested = false
  let outerTables = 0
  let outerColors = 0
  let outerSchedulers = 0
  let newerTables = 0
  let newerColors = 0
  let newerSchedulers = 0
  let newerExternal = 0
  let dirty = 0
  let saves = 0
  const reports: unknown[] = []
  const unregister = registerOfficeTableMetadataBindings(root, {
    readTables: () => tables,
    readTableColors: () => colors,
    publishTables: (next) => { tables = structuredClone(next) },
    publishTableColors: (next) => { colors = structuredClone(next) },
    prepareDeferredSnapshot: (token) => publication.prepare(token),
    cancelDeferredSnapshot: (token, document) => publication.cancel(token, document),
    isCurrentSnapshot: (token) => publication.isCurrent(token),
    publishSnapshot: (next, previous, document, token) => {
      const isOuter = token === outerToken
      const settled = publishOfficeTableMetadataCombinedCallbacks({
        publication,
        snapshot: next,
        before: previous,
        document,
        token,
        publishTables: (value) => {
          externalTables = structuredClone(value)
          if (isOuter) {
            outerTables += 1
            if (!nested) {
              nested = true
              publishOfficeTableMetadataSnapshot(root, newer, undefined, { token: newerToken })
            }
          } else {
            newerTables += 1
          }
        },
        publishTableColors: (value) => {
          externalColors = structuredClone(value)
          if (isOuter) outerColors += 1
          else newerColors += 1
        },
        markDirtyAndScheduleSave: () => {
          if (isOuter) {
            outerSchedulers += 1
          } else {
            newerSchedulers += 1
            dirty += 1
            saves += 1
          }
        },
        report: (error) => { reports.push(error) },
      })
      if (settled && !isOuter) newerExternal += 1
      return settled
    },
  })
  try {
    expect(() => publishOfficeTableMetadataSnapshot(root, outer, undefined, { token: outerToken }))
      .toThrow(OfficeTableMetadataPublicationError)
    expect(tables).toEqual(newer.tables)
    expect(colors).toEqual(newer.tableColors)
    expect(externalTables).toEqual(newer.tables)
    expect(externalColors).toEqual(newer.tableColors)
    expect(outerTables).toBe(1)
    expect(outerColors).toBe(0)
    expect(outerSchedulers).toBe(0)
    expect(newerTables).toBe(1)
    expect(newerColors).toBe(1)
    expect(newerSchedulers).toBe(1)
    expect(newerExternal).toBe(1)
    expect(dirty).toBe(1)
    expect(saves).toBe(1)
    expect(reports).toEqual([])
    expect(publication.isCurrent(outerToken)).toBe(false)
    expect(publication.isCurrent(newerToken)).toBe(true)
  } finally {
    unregister()
  }
})

test('[slice 01.1] normal combined Forward Undo Redo publishes both external domains and scheduler exactly once', () => {
  const root = {} as HTMLElement
  const publication = createOfficeDeferredMarkdownPublicationState()
  const before: OfficeTableMetadataSnapshot = {
    tables: [{ exact: 'before-tables' }], tableColors: [{ exact: 'before-colors' }],
  }
  const after: OfficeTableMetadataSnapshot = {
    tables: [{ exact: 'after-tables' }], tableColors: [{ exact: 'after-colors' }],
  }
  let tables: unknown = structuredClone(before.tables)
  let colors: unknown = structuredClone(before.tableColors)
  let externalTables: unknown = structuredClone(before.tables)
  let externalColors: unknown = structuredClone(before.tableColors)
  let tableCallbacks = 0
  let colorCallbacks = 0
  let schedulers = 0
  const unregister = registerOfficeTableMetadataBindings(root, {
    readTables: () => tables,
    readTableColors: () => colors,
    publishTables: (next) => { tables = structuredClone(next) },
    publishTableColors: (next) => { colors = structuredClone(next) },
    prepareDeferredSnapshot: (token) => publication.prepare(token),
    cancelDeferredSnapshot: (token, document) => publication.cancel(token, document),
    isCurrentSnapshot: (token) => publication.isCurrent(token),
    publishSnapshot: (next, previous, document, token) => publishOfficeTableMetadataCombinedCallbacks({
      publication,
      snapshot: next,
      before: previous,
      document,
      token,
      publishTables: (value) => {
        tableCallbacks += 1
        externalTables = structuredClone(value)
      },
      publishTableColors: (value) => {
        colorCallbacks += 1
        externalColors = structuredClone(value)
      },
      markDirtyAndScheduleSave: () => { schedulers += 1 },
    }),
  })
  const stateRef = {
    current: EditorState.create({
      schema,
      doc: schema.node('doc', null, [schema.node('paragraph', null, schema.text('A'))]),
      plugins: [history(), createOfficeTableMetadataProsePlugin(
        (next, document, deferExternal, token) => publishOfficeTableMetadataSnapshot(
          root, next, document, { deferExternal, token },
        ),
      )],
    }),
  }
  try {
    const forward = closeHistory(stateRef.current.tr.insertText('B', 2))
    forward.step(new OfficeTableMetadataStep(before, after))
    dispatchState(stateRef, forward)
    expect(undo(stateRef.current, (next) => dispatchState(stateRef, next))).toBe(true)
    expect(redo(stateRef.current, (next) => dispatchState(stateRef, next))).toBe(true)
    expect(tables).toEqual(after.tables)
    expect(colors).toEqual(after.tableColors)
    expect(externalTables).toEqual(after.tables)
    expect(externalColors).toEqual(after.tableColors)
    expect(tableCallbacks).toBe(3)
    expect(colorCallbacks).toBe(3)
    expect(schedulers).toBe(3)
  } finally {
    unregister()
  }
})

for (const failure of ['false', 'throw'] as const) {
  test(`[slice 01.1] generic ${failure} settlement aborts Undo and Redo with exact store rollback`, () => {
    const before: OfficeTableMetadataSnapshot = {
      tables: [{ exact: 'before-tables' }], tableColors: [{ exact: 'before-colors' }],
    }
    const after: OfficeTableMetadataSnapshot = {
      tables: [{ exact: 'after-tables' }], tableColors: [{ exact: 'after-colors' }],
    }
    const root = {} as HTMLElement
    const publication = createOfficeDeferredMarkdownPublicationState()
    let callbackAttempts = 0
    let failSettlement = false
    let tables: unknown = structuredClone(before.tables)
    let colors: unknown = structuredClone(before.tableColors)
    const unregister = registerOfficeTableMetadataBindings(root, {
      readTables: () => tables,
      readTableColors: () => colors,
      publishTables: (next) => { tables = structuredClone(next) },
      publishTableColors: (next) => { colors = structuredClone(next) },
      prepareDeferredSnapshot: (token) => publication.prepare(token),
      cancelDeferredSnapshot: (token, document) => publication.cancel(token, document),
      isCurrentSnapshot: (token) => publication.isCurrent(token),
      publishSnapshot: (_next, _before, document, token) => {
        callbackAttempts += 1
        if (!publication.finalize(token, document)) return false
        if (failSettlement && failure === 'throw') throw new Error('generic callback')
        return !failSettlement
      },
    })
    const stateRef = {
      current: EditorState.create({
        schema,
        doc: schema.node('doc', null, [schema.node('paragraph', null, schema.text('A'))]),
        plugins: [history(), createOfficeTableMetadataProsePlugin(
          (next, document, deferExternal, token) => publishOfficeTableMetadataSnapshot(
            root, next, document, { deferExternal, token },
          ),
        )],
      }),
    }
    try {
      const forward = closeHistory(stateRef.current.tr.insertText('B', 2))
      forward.step(new OfficeTableMetadataStep(before, after))
      dispatchState(stateRef, forward)
      expect(stateRef.current.doc.textContent).toBe('AB')
      expect(tables).toEqual(after.tables)
      expect(colors).toEqual(after.tableColors)

      failSettlement = true
      expect(() => undo(stateRef.current, (next) => dispatchState(stateRef, next)))
        .toThrow(OfficeTableMetadataPublicationError)
      expect(stateRef.current.doc.textContent).toBe('AB')
      expect(tables).toEqual(after.tables)
      expect(colors).toEqual(after.tableColors)

      failSettlement = false
      expect(undo(stateRef.current, (next) => dispatchState(stateRef, next))).toBe(true)
      expect(stateRef.current.doc.textContent).toBe('A')
      expect(tables).toEqual(before.tables)
      expect(colors).toEqual(before.tableColors)

      failSettlement = true
      expect(() => redo(stateRef.current, (next) => dispatchState(stateRef, next)))
        .toThrow(OfficeTableMetadataPublicationError)
      expect(stateRef.current.doc.textContent).toBe('A')
      expect(tables).toEqual(before.tables)
      expect(colors).toEqual(before.tableColors)
      expect(callbackAttempts).toBe(4)
    } finally {
      unregister()
    }
  })
}

test('[slice 01.1] structure metadata fixture is exact and immutable', () => {
  const scenario = getFixtureScenario('structure')
  expect(scenario.variants).toContain('metadata')
  expect(renderFixtureDocument('structure', scenario.documents[0], 1, 1, 'metadata')).toContain([
    "  preserveUnknown: 'keep-me'",
    '  tables:',
    "    - { tableIndex: 0, fingerprint: 'fixture-structure-r2-c1', columns: [80] }",
    '  tableColors:',
    "    - { tableIndex: 0, fingerprint: 'fixture-structure-r2-c1', cells: { '1,0': '#ffeeaa' } }",
  ].join('\n'))
})

async function openStructureDocument(page: Page, filename: string) {
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
  await expect.poll(async () => await document.isVisible() || await folder.isVisible(), {
    timeout: 15_000,
  }).toBe(true)
  if (!await document.isVisible()) {
    await folder.click()
    await expect(document).toBeVisible()
  }
  await document.click()
  await expect(editor).toBeVisible()
  return editor
}

async function captureOfficeSaveMessages(page: Page) {
  await page.addInitScript(() => {
    const originalSend = WebSocket.prototype.send
    ;(window as typeof window & { __officeSentMessages?: unknown[] }).__officeSentMessages = []
    WebSocket.prototype.send = function captureOfficeSend(data) {
      if (typeof data === 'string') {
        try {
          ;(window as typeof window & { __officeSentMessages?: unknown[] }).__officeSentMessages?.push(JSON.parse(data))
        } catch { /* preserve non-JSON traffic */ }
      }
      return originalSend.call(this, data)
    }
  })
  return () => page.evaluate(() => (
    (window as typeof window & { __officeSentMessages?: Array<{ type?: string }> }).__officeSentMessages
      ?.filter(({ type }) => type === 'file_save').length ?? 0
  ))
}

function writeStructureFixtureMetadata(
  fixturePath: string,
  canonical: Buffer,
  tables: unknown,
  tableColors: unknown,
) {
  const parsed = parseDocumentSettings(canonical.toString())
  const metadata = typeof parsed.frontmatter.metadata === 'object'
    && parsed.frontmatter.metadata
    && !Array.isArray(parsed.frontmatter.metadata)
    ? parsed.frontmatter.metadata as Record<string, unknown>
    : {}
  const nextMetadata: Record<string, unknown> = {
    ...metadata,
    rawCollectionSibling: { exact: ['preserve', 7] },
  }
  if (tables === undefined) delete nextMetadata.tables
  else nextMetadata.tables = tables
  if (tableColors === undefined) delete nextMetadata.tableColors
  else nextMetadata.tableColors = tableColors
  fs.writeFileSync(fixturePath, serializeDocumentSettings(parsed.body, parsed.settings, {
    ...parsed.frontmatter,
    metadata: nextMetadata,
  }))
}

function expectTableCollectionPresence(
  fixturePath: string,
  expected: { tables: boolean; tableColors: boolean },
) {
  const parsed = parseMarkdownFrontmatter(fs.readFileSync(fixturePath, 'utf8'))
  const metadata = parsed.frontmatter.metadata as Record<string, unknown>
  expect(Object.hasOwn(metadata, 'tables')).toBe(expected.tables)
  expect(Object.hasOwn(metadata, 'tableColors')).toBe(expected.tableColors)
  if (expected.tables) expect(metadata.tables).toEqual([])
  if (expected.tableColors) expect(metadata.tableColors).toEqual([])
}

async function buildInitialNodeViewProbe(): Promise<string> {
  const virtualId = 'virtual:office-initial-node-view-probe'
  const resolvedVirtualId = `\0${virtualId}`
  const nodeViewPath = path.resolve('src/components/office/officeTableNodeView.ts')
  const geometryPath = path.resolve('src/components/office/officeTableGeometry.ts')
  const colorsPath = path.resolve('src/components/office/officeTableColors.ts')
  const identityPath = path.resolve('src/components/office/officeTableIdentity.ts')
  const contextMenuPath = path.resolve('src/components/office/officeTableContextMenu.ts')
  const sharedMenuPath = path.resolve('src/components/menu/index.ts')
  const source = `
    import { Schema } from '@milkdown/kit/prose/model'
    import { EditorState } from '@milkdown/kit/prose/state'
    import { TableMap, tableNodes } from '@milkdown/kit/prose/tables'
    import { EditorView } from '@milkdown/kit/prose/view'
    import { createOfficeTableNodeView } from ${JSON.stringify(nodeViewPath)}
    import { installOfficeTableGeometry } from ${JSON.stringify(geometryPath)}
    import { installOfficeTableColors } from ${JSON.stringify(colorsPath)}
    import {
      getDomTableLogicalWidth,
      mapOfficeDomTableLogicalCells,
    } from ${JSON.stringify(identityPath)}
    import { getOfficeTableActionDisabledReason } from ${JSON.stringify(contextMenuPath)}
    import { openMenuTree } from ${JSON.stringify(sharedMenuPath)}

    window.__officeInitialNodeViewProbe = () => {
      const schema = new Schema({
        nodes: {
          doc: { content: 'block+' },
          paragraph: { group: 'block', content: 'text*', toDOM: () => ['p', 0] },
          text: {},
          ...tableNodes({ tableGroup: 'block', cellContent: 'paragraph+' }),
        },
      })
      const paragraph = (text) => schema.node('paragraph', null, schema.text(text))
      const spanningHeader = schema.node('table_header', {
        colspan: 2,
        rowspan: 2,
        colwidth: null,
      }, paragraph('spanning keyless header'))
      const trailingHeader = schema.node('table_header', null, paragraph('logical-column-2'))
      const table = schema.node('table', null, [
        schema.node('table_row', null, [spanningHeader, trailingHeader]),
        schema.node('table_row', null, [
          schema.node('table_cell', null, paragraph('rowspan-follower')),
        ]),
        schema.node('table_row', null, [0, 1, 2].map((index) => (
          schema.node('table_cell', null, paragraph('last-row-' + index))
        ))),
      ])
      const collisionTable = schema.node('table', null, [
        schema.node('table_row', null, [
          schema.node('table_header', null, paragraph('free-column-0')),
          schema.node('table_header', {
            colspan: 1,
            rowspan: 2,
            colwidth: null,
          }, paragraph('blocked-column-1')),
          schema.node('table_header', null, paragraph('column-2')),
          schema.node('table_header', null, paragraph('column-3')),
        ]),
        schema.node('table_row', null, [
          schema.node('table_cell', {
            colspan: 2,
            rowspan: 1,
            colwidth: null,
          }, paragraph('needs-contiguous-columns-2-and-3')),
        ]),
      ])
      const mount = document.createElement('div')
      document.body.appendChild(mount)
      const view = new EditorView(mount, {
        state: EditorState.create({ doc: schema.node('doc', null, [table, collisionTable]), schema }),
        nodeViews: { table: createOfficeTableNodeView },
      })
      const domTables = view.dom.querySelectorAll('table.rv-office-table')
      const domTable = domTables[0]
      const collisionDomTable = domTables[1]
      const bakedColumns = domTable.querySelectorAll('colgroup > col').length
      const physicalHeaderCells = domTable.rows[0].cells.length
      const logicalColumns = TableMap.get(table).width
      const geometry = installOfficeTableGeometry(view.dom, [], () => {})
      const colors = installOfficeTableColors(view.dom, [{
        tableIndex: 0,
        fingerprint: 'projection-falls-back-to-index',
        cells: { '0,2': '#112233' },
        rows: {
          '1': { color: '#445566', rank: 4 },
          '2': { color: '#aabbcc', rank: 9 },
        },
        columns: { '2': { color: '#778899', rank: 7 } },
      }], () => {})
      colors.applyColors()
      const rect = domTable.getBoundingClientRect()
      document.dispatchEvent(new PointerEvent('pointermove', {
        bubbles: true,
        clientX: rect.left + 1,
        clientY: rect.top + 1,
      }))
      const logicalCells = mapOfficeDomTableLogicalCells(domTable)
      const collisionLogicalCells = mapOfficeDomTableLogicalCells(collisionDomTable)
      const bottomSpanContext = {
        rowIndex: 0,
        rowEndIndex: 3,
        colIndex: 0,
        colEndIndex: 2,
        rowCount: 3,
        colCount: 3,
        tablePos: 0,
      }
      const bottomDeleteReason = getOfficeTableActionDisabledReason(
        bottomSpanContext,
        'delete-row-below',
      )
      const menuHandle = openMenuTree({
        anchor: { kind: 'pointer', clientX: 8, clientY: 8 },
        ariaLabel: 'Accessibility probe',
        items: [{
          kind: 'action',
          id: 'bottom-delete',
          label: 'Delete Row Below',
          icon: 'delete',
          disabled: Boolean(bottomDeleteReason),
          disabledReason: bottomDeleteReason,
          onSelect: () => ({ kind: 'stay' }),
        }],
        restoreInvocationFocus: () => {},
        focusAfterAction: () => {},
      })
      const bottomDeleteButton = document.querySelector('[data-menu-item-id="bottom-delete"]')
      const origins = Array.from(domTable.rows).map((row) => (
        Array.from(row.cells).map((cell) => logicalCells.get(cell))
      ))
      const result = {
        physicalHeaderCells,
        logicalColumns,
        bakedColumns,
        handles: document.querySelectorAll('.rv-office-table-overlay .rv-office-col-grab').length,
        keylessReadback: geometry.readLayouts(),
        origins,
        explicitAfterSpan: getComputedStyle(domTable.rows[0].cells[1]).backgroundColor,
        columnWinsAfterRowspan: getComputedStyle(domTable.rows[1].cells[0]).backgroundColor,
        rowWinsByRank: getComputedStyle(domTable.rows[2].cells[2]).backgroundColor,
        interiorBlockedOrigin: collisionLogicalCells.get(collisionDomTable.rows[1].cells[0]),
        interiorBlockedWidth: getDomTableLogicalWidth(collisionDomTable),
        bottomDeleteAccessibility: {
          disabled: bottomDeleteButton.disabled,
          ariaDisabled: bottomDeleteButton.getAttribute('aria-disabled'),
          title: bottomDeleteButton.title,
          ariaLabel: bottomDeleteButton.getAttribute('aria-label'),
        },
      }
      colors.cleanup()
      geometry.cleanup()
      menuHandle.close()
      view.destroy()
      mount.remove()
      return result
    }
  `
  const result = await build({
    configFile: false,
    logLevel: 'silent',
    plugins: [{
      name: 'office-initial-node-view-probe',
      resolveId(id) {
        return id === virtualId ? resolvedVirtualId : null
      },
      load(id) {
        return id === resolvedVirtualId ? source : null
      },
    }],
    build: {
      write: false,
      minify: false,
      rollupOptions: { input: virtualId, output: { format: 'iife', name: 'OfficeInitialNodeViewProbe' } },
    },
  }) as { output: Array<{ type: string; code?: string }> }
  const chunk = result.output.find((item) => item.type === 'chunk' && item.code)
  if (!chunk?.code) throw new Error('Initial node-view browser probe did not produce JavaScript')
  return chunk.code
}

test('[slice 01.1] [slice 01.2] initial production node view maps spans and exposes bottom-span disabled action accessibly', async ({ page }) => {
  const probe = await buildInitialNodeViewProbe()
  await page.setContent('<main id="probe"></main>')
  await page.addScriptTag({ content: probe })
  const evidence = await page.evaluate(() => (
    window as typeof window & {
      __officeInitialNodeViewProbe: () => {
        physicalHeaderCells: number
        logicalColumns: number
        bakedColumns: number
        handles: number
        keylessReadback: unknown
        origins: Array<Array<{ rowIndex: number; colIndex: number }>>
        explicitAfterSpan: string
        columnWinsAfterRowspan: string
        rowWinsByRank: string
        interiorBlockedOrigin: { rowIndex: number; colIndex: number }
        interiorBlockedWidth: number
        bottomDeleteAccessibility: {
          disabled: boolean
          ariaDisabled: string | null
          title: string
          ariaLabel: string | null
        }
      }
    }
  ).__officeInitialNodeViewProbe())
  expect(evidence).toEqual({
    physicalHeaderCells: 2,
    logicalColumns: 3,
    bakedColumns: 3,
    handles: 4,
    keylessReadback: null,
    origins: [
      [{ rowIndex: 0, colIndex: 0 }, { rowIndex: 0, colIndex: 2 }],
      [{ rowIndex: 1, colIndex: 2 }],
      [{ rowIndex: 2, colIndex: 0 }, { rowIndex: 2, colIndex: 1 }, { rowIndex: 2, colIndex: 2 }],
    ],
    explicitAfterSpan: 'rgb(17, 34, 51)',
    columnWinsAfterRowspan: 'rgb(119, 136, 153)',
    rowWinsByRank: 'rgb(170, 187, 204)',
    interiorBlockedOrigin: { rowIndex: 1, colIndex: 2 },
    interiorBlockedWidth: 4,
    bottomDeleteAccessibility: {
      disabled: true,
      ariaDisabled: 'true',
      title: 'There is no adjacent row below this cell to delete.',
      ariaLabel: 'Delete Row Below: There is no adjacent row below this cell to delete.',
    },
  })
})

function readStructureMetadata(fixturePath: string) {
  const parsed = parseMarkdownFrontmatter(fs.readFileSync(fixturePath, 'utf8'))
  return {
    tables: getDocumentTableLayouts(parsed.frontmatter),
    tableColors: getDocumentTableColors(parsed.frontmatter),
  }
}

async function expectStructureSaveCount(saveCount: () => Promise<number>, expected: number) {
  await expect.poll(saveCount).toBe(expected)
}

test('[slice 01.2] insertion matrix top-target Insert Row Above places row at top index 0 in one metadata history event', async ({ page }) => {
  const files = await resetOfficePlaywrightScenario({ scenario: 'structure', variant: 'metadata', copies: 1, workspaces: 1 })
  const fixture = files.find(({ filename }: { filename: string }) => filename === 'Structure-R2-C1.md')
  expect(fixture).toBeTruthy()
  const canonical = fs.readFileSync(fixture!.path)
  const canonicalMetadata = readStructureMetadata(fixture!.path)

  try {
    const saveCount = await captureOfficeSaveMessages(page)
    const editor = await openStructureDocument(page, fixture!.filename)
    const tables = editor.locator('table.rv-office-table')
    const table = tables.first()
    const rows = table.locator('tbody > tr')
    await expect(tables).toHaveCount(1)
    await expect(rows).toHaveCount(2)
    await page.waitForTimeout(750)
    await expectStructureSaveCount(saveCount, 0)

    await rows.nth(0).locator('th').first().click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Insert Row Above' }).click()

    await expect(tables).toHaveCount(1)
    await expect(rows).toHaveCount(3)
    await expect(rows.nth(0).locator('th')).toHaveCount(1)
    await expect(rows.nth(0)).toHaveText('')
    await expect(rows.nth(1).locator('td')).toHaveCount(1)
    await expect(rows.nth(1)).toContainText('structure-r2-c1-h0')
    await expect(rows.nth(2)).toContainText('structure-r2-c1-r1c0')
    await expectStructureSaveCount(saveCount, 1)

    const forward = readStructureMetadata(fixture!.path)
    expect(forward.tables).toEqual([
      expect.objectContaining({ tableIndex: 0, columns: [80] }),
    ])
    expect(forward.tableColors).toEqual([
      expect.objectContaining({ tableIndex: 0, cells: { '2,0': '#ffeeaa' } }),
    ])
    expect(forward.tables[0]?.fingerprint).toBe(forward.tableColors[0]?.fingerprint)
    expect(forward.tables[0]?.fingerprint).not.toBe(canonicalMetadata.tables[0]?.fingerprint)

    await rows.nth(1).locator('td').click()
    await page.keyboard.press('ControlOrMeta+z')
    await expect(rows).toHaveCount(2)
    await expect(rows.nth(0).locator('th')).toHaveCount(1)
    await expect(rows.nth(0)).toContainText('structure-r2-c1-h0')
    await expectStructureSaveCount(saveCount, 2)
    expect(readStructureMetadata(fixture!.path)).toEqual(canonicalMetadata)

    await page.keyboard.press('ControlOrMeta+Shift+z')
    await expect(rows).toHaveCount(3)
    await expect(rows.nth(0)).toHaveText('')
    await expectStructureSaveCount(saveCount, 3)
    expect(readStructureMetadata(fixture!.path)).toEqual(forward)
  } finally {
    await page.close()
    const reset = await resetOfficePlaywrightScenario({ scenario: 'structure', variant: 'metadata', copies: 1, workspaces: 1 })
    const restored = reset.find(({ filename }: { filename: string }) => filename === 'Structure-R2-C1.md')
    expect(restored).toBeTruthy()
    expect(fs.readFileSync(restored!.path)).toEqual(canonical)
  }
})

const isolatedR5InsertCases = [
  {
    label: 'middle-target Insert Row Below places row at middle index 3',
    selectedRow: 2,
    action: 'Insert Row Below',
    insertedRow: 3,
    expectedRows: ['-h0', '-r1c0', '-r2c0', null, '-r3c0', '-r4c0'],
    expectedCells: { '2,2': '#ffcccc' },
    expectedRowsMetadata: { '4': { color: '#fff2cc', rank: 4 } },
  },
  {
    label: 'middle-target Insert Row Above places row at middle index 2',
    selectedRow: 2,
    action: 'Insert Row Above',
    insertedRow: 2,
    expectedRows: ['-h0', '-r1c0', null, '-r2c0', '-r3c0', '-r4c0'],
    expectedCells: { '3,2': '#ffcccc' },
    expectedRowsMetadata: { '4': { color: '#fff2cc', rank: 4 } },
  },
  {
    label: 'bottom-target Insert Row Below appends true bottom row at index 5',
    selectedRow: 4,
    action: 'Insert Row Below',
    insertedRow: 5,
    expectedRows: ['-h0', '-r1c0', '-r2c0', '-r3c0', '-r4c0', null],
    expectedCells: { '2,2': '#ffcccc' },
    expectedRowsMetadata: { '3': { color: '#fff2cc', rank: 4 } },
  },
] as const

for (const insertCase of isolatedR5InsertCases) {
  test(`[slice 01.2] insertion matrix ${insertCase.label} with one table and one metadata history event`, async ({ page }) => {
    const files = await resetOfficePlaywrightScenario({ scenario: 'structure', variant: 'metadata', copies: 1, workspaces: 1 })
    const fixture = files.find(({ filename }: { filename: string }) => filename === 'Structure-R5-C4.md')
    expect(fixture).toBeTruthy()
    const canonical = fs.readFileSync(fixture!.path)
    const canonicalMetadata = readStructureMetadata(fixture!.path)

    try {
      const saveCount = await captureOfficeSaveMessages(page)
      const editor = await openStructureDocument(page, fixture!.filename)
      const tables = editor.locator('table.rv-office-table')
      const table = tables.first()
      const rows = table.locator('tbody > tr')
      await expect(tables).toHaveCount(1)
      await expect(rows).toHaveCount(5)
      await page.waitForTimeout(750)
      await expectStructureSaveCount(saveCount, 0)

      await rows.nth(insertCase.selectedRow).locator('td').first().click({ button: 'right' })
      await page.getByRole('menuitem', { name: insertCase.action }).click()

      await expect(tables).toHaveCount(1)
      await expect(rows).toHaveCount(6)
      await expect(rows.nth(0).locator('th')).toHaveCount(4)
      for (const [index, suffix] of insertCase.expectedRows.entries()) {
        if (suffix === null) {
          await expect(rows.nth(index).locator('td')).toHaveCount(4)
          await expect(rows.nth(index)).toHaveText('')
        } else {
          await expect(rows.nth(index)).toContainText(`structure-r5-c4${suffix}`)
        }
      }
      await expectStructureSaveCount(saveCount, 1)

      const forward = readStructureMetadata(fixture!.path)
      expect(forward.tables).toEqual([
        expect.objectContaining({ tableIndex: 0, columns: [70, 90, 110, 130] }),
      ])
      expect(forward.tableColors).toEqual([
        expect.objectContaining({
          tableIndex: 0,
          cells: insertCase.expectedCells,
          rows: insertCase.expectedRowsMetadata,
          columns: { '3': { color: '#e6ccff', rank: 5 } },
        }),
      ])
      expect(forward.tables[0]?.fingerprint).toBe(forward.tableColors[0]?.fingerprint)
      expect(forward.tables[0]?.fingerprint).not.toBe(canonicalMetadata.tables[0]?.fingerprint)

      await rows.nth(insertCase.insertedRow).locator('td').first().click()
      await page.keyboard.press('ControlOrMeta+z')
      await expect(rows).toHaveCount(5)
      for (const [index, suffix] of ['-h0', '-r1c0', '-r2c0', '-r3c0', '-r4c0'].entries()) {
        await expect(rows.nth(index)).toContainText(`structure-r5-c4${suffix}`)
      }
      await expectStructureSaveCount(saveCount, 2)
      expect(readStructureMetadata(fixture!.path)).toEqual(canonicalMetadata)

      await page.keyboard.press('ControlOrMeta+Shift+z')
      await expect(rows).toHaveCount(6)
      await expect(rows.nth(insertCase.insertedRow)).toHaveText('')
      await expectStructureSaveCount(saveCount, 3)
      expect(readStructureMetadata(fixture!.path)).toEqual(forward)
    } finally {
      await page.close()
      const reset = await resetOfficePlaywrightScenario({ scenario: 'structure', variant: 'metadata', copies: 1, workspaces: 1 })
      const restored = reset.find(({ filename }: { filename: string }) => filename === 'Structure-R5-C4.md')
      expect(restored).toBeTruthy()
      expect(fs.readFileSync(restored!.path)).toEqual(canonical)
    }
  })
}

test('[slice 01.2] isolated R3 header deletion promotes the next physical row in one metadata history event', async ({ page }) => {
  const files = await resetOfficePlaywrightScenario({ scenario: 'structure', variant: 'metadata', copies: 1, workspaces: 1 })
  const fixture = files.find(({ filename }: { filename: string }) => filename === 'Structure-R3-C2.md')
  expect(fixture).toBeTruthy()
  const canonical = fs.readFileSync(fixture!.path)
  const canonicalMetadata = readStructureMetadata(fixture!.path)

  try {
    const saveCount = await captureOfficeSaveMessages(page)
    const editor = await openStructureDocument(page, fixture!.filename)
    const tables = editor.locator('table.rv-office-table')
    const table = tables.first()
    const rows = table.locator('tbody > tr')
    await expect(rows).toHaveCount(3)
    await page.waitForTimeout(750)
    await expectStructureSaveCount(saveCount, 0)

    await rows.nth(1).locator('td').first().click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Delete Row Above' }).click()

    await expect(tables).toHaveCount(1)
    await expect(rows).toHaveCount(2)
    await expect(rows.nth(0).locator('th')).toHaveCount(2)
    await expect(rows.nth(0)).toContainText('structure-r3-c2-r1c0')
    await expect(rows.nth(0)).toContainText('structure-r3-c2-r1c1')
    await expect(rows.nth(1)).toContainText('structure-r3-c2-r2c0')
    await expectStructureSaveCount(saveCount, 1)

    const forward = readStructureMetadata(fixture!.path)
    expect(forward.tables).toEqual([
      expect.objectContaining({ tableIndex: 0, columns: [90, 110] }),
    ])
    expect(forward.tableColors).toEqual([
      expect.objectContaining({
        tableIndex: 0,
        rows: { '0': { color: '#d6ebff', rank: 2 } },
        columns: { '1': { color: '#d6ffd6', rank: 3 } },
      }),
    ])
    expect(forward.tables[0]?.fingerprint).toBe(forward.tableColors[0]?.fingerprint)

    await rows.nth(0).locator('th').first().click()
    await page.keyboard.press('ControlOrMeta+z')
    await expect(rows).toHaveCount(3)
    await expect(rows.nth(0)).toContainText('structure-r3-c2-h0')
    await expectStructureSaveCount(saveCount, 2)
    expect(readStructureMetadata(fixture!.path)).toEqual(canonicalMetadata)

    await page.keyboard.press('ControlOrMeta+Shift+z')
    await expect(rows).toHaveCount(2)
    await expect(rows.nth(0)).toContainText('structure-r3-c2-r1c0')
    await expectStructureSaveCount(saveCount, 3)
    expect(readStructureMetadata(fixture!.path)).toEqual(forward)
  } finally {
    await page.close()
    const reset = await resetOfficePlaywrightScenario({ scenario: 'structure', variant: 'metadata', copies: 1, workspaces: 1 })
    const restored = reset.find(({ filename }: { filename: string }) => filename === 'Structure-R3-C2.md')
    expect(restored).toBeTruthy()
    expect(fs.readFileSync(restored!.path)).toEqual(canonical)
  }
})

const isolatedR5DeleteCases = [
  {
    label: 'middle',
    selectedRow: 3,
    action: 'Delete Row Above',
    expectedRows: ['-h0', '-r1c0', '-r3c0', '-r4c0'],
    expectedCells: undefined,
    expectedRowsMetadata: { '2': { color: '#fff2cc', rank: 4 } },
  },
  {
    label: 'bottom',
    selectedRow: 3,
    action: 'Delete Row Below',
    expectedRows: ['-h0', '-r1c0', '-r2c0', '-r3c0'],
    expectedCells: { '2,2': '#ffcccc' },
    expectedRowsMetadata: { '3': { color: '#fff2cc', rank: 4 } },
  },
] as const

for (const deleteCase of isolatedR5DeleteCases) {
  test(`[slice 01.2] isolated R5 ${deleteCase.label} adjacent delete preserves order and is one metadata history event`, async ({ page }) => {
    const files = await resetOfficePlaywrightScenario({ scenario: 'structure', variant: 'metadata', copies: 1, workspaces: 1 })
    const fixture = files.find(({ filename }: { filename: string }) => filename === 'Structure-R5-C4.md')
    expect(fixture).toBeTruthy()
    const canonical = fs.readFileSync(fixture!.path)
    const canonicalMetadata = readStructureMetadata(fixture!.path)

    try {
      const saveCount = await captureOfficeSaveMessages(page)
      const editor = await openStructureDocument(page, fixture!.filename)
      const tables = editor.locator('table.rv-office-table')
      const table = tables.first()
      const rows = table.locator('tbody > tr')
      await expect(rows).toHaveCount(5)
      await page.waitForTimeout(750)
      await expectStructureSaveCount(saveCount, 0)

      await rows.nth(deleteCase.selectedRow).locator('td').first().click({ button: 'right' })
      await page.getByRole('menuitem', { name: deleteCase.action }).click()

      await expect(tables).toHaveCount(1)
      await expect(rows).toHaveCount(4)
      for (const [index, suffix] of deleteCase.expectedRows.entries()) {
        await expect(rows.nth(index)).toContainText(`structure-r5-c4${suffix}`)
      }
      await expectStructureSaveCount(saveCount, 1)

      const forward = readStructureMetadata(fixture!.path)
      expect(forward.tables).toEqual([
        expect.objectContaining({ tableIndex: 0, columns: [70, 90, 110, 130] }),
      ])
      expect(forward.tableColors).toHaveLength(1)
      expect(forward.tableColors[0]).toEqual(expect.objectContaining({
        tableIndex: 0,
        rows: deleteCase.expectedRowsMetadata,
        columns: { '3': { color: '#e6ccff', rank: 5 } },
      }))
      expect(forward.tableColors[0]?.cells).toEqual(deleteCase.expectedCells)

      await rows.nth(1).locator('td').first().click()
      await page.keyboard.press('ControlOrMeta+z')
      await expect(rows).toHaveCount(5)
      await expect(rows.nth(2)).toContainText('structure-r5-c4-r2c0')
      await expect(rows.nth(4)).toContainText('structure-r5-c4-r4c0')
      await expectStructureSaveCount(saveCount, 2)
      expect(readStructureMetadata(fixture!.path)).toEqual(canonicalMetadata)

      await page.keyboard.press('ControlOrMeta+Shift+z')
      await expect(rows).toHaveCount(4)
      await expectStructureSaveCount(saveCount, 3)
      expect(readStructureMetadata(fixture!.path)).toEqual(forward)
    } finally {
      await page.close()
      const reset = await resetOfficePlaywrightScenario({ scenario: 'structure', variant: 'metadata', copies: 1, workspaces: 1 })
      const restored = reset.find(({ filename }: { filename: string }) => filename === 'Structure-R5-C4.md')
      expect(restored).toBeTruthy()
      expect(fs.readFileSync(restored!.path)).toEqual(canonical)
    }
  })
}

test('[slice 01.2] isolated R2 adjacent deletes are visible disabled accessible forced no-ops', async ({ page }) => {
  const files = await resetOfficePlaywrightScenario({ scenario: 'structure', variant: 'metadata', copies: 1, workspaces: 1 })
  const fixture = files.find(({ filename }: { filename: string }) => filename === 'Structure-R2-C1.md')
  expect(fixture).toBeTruthy()
  const canonical = fs.readFileSync(fixture!.path)
  const canonicalMetadata = readStructureMetadata(fixture!.path)

  try {
    const saveCount = await captureOfficeSaveMessages(page)
    const editor = await openStructureDocument(page, fixture!.filename)
    const table = editor.locator('table.rv-office-table')
    const rows = table.locator('tbody > tr')
    await expect(rows).toHaveCount(2)
    await page.waitForTimeout(750)
    await expectStructureSaveCount(saveCount, 0)
    await expect(page.locator('.rv-office-document-dirty')).toHaveCount(0)

    await rows.nth(1).locator('td').click({ button: 'right' })
    for (const label of ['Delete Row Above', 'Delete Row Below']) {
      const item = page.locator('.rv-menu-item').filter({ hasText: label })
      await expect(item).toBeVisible()
      await expect(item).toBeDisabled()
      await expect(item).toHaveAttribute('aria-disabled', 'true')
      await expect(item).toHaveAttribute('title', /schema header row.*data row/i)
      await expect(item).toHaveAttribute('aria-label', new RegExp(`${label}:.*schema header row.*data row`, 'i'))
      await item.evaluate((element) => {
        element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      })
    }

    await expect(rows).toHaveCount(2)
    await expect(rows.nth(0)).toContainText('structure-r2-c1-h0')
    await expect(rows.nth(1)).toContainText('structure-r2-c1-r1c0')
    await page.waitForTimeout(750)
    await expectStructureSaveCount(saveCount, 0)
    await expect(page.locator('.rv-office-document-dirty')).toHaveCount(0)
    expect(fs.readFileSync(fixture!.path)).toEqual(canonical)
    expect(readStructureMetadata(fixture!.path)).toEqual(canonicalMetadata)
  } finally {
    await page.close()
    const reset = await resetOfficePlaywrightScenario({ scenario: 'structure', variant: 'metadata', copies: 1, workspaces: 1 })
    const restored = reset.find(({ filename }: { filename: string }) => filename === 'Structure-R2-C1.md')
    expect(restored).toBeTruthy()
    expect(fs.readFileSync(restored!.path)).toEqual(canonical)
  }
})

test('[slice 01.2] ordinary R5 top and bottom boundary deletes are distinct accessible forced no-ops', async ({ page }) => {
  const files = await resetOfficePlaywrightScenario({ scenario: 'structure', variant: 'metadata', copies: 1, workspaces: 1 })
  const fixture = files.find(({ filename }: { filename: string }) => filename === 'Structure-R5-C4.md')
  expect(fixture).toBeTruthy()
  const canonical = fs.readFileSync(fixture!.path)
  const canonicalMetadata = readStructureMetadata(fixture!.path)

  try {
    const saveCount = await captureOfficeSaveMessages(page)
    const editor = await openStructureDocument(page, fixture!.filename)
    const tables = editor.locator('table.rv-office-table')
    const table = tables.first()
    const rows = table.locator('tbody > tr')
    await expect(tables).toHaveCount(1)
    await expect(rows).toHaveCount(5)
    await page.waitForTimeout(750)
    await expectStructureSaveCount(saveCount, 0)
    await expect(page.locator('.rv-office-document-dirty')).toHaveCount(0)

    const boundaries = [
      {
        row: 0,
        cell: 'th',
        label: 'Delete Row Above',
        reason: 'There is no adjacent row above this cell to delete.',
      },
      {
        row: 4,
        cell: 'td',
        label: 'Delete Row Below',
        reason: 'There is no adjacent row below this cell to delete.',
      },
    ] as const
    for (const boundary of boundaries) {
      await rows.nth(boundary.row).locator(boundary.cell).first().click({ button: 'right' })
      const item = page.locator('.rv-menu-item').filter({ hasText: boundary.label })
      await expect(item).toBeVisible()
      await expect(item).toBeDisabled()
      await expect(item).toHaveAttribute('aria-disabled', 'true')
      await expect(item).toHaveAttribute('title', boundary.reason)
      await expect(item).toHaveAttribute('aria-label', `${boundary.label}: ${boundary.reason}`)
      await item.evaluate((element) => {
        element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      })
    }

    await expect(tables).toHaveCount(1)
    await expect(rows).toHaveCount(5)
    for (const [index, suffix] of ['-h0', '-r1c0', '-r2c0', '-r3c0', '-r4c0'].entries()) {
      await expect(rows.nth(index)).toContainText(`structure-r5-c4${suffix}`)
    }
    await page.waitForTimeout(750)
    await expectStructureSaveCount(saveCount, 0)
    await expect(page.locator('.rv-office-document-dirty')).toHaveCount(0)
    expect(fs.readFileSync(fixture!.path)).toEqual(canonical)
    expect(readStructureMetadata(fixture!.path)).toEqual(canonicalMetadata)
  } finally {
    await page.close()
    const reset = await resetOfficePlaywrightScenario({ scenario: 'structure', variant: 'metadata', copies: 1, workspaces: 1 })
    const restored = reset.find(({ filename }: { filename: string }) => filename === 'Structure-R5-C4.md')
    expect(restored).toBeTruthy()
    expect(fs.readFileSync(restored!.path)).toEqual(canonical)
  }
})

type IsolatedColumnCase = {
  label: string
  fixture: string
  prefix: string
  rowCount: number
  initialColumnCount: number
  selectedColumn: number
  action: 'Insert Column Left' | 'Insert Column Right' | 'Delete Column Left' | 'Delete Column Right'
  expectedOrder: Array<number | null>
  expectedWidths: number[]
  expectedCells: Record<string, string> | undefined
  expectedRows: Record<string, { color: string; rank: number }> | undefined
  expectedColumns: Record<string, { color: string; rank: number }> | undefined
}

const isolatedColumnCases: IsolatedColumnCase[] = [
  {
    label: 'C1 Insert Column Left exposes the 1-to-2 transition at first index',
    fixture: 'Structure-R2-C1.md', prefix: 'structure-r2-c1', rowCount: 2, initialColumnCount: 1,
    selectedColumn: 0, action: 'Insert Column Left', expectedOrder: [null, 0],
    expectedWidths: [80, 80], expectedCells: { '1,1': '#ffeeaa' },
    expectedRows: undefined, expectedColumns: undefined,
  },
  {
    label: 'C1 Insert Column Right exposes the 1-to-2 transition at last index',
    fixture: 'Structure-R2-C1.md', prefix: 'structure-r2-c1', rowCount: 2, initialColumnCount: 1,
    selectedColumn: 0, action: 'Insert Column Right', expectedOrder: [0, null],
    expectedWidths: [80, 80], expectedCells: { '1,0': '#ffeeaa' },
    expectedRows: undefined, expectedColumns: undefined,
  },
  {
    label: 'C2 Insert Column Left at first index',
    fixture: 'Structure-R3-C2.md', prefix: 'structure-r3-c2', rowCount: 3, initialColumnCount: 2,
    selectedColumn: 0, action: 'Insert Column Left', expectedOrder: [null, 0, 1],
    expectedWidths: [90, 90, 110], expectedCells: undefined,
    expectedRows: { '1': { color: '#d6ebff', rank: 2 } },
    expectedColumns: { '2': { color: '#d6ffd6', rank: 3 } },
  },
  {
    label: 'C2 Insert Column Right at last index',
    fixture: 'Structure-R3-C2.md', prefix: 'structure-r3-c2', rowCount: 3, initialColumnCount: 2,
    selectedColumn: 1, action: 'Insert Column Right', expectedOrder: [0, 1, null],
    expectedWidths: [90, 110, 110], expectedCells: undefined,
    expectedRows: { '1': { color: '#d6ebff', rank: 2 } },
    expectedColumns: { '1': { color: '#d6ffd6', rank: 3 } },
  },
  {
    label: 'C2 Delete Column Left removes first and reaches one column',
    fixture: 'Structure-R3-C2.md', prefix: 'structure-r3-c2', rowCount: 3, initialColumnCount: 2,
    selectedColumn: 1, action: 'Delete Column Left', expectedOrder: [1],
    expectedWidths: [110], expectedCells: undefined,
    expectedRows: { '1': { color: '#d6ebff', rank: 2 } },
    expectedColumns: { '0': { color: '#d6ffd6', rank: 3 } },
  },
  {
    label: 'C2 Delete Column Right removes last and reaches one column',
    fixture: 'Structure-R3-C2.md', prefix: 'structure-r3-c2', rowCount: 3, initialColumnCount: 2,
    selectedColumn: 0, action: 'Delete Column Right', expectedOrder: [0],
    expectedWidths: [90], expectedCells: undefined,
    expectedRows: { '1': { color: '#d6ebff', rank: 2 } }, expectedColumns: undefined,
  },
  {
    label: 'C4 Insert Column Left at first index',
    fixture: 'Structure-R5-C4.md', prefix: 'structure-r5-c4', rowCount: 5, initialColumnCount: 4,
    selectedColumn: 0, action: 'Insert Column Left', expectedOrder: [null, 0, 1, 2, 3],
    expectedWidths: [70, 70, 90, 110, 130], expectedCells: { '2,3': '#ffcccc' },
    expectedRows: { '3': { color: '#fff2cc', rank: 4 } },
    expectedColumns: { '4': { color: '#e6ccff', rank: 5 } },
  },
  {
    label: 'C4 Insert Column Right at first logical position',
    fixture: 'Structure-R5-C4.md', prefix: 'structure-r5-c4', rowCount: 5, initialColumnCount: 4,
    selectedColumn: 0, action: 'Insert Column Right', expectedOrder: [0, null, 1, 2, 3],
    expectedWidths: [70, 70, 90, 110, 130], expectedCells: { '2,3': '#ffcccc' },
    expectedRows: { '3': { color: '#fff2cc', rank: 4 } },
    expectedColumns: { '4': { color: '#e6ccff', rank: 5 } },
  },
  {
    label: 'C4 Insert Column Left at middle logical position',
    fixture: 'Structure-R5-C4.md', prefix: 'structure-r5-c4', rowCount: 5, initialColumnCount: 4,
    selectedColumn: 2, action: 'Insert Column Left', expectedOrder: [0, 1, null, 2, 3],
    expectedWidths: [70, 90, 110, 110, 130], expectedCells: { '2,3': '#ffcccc' },
    expectedRows: { '3': { color: '#fff2cc', rank: 4 } },
    expectedColumns: { '4': { color: '#e6ccff', rank: 5 } },
  },
  {
    label: 'C4 Insert Column Right at middle logical position',
    fixture: 'Structure-R5-C4.md', prefix: 'structure-r5-c4', rowCount: 5, initialColumnCount: 4,
    selectedColumn: 1, action: 'Insert Column Right', expectedOrder: [0, 1, null, 2, 3],
    expectedWidths: [70, 90, 90, 110, 130], expectedCells: { '2,3': '#ffcccc' },
    expectedRows: { '3': { color: '#fff2cc', rank: 4 } },
    expectedColumns: { '4': { color: '#e6ccff', rank: 5 } },
  },
  {
    label: 'C4 Insert Column Left at last logical position',
    fixture: 'Structure-R5-C4.md', prefix: 'structure-r5-c4', rowCount: 5, initialColumnCount: 4,
    selectedColumn: 3, action: 'Insert Column Left', expectedOrder: [0, 1, 2, null, 3],
    expectedWidths: [70, 90, 110, 130, 130], expectedCells: { '2,2': '#ffcccc' },
    expectedRows: { '3': { color: '#fff2cc', rank: 4 } },
    expectedColumns: { '4': { color: '#e6ccff', rank: 5 } },
  },
  {
    label: 'C4 Insert Column Right at last index appends',
    fixture: 'Structure-R5-C4.md', prefix: 'structure-r5-c4', rowCount: 5, initialColumnCount: 4,
    selectedColumn: 3, action: 'Insert Column Right', expectedOrder: [0, 1, 2, 3, null],
    expectedWidths: [70, 90, 110, 130, 130], expectedCells: { '2,2': '#ffcccc' },
    expectedRows: { '3': { color: '#fff2cc', rank: 4 } },
    expectedColumns: { '3': { color: '#e6ccff', rank: 5 } },
  },
  {
    label: 'C4 Delete Column Left removes first index',
    fixture: 'Structure-R5-C4.md', prefix: 'structure-r5-c4', rowCount: 5, initialColumnCount: 4,
    selectedColumn: 1, action: 'Delete Column Left', expectedOrder: [1, 2, 3],
    expectedWidths: [90, 110, 130], expectedCells: { '2,1': '#ffcccc' },
    expectedRows: { '3': { color: '#fff2cc', rank: 4 } },
    expectedColumns: { '2': { color: '#e6ccff', rank: 5 } },
  },
  {
    label: 'C4 Delete Column Left removes middle index',
    fixture: 'Structure-R5-C4.md', prefix: 'structure-r5-c4', rowCount: 5, initialColumnCount: 4,
    selectedColumn: 2, action: 'Delete Column Left', expectedOrder: [0, 2, 3],
    expectedWidths: [70, 110, 130], expectedCells: { '2,1': '#ffcccc' },
    expectedRows: { '3': { color: '#fff2cc', rank: 4 } },
    expectedColumns: { '2': { color: '#e6ccff', rank: 5 } },
  },
  {
    label: 'C4 Delete Column Right removes middle color-cell index',
    fixture: 'Structure-R5-C4.md', prefix: 'structure-r5-c4', rowCount: 5, initialColumnCount: 4,
    selectedColumn: 1, action: 'Delete Column Right', expectedOrder: [0, 1, 3],
    expectedWidths: [70, 90, 130], expectedCells: undefined,
    expectedRows: { '3': { color: '#fff2cc', rank: 4 } },
    expectedColumns: { '2': { color: '#e6ccff', rank: 5 } },
  },
  {
    label: 'C4 Delete Column Right removes last color-column index',
    fixture: 'Structure-R5-C4.md', prefix: 'structure-r5-c4', rowCount: 5, initialColumnCount: 4,
    selectedColumn: 2, action: 'Delete Column Right', expectedOrder: [0, 1, 2],
    expectedWidths: [70, 90, 110], expectedCells: { '2,2': '#ffcccc' },
    expectedRows: { '3': { color: '#fff2cc', rank: 4 } }, expectedColumns: undefined,
  },
]

function expectedStructureColumnMatrix(
  prefix: string,
  rowCount: number,
  columnOrder: Array<number | null>,
) {
  return Array.from({ length: rowCount }, (_, rowIndex) => columnOrder.map((columnIndex) => {
    if (columnIndex === null) return ''
    return rowIndex === 0
      ? `${prefix}-h${columnIndex}`
      : `${prefix}-r${rowIndex}c${columnIndex}`
  }))
}

async function readVisibleStructureTableMatrix(page: Page) {
  return page.locator('table.rv-office-table tbody > tr').evaluateAll((rows) => rows.map((row) => (
    Array.from((row as HTMLTableRowElement).cells).map((cell) => cell.textContent?.trim() ?? '')
  )))
}

for (const columnCase of isolatedColumnCases) {
  test(`[slice 01.3] isolated column matrix ${columnCase.label} is one exact metadata history event`, async ({ page }) => {
    const files = await resetOfficePlaywrightScenario({ scenario: 'structure', variant: 'metadata', copies: 1, workspaces: 1 })
    const fixture = files.find(({ filename }: { filename: string }) => filename === columnCase.fixture)
    expect(fixture).toBeTruthy()
    const canonical = fs.readFileSync(fixture!.path)
    const canonicalMetadata = readStructureMetadata(fixture!.path)
    const canonicalOrder = Array.from({ length: columnCase.initialColumnCount }, (_, index) => index)

    try {
      const saveCount = await captureOfficeSaveMessages(page)
      const editor = await openStructureDocument(page, fixture!.filename)
      const tables = editor.locator('table.rv-office-table')
      const table = tables.first()
      const rows = table.locator('tbody > tr')
      await expect(tables).toHaveCount(1)
      await expect(rows).toHaveCount(columnCase.rowCount)
      await expect(table.locator('colgroup > col')).toHaveCount(columnCase.initialColumnCount)
      expect(await readVisibleStructureTableMatrix(page)).toEqual(expectedStructureColumnMatrix(
        columnCase.prefix, columnCase.rowCount, canonicalOrder,
      ))
      await page.waitForTimeout(750)
      await expectStructureSaveCount(saveCount, 0)

      await rows.nth(1).locator('td').nth(columnCase.selectedColumn).click({ button: 'right' })
      await page.getByRole('menuitem', { name: columnCase.action }).click()

      await expect(tables).toHaveCount(1)
      await expect(rows).toHaveCount(columnCase.rowCount)
      await expect(table.locator('colgroup > col')).toHaveCount(columnCase.expectedOrder.length)
      await expect(rows.nth(0).locator('th')).toHaveCount(columnCase.expectedOrder.length)
      for (let rowIndex = 1; rowIndex < columnCase.rowCount; rowIndex += 1) {
        await expect(rows.nth(rowIndex).locator('td')).toHaveCount(columnCase.expectedOrder.length)
      }
      expect(await readVisibleStructureTableMatrix(page)).toEqual(expectedStructureColumnMatrix(
        columnCase.prefix, columnCase.rowCount, columnCase.expectedOrder,
      ))
      await expectStructureSaveCount(saveCount, 1)

      const forward = readStructureMetadata(fixture!.path)
      expect(forward.tables).toHaveLength(1)
      expect(forward.tables[0]).toEqual(expect.objectContaining({
        tableIndex: 0, columns: columnCase.expectedWidths,
      }))
      expect(forward.tableColors).toHaveLength(1)
      expect(forward.tableColors[0]?.cells).toEqual(columnCase.expectedCells)
      expect(forward.tableColors[0]?.rows).toEqual(columnCase.expectedRows)
      expect(forward.tableColors[0]?.columns).toEqual(columnCase.expectedColumns)
      expect(forward.tables[0]?.fingerprint).toBe(forward.tableColors[0]?.fingerprint)
      expect(forward.tables[0]?.fingerprint).not.toBe(canonicalMetadata.tables[0]?.fingerprint)

      await editor.focus()
      await page.keyboard.press('ControlOrMeta+z')
      await expect(table.locator('colgroup > col')).toHaveCount(columnCase.initialColumnCount)
      expect(await readVisibleStructureTableMatrix(page)).toEqual(expectedStructureColumnMatrix(
        columnCase.prefix, columnCase.rowCount, canonicalOrder,
      ))
      await expectStructureSaveCount(saveCount, 2)
      expect(readStructureMetadata(fixture!.path)).toEqual(canonicalMetadata)

      await page.keyboard.press('ControlOrMeta+Shift+z')
      await expect(table.locator('colgroup > col')).toHaveCount(columnCase.expectedOrder.length)
      expect(await readVisibleStructureTableMatrix(page)).toEqual(expectedStructureColumnMatrix(
        columnCase.prefix, columnCase.rowCount, columnCase.expectedOrder,
      ))
      await expectStructureSaveCount(saveCount, 3)
      expect(readStructureMetadata(fixture!.path)).toEqual(forward)
    } finally {
      await page.close()
      const reset = await resetOfficePlaywrightScenario({ scenario: 'structure', variant: 'metadata', copies: 1, workspaces: 1 })
      const restored = reset.find(({ filename }: { filename: string }) => filename === columnCase.fixture)
      expect(restored).toBeTruthy()
      expect(fs.readFileSync(restored!.path)).toEqual(canonical)
    }
  })
}

test('[slice 01.3] one-column deletes stay visible disabled accessible and forced clicks are exact no-ops while insert icons match', async ({ page }) => {
  const files = await resetOfficePlaywrightScenario({ scenario: 'structure', variant: 'metadata', copies: 1, workspaces: 1 })
  const fixture = files.find(({ filename }: { filename: string }) => filename === 'Structure-R2-C1.md')
  expect(fixture).toBeTruthy()
  const canonical = fs.readFileSync(fixture!.path)
  const canonicalMetadata = readStructureMetadata(fixture!.path)

  try {
    const saveCount = await captureOfficeSaveMessages(page)
    const editor = await openStructureDocument(page, fixture!.filename)
    const table = editor.locator('table.rv-office-table')
    await page.waitForTimeout(750)
    await expectStructureSaveCount(saveCount, 0)
    await expect(page.locator('.rv-office-document-dirty')).toHaveCount(0)

    await table.locator('tbody > tr').nth(1).locator('td').click({ button: 'right' })
    for (const label of [
      'Insert Row Above', 'Insert Row Below', 'Insert Column Left', 'Insert Column Right',
    ]) {
      const item = page.locator('.rv-menu-item').filter({ hasText: label })
      await expect(item).toBeVisible()
      await expect(item.locator('.material-symbols-outlined')).toHaveText('add')
    }
    const reason = 'A table must keep at least one column.'
    for (const label of ['Delete Column Left', 'Delete Column Right']) {
      const item = page.locator('.rv-menu-item').filter({ hasText: label })
      await expect(item).toBeVisible()
      await expect(item).toBeDisabled()
      await expect(item).toHaveAttribute('aria-disabled', 'true')
      await expect(item).toHaveAttribute('title', reason)
      await expect(item).toHaveAttribute('aria-label', `${label}: ${reason}`)
      await item.evaluate((element) => {
        element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      })
    }

    await expect(editor.locator('table.rv-office-table')).toHaveCount(1)
    await expect(table.locator('colgroup > col')).toHaveCount(1)
    expect(await readVisibleStructureTableMatrix(page)).toEqual([
      ['structure-r2-c1-h0'],
      ['structure-r2-c1-r1c0'],
    ])
    await page.waitForTimeout(750)
    await expectStructureSaveCount(saveCount, 0)
    await expect(page.locator('.rv-office-document-dirty')).toHaveCount(0)
    expect(fs.readFileSync(fixture!.path)).toEqual(canonical)
    expect(readStructureMetadata(fixture!.path)).toEqual(canonicalMetadata)
  } finally {
    await page.close()
    const reset = await resetOfficePlaywrightScenario({ scenario: 'structure', variant: 'metadata', copies: 1, workspaces: 1 })
    const restored = reset.find(({ filename }: { filename: string }) => filename === 'Structure-R2-C1.md')
    expect(restored).toBeTruthy()
    expect(fs.readFileSync(restored!.path)).toEqual(canonical)
  }
})

for (const cumulativePass of [1, 2]) {
  test(`[slice 01.4] cumulative mixed structure save close reopen pass ${cumulativePass} is exact`, async ({ page }) => {
    const files = await resetOfficePlaywrightScenario({ scenario: 'structure', variant: 'metadata', copies: 1, workspaces: 1 })
    const fixture = files.find(({ filename }: { filename: string }) => filename === 'Structure-R2-C1.md')
    expect(fixture).toBeTruthy()
    const canonical = fs.readFileSync(fixture!.path)
    const canonicalSettings = parseDocumentSettings(canonical.toString())
    const canonicalMetadata = readStructureMetadata(fixture!.path)
    const canonicalMatrix = [
      ['structure-r2-c1-h0'],
      ['structure-r2-c1-r1c0'],
    ]

    try {
      const saveCount = await captureOfficeSaveMessages(page)
      const editor = await openStructureDocument(page, fixture!.filename)
      const tables = editor.locator('table.rv-office-table')
      const table = tables.first()
      const rows = table.locator('tbody > tr')
      await expect(tables).toHaveCount(1)
      await expect(rows).toHaveCount(2)
      await expect(table.locator('colgroup > col')).toHaveCount(1)
      expect(await readVisibleStructureTableMatrix(page)).toEqual(canonicalMatrix)
      await page.waitForTimeout(750)
      await expectStructureSaveCount(saveCount, 0)
      await expect(page.locator('.rv-office-document-dirty')).toHaveCount(0)

      await rows.nth(1).locator('td').click({ button: 'right' })
      for (const label of [
        'Delete Row Above', 'Delete Row Below', 'Delete Column Left', 'Delete Column Right',
      ]) {
        const item = page.locator('.rv-menu-item').filter({ hasText: label })
        await expect(item).toBeVisible()
        await expect(item).toBeDisabled()
        await expect(item).toHaveAttribute('aria-disabled', 'true')
        await item.evaluate((element) => {
          element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
        })
      }
      await expect(tables).toHaveCount(1)
      expect(await readVisibleStructureTableMatrix(page)).toEqual(canonicalMatrix)
      await page.waitForTimeout(750)
      await expectStructureSaveCount(saveCount, 0)
      await expect(page.locator('.rv-office-document-dirty')).toHaveCount(0)
      expect(fs.readFileSync(fixture!.path)).toEqual(canonical)
      expect(readStructureMetadata(fixture!.path)).toEqual(canonicalMetadata)

      await rows.nth(0).locator('th').click({ button: 'right' })
      await page.getByRole('menuitem', { name: 'Insert Row Above' }).click()
      await expect(tables).toHaveCount(1)
      await expect(rows).toHaveCount(3)
      expect(await readVisibleStructureTableMatrix(page)).toEqual([
        [''],
        ['structure-r2-c1-h0'],
        ['structure-r2-c1-r1c0'],
      ])
      await expectStructureSaveCount(saveCount, 1)
      const topInserted = readStructureMetadata(fixture!.path)
      expect(topInserted.tables).toEqual([
        expect.objectContaining({ tableIndex: 0, columns: [80] }),
      ])
      expect(topInserted.tableColors).toEqual([
        expect.objectContaining({ tableIndex: 0, cells: { '2,0': '#ffeeaa' } }),
      ])
      expect(topInserted.tables[0]?.fingerprint).toBe(topInserted.tableColors[0]?.fingerprint)
      expect(topInserted.tables[0]?.fingerprint).not.toBe(canonicalMetadata.tables[0]?.fingerprint)

      await rows.nth(1).locator('td').click()
      await page.keyboard.press('ControlOrMeta+z')
      await expect(rows).toHaveCount(2)
      expect(await readVisibleStructureTableMatrix(page)).toEqual(canonicalMatrix)
      await expectStructureSaveCount(saveCount, 2)
      expect(readStructureMetadata(fixture!.path)).toEqual(canonicalMetadata)

      await page.keyboard.press('ControlOrMeta+Shift+z')
      await expect(rows).toHaveCount(3)
      expect(await readVisibleStructureTableMatrix(page)).toEqual([
        [''],
        ['structure-r2-c1-h0'],
        ['structure-r2-c1-r1c0'],
      ])
      await expectStructureSaveCount(saveCount, 3)
      expect(readStructureMetadata(fixture!.path)).toEqual(topInserted)

      await rows.nth(1).locator('td').click({ button: 'right' })
      await page.getByRole('menuitem', { name: 'Delete Row Above' }).click()
      await expect(tables).toHaveCount(1)
      await expect(rows).toHaveCount(2)
      await expect(rows.nth(0).locator('th')).toHaveCount(1)
      expect(await readVisibleStructureTableMatrix(page)).toEqual(canonicalMatrix)
      await expectStructureSaveCount(saveCount, 4)
      const promoted = readStructureMetadata(fixture!.path)
      expect(promoted.tables).toEqual([
        expect.objectContaining({ tableIndex: 0, columns: [80] }),
      ])
      expect(promoted.tableColors).toEqual([
        expect.objectContaining({ tableIndex: 0, cells: { '1,0': '#ffeeaa' } }),
      ])
      expect(promoted.tables[0]?.fingerprint).toBe(promoted.tableColors[0]?.fingerprint)

      await rows.nth(0).locator('th').click()
      await page.keyboard.press('ControlOrMeta+z')
      await expect(rows).toHaveCount(3)
      await expect(rows.nth(0).locator('th')).toHaveText('')
      await expectStructureSaveCount(saveCount, 5)
      expect(readStructureMetadata(fixture!.path)).toEqual(topInserted)

      await page.keyboard.press('ControlOrMeta+Shift+z')
      await expect(rows).toHaveCount(2)
      expect(await readVisibleStructureTableMatrix(page)).toEqual(canonicalMatrix)
      await expectStructureSaveCount(saveCount, 6)
      expect(readStructureMetadata(fixture!.path)).toEqual(promoted)

      await rows.nth(1).locator('td').click({ button: 'right' })
      await page.getByRole('menuitem', { name: 'Insert Column Right' }).click()
      await expect(tables).toHaveCount(1)
      await expect(table.locator('colgroup > col')).toHaveCount(2)
      expect(await readVisibleStructureTableMatrix(page)).toEqual([
        ['structure-r2-c1-h0', ''],
        ['structure-r2-c1-r1c0', ''],
      ])
      await expectStructureSaveCount(saveCount, 7)
      const twoColumns = readStructureMetadata(fixture!.path)
      expect(twoColumns.tables).toEqual([
        expect.objectContaining({ tableIndex: 0, columns: [80, 80] }),
      ])
      expect(twoColumns.tableColors).toEqual([
        expect.objectContaining({ tableIndex: 0, cells: { '1,0': '#ffeeaa' } }),
      ])
      expect(twoColumns.tables[0]?.fingerprint).toBe(twoColumns.tableColors[0]?.fingerprint)
      expect(twoColumns.tables[0]?.fingerprint).not.toBe(promoted.tables[0]?.fingerprint)

      await table.locator('tbody > tr').nth(1).locator('td').first().click()
      await page.keyboard.press('ControlOrMeta+z')
      await expect(table.locator('colgroup > col')).toHaveCount(1)
      expect(await readVisibleStructureTableMatrix(page)).toEqual(canonicalMatrix)
      await expectStructureSaveCount(saveCount, 8)
      expect(readStructureMetadata(fixture!.path)).toEqual(promoted)

      await page.keyboard.press('ControlOrMeta+Shift+z')
      await expect(table.locator('colgroup > col')).toHaveCount(2)
      expect(await readVisibleStructureTableMatrix(page)).toEqual([
        ['structure-r2-c1-h0', ''],
        ['structure-r2-c1-r1c0', ''],
      ])
      await expectStructureSaveCount(saveCount, 9)
      expect(readStructureMetadata(fixture!.path)).toEqual(twoColumns)

      await table.locator('tbody > tr').nth(1).locator('td').first().click({ button: 'right' })
      await page.getByRole('menuitem', { name: 'Delete Column Right' }).click()
      await expect(tables).toHaveCount(1)
      await expect(table.locator('colgroup > col')).toHaveCount(1)
      expect(await readVisibleStructureTableMatrix(page)).toEqual(canonicalMatrix)
      await expectStructureSaveCount(saveCount, 10)
      const finalMetadata = readStructureMetadata(fixture!.path)
      expect(finalMetadata.tables).toEqual([
        expect.objectContaining({ tableIndex: 0, columns: [80] }),
      ])
      expect(finalMetadata.tableColors).toEqual([
        expect.objectContaining({ tableIndex: 0, cells: { '1,0': '#ffeeaa' } }),
      ])
      expect(finalMetadata.tables[0]?.fingerprint).toBe(finalMetadata.tableColors[0]?.fingerprint)

      await rows.nth(1).locator('td').click()
      await page.keyboard.press('ControlOrMeta+z')
      await expect(table.locator('colgroup > col')).toHaveCount(2)
      await expectStructureSaveCount(saveCount, 11)
      expect(readStructureMetadata(fixture!.path)).toEqual(twoColumns)

      await page.keyboard.press('ControlOrMeta+Shift+z')
      await expect(table.locator('colgroup > col')).toHaveCount(1)
      expect(await readVisibleStructureTableMatrix(page)).toEqual(canonicalMatrix)
      await expectStructureSaveCount(saveCount, 12)
      expect(readStructureMetadata(fixture!.path)).toEqual(finalMetadata)

      const finalBytes = fs.readFileSync(fixture!.path)
      await rows.nth(1).locator('td').click({ button: 'right' })
      for (const label of ['Delete Column Left', 'Delete Column Right']) {
        const item = page.locator('.rv-menu-item').filter({ hasText: label })
        await expect(item).toBeDisabled()
        await item.evaluate((element) => {
          element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
        })
      }
      await page.waitForTimeout(750)
      await expectStructureSaveCount(saveCount, 12)
      await expect(page.locator('.rv-office-document-dirty')).toHaveCount(0)
      expect(fs.readFileSync(fixture!.path)).toEqual(finalBytes)
      expect(readStructureMetadata(fixture!.path)).toEqual(finalMetadata)

      const persisted = parseDocumentSettings(finalBytes.toString())
      const expectedSerializedBody = canonicalSettings.body.replace(
        '| structure-r2-c1-h0 |\n| --- |',
        '| structure-r2-c1-h0   |\n| -------------------- |',
      )
      expect(persisted.body).toBe(expectedSerializedBody)
      expect(persisted.body.match(/^\| -------------------- \|$/gm) ?? []).toHaveLength(1)
      expect(persisted.body.match(/^\| structure-r2-c1-h0 {3}\|$/gm) ?? []).toHaveLength(1)
      expect(persisted.body.match(/^\| structure-r2-c1-r1c0 \|$/gm) ?? []).toHaveLength(1)
      const persistedMetadata = persisted.frontmatter.metadata as Record<string, unknown>
      expect(persistedMetadata.preserveUnknown).toBe('keep-me')
      expect(Object.hasOwn(persistedMetadata, 'tableStyles')).toBe(false)
      expect(readStructureMetadata(fixture!.path)).toEqual(finalMetadata)

      await page.getByTitle('Back', { exact: true }).click()
      await expect(editor).not.toBeVisible()
      const document = page.getByTitle(fixture!.filename, { exact: true })
      await expect(document).toBeVisible()
      await document.click()
      const reopened = page.locator('.rv-office-document-editor .milkdown .ProseMirror[contenteditable="true"]')
      await expect(reopened).toBeVisible()
      const reopenedTables = reopened.locator('table.rv-office-table')
      const reopenedTable = reopenedTables.first()
      await expect(reopenedTables).toHaveCount(1)
      await expect(reopenedTable.locator('tbody > tr')).toHaveCount(2)
      await expect(reopenedTable.locator('colgroup > col')).toHaveCount(1)
      expect(await readVisibleStructureTableMatrix(page)).toEqual(canonicalMatrix)
      expect(await reopenedTable.locator('colgroup > col').evaluateAll((columns) => (
        columns.map((column) => Number.parseFloat((column as HTMLElement).style.width))
      ))).toEqual([80])
      await expect.poll(() => reopenedTable.locator('tbody > tr').nth(1).locator('td').evaluate(
        (cell) => getComputedStyle(cell).backgroundColor,
      )).toBe('rgb(255, 238, 170)')
      expect(readStructureMetadata(fixture!.path)).toEqual(finalMetadata)
      await page.waitForTimeout(750)
      await expectStructureSaveCount(saveCount, 12)
      await expect(page.locator('.rv-office-document-dirty')).toHaveCount(0)
      expect(fs.readFileSync(fixture!.path)).toEqual(finalBytes)
    } finally {
      await page.close()
      const reset = await resetOfficePlaywrightScenario({ scenario: 'structure', variant: 'metadata', copies: 1, workspaces: 1 })
      const restored = reset.find(({ filename }: { filename: string }) => filename === 'Structure-R2-C1.md')
      expect(restored).toBeTruthy()
      expect(fs.readFileSync(restored!.path)).toEqual(canonical)
    }
  })
}

test('[slice 01.1] isolated browser publishes structure and metadata in one history event', async ({ page }) => {
  const files = await resetOfficePlaywrightScenario({ scenario: 'structure', variant: 'metadata', copies: 1, workspaces: 1 })
  const fixture = files.find(({ filename }: { filename: string }) => filename === 'Structure-R3-C2.md')
  expect(fixture).toBeTruthy()
  const canonical = fs.readFileSync(fixture!.path)

  try {
    await page.addInitScript(() => {
      const originalSend = WebSocket.prototype.send
      ;(window as typeof window & { __officeSentMessages?: unknown[] }).__officeSentMessages = []
      WebSocket.prototype.send = function captureOfficeSend(data) {
        if (typeof data === 'string') {
          try {
            ;(window as typeof window & { __officeSentMessages?: unknown[] }).__officeSentMessages?.push(JSON.parse(data))
          } catch {
            // Preserve non-JSON socket traffic without changing application behavior.
          }
        }
        return originalSend.call(this, data)
      }
    })
    const editor = await openStructureDocument(page, fixture!.filename)
    const table = editor.locator('table.rv-office-table')
    await expect(table.locator('tbody > tr')).toHaveCount(3)
    await page.waitForTimeout(750)
    expect(await page.evaluate(() => (
      (window as typeof window & { __officeSentMessages?: Array<{ type?: string }> }).__officeSentMessages
        ?.filter(({ type }) => type === 'file_save').length ?? 0
    ))).toBe(0)
    await table.evaluate((element) => {
      const observed = window as typeof window & { __officeFirstStructureFrame?: unknown }
      const observer = new MutationObserver(() => {
        if (element.rows.length !== 4 || observed.__officeFirstStructureFrame) return
        const rows = Array.from(element.rows)
        observed.__officeFirstStructureFrame = {
          inserted: rows[1]?.textContent?.trim() ?? null,
          shifted: rows[2]?.textContent ?? '',
          shiftedColor: rows[2]?.cells[0] ? getComputedStyle(rows[2].cells[0]).backgroundColor : '',
          widths: Array.from(element.querySelectorAll('col')).map((col) => (col as HTMLElement).style.width),
        }
        observer.disconnect()
      })
      observer.observe(element, { childList: true, subtree: true })
    })
    const targetCell = table.locator('tbody > tr').nth(1).locator('td, th').first()
    await targetCell.click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Insert Row Above' }).click()

    await expect(table.locator('tbody > tr')).toHaveCount(4)
    const firstFrame = await page.evaluate(() => (
      window as typeof window & { __officeFirstStructureFrame?: {
        inserted: string | null
        shifted: string
        shiftedColor: string
        widths: string[]
      } }
    ).__officeFirstStructureFrame)
    expect(firstFrame).toBeTruthy()
    expect(firstFrame!.inserted).toBe('')
    expect(firstFrame!.shifted).toContain('structure-r3-c2-r1c0')
    expect(firstFrame!.shiftedColor).toBe('rgb(214, 235, 255)')
    expect(firstFrame!.widths).toEqual(['90px', '110px'])

    await expect.poll(() => page.evaluate(() => (
      (window as typeof window & { __officeSentMessages?: Array<{ type?: string }> }).__officeSentMessages
        ?.filter(({ type }) => type === 'file_save').length ?? 0
    ))).toBe(1)
    const forward = parseMarkdownFrontmatter(fs.readFileSync(fixture!.path, 'utf8'))
    expect(getDocumentTableLayouts(forward.frontmatter)).toEqual([
      expect.objectContaining({ tableIndex: 0, columns: [90, 110] }),
    ])
    expect(getDocumentTableColors(forward.frontmatter)).toEqual([
      expect.objectContaining({
        tableIndex: 0,
        rows: { '2': { color: '#d6ebff', rank: 2 } },
        columns: { '1': { color: '#d6ffd6', rank: 3 } },
      }),
    ])

    await table.locator('tbody > tr').nth(2).locator('td, th').first().click()
    await page.keyboard.press('ControlOrMeta+z')
    await expect(table.locator('tbody > tr')).toHaveCount(3)
    await expect(table.locator('tbody > tr').nth(1)).toContainText('structure-r3-c2-r1c0')
    await expect.poll(() => page.evaluate(() => (
      (window as typeof window & { __officeSentMessages?: Array<{ type?: string }> }).__officeSentMessages
        ?.filter(({ type }) => type === 'file_save').length ?? 0
    ))).toBe(2)
    const undone = parseMarkdownFrontmatter(fs.readFileSync(fixture!.path, 'utf8'))
    expect(getDocumentTableLayouts(undone.frontmatter)).toEqual([
      expect.objectContaining({ tableIndex: 0, columns: [90, 110] }),
    ])
    expect(getDocumentTableColors(undone.frontmatter)).toEqual([
      expect.objectContaining({
        tableIndex: 0,
        rows: { '1': { color: '#d6ebff', rank: 2 } },
        columns: { '1': { color: '#d6ffd6', rank: 3 } },
      }),
    ])
    await page.keyboard.press('ControlOrMeta+Shift+z')
    await expect(table.locator('tbody > tr')).toHaveCount(4)
    await expect.poll(() => page.evaluate(() => (
      (window as typeof window & { __officeSentMessages?: Array<{ type?: string }> }).__officeSentMessages
        ?.filter(({ type }) => type === 'file_save').length ?? 0
    ))).toBe(3)
    const redone = parseMarkdownFrontmatter(fs.readFileSync(fixture!.path, 'utf8'))
    expect(getDocumentTableColors(redone.frontmatter)).toEqual([
      expect.objectContaining({ rows: { '2': { color: '#d6ebff', rank: 2 } } }),
    ])
  } finally {
    await page.close()
    const reset = await resetOfficePlaywrightScenario({ scenario: 'structure', variant: 'metadata', copies: 1, workspaces: 1 })
    const restored = reset.find(({ filename }: { filename: string }) => filename === 'Structure-R3-C2.md')
    expect(restored).toBeTruthy()
    expect(fs.readFileSync(restored!.path)).toEqual(canonical)
  }
})

test('[slice 03.4] finite sub-min anchor clamps before exact-index insert delete undo redo and reopen', async ({ page }) => {
  test.setTimeout(120_000)
  const files = await resetOfficePlaywrightScenario({
    scenario: 'structure', variant: 'metadata', copies: 1, workspaces: 1,
  })
  const fixture = files.find(({ filename }: { filename: string }) => filename === 'Structure-R3-C2.md')
  expect(fixture).toBeTruthy()
  const canonical = fs.readFileSync(fixture!.path)
  const seededTables = [{
    tableIndex: 0,
    fingerprint: 'fixture-structure-r3-c2',
    columns: [10, 120],
    opaque: { exact: ['preserve', 7] },
  }]
  const seededColors = [{
    tableIndex: 0,
    fingerprint: 'fixture-structure-r3-c2',
    future: { exact: 'preserve' },
  }]
  writeStructureFixtureMetadata(fixture!.path, canonical, seededTables, seededColors)
  const seededBytes = fs.readFileSync(fixture!.path)
  const saveCount = await captureOfficeSaveMessages(page)

  try {
    const editor = await openStructureDocument(page, fixture!.filename)
    const table = editor.locator('table.rv-office-table')
    const readWidths = () => table.locator(':scope > colgroup > col').evaluateAll((columns) => (
      columns.map((column) => Number.parseFloat((column as HTMLElement).style.width))
    ))
    const minimum = await table.evaluate((element) => Number.parseFloat(
      (element as HTMLElement).style.getPropertyValue('--rv-office-table-cell-min-width'),
    ))
    expect(Number.isFinite(minimum)).toBe(true)
    expect(minimum).toBeGreaterThan(10)
    await expect.poll(readWidths).toEqual([minimum, 120])
    await page.waitForTimeout(750)
    expect(await saveCount()).toBe(0)
    expect(fs.readFileSync(fixture!.path)).toEqual(seededBytes)

    await table.locator('tbody > tr').nth(1).locator('td, th').first().click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Insert Column Right' }).click()
    await expect(table.locator('tbody > tr').first().locator('th, td')).toHaveCount(3)
    await expect.poll(saveCount).toBe(1)
    const insertedWidths = [minimum, minimum, 120]
    await expect.poll(readWidths).toEqual(insertedWidths)
    const inserted = parseMarkdownFrontmatter(fs.readFileSync(fixture!.path, 'utf8')).frontmatter
    expect(getDocumentTableLayouts(inserted)).toEqual([expect.objectContaining({
      columns: insertedWidths,
      opaque: { exact: ['preserve', 7] },
    })])
    expect(insertedWidths.reduce((sum, width) => sum + width, 0)).toBe((2 * minimum) + 120)
    expect((inserted.metadata as Record<string, unknown>).rawCollectionSibling)
      .toEqual({ exact: ['preserve', 7] })
    expect(getDocumentTableColors(inserted)).toEqual([
      expect.objectContaining({ future: { exact: 'preserve' } }),
    ])

    await table.locator('td').first().click()
    await page.keyboard.press('ControlOrMeta+z')
    await expect(table.locator('tbody > tr').first().locator('th, td')).toHaveCount(2)
    await expect.poll(saveCount).toBe(2)
    expect(getDocumentTableLayouts(parseMarkdownFrontmatter(
      fs.readFileSync(fixture!.path, 'utf8'),
    ).frontmatter)).toEqual(seededTables)
    await expect.poll(readWidths).toEqual([minimum, 120])

    await table.locator('td').first().click()
    await page.keyboard.press('ControlOrMeta+Shift+z')
    await expect(table.locator('tbody > tr').first().locator('th, td')).toHaveCount(3)
    await expect.poll(saveCount).toBe(3)
    await expect.poll(readWidths).toEqual(insertedWidths)
    expect(getDocumentTableLayouts(parseMarkdownFrontmatter(
      fs.readFileSync(fixture!.path, 'utf8'),
    ).frontmatter)[0]?.columns).toEqual(insertedWidths)

    await table.locator('td').first().click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Delete Column Right' }).click()
    await expect(table.locator('tbody > tr').first().locator('th, td')).toHaveCount(2)
    await expect.poll(saveCount).toBe(4)
    const deletedWidths = [minimum, 120]
    await expect.poll(readWidths).toEqual(deletedWidths)
    expect(getDocumentTableLayouts(parseMarkdownFrontmatter(
      fs.readFileSync(fixture!.path, 'utf8'),
    ).frontmatter)[0]?.columns).toEqual(deletedWidths)

    await table.locator('td').first().click()
    await page.keyboard.press('ControlOrMeta+z')
    await expect(table.locator('tbody > tr').first().locator('th, td')).toHaveCount(3)
    await expect.poll(saveCount).toBe(5)
    await expect.poll(readWidths).toEqual(insertedWidths)
    expect(getDocumentTableLayouts(parseMarkdownFrontmatter(
      fs.readFileSync(fixture!.path, 'utf8'),
    ).frontmatter)[0]?.columns).toEqual(insertedWidths)

    await table.locator('td').first().click()
    await page.keyboard.press('ControlOrMeta+Shift+z')
    await expect(table.locator('tbody > tr').first().locator('th, td')).toHaveCount(2)
    await expect.poll(saveCount).toBe(6)
    await expect.poll(readWidths).toEqual(deletedWidths)
    expect(getDocumentTableLayouts(parseMarkdownFrontmatter(
      fs.readFileSync(fixture!.path, 'utf8'),
    ).frontmatter)[0]?.columns).toEqual(deletedWidths)

    await page.reload()
    const reopenedTable = page.locator(
      '.rv-office-document-editor .milkdown .ProseMirror[contenteditable="true"] table.rv-office-table',
    ).first()
    await expect(reopenedTable).toBeVisible()
    await expect.poll(() => reopenedTable.locator(':scope > colgroup > col').evaluateAll((columns) => (
      columns.map((column) => Number.parseFloat((column as HTMLElement).style.width))
    ))).toEqual(deletedWidths)
    expect(getDocumentTableLayouts(parseMarkdownFrontmatter(
      fs.readFileSync(fixture!.path, 'utf8'),
    ).frontmatter)[0]?.columns).toEqual(deletedWidths)
  } finally {
    await page.close()
    const reset = await resetOfficePlaywrightScenario({
      scenario: 'structure', variant: 'metadata', copies: 1, workspaces: 1,
    })
    const restored = reset.find(({ filename }: { filename: string }) => filename === 'Structure-R3-C2.md')
    expect(restored).toBeTruthy()
    expect(fs.readFileSync(restored!.path)).toEqual(canonical)
  }
})

test('[slice 01.1] partial persisted widths stay complete through column insert undo and redo', async ({ page }) => {
  const files = await resetOfficePlaywrightScenario({ scenario: 'structure', variant: 'partial-widths', copies: 1, workspaces: 1 })
  const fixture = files.find(({ filename }: { filename: string }) => filename === 'Structure-R3-C2.md')
  expect(fixture).toBeTruthy()
  const canonical = fs.readFileSync(fixture!.path)

  try {
    await page.addInitScript(() => {
      const originalSend = WebSocket.prototype.send
      ;(window as typeof window & { __officeSentMessages?: unknown[] }).__officeSentMessages = []
      WebSocket.prototype.send = function captureOfficeSend(data) {
        if (typeof data === 'string') {
          try {
            ;(window as typeof window & { __officeSentMessages?: unknown[] }).__officeSentMessages?.push(JSON.parse(data))
          } catch {
            // Preserve non-JSON socket traffic without changing application behavior.
          }
        }
        return originalSend.call(this, data)
      }
    })
    const editor = await openStructureDocument(page, fixture!.filename)
    const table = editor.locator('table.rv-office-table')
    await expect(table.locator('colgroup > col')).toHaveCount(2)
    const initialWidths = await table.locator('colgroup > col').evaluateAll((columns) => (
      columns.map((column) => Number.parseFloat((column as HTMLElement).style.width))
    ))
    expect(initialWidths).toHaveLength(2)
    expect(initialWidths.every((width) => Number.isFinite(width) && width > 0)).toBe(true)
    await page.waitForTimeout(750)
    expect(await page.evaluate(() => (
      (window as typeof window & { __officeSentMessages?: Array<{ type?: string }> }).__officeSentMessages
        ?.filter(({ type }) => type === 'file_save').length ?? 0
    ))).toBe(0)

    await table.locator('tbody > tr').nth(1).locator('td, th').nth(1).click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Insert Column Right' }).click()
    await expect(table.locator('tbody > tr').first().locator('th, td')).toHaveCount(3)
    await expect.poll(() => page.evaluate(() => (
      (window as typeof window & { __officeSentMessages?: Array<{ type?: string }> }).__officeSentMessages
        ?.filter(({ type }) => type === 'file_save').length ?? 0
    ))).toBe(1)
    const expectedForward = [initialWidths[0], initialWidths[1], initialWidths[1]]
    const forwardBytes = fs.readFileSync(fixture!.path, 'utf8')
    const forward = parseMarkdownFrontmatter(forwardBytes)
    expect(getDocumentTableLayouts(forward.frontmatter)[0]?.columns).toEqual(expectedForward)
    expect(forwardBytes).not.toMatch(/columns:\s*\[[^\]]*null/)

    await page.keyboard.press('ControlOrMeta+z')
    await expect(table.locator('tbody > tr').first().locator('th, td')).toHaveCount(2)
    await expect.poll(() => page.evaluate(() => (
      (window as typeof window & { __officeSentMessages?: Array<{ type?: string }> }).__officeSentMessages
        ?.filter(({ type }) => type === 'file_save').length ?? 0
    ))).toBe(2)
    const undone = parseMarkdownFrontmatter(fs.readFileSync(fixture!.path, 'utf8'))
    expect(getDocumentTableLayouts(undone.frontmatter)[0]?.columns).toEqual([90])
    const undoRenderedWidths = await table.locator('colgroup > col').evaluateAll((columns) => (
      columns.map((column) => Number.parseFloat((column as HTMLElement).style.width))
    ))
    expect(undoRenderedWidths).toHaveLength(2)
    expect(undoRenderedWidths.every((width) => Number.isFinite(width) && width > 0)).toBe(true)

    await page.keyboard.press('ControlOrMeta+Shift+z')
    await expect(table.locator('tbody > tr').first().locator('th, td')).toHaveCount(3)
    await expect.poll(() => page.evaluate(() => (
      (window as typeof window & { __officeSentMessages?: Array<{ type?: string }> }).__officeSentMessages
        ?.filter(({ type }) => type === 'file_save').length ?? 0
    ))).toBe(3)
    const redoneBytes = fs.readFileSync(fixture!.path, 'utf8')
    const redone = parseMarkdownFrontmatter(redoneBytes)
    expect(getDocumentTableLayouts(redone.frontmatter)[0]?.columns).toEqual(expectedForward)
    expect(redoneBytes).not.toMatch(/columns:\s*\[[^\]]*null/)
  } finally {
    await page.close()
    const reset = await resetOfficePlaywrightScenario({ scenario: 'structure', variant: 'partial-widths', copies: 1, workspaces: 1 })
    const restored = reset.find(({ filename }: { filename: string }) => filename === 'Structure-R3-C2.md')
    expect(restored).toBeTruthy()
    expect(fs.readFileSync(restored!.path)).toEqual(canonical)
  }
})

test('[slice 01.1] direct color prunes its target and raw row structure preserves widths through undo', async ({ page }) => {
  const files = await resetOfficePlaywrightScenario({ scenario: 'structure', variant: 'raw-metadata', copies: 1, workspaces: 1 })
  const fixture = files.find(({ filename }: { filename: string }) => filename === 'Structure-R3-C2.md')
  expect(fixture).toBeTruthy()
  const canonical = fs.readFileSync(fixture!.path)
  const original = parseMarkdownFrontmatter(canonical.toString())
  const rawLayouts = getDocumentTableLayouts(original.frontmatter)
  const directColors = [{
    tableIndex: 0,
    fingerprint: expect.any(String),
    cells: { '0,0': '#aabbcc', '1,1': '#ff0000' },
    rows: { '0': { color: '#123456', rank: 3 } },
    columns: { '0': { color: '#fedcba', rank: 2 } },
    future: 'keep-exact',
  }]

  try {
    await page.addInitScript(() => {
      const originalSend = WebSocket.prototype.send
      ;(window as typeof window & { __officeSentMessages?: unknown[] }).__officeSentMessages = []
      WebSocket.prototype.send = function captureOfficeSend(data) {
        if (typeof data === 'string') {
          try {
            ;(window as typeof window & { __officeSentMessages?: unknown[] }).__officeSentMessages?.push(JSON.parse(data))
          } catch { /* preserve non-JSON traffic */ }
        }
        return originalSend.call(this, data)
      }
    })
    const saveCount = () => page.evaluate(() => (
      (window as typeof window & { __officeSentMessages?: Array<{ type?: string }> }).__officeSentMessages
        ?.filter(({ type }) => type === 'file_save').length ?? 0
    ))
    const editor = await openStructureDocument(page, fixture!.filename)
    const table = editor.locator('table.rv-office-table')
    const addressedCell = table.locator('tbody > tr').nth(1).locator('td, th').nth(1)
    await page.waitForTimeout(750)
    expect(await saveCount()).toBe(0)

    await addressedCell.click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Cell Background' }).click()
    await page.locator('.rv-office-color-swatch[title="#ff0000"]').click()
    await expect.poll(saveCount).toBe(1)
    const direct = parseMarkdownFrontmatter(fs.readFileSync(fixture!.path, 'utf8'))
    expect(getDocumentTableLayouts(direct.frontmatter)).toEqual(rawLayouts)
    expect(getDocumentTableColors(direct.frontmatter)).toEqual(directColors)

    await addressedCell.click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Insert Row Above' }).click()
    await expect(table.locator('tbody > tr')).toHaveCount(4)
    await expect.poll(saveCount).toBe(2)
    const forward = parseMarkdownFrontmatter(fs.readFileSync(fixture!.path, 'utf8'))
    expect(getDocumentTableLayouts(forward.frontmatter)[0]).toEqual({
      ...rawLayouts[0],
      fingerprint: expect.any(String),
    })
    expect(getDocumentTableColors(forward.frontmatter)).toEqual([{
      tableIndex: 0,
      fingerprint: expect.any(String),
      cells: { '0,0': '#aabbcc', '2,1': '#ff0000' },
      rows: { '0': { color: '#123456', rank: 3 } },
      columns: { '0': { color: '#fedcba', rank: 2 } },
      future: 'keep-exact',
    }])

    await page.keyboard.press('ControlOrMeta+z')
    await expect(table.locator('tbody > tr')).toHaveCount(3)
    await expect.poll(saveCount).toBe(3)
    const undone = parseMarkdownFrontmatter(fs.readFileSync(fixture!.path, 'utf8'))
    expect(getDocumentTableLayouts(undone.frontmatter)).toEqual(rawLayouts)
    expect(getDocumentTableColors(undone.frontmatter)).toEqual(directColors)

    await page.keyboard.press('ControlOrMeta+Shift+z')
    await expect(table.locator('tbody > tr')).toHaveCount(4)
    await expect.poll(saveCount).toBe(4)
    const redone = parseMarkdownFrontmatter(fs.readFileSync(fixture!.path, 'utf8'))
    expect(getDocumentTableLayouts(redone.frontmatter)[0]?.columns).toEqual([90, null])
    expect(getDocumentTableColors(redone.frontmatter)).toEqual(getDocumentTableColors(forward.frontmatter))
  } finally {
    await page.close()
    const reset = await resetOfficePlaywrightScenario({ scenario: 'structure', variant: 'raw-metadata', copies: 1, workspaces: 1 })
    const restored = reset.find(({ filename }: { filename: string }) => filename === 'Structure-R3-C2.md')
    expect(restored).toBeTruthy()
    expect(fs.readFileSync(restored!.path)).toEqual(canonical)
  }
})

test('[slice 01.1] malformed raw metadata stays dormant, cleans on structure commit, undoes exactly, and reopens clean', async ({ page }) => {
  const files = await resetOfficePlaywrightScenario({ scenario: 'structure', variant: 'raw-metadata', copies: 1, workspaces: 1 })
  const fixture = files.find(({ filename }: { filename: string }) => filename === 'Structure-R3-C2.md')
  expect(fixture).toBeTruthy()
  const canonical = fs.readFileSync(fixture!.path)
  const original = parseMarkdownFrontmatter(canonical.toString())
  const rawLayouts = getDocumentTableLayouts(original.frontmatter)
  const rawColors = getDocumentTableColors(original.frontmatter)

  try {
    await page.addInitScript(() => {
      const originalSend = WebSocket.prototype.send
      ;(window as typeof window & { __officeSentMessages?: unknown[] }).__officeSentMessages = []
      WebSocket.prototype.send = function captureOfficeSend(data) {
        if (typeof data === 'string') {
          try {
            ;(window as typeof window & { __officeSentMessages?: unknown[] }).__officeSentMessages?.push(JSON.parse(data))
          } catch { /* preserve non-JSON traffic */ }
        }
        return originalSend.call(this, data)
      }
    })
    const editor = await openStructureDocument(page, fixture!.filename)
    const table = editor.locator('table.rv-office-table')
    await expect(table.locator('colgroup > col')).toHaveCount(2)
    await expect(table.locator('tbody > tr').first().locator('th, td').first()).toHaveCSS(
      'background-color',
      'rgb(170, 187, 204)',
    )
    await expect(table.locator('tbody > tr').nth(1).locator('th, td').nth(1)).not.toHaveCSS(
      'background-color',
      'rgb(255, 0, 0)',
    )
    await page.waitForTimeout(750)
    expect(fs.readFileSync(fixture!.path)).toEqual(canonical)
    expect(await page.evaluate(() => (
      (window as typeof window & { __officeSentMessages?: Array<{ type?: string }> }).__officeSentMessages
        ?.filter(({ type }) => type === 'file_save').length ?? 0
    ))).toBe(0)

    const initialWidths = await table.locator('colgroup > col').evaluateAll((columns) => (
      columns.map((column) => Number.parseFloat((column as HTMLElement).style.width))
    ))
    await table.locator('tbody > tr').nth(1).locator('td, th').nth(1).click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Insert Column Right' }).click()
    await expect(table.locator('tbody > tr').first().locator('th, td')).toHaveCount(3)
    await expect.poll(() => page.evaluate(() => (
      (window as typeof window & { __officeSentMessages?: Array<{ type?: string }> }).__officeSentMessages
        ?.filter(({ type }) => type === 'file_save').length ?? 0
    ))).toBe(1)
    const forward = parseMarkdownFrontmatter(fs.readFileSync(fixture!.path, 'utf8'))
    expect(getDocumentTableLayouts(forward.frontmatter)[0]?.columns).toEqual([
      initialWidths[0], initialWidths[1], initialWidths[1],
    ])
    expect(getDocumentTableColors(forward.frontmatter)).toEqual([{
      tableIndex: 0,
      fingerprint: expect.any(String),
      cells: { '0,0': '#aabbcc' },
      rows: { '0': { color: '#123456', rank: 3 } },
      columns: { '0': { color: '#fedcba', rank: 2 } },
      future: 'keep-exact',
    }])

    await page.keyboard.press('ControlOrMeta+z')
    await expect(table.locator('tbody > tr').first().locator('th, td')).toHaveCount(2)
    await expect.poll(() => page.evaluate(() => (
      (window as typeof window & { __officeSentMessages?: Array<{ type?: string }> }).__officeSentMessages
        ?.filter(({ type }) => type === 'file_save').length ?? 0
    ))).toBe(2)
    const undone = parseMarkdownFrontmatter(fs.readFileSync(fixture!.path, 'utf8'))
    expect(getDocumentTableLayouts(undone.frontmatter)).toEqual(rawLayouts)
    expect(getDocumentTableColors(undone.frontmatter)).toEqual(rawColors)

    await page.keyboard.press('ControlOrMeta+Shift+z')
    await expect(table.locator('tbody > tr').first().locator('th, td')).toHaveCount(3)
    await expect.poll(() => page.evaluate(() => (
      (window as typeof window & { __officeSentMessages?: Array<{ type?: string }> }).__officeSentMessages
        ?.filter(({ type }) => type === 'file_save').length ?? 0
    ))).toBe(3)
    const redoneBytes = fs.readFileSync(fixture!.path, 'utf8')
    expect(redoneBytes).not.toMatch(/columns:\s*\[[^\]]*(null|bad)/)
    expect(JSON.stringify(getDocumentTableColors(parseMarkdownFrontmatter(redoneBytes).frontmatter)))
      .not.toMatch(/red|bad-shape|"rank":"bad"|9,9|malformed/)

    await page.reload()
    const reopened = page.locator('.rv-office-document-editor .milkdown .ProseMirror[contenteditable="true"]')
    await expect(reopened.locator('table.rv-office-table').first().locator('tbody > tr').first().locator('th, td'))
      .toHaveCount(3)
    expect(getDocumentTableLayouts(parseMarkdownFrontmatter(fs.readFileSync(fixture!.path, 'utf8')).frontmatter)[0]?.columns)
      .toEqual([initialWidths[0], initialWidths[1], initialWidths[1]])
  } finally {
    await page.close()
    const reset = await resetOfficePlaywrightScenario({ scenario: 'structure', variant: 'raw-metadata', copies: 1, workspaces: 1 })
    const restored = reset.find(({ filename }: { filename: string }) => filename === 'Structure-R3-C2.md')
    expect(restored).toBeTruthy()
    expect(fs.readFileSync(restored!.path)).toEqual(canonical)
  }
})

test('[slice 01.1] malformed scalar table collections survive text save, structure history, and reopen', async ({ page }) => {
  const files = await resetOfficePlaywrightScenario({ scenario: 'structure', variant: 'metadata', copies: 1, workspaces: 1 })
  const fixture = files.find(({ filename }: { filename: string }) => filename === 'Structure-R3-C2.md')
  expect(fixture).toBeTruthy()
  const canonical = fs.readFileSync(fixture!.path)
  const rawTables = 'opaque-layout-scalar'
  const rawColors = 17
  writeStructureFixtureMetadata(fixture!.path, canonical, rawTables, rawColors)

  try {
    const saveCount = await captureOfficeSaveMessages(page)
    const editor = await openStructureDocument(page, fixture!.filename)
    const table = editor.locator('table.rv-office-table')
    await expect(table.locator('tbody > tr')).toHaveCount(3)
    await page.waitForTimeout(750)
    expect(await saveCount()).toBe(0)

    await editor.locator('p').first().click()
    await page.keyboard.press('End')
    await page.keyboard.type(' text-save')
    await expect.poll(saveCount).toBe(1)
    let saved = parseMarkdownFrontmatter(fs.readFileSync(fixture!.path, 'utf8'))
    expect(getDocumentTableLayouts(saved.frontmatter)).toBe(rawTables)
    expect(getDocumentTableColors(saved.frontmatter)).toBe(rawColors)
    expect((saved.frontmatter.metadata as Record<string, unknown>).rawCollectionSibling)
      .toEqual({ exact: ['preserve', 7] })

    await table.locator('tbody > tr').nth(1).locator('td, th').first().click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Insert Row Above' }).click()
    await expect(table.locator('tbody > tr')).toHaveCount(4)
    await expect.poll(saveCount).toBe(2)
    saved = parseMarkdownFrontmatter(fs.readFileSync(fixture!.path, 'utf8'))
    expect(getDocumentTableLayouts(saved.frontmatter)).toBe(rawTables)
    expect(getDocumentTableColors(saved.frontmatter)).toBe(rawColors)

    await page.keyboard.press('ControlOrMeta+z')
    await expect(table.locator('tbody > tr')).toHaveCount(3)
    await expect.poll(saveCount).toBe(3)
    saved = parseMarkdownFrontmatter(fs.readFileSync(fixture!.path, 'utf8'))
    expect(getDocumentTableLayouts(saved.frontmatter)).toBe(rawTables)
    expect(getDocumentTableColors(saved.frontmatter)).toBe(rawColors)

    await page.keyboard.press('ControlOrMeta+Shift+z')
    await expect(table.locator('tbody > tr')).toHaveCount(4)
    await expect.poll(saveCount).toBe(4)
    await page.reload()
    const reopened = page.locator('.rv-office-document-editor .milkdown .ProseMirror[contenteditable="true"]')
    await expect(reopened.locator('table.rv-office-table tbody > tr')).toHaveCount(4)
    saved = parseMarkdownFrontmatter(fs.readFileSync(fixture!.path, 'utf8'))
    expect(getDocumentTableLayouts(saved.frontmatter)).toBe(rawTables)
    expect(getDocumentTableColors(saved.frontmatter)).toBe(rawColors)
  } finally {
    await page.close()
    const reset = await resetOfficePlaywrightScenario({ scenario: 'structure', variant: 'metadata', copies: 1, workspaces: 1 })
    const restored = reset.find(({ filename }: { filename: string }) => filename === 'Structure-R3-C2.md')
    expect(restored).toBeTruthy()
    expect(fs.readFileSync(restored!.path)).toEqual(canonical)
  }
})

for (const emptyPresenceCase of [
  {
    label: 'missing collections stay missing',
    tables: undefined,
    tableColors: undefined,
    expected: { tables: false, tableColors: false },
  },
  {
    label: 'explicit empty collections stay explicit',
    tables: [],
    tableColors: [],
    expected: { tables: true, tableColors: true },
  },
]) {
  test(`[slice 01.1] ${emptyPresenceCase.label} through text save structure undo redo reopen`, async ({ page }) => {
    const files = await resetOfficePlaywrightScenario({ scenario: 'structure', variant: 'metadata', copies: 1, workspaces: 1 })
    const fixture = files.find(({ filename }: { filename: string }) => filename === 'Structure-R3-C2.md')
    expect(fixture).toBeTruthy()
    const canonical = fs.readFileSync(fixture!.path)
    writeStructureFixtureMetadata(
      fixture!.path,
      canonical,
      emptyPresenceCase.tables,
      emptyPresenceCase.tableColors,
    )

    try {
      const saveCount = await captureOfficeSaveMessages(page)
      const editor = await openStructureDocument(page, fixture!.filename)
      const table = editor.locator('table.rv-office-table')
      await expect(table.locator('tbody > tr')).toHaveCount(3)
      await page.waitForTimeout(750)
      expect(await saveCount()).toBe(0)

      await editor.locator('p').first().click()
      await page.keyboard.press('End')
      await page.keyboard.type(` ${emptyPresenceCase.label}`)
      await expect.poll(saveCount).toBe(1)
      expectTableCollectionPresence(fixture!.path, emptyPresenceCase.expected)

      await table.locator('tbody > tr').nth(1).locator('td, th').first().click({ button: 'right' })
      await page.getByRole('menuitem', { name: 'Insert Row Above' }).click()
      await expect(table.locator('tbody > tr')).toHaveCount(4)
      await expect.poll(saveCount).toBe(2)
      expectTableCollectionPresence(fixture!.path, emptyPresenceCase.expected)

      await page.keyboard.press('ControlOrMeta+z')
      await expect(table.locator('tbody > tr')).toHaveCount(3)
      await expect.poll(saveCount).toBe(3)
      expectTableCollectionPresence(fixture!.path, emptyPresenceCase.expected)

      await page.keyboard.press('ControlOrMeta+Shift+z')
      await expect(table.locator('tbody > tr')).toHaveCount(4)
      await expect.poll(saveCount).toBe(4)
      expectTableCollectionPresence(fixture!.path, emptyPresenceCase.expected)

      await page.reload()
      const reopened = page.locator('.rv-office-document-editor .milkdown .ProseMirror[contenteditable="true"]')
      await expect(reopened.locator('table.rv-office-table tbody > tr')).toHaveCount(4)
      expectTableCollectionPresence(fixture!.path, emptyPresenceCase.expected)
    } finally {
      await page.close()
      const reset = await resetOfficePlaywrightScenario({ scenario: 'structure', variant: 'metadata', copies: 1, workspaces: 1 })
      const restored = reset.find(({ filename }: { filename: string }) => filename === 'Structure-R3-C2.md')
      expect(restored).toBeTruthy()
      expect(fs.readFileSync(restored!.path)).toEqual(canonical)
    }
  })
}

test('[slice 01.1] raw array order and malformed identities survive text save and exact structure undo redo reopen', async ({ page }) => {
  const files = await resetOfficePlaywrightScenario({ scenario: 'structure', variant: 'metadata', copies: 1, workspaces: 1 })
  const fixture = files.find(({ filename }: { filename: string }) => filename === 'Structure-R3-C2.md')
  expect(fixture).toBeTruthy()
  const canonical = fs.readFileSync(fixture!.path)
  const targetLayout = {
    tableIndex: 0, fingerprint: '   ', columns: [90, null], targetOpaque: { exact: true },
  }
  const unrelatedLayout = {
    tableIndex: -9, fingerprint: false, columns: 'opaque-columns', unrelatedOpaque: ['exact'],
  }
  const targetColors = {
    tableIndex: 0, fingerprint: [], cells: { '1,0': '#112233' }, targetOpaque: { exact: true },
  }
  const unrelatedColors = {
    tableIndex: 'bad-unrelated-index', fingerprint: ' ', rows: 'opaque-rows', unrelatedOpaque: ['exact'],
  }
  const rawTables = [
    { future: 'opaque-before' },
    targetLayout,
    { future: 'opaque-between' },
    unrelatedLayout,
    { future: 'opaque-after' },
  ]
  const rawColors = [
    { future: 'opaque-before' },
    targetColors,
    { future: 'opaque-between' },
    unrelatedColors,
    { future: 'opaque-after' },
  ]
  writeStructureFixtureMetadata(fixture!.path, canonical, rawTables, rawColors)

  try {
    const saveCount = await captureOfficeSaveMessages(page)
    const editor = await openStructureDocument(page, fixture!.filename)
    const table = editor.locator('table.rv-office-table')
    await expect(table.locator('tbody > tr')).toHaveCount(3)
    await page.waitForTimeout(750)
    expect(await saveCount()).toBe(0)

    await editor.locator('p').first().click()
    await page.keyboard.press('End')
    await page.keyboard.type(' raw-array-text-save')
    await expect.poll(saveCount).toBe(1)
    let saved = parseMarkdownFrontmatter(fs.readFileSync(fixture!.path, 'utf8'))
    expect(getDocumentTableLayouts(saved.frontmatter)).toEqual(rawTables)
    expect(getDocumentTableColors(saved.frontmatter)).toEqual(rawColors)

    await table.locator('tbody > tr').nth(1).locator('td, th').first().click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Insert Row Above' }).click()
    await expect(table.locator('tbody > tr')).toHaveCount(4)
    await expect.poll(saveCount).toBe(2)
    saved = parseMarkdownFrontmatter(fs.readFileSync(fixture!.path, 'utf8'))
    const forwardTables = getDocumentTableLayouts(saved.frontmatter) as unknown[]
    const forwardColors = getDocumentTableColors(saved.frontmatter) as unknown[]
    expect(forwardTables).toEqual([
      { future: 'opaque-before' },
      { ...targetLayout, tableIndex: 0, fingerprint: expect.any(String) },
      { future: 'opaque-between' },
      unrelatedLayout,
      { future: 'opaque-after' },
    ])
    expect(forwardColors).toEqual([
      { future: 'opaque-before' },
      {
        ...targetColors,
        tableIndex: 0,
        fingerprint: expect.any(String),
        cells: { '2,0': '#112233' },
      },
      { future: 'opaque-between' },
      unrelatedColors,
      { future: 'opaque-after' },
    ])
    const forwardRaw = { tables: structuredClone(forwardTables), colors: structuredClone(forwardColors) }

    await page.keyboard.press('ControlOrMeta+z')
    await expect(table.locator('tbody > tr')).toHaveCount(3)
    await expect.poll(saveCount).toBe(3)
    saved = parseMarkdownFrontmatter(fs.readFileSync(fixture!.path, 'utf8'))
    expect(getDocumentTableLayouts(saved.frontmatter)).toEqual(rawTables)
    expect(getDocumentTableColors(saved.frontmatter)).toEqual(rawColors)

    await page.keyboard.press('ControlOrMeta+Shift+z')
    await expect(table.locator('tbody > tr')).toHaveCount(4)
    await expect.poll(saveCount).toBe(4)
    saved = parseMarkdownFrontmatter(fs.readFileSync(fixture!.path, 'utf8'))
    expect(getDocumentTableLayouts(saved.frontmatter)).toEqual(forwardRaw.tables)
    expect(getDocumentTableColors(saved.frontmatter)).toEqual(forwardRaw.colors)

    await page.reload()
    const reopened = page.locator('.rv-office-document-editor .milkdown .ProseMirror[contenteditable="true"]')
    await expect(reopened.locator('table.rv-office-table tbody > tr')).toHaveCount(4)
    saved = parseMarkdownFrontmatter(fs.readFileSync(fixture!.path, 'utf8'))
    expect(getDocumentTableLayouts(saved.frontmatter)).toEqual(forwardRaw.tables)
    expect(getDocumentTableColors(saved.frontmatter)).toEqual(forwardRaw.colors)
    expect((saved.frontmatter.metadata as Record<string, unknown>).rawCollectionSibling)
      .toEqual({ exact: ['preserve', 7] })
  } finally {
    await page.close()
    const reset = await resetOfficePlaywrightScenario({ scenario: 'structure', variant: 'metadata', copies: 1, workspaces: 1 })
    const restored = reset.find(({ filename }: { filename: string }) => filename === 'Structure-R3-C2.md')
    expect(restored).toBeTruthy()
    expect(fs.readFileSync(restored!.path)).toEqual(canonical)
  }
})
