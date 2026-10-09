/**
 * @module officeTableInsertion
 * @role Verified whole-table insertion planning and one-dispatch coordination.
 */
import type { CommandManager } from '@milkdown/kit/core';
import type { Node as ProseNode } from '@milkdown/kit/prose/model';
import { insertTableCommand } from '@milkdown/kit/preset/gfm';
import {
  Selection,
  TextSelection,
  type EditorState,
  type Transaction,
} from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import { closeHistory } from '@milkdown/kit/prose/history';
import { TableMap } from '@milkdown/kit/prose/tables';
import {
  insertAndReindexDocumentTableCollection,
  type DocumentTableCollectionIdentity,
} from '../../lib/front-matter';
import {
  cancelOfficeTableMetadataExternalSnapshot,
  deferOfficeTableMetadataExternalPublication,
  OfficeTableMetadataStep,
  publishOfficeTableMetadataExternalSnapshot,
  readOfficeTableMetadataSnapshot,
  snapshotsEqual,
  type OfficeTableMetadataSnapshot,
} from './officeTableHistory';
import { captureOfficeCommand } from './officeTableMutations';
import { fingerprintProseTable, type OfficeTableIdentity } from './officeTableIdentity';

const TABLE_MIN_ROWS = 2;

type OfficeTableRecord = {
  node: ProseNode;
  pos: number;
  index: number;
  identity: OfficeTableIdentity;
};

export type OfficeTableInsertionCapture = {
  document: ProseNode;
  target: {
    node: ProseNode;
    pos: number;
  } | null;
};

export type OfficeTableInsertionPlan =
  | { applied: false; reason: 'STALE_TARGET' | 'INVALID_TRANSACTION' }
  | {
    applied: true;
    reason: 'APPLIED';
    preparation: Transaction;
    proposedTransaction: Transaction;
    nextDocument: ProseNode;
    metadataBefore: OfficeTableMetadataSnapshot;
    metadataAfter: OfficeTableMetadataSnapshot;
    insertedTableIndex: number;
    beforeTables: readonly OfficeTableRecord[];
    afterTables: readonly OfficeTableRecord[];
  };

export type OfficeTableInsertionResult =
  | {
    applied: false;
    reason: 'STALE_TARGET' | 'INVALID_TRANSACTION' | 'METADATA_UNAVAILABLE';
  }
  | {
    applied: true;
    reason: 'APPLIED';
    insertedTableIndex: number;
    metadataBefore: OfficeTableMetadataSnapshot;
    metadataAfter: OfficeTableMetadataSnapshot;
  };

export class OfficeTableInsertionInvariantError extends Error {
  constructor(message: string) {
    super(`BLOCKED: ${message}`);
    this.name = 'OfficeTableInsertionInvariantError';
  }
}

function tablesInDocument(document: ProseNode): OfficeTableRecord[] {
  const tables: OfficeTableRecord[] = [];
  document.descendants((node, pos) => {
    if (node.type.name !== 'table') return true;
    const index = tables.length;
    tables.push({
      node,
      pos,
      index,
      identity: { tableIndex: index, fingerprint: fingerprintProseTable(node) },
    });
    return false;
  });
  return tables;
}

function identitiesOf(tables: readonly OfficeTableRecord[]): DocumentTableCollectionIdentity[] {
  return tables.map(({ identity }) => ({ ...identity }));
}

function existingTablesSurviveInsertion(
  before: readonly OfficeTableRecord[],
  after: readonly OfficeTableRecord[],
  insertedTableIndex: number,
): boolean {
  if (after.length !== before.length + 1) return false;
  return before.every(({ node }, beforeIndex) => {
    const afterIndex = beforeIndex < insertedTableIndex ? beforeIndex : beforeIndex + 1;
    return after[afterIndex]?.node.eq(node) === true;
  });
}

function insertedTableIndex(
  before: readonly OfficeTableRecord[],
  after: readonly OfficeTableRecord[],
  rows: number,
  columns: number,
  selectionPosition: number,
): number | null {
  const selectedTable = after.find(({ node, pos }) => (
    selectionPosition > pos && selectionPosition < pos + node.nodeSize
  ));
  if (!selectedTable) return null;
  const map = TableMap.get(selectedTable.node);
  return map.height === rows
    && map.width === columns
    && existingTablesSurviveInsertion(before, after, selectedTable.index)
    ? selectedTable.index
    : null;
}

function insertionMetadataSnapshot(
  before: OfficeTableMetadataSnapshot,
  insertionIndex: number,
  beforeTables: readonly OfficeTableRecord[],
  afterTables: readonly OfficeTableRecord[],
): OfficeTableMetadataSnapshot {
  const beforeIdentities = identitiesOf(beforeTables);
  const afterIdentities = identitiesOf(afterTables);
  const next: OfficeTableMetadataSnapshot = {
    tables: insertAndReindexDocumentTableCollection(
      before.tables,
      insertionIndex,
      beforeIdentities,
      afterIdentities,
    ),
    tableColors: insertAndReindexDocumentTableCollection(
      before.tableColors,
      insertionIndex,
      beforeIdentities,
      afterIdentities,
    ),
  };
  if (Object.hasOwn(before, 'tableStyles')) {
    next.tableStyles = insertAndReindexDocumentTableCollection(
      before.tableStyles,
      insertionIndex,
      beforeIdentities,
      afterIdentities,
    );
  }
  if (before.pageAlignment) next.pageAlignment = before.pageAlignment;
  return next;
}

export function captureOfficeTableInsertionTarget(
  state: EditorState,
  targetPosition: number | null,
): OfficeTableInsertionCapture {
  const targetNode = targetPosition === null ? null : state.doc.nodeAt(targetPosition);
  return {
    document: state.doc,
    target: targetNode && targetPosition !== null
      ? { node: targetNode, pos: targetPosition }
      : null,
  };
}

function prepareInsertionState(
  state: EditorState,
  capture: OfficeTableInsertionCapture,
): { state: EditorState; transaction: Transaction } | null {
  if (!state.doc.eq(capture.document)) return null;
  if (capture.target && !state.doc.nodeAt(capture.target.pos)?.eq(capture.target.node)) return null;

  const paragraph = state.schema.nodes.paragraph;
  if (!paragraph) return null;
  const transaction = state.tr;
  let selectionPosition: number;
  if (capture.target?.node.type === paragraph
    && capture.target.node.textContent.trim().length === 0) {
    selectionPosition = capture.target.pos + 1;
  } else {
    const insertPosition = capture.target?.pos ?? state.doc.content.size;
    transaction.insert(insertPosition, paragraph.create());
    selectionPosition = insertPosition + 1;
  }
  transaction.setSelection(TextSelection.create(transaction.doc, selectionPosition));
  return { state: state.apply(transaction), transaction };
}

export function planOfficeTableInsertion(
  state: EditorState,
  commands: CommandManager,
  capture: OfficeTableInsertionCapture,
  rows: number,
  columns: number,
  metadataBefore?: OfficeTableMetadataSnapshot,
): OfficeTableInsertionPlan {
  const expectedRows = Math.max(TABLE_MIN_ROWS, rows);
  const expectedColumns = Math.max(1, columns);
  const prepared = prepareInsertionState(state, capture);
  if (!prepared) return { applied: false, reason: 'STALE_TARGET' };
  if (!metadataBefore) return { applied: false, reason: 'INVALID_TRANSACTION' };

  try {
    const command = commands.get(insertTableCommand.key)({
      row: expectedRows,
      col: expectedColumns,
    });
    const proposal = captureOfficeCommand(prepared.state, command);
    if (!proposal.accepted || proposal.transactions.length !== 1) {
      return { applied: false, reason: 'INVALID_TRANSACTION' };
    }
    const proposedTransaction = proposal.transactions[0];
    const beforeTables = tablesInDocument(state.doc);
    const afterTables = tablesInDocument(proposedTransaction.doc);
    const insertionIndex = insertedTableIndex(
      beforeTables,
      afterTables,
      expectedRows,
      expectedColumns,
      proposedTransaction.selection.from,
    );
    if (!proposedTransaction.docChanged || insertionIndex === null) {
      return { applied: false, reason: 'INVALID_TRANSACTION' };
    }
    return {
      applied: true,
      reason: 'APPLIED',
      preparation: prepared.transaction,
      proposedTransaction,
      nextDocument: proposedTransaction.doc,
      metadataBefore,
      metadataAfter: insertionMetadataSnapshot(
        metadataBefore,
        insertionIndex,
        beforeTables,
        afterTables,
      ),
      insertedTableIndex: insertionIndex,
      beforeTables,
      afterTables,
    };
  } catch {
    return { applied: false, reason: 'INVALID_TRANSACTION' };
  }
}

export function runOfficeTableInsertion({
  root,
  view,
  commands,
  capture,
  rows,
  columns,
}: {
  root: HTMLElement;
  view: EditorView;
  commands: CommandManager;
  capture: OfficeTableInsertionCapture;
  rows: number;
  columns: number;
}): OfficeTableInsertionResult {
  const metadataBefore = readOfficeTableMetadataSnapshot(root);
  if (!metadataBefore) return { applied: false, reason: 'METADATA_UNAVAILABLE' };
  const plan = planOfficeTableInsertion(
    view.state,
    commands,
    capture,
    rows,
    columns,
    metadataBefore,
  );
  if (!plan.applied) return plan;

  const transaction = view.state.tr;
  plan.preparation.steps.forEach((step) => transaction.step(step));
  plan.proposedTransaction.steps.forEach((step) => transaction.step(step));
  transaction.setSelection(Selection.fromJSON(
    transaction.doc,
    plan.proposedTransaction.selection.toJSON(),
  ));
  if (plan.proposedTransaction.storedMarks) {
    transaction.setStoredMarks(plan.proposedTransaction.storedMarks);
  }
  transaction.step(new OfficeTableMetadataStep(plan.metadataBefore, plan.metadataAfter));
  const operationToken = deferOfficeTableMetadataExternalPublication(transaction);
  closeHistory(transaction);
  try {
    view.dispatch(transaction);
    const liveTables = tablesInDocument(view.state.doc);
    const published = readOfficeTableMetadataSnapshot(root);
    if (!view.state.doc.eq(plan.nextDocument)
      || !existingTablesSurviveInsertion(
        plan.beforeTables,
        liveTables,
        plan.insertedTableIndex,
      )
      || !published
      || !snapshotsEqual(published, plan.metadataAfter)) {
      throw new OfficeTableInsertionInvariantError(
        'whole-table insertion failed its synchronous content/metadata invariant',
      );
    }
  } catch (error) {
    cancelOfficeTableMetadataExternalSnapshot(root, operationToken, view.state.doc);
    throw error;
  }
  if (!publishOfficeTableMetadataExternalSnapshot(
    root,
    plan.metadataAfter,
    view.state.doc,
    operationToken,
  )) {
    throw new OfficeTableInsertionInvariantError(
      'whole-table insertion external settlement was rejected',
    );
  }
  return {
    applied: true,
    reason: 'APPLIED',
    insertedTableIndex: plan.insertedTableIndex,
    metadataBefore: plan.metadataBefore,
    metadataAfter: plan.metadataAfter,
  };
}
