'use strict';

const INVALID_TABLE_PRESENTATION = 'INVALID_TABLE_PRESENTATION';
const TABLE_PRESENTATION_MISMATCH = 'TABLE_PRESENTATION_MISMATCH';
const HASH_PATTERN = /^[0-9a-f]{64}$/;
const COLOR_PATTERN = /^#[0-9a-f]{6}$/;
const DESCRIPTOR_KEYS = ['markdownSha256', 'tables'];
const TABLE_KEYS = [
  'tableIndex', 'sourceSha256', 'logicalWidth', 'columns', 'overflow',
  'titleRow', 'borderWidth', 'borderColor',
];
const SURFACE_KEYS = Object.freeze({
  export: [
    'sourceType', 'sourceFormat', 'format', 'content', 'filename',
    'presentationMode', 'tablePresentation',
  ],
  print: ['content', 'filename', 'presentationMode', 'tablePresentation'],
  email: ['format', 'content', 'filename', 'presentationMode', 'tablePresentation'],
});

function presentationError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function failInvalid() {
  throw presentationError(INVALID_TABLE_PRESENTATION);
}

function failMismatch() {
  throw presentationError(TABLE_PRESENTATION_MISMATCH);
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function exactEnumerableKeys(value, expected) {
  if (!isRecord(value)) failInvalid();
  const keys = Object.keys(value);
  const allOwnKeys = Reflect.ownKeys(value);
  if (
    allOwnKeys.some((key) => typeof key === 'symbol')
    || allOwnKeys.length !== keys.length
    || keys.length !== expected.length
    || expected.some((key) => !Object.hasOwn(value, key))
    || keys.some((key) => !expected.includes(key))
  ) failInvalid();
}

function denseArray(value) {
  if (!Array.isArray(value)) failInvalid();
  for (let index = 0; index < value.length; index += 1) {
    if (!Object.hasOwn(value, index)) failInvalid();
  }
  const keys = Reflect.ownKeys(value);
  if (keys.some((key) => (
    typeof key === 'symbol'
    || (key !== 'length' && !/^(0|[1-9][0-9]*)$/.test(key))
  ))) failInvalid();
}

function deepFreeze(value, seen = new WeakSet()) {
  if (value === null || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  Reflect.ownKeys(value).forEach((key) => deepFreeze(value[key], seen));
  return Object.freeze(value);
}

function hasOfficePresentationFields(payload) {
  if (
    payload === null
    || (typeof payload !== 'object' && typeof payload !== 'function')
  ) return false;
  return Object.hasOwn(payload, 'presentationMode') || Object.hasOwn(payload, 'tablePresentation');
}

let sourceBindingModulePromise;
function getSourceBindingModule() {
  sourceBindingModulePromise ??= import('./office-table-source-binding.mjs');
  return sourceBindingModulePromise;
}

const STRUCTURAL_DIGEST_PLACEHOLDER = '0'.repeat(64);
async function structuralDigestPlaceholder() {
  return STRUCTURAL_DIGEST_PLACEHOLDER;
}

async function bindSourcesForValidation(bodyMarkdown, sourceFailure, sha256Hex) {
  const { bindOfficeTableSources } = await getSourceBindingModule();
  try {
    return await bindOfficeTableSources(
      bodyMarkdown,
      sha256Hex,
    );
  } catch {
    if (sourceFailure === TABLE_PRESENTATION_MISMATCH) failMismatch();
    failInvalid();
  }
}

async function validateDescriptorShapeWithSources(bodyMarkdown, descriptor, sourceFailure, sha256Hex) {
  if (typeof bodyMarkdown !== 'string') failInvalid();
  exactEnumerableKeys(descriptor, DESCRIPTOR_KEYS);
  if (typeof descriptor.markdownSha256 !== 'string' || !HASH_PATTERN.test(descriptor.markdownSha256)) {
    failInvalid();
  }
  denseArray(descriptor.tables);
  const sourceTables = await bindSourcesForValidation(bodyMarkdown, sourceFailure, sha256Hex);
  if (
    sourceFailure === INVALID_TABLE_PRESENTATION
    && descriptor.tables.length !== sourceTables.tables.length
  ) failInvalid();
  const totalLogicalColumns = sourceTables.tables.reduce(
    (total, source) => total + source.logicalWidth,
    0,
  );
  const { getOfficeDescriptorByteLimit } = await getSourceBindingModule();
  const encoder = new TextEncoder();
  const bodyBytes = encoder.encode(bodyMarkdown).byteLength;
  const descriptorBytes = encoder.encode(JSON.stringify(descriptor)).byteLength;
  if (descriptorBytes > getOfficeDescriptorByteLimit(
    bodyBytes,
    sourceTables.tables.length,
    totalLogicalColumns,
  )) failInvalid();
  descriptor.tables.forEach((entry, index) => {
    exactEnumerableKeys(entry, TABLE_KEYS);
    if (!Number.isSafeInteger(entry.tableIndex)) failInvalid();
    if (sourceFailure === INVALID_TABLE_PRESENTATION && entry.tableIndex !== index) failInvalid();
    if (typeof entry.sourceSha256 !== 'string' || !HASH_PATTERN.test(entry.sourceSha256)) failInvalid();
    if (!Number.isSafeInteger(entry.logicalWidth) || entry.logicalWidth < 1) failInvalid();
    if (
      sourceFailure === INVALID_TABLE_PRESENTATION
      && entry.logicalWidth !== sourceTables.tables[index].logicalWidth
    ) failInvalid();
    if (entry.columns !== null) {
      denseArray(entry.columns);
      if (!entry.columns.every((column) => Number.isSafeInteger(column) && column > 0)) failInvalid();
      if (
        sourceFailure === INVALID_TABLE_PRESENTATION
        && entry.columns.length !== entry.logicalWidth
      ) failInvalid();
    }
    if (!['overflow', 'truncate', 'newline'].includes(entry.overflow)) failInvalid();
    if (typeof entry.titleRow !== 'boolean') failInvalid();
    if (![1, 2, 3, 4].includes(entry.borderWidth)) failInvalid();
    if (
      entry.borderColor !== null
      && entry.borderColor !== 'default'
      && (typeof entry.borderColor !== 'string' || !COLOR_PATTERN.test(entry.borderColor))
    ) failInvalid();
  });
  return {
    descriptor: structuredClone(descriptor),
    sourceTables,
  };
}

async function validateDescriptorShape(bodyMarkdown, descriptor) {
  const validated = await validateDescriptorShapeWithSources(
    bodyMarkdown,
    descriptor,
    INVALID_TABLE_PRESENTATION,
    structuralDigestPlaceholder,
  );
  return validated.descriptor;
}

async function canonicalizeOfficePayloadWithSources(payload, surface, sourceFailure, sha256Hex) {
  if (!SURFACE_KEYS[surface]) failInvalid();
  const canOwnFields = payload !== null
    && (typeof payload === 'object' || typeof payload === 'function');
  const hasMode = canOwnFields && Object.hasOwn(payload, 'presentationMode');
  const hasDescriptor = canOwnFields && Object.hasOwn(payload, 'tablePresentation');
  if (!hasMode && !hasDescriptor) return null;
  if (!hasMode || !hasDescriptor) failInvalid();
  exactEnumerableKeys(payload, SURFACE_KEYS[surface]);
  if (
    payload.presentationMode !== 'office-tables'
    || typeof payload.content !== 'string'
    || typeof payload.filename !== 'string'
  ) failInvalid();
  if (surface === 'export' && (
    payload.sourceType !== 'document'
    || payload.sourceFormat !== 'markdown'
    || !['docx', 'pdf'].includes(payload.format)
  )) failInvalid();
  if (surface === 'email' && !['docx', 'pdf'].includes(payload.format)) failInvalid();
  const validated = await validateDescriptorShapeWithSources(
    payload.content,
    payload.tablePresentation,
    sourceFailure,
    sha256Hex,
  );
  const copy = { ...payload };
  copy.tablePresentation = validated.descriptor;
  return {
    payload: deepFreeze(copy),
    sourceTables: validated.sourceTables,
  };
}

async function canonicalizeOfficePayload(payload, surface) {
  const validated = await canonicalizeOfficePayloadWithSources(
    payload,
    surface,
    INVALID_TABLE_PRESENTATION,
    structuralDigestPlaceholder,
  );
  if (validated === null) return null;
  return validated.payload;
}

async function validateAndBindOfficePayload(payload, surface, sha256Hex) {
  if (typeof sha256Hex !== 'function') failInvalid();
  const validated = await canonicalizeOfficePayloadWithSources(
    payload,
    surface,
    TABLE_PRESENTATION_MISMATCH,
    sha256Hex,
  );
  if (validated === null) return { mode: 'legacy', payload };
  const { payload: canonicalPayload, sourceTables } = validated;
  const descriptor = canonicalPayload.tablePresentation;
  if (
    descriptor.markdownSha256 !== sourceTables.markdownSha256
    || descriptor.tables.length !== sourceTables.tables.length
  ) failMismatch();
  descriptor.tables.forEach((entry, index) => {
    const source = sourceTables.tables[index];
    if (
      entry.tableIndex !== index
      || entry.sourceSha256 !== source.sourceSha256
      || entry.logicalWidth !== source.logicalWidth
      || (entry.columns !== null && entry.columns.length !== source.logicalWidth)
      || (
        entry.titleRow
        && (
          source.semanticRows.length < 3
          || !source.cellChildCounts[0]?.slice(1).every((count) => count === 0)
        )
      )
    ) failMismatch();
  });
  const immutableSourceTables = deepFreeze(sourceTables.tables);
  const prepared = deepFreeze({
    bodyMarkdown: canonicalPayload.content,
    tablePresentation: descriptor,
    sourceTables: immutableSourceTables,
  });
  return Object.freeze({
    mode: 'office-tables',
    payload: canonicalPayload,
    prepared,
  });
}

module.exports = {
  INVALID_TABLE_PRESENTATION,
  TABLE_PRESENTATION_MISMATCH,
  canonicalizeOfficePayload,
  hasOfficePresentationFields,
  presentationError,
  validateAndBindOfficePayload,
  validateDescriptorShape,
};
