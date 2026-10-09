import { getOfficeDescriptorByteLimit } from '../../electron/shared/office-table-source-binding.mjs';
import type { OfficeTableOutputDescriptor } from '../components/office/officeTableOutputDescriptor';

export const INVALID_TABLE_PRESENTATION = 'INVALID_TABLE_PRESENTATION';

export type LegacyExportDocumentPayload = {
  sourceType: 'document' | 'html-artifact' | 'spreadsheet';
  sourceFormat: 'markdown' | 'html' | 'csv';
  format: 'docx' | 'pdf';
  content: string;
  filename: string;
};

export type LegacyPrintDocumentPayload = { content: string; filename: string };
export type LegacyEmailDocumentPayload = {
  format: 'docx' | 'pdf' | 'markdown';
  content: string;
  filename: string;
};

export type OfficePresentationMode = {
  presentationMode: 'office-tables';
  tablePresentation: OfficeTableOutputDescriptor;
};

export type OfficeExportDocumentPayload = {
  sourceType: 'document';
  sourceFormat: 'markdown';
  format: 'docx' | 'pdf';
  content: string;
  filename: string;
} & OfficePresentationMode;

export type OfficePrintDocumentPayload = LegacyPrintDocumentPayload & OfficePresentationMode;
export type OfficeEmailAttachmentPayload = {
  format: 'docx' | 'pdf';
  content: string;
  filename: string;
} & OfficePresentationMode;

function invalid(): never {
  throw new Error(INVALID_TABLE_PRESENTATION);
}

function assertExactOwnKeys(value: object, expected: readonly string[]): void {
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const ownKeys = Reflect.ownKeys(descriptors);
  if (ownKeys.some((key) => typeof key === 'symbol')) invalid();
  const keys = ownKeys as string[];
  if (
    keys.length !== expected.length
    || expected.some((key) => !Object.hasOwn(descriptors, key))
    || keys.some((key) => !expected.includes(key))
  ) invalid();
  for (const descriptor of Object.values(descriptors)) {
    if (!descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) invalid();
  }
}

function assertStrictJsonData(value: unknown, seen = new WeakSet<object>()): void {
  if (
    value === null
    || typeof value === 'string'
    || typeof value === 'boolean'
  ) return;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) invalid();
    return;
  }
  if (typeof value !== 'object' || seen.has(value)) invalid();
  seen.add(value);
  if (Array.isArray(value)) {
    if (Object.getPrototypeOf(value) !== Array.prototype) invalid();
    for (const key in value) {
      if (!Object.hasOwn(value, key)) invalid();
    }
    const keys = Reflect.ownKeys(value);
    if (keys.some((key) => typeof key === 'symbol')) invalid();
    const stringKeys = keys as string[];
    if (stringKeys.some((key) => key !== 'length' && !/^(0|[1-9][0-9]*)$/.test(key))) invalid();
    for (let index = 0; index < value.length; index += 1) {
      if (!Object.hasOwn(value, index)) invalid();
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) invalid();
      assertStrictJsonData(descriptor.value, seen);
    }
    return;
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) invalid();
  for (const key in value) {
    if (!Object.hasOwn(value, key)) invalid();
  }
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key === 'symbol') invalid();
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) invalid();
    assertStrictJsonData(descriptor.value, seen);
  }
}

const HASH_PATTERN = /^[0-9a-f]{64}$/;
const COLOR_PATTERN = /^#[0-9a-f]{6}$/;
const DESCRIPTOR_KEYS = ['markdownSha256', 'tables'] as const;
const TABLE_KEYS = [
  'tableIndex',
  'sourceSha256',
  'logicalWidth',
  'columns',
  'overflow',
  'titleRow',
  'borderWidth',
  'borderColor',
] as const;

export function validateOfficeTablePresentationSource(
  bodyMarkdown: string,
  descriptor: OfficeTableOutputDescriptor,
): OfficeTableOutputDescriptor {
  assertStrictJsonData(descriptor);
  if (!descriptor || typeof descriptor !== 'object' || Array.isArray(descriptor)) invalid();
  assertExactOwnKeys(descriptor, DESCRIPTOR_KEYS);
  if (
    typeof descriptor.markdownSha256 !== 'string'
    || !HASH_PATTERN.test(descriptor.markdownSha256)
    || !Array.isArray(descriptor.tables)
  ) invalid();
  let totalLogicalColumns = 0;
  descriptor.tables.forEach((entry, index) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) invalid();
    assertExactOwnKeys(entry, TABLE_KEYS);
    if (entry.tableIndex !== index) invalid();
    if (typeof entry.sourceSha256 !== 'string' || !HASH_PATTERN.test(entry.sourceSha256)) invalid();
    if (!Number.isSafeInteger(entry.logicalWidth) || entry.logicalWidth < 1) invalid();
    if (totalLogicalColumns > Number.MAX_SAFE_INTEGER - entry.logicalWidth) invalid();
    totalLogicalColumns += entry.logicalWidth;
    if (entry.columns !== null) {
      if (!Array.isArray(entry.columns) || entry.columns.length !== entry.logicalWidth) invalid();
      if (!entry.columns.every((column) => Number.isSafeInteger(column) && column > 0)) invalid();
    }
    if (!['overflow', 'truncate', 'newline'].includes(entry.overflow)) invalid();
    if (typeof entry.titleRow !== 'boolean') invalid();
    if (![1, 2, 3, 4].includes(entry.borderWidth)) invalid();
    if (
      entry.borderColor !== null
      && entry.borderColor !== 'default'
      && (typeof entry.borderColor !== 'string' || !COLOR_PATTERN.test(entry.borderColor))
    ) invalid();
  });
  const bodyBytes = new TextEncoder().encode(bodyMarkdown).byteLength;
  const descriptorBytes = new TextEncoder().encode(JSON.stringify(descriptor)).byteLength;
  if (descriptorBytes > getOfficeDescriptorByteLimit(
    bodyBytes,
    descriptor.tables.length,
    totalLogicalColumns,
  )) invalid();
  return structuredClone(descriptor);
}

function canonicalOfficePayload<T extends OfficePresentationMode & { content: string }>(
  input: T,
  expectedKeys: readonly string[],
): T {
  try {
    assertStrictJsonData(input);
    if (!input || typeof input !== 'object' || Array.isArray(input)) invalid();
    assertExactOwnKeys(input, expectedKeys);
    if (input.presentationMode !== 'office-tables' || typeof input.content !== 'string') invalid();
    validateOfficeTablePresentationSource(input.content, input.tablePresentation);
    return structuredClone(input);
  } catch {
    // Reflective Proxy traps and structured-clone failures are untrusted input
    // failures at this renderer-owned construction boundary.
    invalid();
  }
}

export function buildLegacyExportDocumentPayload(
  input: LegacyExportDocumentPayload,
): LegacyExportDocumentPayload {
  return {
    sourceType: input.sourceType,
    sourceFormat: input.sourceFormat,
    format: input.format,
    content: input.content,
    filename: input.filename,
  };
}

export function buildLegacyPrintDocumentPayload(
  input: LegacyPrintDocumentPayload,
): LegacyPrintDocumentPayload {
  return { content: input.content, filename: input.filename };
}

export function buildLegacyEmailDocumentPayload(
  input: LegacyEmailDocumentPayload,
): LegacyEmailDocumentPayload {
  return { format: input.format, content: input.content, filename: input.filename };
}

export function buildOfficeExportDocumentPayload(
  input: OfficeExportDocumentPayload,
): OfficeExportDocumentPayload {
  const canonical = canonicalOfficePayload(input, [
    'sourceType', 'sourceFormat', 'format', 'content', 'filename',
    'presentationMode', 'tablePresentation',
  ]);
  if (
    canonical.sourceType !== 'document'
    || canonical.sourceFormat !== 'markdown'
    || !['docx', 'pdf'].includes(canonical.format)
    || typeof canonical.filename !== 'string'
  ) invalid();
  return canonical;
}

export function buildOfficePrintDocumentPayload(
  input: OfficePrintDocumentPayload,
): OfficePrintDocumentPayload {
  const canonical = canonicalOfficePayload(input, [
    'content', 'filename', 'presentationMode', 'tablePresentation',
  ]);
  if (typeof canonical.filename !== 'string') invalid();
  return canonical;
}

export function buildOfficeEmailAttachmentPayload(
  input: OfficeEmailAttachmentPayload,
): OfficeEmailAttachmentPayload {
  const canonical = canonicalOfficePayload(input, [
    'format', 'content', 'filename', 'presentationMode', 'tablePresentation',
  ]);
  if (!['docx', 'pdf'].includes(canonical.format) || typeof canonical.filename !== 'string') invalid();
  return canonical;
}
