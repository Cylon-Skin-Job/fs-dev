/**
 * @module officeTableBorderProjection
 * @role Build the normalized SPEC-09 border projection in live table order.
 */
import type { Node as ProseNode } from '@milkdown/kit/prose/model';

import {
  DEFAULT_DOCUMENT_TABLE_BORDER_WIDTH,
  normalizeDocumentTableBorderColor,
  normalizeDocumentTableBorderWidth,
  type DocumentTableBorderColor,
  type DocumentTableBorderWidth,
  type DocumentTableStyle,
} from '../../lib/front-matter';
import {
  findStructureTableIdentityEntry,
  fingerprintProseTable,
  type OfficeTableIdentity,
} from './officeTableIdentity';

export type OfficeTableBorderProjectionEntry = {
  borderWidth: DocumentTableBorderWidth;
  borderColor: DocumentTableBorderColor;
};

export function projectOfficeTableBorders(
  tables: readonly OfficeTableIdentity[],
  styles: unknown,
): OfficeTableBorderProjectionEntry[] {
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
      borderWidth: entry
        ? normalizeDocumentTableBorderWidth(entry.borderWidth)
        : DEFAULT_DOCUMENT_TABLE_BORDER_WIDTH,
      borderColor: entry
        ? normalizeDocumentTableBorderColor(entry.borderColor)
        : 'default',
    };
  });
}

export function projectProseDocumentTableBorders(
  doc: ProseNode,
  styles: unknown,
): OfficeTableBorderProjectionEntry[] {
  const tables: OfficeTableIdentity[] = [];
  doc.descendants((node) => {
    if (node.type.spec.tableRole !== 'table') return true;
    tables.push({
      tableIndex: tables.length,
      fingerprint: fingerprintProseTable(node),
    });
    return false;
  });
  return projectOfficeTableBorders(tables, styles);
}
