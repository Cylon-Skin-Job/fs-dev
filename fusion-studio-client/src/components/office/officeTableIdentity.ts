/**
 * @module officeTableIdentity
 * @role Shared table identity and table-scoped metadata matching helpers.
 */
import type { Node as ProseNode } from '@milkdown/kit/prose/model';
import { TableMap } from '@milkdown/kit/prose/tables';

export type OfficeTableIdentity = {
  tableIndex: number;
  fingerprint: string;
};

export type OfficeTableIdentityEntry = Record<string, unknown>;

export type ProjectedOfficeTableIdentityEntry<T extends OfficeTableIdentityEntry> = {
  entry: T;
  identity: OfficeTableIdentity;
  rawIndex: number;
};

export type OfficeDomTableCellCoordinate = {
  rowIndex: number;
  colIndex: number;
};

type OfficeDomTableLogicalGrid = {
  coordinates: Map<HTMLTableCellElement, OfficeDomTableCellCoordinate>;
  width: number;
};

const TABLE_SELECTOR = '.rv-office-table';
const TABLE_SCOPED_KEYS = [
  'tableIndex', 'fingerprint', 'columns', 'rows', 'cells', 'style',
] as const;

export function normalizeOfficeTableCellText(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export function fingerprintOfficeTableHeader(
  width: number,
  headerCells: readonly string[],
): string {
  const headerText = headerCells.map(normalizeOfficeTableCellText).join('|');
  const source = `${width}:${headerText}`;
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `table-${(hash >>> 0).toString(36)}`;
}

export function getOfficeTables(root: HTMLElement): HTMLTableElement[] {
  return Array.from(root.querySelectorAll<HTMLTableElement>(TABLE_SELECTOR));
}

function buildOfficeDomTableLogicalGrid(table: HTMLTableElement): OfficeDomTableLogicalGrid {
  const grid: HTMLTableCellElement[][] = [];
  const coordinates = new Map<HTMLTableCellElement, OfficeDomTableCellCoordinate>();
  let width = 0;
  Array.from(table.rows).forEach((row, rowIndex) => {
    const logicalRow = grid[rowIndex] ?? (grid[rowIndex] = []);
    let colIndex = 0;
    Array.from(row.cells).forEach((cell) => {
      const colSpan = Math.max(1, cell.colSpan);
      const rowSpan = cell.rowSpan === 0
        ? Math.max(1, table.rows.length - rowIndex)
        : Math.max(1, cell.rowSpan);
      while (Array.from(
        { length: colSpan },
        (_, offset) => logicalRow[colIndex + offset],
      ).some(Boolean)) colIndex += 1;
      coordinates.set(cell, { rowIndex, colIndex });
      for (let rowOffset = 0; rowOffset < rowSpan; rowOffset += 1) {
        const occupiedRow = grid[rowIndex + rowOffset]
          ?? (grid[rowIndex + rowOffset] = []);
        for (let colOffset = 0; colOffset < colSpan; colOffset += 1) {
          occupiedRow[colIndex + colOffset] = cell;
        }
      }
      width = Math.max(width, colIndex + colSpan);
      colIndex += colSpan;
    });
  });
  return { coordinates, width };
}

export function mapOfficeDomTableLogicalCells(
  table: HTMLTableElement,
): Map<HTMLTableCellElement, OfficeDomTableCellCoordinate> {
  return buildOfficeDomTableLogicalGrid(table).coordinates;
}

export function getDomTableLogicalWidth(table: HTMLTableElement): number {
  return buildOfficeDomTableLogicalGrid(table).width;
}

export function fingerprintDomTable(table: HTMLTableElement): string {
  const header = table.rows.item(0);
  const headerCells = header
    ? Array.from(header.cells).map((cell) => cell.textContent || '')
    : [];
  return fingerprintOfficeTableHeader(getDomTableLogicalWidth(table), headerCells);
}

export function fingerprintProseTable(table: ProseNode): string {
  const header = table.firstChild;
  const headerCells = header
    ? Array.from({ length: header.childCount }, (_, index) => header.child(index).textContent)
    : [];
  return fingerprintOfficeTableHeader(TableMap.get(table).width, headerCells);
}

export function identityForDomTable(root: HTMLElement, table: HTMLTableElement): OfficeTableIdentity {
  return {
    tableIndex: getOfficeTables(root).indexOf(table),
    fingerprint: fingerprintDomTable(table),
  };
}

/**
 * Build a read-only identity projection over a raw frontmatter collection.
 * Opaque entries never enter matching, and fallback identities are deliberately
 * not assigned to the raw records.
 */
export function projectOfficeTableIdentityEntries<T extends OfficeTableIdentityEntry = OfficeTableIdentityEntry>(
  collection: unknown,
): Array<ProjectedOfficeTableIdentityEntry<T>> {
  if (!Array.isArray(collection)) return [];
  const projected: Array<ProjectedOfficeTableIdentityEntry<T>> = [];
  collection.forEach((value, rawIndex) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return;
    const entry = value as T;
    if (!TABLE_SCOPED_KEYS.some((key) => Object.hasOwn(entry, key))) return;
    const tableIndex = typeof entry.tableIndex === 'number'
      && Number.isInteger(entry.tableIndex)
      && entry.tableIndex >= 0
      ? entry.tableIndex
      : rawIndex;
    const fingerprint = typeof entry.fingerprint === 'string' && entry.fingerprint.trim()
      ? entry.fingerprint.trim()
      : `table-${tableIndex}`;
    projected.push({ entry, identity: { tableIndex, fingerprint }, rawIndex });
  });
  return projected;
}

export function findTableIdentityEntry<T extends OfficeTableIdentityEntry = OfficeTableIdentityEntry>(
  collection: unknown,
  identity: OfficeTableIdentity,
): T | undefined {
  const entries = projectOfficeTableIdentityEntries<T>(collection);
  return entries.find(({ identity: candidate }) => (
    candidate.tableIndex === identity.tableIndex && candidate.fingerprint === identity.fingerprint
  ))?.entry
    || entries.find(({ identity: candidate }) => candidate.fingerprint === identity.fingerprint)?.entry
    || entries.find(({ identity: candidate }) => candidate.tableIndex === identity.tableIndex)?.entry;
}

export function findStructureTableIdentityEntry<T extends OfficeTableIdentityEntry = OfficeTableIdentityEntry>(
  collection: unknown,
  identity: OfficeTableIdentity,
  liveTables: readonly OfficeTableIdentity[],
): T | undefined {
  const entries = projectOfficeTableIdentityEntries<T>(collection);
  const exact = entries.find(({ identity: candidate }) => (
    candidate.tableIndex === identity.tableIndex && candidate.fingerprint === identity.fingerprint
  ));
  if (exact) return exact.entry;

  const liveFingerprintCount = liveTables.filter(
    (table) => table.fingerprint === identity.fingerprint,
  ).length;
  if (liveFingerprintCount === 1) {
    const fingerprintMatches = entries.filter(
      ({ identity: candidate }) => candidate.fingerprint === identity.fingerprint,
    );
    if (fingerprintMatches.length === 1) return fingerprintMatches[0].entry;
  }

  return entries.find(({ identity: candidate }) => candidate.tableIndex === identity.tableIndex)?.entry;
}

export function matchesTableIdentity(
  entry: OfficeTableIdentityEntry,
  identity: OfficeTableIdentity,
  entries: unknown,
): boolean {
  return findTableIdentityEntry(entries, identity) === entry;
}
