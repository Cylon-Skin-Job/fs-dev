import fs from 'node:fs'

import { expect, test, type Page } from '@playwright/test'
import { history, redo, undo } from '@milkdown/kit/prose/history'
import { Schema } from '@milkdown/kit/prose/model'
import { EditorState, type Transaction } from '@milkdown/kit/prose/state'

import { prepareOfficeTableColorAction } from '../src/components/office/officeTableColors'
import {
  applyColorPolicy,
  normalizeColorRules,
  reindexColorRules,
  type OfficeTableColorRules,
} from '../src/components/office/officeTableColorPolicy'
import {
  renderOfficeTableColorStylesheet,
  rulesToCellColor,
} from '../src/components/office/officeTableColorRender'
import {
  createOfficeDeferredMarkdownPublicationState,
  createOfficeDirtySaveScheduler,
  createOfficeTableMetadataProsePlugin,
  dispatchOfficeTableMetadataAction,
  OfficeTableMetadataStep,
  publishOfficeTableMetadataCombinedCallbacks,
  publishOfficeTableMetadataSnapshot,
  registerOfficeTableMetadataBindings,
  type OfficeTableMetadataSnapshot,
} from '../src/components/office/officeTableHistory'
import { transformOfficeTableMetadata } from '../src/components/office/officeTableMutations'
import {
  DEFAULT_SETTINGS,
  getDocumentTableColors,
  getDocumentTableLayouts,
  parseDocumentSettings,
  parseMarkdownFrontmatter,
  serializeDocumentSettings,
  type DocumentTableColors,
} from '../src/lib/front-matter'
import { resetOfficePlaywrightScenario } from './office/fixture-lifecycle.mjs'

type ColorCollection = DocumentTableColors[]

const target = { tableIndex: 0, fingerprint: 'before' }
const metadataSchema = new Schema({
  nodes: {
    doc: { content: 'paragraph+' },
    paragraph: { content: 'text*', toDOM: () => ['p', 0] },
    text: {},
  },
})

test('[slice 02C.1] S1 cell paint normalizes first and changes only the target cell', () => {
  const before = {
    cells: { '0,0': '#AABBCC', '9,9': '#ffffff' },
    rows: { '1': { color: '#ABCDEF' } },
  }
  const frozen = structuredClone(before)
  const after = applyColorPolicy(
    before,
    { target: 'cell', rowIndex: 1, columnIndex: 1, value: '#FEDCBA' },
    { rowCount: 2, columnCount: 2 },
  )

  expect(after).toEqual({
    cells: { '0,0': '#aabbcc', '1,1': '#fedcba' },
    rows: { '1': { color: '#abcdef', rank: 0 } },
  })
  expect(before).toEqual(frozen)
  expect(after).not.toBe(before)
  expect(after.cells).not.toBe(before.cells)
})

test('[slice 02C.1] S2 cell none stores a mask only when a band covers the cell', () => {
  const covered = applyColorPolicy(
    { rows: { '0': { color: '#AA0000', rank: 1 } }, cells: { '0,0': '#00ff00' } },
    { target: 'cell', rowIndex: 0, columnIndex: 0, value: 'none' },
    { rowCount: 2, columnCount: 2 },
  )
  expect(covered).toEqual({
    cells: { '0,0': 'none' },
    rows: { '0': { color: '#aa0000', rank: 1 } },
  })
  expect(rulesToCellColor(covered, 0, 0)).toBeNull()

  const uncovered = applyColorPolicy(
    { cells: { '1,1': 'none' } },
    { target: 'cell', rowIndex: 1, columnIndex: 1, value: 'none' },
    { rowCount: 2, columnCount: 2 },
  )
  expect(uncovered).toEqual({})
})

test('[slice 02C.1] S3 row paint owns the row and takes max rank plus one', () => {
  const after = applyColorPolicy(
    {
      cells: { '0,0': '#111111', '0,1': 'none', '1,0': '#222222' },
      rows: { '0': { color: '#333333', rank: 2 } },
      columns: { '1': { color: '#444444', rank: 7 } },
    },
    { target: 'row', index: 0, value: '#ABCDEF' },
    { rowCount: 2, columnCount: 2 },
  )
  expect(after).toEqual({
    cells: { '1,0': '#222222' },
    rows: { '0': { color: '#abcdef', rank: 8 } },
    columns: { '1': { color: '#444444', rank: 7 } },
  })
})

test('[slice 02C.1] S4 later column paint owns the column and wins its crossing', () => {
  const after = applyColorPolicy(
    {
      cells: { '0,1': '#111111', '1,1': 'none', '1,0': '#222222' },
      rows: { '0': { color: '#aa0000', rank: 4 } },
      columns: { '1': { color: '#00aa00', rank: 2 } },
    },
    { target: 'column', index: 1, value: '#0000FF' },
    { rowCount: 2, columnCount: 2 },
  )
  expect(after).toEqual({
    cells: { '1,0': '#222222' },
    rows: { '0': { color: '#aa0000', rank: 4 } },
    columns: { '1': { color: '#0000ff', rank: 5 } },
  })
  expect(rulesToCellColor(after, 0, 1)).toBe('#0000ff')
})

test('[slice 02C.1] S5 row clear deletes row cells and masks surviving column crossings', () => {
  const after = applyColorPolicy(
    {
      cells: { '0,0': '#111111', '0,2': '#222222', '1,1': '#333333' },
      rows: { '0': { color: '#aa0000', rank: 8 } },
      columns: {
        '0': { color: '#00aa00', rank: 3 },
        '2': { color: '#0000aa', rank: 4 },
      },
    },
    { target: 'row', index: 0, value: 'none' },
    { rowCount: 2, columnCount: 3 },
  )
  expect(after).toEqual({
    cells: { '1,1': '#333333', '0,0': 'none', '0,2': 'none' },
    columns: {
      '0': { color: '#00aa00', rank: 3 },
      '2': { color: '#0000aa', rank: 4 },
    },
  })
})

test('[slice 02C.1] S5 column clear is symmetric and never emits a none band', () => {
  const after = applyColorPolicy(
    {
      cells: { '0,1': '#111111', '2,1': '#222222', '1,0': '#333333' },
      rows: {
        '0': { color: '#aa0000', rank: 3 },
        '2': { color: '#0000aa', rank: 4 },
      },
      columns: { '1': { color: '#00aa00', rank: 8 } },
    },
    { target: 'column', index: 1, value: 'none' },
    { rowCount: 3, columnCount: 2 },
  )
  expect(after).toEqual({
    cells: { '1,0': '#333333', '0,1': 'none', '2,1': 'none' },
    rows: {
      '0': { color: '#aa0000', rank: 3 },
      '2': { color: '#0000aa', rank: 4 },
    },
  })
  expect(after.columns).toBeUndefined()
})

test('[slice 02C.1] S7 rankless bands render at zero and repair only on mutation', () => {
  const legacy = {
    rows: { '0': { color: '#AA0000' } },
    columns: { '0': { color: '#0000BB' } },
  }
  expect(rulesToCellColor(legacy, 0, 0)).toBe('#aa0000')
  expect(legacy.rows['0']).not.toHaveProperty('rank')

  const repaired = applyColorPolicy(
    legacy,
    { target: 'cell', rowIndex: 1, columnIndex: 1, value: '#123456' },
    { rowCount: 2, columnCount: 2 },
  )
  expect(repaired).toEqual({
    cells: { '1,1': '#123456' },
    rows: { '0': { color: '#aa0000', rank: 0 } },
    columns: { '0': { color: '#0000bb', rank: 0 } },
  })
})

test('[slice 02C.1] S8 normalization prunes malformed data lowercases hex and removes empty maps', () => {
  const before = {
    cells: {
      '0,0': '#AABBCC',
      '0,1': 'none',
      '01,0': '#111111',
      '-1,0': '#222222',
      '2,0': '#333333',
      '1,1': null,
    },
    rows: {
      '0': { color: '#ABCDEF', rank: 2 },
      '1': { color: 'none', rank: 3 },
      '2': { color: '#ffffff', rank: 4 },
    },
    columns: {
      '0': { color: '#FEDCBA' },
      '1': { color: '#ffffff', rank: Number.POSITIVE_INFINITY },
    },
  }
  const frozen = structuredClone(before)
  const after = normalizeColorRules(before, { rowCount: 2, columnCount: 2 })

  expect(after).toEqual({
    cells: { '0,0': '#aabbcc', '0,1': 'none' },
    rows: { '0': { color: '#abcdef', rank: 2 } },
    columns: { '0': { color: '#fedcba', rank: 0 } },
  })
  expect(before).toEqual(frozen)
  expect(normalizeColorRules(
    { cells: {}, rows: { bad: null }, columns: {} },
    { rowCount: 2, columnCount: 2 },
  )).toEqual({})
})

test('[slice 02C.1] S8 rejects nonincrementable and unsafe ranks before a newer paint', () => {
  const before = {
    rows: {
      '0': { color: '#ff0000', rank: Number.MAX_SAFE_INTEGER },
      '1': { color: '#ffff00', rank: Number.MAX_SAFE_INTEGER + 1 },
      '2': { color: '#abcdef', rank: Number.MAX_SAFE_INTEGER - 1 },
    },
    columns: {
      '0': { color: '#0000ff', rank: 7 },
      '1': { color: '#00ff00', rank: 1.5 },
    },
  }
  const frozen = structuredClone(before)

  expect(rulesToCellColor(before, 0, 0)).toBe('#0000ff')
  expect(rulesToCellColor(before, 1, 1)).toBeNull()

  const after = applyColorPolicy(
    before,
    { target: 'row', index: 0, value: '#ff0000' },
    { rowCount: 3, columnCount: 2 },
  )

  expect(after).toEqual({
    rows: {
      '0': { color: '#ff0000', rank: 3 },
      '2': { color: '#abcdef', rank: 2 },
    },
    columns: { '0': { color: '#0000ff', rank: 1 } },
  })
  expect(after.rows?.['0']?.rank).toBeGreaterThan(after.rows?.['2']?.rank ?? 0)
  expect(Number.isSafeInteger(after.rows?.['0']?.rank)).toBe(true)
  expect((after.rows?.['0']?.rank ?? Number.MAX_SAFE_INTEGER) + 1)
    .toBeGreaterThan(after.rows?.['0']?.rank ?? Number.MAX_SAFE_INTEGER)
  expect(before).toEqual(frozen)
  expect(rulesToCellColor(after, 0, 0)).toBe('#ff0000')

  const tidy = applyColorPolicy(
    {
      rows: { '0': { color: '#ff0000', rank: 7 } },
      columns: { '0': { color: '#0000ff', rank: Number.MAX_SAFE_INTEGER - 1 } },
    },
    { target: 'cell', rowIndex: 0, columnIndex: 0, value: '#ff0000' },
    { rowCount: 1, columnCount: 1 },
  )
  expect(tidy).toEqual({
    rows: { '0': { color: '#ff0000', rank: 3 } },
    columns: { '0': { color: '#0000ff', rank: 2 } },
  })
  expect(tidy.cells).toBeUndefined()
  expect(rulesToCellColor(tidy, 0, 0)).toBe('#ff0000')
})

test('[slice 02C.1] S9 row insert and delete reindex exact coordinates then normalize immutably', () => {
  const before = {
    cells: { '0,0': '#AA0000', '1,1': 'none', '2,0': '#00AA00' },
    rows: {
      '0': { color: '#111111', rank: 1 },
      '1': { color: '#222222' },
      '2': { color: '#333333', rank: 3 },
    },
    columns: { '1': { color: '#444444', rank: 4 } },
  }
  const frozen = structuredClone(before)
  const inserted = reindexColorRules(before, {
    axis: 'row',
    kind: 'insert',
    index: 1,
    nextDimensions: { rowCount: 4, columnCount: 2 },
  })
  expect(inserted).toEqual({
    cells: { '0,0': '#aa0000', '2,1': 'none', '3,0': '#00aa00' },
    rows: {
      '0': { color: '#111111', rank: 1 },
      '2': { color: '#222222', rank: 0 },
      '3': { color: '#333333', rank: 3 },
    },
    columns: { '1': { color: '#444444', rank: 4 } },
  })
  const deleted = reindexColorRules(before, {
    axis: 'row',
    kind: 'delete',
    index: 1,
    nextDimensions: { rowCount: 2, columnCount: 2 },
  })
  expect(deleted).toEqual({
    cells: { '0,0': '#aa0000', '1,0': '#00aa00' },
    rows: {
      '0': { color: '#111111', rank: 1 },
      '1': { color: '#333333', rank: 3 },
    },
    columns: { '1': { color: '#444444', rank: 4 } },
  })
  expect(before).toEqual(frozen)
})

test('[slice 02C.1] S9 column insert and delete preserve values ranks and none masks', () => {
  const before = {
    cells: { '0,0': '#aa0000', '1,1': 'none', '0,2': '#00aa00' },
    rows: { '1': { color: '#111111', rank: 1 } },
    columns: {
      '0': { color: '#222222', rank: 2 },
      '1': { color: '#333333' },
      '2': { color: '#444444', rank: 4 },
    },
  }
  expect(reindexColorRules(before, {
    axis: 'column',
    kind: 'insert',
    index: 1,
    nextDimensions: { rowCount: 2, columnCount: 4 },
  })).toEqual({
    cells: { '0,0': '#aa0000', '1,2': 'none', '0,3': '#00aa00' },
    rows: { '1': { color: '#111111', rank: 1 } },
    columns: {
      '0': { color: '#222222', rank: 2 },
      '2': { color: '#333333', rank: 0 },
      '3': { color: '#444444', rank: 4 },
    },
  })
  expect(reindexColorRules(before, {
    axis: 'column',
    kind: 'delete',
    index: 1,
    nextDimensions: { rowCount: 2, columnCount: 2 },
  })).toEqual({
    cells: { '0,0': '#aa0000', '0,1': '#00aa00' },
    rows: { '1': { color: '#111111', rank: 1 } },
    columns: {
      '0': { color: '#222222', rank: 2 },
      '1': { color: '#444444', rank: 4 },
    },
  })
})

test('[slice 02C.1] S10 winning matching band deletes stale explicit bytes without reranking', () => {
  const after = applyColorPolicy(
    {
      cells: { '0,0': '#123456' },
      rows: { '0': { color: '#aa0000', rank: 5 } },
      columns: { '0': { color: '#0000aa', rank: 4 } },
    },
    { target: 'cell', rowIndex: 0, columnIndex: 0, value: '#AA0000' },
    { rowCount: 2, columnCount: 2 },
  )
  expect(after).toEqual({
    rows: { '0': { color: '#aa0000', rank: 5 } },
    columns: { '0': { color: '#0000aa', rank: 4 } },
  })
})

test('[slice 02C.1] S10 safely reranks a losing matching band when no other cell changes', () => {
  const after = applyColorPolicy(
    {
      cells: { '0,0': 'none' },
      rows: { '0': { color: '#aa0000', rank: 1 } },
      columns: { '0': { color: '#0000aa', rank: 2 } },
    },
    { target: 'cell', rowIndex: 0, columnIndex: 0, value: '#aa0000' },
    { rowCount: 2, columnCount: 2 },
  )
  expect(after).toEqual({
    rows: { '0': { color: '#aa0000', rank: 3 } },
    columns: { '0': { color: '#0000aa', rank: 2 } },
  })
  expect(after.cells).toBeUndefined()
  expect(rulesToCellColor(after, 0, 0)).toBe('#aa0000')
})

test('[slice 02C.1] S10 rerank guard falls back to one explicit cell when another cell would change', () => {
  const before: OfficeTableColorRules = {
    rows: { '0': { color: '#aa0000', rank: 1 } },
    columns: {
      '0': { color: '#0000aa', rank: 2 },
      '1': { color: '#00aa00', rank: 2 },
    },
  }
  const after = applyColorPolicy(
    before,
    { target: 'cell', rowIndex: 0, columnIndex: 0, value: '#aa0000' },
    { rowCount: 2, columnCount: 2 },
  )
  expect(after).toEqual({
    cells: { '0,0': '#aa0000' },
    rows: { '0': { color: '#aa0000', rank: 1 } },
    columns: {
      '0': { color: '#0000aa', rank: 2 },
      '1': { color: '#00aa00', rank: 2 },
    },
  })
  expect(rulesToCellColor(after, 0, 1)).toBe('#00aa00')
})

test('[slice 02C.1] S10 multiple matching bands take winner branch and remove the explicit', () => {
  const after = applyColorPolicy(
    {
      cells: { '0,0': 'none' },
      rows: { '0': { color: '#aa0000', rank: 1 } },
      columns: { '0': { color: '#aa0000', rank: 2 } },
    },
    { target: 'cell', rowIndex: 0, columnIndex: 0, value: '#aa0000' },
    { rowCount: 1, columnCount: 1 },
  )
  expect(after).toEqual({
    rows: { '0': { color: '#aa0000', rank: 1 } },
    columns: { '0': { color: '#aa0000', rank: 2 } },
  })
})

test('[slice 02C.1] renderer honors explicit none explicit hex rankless bands and row ties', () => {
  const rules = {
    cells: { '0,0': 'none', '0,1': '#ABCDEF' },
    rows: { '0': { color: '#AA0000' } },
    columns: {
      '0': { color: '#0000BB' },
      '1': { color: '#00AA00', rank: 9 },
    },
  }
  expect(rulesToCellColor(rules, 0, 0)).toBeNull()
  expect(rulesToCellColor(rules, 0, 1)).toBe('#abcdef')
  expect(rulesToCellColor(rules, 1, 0)).toBe('#0000bb')
  expect(rulesToCellColor({
    rows: { '0': { color: '#aa0000', rank: 5 } },
    columns: { '0': { color: '#0000bb', rank: 5 } },
  }, 0, 0)).toBe('#aa0000')
  expect(rulesToCellColor({}, 0, 0)).toBeNull()
})

test('[slice 02C.1] renderer stylesheet emits only resolved fills', () => {
  expect(renderOfficeTableColorStylesheet([{
    tableId: 'table-0',
    rules: {
      cells: { '0,0': 'none' },
      rows: { '0': { color: '#aa0000', rank: 1 } },
      columns: { '1': { color: '#00bb00', rank: 2 } },
    },
    cells: [
      { rowIndex: 0, columnIndex: 0, physicalRowIndex: 0, physicalColumnIndex: 0 },
      { rowIndex: 0, columnIndex: 1, physicalRowIndex: 0, physicalColumnIndex: 1 },
    ],
  }])).toBe(
    '[data-rv-tid="table-0"] > tbody > tr:nth-child(1) > :nth-child(2) { background-color: #00bb00 !important; }',
  )
})

test('[slice 02C.1] policy has no imports and exactly its three required runtime exports', () => {
  const source = fs.readFileSync(
    new URL('../src/components/office/officeTableColorPolicy.ts', import.meta.url),
    'utf8',
  )
  expect(source.match(/^import\s/gm) ?? []).toHaveLength(0)
  expect(Array.from(source.matchAll(/^export function (\w+)/gm), (match) => match[1]).sort()).toEqual([
    'applyColorPolicy',
    'normalizeColorRules',
    'reindexColorRules',
  ])
  expect(source).not.toMatch(/front-matter|prosemirror|milkdown|yaml|document\.|window\.|HTMLElement/)
})

test('[slice 02C.1] adapter isolates the target table and preserves untouched raw sibling values', () => {
  const sibling = {
    tableIndex: 1,
    fingerprint: 'sibling',
    cells: { malformed: '#ABCDEF', '99,99': 'none' },
    future: { exact: ['bytes', 7] },
  }
  const before: ColorCollection = [
    { ...target, cells: { '0,0': '#AABBCC', '9,9': '#ffffff' } },
    sibling,
  ]
  const frozen = structuredClone(before)
  const prepared = prepareOfficeTableColorAction(
    before,
    target,
    { rowCount: 2, columnCount: 2 },
    { target: 'cell', rowIndex: 1, columnIndex: 1, value: '#123456' },
    [target, { tableIndex: 1, fingerprint: 'sibling' }],
  )

  expect(prepared).toEqual({
    changed: true,
    tableColors: [
      { ...target, cells: { '0,0': '#aabbcc', '1,1': '#123456' } },
      sibling,
    ],
  })
  expect(before).toEqual(frozen)
  expect((prepared.tableColors as ColorCollection)[1]).not.toBe(sibling)
})

test('[slice 02C.1] structural coordinator delegates exact reindex and hygiene to the policy', () => {
  const before: OfficeTableMetadataSnapshot = {
    tables: [],
    tableColors: [
      {
        ...target,
        cells: { '0,0': '#111111', '1,1': 'none' },
        rows: { '0': { color: '#aa0000', rank: 4 } },
        columns: { '1': { color: '#00BB00' } },
      },
      { tableIndex: 1, fingerprint: 'sibling', cells: { malformed: '#ABCDEF' } },
    ],
  }
  const frozen = structuredClone(before)
  const after = transformOfficeTableMetadata(
    before,
    target,
    { tableIndex: 0, fingerprint: 'after' },
    { axis: 'row', action: 'delete', index: 0 },
    { rows: 1, columns: 2 },
    [target, { tableIndex: 1, fingerprint: 'sibling' }],
  )

  expect(after.tableColors).toEqual([
    {
      tableIndex: 0,
      fingerprint: 'after',
      cells: { '0,1': 'none' },
      columns: { '1': { color: '#00bb00', rank: 0 } },
    },
    { tableIndex: 1, fingerprint: 'sibling', cells: { malformed: '#ABCDEF' } },
  ])
  expect(before).toEqual(frozen)
})

test('[slice 02C.1] S6 direct dispatcher preserves one exact metadata Step per undo redo event', () => {
  const root = {} as HTMLElement
  const publication = createOfficeDeferredMarkdownPublicationState()
  const before: OfficeTableMetadataSnapshot = {
    tables: [],
    tableColors: [{ ...target, cells: { '0,0': '#ff0000' } }],
  }
  let internalTables: unknown = structuredClone(before.tables)
  let internalColors: unknown = structuredClone(before.tableColors)
  let externalTables: unknown = structuredClone(before.tables)
  let externalColors: unknown = structuredClone(before.tableColors)
  let tableCallbacks = 0
  let colorCallbacks = 0
  let combinedPublications = 0
  let reactDirtySignals = 0
  let workspaceDirtySignals = 0
  let saveSchedulerCalls = 0
  let cancelledSchedules = 0
  let timer: ReturnType<typeof setTimeout> | null = null
  let sessionStart: number | null = null
  const markDirtyAndScheduleSave = createOfficeDirtySaveScheduler({
    filePath: '001-Fixtures/Color Integrity.md',
    setIsDirty: () => { reactDirtySignals += 1 },
    setDirty: () => { workspaceDirtySignals += 1 },
    getSessionStart: () => sessionStart,
    setSessionStart: (next) => { sessionStart = next },
    getTimer: () => timer,
    setTimer: (next) => { timer = next },
    checkpointDue: () => false,
    save: () => {},
    now: () => 1000,
    schedule: () => {
      saveSchedulerCalls += 1
      return saveSchedulerCalls as unknown as ReturnType<typeof setTimeout>
    },
    cancel: () => { cancelledSchedules += 1 },
  })
  const unregister = registerOfficeTableMetadataBindings(root, {
    readTables: () => internalTables,
    readTableColors: () => internalColors,
    publishTables: (next) => { internalTables = structuredClone(next) },
    publishTableColors: (next) => { internalColors = structuredClone(next) },
    prepareDeferredSnapshot: (token) => publication.prepare(token),
    cancelDeferredSnapshot: (token, document) => publication.cancel(token, document),
    isCurrentSnapshot: (token) => publication.isCurrent(token),
    publishSnapshot: (snapshot, previous, document, token) => {
      const settled = publishOfficeTableMetadataCombinedCallbacks({
        publication,
        snapshot,
        before: previous,
        document,
        token,
        publishTables: (next) => {
          tableCallbacks += 1
          externalTables = structuredClone(next)
        },
        publishTableColors: (next) => {
          colorCallbacks += 1
          externalColors = structuredClone(next)
        },
        markDirtyAndScheduleSave,
      })
      if (settled) combinedPublications += 1
      return settled
    },
  })
  const stateRef = {
    current: EditorState.create({
      schema: metadataSchema,
      doc: metadataSchema.node('doc', null, [metadataSchema.node('paragraph')]),
      plugins: [history(), createOfficeTableMetadataProsePlugin(
        (snapshot, document, deferExternal, token) => publishOfficeTableMetadataSnapshot(
          root, snapshot, document, { deferExternal, token },
        ),
      )],
    }),
  }
  const metadataStepsByDispatch: number[] = []
  const view = {
    get state() { return stateRef.current },
    dispatch(transaction: Transaction) {
      const applied = stateRef.current.applyTransaction(transaction)
      metadataStepsByDispatch.push(applied.transactions.reduce((count, candidate) => (
        count + candidate.steps.filter((step) => step instanceof OfficeTableMetadataStep).length
      ), 0))
      stateRef.current = applied.state
    },
  }
  const documentBefore = stateRef.current.doc

  try {
    const forward = dispatchOfficeTableMetadataAction(root, view, (snapshot) => {
      const prepared = prepareOfficeTableColorAction(
        snapshot.tableColors,
        target,
        { rowCount: 2, columnCount: 2 },
        { target: 'cell', rowIndex: 1, columnIndex: 1, value: '#00ff00' },
      )
      return prepared.changed ? { tables: snapshot.tables, tableColors: prepared.tableColors } : null
    })
    expect(forward.applied).toBe(true)
    expect(stateRef.current.doc.eq(documentBefore)).toBe(true)
    expect(undo(stateRef.current, (transaction) => view.dispatch(transaction))).toBe(true)
    expect(redo(stateRef.current, (transaction) => view.dispatch(transaction))).toBe(true)
    expect(metadataStepsByDispatch).toEqual([1, 1, 1])
    expect(internalTables).toEqual(before.tables)
    expect(externalTables).toEqual(before.tables)
    expect(internalColors).toEqual([
      { ...target, cells: { '0,0': '#ff0000', '1,1': '#00ff00' } },
    ])
    expect(externalColors).toEqual(internalColors)
    expect(tableCallbacks).toBe(3)
    expect(colorCallbacks).toBe(3)
    expect(combinedPublications).toBe(3)
    expect(reactDirtySignals).toBe(3)
    expect(workspaceDirtySignals).toBe(3)
    expect(saveSchedulerCalls).toBe(3)
    expect(cancelledSchedules).toBe(2)

    const beforeNoOp = {
      metadataDispatches: metadataStepsByDispatch.length,
      tableCallbacks,
      colorCallbacks,
      combinedPublications,
      reactDirtySignals,
      workspaceDirtySignals,
      saveSchedulerCalls,
    }
    const byteIdenticalPaint = dispatchOfficeTableMetadataAction(root, view, (snapshot) => {
      const prepared = prepareOfficeTableColorAction(
        snapshot.tableColors,
        target,
        { rowCount: 2, columnCount: 2 },
        { target: 'cell', rowIndex: 0, columnIndex: 0, value: '#ff0000' },
      )
      return prepared.changed ? { tables: snapshot.tables, tableColors: prepared.tableColors } : null
    })
    expect(byteIdenticalPaint).toEqual(expect.objectContaining({ applied: false, reason: 'no-change' }))
    expect({
      metadataDispatches: metadataStepsByDispatch.length,
      tableCallbacks,
      colorCallbacks,
      combinedPublications,
      reactDirtySignals,
      workspaceDirtySignals,
      saveSchedulerCalls,
    }).toEqual(beforeNoOp)
  } finally {
    unregister()
  }
})

async function openColorDocument(page: Page, filename: string) {
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
    await folder.click()
    await expect(document).toBeVisible()
  }
  await document.click()
  await expect(editor).toBeVisible()
  return editor
}

async function captureColorSaveMessages(
  page: Page,
  expectedPath = '001-Fixtures/Color Integrity.md',
) {
  await page.addInitScript((fixturePath) => {
    const originalSend = WebSocket.prototype.send
    const capturedWindow = window as typeof window & {
      __officeColorSentMessages?: unknown[]
      __officeColorSaveResponses?: number
    }
    capturedWindow.__officeColorSentMessages = []
    capturedWindow.__officeColorSaveResponses = 0
    WebSocket.prototype.send = function captureOfficeColorSend(data) {
      const socket = this as WebSocket & { __officeColorResponseCapture?: boolean }
      if (!socket.__officeColorResponseCapture) {
        socket.__officeColorResponseCapture = true
        socket.addEventListener('message', (event) => {
          if (typeof event.data !== 'string') return
          try {
            const message = JSON.parse(event.data) as {
              type?: string
              panel?: string
              path?: string
            }
            if (
              message.type === 'file_save_response'
              && message.panel === 'office-viewer'
              && message.path === fixturePath
            ) {
              capturedWindow.__officeColorSaveResponses = (
                capturedWindow.__officeColorSaveResponses ?? 0
              ) + 1
            }
          } catch { /* preserve non-JSON traffic */ }
        })
      }
      if (typeof data === 'string') {
        try {
          capturedWindow.__officeColorSentMessages?.push(JSON.parse(data))
        } catch { /* preserve non-JSON traffic */ }
      }
      return originalSend.call(this, data)
    }
  }, expectedPath)
  return () => page.evaluate(() => (
    (window as typeof window & { __officeColorSentMessages?: Array<{ type?: string }> })
      .__officeColorSentMessages?.filter(({ type }) => type === 'file_save').length ?? 0
  ))
}

async function expectColorSaveResponses(page: Page, expected: number) {
  await expect.poll(() => page.evaluate(() => (
    (window as typeof window & { __officeColorSaveResponses?: number })
      .__officeColorSaveResponses ?? 0
  ))).toBe(expected)
}

async function waitForFixtureFileQuiescence(
  fixturePath: string,
  stableForMs = 1_000,
  timeoutMs = 10_000,
) {
  const deadline = Date.now() + timeoutMs
  let signature = ''
  let stableSince = Date.now()
  while (Date.now() < deadline) {
    const stat = fs.statSync(fixturePath, { bigint: true })
    const bytes = fs.readFileSync(fixturePath)
    const nextSignature = [stat.mtimeNs, stat.ctimeNs, stat.size, bytes.toString('base64')].join(':')
    if (nextSignature !== signature) {
      signature = nextSignature
      stableSince = Date.now()
    }
    if (Date.now() - stableSince >= stableForMs) return bytes
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  throw new Error(`Fixture file did not become quiescent: ${fixturePath}`)
}

function readColorMetadata(fixturePath: string) {
  return getDocumentTableColors(
    parseMarkdownFrontmatter(fs.readFileSync(fixturePath, 'utf8')).frontmatter,
  ) as ColorCollection
}

function canonicalizeFixtureTables(body: string) {
  const lines = body.trim().split('\n')
  for (let start = 0; start < lines.length;) {
    if (!lines[start]?.startsWith('|')) {
      start += 1
      continue
    }
    let end = start
    while (lines[end]?.startsWith('|')) end += 1
    const rows = lines.slice(start, end).map((line) => (
      line.slice(1, -1).split('|').map((cell) => cell.trim())
    ))
    const widths = rows[0]!.map((_, column) => Math.max(3, ...rows
      .filter((_, row) => row !== 1)
      .map((cells) => cells[column]?.length ?? 0)))
    for (let row = 0; row < rows.length; row += 1) {
      lines[start + row] = `| ${rows[row]!.map((cell, column) => (
        row === 1 ? '-'.repeat(widths[column]!) : cell.padEnd(widths[column]!)
      )).join(' | ')} |`
    }
    start = end
  }
  return lines.join('\n')
}

function seedColorRules(
  fixturePath: string,
  targetRules: Record<string, unknown>,
) {
  const parsed = parseDocumentSettings(fs.readFileSync(fixturePath, 'utf8'))
  const metadata = parsed.frontmatter.metadata as Record<string, unknown>
  const currentColors = getDocumentTableColors(parsed.frontmatter) as ColorCollection
  metadata.tables = [
    {
      tableIndex: 0,
      fingerprint: 'seed-layout-target',
      columns: [91, 111, 131],
      style: { opaqueLegacy: 'keep-target' },
      futureLayout: 'keep-target',
    },
    {
      tableIndex: 1,
      fingerprint: 'seed-layout-sibling',
      columns: [101, 121, 141],
      style: { opaqueLegacy: 'keep-sibling' },
      futureLayout: 'keep-sibling',
    },
  ]
  metadata.tableStyles = [
    { tableIndex: 0, fingerprint: 'seed-style-target', opaqueStyle: 'keep-target' },
    { tableIndex: 1, fingerprint: 'seed-style-sibling', opaqueStyle: 'keep-sibling' },
  ]
  metadata.tableColors = [
    { tableIndex: 0, fingerprint: 'seed-color-target', ...targetRules },
    currentColors[1],
  ]
  metadata.colorIntegrityUnknown = { exact: ['keep', 42, null] }
  const seeded = serializeDocumentSettings(
    canonicalizeFixtureTables(parsed.body),
    parsed.settings,
    parsed.frontmatter,
  )
  fs.writeFileSync(fixturePath, seeded)
  return Buffer.from(seeded)
}

async function pickTableColor(
  page: Page,
  table: ReturnType<Page['locator']>,
  rowIndex: number,
  colIndex: number,
  scope: 'Cell' | 'Row' | 'Column',
  color: string | null,
) {
  await table.locator('tbody > tr').nth(rowIndex).locator('td, th').nth(colIndex).click({ button: 'right' })
  await page.getByRole('menuitem', { name: `${scope} Background` }).click()
  if (color) await page.locator(`.rv-office-color-swatch[title="${color}"]`).first().click()
  else await page.locator('.rv-office-color-none').click()
}

async function expectCellColor(
  table: ReturnType<Page['locator']>,
  rowIndex: number,
  colIndex: number,
  expected: string,
) {
  await expect.poll(() => table.locator('tbody > tr').nth(rowIndex).locator('td, th').nth(colIndex)
    .evaluate((cell) => getComputedStyle(cell).backgroundColor)).toBe(expected)
}

async function captureTableHistoryVisualState(table: ReturnType<Page['locator']>) {
  return table.evaluate((element) => ({
    columns: element.querySelectorAll('colgroup > col').length,
    rows: Array.from(element.rows, (row) => Array.from(row.cells, (cell) => ({
      color: getComputedStyle(cell).backgroundColor,
      text: cell.textContent?.trim() ?? '',
    }))),
  }))
}

test('[slice 02C.1] unsafe YAML ranks stay dormant and one real paint repairs save undo redo', async ({ page }) => {
  test.setTimeout(120_000)
  const files = await resetOfficePlaywrightScenario({
    scenario: 'color-integrity', copies: 2, workspaces: 1,
  })
  const fixture = files.find(
    ({ filename }: { filename: string }) => filename === 'Color Integrity--copy-02.md',
  )
  expect(fixture).toBeTruthy()
  const canonical = fs.readFileSync(fixture!.path)
  const seededBytes = seedColorRules(fixture!.path, {
    rows: { '0': { color: '#ff0000', rank: Number.MAX_SAFE_INTEGER } },
    columns: {
      '0': { color: '#ffff00', rank: Number.MAX_SAFE_INTEGER + 1 },
      '1': { color: '#00ff00', rank: 4 },
    },
  })
  const seededColors = readColorMetadata(fixture!.path)
  const untouchedSibling = structuredClone(seededColors[1])
  const saveCount = await captureColorSaveMessages(page, `001-Fixtures/${fixture!.filename}`)

  try {
    const editor = await openColorDocument(page, fixture!.filename)
    let tables = editor.locator('table.rv-office-table')
    let first = tables.nth(0)
    await expect(tables).toHaveCount(2)
    await page.waitForTimeout(750)
    await expect.poll(saveCount).toBe(0)
    expect(fs.readFileSync(fixture!.path)).toEqual(seededBytes)
    await expectCellColor(first, 0, 0, 'rgba(0, 0, 0, 0)')
    await expectCellColor(first, 0, 1, 'rgb(0, 255, 0)')

    await pickTableColor(page, first, 0, 0, 'Column', '#0000ff')
    await expect.poll(saveCount).toBe(1)
    await expectColorSaveResponses(page, 1)
    const repairedBytes = fs.readFileSync(fixture!.path)
    const repairedColors = readColorMetadata(fixture!.path)
    expect(repairedColors[0]).toEqual({
      tableIndex: 0,
      fingerprint: expect.any(String),
      columns: {
        '0': { color: '#0000ff', rank: 5 },
        '1': { color: '#00ff00', rank: 4 },
      },
    })
    expect(repairedColors[1]).toEqual(untouchedSibling)
    expect(repairedBytes).not.toEqual(seededBytes)
    await expectCellColor(first, 0, 0, 'rgb(0, 0, 255)')

    await page.keyboard.press('ControlOrMeta+z')
    await expect.poll(saveCount).toBe(2)
    await expectColorSaveResponses(page, 2)
    expect(fs.readFileSync(fixture!.path)).toEqual(seededBytes)
    await expectCellColor(first, 0, 0, 'rgba(0, 0, 0, 0)')

    await page.keyboard.press('ControlOrMeta+Shift+z')
    await expect.poll(saveCount).toBe(3)
    await expectColorSaveResponses(page, 3)
    expect(fs.readFileSync(fixture!.path)).toEqual(repairedBytes)
    await expectCellColor(first, 0, 0, 'rgb(0, 0, 255)')

    await page.keyboard.press('ControlOrMeta+s')
    await expect.poll(saveCount).toBe(4)
    await expectColorSaveResponses(page, 4)
    expect(fs.readFileSync(fixture!.path)).toEqual(repairedBytes)
    await page.reload()
    const reopened = page.locator(
      '.rv-office-document-editor .milkdown .ProseMirror[contenteditable="true"]',
    )
    await expect(reopened).toBeVisible()
    tables = reopened.locator('table.rv-office-table')
    first = tables.nth(0)
    await expect(tables).toHaveCount(2)
    expect(fs.readFileSync(fixture!.path)).toEqual(repairedBytes)
    await expectCellColor(first, 0, 0, 'rgb(0, 0, 255)')
  } finally {
    if (!page.isClosed()) await page.goto('about:blank')
    await waitForFixtureFileQuiescence(fixture!.path)
    const reset = await resetOfficePlaywrightScenario({
      scenario: 'color-integrity', copies: 2, workspaces: 1,
    })
    const restored = reset.find(
      ({ filename }: { filename: string }) => filename === 'Color Integrity--copy-02.md',
    )
    expect(restored).toBeTruthy()
    expect(fs.readFileSync(restored!.path)).toEqual(canonical)

    if (!page.isClosed()) {
      const verificationEditor = await openColorDocument(page, restored!.filename)
      const verificationTable = verificationEditor.locator('table.rv-office-table').first()
      await expectCellColor(verificationTable, 0, 0, 'rgb(255, 0, 0)')
      expect(await waitForFixtureFileQuiescence(restored!.path)).toEqual(canonical)
      expect(await saveCount()).toBe(0)
      await page.goto('about:blank')
      await page.close()
    }
    expect(await waitForFixtureFileQuiescence(restored!.path)).toEqual(canonical)
  }
})

for (const coverageCase of [
  { scope: 'Row' as const, row: 1, col: 2, clearColor: 'rgba(0, 0, 0, 0)' },
  { scope: 'Column' as const, row: 1, col: 2, clearColor: 'rgba(0, 0, 0, 0)' },
]) {
  test(`[slice 02C.2] actual ${coverageCase.scope.toLowerCase()} context-menu paint owns its scope in persisted frontmatter`, async ({ page }) => {
    test.setTimeout(120_000)
    const files = await resetOfficePlaywrightScenario({
      scenario: 'color-integrity', copies: 1, workspaces: 1,
    })
    const fixture = files.find(({ filename }: { filename: string }) => filename === 'Color Integrity.md')
    expect(fixture).toBeTruthy()
    const canonical = fs.readFileSync(fixture!.path)
    const saveCount = await captureColorSaveMessages(page)

    try {
      const editor = await openColorDocument(page, fixture!.filename)
      const table = editor.locator('table.rv-office-table').first()
      await expect(table).toBeVisible()
      await page.waitForTimeout(750)
      await expect.poll(saveCount).toBe(0)

      await pickTableColor(page, table, coverageCase.row, coverageCase.col, 'Cell', '#ffff00')
      await expect.poll(saveCount).toBe(1)
      await expectColorSaveResponses(page, 1)
      const afterCellBytes = fs.readFileSync(fixture!.path)
      const afterCell = readColorMetadata(fixture!.path)
      const cellKey = `${coverageCase.row},${coverageCase.col}`
      expect(afterCellBytes.toString()).toContain(`'${cellKey}': '#ffff00'`)
      expect(afterCell[0]?.cells).toEqual(expect.objectContaining({ [cellKey]: '#ffff00' }))
      await expectCellColor(table, coverageCase.row, coverageCase.col, 'rgb(255, 255, 0)')

      await pickTableColor(
        page,
        table,
        coverageCase.row,
        coverageCase.col,
        coverageCase.scope,
        '#00ffff',
      )
      await expect.poll(saveCount).toBe(2)
      await expectColorSaveResponses(page, 2)
      const afterScopeBytes = fs.readFileSync(fixture!.path)
      const afterScope = readColorMetadata(fixture!.path)
      expect(afterScopeBytes.toString()).not.toContain(`'${cellKey}': '#ffff00'`)
      expect(afterScope[0]?.cells).not.toHaveProperty(cellKey)
      await expectCellColor(table, coverageCase.row, coverageCase.col, 'rgb(0, 255, 255)')

      await pickTableColor(
        page,
        table,
        coverageCase.row,
        coverageCase.col,
        coverageCase.scope,
        null,
      )
      await expect.poll(saveCount).toBe(3)
      await expectColorSaveResponses(page, 3)
      const afterClearBytes = fs.readFileSync(fixture!.path)
      const afterClear = readColorMetadata(fixture!.path)
      expect(afterClearBytes).not.toEqual(afterScopeBytes)
      expect(afterClearBytes.toString()).not.toContain(`'${cellKey}': '#ffff00'`)
      if (coverageCase.scope === 'Column') {
        expect(afterClearBytes.toString()).toContain(`'${cellKey}': 'none'`)
        expect(afterClearBytes.toString()).not.toMatch(
          new RegExp(`'${cellKey}': (?:none|null|~)(?:\\n|$)`),
        )
        expect(afterClear[0]?.cells).toEqual(expect.objectContaining({ [cellKey]: 'none' }))
      } else {
        expect(afterClear[0]?.cells).not.toHaveProperty(cellKey)
      }
      await expectCellColor(table, coverageCase.row, coverageCase.col, coverageCase.clearColor)

      await page.keyboard.press('ControlOrMeta+z')
      await expect.poll(saveCount).toBe(4)
      await expectColorSaveResponses(page, 4)
      expect(fs.readFileSync(fixture!.path)).toEqual(afterScopeBytes)
      expect(readColorMetadata(fixture!.path)[0]?.cells).not.toHaveProperty(cellKey)
      await expectCellColor(table, coverageCase.row, coverageCase.col, 'rgb(0, 255, 255)')

      await page.keyboard.press('ControlOrMeta+z')
      await expect.poll(saveCount).toBe(5)
      await expectColorSaveResponses(page, 5)
      expect(fs.readFileSync(fixture!.path)).toEqual(afterCellBytes)
      expect(readColorMetadata(fixture!.path)[0]?.cells).toEqual(
        expect.objectContaining({ [cellKey]: '#ffff00' }),
      )
      await expectCellColor(table, coverageCase.row, coverageCase.col, 'rgb(255, 255, 0)')
    } finally {
      if (!page.isClosed()) await page.close()
      const reset = await resetOfficePlaywrightScenario({
        scenario: 'color-integrity', copies: 1, workspaces: 1,
      })
      const restored = reset.find(({ filename }: { filename: string }) => filename === 'Color Integrity.md')
      expect(restored).toBeTruthy()
      expect(fs.readFileSync(restored!.path)).toEqual(canonical)
    }
  })
}

test('[slice 02C.2] S1-S6 real Cell Row Column actions are exact persisted history units', async ({ page }) => {
  test.setTimeout(120_000)
  const files = await resetOfficePlaywrightScenario({
    scenario: 'color-integrity', copies: 1, workspaces: 1,
  })
  const fixture = files.find(({ filename }: { filename: string }) => filename === 'Color Integrity.md')
  expect(fixture).toBeTruthy()
  const canonical = fs.readFileSync(fixture!.path)
  const saveCount = await captureColorSaveMessages(page)

  try {
    const editor = await openColorDocument(page, fixture!.filename)
    const tables = editor.locator('table.rv-office-table')
    const first = tables.nth(0)
    const second = tables.nth(1)
    await expect(tables).toHaveCount(2)
    await page.waitForTimeout(750)
    await expect.poll(saveCount).toBe(0)
    const initial = readColorMetadata(fixture!.path)
    const untouchedSecond = structuredClone(initial[1])

    // The selected value is already explicit, but the fixture identity is
    // intentionally stale. Cleanup-only therefore emits exactly one unit.
    await pickTableColor(page, first, 0, 0, 'Cell', '#ff0000')
    await expect.poll(saveCount).toBe(1)
    const cleanupOnly = readColorMetadata(fixture!.path)
    expect(cleanupOnly[0]).toEqual(expect.objectContaining({
      tableIndex: 0,
      cells: initial[0]?.cells,
      rows: initial[0]?.rows,
      columns: initial[0]?.columns,
    }))
    expect(cleanupOnly[0]?.fingerprint).not.toBe(initial[0]?.fingerprint)
    expect(cleanupOnly[1]).toEqual(untouchedSecond)
    await page.keyboard.press('ControlOrMeta+z')
    await expect.poll(saveCount).toBe(2)
    expect(readColorMetadata(fixture!.path)).toEqual(initial)
    await page.keyboard.press('ControlOrMeta+Shift+z')
    await expect.poll(saveCount).toBe(3)
    expect(readColorMetadata(fixture!.path)).toEqual(cleanupOnly)

    await pickTableColor(page, first, 2, 0, 'Cell', '#ffff00')
    await expectCellColor(first, 2, 0, 'rgb(255, 255, 0)')
    await expect.poll(saveCount).toBe(4)
    let metadata = readColorMetadata(fixture!.path)
    expect(metadata[0]?.cells).toEqual({
      '0,0': '#ff0000', '1,1': '#00ff00', '2,0': '#ffff00', '2,2': '#0000ff',
    })
    expect(metadata[1]).toEqual(untouchedSecond)

    await first.locator('tbody > tr').nth(2).locator('td').first().click()
    await page.keyboard.press('ControlOrMeta+z')
    await expectCellColor(first, 2, 0, 'rgb(170, 221, 255)')
    await expect.poll(saveCount).toBe(5)
    expect(readColorMetadata(fixture!.path)).toEqual(cleanupOnly)
    await page.keyboard.press('ControlOrMeta+Shift+z')
    await expectCellColor(first, 2, 0, 'rgb(255, 255, 0)')
    await expect.poll(saveCount).toBe(6)

    // Once the successful commit has refreshed target identity, selecting the
    // already-explicit value has zero intended and cleanup delta.
    const afterCellRedo = readColorMetadata(fixture!.path)
    await pickTableColor(page, first, 2, 0, 'Cell', '#ffff00')
    await page.waitForTimeout(750)
    expect(await saveCount()).toBe(6)
    expect(readColorMetadata(fixture!.path)).toEqual(afterCellRedo)

    await pickTableColor(page, first, 0, 2, 'Row', '#00ffff')
    await expectCellColor(first, 0, 2, 'rgb(0, 255, 255)')
    await expect.poll(saveCount).toBe(7)
    metadata = readColorMetadata(fixture!.path)
    expect(metadata[0]?.rows).toEqual({
      '0': { color: '#00ffff', rank: 8 },
      '1': { color: '#ffeeaa', rank: 4 },
      '2': { color: '#aaddff', rank: 7 },
    })
    expect(metadata[1]).toEqual(untouchedSecond)
    await page.keyboard.press('ControlOrMeta+z')
    await expectCellColor(first, 0, 2, 'rgba(0, 0, 0, 0)')
    await expect.poll(saveCount).toBe(8)
    await page.keyboard.press('ControlOrMeta+Shift+z')
    await expectCellColor(first, 0, 2, 'rgb(0, 255, 255)')
    await expect.poll(saveCount).toBe(9)

    await pickTableColor(page, first, 1, 2, 'Column', '#9900ff')
    await expectCellColor(first, 1, 2, 'rgb(153, 0, 255)')
    await expect.poll(saveCount).toBe(10)
    metadata = readColorMetadata(fixture!.path)
    expect(metadata[0]?.columns).toEqual({
      '0': { color: '#ffccdd', rank: 3 },
      '1': { color: '#ccffdd', rank: 7 },
      '2': { color: '#9900ff', rank: 9 },
    })
    expect(metadata[1]).toEqual(untouchedSecond)
    await page.keyboard.press('ControlOrMeta+z')
    await expectCellColor(first, 1, 2, 'rgb(255, 238, 170)')
    await expect.poll(saveCount).toBe(11)
    await page.keyboard.press('ControlOrMeta+Shift+z')
    await expectCellColor(first, 1, 2, 'rgb(153, 0, 255)')
    await expect.poll(saveCount).toBe(12)

    // A text event is its own history event and carries no color snapshot.
    const textCell = first.locator('tbody > tr').nth(1).locator('td').first()
    await textCell.click()
    await page.keyboard.press('End')
    await page.keyboard.type(' text-history')
    await page.waitForTimeout(750)
    await expect.poll(saveCount).toBe(13)
    const colorsBeforeTextUndo = readColorMetadata(fixture!.path)
    await page.keyboard.press('ControlOrMeta+z')
    await expect(textCell).not.toContainText('text-history')
    expect(readColorMetadata(fixture!.path)).toEqual(colorsBeforeTextUndo)

    // Clear each scope. Every clear is one unit and each Undo/Redo restores exact state.
    for (const clearCase of [
      {
        scope: 'Column' as const, row: 1, col: 2,
        beforeColor: 'rgb(153, 0, 255)', forwardColor: 'rgba(0, 0, 0, 0)',
        expected: {
          cells: {
            '0,2': 'none', '1,1': '#00ff00', '1,2': 'none',
            '2,0': '#ffff00', '2,2': 'none',
          },
          rows: {
            '0': { color: '#00ffff', rank: 8 },
            '1': { color: '#ffeeaa', rank: 4 },
            '2': { color: '#aaddff', rank: 7 },
          },
          columns: {
            '0': { color: '#ffccdd', rank: 3 },
            '1': { color: '#ccffdd', rank: 7 },
          },
        },
      },
      {
        scope: 'Row' as const, row: 0, col: 2,
        beforeColor: 'rgba(0, 0, 0, 0)', forwardColor: 'rgba(0, 0, 0, 0)',
        expected: {
          cells: {
            '0,0': 'none', '0,1': 'none', '1,1': '#00ff00',
            '1,2': 'none', '2,0': '#ffff00', '2,2': 'none',
          },
          rows: {
            '1': { color: '#ffeeaa', rank: 4 },
            '2': { color: '#aaddff', rank: 7 },
          },
          columns: {
            '0': { color: '#ffccdd', rank: 3 },
            '1': { color: '#ccffdd', rank: 7 },
          },
        },
      },
      {
        scope: 'Cell' as const, row: 2, col: 0,
        beforeColor: 'rgb(255, 255, 0)', forwardColor: 'rgba(0, 0, 0, 0)',
        expected: {
          cells: {
            '0,0': 'none', '0,1': 'none', '1,1': '#00ff00',
            '1,2': 'none', '2,0': 'none', '2,2': 'none',
          },
          rows: {
            '1': { color: '#ffeeaa', rank: 4 },
            '2': { color: '#aaddff', rank: 7 },
          },
          columns: {
            '0': { color: '#ffccdd', rank: 3 },
            '1': { color: '#ccffdd', rank: 7 },
          },
        },
      },
    ]) {
      const beforeClear = readColorMetadata(fixture!.path)
      const beforeSaves = await saveCount()
      await expectCellColor(first, clearCase.row, clearCase.col, clearCase.beforeColor)
      await pickTableColor(page, first, clearCase.row, clearCase.col, clearCase.scope, null)
      await expect.poll(saveCount).toBe(beforeSaves + 1)
      const cleared = readColorMetadata(fixture!.path)
      expect(cleared[0]).toEqual(expect.objectContaining(clearCase.expected))
      expect(cleared[1]).toEqual(untouchedSecond)
      await expectCellColor(first, clearCase.row, clearCase.col, clearCase.forwardColor)
      await page.keyboard.press('ControlOrMeta+z')
      await expect.poll(saveCount).toBe(beforeSaves + 2)
      expect(readColorMetadata(fixture!.path)).toEqual(beforeClear)
      await expectCellColor(first, clearCase.row, clearCase.col, clearCase.beforeColor)
      await page.keyboard.press('ControlOrMeta+Shift+z')
      await expect.poll(saveCount).toBe(beforeSaves + 3)
      expect(readColorMetadata(fixture!.path)).toEqual(cleared)
      await expectCellColor(first, clearCase.row, clearCase.col, clearCase.forwardColor)
    }

    // The target identity is current and this covered Cell already has the
    // explicit mask, so clear must not dispatch, dirty, schedule, or save.
    const beforeAbsentClear = readColorMetadata(fixture!.path)
    const beforeAbsentClearSaves = await saveCount()
    await pickTableColor(page, first, 2, 0, 'Cell', null)
    await page.waitForTimeout(750)
    expect(await saveCount()).toBe(beforeAbsentClearSaves)
    expect(readColorMetadata(fixture!.path)).toEqual(beforeAbsentClear)
    await expectCellColor(first, 2, 0, 'rgba(0, 0, 0, 0)')

    // Capture a target, invalidate it before the swatch click, and prove zero effects.
    const beforeFailure = readColorMetadata(fixture!.path)
    const beforeFailureSaves = await saveCount()
    await second.locator('tbody > tr').nth(1).locator('td').first().click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Cell Background' }).click()
    await second.evaluate((table) => table.classList.remove('rv-office-table'))
    await page.locator('.rv-office-color-swatch[title="#ffff00"]').first().click()
    await page.waitForTimeout(750)
    expect(await saveCount()).toBe(beforeFailureSaves)
    expect(readColorMetadata(fixture!.path)).toEqual(beforeFailure)
  } finally {
    if (!page.isClosed()) await page.close()
    const reset = await resetOfficePlaywrightScenario({
      scenario: 'color-integrity', copies: 1, workspaces: 1,
    })
    const restored = reset.find(({ filename }: { filename: string }) => filename === 'Color Integrity.md')
    expect(restored).toBeTruthy()
    expect(fs.readFileSync(restored!.path)).toEqual(canonical)
  }
})

function readStructureColorState(fixturePath: string) {
  const parsed = parseMarkdownFrontmatter(fs.readFileSync(fixturePath, 'utf8'))
  return {
    tables: getDocumentTableLayouts(parsed.frontmatter),
    tableColors: getDocumentTableColors(parsed.frontmatter) as ColorCollection,
  }
}

test('[slice 02C.2] S8-S9 cumulative structure edits preserve and normalize colors atomically', async ({ page }) => {
  test.setTimeout(120_000)
  const files = await resetOfficePlaywrightScenario({
    scenario: 'structure', variant: 'metadata', copies: 1, workspaces: 1,
  })
  const fixture = files.find(({ filename }: { filename: string }) => filename === 'Structure-R5-C4.md')
  const oneColumnFixture = files.find(({ filename }: { filename: string }) => filename === 'Structure-R2-C1.md')
  expect(fixture).toBeTruthy()
  expect(oneColumnFixture).toBeTruthy()
  const canonical = new Map(files.map(({ path, filename }: { path: string; filename: string }) => (
    [filename, fs.readFileSync(path)]
  )))
  const saveCount = await captureColorSaveMessages(page)

  try {
    const editor = await openColorDocument(page, fixture!.filename)
    const table = editor.locator('table.rv-office-table')
    await expect(table.locator('tbody > tr')).toHaveCount(5)
    await expect(table.locator('colgroup > col')).toHaveCount(4)
    await page.waitForTimeout(750)
    await expect.poll(saveCount).toBe(0)

    const rowCases = [
      { label: 'first', row: 0, action: 'Insert Row Above', expectedCell: '3,2', expectedRow: '4' },
      { label: 'middle', row: 2, action: 'Insert Row Above', expectedCell: '3,2', expectedRow: '4' },
      { label: 'last', row: 4, action: 'Insert Row Below', expectedCell: '2,2', expectedRow: '3' },
    ]
    for (const rowCase of rowCases) {
      const before = readStructureColorState(fixture!.path)
      const beforeSaves = await saveCount()
      if (rowCase.label === 'middle') {
        await table.evaluate((element) => {
          const evidence = window as typeof window & {
            __officeColorStructureFrame?: {
              observer?: { oldCoordinate: string; shiftedCoordinate: string }
              animationFrame?: { oldCoordinate: string; shiftedCoordinate: string }
            }
          }
          evidence.__officeColorStructureFrame = {}
          const snapshot = () => ({
            oldCoordinate: element.rows[2]?.cells[2]
              ? getComputedStyle(element.rows[2].cells[2]).backgroundColor : '',
            shiftedCoordinate: element.rows[3]?.cells[2]
              ? getComputedStyle(element.rows[3].cells[2]).backgroundColor : '',
          })
          const observer = new MutationObserver(() => {
            if (element.rows.length !== 6 || evidence.__officeColorStructureFrame?.observer) return
            evidence.__officeColorStructureFrame!.observer = snapshot()
            requestAnimationFrame(() => {
              evidence.__officeColorStructureFrame!.animationFrame = snapshot()
            })
            observer.disconnect()
          })
          observer.observe(element, { childList: true, subtree: true })
        })
      }
      await table.locator('tbody > tr').nth(rowCase.row).locator('td, th').first().click({ button: 'right' })
      await page.getByRole('menuitem', { name: rowCase.action }).click()
      await expect(table.locator('tbody > tr')).toHaveCount(6)
      await expect.poll(saveCount).toBe(beforeSaves + 1)
      const after = readStructureColorState(fixture!.path)
      expect(after.tableColors[0]?.cells).toEqual({ [rowCase.expectedCell]: '#ffcccc' })
      expect(after.tableColors[0]?.rows).toEqual({
        [rowCase.expectedRow]: { color: '#fff2cc', rank: 4 },
      })
      expect(after.tableColors[0]?.columns).toEqual({
        '3': { color: '#e6ccff', rank: 5 },
      })
      const visibleCellRow = Number(rowCase.expectedCell.split(',')[0])
      await expectCellColor(table, visibleCellRow, 2, 'rgb(255, 204, 204)')
      if (rowCase.label === 'middle') {
        await expect.poll(() => page.evaluate(() => (
          window as typeof window & { __officeColorStructureFrame?: { animationFrame?: unknown } }
        ).__officeColorStructureFrame?.animationFrame)).toBeTruthy()
        expect(await page.evaluate(() => (
          window as typeof window & { __officeColorStructureFrame?: unknown }
        ).__officeColorStructureFrame)).toEqual({
          observer: {
            oldCoordinate: 'rgba(0, 0, 0, 0)',
            shiftedCoordinate: 'rgb(255, 204, 204)',
          },
          animationFrame: {
            oldCoordinate: 'rgba(0, 0, 0, 0)',
            shiftedCoordinate: 'rgb(255, 204, 204)',
          },
        })
      }
      await table.locator('tbody > tr').nth(visibleCellRow).locator('td, th').nth(2).click()
      await page.keyboard.press('ControlOrMeta+z')
      await expect(table.locator('tbody > tr')).toHaveCount(5)
      await expect.poll(saveCount).toBe(beforeSaves + 2)
      expect(readStructureColorState(fixture!.path)).toEqual(before)
    }

    const columnCases = [
      { label: 'first', col: 0, action: 'Insert Column Left', expectedCell: '2,3', expectedColumn: '4' },
      { label: 'middle', col: 2, action: 'Insert Column Left', expectedCell: '2,3', expectedColumn: '4' },
      { label: 'last', col: 3, action: 'Insert Column Right', expectedCell: '2,2', expectedColumn: '3' },
    ]
    for (const columnCase of columnCases) {
      const before = readStructureColorState(fixture!.path)
      const beforeSaves = await saveCount()
      await table.locator('tbody > tr').nth(2).locator('td, th').nth(columnCase.col).click({ button: 'right' })
      await page.getByRole('menuitem', { name: columnCase.action }).click()
      await expect(table.locator('colgroup > col')).toHaveCount(5)
      await expect.poll(saveCount).toBe(beforeSaves + 1)
      const after = readStructureColorState(fixture!.path)
      expect(after.tableColors[0]?.cells).toEqual({ [columnCase.expectedCell]: '#ffcccc' })
      expect(after.tableColors[0]?.rows).toEqual({ '3': { color: '#fff2cc', rank: 4 } })
      expect(after.tableColors[0]?.columns).toEqual({
        [columnCase.expectedColumn]: { color: '#e6ccff', rank: 5 },
      })
      expect(after.tables[0]?.columns).toHaveLength(5)
      const visibleCellColumn = Number(columnCase.expectedCell.split(',')[1])
      await expectCellColor(table, 2, visibleCellColumn, 'rgb(255, 204, 204)')
      await table.locator('tbody > tr').nth(2).locator('td, th').nth(visibleCellColumn).click()
      await page.keyboard.press('ControlOrMeta+z')
      await expect(table.locator('colgroup > col')).toHaveCount(4)
      await expect.poll(saveCount).toBe(beforeSaves + 2)
      expect(readStructureColorState(fixture!.path)).toEqual(before)
    }

    const oneColumnEditor = await openColorDocument(page, oneColumnFixture!.filename)
    const oneColumn = oneColumnEditor.locator('table.rv-office-table')
    await expect(oneColumn.locator('colgroup > col')).toHaveCount(1)
    const beforeOneToTwo = readStructureColorState(oneColumnFixture!.path)
    const beforeOneToTwoSaves = await saveCount()
    await oneColumn.locator('tbody > tr').nth(1).locator('td').click({ button: 'right' })
    const disabledDelete = page.getByRole('menuitem', { name: /Delete Column Right/ })
    await expect(disabledDelete).toBeDisabled()
    await page.waitForTimeout(750)
    expect(await saveCount()).toBe(beforeOneToTwoSaves)
    expect(readStructureColorState(oneColumnFixture!.path)).toEqual(beforeOneToTwo)
    await page.getByRole('menuitem', { name: 'Insert Column Right' }).click()
    await expect(oneColumn.locator('colgroup > col')).toHaveCount(2)
    await expect.poll(saveCount).toBe(beforeOneToTwoSaves + 1)
    const oneToTwo = readStructureColorState(oneColumnFixture!.path)
    expect(oneToTwo.tables[0]?.columns).toHaveLength(2)
    expect(oneToTwo.tableColors[0]?.cells).toEqual({ '1,0': '#ffeeaa' })
    await expectCellColor(oneColumn, 1, 0, 'rgb(255, 238, 170)')
    await expectCellColor(oneColumn, 1, 1, 'rgba(0, 0, 0, 0)')
  } finally {
    if (!page.isClosed()) await page.close()
    const reset = await resetOfficePlaywrightScenario({
      scenario: 'structure', variant: 'metadata', copies: 1, workspaces: 1,
    })
    for (const restored of reset) {
      expect(fs.readFileSync(restored.path)).toEqual(canonical.get(restored.filename))
    }
  }
})

test('[slice 02C.2] S6-S9 mixed cascade stays exact across structure and isolated text history', async ({ page }) => {
  test.setTimeout(120_000)
  const files = await resetOfficePlaywrightScenario({
    scenario: 'color-integrity', copies: 1, workspaces: 1,
  })
  const fixture = files.find(({ filename }: { filename: string }) => filename === 'Color Integrity.md')
  expect(fixture).toBeTruthy()
  const canonical = fs.readFileSync(fixture!.path)
  const saveCount = await captureColorSaveMessages(page)

  const initialRules = {
    cells: { '0,0': '#ff0000', '1,1': '#00ff00', '2,2': '#0000ff' },
    rows: {
      '1': { color: '#ffeeaa', rank: 4 },
      '2': { color: '#aaddff', rank: 7 },
    },
    columns: {
      '0': { color: '#ffccdd', rank: 3 },
      '1': { color: '#ccffdd', rank: 7 },
    },
  }
  const insertedRules = {
    cells: { '0,0': '#ff0000', '2,1': '#00ff00', '3,2': '#0000ff' },
    rows: {
      '2': { color: '#ffeeaa', rank: 4 },
      '3': { color: '#aaddff', rank: 7 },
    },
    columns: initialRules.columns,
  }
  const initialColors = [
    ['rgb(255, 0, 0)', 'rgb(204, 255, 221)', 'rgba(0, 0, 0, 0)'],
    ['rgb(255, 238, 170)', 'rgb(0, 255, 0)', 'rgb(255, 238, 170)'],
    ['rgb(170, 221, 255)', 'rgb(170, 221, 255)', 'rgb(0, 0, 255)'],
  ]
  const insertedColors = [
    initialColors[0],
    ['rgb(255, 204, 221)', 'rgb(204, 255, 221)', 'rgba(0, 0, 0, 0)'],
    initialColors[1],
    initialColors[2],
  ]

  try {
    const editor = await openColorDocument(page, fixture!.filename)
    const table = editor.locator('table.rv-office-table').first()
    const secondTable = editor.locator('table.rv-office-table').nth(1)
    await expect(editor.locator('table.rv-office-table')).toHaveCount(2)
    await page.waitForTimeout(750)
    await expect.poll(saveCount).toBe(0)

    const initialDisk = readStructureColorState(fixture!.path)
    const initialVisual = await captureTableHistoryVisualState(table)
    const untouchedSecondVisual = await captureTableHistoryVisualState(secondTable)
    const untouchedSecond = structuredClone(initialDisk.tableColors[1])
    expect(initialVisual.columns).toBe(3)
    expect(initialVisual.rows.map((row) => row.map(({ text }) => text))).toEqual([
      ['duplicate-header-h0', 'duplicate-header-h1', 'duplicate-header-h2'],
      ['color-a-r1c0', 'color-a-r1c1', 'color-a-r1c2'],
      ['color-a-r2c0', 'color-a-r2c1', 'color-a-r2c2'],
    ])
    expect(initialVisual.rows.map((row) => row.map(({ color }) => color))).toEqual(initialColors)
    expect(initialDisk.tableColors[0]).toEqual(expect.objectContaining(initialRules))

    // Structure event 1: insert a blank row immediately before the first data row.
    await table.locator('tbody > tr').nth(1).locator('td').first().click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Insert Row Above' }).click()
    await expect(table.locator('tbody > tr')).toHaveCount(4)
    await expect.poll(saveCount).toBe(1)
    const insertedDisk = readStructureColorState(fixture!.path)
    const insertedVisual = await captureTableHistoryVisualState(table)
    expect(insertedVisual).toEqual({
      columns: 3,
      rows: [
        initialVisual.rows[0],
        [
          { color: 'rgb(255, 204, 221)', text: '' },
          { color: 'rgb(204, 255, 221)', text: '' },
          { color: 'rgba(0, 0, 0, 0)', text: '' },
        ],
        initialVisual.rows[1],
        initialVisual.rows[2],
      ],
    })
    expect(insertedVisual.rows.map((row) => row.map(({ color }) => color))).toEqual(insertedColors)
    expect(insertedDisk.tableColors[0]).toEqual(expect.objectContaining(insertedRules))
    expect(insertedDisk.tableColors[1]).toEqual(untouchedSecond)

    // The ordinary text event sits between the structural actions. Its native
    // Undo removes only text: dimensions, exact metadata, and cascade remain
    // at the post-insert snapshot. The subsequent delete clears its redo branch.
    const insertedCell = table.locator('tbody > tr').nth(2).locator('td').first()
    await insertedCell.click()
    await page.keyboard.press('End')
    await page.keyboard.type('x')
    await expect(insertedCell).toContainText('x')
    await expect.poll(saveCount).toBe(2)
    expect(readStructureColorState(fixture!.path)).toEqual(insertedDisk)
    expect((await captureTableHistoryVisualState(table)).rows.map((row) => (
      row.map(({ color }) => color)
    ))).toEqual(insertedColors)
    await page.keyboard.press('ControlOrMeta+z')
    await expect(insertedCell).toHaveText('color-a-r1c0')
    await expect.poll(saveCount).toBe(3)
    expect(readStructureColorState(fixture!.path)).toEqual(insertedDisk)
    expect(await captureTableHistoryVisualState(table)).toEqual(insertedVisual)

    // Structure event 2: delete precisely the inserted blank row.
    await table.locator('tbody > tr').nth(2).locator('td').first().click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Delete Row Above' }).click()
    await expect(table.locator('tbody > tr')).toHaveCount(3)
    await expect.poll(saveCount).toBe(4)
    const deletedDisk = readStructureColorState(fixture!.path)
    const deletedVisual = await captureTableHistoryVisualState(table)
    expect(deletedVisual).toEqual(initialVisual)
    expect(deletedDisk.tableColors[0]).toEqual(expect.objectContaining(initialRules))
    expect(deletedDisk.tableColors[1]).toEqual(untouchedSecond)

    const assertState = async (
      saves: number,
      disk: ReturnType<typeof readStructureColorState>,
      visual: Awaited<ReturnType<typeof captureTableHistoryVisualState>>,
    ) => {
      await expect.poll(saveCount).toBe(saves)
      expect(readStructureColorState(fixture!.path)).toEqual(disk)
      expect(await captureTableHistoryVisualState(table)).toEqual(visual)
      expect(readStructureColorState(fixture!.path).tableColors[1]).toEqual(untouchedSecond)
      expect(await captureTableHistoryVisualState(secondTable)).toEqual(untouchedSecondVisual)
    }

    // Exactly two native Undo events traverse delete then insert; there is no
    // renderer-side history unit. Exactly two Redo events restore them.
    await page.keyboard.press('ControlOrMeta+z')
    await assertState(5, insertedDisk, insertedVisual)
    await page.keyboard.press('ControlOrMeta+z')
    await assertState(6, initialDisk, initialVisual)
    await page.keyboard.press('ControlOrMeta+Shift+z')
    await assertState(7, insertedDisk, insertedVisual)
    await page.keyboard.press('ControlOrMeta+Shift+z')
    await assertState(8, deletedDisk, deletedVisual)
  } finally {
    if (!page.isClosed()) await page.close()
    const reset = await resetOfficePlaywrightScenario({
      scenario: 'color-integrity', copies: 1, workspaces: 1,
    })
    const restored = reset.find(({ filename }: { filename: string }) => filename === 'Color Integrity.md')
    expect(restored).toBeTruthy()
    expect(fs.readFileSync(restored!.path)).toEqual(canonical)
  }
})

function readSequentialColorState(fixturePath: string) {
  const parsed = parseMarkdownFrontmatter(fs.readFileSync(fixturePath, 'utf8'))
  const metadata = parsed.frontmatter.metadata as Record<string, unknown>
  return {
    body: parsed.body,
    tables: getDocumentTableLayouts(parsed.frontmatter),
    tableColors: getDocumentTableColors(parsed.frontmatter) as ColorCollection,
    tableStyles: metadata.tableStyles,
    colorIntegrityUnknown: metadata.colorIntegrityUnknown,
    preserveUnknown: metadata.preserveUnknown,
  }
}

async function captureColorMatrix(table: ReturnType<Page['locator']>) {
  return table.evaluate((element) => Array.from(element.rows, (row) => (
    Array.from(row.cells, (cell) => getComputedStyle(cell).backgroundColor)
  )))
}

async function expectVisibleColumnWidths(
  table: ReturnType<Page['locator']>,
  expected: number[],
) {
  await expect.poll(() => table.locator('colgroup > col').evaluateAll((columns) => (
    columns.map((column) => Number.parseFloat((column as HTMLElement).style.width))
  ))).toEqual(expected)
}

test('[slice 02C.2] final color model survives rebuild history save close reopen exactly', async ({ page }) => {
  test.setTimeout(180_000)
  const files = await resetOfficePlaywrightScenario({
    scenario: 'color-integrity', copies: 1, workspaces: 1,
  })
  const fixture = files.find(({ filename }: { filename: string }) => filename === 'Color Integrity.md')
  expect(fixture).toBeTruthy()
  const canonical = fs.readFileSync(fixture!.path)
  const seeded = canonical.toString().replace(
    "  preserveUnknown: 'keep-me'\n",
    [
      "  preserveUnknown: 'keep-me'",
      "  colorIntegrityUnknown: { exact: ['keep', 42] }",
      '  tables:',
      "    - { tableIndex: 0, fingerprint: 'layout-target-stale', columns: [91, 111, 131], futureLayout: 'keep-target' }",
      "    - { tableIndex: 1, fingerprint: 'layout-sibling-stale', columns: [91, 111, 131], futureLayout: 'keep-sibling' }",
      '  tableStyles:',
      "    - { tableIndex: 0, fingerprint: 'style-target-stale', fixtureStyle: 'keep-target' }",
      "    - { tableIndex: 1, fingerprint: 'style-sibling-stale', fixtureStyle: 'keep-sibling' }",
      '',
    ].join('\n'),
  )
  expect(seeded).not.toBe(canonical.toString())
  fs.writeFileSync(fixture!.path, seeded)
  const seededState = readSequentialColorState(fixture!.path)
  const saveCount = await captureColorSaveMessages(page)

  const preRebuildMatrix = [
    ['rgb(0, 255, 255)', 'rgb(0, 255, 255)', 'rgb(153, 0, 255)'],
    ['rgb(255, 204, 221)', 'rgb(204, 255, 221)', 'rgb(153, 0, 255)'],
    ['rgb(255, 238, 170)', 'rgb(0, 255, 0)', 'rgb(153, 0, 255)'],
    ['rgb(170, 221, 255)', 'rgb(170, 221, 255)', 'rgb(153, 0, 255)'],
  ]
  const postCellMatrix = preRebuildMatrix.map((row) => [...row])
  postCellMatrix[1]![1] = 'rgb(255, 255, 0)'
  const finalMatrix = preRebuildMatrix.map((row) => [...row])
  finalMatrix[1]![1] = 'rgba(0, 0, 0, 0)'

  try {
    const editor = await openColorDocument(page, fixture!.filename)
    let tables = editor.locator('table.rv-office-table')
    let first = tables.nth(0)
    let second = tables.nth(1)
    await expect(tables).toHaveCount(2)
    await expectVisibleColumnWidths(first, [91, 111, 131])
    await expectVisibleColumnWidths(second, [91, 111, 131])
    await page.waitForTimeout(750)
    await expect.poll(saveCount).toBe(0)
    const untouchedSecondVisual = await captureTableHistoryVisualState(second)
    const untouchedSecondColors = structuredClone(seededState.tableColors[1])
    const untouchedSecondLayout = structuredClone((seededState.tables as unknown[])[1])
    const untouchedStyles = structuredClone(seededState.tableStyles)
    const untouchedUnknown = structuredClone(seededState.colorIntegrityUnknown)

    // Sequential batch before the rebuild: direct row paint, structural row
    // insertion, then direct column paint. Rank 8 belongs to the row and rank 9
    // to the column; the insertion shifts only row coordinates.
    await pickTableColor(page, first, 0, 2, 'Row', '#00ffff')
    await expect.poll(saveCount).toBe(1)
    await first.locator('tbody > tr').nth(1).locator('td').first().click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Insert Row Above' }).click()
    await expect(first.locator('tbody > tr')).toHaveCount(4)
    await expect.poll(saveCount).toBe(2)
    await pickTableColor(page, first, 1, 2, 'Column', '#9900ff')
    await expect.poll(saveCount).toBe(3)

    const beforeRebuild = readSequentialColorState(fixture!.path)
    expect(beforeRebuild.tableColors[0]).toEqual({
      tableIndex: 0,
      fingerprint: expect.any(String),
      cells: { '2,1': '#00ff00' },
      rows: {
        '0': { color: '#00ffff', rank: 8 },
        '2': { color: '#ffeeaa', rank: 4 },
        '3': { color: '#aaddff', rank: 7 },
      },
      columns: {
        '0': { color: '#ffccdd', rank: 3 },
        '1': { color: '#ccffdd', rank: 7 },
        '2': { color: '#9900ff', rank: 9 },
      },
    })
    expect(beforeRebuild.tableColors[1]).toEqual(untouchedSecondColors)
    expect((beforeRebuild.tables as unknown[])[0]).toEqual(expect.objectContaining({
      tableIndex: 0, columns: [91, 111, 131], futureLayout: 'keep-target',
    }))
    expect((beforeRebuild.tables as unknown[])[1]).toEqual(untouchedSecondLayout)
    expect(beforeRebuild.tableStyles).toEqual([
      {
        tableIndex: 0,
        fingerprint: expect.any(String),
        fixtureStyle: 'keep-target',
      },
      (untouchedStyles as unknown[])[1],
    ])
    expect((beforeRebuild.tableStyles as Array<Record<string, unknown>>)[0]?.fingerprint)
      .not.toBe('style-target-stale')
    const structurallyRefreshedStyles = structuredClone(beforeRebuild.tableStyles)
    expect(beforeRebuild.colorIntegrityUnknown).toEqual(untouchedUnknown)
    expect(beforeRebuild.preserveUnknown).toBe('keep-me')
    expect(await captureColorMatrix(first)).toEqual(preRebuildMatrix)
    expect(await captureTableHistoryVisualState(second)).toEqual(untouchedSecondVisual)

    // Reload destroys and reconstructs the Crepe/ProseMirror editor. Initial
    // metadata application must be read-only and reproduce disk state exactly.
    await page.reload()
    const rebuilt = page.locator('.rv-office-document-editor .milkdown .ProseMirror[contenteditable="true"]')
    await expect(rebuilt).toBeVisible()
    tables = rebuilt.locator('table.rv-office-table')
    first = tables.nth(0)
    second = tables.nth(1)
    await expect(tables).toHaveCount(2)
    await expect(first.locator('tbody > tr')).toHaveCount(4)
    await expectVisibleColumnWidths(first, [91, 111, 131])
    await expectVisibleColumnWidths(second, [91, 111, 131])
    expect(readSequentialColorState(fixture!.path)).toEqual(beforeRebuild)
    expect(await captureColorMatrix(first)).toEqual(preRebuildMatrix)
    expect(await captureTableHistoryVisualState(second)).toEqual(untouchedSecondVisual)
    await page.waitForTimeout(750)
    await expect.poll(saveCount).toBe(0)

    // Sequential batch after the rebuild. Set then clear a temporary cell rule
    // as two exact metadata history units; the structural coordinates established
    // before rebuild must remain singly shifted throughout.
    await pickTableColor(page, first, 1, 1, 'Cell', '#ffff00')
    await expect.poll(saveCount).toBe(1)
    await expectColorSaveResponses(page, 1)
    const afterCell = readSequentialColorState(fixture!.path)
    expect(afterCell.tableColors[0]?.cells).toEqual({
      '1,1': '#ffff00', '2,1': '#00ff00',
    })
    expect(await captureColorMatrix(first)).toEqual(postCellMatrix)

    await pickTableColor(page, first, 1, 1, 'Cell', null)
    await expect(first.locator('tbody > tr')).toHaveCount(4)
    await expect.poll(saveCount).toBe(2)
    await expectColorSaveResponses(page, 2)
    const finalState = readSequentialColorState(fixture!.path)
    expect(finalState.tableColors[0]).toEqual({
      tableIndex: 0,
      fingerprint: expect.any(String),
      cells: { '1,1': 'none', '2,1': '#00ff00' },
      rows: {
        '0': { color: '#00ffff', rank: 8 },
        '2': { color: '#ffeeaa', rank: 4 },
        '3': { color: '#aaddff', rank: 7 },
      },
      columns: {
        '0': { color: '#ffccdd', rank: 3 },
        '1': { color: '#ccffdd', rank: 7 },
        '2': { color: '#9900ff', rank: 9 },
      },
    })
    expect(finalState.tableColors[1]).toEqual(untouchedSecondColors)
    expect((finalState.tables as unknown[])[0]).toEqual(expect.objectContaining({
      tableIndex: 0, columns: [91, 111, 131], futureLayout: 'keep-target',
    }))
    expect((finalState.tables as unknown[])[1]).toEqual(untouchedSecondLayout)
    expect(finalState.tableStyles).toEqual(structurallyRefreshedStyles)
    expect(finalState.colorIntegrityUnknown).toEqual(untouchedUnknown)
    expect(finalState.preserveUnknown).toBe('keep-me')
    expect(finalState).not.toEqual(beforeRebuild)
    expect(fs.readFileSync(fixture!.path, 'utf8')).toContain("'1,1': 'none'")
    expect(await captureColorMatrix(first)).toEqual(finalMatrix)
    expect(await captureTableHistoryVisualState(second)).toEqual(untouchedSecondVisual)

    const assertHistoryState = async (
      saves: number,
      expectedDisk: ReturnType<typeof readSequentialColorState>,
      expectedMatrix: string[][],
    ) => {
      await expect.poll(saveCount).toBe(saves)
      await expectColorSaveResponses(page, saves)
      const actualDisk = readSequentialColorState(fixture!.path)
      const normalizedBody = (body: string) => body.split('\n').map((line) => (
        line.startsWith('|')
          ? line.slice(1, -1).split('|').map((cell) => (
            cell.trim().replaceAll('<br />', '<br>')
          )).join('|')
          : line
      )).join('\n')
      expect({
        ...actualDisk,
        body: normalizedBody(actualDisk.body),
      }).toEqual({
        ...expectedDisk,
        body: normalizedBody(expectedDisk.body),
      })
      expect(await captureColorMatrix(first)).toEqual(expectedMatrix)
      expect(await captureTableHistoryVisualState(second)).toEqual(untouchedSecondVisual)
      await expectVisibleColumnWidths(first, [91, 111, 131])
      await expectVisibleColumnWidths(second, [91, 111, 131])
    }

    await page.keyboard.press('ControlOrMeta+z')
    await assertHistoryState(3, afterCell, postCellMatrix)
    await page.keyboard.press('ControlOrMeta+z')
    await assertHistoryState(4, beforeRebuild, preRebuildMatrix)
    await page.keyboard.press('ControlOrMeta+Shift+z')
    await assertHistoryState(5, afterCell, postCellMatrix)
    await page.keyboard.press('ControlOrMeta+Shift+z')
    await assertHistoryState(6, finalState, finalMatrix)

    // Exercise an explicit save while clean, then reload into a fresh renderer.
    // Neither action may rewrite metadata.
    await page.keyboard.press('ControlOrMeta+s')
    await expect.poll(saveCount).toBe(7)
    await expectColorSaveResponses(page, 7)
    const manuallySavedBytes = fs.readFileSync(fixture!.path)
    expect(readSequentialColorState(fixture!.path)).toEqual(finalState)
    await page.reload()
    const reopened = page.locator('.rv-office-document-editor .milkdown .ProseMirror[contenteditable="true"]')
    await expect(reopened).toBeVisible()
    const reopenedTables = reopened.locator('table.rv-office-table')
    const reopenedFirst = reopenedTables.nth(0)
    const reopenedSecond = reopenedTables.nth(1)
    await expect(reopenedTables).toHaveCount(2)
    await expectVisibleColumnWidths(reopenedFirst, [91, 111, 131])
    await expectVisibleColumnWidths(reopenedSecond, [91, 111, 131])
    expect(readSequentialColorState(fixture!.path)).toEqual(finalState)
    await expect.poll(() => captureColorMatrix(reopenedFirst)).toEqual(finalMatrix)
    expect(await captureTableHistoryVisualState(reopenedSecond)).toEqual(untouchedSecondVisual)
    await page.waitForTimeout(750)
    await expect.poll(saveCount).toBe(0)
    expect(fs.readFileSync(fixture!.path)).toEqual(manuallySavedBytes)
  } finally {
    if (!page.isClosed()) await page.close()
    const reset = await resetOfficePlaywrightScenario({
      scenario: 'color-integrity', copies: 1, workspaces: 1,
    })
    const restored = reset.find(({ filename }: { filename: string }) => filename === 'Color Integrity.md')
    expect(restored).toBeTruthy()
    expect(fs.readFileSync(restored!.path)).toEqual(canonical)
  }
})

test('[slice 02C.2] explicit masks serialize as single-quoted none without changing YAML nulls', () => {
  const opaque = 'alpha\nfoo: none\nomega'
  const opaqueFolded = `${Array.from({ length: 30 }, () => 'alpha').join(' ')}\nfoo: none\nomega`
  const opaqueIndented = '  alpha\nfoo: none\nomega'
  const serialized = serializeDocumentSettings('Body\nfoo: none', DEFAULT_SETTINGS, {
    metadata: {
      tableColors: [{ tableIndex: 0, fingerprint: 'quoted-none', cells: { '0,0': 'none' } }],
      unrelatedNoneString: 'none',
      unrelatedNull: null,
      opaque,
      opaqueFolded,
      opaqueIndented,
      sequenceMapping: [{ opaque, after: 'none' }],
      nestedSequence: [['none']],
    },
  })

  expect(serialized).toContain("'0,0': 'none'")
  expect(serialized).toContain("unrelatedNoneString: 'none'")
  expect(serialized).toContain('unrelatedNull: null')
  expect(serialized).toContain('    foo: none')
  expect(serialized).toMatch(/opaqueFolded: >[-+]?/)
  expect(serialized).toMatch(/opaqueIndented: \|2[-+]?/)
  expect(serialized).toContain("      after: 'none'")
  expect(serialized).toContain("    - - 'none'")
  expect(serialized).not.toMatch(/'0,0': (?:none|null|~)(?:\n|$)/)
  const parsed = parseMarkdownFrontmatter(serialized)
  expect(parsed.body.trim()).toBe('Body\nfoo: none')
  expect(parsed.frontmatter).toEqual(expect.objectContaining({
    metadata: expect.objectContaining({ unrelatedNoneString: 'none', unrelatedNull: null }),
  }))
  expect((parsed.frontmatter.metadata as Record<string, unknown>).opaque).toBe(opaque)
  expect((parsed.frontmatter.metadata as Record<string, unknown>).opaqueFolded).toBe(opaqueFolded)
  expect((parsed.frontmatter.metadata as Record<string, unknown>).opaqueIndented).toBe(opaqueIndented)
  expect((parsed.frontmatter.metadata as Record<string, unknown>).sequenceMapping).toEqual([
    { opaque, after: 'none' },
  ])
  expect((parsed.frontmatter.metadata as Record<string, unknown>).nestedSequence).toEqual([['none']])
})

test('[slice 02C.2] S7 rankless bands stay dormant until a real-menu mutation repairs only the target', async ({ page }) => {
  test.setTimeout(120_000)
  const files = await resetOfficePlaywrightScenario({
    scenario: 'color-integrity', copies: 1, workspaces: 1,
  })
  const fixture = files.find(({ filename }: { filename: string }) => filename === 'Color Integrity.md')
  expect(fixture).toBeTruthy()
  const canonical = fs.readFileSync(fixture!.path)
  const seededBytes = seedColorRules(fixture!.path, {
    cells: {
      '0,2': 'none',
      '1,2': '#123456',
      '9,9': '#ffffff',
      malformed: '#abcdef',
    },
    rows: {
      '0': { color: '#ff0000' },
      '2': { color: '#ffff00', rank: 4 },
      '8': { color: '#ffffff', rank: 9 },
    },
    columns: {
      '0': { color: '#0000ff' },
      '1': { color: '#00ff00', rank: 2 },
      '-1': { color: '#ffffff', rank: 8 },
    },
  })
  const seededState = readSequentialColorState(fixture!.path)
  const untouchedSibling = structuredClone(seededState.tableColors[1])
  const saveCount = await captureColorSaveMessages(page)

  try {
    const editor = await openColorDocument(page, fixture!.filename)
    const tables = editor.locator('table.rv-office-table')
    const first = tables.nth(0)
    const second = tables.nth(1)
    await expect(tables).toHaveCount(2)
    await page.waitForTimeout(750)
    await expect.poll(saveCount).toBe(0)
    expect(fs.readFileSync(fixture!.path)).toEqual(seededBytes)
    await expectCellColor(first, 0, 0, 'rgb(255, 0, 0)')
    await expectCellColor(first, 0, 2, 'rgba(0, 0, 0, 0)')
    const siblingVisual = await captureTableHistoryVisualState(second)

    const textCell = first.locator('tbody > tr').nth(1).locator('td').first()
    await textCell.click()
    await page.keyboard.press('End')
    await page.keyboard.type(' text-only')
    await expect.poll(saveCount).toBe(1)
    const textBytes = fs.readFileSync(fixture!.path)
    const textState = readSequentialColorState(fixture!.path)
    expect(textState.tableColors).toEqual(seededState.tableColors)

    await pickTableColor(page, first, 2, 2, 'Cell', '#00ffff')
    await expect.poll(saveCount).toBe(2)
    await expectColorSaveResponses(page, 2)
    const repairedBytes = fs.readFileSync(fixture!.path)
    const repaired = readSequentialColorState(fixture!.path)
    expect(repaired.tableColors[0]).toEqual({
      tableIndex: 0,
      fingerprint: expect.any(String),
      cells: { '0,2': 'none', '1,2': '#123456', '2,2': '#00ffff' },
      rows: {
        '0': { color: '#ff0000', rank: 0 },
        '2': { color: '#ffff00', rank: 4 },
      },
      columns: {
        '0': { color: '#0000ff', rank: 0 },
        '1': { color: '#00ff00', rank: 2 },
      },
    })
    expect(repaired.tableColors[1]).toEqual(untouchedSibling)
    expect(repaired.tables).toEqual(seededState.tables)
    expect(repaired.tableStyles).toEqual(seededState.tableStyles)
    expect(repaired.colorIntegrityUnknown).toEqual(seededState.colorIntegrityUnknown)
    expect(repaired.body).toEqual(textState.body)
    expect(repairedBytes.toString()).toContain("'0,2': 'none'")
    expect(repairedBytes.toString()).not.toMatch(/'0,2': (?:none|null|~)(?:\n|$)/)
    await expectCellColor(first, 0, 0, 'rgb(255, 0, 0)')
    await expectCellColor(first, 2, 2, 'rgb(0, 255, 255)')
    expect(await captureTableHistoryVisualState(second)).toEqual(siblingVisual)

    await page.keyboard.press('ControlOrMeta+z')
    await expect.poll(saveCount).toBe(3)
    expect(fs.readFileSync(fixture!.path)).toEqual(textBytes)
    await expectCellColor(first, 2, 2, 'rgb(255, 255, 0)')
    await page.keyboard.press('ControlOrMeta+Shift+z')
    await expect.poll(saveCount).toBe(4)
    expect(fs.readFileSync(fixture!.path)).toEqual(repairedBytes)
    await expectCellColor(first, 2, 2, 'rgb(0, 255, 255)')
  } finally {
    if (!page.isClosed()) await page.close()
    const reset = await resetOfficePlaywrightScenario({
      scenario: 'color-integrity', copies: 1, workspaces: 1,
    })
    const restored = reset.find(({ filename }: { filename: string }) => filename === 'Color Integrity.md')
    expect(restored).toBeTruthy()
    expect(fs.readFileSync(restored!.path)).toEqual(canonical)
  }
})

for (const scenario of [
  {
    name: 'winning matching band deletes a stale explicit entry',
    targetRules: {
      cells: { '0,0': '#00ff00' },
      rows: { '0': { color: '#ff0000', rank: 3 } },
      columns: { '0': { color: '#0000ff', rank: 2 } },
    },
    expectedRules: {
      rows: { '0': { color: '#ff0000', rank: 3 } },
      columns: { '0': { color: '#0000ff', rank: 2 } },
    },
  },
  {
    name: 'multiple matching bands use the already-winning branch',
    targetRules: {
      cells: { '0,0': '#00ff00' },
      rows: { '0': { color: '#ff0000', rank: 1 } },
      columns: { '0': { color: '#ff0000', rank: 3 } },
    },
    expectedRules: {
      rows: { '0': { color: '#ff0000', rank: 1 } },
      columns: { '0': { color: '#ff0000', rank: 3 } },
    },
  },
  {
    name: 'safe losing row reranks without a cell entry or collateral render change',
    targetRules: {
      rows: { '0': { color: '#ff0000', rank: 1 } },
      columns: { '0': { color: '#0000ff', rank: 2 } },
    },
    expectedRules: {
      rows: { '0': { color: '#ff0000', rank: 3 } },
      columns: { '0': { color: '#0000ff', rank: 2 } },
    },
  },
  {
    name: 'rerank guard falls back to exactly one explicit cell',
    targetRules: {
      rows: { '0': { color: '#ff0000', rank: 1 } },
      columns: {
        '0': { color: '#0000ff', rank: 2 },
        '1': { color: '#00ff00', rank: 2 },
      },
    },
    expectedRules: {
      cells: { '0,0': '#ff0000' },
      rows: { '0': { color: '#ff0000', rank: 1 } },
      columns: {
        '0': { color: '#0000ff', rank: 2 },
        '1': { color: '#00ff00', rank: 2 },
      },
    },
  },
]) {
  test(`[slice 02C.2] S10 ${scenario.name} through the real menu and persisted bytes`, async ({ page }) => {
    test.setTimeout(120_000)
    const files = await resetOfficePlaywrightScenario({
      scenario: 'color-integrity', copies: 1, workspaces: 1,
    })
    const fixture = files.find(({ filename }: { filename: string }) => filename === 'Color Integrity.md')
    expect(fixture).toBeTruthy()
    const canonical = fs.readFileSync(fixture!.path)
    const seededBytes = seedColorRules(fixture!.path, scenario.targetRules)
    const seededState = readSequentialColorState(fixture!.path)
    const saveCount = await captureColorSaveMessages(page)

    try {
      const editor = await openColorDocument(page, fixture!.filename)
      let tables = editor.locator('table.rv-office-table')
      let first = tables.nth(0)
      let second = tables.nth(1)
      await expect(tables).toHaveCount(2)
      await page.waitForTimeout(750)
      await expect.poll(saveCount).toBe(0)
      expect(fs.readFileSync(fixture!.path)).toEqual(seededBytes)
      const beforeMatrix = await captureColorMatrix(first)
      const siblingVisual = await captureTableHistoryVisualState(second)

      await pickTableColor(page, first, 0, 0, 'Cell', '#ff0000')
      await expect.poll(saveCount).toBe(1)
      await expectColorSaveResponses(page, 1)
      const afterBytes = fs.readFileSync(fixture!.path)
      const after = readSequentialColorState(fixture!.path)
      expect(after.tableColors[0]).toEqual({
        tableIndex: 0,
        fingerprint: expect.any(String),
        ...scenario.expectedRules,
      })
      expect(after.tableColors[1]).toEqual(seededState.tableColors[1])
      expect(after.tables).toEqual(seededState.tables)
      expect(after.tableStyles).toEqual(seededState.tableStyles)
      expect(after.colorIntegrityUnknown).toEqual(seededState.colorIntegrityUnknown)
      expect(after.body).toEqual(seededState.body)
      const afterMatrix = beforeMatrix.map((row) => [...row])
      afterMatrix[0]![0] = 'rgb(255, 0, 0)'
      await expect.poll(() => captureColorMatrix(first)).toEqual(afterMatrix)
      await expect.poll(() => captureTableHistoryVisualState(second)).toEqual(siblingVisual)
      if (scenario.name.startsWith('safe losing')) {
        expect(after.tableColors[0]?.cells).toBeUndefined()
        expect(afterMatrix.slice(1)).toEqual(beforeMatrix.slice(1))
        expect(afterMatrix[0]!.slice(1)).toEqual(beforeMatrix[0]!.slice(1))
      }
      if (scenario.name.startsWith('rerank guard')) {
        expect(after.tableColors[0]?.cells).toEqual({ '0,0': '#ff0000' })
        expect(afterMatrix[0]![1]).toBe(beforeMatrix[0]![1])
      }

      await page.keyboard.press('ControlOrMeta+z')
      await expect.poll(saveCount).toBe(2)
      await expectColorSaveResponses(page, 2)
      expect(fs.readFileSync(fixture!.path)).toEqual(seededBytes)
      expect(await captureColorMatrix(first)).toEqual(beforeMatrix)
      await page.keyboard.press('ControlOrMeta+Shift+z')
      await expect.poll(saveCount).toBe(3)
      await expectColorSaveResponses(page, 3)
      expect(fs.readFileSync(fixture!.path)).toEqual(afterBytes)
      expect(await captureColorMatrix(first)).toEqual(afterMatrix)

      await page.keyboard.press('ControlOrMeta+s')
      await expect.poll(saveCount).toBe(4)
      await expectColorSaveResponses(page, 4)
      expect(fs.readFileSync(fixture!.path)).toEqual(afterBytes)
      await page.reload()
      const reopened = page.locator(
        '.rv-office-document-editor .milkdown .ProseMirror[contenteditable="true"]',
      )
      await expect(reopened).toBeVisible()
      tables = reopened.locator('table.rv-office-table')
      first = tables.nth(0)
      second = tables.nth(1)
      await expect(tables).toHaveCount(2)
      expect(fs.readFileSync(fixture!.path)).toEqual(afterBytes)
      await expect.poll(() => captureColorMatrix(first)).toEqual(afterMatrix)
      await expect.poll(() => captureTableHistoryVisualState(second)).toEqual(siblingVisual)
      await page.waitForTimeout(750)
      await expect.poll(saveCount).toBe(0)
    } finally {
      if (!page.isClosed()) await page.close()
      const reset = await resetOfficePlaywrightScenario({
        scenario: 'color-integrity', copies: 1, workspaces: 1,
      })
      const restored = reset.find(({ filename }: { filename: string }) => filename === 'Color Integrity.md')
      expect(restored).toBeTruthy()
      expect(fs.readFileSync(restored!.path)).toEqual(canonical)
    }
  })
}
