import {
  bindOfficeTableSources,
  type BoundOfficeTableSource,
  type Sha256Hex,
} from '../../../electron/shared/office-table-source-binding.mjs';
import {
  cloneOfficeTableRawValue,
  getDocumentTableLayouts,
  getRawDocumentTableStyles,
  hasDocumentTableTitleRow,
  normalizeDocumentTableBorderColor,
  normalizeDocumentTableBorderWidth,
  normalizeDocumentTableOverflow,
  serializeDocumentSettings,
  type DocumentFrontmatter,
  type DocumentSettings,
  type DocumentTableLayout,
  type DocumentTableStyle,
} from '../../lib/front-matter';
import {
  findStructureTableIdentityEntry,
  fingerprintOfficeTableHeader,
  type OfficeTableIdentity,
} from './officeTableIdentity';

export interface OfficeTableOutputEntry {
  tableIndex: number;
  sourceSha256: string;
  logicalWidth: number;
  columns: number[] | null;
  overflow: 'overflow' | 'truncate' | 'newline';
  titleRow: boolean;
  borderWidth: 1 | 2 | 3 | 4;
  borderColor: `#${string}` | null | 'default';
}

export interface OfficeTableOutputDescriptor {
  markdownSha256: string;
  tables: OfficeTableOutputEntry[];
}

export interface OfficeOutputSnapshot {
  bodyMarkdown: string;
  fullMarkdown: string;
  tablePresentation: OfficeTableOutputDescriptor;
}

export interface CapturedOfficeOutputState {
  bodyMarkdown: string;
  settings: DocumentSettings;
  frontmatter: DocumentFrontmatter;
}

function immutableCopy<T>(value: T): T {
  const copy = cloneOfficeTableRawValue(value);
  const freeze = (entry: unknown, seen = new WeakSet<object>()): void => {
    if (!entry || typeof entry !== 'object' || seen.has(entry)) return;
    seen.add(entry);
    Reflect.ownKeys(entry).forEach((key) => freeze((entry as Record<PropertyKey, unknown>)[key], seen));
    Object.freeze(entry);
  };
  freeze(copy);
  return copy;
}

export async function browserOfficeSha256Hex(bytes: Uint8Array): Promise<string> {
  const ownedBytes = Uint8Array.from(bytes);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', ownedBytes.buffer);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function identitiesForSources(sources: readonly BoundOfficeTableSource[]): OfficeTableIdentity[] {
  return sources.map((source) => ({
    tableIndex: source.tableIndex,
    fingerprint: fingerprintOfficeTableHeader(
      source.logicalWidth,
      source.semanticRows[0] ?? [],
    ),
  }));
}

function projectColumns(
  layout: DocumentTableLayout | undefined,
  logicalWidth: number,
): number[] | null {
  if (!layout || !Array.isArray(layout.columns) || layout.columns.length !== logicalWidth) return null;
  if (!layout.columns.every((value) => Number.isSafeInteger(value) && Number(value) > 0)) return null;
  return layout.columns.map((value) => Number(value));
}

function hasSafeTitleSurrogate(source: BoundOfficeTableSource): boolean {
  const headerCounts = source.cellChildCounts[0];
  return source.semanticRows.length >= 3
    && Array.isArray(headerCounts)
    && headerCounts.length === source.logicalWidth
    && headerCounts.slice(1).every((count) => count === 0);
}

export async function projectOfficeTableOutputDescriptor(
  bodyMarkdown: string,
  frontmatter: DocumentFrontmatter,
  sha256Hex: Sha256Hex = browserOfficeSha256Hex,
): Promise<OfficeTableOutputDescriptor> {
  const binding = await bindOfficeTableSources(bodyMarkdown, sha256Hex);
  const layouts = getDocumentTableLayouts(frontmatter);
  const styles = getRawDocumentTableStyles(frontmatter);
  const identities = identitiesForSources(binding.tables);
  const tables = binding.tables.map((source) => {
    const identity = identities[source.tableIndex];
    const layout = findStructureTableIdentityEntry<DocumentTableLayout>(
      layouts,
      identity,
      identities,
    );
    const style = findStructureTableIdentityEntry<DocumentTableStyle>(
      styles,
      identity,
      identities,
    );
    return {
      tableIndex: source.tableIndex,
      sourceSha256: source.sourceSha256,
      logicalWidth: source.logicalWidth,
      columns: projectColumns(layout, source.logicalWidth),
      overflow: normalizeDocumentTableOverflow(style?.tableOverflow),
      titleRow: hasDocumentTableTitleRow(style) && hasSafeTitleSurrogate(source),
      borderWidth: normalizeDocumentTableBorderWidth(style?.borderWidth),
      borderColor: normalizeDocumentTableBorderColor(style?.borderColor),
    } satisfies OfficeTableOutputEntry;
  });
  return immutableCopy({ markdownSha256: binding.markdownSha256, tables });
}

/**
 * The callback performs the one synchronous editor/frontmatter capture. No
 * promise is observed until all three captured values have been copied.
 */
export async function serializeOfficeOutputSnapshot(
  capture: () => CapturedOfficeOutputState,
  sha256Hex: Sha256Hex = browserOfficeSha256Hex,
): Promise<OfficeOutputSnapshot> {
  if (typeof capture !== 'function') throw new TypeError('Office output capture is required');
  const captured = capture();
  if (!captured || typeof captured.bodyMarkdown !== 'string') {
    throw new TypeError('Office output capture did not produce Markdown');
  }
  const bodyMarkdown = captured.bodyMarkdown;
  const settings = immutableCopy(captured.settings);
  const frontmatter = immutableCopy(captured.frontmatter);
  const fullMarkdown = serializeDocumentSettings(bodyMarkdown, settings, frontmatter);
  const tablePresentation = await projectOfficeTableOutputDescriptor(
    bodyMarkdown,
    frontmatter,
    sha256Hex,
  );
  return immutableCopy({ bodyMarkdown, fullMarkdown, tablePresentation });
}
