/**
 * @module officeTableMutations
 * @role Pure table mutation planning plus capture/preflight/single-dispatch coordination.
 */
import type { CommandManager } from '@milkdown/kit/core';
import type { CmdKey } from '@milkdown/kit/core';
import type { Node as ProseNode } from '@milkdown/kit/prose/model';
import {
  Plugin,
  PluginKey,
  Selection,
  TextSelection,
  type Command,
  type EditorState,
  type Transaction,
} from '@milkdown/kit/prose/state';
import { $prose } from '@milkdown/kit/utils';
import type { EditorView } from '@milkdown/kit/prose/view';
import { closeHistory } from '@milkdown/kit/prose/history';
import {
  TableMap,
  addColumn,
  addRow,
  removeColumn,
  removeRow,
  type Rect,
  type TableRect,
} from '@milkdown/kit/prose/tables';
import {
  cloneOfficeTableRawValue,
  type DocumentTableColors,
  type DocumentTableLayout,
  type DocumentTableStyle,
} from '../../lib/front-matter';
import {
  reindexColorRules,
  type OfficeTableColorRules,
} from './officeTableColorPolicy';
import {
  cancelOfficeTableMetadataExternalSnapshot,
  deferOfficeTableMetadataExternalPublication,
  notifyOfficeTableMetadataTestHook,
  OfficeTableMetadataStep,
  publishOfficeTableMetadataExternalSnapshot,
  type OfficeTableMetadataSnapshot,
  readOfficeTableMetadataSnapshot,
  snapshotsEqual,
} from './officeTableHistory';
import {
  findStructureTableIdentityEntry,
  findTableIdentityEntry,
  fingerprintProseTable,
  getOfficeTables,
  type OfficeTableIdentity,
} from './officeTableIdentity';
import {
  measureOfficeTableLogicalWidths,
  resolveOfficeTableSquareMinimum,
} from './officeTableGeometry';
import { getVerifiedOfficeTableTitleWidth } from './officeTableTitleCodec';

export type OfficeTableStructureMutation =
  | { axis: 'row'; action: 'insert' | 'delete'; index: number }
  | { axis: 'column'; action: 'insert'; index: number; anchorIndex: number }
  | { axis: 'column'; action: 'delete'; index: number };

export type OfficeTableTitleRowAction = 'add' | 'delete';

export const officeTableInitializationNormalizationKey = new PluginKey<boolean>(
  'officeTableInitializationNormalization',
);

export type OfficeTableDimensions = { rows: number; columns: number };

export type OfficeTableMutationPlan = {
  mutation: OfficeTableStructureMutation;
  before: OfficeTableDimensions;
  expected: OfficeTableDimensions;
};

export type OfficeTableMutationResult = {
  applied: boolean;
  reason: 'applied' | 'invalid-plan' | 'selection-failed' | 'command-rejected'
    | 'transaction-count' | 'preflight-failed' | 'metadata-unavailable' | 'live-verification-failed';
  target?: OfficeTableIdentity;
  mutation: OfficeTableStructureMutation;
  before?: OfficeTableDimensions;
  expected?: OfficeTableDimensions;
  proposedTransaction?: Transaction;
  nextDocument?: ProseNode;
  next?: OfficeTableDimensions;
  metadataBefore?: OfficeTableMetadataSnapshot;
  metadataAfter?: OfficeTableMetadataSnapshot;
  live?: OfficeTableDimensions;
};

export class OfficeTableMutationInvariantError extends Error {
  readonly result: OfficeTableMutationResult;

  constructor(result: OfficeTableMutationResult) {
    super('BLOCKED: Office table mutation failed its post-dispatch invariant');
    this.name = 'OfficeTableMutationInvariantError';
    this.result = result;
  }
}

type TableRecord = { node: ProseNode; pos: number; index: number };

function cloneValue<T>(value: T): T {
  return cloneOfficeTableRawValue(value);
}

function tablesInDocument(doc: ProseNode): TableRecord[] {
  const tables: TableRecord[] = [];
  doc.descendants((node, pos) => {
    if (node.type.name === 'table') tables.push({ node, pos, index: tables.length });
    return node.type.name !== 'table';
  });
  return tables;
}

export function captureOfficeCommand(state: EditorState, command: Command) {
  const transactions: Transaction[] = [];
  const accepted = command(state, (transaction) => { transactions.push(transaction); });
  return { accepted, transactions };
}

function dimensionsOf(table: ProseNode): OfficeTableDimensions {
  const map = TableMap.get(table);
  return { rows: map.height, columns: map.width };
}

function hasCoherentOfficeTableMap(table: ProseNode): boolean {
  const problems = TableMap.get(table).problems;
  return !problems || problems.length === 0;
}

type LogicalCellRecord = { node: ProseNode; rect: Rect };

function logicalCellRecords(table: ProseNode, map: TableMap): LogicalCellRecord[] | null {
  const records: LogicalCellRecord[] = [];
  const seen = new Set<number>();
  for (const position of map.map) {
    if (seen.has(position)) continue;
    seen.add(position);
    const node = table.nodeAt(position);
    if (!node) return null;
    const rect = map.findCell(position);
    records.push({
      node,
      rect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom },
    });
  }
  return records;
}

function cellRectKey(rect: Rect): string {
  return `${rect.top}:${rect.bottom}:${rect.left}:${rect.right}`;
}

function createExpectedCell(
  source: ProseNode,
  type: ProseNode['type'],
  rowspanDelta = 0,
  blank = false,
): ProseNode | null {
  const attrs = { ...cloneValue(source.attrs) };
  if (rowspanDelta !== 0) {
    if (!Number.isInteger(attrs.rowspan) || attrs.rowspan + rowspanDelta < 1) return null;
    attrs.rowspan += rowspanDelta;
  }
  return blank
    ? type.createAndFill(attrs)
    : type.create(attrs, source.content, source.marks);
}

function createExpectedColumnSpanCell(
  source: ProseNode,
  columnOffset: number,
  action: 'insert' | 'delete',
): ProseNode | null {
  const attrs = { ...cloneValue(source.attrs) };
  if (!Number.isInteger(attrs.colspan) || attrs.colspan < (action === 'delete' ? 2 : 1)) return null;
  attrs.colspan += action === 'insert' ? 1 : -1;
  if (attrs.colwidth !== null && attrs.colwidth !== undefined) {
    if (!Array.isArray(attrs.colwidth) || attrs.colwidth.length !== source.attrs.colspan) return null;
    attrs.colwidth = [...attrs.colwidth];
    if (action === 'insert') attrs.colwidth.splice(columnOffset, 0, 0);
    else {
      attrs.colwidth.splice(columnOffset, 1);
      if (!attrs.colwidth.some((width: unknown) => typeof width === 'number' && width > 0)) {
        attrs.colwidth = null;
      }
    }
  }
  return source.type.create(attrs, source.content, source.marks);
}

function verifyExpectedLogicalCells(
  expected: readonly LogicalCellRecord[],
  nextTable: ProseNode,
  nextMap: TableMap,
): boolean {
  const actual = logicalCellRecords(nextTable, nextMap);
  if (!actual || actual.length !== expected.length) return false;
  const actualByRect = new Map(actual.map((record) => [cellRectKey(record.rect), record]));
  if (actualByRect.size !== actual.length) return false;
  for (const record of expected) {
    const key = cellRectKey(record.rect);
    const next = actualByRect.get(key);
    if (!next || !next.node.eq(record.node)) return false;
    actualByRect.delete(key);
  }
  return actualByRect.size === 0;
}

function sameWrapperMarkup(
  actual: ProseNode,
  source: ProseNode,
  type = source.type,
): boolean {
  return actual.sameMarkup(type.create(cloneValue(source.attrs), undefined, source.marks));
}

function verifyRowWrapperMapping(
  beforeTable: ProseNode,
  nextTable: ProseNode,
  mutation: Extract<OfficeTableStructureMutation, { axis: 'row' }>,
  schemaHeaderBoundary: boolean,
  headerRowType: ProseNode['type'] | undefined,
  dataRowType: ProseNode['type'],
): boolean {
  const index = mutation.index;
  if (mutation.action === 'insert') {
    const insertedType = schemaHeaderBoundary && index === 0 ? headerRowType : dataRowType;
    if (!insertedType || !nextTable.child(index).sameMarkup(insertedType.create())) return false;
    for (let row = 0; row < beforeTable.childCount; row += 1) {
      const nextRow = row >= index ? row + 1 : row;
      const expectedType = schemaHeaderBoundary && index === 0 && row === 0
        ? dataRowType
        : beforeTable.child(row).type;
      if (!sameWrapperMarkup(nextTable.child(nextRow), beforeTable.child(row), expectedType)) return false;
    }
    return true;
  }

  for (let row = 0; row < beforeTable.childCount; row += 1) {
    if (row === index) continue;
    const nextRow = row > index ? row - 1 : row;
    const expectedType = schemaHeaderBoundary && index === 0 && row === 1
      ? headerRowType
      : beforeTable.child(row).type;
    if (!expectedType
      || !sameWrapperMarkup(nextTable.child(nextRow), beforeTable.child(row), expectedType)) return false;
  }
  return true;
}

/**
 * Independently verify exact row-boundary content mapping. This deliberately
 * models survivor rectangles and permitted rowspan adjustments instead of
 * trusting a proposed transaction merely because its dimensions are right.
 */
export function verifyOfficeTableRowMutationStructure(
  beforeTable: ProseNode,
  nextTable: ProseNode,
  mutation: OfficeTableStructureMutation,
): boolean {
  if (mutation.axis !== 'row') return false;
  if (!beforeTable.sameMarkup(nextTable)) return false;
  if (!hasCoherentOfficeTableMap(beforeTable) || !hasCoherentOfficeTableMap(nextTable)) return false;
  const beforeMap = TableMap.get(beforeTable);
  const nextMap = TableMap.get(nextTable);
  if (!verifyOfficeTableDimensions(
    { rows: beforeMap.height, columns: beforeMap.width },
    { rows: nextMap.height, columns: nextMap.width },
    mutation,
  )) return false;
  const beforeRecords = logicalCellRecords(beforeTable, beforeMap);
  if (!beforeRecords) return false;

  const schema = beforeTable.type.schema;
  const headerRowType = schema.nodes.table_header_row;
  const dataRowType = schema.nodes.table_row;
  const headerCellType = schema.nodes.table_header;
  const dataCellType = schema.nodes.table_cell;
  if (!dataRowType || !dataCellType) return false;
  const schemaHeaderBoundary = Boolean(
    headerRowType
    && headerCellType
    && beforeTable.child(0)?.type === headerRowType,
  );
  if (schemaHeaderBoundary) {
    if (nextTable.child(0)?.type !== headerRowType) return false;
    for (let row = 1; row < nextTable.childCount; row += 1) {
      if (nextTable.child(row).type !== dataRowType) return false;
    }
  }
  if (!verifyRowWrapperMapping(
    beforeTable,
    nextTable,
    mutation,
    schemaHeaderBoundary,
    headerRowType,
    dataRowType,
  )) return false;

  const expected: LogicalCellRecord[] = [];
  const pushExpected = (
    source: ProseNode,
    rect: Rect,
    type = source.type,
    rowspanDelta = 0,
    blank = false,
  ) => {
    const node = createExpectedCell(source, type, rowspanDelta, blank);
    if (!node) return false;
    expected.push({ node, rect });
    return true;
  };
  const index = mutation.index;

  if (schemaHeaderBoundary && index === 0 && headerCellType) {
    if (mutation.action === 'insert') {
      for (const record of beforeRecords) {
        const type = record.rect.top === 0 ? dataCellType : record.node.type;
        if (!pushExpected(record.node, {
          ...record.rect,
          top: record.rect.top + 1,
          bottom: record.rect.bottom + 1,
        }, type)) return false;
      }
      for (let column = 0; column < beforeMap.width; column += 1) {
        const source = beforeTable.nodeAt(beforeMap.map[column]);
        const node = headerCellType.createAndFill({ alignment: source?.attrs.alignment });
        if (!node) return false;
        expected.push({
          node,
          rect: { top: 0, bottom: 1, left: column, right: column + 1 },
        });
      }
      return verifyExpectedLogicalCells(expected, nextTable, nextMap);
    }

    for (const record of beforeRecords) {
      if (record.rect.top === 0) {
        if (record.rect.bottom <= 1) continue;
        if (!pushExpected(record.node, {
          ...record.rect,
          bottom: record.rect.bottom - 1,
        }, headerCellType, -1, true)) return false;
        continue;
      }
      const type = record.rect.top === 1 ? headerCellType : record.node.type;
      if (!pushExpected(record.node, {
        ...record.rect,
        top: record.rect.top - 1,
        bottom: record.rect.bottom - 1,
      }, type)) return false;
    }
    return verifyExpectedLogicalCells(expected, nextTable, nextMap);
  }

  if (mutation.action === 'insert') {
    for (const record of beforeRecords) {
      if (record.rect.top < index && record.rect.bottom > index) {
        if (!pushExpected(record.node, {
          ...record.rect,
          bottom: record.rect.bottom + 1,
        }, record.node.type, 1)) return false;
      } else if (record.rect.top >= index) {
        if (!pushExpected(record.node, {
          ...record.rect,
          top: record.rect.top + 1,
          bottom: record.rect.bottom + 1,
        })) return false;
      } else if (!pushExpected(record.node, record.rect)) return false;
    }
    const covered = new Set<number>();
    expected.forEach(({ rect }) => {
      if (rect.top <= index && rect.bottom > index) {
        for (let column = rect.left; column < rect.right; column += 1) covered.add(column);
      }
    });
    let referenceRowOffset: number | null = index > 0 ? -1 : 0;
    const referenceRow = index + referenceRowOffset;
    let referenceRowIsHeader = Boolean(headerCellType);
    for (let column = 0; referenceRowIsHeader && column < beforeMap.width; column += 1) {
      referenceRowIsHeader = beforeTable.nodeAt(
        beforeMap.map[referenceRow * beforeMap.width + column],
      )?.type === headerCellType;
    }
    if (referenceRowIsHeader) {
      referenceRowOffset = index === 0 || index === beforeMap.height ? null : 0;
    }
    for (let column = 0; column < beforeMap.width; column += 1) {
      if (covered.has(column)) continue;
      const header = beforeTable.nodeAt(beforeMap.map[column]);
      if (!header) return false;
      const attrs = Object.hasOwn(header.attrs, 'alignment')
        ? { alignment: header.attrs.alignment }
        : undefined;
      const type = schemaHeaderBoundary
        ? dataCellType
        : referenceRowOffset === null
          ? dataCellType
          : beforeTable.nodeAt(
            beforeMap.map[index * beforeMap.width + column + referenceRowOffset * beforeMap.width],
          )?.type;
      const node = type?.createAndFill(attrs);
      if (!node) return false;
      expected.push({
        node,
        rect: { top: index, bottom: index + 1, left: column, right: column + 1 },
      });
    }
    return verifyExpectedLogicalCells(expected, nextTable, nextMap);
  }

  for (const record of beforeRecords) {
    if (record.rect.top < index) {
      if (record.rect.bottom > index) {
        if (!pushExpected(record.node, {
          ...record.rect,
          bottom: record.rect.bottom - 1,
        }, record.node.type, -1)) return false;
      } else if (!pushExpected(record.node, record.rect)) return false;
      continue;
    }
    if (record.rect.top === index) {
      if (record.rect.bottom <= index + 1) continue;
      if (!pushExpected(record.node, {
        ...record.rect,
        bottom: record.rect.bottom - 1,
      }, record.node.type, -1)) return false;
      continue;
    }
    if (!pushExpected(record.node, {
      ...record.rect,
      top: record.rect.top - 1,
      bottom: record.rect.bottom - 1,
    })) return false;
  }
  return verifyExpectedLogicalCells(expected, nextTable, nextMap);
}

function isLogicalHeaderColumn(
  table: ProseNode,
  map: TableMap,
  column: number,
  headerCellType: ProseNode['type'] | undefined,
): boolean {
  if (!headerCellType || column < 0 || column >= map.width) return false;
  for (let row = 0; row < map.height; row += 1) {
    if (table.nodeAt(map.map[row * map.width + column])?.type !== headerCellType) return false;
  }
  return true;
}

/**
 * Independently verify an exact logical column mutation, including survivor
 * content/markup, colspan and colwidth adjustments, and row/table wrappers.
 */
export function verifyOfficeTableColumnMutationStructure(
  beforeTable: ProseNode,
  nextTable: ProseNode,
  mutation: OfficeTableStructureMutation,
): boolean {
  if (mutation.axis !== 'column') return false;
  if (!beforeTable.sameMarkup(nextTable) || beforeTable.childCount !== nextTable.childCount) return false;
  if (!hasCoherentOfficeTableMap(beforeTable) || !hasCoherentOfficeTableMap(nextTable)) return false;
  const beforeMap = TableMap.get(beforeTable);
  const nextMap = TableMap.get(nextTable);
  if (!verifyOfficeTableDimensions(
    { rows: beforeMap.height, columns: beforeMap.width },
    { rows: nextMap.height, columns: nextMap.width },
    mutation,
  )) return false;
  for (let row = 0; row < beforeTable.childCount; row += 1) {
    if (!sameWrapperMarkup(nextTable.child(row), beforeTable.child(row))) return false;
  }
  const beforeRecords = logicalCellRecords(beforeTable, beforeMap);
  if (!beforeRecords) return false;
  const expected: LogicalCellRecord[] = [];
  const index = mutation.index;

  if (mutation.action === 'insert') {
    for (const record of beforeRecords) {
      if (record.rect.left < index && record.rect.right > index) {
        const node = createExpectedColumnSpanCell(record.node, index - record.rect.left, 'insert');
        if (!node) return false;
        expected.push({ node, rect: { ...record.rect, right: record.rect.right + 1 } });
      } else if (record.rect.left >= index) {
        expected.push({
          node: record.node,
          rect: { ...record.rect, left: record.rect.left + 1, right: record.rect.right + 1 },
        });
      } else {
        expected.push(record);
      }
    }

    const coveredRows = new Set<number>();
    expected.forEach(({ rect }) => {
      if (rect.left <= index && rect.right > index) {
        for (let row = rect.top; row < rect.bottom; row += 1) coveredRows.add(row);
      }
    });
    let referenceOffset: number | null = index > 0 ? -1 : 0;
    const referenceColumn = index + referenceOffset;
    if (isLogicalHeaderColumn(
      beforeTable,
      beforeMap,
      referenceColumn,
      beforeTable.type.schema.nodes.table_header,
    )) {
      referenceOffset = index === 0 || index === beforeMap.width ? null : 0;
    }
    const dataCellType = beforeTable.type.schema.nodes.table_cell;
    if (!dataCellType) return false;
    for (let row = 0; row < beforeMap.height; row += 1) {
      if (coveredRows.has(row)) continue;
      const type = referenceOffset === null
        ? dataCellType
        : beforeTable.nodeAt(beforeMap.map[row * beforeMap.width + index + referenceOffset])?.type;
      const node = type?.createAndFill();
      if (!node) return false;
      expected.push({
        node,
        rect: { top: row, bottom: row + 1, left: index, right: index + 1 },
      });
    }
    return verifyExpectedLogicalCells(expected, nextTable, nextMap);
  }

  for (const record of beforeRecords) {
    if (record.rect.right <= index) {
      expected.push(record);
      continue;
    }
    if (record.rect.left > index) {
      expected.push({
        node: record.node,
        rect: { ...record.rect, left: record.rect.left - 1, right: record.rect.right - 1 },
      });
      continue;
    }
    if (record.rect.right === record.rect.left + 1) continue;
    const node = createExpectedColumnSpanCell(record.node, index - record.rect.left, 'delete');
    if (!node) return false;
    expected.push({ node, rect: { ...record.rect, right: record.rect.right - 1 } });
  }
  return verifyExpectedLogicalCells(expected, nextTable, nextMap);
}

export function verifyOfficeTableMutationStructure(
  beforeTable: ProseNode,
  nextTable: ProseNode,
  mutation: OfficeTableStructureMutation,
): boolean {
  return mutation.axis === 'row'
    ? verifyOfficeTableRowMutationStructure(beforeTable, nextTable, mutation)
    : verifyOfficeTableColumnMutationStructure(beforeTable, nextTable, mutation);
}

export function planOfficeTableMutation(
  before: OfficeTableDimensions,
  mutation: OfficeTableStructureMutation,
): OfficeTableMutationPlan | null {
  const size = mutation.axis === 'row' ? before.rows : before.columns;
  const maximum = mutation.action === 'insert' ? size : size - 1;
  if (!Number.isInteger(mutation.index) || mutation.index < 0 || mutation.index > maximum) return null;
  if (mutation.axis === 'column' && mutation.action === 'insert'
    && (!Number.isInteger(mutation.anchorIndex)
      || mutation.anchorIndex < 0
      || mutation.anchorIndex >= before.columns)) return null;
  const expected = { ...before };
  const delta = mutation.action === 'insert' ? 1 : -1;
  if (mutation.axis === 'row') expected.rows += delta;
  else expected.columns += delta;
  if (expected.rows < 2 || expected.columns < 1) return null;
  return { mutation: { ...mutation }, before: { ...before }, expected };
}

export function verifyOfficeTableDimensions(
  before: OfficeTableDimensions,
  next: OfficeTableDimensions,
  mutation: OfficeTableStructureMutation,
): boolean {
  const plan = planOfficeTableMutation(before, mutation);
  return Boolean(plan)
    && next.rows === plan?.expected.rows
    && next.columns === plan?.expected.columns;
}

function transformLayoutEntry(
  entry: DocumentTableLayout,
  nextIdentity: OfficeTableIdentity,
  mutation: OfficeTableStructureMutation,
  beforeColumnCount: number,
  measuredColumns: readonly number[],
  minimumColumnWidth?: number,
): DocumentTableLayout {
  const next: DocumentTableLayout = { ...cloneValue(entry), ...nextIdentity };
  // Row structure never changes logical columns. Preserve the raw width slots
  // (including dormant malformed/partial values) and every opaque field; only
  // column structure is allowed to derive a complete render-safe vector.
  if (mutation.axis !== 'column' || !Array.isArray(entry.columns)) return next;
  const columns = completeOfficeTableColumnWidths(
    entry.columns,
    beforeColumnCount,
    measuredColumns,
    minimumColumnWidth,
  );
  if (mutation.action === 'insert') {
    columns.splice(mutation.index, 0, columns[mutation.anchorIndex]);
  } else {
    columns.splice(mutation.index, 1);
  }
  next.columns = columns;
  return next;
}

const DEFAULT_TABLE_COLUMN_WIDTH = 96;

function isFiniteColumnWidth(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

export function completeOfficeTableColumnWidths(
  storedColumns: readonly unknown[],
  logicalColumnCount: number,
  measuredColumns: readonly number[] = [],
  minimumColumnWidth?: number,
): number[] {
  const minimum = isFiniteColumnWidth(minimumColumnWidth)
    ? Math.round(minimumColumnWidth)
    : 1;
  const clamp = (width: number) => Math.max(minimum, Math.round(width));
  const firstMeasured = measuredColumns.find(isFiniteColumnWidth);
  const firstStored = storedColumns.find(isFiniteColumnWidth);
  const fallback = clamp(firstMeasured ?? firstStored ?? DEFAULT_TABLE_COLUMN_WIDTH);
  const complete: number[] = [];
  for (let index = 0; index < logicalColumnCount; index += 1) {
    const stored = storedColumns[index];
    const measured = measuredColumns[index];
    complete.push(clamp(
      isFiniteColumnWidth(stored)
        ? stored
        : isFiniteColumnWidth(measured)
          ? measured
          : complete[index - 1] ?? fallback,
    ));
  }
  return complete;
}

function colorEntryHasOpaqueFields(entry: DocumentTableColors): boolean {
  return Object.keys(entry).some((key) => ![
    'tableIndex', 'fingerprint', 'cells', 'rows', 'columns',
  ].includes(key));
}

function colorRulesArePresent(rules: OfficeTableColorRules): boolean {
  return Boolean(rules.cells || rules.rows || rules.columns);
}

function reindexOfficeTableColorCollection(
  tableColors: unknown,
  target: OfficeTableIdentity,
  nextIdentity: OfficeTableIdentity,
  mutation: OfficeTableStructureMutation,
  nextDimensions: OfficeTableDimensions,
  liveTables: readonly OfficeTableIdentity[],
): unknown {
  if (!Array.isArray(tableColors) || tableColors.length === 0) return cloneValue(tableColors);
  const targetEntry = findStructureTableIdentityEntry<DocumentTableColors>(
    tableColors,
    target,
    liveTables,
  );
  if (!targetEntry) return cloneValue(tableColors);
  const rules = reindexColorRules(
    { cells: targetEntry.cells, rows: targetEntry.rows, columns: targetEntry.columns },
    {
      axis: mutation.axis,
      kind: mutation.action,
      index: mutation.index,
      nextDimensions: {
        rowCount: nextDimensions.rows,
        columnCount: nextDimensions.columns,
      },
    },
  );
  const nextEntry = Object.fromEntries(Object.entries(cloneValue(targetEntry)).filter(([key]) => ![
    'cells', 'rows', 'columns',
  ].includes(key))) as DocumentTableColors;
  Object.assign(nextEntry, nextIdentity);
  if (rules.cells) nextEntry.cells = cloneValue(rules.cells);
  if (rules.rows) nextEntry.rows = cloneValue(rules.rows);
  if (rules.columns) nextEntry.columns = cloneValue(rules.columns);
  const keepEntry = colorRulesArePresent(rules) || colorEntryHasOpaqueFields(nextEntry);
  return tableColors.flatMap((value) => value === targetEntry
    ? keepEntry ? [nextEntry] : []
    : [cloneValue(value)]);
}

function refreshOfficeTableStyleIdentity(
  tableStyles: unknown,
  target: OfficeTableIdentity,
  nextIdentity: OfficeTableIdentity,
  liveTables: readonly OfficeTableIdentity[],
): unknown {
  if (!Array.isArray(tableStyles) || tableStyles.length === 0) return cloneValue(tableStyles);
  const targetEntry = findStructureTableIdentityEntry<DocumentTableStyle>(
    tableStyles,
    target,
    liveTables,
  );
  return tableStyles.map((value) => (
    targetEntry && value === targetEntry
      ? { ...cloneValue(targetEntry), ...nextIdentity }
      : cloneValue(value)
  ));
}

function refreshOfficeTableCollectionIdentity(
  collection: unknown,
  target: OfficeTableIdentity,
  nextIdentity: OfficeTableIdentity,
  liveTables: readonly OfficeTableIdentity[],
): unknown {
  if (!Array.isArray(collection) || collection.length === 0) return cloneValue(collection);
  const targetEntry = findStructureTableIdentityEntry<Record<string, unknown>>(
    collection,
    target,
    liveTables,
  );
  return collection.map((value) => targetEntry && value === targetEntry
    ? { ...cloneValue(targetEntry), ...nextIdentity }
    : cloneValue(value));
}

function transformOfficeTableTitleMarker(
  snapshot: OfficeTableMetadataSnapshot,
  nextIdentity: OfficeTableIdentity,
  action: OfficeTableTitleRowAction,
): OfficeTableMetadataSnapshot {
  const next = cloneValue(snapshot);
  const styles = Array.isArray(next.tableStyles) ? next.tableStyles : [];
  const targetEntry = findTableIdentityEntry<DocumentTableStyle>(styles, nextIdentity);
  if (action === 'add') {
    if (targetEntry) {
      next.tableStyles = styles.map((value) => value === targetEntry
        ? { ...cloneValue(targetEntry), ...nextIdentity, titleRow: true }
        : cloneValue(value));
    } else {
      next.tableStyles = [
        ...styles.map((value) => cloneValue(value)),
        { ...nextIdentity, titleRow: true },
      ];
    }
    return next;
  }

  if (!targetEntry) return next;
  const cleared = Object.fromEntries(
    Object.entries(cloneValue(targetEntry)).filter(([key]) => key !== 'titleRow'),
  ) as DocumentTableStyle;
  Object.assign(cleared, nextIdentity);
  const hasStyleValue = Object.keys(cleared).some((key) => ![
    'tableIndex', 'fingerprint',
  ].includes(key));
  next.tableStyles = styles.flatMap((value) => value === targetEntry
    ? hasStyleValue ? [cleared] : []
    : [cloneValue(value)]);
  return next;
}

function transformOfficeTableStaleContentMarker(
  before: OfficeTableMetadataSnapshot,
  target: OfficeTableIdentity,
  nextIdentity: OfficeTableIdentity,
  liveTables: readonly OfficeTableIdentity[],
): OfficeTableMetadataSnapshot {
  const refreshed: OfficeTableMetadataSnapshot = {
    tables: refreshOfficeTableCollectionIdentity(before.tables, target, nextIdentity, liveTables),
    tableColors: refreshOfficeTableCollectionIdentity(
      before.tableColors,
      target,
      nextIdentity,
      liveTables,
    ),
    ...(Object.hasOwn(before, 'tableStyles')
      ? {
        tableStyles: refreshOfficeTableCollectionIdentity(
          before.tableStyles,
          target,
          nextIdentity,
          liveTables,
        ),
      }
      : {}),
    ...(before.pageAlignment ? { pageAlignment: before.pageAlignment } : {}),
  };
  return transformOfficeTableTitleMarker(refreshed, nextIdentity, 'delete');
}

export function transformOfficeTableMetadata(
  before: OfficeTableMetadataSnapshot,
  target: OfficeTableIdentity,
  nextIdentity: OfficeTableIdentity,
  mutation: OfficeTableStructureMutation,
  nextDimensions: OfficeTableDimensions,
  liveTables: readonly OfficeTableIdentity[] = [],
  measuredColumns: readonly number[] = [],
  minimumColumnWidth?: number,
): OfficeTableMetadataSnapshot {
  const tableColors = reindexOfficeTableColorCollection(
    before.tableColors,
    target,
    nextIdentity,
    mutation,
    nextDimensions,
    liveTables,
  );
  const targetLayout = findStructureTableIdentityEntry<DocumentTableLayout>(
    before.tables,
    target,
    liveTables,
  );
  const beforeColumnCount = mutation.axis !== 'column'
    ? nextDimensions.columns
    : nextDimensions.columns + (mutation.action === 'insert' ? -1 : 1);
  const tables = Array.isArray(before.tables) && before.tables.length > 0 ? before.tables.map((value) => (
    targetLayout && value === targetLayout
      ? transformLayoutEntry(
        targetLayout,
        nextIdentity,
        mutation,
        beforeColumnCount,
        measuredColumns,
        minimumColumnWidth,
      )
      : cloneValue(value)
  )) : cloneValue(before.tables);
  return {
    tables,
    tableColors,
    ...(Object.hasOwn(before, 'tableStyles')
      ? {
        tableStyles: refreshOfficeTableStyleIdentity(
          before.tableStyles,
          target,
          nextIdentity,
          liveTables,
        ),
      }
      : {}),
    ...(before.pageAlignment ? { pageAlignment: before.pageAlignment } : {}),
  };
}

function findTargetTable(state: EditorState, tablePos: number): TableRecord | null {
  const tables = tablesInDocument(state.doc);
  return tables.find(({ pos, node }) => tablePos >= pos && tablePos <= pos + node.nodeSize) ?? null;
}

function clearOfficeTableTitleState(node: ProseNode): ProseNode {
  return node.type.create({
    ...cloneValue(node.attrs),
    officeTitleRowState: null,
    officeTitleDiagnostic: null,
  }, node.content, node.marks);
}

function normalizeStaleOfficeTableMutationTransaction(
  transaction: Transaction,
  targetIndex: number,
  beforeTable: ProseNode,
): Transaction | null {
  if (beforeTable.attrs.officeTitleRowState !== 'stale') return transaction;
  const nextTarget = tablesInDocument(transaction.doc)[targetIndex];
  if (!nextTarget || nextTarget.node.attrs.officeTitleRowState !== 'stale') return null;
  transaction.setNodeMarkup(nextTarget.pos, undefined, {
    ...cloneValue(nextTarget.node.attrs),
    officeTitleRowState: null,
    officeTitleDiagnostic: null,
  }, nextTarget.node.marks);
  return transaction;
}

function normalizeValidOfficeTableTitleAlignment(
  transaction: Transaction,
  targetIndex: number,
  beforeTable: ProseNode,
  mutation: OfficeTableStructureMutation,
): Transaction | null {
  if (mutation.axis !== 'column' || getVerifiedOfficeTableTitleWidth(beforeTable) === null) {
    return transaction;
  }
  const nextTarget = tablesInDocument(transaction.doc)[targetIndex];
  const titleRow = nextTarget?.node.firstChild;
  const titleCell = titleRow?.firstChild;
  const demotedHeaderCell = nextTarget?.node.maybeChild(1)?.firstChild;
  const beforeTitleCell = beforeTable.firstChild?.firstChild;
  if (!nextTarget || !titleRow || !titleCell || !demotedHeaderCell || !beforeTitleCell) return null;
  const alignment = demotedHeaderCell.attrs.alignment;
  if (mutation.action === 'insert' && titleRow.childCount > 1) {
    const cells: ProseNode[] = [];
    titleRow.forEach((cell) => cells.push(cell));
    const blankTitleCell = beforeTitleCell.type.createAndFill();
    const originalCells = cells.filter((cell) => cell.eq(beforeTitleCell));
    const originalIsDefaultBlank = Boolean(blankTitleCell && beforeTitleCell.eq(blankTitleCell));
    const safeContinuations = Boolean(blankTitleCell) && (originalIsDefaultBlank
      ? cells.every((cell) => cell.eq(blankTitleCell!))
      : originalCells.length === 1 && cells.every(
        (cell) => cell === originalCells[0] || cell.eq(blankTitleCell!),
      ));
    const expanded = createExpectedColumnSpanCell(
      beforeTitleCell,
      mutation.index,
      'insert',
    );
    if (!safeContinuations || !expanded) return null;
    const mergedCell = expanded.type.create({
      ...cloneValue(expanded.attrs),
      alignment,
    }, expanded.content, expanded.marks);
    const mergedRow = titleRow.type.create(
      cloneValue(beforeTable.firstChild?.attrs),
      mergedCell,
      beforeTable.firstChild?.marks,
    );
    transaction.replaceWith(
      nextTarget.pos + 1,
      nextTarget.pos + 1 + titleRow.nodeSize,
      mergedRow,
    );
    return transaction;
  }
  if (titleCell.attrs.alignment === alignment) return transaction;
  transaction.setNodeMarkup(nextTarget.pos + 2, undefined, {
    ...cloneValue(titleCell.attrs),
    alignment,
  }, titleCell.marks);
  return transaction;
}

function tableWithoutOfficeTitleRow(table: ProseNode): ProseNode | null {
  const headerRowType = table.type.schema.nodes.table_header_row;
  const headerCellType = table.type.schema.nodes.table_header;
  if (!headerRowType || !headerCellType || table.childCount < 3) return null;
  const rows = [convertOfficeTableRow(table.child(1), headerRowType, headerCellType)];
  for (let index = 2; index < table.childCount; index += 1) rows.push(table.child(index));
  return table.type.create(cloneValue(table.attrs), rows, table.marks);
}

function verifyValidOfficeTableTitleColumnMutationStructure(
  beforeTable: ProseNode,
  nextTable: ProseNode,
  mutation: OfficeTableStructureMutation,
): boolean {
  if (mutation.axis !== 'column'
    || getVerifiedOfficeTableTitleWidth(beforeTable) === null
    || getVerifiedOfficeTableTitleWidth(nextTable) === null) return false;
  const beforeTitleRow = beforeTable.firstChild;
  const beforeTitleCell = beforeTitleRow?.firstChild;
  const nextTitleRow = nextTable.firstChild;
  const nextTitleCell = nextTitleRow?.firstChild;
  const nextAlignment = nextTable.maybeChild(1)?.firstChild?.attrs.alignment;
  if (!beforeTitleRow || !beforeTitleCell || !nextTitleRow || !nextTitleCell
    || nextTitleRow.childCount !== 1
    || !sameWrapperMarkup(nextTitleRow, beforeTitleRow)) return false;
  const expectedTitleCell = createExpectedColumnSpanCell(
    beforeTitleCell,
    mutation.index,
    mutation.action,
  );
  if (!expectedTitleCell) return false;
  const alignedExpectedTitleCell = expectedTitleCell.type.create({
    ...cloneValue(expectedTitleCell.attrs),
    alignment: nextAlignment,
  }, expectedTitleCell.content, expectedTitleCell.marks);
  if (!nextTitleCell.eq(alignedExpectedTitleCell)) return false;
  const ordinaryBefore = tableWithoutOfficeTitleRow(beforeTable);
  const ordinaryNext = tableWithoutOfficeTitleRow(nextTable);
  return Boolean(ordinaryBefore && ordinaryNext
    && verifyOfficeTableColumnMutationStructure(ordinaryBefore, ordinaryNext, mutation));
}

function verifyCoordinatedOfficeTableMutationStructure(
  beforeTable: ProseNode,
  nextTable: ProseNode,
  mutation: OfficeTableStructureMutation,
): boolean {
  if (beforeTable.attrs.officeTitleRowState === 'stale') {
    if (nextTable.attrs.officeTitleRowState !== null
      || nextTable.attrs.officeTitleDiagnostic !== null) return false;
    return verifyOfficeTableMutationStructure(
      beforeTable,
      nextTable.type.create(cloneValue(beforeTable.attrs), nextTable.content, nextTable.marks),
      mutation,
    );
  }
  if (mutation.axis === 'column' && getVerifiedOfficeTableTitleWidth(beforeTable) !== null) {
    return verifyValidOfficeTableTitleColumnMutationStructure(
      beforeTable,
      nextTable,
      mutation,
    );
  }
  return verifyOfficeTableMutationStructure(beforeTable, nextTable, mutation);
}

/**
 * Pre-apply stale-quarantine guard. It amends the originating row-0 content
 * transaction itself, so the table attrs and raw marker cannot diverge for an
 * applied frame or history event. Composite Office structure/metadata actions
 * already own their exact cleanup and are deliberately left untouched.
 */
export function createOfficeTableTitleQuarantineProsePlugin(root: HTMLElement) {
  return new Plugin({
    filterTransaction: (transaction, state) => {
      if (!transaction.docChanged || transaction.steps.some(
        (step) => step instanceof OfficeTableMetadataStep,
      )) return true;

      const initializationNormalization = transaction.getMeta(
        officeTableInitializationNormalizationKey,
      ) === true;

      const beforeTables = tablesInDocument(state.doc);
      const nextTables = tablesInDocument(transaction.doc);
      const staleTables = beforeTables.filter(
        ({ node }) => node.attrs.officeTitleRowState === 'stale',
      );
      if (staleTables.length === 0 || nextTables.length !== beforeTables.length) return true;
      if (staleTables.some(({ index, node }) => {
        const next = nextTables[index];
        return !next
          || dimensionsOf(next.node).rows !== dimensionsOf(node).rows
          || dimensionsOf(next.node).columns !== dimensionsOf(node).columns;
      })) return false;

      const affected = initializationNormalization ? [] : staleTables.filter(({ index, node }) => {
        if (node.childCount === 0) return false;
        return !node.child(0).eq(nextTables[index].node.child(0));
      });
      const affectedIndices = new Set(affected.map(({ index }) => index));
      staleTables.forEach(({ index, node }) => {
        if (affectedIndices.has(index)) return;
        const next = tablesInDocument(transaction.doc)[index];
        if (next.node.attrs.officeTitleRowState !== node.attrs.officeTitleRowState
          || next.node.attrs.officeTitleDiagnostic !== node.attrs.officeTitleDiagnostic) {
          transaction.setNodeMarkup(next.pos, undefined, cloneValue(node.attrs), next.node.marks);
        }
      });
      if (affected.length === 0) return true;

      const metadataBefore = readOfficeTableMetadataSnapshot(root);
      if (!metadataBefore) return false;
      const beforeIdentities = beforeTables.map(({ index, node }) => ({
        tableIndex: index,
        fingerprint: fingerprintProseTable(node),
      }));
      affected.forEach(({ index }) => {
        const next = tablesInDocument(transaction.doc)[index];
        const cleared = clearOfficeTableTitleState(next.node);
        transaction.setNodeMarkup(next.pos, undefined, cleared.attrs, cleared.marks);
      });

      let metadataAfter = metadataBefore;
      affected.forEach(({ index, node }) => {
        const next = tablesInDocument(transaction.doc)[index];
        metadataAfter = transformOfficeTableStaleContentMarker(
          metadataAfter,
          { tableIndex: index, fingerprint: fingerprintProseTable(node) },
          { tableIndex: index, fingerprint: fingerprintProseTable(next.node) },
          beforeIdentities,
        );
      });
      notifyOfficeTableMetadataTestHook('quarantine-preflight');
      transaction.step(new OfficeTableMetadataStep(metadataBefore, metadataAfter));
      return true;
    },
  });
}

export const officeTableTitleQuarantinePlugin = (root: HTMLElement) => $prose(
  () => createOfficeTableTitleQuarantineProsePlugin(root),
);

function setSelectionInsideFirstTableCell(transaction: Transaction, tablePos: number) {
  const nearCellContent = Math.min(tablePos + 3, transaction.doc.content.size);
  transaction.setSelection(TextSelection.near(transaction.doc.resolve(nearCellContent), 1));
}

function convertOfficeTableRow(
  row: ProseNode,
  rowType: ProseNode['type'],
  cellType: ProseNode['type'],
): ProseNode {
  const cells: ProseNode[] = [];
  row.forEach((cell) => {
    cells.push(cellType.create(cloneValue(cell.attrs), cell.content, cell.marks));
  });
  return rowType.create(cloneValue(row.attrs), cells, row.marks);
}

function buildPromotedOfficeTableHeaderRow(
  table: ProseNode,
  map: TableMap,
  headerRowType: ProseNode['type'],
  headerCellType: ProseNode['type'],
  dataCellType: ProseNode['type'],
): ProseNode | null {
  const promotedSource = table.child(1);
  const promotedCells: ProseNode[] = [];
  const seen = new Set<number>();
  for (let column = 0; column < map.width; column += 1) {
    const promotedPosition = map.map[map.width + column];
    if (seen.has(promotedPosition)) continue;
    seen.add(promotedPosition);
    const source = table.nodeAt(promotedPosition);
    if (!source) return null;

    if (promotedPosition === map.map[column]) {
      // The deleted header owns this logical slot but spans into the row being
      // promoted. Delete its content/color coordinate while retaining a blank
      // continuation so every physical cell in row 1 keeps its logical start.
      const rowspan = source.attrs.rowspan;
      if (!Number.isInteger(rowspan) || rowspan <= 1) return null;
      const continuation = headerCellType.createAndFill({
        ...cloneValue(source.attrs),
        rowspan: rowspan - 1,
      });
      if (!continuation) return null;
      promotedCells.push(continuation);
      continue;
    }

    if (source.type !== dataCellType) return null;
    promotedCells.push(headerCellType.create(
      cloneValue(source.attrs),
      source.content,
      source.marks,
    ));
  }
  return headerRowType.create(
    cloneValue(promotedSource.attrs),
    promotedCells,
    promotedSource.marks,
  );
}

/**
 * Build only the two schema-header boundary mutations stock GFM commands
 * cannot express without temporarily invalidating or splitting the table.
 */
export function buildOfficeTableRowBoundaryTransaction(
  state: EditorState,
  tablePos: number,
  mutation: OfficeTableStructureMutation,
): Transaction | null {
  if (mutation.axis !== 'row' || mutation.index !== 0) return null;
  const target = findTargetTable(state, tablePos);
  if (!target) return null;
  const table = target.node;
  const map = TableMap.get(table);
  const headerRowType = state.schema.nodes.table_header_row;
  const dataRowType = state.schema.nodes.table_row;
  const headerCellType = state.schema.nodes.table_header;
  const dataCellType = state.schema.nodes.table_cell;
  if (!headerRowType || !dataRowType || !headerCellType || !dataCellType
    || table.child(0).type !== headerRowType
    || map.problems?.length) return null;

  let rows: ProseNode[];
  if (mutation.action === 'insert') {
    const blankHeaderCells: ProseNode[] = [];
    for (let column = 0; column < map.width; column += 1) {
      const source = table.nodeAt(map.map[column]);
      const blank = headerCellType.createAndFill({ alignment: source?.attrs.alignment });
      if (!blank) return null;
      blankHeaderCells.push(blank);
    }
    const blankHeader = headerRowType.createAndFill(null, blankHeaderCells);
    if (!blankHeader) return null;
    const formerHeader = convertOfficeTableRow(table.child(0), dataRowType, dataCellType);
    rows = [blankHeader, formerHeader];
    for (let index = 1; index < table.childCount; index += 1) rows.push(table.child(index));
  } else {
    // Promotion must leave one data row after the immediately following
    // physical row becomes the sole schema header.
    if (table.childCount < 3 || table.child(1).type !== dataRowType) return null;
    const promotedHeader = buildPromotedOfficeTableHeaderRow(
      table,
      map,
      headerRowType,
      headerCellType,
      dataCellType,
    );
    if (!promotedHeader) return null;
    rows = [promotedHeader];
    for (let index = 2; index < table.childCount; index += 1) rows.push(table.child(index));
  }

  const nextTable = table.type.create(cloneValue(table.attrs), rows, table.marks);
  if (!hasCoherentOfficeTableMap(nextTable)) return null;
  const nextDimensions = dimensionsOf(nextTable);
  if (!verifyOfficeTableDimensions(dimensionsOf(table), nextDimensions, mutation)) return null;
  return state.tr.replaceWith(target.pos, target.pos + table.nodeSize, nextTable);
}

export function buildOfficeTableTitleRowTransaction(
  state: EditorState,
  tablePos: number,
  action: OfficeTableTitleRowAction,
): Transaction | null {
  const target = findTargetTable(state, tablePos);
  if (!target || !hasCoherentOfficeTableMap(target.node)) return null;
  const table = target.node;
  const map = TableMap.get(table);
  const headerRowType = state.schema.nodes.table_header_row;
  const dataRowType = state.schema.nodes.table_row;
  const headerCellType = state.schema.nodes.table_header;
  const dataCellType = state.schema.nodes.table_cell;
  if (!headerRowType || !dataRowType || !headerCellType || !dataCellType
    || table.child(0)?.type !== headerRowType) return null;

  if (action === 'add') {
    if (table.child(0).childCount === 1) return null;
    const titleCell = headerCellType.createAndFill({ colspan: map.width, alignment: null });
    if (!titleCell) return null;
    const titleRow = headerRowType.createAndFill(null, titleCell);
    if (!titleRow) return null;
    const rows = [titleRow, convertOfficeTableRow(table.child(0), dataRowType, dataCellType)];
    for (let index = 1; index < table.childCount; index += 1) rows.push(table.child(index));
    const nextTable = table.type.create({
      ...cloneValue(table.attrs),
      officeTitleRowState: 'valid',
      officeTitleDiagnostic: null,
    }, rows, table.marks);
    if (!hasCoherentOfficeTableMap(nextTable)) return null;
    const transaction = state.tr.replaceWith(target.pos, target.pos + table.nodeSize, nextTable);
    setSelectionInsideFirstTableCell(transaction, target.pos);
    return transaction;
  }

  if (getVerifiedOfficeTableTitleWidth(table) === null || table.childCount < 3) return null;
  const transaction = buildOfficeTableRowBoundaryTransaction(
    state,
    tablePos,
    { axis: 'row', action: 'delete', index: 0 },
  );
  const promoted = transaction?.doc.nodeAt(target.pos);
  if (!transaction || !promoted) return null;
  const unmarked = promoted.type.create({
    ...cloneValue(promoted.attrs),
    officeTitleRowState: null,
    officeTitleDiagnostic: null,
  }, promoted.content, promoted.marks);
  transaction.replaceWith(target.pos, target.pos + promoted.nodeSize, unmarked);
  setSelectionInsideFirstTableCell(transaction, target.pos);
  return transaction;
}

export function verifyOfficeTableTitleRowMutationStructure(
  beforeTable: ProseNode,
  nextTable: ProseNode,
  action: OfficeTableTitleRowAction,
): boolean {
  const mutation: OfficeTableStructureMutation = { axis: 'row', action: action === 'add' ? 'insert' : 'delete', index: 0 };
  if (nextTable.attrs.officeTitleRowState !== (action === 'add' ? 'valid' : null)
    || nextTable.attrs.officeTitleDiagnostic !== null) return false;
  const normalizedNext = nextTable.type.create(
    cloneValue(beforeTable.attrs),
    nextTable.content,
    nextTable.marks,
  );
  if (action === 'delete') {
    return getVerifiedOfficeTableTitleWidth(beforeTable) !== null
      && verifyOfficeTableRowMutationStructure(beforeTable, normalizedNext, mutation);
  }

  const map = TableMap.get(beforeTable);
  const nextMap = TableMap.get(nextTable);
  const titleRow = nextTable.firstChild;
  const titleCell = titleRow?.firstChild;
  if (beforeTable.child(0).childCount === 1
    || !titleRow || titleRow.type !== beforeTable.type.schema.nodes.table_header_row
    || titleRow.childCount !== 1
    || !titleCell || titleCell.type !== beforeTable.type.schema.nodes.table_header
    || titleCell.attrs.colspan !== map.width
    || titleCell.textContent !== ''
    || nextMap.width !== map.width
    || nextMap.height !== map.height + 1) return false;
  const formerHeader = convertOfficeTableRow(
    beforeTable.child(0),
    beforeTable.type.schema.nodes.table_row,
    beforeTable.type.schema.nodes.table_cell,
  );
  if (!nextTable.child(1).eq(formerHeader)) return false;
  for (let index = 1; index < beforeTable.childCount; index += 1) {
    if (!nextTable.child(index + 1).eq(beforeTable.child(index))) return false;
  }
  return true;
}

export function createOfficeTableRowBoundaryCommand(
  tablePos: number,
  mutation: OfficeTableStructureMutation,
): Command | null {
  if (mutation.axis !== 'row' || mutation.index !== 0) return null;
  return (state, dispatch) => {
    const transaction = buildOfficeTableRowBoundaryTransaction(state, tablePos, mutation);
    if (!transaction) return false;
    dispatch?.(transaction);
    return true;
  };
}

function normalizeInsertedRowCellsToHeaderColumns(
  transaction: Transaction,
  target: TableRecord,
  beforeMap: TableMap,
  insertedRow: number,
): boolean {
  const nextTable = transaction.doc.nodeAt(target.pos);
  if (!nextTable) return false;
  const nextMap = TableMap.get(nextTable);
  const row = nextTable.child(insertedRow);
  const dataCellType = nextTable.type.schema.nodes.table_cell;
  const schemaDataRow = Boolean(
    insertedRow > 0
    && nextTable.type.schema.nodes.table_header_row
    && nextTable.child(0)?.type === nextTable.type.schema.nodes.table_header_row,
  );
  if (schemaDataRow && !dataCellType) return false;
  let rowOffset = 0;
  for (let index = 0; index < insertedRow; index += 1) rowOffset += nextTable.child(index).nodeSize;
  let cellOffset = rowOffset + 1;
  const cells: ProseNode[] = [];
  for (let index = 0; index < row.childCount; index += 1) {
    const cell = row.child(index);
    const rect = nextMap.findCell(cellOffset);
    const header = target.node.nodeAt(beforeMap.map[rect.left]);
    if (!header) return false;
    const attrs = { ...cloneValue(cell.attrs) };
    if (Object.hasOwn(header.attrs, 'alignment')) attrs.alignment = header.attrs.alignment;
    const type = schemaDataRow ? dataCellType : cell.type;
    if (!type) return false;
    cells.push(type.create(attrs, cell.content, cell.marks));
    cellOffset += cell.nodeSize;
  }
  const normalizedRow = row.type.create(cloneValue(row.attrs), cells, row.marks);
  const rowPosition = target.pos + 1 + rowOffset;
  transaction.replaceWith(rowPosition, rowPosition + row.nodeSize, normalizedRow);
  return true;
}

function buildOfficeTableExactRowTransaction(
  state: EditorState,
  tablePos: number,
  mutation: OfficeTableStructureMutation,
): Transaction | null {
  if (mutation.axis !== 'row') return null;
  const target = findTargetTable(state, tablePos);
  if (!target || !hasCoherentOfficeTableMap(target.node)) return null;
  const before = dimensionsOf(target.node);
  if (!planOfficeTableMutation(before, mutation)) return null;

  const hasSchemaHeaderBoundary = Boolean(
    state.schema.nodes.table_header_row
    && target.node.child(0)?.type === state.schema.nodes.table_header_row,
  );
  if (mutation.index === 0 && hasSchemaHeaderBoundary) {
    return buildOfficeTableRowBoundaryTransaction(state, tablePos, mutation);
  }

  const map = TableMap.get(target.node);
  const rect: TableRect = {
    left: 0,
    right: map.width,
    top: mutation.index,
    bottom: mutation.index + (mutation.action === 'delete' ? 1 : 0),
    tableStart: target.pos + 1,
    map,
    table: target.node,
  };
  const transaction = state.tr;
  if (mutation.action === 'insert') {
    addRow(transaction, rect, mutation.index);
    if (!normalizeInsertedRowCellsToHeaderColumns(transaction, target, map, mutation.index)) return null;
  } else {
    removeRow(transaction, rect, mutation.index);
  }
  const nextTable = transaction.doc.nodeAt(target.pos);
  if (!nextTable
    || !verifyOfficeTableRowMutationStructure(target.node, nextTable, mutation)) return null;
  return transaction;
}

/** Build an exact-index row command that never derives its boundary from an expanded selection. */
export function createOfficeTableRowMutationCommand(
  tablePos: number,
  mutation: OfficeTableStructureMutation,
): Command | null {
  if (mutation.axis !== 'row') return null;
  return (state, dispatch) => {
    const transaction = buildOfficeTableExactRowTransaction(state, tablePos, mutation);
    if (!transaction) return false;
    dispatch?.(transaction);
    return true;
  };
}

function buildOfficeTableExactColumnTransaction(
  state: EditorState,
  tablePos: number,
  mutation: OfficeTableStructureMutation,
): Transaction | null {
  if (mutation.axis !== 'column') return null;
  const target = findTargetTable(state, tablePos);
  if (!target || !hasCoherentOfficeTableMap(target.node)) return null;
  const before = dimensionsOf(target.node);
  if (!planOfficeTableMutation(before, mutation)) return null;
  const map = TableMap.get(target.node);
  const rect: TableRect = {
    left: mutation.index,
    right: mutation.index + (mutation.action === 'delete' ? 1 : 0),
    top: 0,
    bottom: map.height,
    tableStart: target.pos + 1,
    map,
    table: target.node,
  };
  const transaction = state.tr;
  try {
    if (mutation.action === 'insert') addColumn(transaction, rect, mutation.index);
    else removeColumn(transaction, rect, mutation.index);
  } catch {
    return null;
  }
  const nextTable = transaction.doc.nodeAt(target.pos);
  if (!nextTable
    || !verifyOfficeTableColumnMutationStructure(target.node, nextTable, mutation)) return null;
  return transaction;
}

/** Build an exact-index column command that never derives its boundary from a selection. */
export function createOfficeTableColumnMutationCommand(
  tablePos: number,
  mutation: OfficeTableStructureMutation,
): Command | null {
  if (mutation.axis !== 'column') return null;
  return (state, dispatch) => {
    const transaction = buildOfficeTableExactColumnTransaction(state, tablePos, mutation);
    if (!transaction) return false;
    dispatch?.(transaction);
    return true;
  };
}

export function createOfficeTableMutationCommand(
  tablePos: number,
  mutation: OfficeTableStructureMutation,
): Command | null {
  return mutation.axis === 'row'
    ? createOfficeTableRowMutationCommand(tablePos, mutation)
    : createOfficeTableColumnMutationCommand(tablePos, mutation);
}

/**
 * Limit explicit-index fallback to boundaries whose stock selection can expand
 * through a span, plus the GFM schema-header boundary stock commands cannot
 * represent. Ordinary wrong-index proposals remain hard failures.
 */
export function requiresOfficeTableExactBoundaryFallback(
  table: ProseNode,
  mutation: OfficeTableStructureMutation,
): boolean {
  if (!hasCoherentOfficeTableMap(table)) return false;
  if (mutation.axis === 'row'
    && mutation.index === 0
    && table.child(0)?.type === table.type.schema.nodes.table_header_row) return true;
  const map = TableMap.get(table);
  const records = logicalCellRecords(table, map);
  if (!records) return false;
  if (mutation.axis === 'row') {
    return records.some(({ rect }) => mutation.action === 'insert'
      ? rect.top < mutation.index && rect.bottom > mutation.index
      : rect.bottom - rect.top > 1
        && rect.top <= mutation.index
        && rect.bottom > mutation.index);
  }
  return records.some(({ rect }) => mutation.action === 'insert'
    ? rect.left < mutation.index && rect.right > mutation.index
    : rect.right - rect.left > 1
      && rect.left <= mutation.index
      && rect.right > mutation.index);
}

function tableSetIsCoherent(before: TableRecord[], next: TableRecord[], targetIndex: number): boolean {
  if (before.length !== next.length || !next[targetIndex]) return false;
  return before.every((table, index) => index === targetIndex || table.node.eq(next[index].node));
}

export type RunStockMutationOptions = {
  root: HTMLElement;
  view: EditorView;
  commands: CommandManager;
  tablePos: number;
  selectionIndex?: number;
  mutation: OfficeTableStructureMutation;
  selectionCommandKey?: CmdKey<{ index: number; pos?: number }>;
  selectionCommand?: Command;
  mutationCommandKey?: CmdKey<unknown>;
  mutationCommand?: Command;
  titleRowAction?: OfficeTableTitleRowAction;
};

export function runStockOfficeTableMutation({
  root,
  view,
  commands,
  tablePos,
  selectionIndex,
  mutation,
  selectionCommandKey,
  selectionCommand,
  mutationCommandKey,
  mutationCommand,
  titleRowAction,
}: RunStockMutationOptions): OfficeTableMutationResult {
  const baseResult = { applied: false as const, mutation: { ...mutation } };
  const targetRecord = findTargetTable(view.state, tablePos);
  if (!targetRecord) return { ...baseResult, reason: 'invalid-plan' };
  const before = dimensionsOf(targetRecord.node);
  const plan = planOfficeTableMutation(before, mutation);
  const target = { tableIndex: targetRecord.index, fingerprint: fingerprintProseTable(targetRecord.node) };
  if (!plan || !hasCoherentOfficeTableMap(targetRecord.node)) {
    return { ...baseResult, reason: 'invalid-plan', target, before };
  }
  const explicitTitleDelete = titleRowAction === 'delete'
    && mutation.axis === 'row'
    && mutation.action === 'delete'
    && mutation.index === 0;
  if (titleRowAction === 'delete' && !explicitTitleDelete) {
    return { ...baseResult, reason: 'invalid-plan', target, before, expected: plan.expected };
  }
  const verifiedTitleWidth = getVerifiedOfficeTableTitleWidth(targetRecord.node);
  const insertsBeforeVerifiedTitle = verifiedTitleWidth !== null
    && mutation.axis === 'row'
    && mutation.action === 'insert'
    && mutation.index === 0;
  if (insertsBeforeVerifiedTitle) {
    return { ...baseResult, reason: 'invalid-plan', target, before, expected: plan.expected };
  }
  const genericVerifiedTitleDelete = !explicitTitleDelete
    && mutation.axis === 'row'
    && mutation.action === 'delete'
    && verifiedTitleWidth !== null;
  if (genericVerifiedTitleDelete && (mutation.index === 0 || plan.expected.rows < 3)) {
    return { ...baseResult, reason: 'invalid-plan', target, before, expected: plan.expected };
  }

  let ephemeralState = view.state;
  if (selectionCommand || selectionCommandKey) {
    if (!selectionCommand && (!selectionCommandKey || !Number.isInteger(selectionIndex))) {
      return { ...baseResult, reason: 'selection-failed', target, before, expected: plan.expected };
    }
    const select = selectionCommand
      ?? commands.get(selectionCommandKey!)({ index: selectionIndex!, pos: tablePos });
    // Milkdown's stock selection wrappers return Boolean(dispatch(...)); a
    // ProseMirror dispatch conventionally returns void, so their boolean is false
    // even when they emitted the required transaction. The captured transaction
    // count is therefore the authoritative selection result.
    const { transactions: selectionTransactions } = captureOfficeCommand(view.state, select);
    if (selectionTransactions.length !== 1) {
      return { ...baseResult, reason: 'selection-failed', target, before, expected: plan.expected };
    }
    ephemeralState = view.state.apply(selectionTransactions[0]);
  }
  const command = mutationCommand ?? (mutationCommandKey
    ? commands.get(mutationCommandKey)(undefined)
    : null);
  if (!command) {
    return { ...baseResult, reason: 'command-rejected', target, before, expected: plan.expected };
  }
  const { accepted: commandAccepted, transactions: proposedTransactions } = captureOfficeCommand(
    ephemeralState,
    command,
  );
  if (!commandAccepted) {
    return { ...baseResult, reason: 'command-rejected', target, before, expected: plan.expected };
  }
  if (proposedTransactions.length !== 1) {
    return { ...baseResult, reason: 'transaction-count', target, before, expected: plan.expected };
  }

  const staleNormalizedTransaction = titleRowAction === 'add'
    ? proposedTransactions[0]
    : normalizeStaleOfficeTableMutationTransaction(
      proposedTransactions[0],
      targetRecord.index,
      targetRecord.node,
    );
  const proposedTransaction = staleNormalizedTransaction
    ? normalizeValidOfficeTableTitleAlignment(
      staleNormalizedTransaction,
      targetRecord.index,
      targetRecord.node,
      mutation,
    )
    : null;
  if (!proposedTransaction) {
    return { ...baseResult, reason: 'preflight-failed', target, before, expected: plan.expected };
  }
  const nextDocument = proposedTransaction.doc;
  const beforeTables = tablesInDocument(view.state.doc);
  const nextTables = tablesInDocument(nextDocument);
  const nextTarget = nextTables[targetRecord.index];
  const next = nextTarget ? dimensionsOf(nextTarget.node) : undefined;
  const certifiedDocument = nextTarget
    ? view.state.tr.replaceWith(
      targetRecord.pos,
      targetRecord.pos + targetRecord.node.nodeSize,
      nextTarget.node,
    ).doc
    : undefined;
  const structureVerified = nextTarget && (titleRowAction
    ? verifyOfficeTableTitleRowMutationStructure(targetRecord.node, nextTarget.node, titleRowAction)
    : verifyCoordinatedOfficeTableMutationStructure(targetRecord.node, nextTarget.node, mutation));
  if (!nextTarget || !next || !tableSetIsCoherent(beforeTables, nextTables, targetRecord.index)
    || !certifiedDocument?.eq(nextDocument)
    || !hasCoherentOfficeTableMap(nextTarget.node)
    || !structureVerified
    || !verifyOfficeTableDimensions(before, next, mutation)) {
    return {
      ...baseResult,
      reason: 'preflight-failed',
      target,
      before,
      expected: plan.expected,
      proposedTransaction,
      nextDocument,
      next,
    };
  }

  const rawMetadataBefore = readOfficeTableMetadataSnapshot(root);
  if (!rawMetadataBefore) {
    return {
      ...baseResult,
      reason: 'metadata-unavailable',
      target,
      before,
      expected: plan.expected,
      proposedTransaction,
      nextDocument,
      next,
    };
  }
  const nextIdentity = {
    tableIndex: target.tableIndex,
    fingerprint: fingerprintProseTable(nextTarget.node),
  };
  const beforeIdentities = beforeTables.map(({ index, node }) => ({
    tableIndex: index,
    fingerprint: fingerprintProseTable(node),
  }));
  const rootCanQuery = typeof (root as { querySelectorAll?: unknown }).querySelectorAll === 'function';
  const targetDomTable = rootCanQuery ? getOfficeTables(root)[target.tableIndex] : undefined;
  const measuredColumns = targetDomTable
    ? measureOfficeTableLogicalWidths(targetDomTable)
    : [];
  const minimumColumnWidth = targetDomTable
    ? resolveOfficeTableSquareMinimum(targetDomTable) ?? undefined
    : undefined;
  const metadataBefore = rawMetadataBefore;
  let metadataAfter = transformOfficeTableMetadata(
    metadataBefore,
    target,
    nextIdentity,
    mutation,
    next,
    beforeIdentities,
    measuredColumns,
    minimumColumnWidth,
  );
  if (titleRowAction) {
    metadataAfter = transformOfficeTableTitleMarker(metadataAfter, nextIdentity, titleRowAction);
  } else if (targetRecord.node.attrs.officeTitleRowState === 'stale') {
    metadataAfter = transformOfficeTableTitleMarker(metadataAfter, nextIdentity, 'delete');
  }
  const liveTransaction = view.state.tr;
  proposedTransaction.steps.forEach((step) => liveTransaction.step(step));
  liveTransaction.setSelection(Selection.fromJSON(liveTransaction.doc, proposedTransaction.selection.toJSON()));
  if (proposedTransaction.storedMarks) liveTransaction.setStoredMarks(proposedTransaction.storedMarks);
  // The metadata Step is present on every accepted document-changing structure
  // transaction, including exact/equal empty snapshots. The companion history
  // plugin closes both sides of this composite event inside the same dispatch.
  liveTransaction.step(new OfficeTableMetadataStep(metadataBefore, metadataAfter));
  const operationToken = deferOfficeTableMetadataExternalPublication(liveTransaction);
  closeHistory(liveTransaction);
  let live: OfficeTableDimensions | undefined;
  try {
    view.dispatch(liveTransaction);

    const liveTables = tablesInDocument(view.state.doc);
    const liveTarget = liveTables[target.tableIndex];
    live = liveTarget ? dimensionsOf(liveTarget.node) : undefined;
    const published = readOfficeTableMetadataSnapshot(root);
    const verification = {
      dimensions: Boolean(live && verifyOfficeTableDimensions(before, live, mutation)),
      document: view.state.doc.eq(nextDocument),
      target: Boolean(liveTarget?.node.eq(nextTarget.node)),
      map: Boolean(liveTarget && hasCoherentOfficeTableMap(liveTarget.node)),
      structure: Boolean(liveTarget && (titleRowAction
        ? verifyOfficeTableTitleRowMutationStructure(targetRecord.node, liveTarget.node, titleRowAction)
        : verifyCoordinatedOfficeTableMutationStructure(targetRecord.node, liveTarget.node, mutation))),
      tables: tableSetIsCoherent(beforeTables, liveTables, target.tableIndex),
      metadata: Boolean(published && snapshotsEqual(published, metadataAfter)),
    };
    if (Object.values(verification).some((valid) => !valid)) {
      throw new OfficeTableMutationInvariantError({
        applied: false,
        reason: 'live-verification-failed',
        mutation,
        target,
        before,
        expected: plan.expected,
        proposedTransaction,
        nextDocument,
        next,
        metadataBefore,
        metadataAfter,
        live,
      });
    }
  } catch (error) {
    cancelOfficeTableMetadataExternalSnapshot(root, operationToken, view.state.doc);
    throw error;
  }
  if (!publishOfficeTableMetadataExternalSnapshot(root, metadataAfter, view.state.doc, operationToken)) {
    throw new OfficeTableMutationInvariantError({
      applied: false,
      reason: 'live-verification-failed',
      mutation,
      target,
      before,
      expected: plan.expected,
      proposedTransaction,
      nextDocument,
      next,
      metadataBefore,
      metadataAfter,
      live,
    });
  }
  return {
    applied: true,
    reason: 'applied',
    mutation,
    target,
    before,
    expected: plan.expected,
    proposedTransaction,
    nextDocument,
    next,
    metadataBefore,
    metadataAfter,
    live,
  };
}

export function runOfficeTableTitleRowMutation({
  root,
  view,
  commands,
  tablePos,
  action,
}: {
  root: HTMLElement;
  view: EditorView;
  commands: CommandManager;
  tablePos: number;
  action: OfficeTableTitleRowAction;
}): OfficeTableMutationResult {
  const mutation: OfficeTableStructureMutation = {
    axis: 'row',
    action: action === 'add' ? 'insert' : 'delete',
    index: 0,
  };
  const mutationCommand = createOfficeTableTitleRowCommand(tablePos, action);
  if (!mutationCommand) return { applied: false, reason: 'invalid-plan', mutation };
  return runStockOfficeTableMutation({
    root,
    view,
    commands,
    tablePos,
    mutation,
    mutationCommand,
    titleRowAction: action,
  });
}

export function createOfficeTableTitleRowCommand(
  tablePos: number,
  action: OfficeTableTitleRowAction,
): Command {
  return (state, dispatch) => {
    const transaction = buildOfficeTableTitleRowTransaction(state, tablePos, action);
    if (!transaction) return false;
    dispatch?.(transaction);
    return true;
  };
}

/**
 * Prefer the registered Milkdown command whenever its captured proposal is
 * exact. Only a schema-header/span boundary may retry with the Office-owned
 * explicit-index command, and that retry has no ceremonial selection step.
 */
export function runCertifiedStockOfficeTableMutation(
  options: RunStockMutationOptions,
): OfficeTableMutationResult {
  const stockResult = runStockOfficeTableMutation(options);
  if (stockResult.applied) return stockResult;
  const target = findTargetTable(options.view.state, options.tablePos);
  if (!target || !requiresOfficeTableExactBoundaryFallback(target.node, options.mutation)) {
    return stockResult;
  }
  const schemaHeaderBoundary = options.mutation.axis === 'row'
    && options.mutation.index === 0
    && target.node.child(0)?.type === target.node.type.schema.nodes.table_header_row;
  const isExpectedStockLimitation = stockResult.reason === 'preflight-failed'
    || (schemaHeaderBoundary && stockResult.reason === 'command-rejected');
  if (!isExpectedStockLimitation) return stockResult;
  const exactCommand = createOfficeTableMutationCommand(options.tablePos, options.mutation);
  if (!exactCommand) return stockResult;
  return runStockOfficeTableMutation({
    ...options,
    selectionIndex: undefined,
    selectionCommandKey: undefined,
    selectionCommand: undefined,
    mutationCommandKey: undefined,
    mutationCommand: exactCommand,
  });
}
