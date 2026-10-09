/**
 * @module officeTableRemoval
 * @role Pure captured-target whole-table planning and one-dispatch coordination.
 */
import type { Node as ProseNode } from '@milkdown/kit/prose/model';
import { TextSelection, type EditorState, type Transaction } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import { closeHistory } from '@milkdown/kit/prose/history';
import {
  deleteAndReindexDocumentTableCollection,
  type DocumentTableCollectionIdentity,
} from '../../lib/front-matter';
import { fingerprintProseTable, type OfficeTableIdentity } from './officeTableIdentity';
import {
  cancelOfficeTableMetadataExternalSnapshot,
  deferOfficeTableMetadataExternalPublication,
  OfficeTableMetadataStep,
  publishOfficeTableMetadataExternalSnapshot,
  readOfficeTableMetadataSnapshot,
  snapshotsEqual,
  type OfficeTableMetadataSnapshot,
} from './officeTableHistory';

type OfficeTableRecord = {
  node: ProseNode;
  pos: number;
  index: number;
  identity: OfficeTableIdentity;
};

export type OfficeTableRemovalCapture = {
  bookmark: {
    from: number;
    to: number;
  };
  identity: OfficeTableIdentity;
  table: ProseNode;
};

export type OfficeTableRemovalPlan =
  | { applied: false; reason: 'STALE_TARGET' }
  | { applied: false; reason: 'INVALID_TRANSACTION' }
  | {
    applied: true;
    reason: 'APPLIED';
    transaction: Transaction;
    nextDocument: ProseNode;
    metadataBefore: OfficeTableMetadataSnapshot;
    metadataAfter: OfficeTableMetadataSnapshot;
    target: OfficeTableIdentity;
    beforeTables: readonly OfficeTableRecord[];
    afterTables: readonly OfficeTableRecord[];
  };

export type OfficeTableRemovalResult =
  | { applied: false; reason: 'STALE_TARGET' | 'INVALID_TRANSACTION' | 'METADATA_UNAVAILABLE' }
  | {
    applied: true;
    reason: 'APPLIED';
    target: OfficeTableIdentity;
    metadataBefore: OfficeTableMetadataSnapshot;
    metadataAfter: OfficeTableMetadataSnapshot;
  };

export class OfficeTableRemovalInvariantError extends Error {
  constructor(message: string) {
    super(`BLOCKED: ${message}`);
    this.name = 'OfficeTableRemovalInvariantError';
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

function sameTablesExceptRemoved(
  before: readonly OfficeTableRecord[],
  after: readonly OfficeTableRecord[],
  removedIndex: number,
): boolean {
  if (after.length !== before.length - 1) return false;
  return after.every(({ node }, nextIndex) => {
    const beforeIndex = nextIndex < removedIndex ? nextIndex : nextIndex + 1;
    return before[beforeIndex]?.node.eq(node) === true;
  });
}

export function captureOfficeTableRemovalTarget(
  state: EditorState,
  tablePosition: number,
): OfficeTableRemovalCapture | null {
  const target = tablesInDocument(state.doc).find(({ pos, node }) => (
    tablePosition >= pos && tablePosition <= pos + node.nodeSize
  ));
  if (!target) return null;
  return {
    bookmark: {
      from: target.pos,
      to: target.pos + target.node.nodeSize,
    },
    identity: { ...target.identity },
    table: target.node,
  };
}

function capturedTargetIsCurrent(
  tables: readonly OfficeTableRecord[],
  capture: OfficeTableRemovalCapture,
): boolean {
  const target = tables[capture.identity.tableIndex];
  return Boolean(target
    && target.pos === capture.bookmark.from
    && target.pos + target.node.nodeSize === capture.bookmark.to
    && target.identity.fingerprint === capture.identity.fingerprint
    && target.node.eq(capture.table));
}

function removalMetadataSnapshot(
  before: OfficeTableMetadataSnapshot,
  removedIndex: number,
  beforeTables: readonly OfficeTableRecord[],
  afterTables: readonly OfficeTableRecord[],
): OfficeTableMetadataSnapshot {
  const beforeIdentities = identitiesOf(beforeTables);
  const afterIdentities = identitiesOf(afterTables);
  const next: OfficeTableMetadataSnapshot = {
    tables: deleteAndReindexDocumentTableCollection(
      before.tables,
      removedIndex,
      beforeIdentities,
      afterIdentities,
    ),
    tableColors: deleteAndReindexDocumentTableCollection(
      before.tableColors,
      removedIndex,
      beforeIdentities,
      afterIdentities,
    ),
  };
  if (Object.hasOwn(before, 'tableStyles')) {
    next.tableStyles = deleteAndReindexDocumentTableCollection(
      before.tableStyles,
      removedIndex,
      beforeIdentities,
      afterIdentities,
    );
  }
  if (before.pageAlignment) next.pageAlignment = before.pageAlignment;
  return next;
}

/**
 * Purely plan a deletion against the supplied state. No callbacks, dispatches,
 * persistence, DOM writes, or renderer state changes occur here.
 */
export function planOfficeTableRemoval(
  state: EditorState,
  capture: OfficeTableRemovalCapture,
  metadataBefore?: OfficeTableMetadataSnapshot,
): OfficeTableRemovalPlan {
  const beforeTables = tablesInDocument(state.doc);
  if (!capturedTargetIsCurrent(beforeTables, capture)) {
    return { applied: false, reason: 'STALE_TARGET' };
  }
  if (!metadataBefore) return { applied: false, reason: 'INVALID_TRANSACTION' };

  try {
    const transaction = state.tr.delete(capture.bookmark.from, capture.bookmark.to);
    const nearbyTextPosition = Math.min(capture.bookmark.from, transaction.doc.content.size);
    transaction.setSelection(TextSelection.near(transaction.doc.resolve(nearbyTextPosition), 1));
    const afterTables = tablesInDocument(transaction.doc);
    if (!transaction.docChanged
      || !sameTablesExceptRemoved(beforeTables, afterTables, capture.identity.tableIndex)) {
      return { applied: false, reason: 'INVALID_TRANSACTION' };
    }
    const metadataAfter = removalMetadataSnapshot(
      metadataBefore,
      capture.identity.tableIndex,
      beforeTables,
      afterTables,
    );
    return {
      applied: true,
      reason: 'APPLIED',
      transaction,
      nextDocument: transaction.doc,
      metadataBefore,
      metadataAfter,
      target: { ...capture.identity },
      beforeTables,
      afterTables,
    };
  } catch {
    return { applied: false, reason: 'INVALID_TRANSACTION' };
  }
}

export function runOfficeTableRemoval({
  root,
  view,
  capture,
}: {
  root: HTMLElement;
  view: EditorView;
  capture: OfficeTableRemovalCapture;
}): OfficeTableRemovalResult {
  const metadataBefore = readOfficeTableMetadataSnapshot(root);
  if (!metadataBefore) return { applied: false, reason: 'METADATA_UNAVAILABLE' };
  const plan = planOfficeTableRemoval(view.state, capture, metadataBefore);
  if (!plan.applied) return plan;

  plan.transaction.step(new OfficeTableMetadataStep(plan.metadataBefore, plan.metadataAfter));
  const operationToken = deferOfficeTableMetadataExternalPublication(plan.transaction);
  closeHistory(plan.transaction);
  try {
    view.dispatch(plan.transaction);
    const liveTables = tablesInDocument(view.state.doc);
    const published = readOfficeTableMetadataSnapshot(root);
    if (!view.state.doc.eq(plan.nextDocument)
      || !sameTablesExceptRemoved(plan.beforeTables, liveTables, plan.target.tableIndex)
      || !published
      || !snapshotsEqual(published, plan.metadataAfter)) {
      throw new OfficeTableRemovalInvariantError(
        'whole-table deletion failed its synchronous content/metadata invariant',
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
    throw new OfficeTableRemovalInvariantError(
      'whole-table deletion external settlement was rejected',
    );
  }
  return {
    applied: true,
    reason: 'APPLIED',
    target: plan.target,
    metadataBefore: plan.metadataBefore,
    metadataAfter: plan.metadataAfter,
  };
}
