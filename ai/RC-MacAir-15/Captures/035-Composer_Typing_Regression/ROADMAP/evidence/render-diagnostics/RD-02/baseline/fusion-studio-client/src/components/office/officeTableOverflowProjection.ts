/**
 * @module officeTableOverflowProjection
 * @role Build the normalized SPEC-07 overflow projection from table identities.
 */
import type { Node as ProseNode } from '@milkdown/kit/prose/model';

import {
  DEFAULT_DOCUMENT_TABLE_OVERFLOW,
  normalizeDocumentTableOverflow,
  type DocumentTableOverflow,
  type DocumentTableStyle,
} from '../../lib/front-matter';
import {
  findStructureTableIdentityEntry,
  fingerprintProseTable,
  type OfficeTableIdentity,
} from './officeTableIdentity';

export type OfficeTableOverflowProjectionEntry = {
  tableIndex: number;
  fingerprint: string;
  overflow: DocumentTableOverflow;
};

export function projectOfficeTableOverflowModes(
  tables: readonly OfficeTableIdentity[],
  styles: unknown,
): OfficeTableOverflowProjectionEntry[] {
  const orderedTables = tables.map(({ fingerprint }, tableIndex) => ({
    tableIndex,
    fingerprint,
  }));

  return orderedTables.map((identity) => {
    const entry = findStructureTableIdentityEntry<DocumentTableStyle>(
      styles,
      identity,
      orderedTables,
    );
    return {
      tableIndex: identity.tableIndex,
      fingerprint: identity.fingerprint,
      overflow: entry
        ? normalizeDocumentTableOverflow(entry.tableOverflow)
        : DEFAULT_DOCUMENT_TABLE_OVERFLOW,
    };
  });
}

export function projectProseDocumentTableOverflowModes(
  doc: ProseNode,
  styles: unknown,
): OfficeTableOverflowProjectionEntry[] {
  const tables: OfficeTableIdentity[] = [];
  doc.descendants((node) => {
    if (node.type.spec.tableRole !== 'table') return true;
    tables.push({
      tableIndex: tables.length,
      fingerprint: fingerprintProseTable(node),
    });
    return false;
  });
  return projectOfficeTableOverflowModes(tables, styles);
}
