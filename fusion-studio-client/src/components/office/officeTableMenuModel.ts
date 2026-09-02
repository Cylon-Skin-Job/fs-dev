import { findParent } from '@milkdown/kit/prose';
import type { Node as ProseNode } from '@milkdown/kit/prose/model';
import type { EditorView } from '@milkdown/kit/prose/view';
import { TableMap } from '@milkdown/kit/prose/tables';
import type { OfficeTableStructureMutation } from './officeTableMutations';
import { getVerifiedOfficeTableTitleWidth } from './officeTableTitleCodec';

export type OfficeTableAction =
  | 'insert-row-above'
  | 'insert-row-below'
  | 'insert-col-left'
  | 'insert-col-right'
  | 'delete-row-above'
  | 'delete-row-below'
  | 'delete-col-left'
  | 'delete-col-right';

export type OfficeTableContext = {
  rowIndex: number;
  rowEndIndex: number;
  colIndex: number;
  colEndIndex: number;
  rowCount: number;
  colCount: number;
  tablePos: number;
  topRowCellCount?: number;
  verifiedTitleTable?: boolean;
  verifiedTitleContext?: boolean;
};

export function getLogicalTableCellContext(table: ProseNode, cell: ProseNode) {
  const tableMap = TableMap.get(table);
  const cellPosition = [...new Set(tableMap.map)].find((position) => table.nodeAt(position) === cell);
  if (cellPosition === undefined) return null;
  const rect = tableMap.findCell(cellPosition);
  return {
    rowIndex: rect.top,
    rowEndIndex: rect.bottom,
    colIndex: rect.left,
    colEndIndex: rect.right,
  };
}

export function getOfficeTableContext(
  view: EditorView,
  clientX: number,
  clientY: number,
): OfficeTableContext | null {
  try {
    const posAtCoords = view.posAtCoords({ left: clientX, top: clientY });
    const pos = posAtCoords?.inside != null && posAtCoords.inside >= 0
      ? posAtCoords.inside
      : posAtCoords?.pos;
    if (pos == null || pos < 0) return null;

    const $pos = view.state.doc.resolve(pos);
    const node = view.state.doc.nodeAt(pos);
    const isCell = (candidate: ProseNode) => (
      candidate.type.name === 'table_cell' || candidate.type.name === 'table_header'
    );
    const cell = node && isCell(node) ? { node } : findParent(isCell)($pos);
    const table = findParent((candidate) => candidate.type.name === 'table')($pos);
    if (!cell || !table) return null;

    const tableMap = TableMap.get(table.node);
    const logical = getLogicalTableCellContext(table.node, cell.node);
    if (!logical) return null;
    const verifiedTitleWidth = getVerifiedOfficeTableTitleWidth(table.node);
    return {
      rowIndex: logical.rowIndex,
      rowEndIndex: logical.rowEndIndex,
      colIndex: logical.colIndex,
      colEndIndex: logical.colEndIndex,
      rowCount: tableMap.height,
      colCount: tableMap.width,
      tablePos: table.from + 1,
      topRowCellCount: table.node.child(0).childCount,
      verifiedTitleTable: verifiedTitleWidth === tableMap.width,
      verifiedTitleContext: logical.rowIndex === 0 && verifiedTitleWidth === tableMap.width,
    };
  } catch {
    return null;
  }
}

export function isOfficeTableMutationForbiddenForVerifiedTitle(
  context: OfficeTableContext,
  mutation: OfficeTableStructureMutation,
): boolean {
  if (!context.verifiedTitleTable || mutation.axis !== 'row' || mutation.action !== 'delete') {
    return false;
  }
  return mutation.index === 0 || context.rowCount <= 3;
}

export function getOfficeTableMutationForAction(
  context: OfficeTableContext,
  action: OfficeTableAction,
): OfficeTableStructureMutation | null {
  switch (action) {
    case 'insert-row-above':
      return { axis: 'row', action: 'insert', index: context.rowIndex };
    case 'insert-row-below':
      return { axis: 'row', action: 'insert', index: context.rowEndIndex };
    case 'insert-col-left':
      return {
        axis: 'column', action: 'insert', index: context.colIndex, anchorIndex: context.colIndex,
      };
    case 'insert-col-right':
      return {
        axis: 'column', action: 'insert', index: context.colEndIndex, anchorIndex: context.colEndIndex - 1,
      };
    case 'delete-row-above':
      return context.rowIndex > 0 ? { axis: 'row', action: 'delete', index: context.rowIndex - 1 } : null;
    case 'delete-row-below':
      return context.rowEndIndex < context.rowCount
        ? { axis: 'row', action: 'delete', index: context.rowEndIndex }
        : null;
    case 'delete-col-left':
      return context.colIndex > 0 && context.colCount > 1
        ? { axis: 'column', action: 'delete', index: context.colIndex - 1 }
        : null;
    case 'delete-col-right':
      return context.colEndIndex < context.colCount && context.colCount > 1
        ? { axis: 'column', action: 'delete', index: context.colEndIndex }
        : null;
  }
}

const MINIMUM_ROWS_REASON = 'A table must keep one schema header row and at least one data row.';
const MINIMUM_COLUMNS_REASON = 'A table must keep at least one column.';
const NO_ROW_ABOVE_REASON = 'There is no adjacent row above this cell to delete.';
const NO_ROW_BELOW_REASON = 'There is no adjacent row below this cell to delete.';
const NO_COLUMN_LEFT_REASON = 'There is no adjacent column to the left of this cell to delete.';
const NO_COLUMN_RIGHT_REASON = 'There is no adjacent column to the right of this cell to delete.';

export function getOfficeTableActionDisabledReason(
  context: OfficeTableContext,
  action: OfficeTableAction,
): string | undefined {
  switch (action) {
    case 'delete-row-above':
      return context.rowCount <= 2
        ? MINIMUM_ROWS_REASON
        : context.rowIndex <= 0 ? NO_ROW_ABOVE_REASON : undefined;
    case 'delete-row-below':
      return context.rowCount <= 2
        ? MINIMUM_ROWS_REASON
        : context.rowEndIndex >= context.rowCount ? NO_ROW_BELOW_REASON : undefined;
    case 'delete-col-left':
      return context.colCount <= 1
        ? MINIMUM_COLUMNS_REASON
        : context.colIndex <= 0 ? NO_COLUMN_LEFT_REASON : undefined;
    case 'delete-col-right':
      return context.colCount <= 1
        ? MINIMUM_COLUMNS_REASON
        : context.colEndIndex >= context.colCount ? NO_COLUMN_RIGHT_REASON : undefined;
    default:
      return undefined;
  }
}
