/**
 * @module front-matter
 * @role Parse and serialize YAML front matter for markdown documents
 *
 * Front matter is the system-wide markdown document envelope. `name`,
 * `description`, and `metadata` are shared retrieval fields. Office/Email
 * display settings live under `metadata.display` with other document metadata.
 */

import matter from 'gray-matter';

export interface DocumentSettings {
  font: {
    family: string;
    size: number;
  };
  alignment: 'left' | 'center' | 'right' | 'justify';
  margins: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
}

export type DocumentFrontmatter = Record<string, unknown>;

export interface DocumentTableLayout {
  /** Raw identity fields. Consumers derive a safe identity without rewriting these values. */
  tableIndex?: unknown;
  fingerprint?: unknown;
  /** Raw frontmatter slots. Renderers validate each slot without rewriting it. */
  columns?: unknown;
  rows?: unknown;
  style?: unknown;
  [key: string]: unknown;
}

export const DEFAULT_SETTINGS: DocumentSettings = {
  font: { family: 'serif', size: 16 },
  alignment: 'left',
  margins: { top: 72, bottom: 72, left: 90, right: 90 },
};

export const FONT_CSS_MAP: Record<string, string> = {
  sans: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  serif: 'Georgia, "Times New Roman", serif',
  mono: '"Courier New", Courier, monospace',
  arial: 'Arial, Helvetica, sans-serif',
  georgia: 'Georgia, "Times New Roman", serif',
  courier: '"Courier New", Courier, monospace',
};

export const ALIGNMENT_OPTIONS: Array<DocumentSettings['alignment']> = [
  'left',
  'center',
  'right',
  'justify',
];

export function isFrontmatterRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function cloneDefaultSettings(): DocumentSettings {
  return {
    font: { ...DEFAULT_SETTINGS.font },
    alignment: DEFAULT_SETTINGS.alignment,
    margins: { ...DEFAULT_SETTINGS.margins },
  };
}

function normalizeDocumentSettings(displayData: unknown): DocumentSettings {
  const source = isFrontmatterRecord(displayData) ? displayData : {};
  const font = isFrontmatterRecord(source.font) ? source.font : {};
  const margins = isFrontmatterRecord(source.margins) ? source.margins : {};

  const alignment = source.alignment;
  const validAlignment = ALIGNMENT_OPTIONS.includes(alignment as DocumentSettings['alignment'])
    ? alignment as DocumentSettings['alignment']
    : DEFAULT_SETTINGS.alignment;

  return {
    font: {
      family: typeof font.family === 'string' ? font.family : DEFAULT_SETTINGS.font.family,
      size: Number.isFinite(font.size) ? Number(font.size) : DEFAULT_SETTINGS.font.size,
    },
    alignment: validAlignment,
    margins: {
      top: Number.isFinite(margins.top) ? Number(margins.top) : DEFAULT_SETTINGS.margins.top,
      bottom: Number.isFinite(margins.bottom) ? Number(margins.bottom) : DEFAULT_SETTINGS.margins.bottom,
      left: Number.isFinite(margins.left) ? Number(margins.left) : DEFAULT_SETTINGS.margins.left,
      right: Number.isFinite(margins.right) ? Number(margins.right) : DEFAULT_SETTINGS.margins.right,
    },
  };
}

function cloneRawValue<T>(value: T): T {
  return cloneOfficeTableRawValue(value);
}

export function cloneOfficeTableRawValue<T>(value: T): T {
  const seen = new WeakMap<object, unknown>();
  const clone = (entry: unknown): unknown => {
    if (!entry || typeof entry !== 'object') return entry;
    if (seen.has(entry)) return seen.get(entry);
    if (entry instanceof Date) return new Date(entry.getTime());
    if (entry instanceof Uint8Array) {
      const Buffer = (globalThis as typeof globalThis & {
        Buffer?: {
          isBuffer: (candidate: unknown) => boolean;
          from: (candidate: Uint8Array) => Uint8Array;
        };
      }).Buffer;
      return Buffer?.isBuffer(entry) ? Buffer.from(entry) : new Uint8Array(entry);
    }
    if (Array.isArray(entry)) {
      const result = new Array(entry.length);
      seen.set(entry, result);
      Object.keys(entry).forEach((key) => {
        result[Number(key)] = clone(entry[Number(key)]);
      });
      return result;
    }
    const prototype = Object.getPrototypeOf(entry);
    if (prototype === Object.prototype || prototype === null) {
      const result = Object.create(prototype) as Record<string, unknown>;
      seen.set(entry, result);
      Object.keys(entry).forEach((key) => {
        Object.defineProperty(result, key, {
          value: clone((entry as Record<string, unknown>)[key]),
          enumerable: true,
          configurable: true,
          writable: true,
        });
      });
      return result;
    }
    return structuredClone(entry);
  };
  return clone(value) as T;
}

export function normalizeDocumentTableLayouts(value: unknown): unknown {
  return value === undefined ? [] : cloneRawValue(value);
}

export function getDocumentTableLayouts(frontmatter: DocumentFrontmatter): unknown {
  const metadata = isFrontmatterRecord(frontmatter.metadata)
    ? frontmatter.metadata
    : {};
  return normalizeDocumentTableLayouts(metadata.tables);
}

export function setDocumentTableLayouts(
  frontmatter: DocumentFrontmatter,
  layouts: unknown,
): DocumentFrontmatter {
  const metadata = isFrontmatterRecord(frontmatter.metadata)
    ? { ...frontmatter.metadata }
    : {};
  const raw = normalizeDocumentTableLayouts(layouts);
  const preserveExplicitEmpty = Array.isArray(raw)
    && raw.length === 0
    && Array.isArray(metadata.tables)
    && metadata.tables.length === 0;
  if (!Array.isArray(raw) || raw.length > 0 || preserveExplicitEmpty) {
    metadata.tables = raw;
  } else {
    delete metadata.tables;
  }
  return {
    ...frontmatter,
    metadata,
  };
}

// ── Table background colors (metadata.tableColors) ───────────────────────────
// Kept as a sibling of metadata.tables so column-width commits never touch it.
// Cascade: an explicit cell color always wins; otherwise the row/column with the
// highest `rank` wins (rank is a monotonic sequence counter on direct paints).
// A direct row or column paint prunes fully covered explicit cell rules in scope.
export interface DocumentTableColorRule {
  color: string;
  rank: number;
}

export interface DocumentTableColors {
  /** Raw identity fields. Consumers derive a safe identity without rewriting these values. */
  tableIndex?: unknown;
  fingerprint?: unknown;
  /** Raw dormant metadata. Consumers validate rules at render/commit time. */
  cells?: unknown; // "row,col" -> hex
  rows?: unknown; // rowIndex -> { color, rank }
  columns?: unknown; // colIndex -> { color, rank }
  [key: string]: unknown;
}

export interface DocumentTableStyle {
  /** Raw identity fields. Consumers derive a safe identity without rewriting these values. */
  tableIndex?: unknown;
  fingerprint?: unknown;
  /** Normalized in memory; invalid or missing stored values resolve to `overflow`. */
  tableOverflow: DocumentTableOverflow;
  /** Only literal true activates the title-row surrogate codec. */
  titleRow?: unknown;
  /** Raw SPEC-09 border width. Renderers normalize without rewriting on read. */
  borderWidth?: unknown;
  /** Raw SPEC-09 border color. Explicit null is distinct from missing/invalid. */
  borderColor?: unknown;
  /** Normalized in memory; invalid or missing stored values resolve to `left`. */
  tableAlignment: DocumentTableAlignment;
  [key: string]: unknown;
}

export const DOCUMENT_TABLE_OVERFLOW_MODES = [
  'overflow',
  'truncate',
  'newline',
] as const;

export type DocumentTableOverflow = typeof DOCUMENT_TABLE_OVERFLOW_MODES[number];

export const DEFAULT_DOCUMENT_TABLE_OVERFLOW: DocumentTableOverflow = 'overflow';

export const DOCUMENT_TABLE_ALIGNMENTS = [
  'left',
  'center',
  'right',
] as const;

export type DocumentTableAlignment = typeof DOCUMENT_TABLE_ALIGNMENTS[number];

export const DEFAULT_DOCUMENT_TABLE_ALIGNMENT: DocumentTableAlignment = 'left';

export const DOCUMENT_TABLE_BORDER_WIDTHS = [1, 2, 3, 4] as const;

export type DocumentTableBorderWidth = typeof DOCUMENT_TABLE_BORDER_WIDTHS[number];
export type DocumentTableBorderColor = `#${string}` | null | 'default';

export const DEFAULT_DOCUMENT_TABLE_BORDER_WIDTH: DocumentTableBorderWidth = 1;
export const DEFAULT_DOCUMENT_TABLE_BORDER_COLOR = 'rgba(28, 28, 28, 0.18)';

export function normalizeDocumentTableBorderWidth(value: unknown): DocumentTableBorderWidth {
  return DOCUMENT_TABLE_BORDER_WIDTHS.includes(value as DocumentTableBorderWidth)
    ? value as DocumentTableBorderWidth
    : DEFAULT_DOCUMENT_TABLE_BORDER_WIDTH;
}

export function normalizeDocumentTableBorderColor(value: unknown): DocumentTableBorderColor {
  if (value === null) return null;
  if (typeof value !== 'string' || !/^#[0-9a-f]{6}$/i.test(value)) return 'default';
  return value.toLowerCase() as `#${string}`;
}

export function normalizeDocumentTableOverflow(value: unknown): DocumentTableOverflow {
  return DOCUMENT_TABLE_OVERFLOW_MODES.includes(value as DocumentTableOverflow)
    ? value as DocumentTableOverflow
    : DEFAULT_DOCUMENT_TABLE_OVERFLOW;
}

export function normalizeDocumentTableAlignment(value: unknown): DocumentTableAlignment {
  return DOCUMENT_TABLE_ALIGNMENTS.includes(value as DocumentTableAlignment)
    ? value as DocumentTableAlignment
    : DEFAULT_DOCUMENT_TABLE_ALIGNMENT;
}

export function hasDocumentTableTitleRow(
  value: unknown,
): value is Record<string, unknown> & { titleRow: true } {
  return isFrontmatterRecord(value) && value.titleRow === true;
}

export function normalizeDocumentTableStyles(
  value: unknown,
): DocumentTableStyle[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) return [];
  return value.flatMap((rawEntry) => {
    if (!isFrontmatterRecord(rawEntry)) return [];
    const entry = cloneRawValue(rawEntry);
    return [{
      ...entry,
      tableOverflow: normalizeDocumentTableOverflow(entry.tableOverflow),
      tableAlignment: normalizeDocumentTableAlignment(entry.tableAlignment),
    }];
  });
}

export function normalizeDocumentTableColors(value: unknown): unknown {
  return value === undefined ? [] : cloneRawValue(value);
}

// Every unique hex color anywhere in the document's metadata — the colors it
// actually uses (they live under tableColors) plus any a power user parks in a
// `metadata.colors: [...]` array purely to pre-fill the picker (an easter egg).
export function scrapeMetadataHexColors(frontmatter: DocumentFrontmatter): string[] {
  const metadata = isFrontmatterRecord(frontmatter.metadata) ? frontmatter.metadata : {};
  const found = new Set<string>();
  const walk = (value: unknown) => {
    if (typeof value === 'string') {
      const hex = value.trim().toLowerCase();
      if (/^#[0-9a-f]{6}$/.test(hex)) found.add(hex);
    } else if (Array.isArray(value)) {
      value.forEach(walk);
    } else if (isFrontmatterRecord(value)) {
      Object.values(value).forEach(walk);
    }
  };
  walk(metadata);
  return Array.from(found);
}

export function getDocumentTableColors(frontmatter: DocumentFrontmatter): unknown {
  const metadata = isFrontmatterRecord(frontmatter.metadata) ? frontmatter.metadata : {};
  return normalizeDocumentTableColors(metadata.tableColors);
}

export function setDocumentTableColors(
  frontmatter: DocumentFrontmatter,
  colors: unknown,
): DocumentFrontmatter {
  const metadata = isFrontmatterRecord(frontmatter.metadata) ? { ...frontmatter.metadata } : {};
  const raw = normalizeDocumentTableColors(colors);
  const preserveExplicitEmpty = Array.isArray(raw)
    && raw.length === 0
    && Array.isArray(metadata.tableColors)
    && metadata.tableColors.length === 0;
  if (!Array.isArray(raw) || raw.length > 0 || preserveExplicitEmpty) {
    metadata.tableColors = raw;
  } else {
    delete metadata.tableColors;
  }
  return { ...frontmatter, metadata };
}

export function getDocumentTableStyles(
  frontmatter: DocumentFrontmatter,
): DocumentTableStyle[] | undefined {
  const metadata = isFrontmatterRecord(frontmatter.metadata) ? frontmatter.metadata : {};
  return normalizeDocumentTableStyles(metadata.tableStyles);
}

export function getRawDocumentTableStyles(
  frontmatter: DocumentFrontmatter,
): unknown {
  const metadata = isFrontmatterRecord(frontmatter.metadata) ? frontmatter.metadata : {};
  return cloneRawValue(metadata.tableStyles);
}

export function setDocumentTableStyles(
  frontmatter: DocumentFrontmatter,
  styles: unknown,
): DocumentFrontmatter {
  const metadata = isFrontmatterRecord(frontmatter.metadata) ? { ...frontmatter.metadata } : {};
  if (styles === undefined) delete metadata.tableStyles;
  else metadata.tableStyles = cloneRawValue(styles);
  return { ...frontmatter, metadata };
}

export type DocumentTableCollectionIdentity = {
  tableIndex: number;
  fingerprint: string;
};

function resolveTableCollectionEntryIndex(
  entry: Record<string, unknown>,
  rawIndex: number,
  liveTables: readonly DocumentTableCollectionIdentity[],
): number | null {
  const explicitIndex = typeof entry.tableIndex === 'number'
    && Number.isSafeInteger(entry.tableIndex)
    && entry.tableIndex >= 0
    ? entry.tableIndex
    : null;
  const explicitFingerprint = typeof entry.fingerprint === 'string'
    && entry.fingerprint.trim()
    ? entry.fingerprint.trim()
    : null;
  if (explicitIndex !== null && explicitFingerprint !== null) {
    const exact = liveTables.findIndex((identity) => (
      identity.tableIndex === explicitIndex && identity.fingerprint === explicitFingerprint
    ));
    if (exact >= 0) return exact;
  }
  if (explicitFingerprint !== null) {
    const matches = liveTables.flatMap((identity, index) => (
      identity.fingerprint === explicitFingerprint ? [index] : []
    ));
    if (matches.length === 1) return matches[0];
  }
  if (explicitIndex !== null && liveTables[explicitIndex]) return explicitIndex;
  return liveTables[rawIndex] ? rawIndex : null;
}

/**
 * Remove one table's entry from a raw table-scoped collection and refresh the
 * surviving entries against the verified next document. Unknown values and
 * fields remain opaque; only `{ tableIndex, fingerprint }` is rewritten.
 */
export function deleteAndReindexDocumentTableCollection(
  collection: unknown,
  removedTableIndex: number,
  beforeTables: readonly DocumentTableCollectionIdentity[],
  afterTables: readonly DocumentTableCollectionIdentity[],
): unknown {
  if (!Array.isArray(collection)) return cloneRawValue(collection);
  const next: unknown[] = [];
  for (let rawIndex = 0; rawIndex < collection.length; rawIndex += 1) {
    if (!Object.hasOwn(collection, rawIndex)) {
      next.length += 1;
      continue;
    }
    const rawEntry = collection[rawIndex];
    const matchedBeforeIndex = isFrontmatterRecord(rawEntry)
      ? resolveTableCollectionEntryIndex(rawEntry, rawIndex, beforeTables)
      : (beforeTables[rawIndex] ? rawIndex : null);
    if (matchedBeforeIndex === removedTableIndex) continue;
    if (matchedBeforeIndex === null || !isFrontmatterRecord(rawEntry)) {
      next.push(cloneRawValue(rawEntry));
      continue;
    }
    const nextIndex = matchedBeforeIndex < removedTableIndex
      ? matchedBeforeIndex
      : matchedBeforeIndex - 1;
    const nextIdentity = afterTables[nextIndex];
    if (!nextIdentity) {
      next.push(cloneRawValue(rawEntry));
      continue;
    }
    const refreshed = cloneRawValue(rawEntry);
    refreshed.tableIndex = nextIdentity.tableIndex;
    refreshed.fingerprint = nextIdentity.fingerprint;
    next.push(refreshed);
  }
  return next;
}

/**
 * Refresh a raw table-scoped collection after one verified whole-table
 * insertion. Existing entries at and after the insertion point move forward
 * with their owning tables. The new table receives no collection entry.
 */
export function insertAndReindexDocumentTableCollection(
  collection: unknown,
  insertedTableIndex: number,
  beforeTables: readonly DocumentTableCollectionIdentity[],
  afterTables: readonly DocumentTableCollectionIdentity[],
): unknown {
  if (!Array.isArray(collection)) return cloneRawValue(collection);
  const next: unknown[] = [];
  for (let rawIndex = 0; rawIndex < collection.length; rawIndex += 1) {
    if (!Object.hasOwn(collection, rawIndex)) {
      next.length += 1;
      continue;
    }
    const rawEntry = collection[rawIndex];
    const matchedBeforeIndex = isFrontmatterRecord(rawEntry)
      ? resolveTableCollectionEntryIndex(rawEntry, rawIndex, beforeTables)
      : (beforeTables[rawIndex] ? rawIndex : null);
    if (matchedBeforeIndex === null || !isFrontmatterRecord(rawEntry)) {
      next.push(cloneRawValue(rawEntry));
      continue;
    }
    const nextIndex = matchedBeforeIndex < insertedTableIndex
      ? matchedBeforeIndex
      : matchedBeforeIndex + 1;
    const nextIdentity = afterTables[nextIndex];
    if (!nextIdentity) {
      next.push(cloneRawValue(rawEntry));
      continue;
    }
    const refreshed = cloneRawValue(rawEntry);
    refreshed.tableIndex = nextIdentity.tableIndex;
    refreshed.fingerprint = nextIdentity.fingerprint;
    next.push(refreshed);
  }
  return next;
}

function orderDocumentFrontmatter(frontmatter: DocumentFrontmatter, settings: DocumentSettings) {
  const ordered: DocumentFrontmatter = {};
  const metadata = isFrontmatterRecord(frontmatter.metadata)
    ? { ...frontmatter.metadata }
    : {};
  metadata.display = settings;

  for (const key of ['name', 'description', 'metadata']) {
    if (key === 'metadata') {
      ordered.metadata = metadata;
    } else if (key in frontmatter) {
      ordered[key] = frontmatter[key];
    }
  }
  if (!('metadata' in ordered)) ordered.metadata = metadata;

  for (const [key, value] of Object.entries(frontmatter)) {
    if (key === 'name' || key === 'description' || key === 'metadata') continue;
    ordered[key] = value;
  }
  return ordered;
}

export function parseMarkdownFrontmatter(content: string): {
  body: string;
  frontmatter: DocumentFrontmatter;
} {
  try {
    const parsed = matter(content || '');
    return {
      body: parsed.content,
      frontmatter: isFrontmatterRecord(parsed.data) ? { ...parsed.data } : {},
    };
  } catch {
    return { body: content || '', frontmatter: {} };
  }
}

/**
 * Extract front-matter settings and body markdown from raw file content.
 * Falls back to defaults if parsing fails or no front matter exists.
 */
export function parseDocumentSettings(content: string): {
  body: string;
  settings: DocumentSettings;
  frontmatter: DocumentFrontmatter;
} {
  const parsed = parseMarkdownFrontmatter(content);
  const metadata = isFrontmatterRecord(parsed.frontmatter.metadata)
    ? parsed.frontmatter.metadata
    : {};
  return {
    ...parsed,
    settings: metadata.display === undefined
      ? cloneDefaultSettings()
      : normalizeDocumentSettings(metadata.display),
  };
}

/**
 * Re-assemble a full markdown file from body content and settings.
 */
function containsYamlSentinel(value: unknown, sentinel: string, seen = new WeakSet<object>()): boolean {
  if (typeof value === 'string') return value.includes(sentinel);
  if (!value || typeof value !== 'object' || seen.has(value)) return false;
  seen.add(value);
  return Object.keys(value).some((key) => (
    key.includes(sentinel)
    || containsYamlSentinel((value as Record<string, unknown>)[key], sentinel, seen)
  ));
}

function encodeYamlNoneScalars<T>(value: T, sentinel: string): T {
  const encoded = cloneOfficeTableRawValue(value);
  const seen = new WeakSet<object>();
  const encode = (entry: unknown): unknown => {
    if (entry === 'none') return sentinel;
    if (!entry || typeof entry !== 'object' || seen.has(entry)) return entry;
    seen.add(entry);
    if (Array.isArray(entry)) {
      Object.keys(entry).forEach((key) => {
        entry[Number(key)] = encode(entry[Number(key)]);
      });
    } else if (Object.getPrototypeOf(entry) === Object.prototype || Object.getPrototypeOf(entry) === null) {
      Object.keys(entry).forEach((key) => {
        (entry as Record<string, unknown>)[key] = encode((entry as Record<string, unknown>)[key]);
      });
    }
    return entry;
  };
  return encode(encoded) as T;
}

export function serializeDocumentSettings(
  body: string,
  settings: DocumentSettings,
  frontmatter: DocumentFrontmatter = {}
): string {
  const ordered = orderDocumentFrontmatter(frontmatter, settings);
  let sentinel = '__RV_YAML_STRING_NONE__';
  while (containsYamlSentinel(ordered, sentinel)) sentinel += '_';
  const serialized = matter.stringify(body.trim(), encodeYamlNoneScalars(ordered, sentinel));
  const closingDelimiter = serialized.indexOf('\n---\n', 4);
  if (closingDelimiter < 0) return serialized;

  const frontmatterEnd = closingDelimiter + '\n---\n'.length;
  const yamlEnvelope = serialized.slice(0, frontmatterEnd).replaceAll(sentinel, "'none'");
  return `${yamlEnvelope}${serialized.slice(frontmatterEnd)}`;
}

/**
 * Resolve a font-family key to a CSS font-family string.
 */
export function getFontCss(fontKey: string): string {
  return FONT_CSS_MAP[fontKey] || FONT_CSS_MAP.serif;
}
