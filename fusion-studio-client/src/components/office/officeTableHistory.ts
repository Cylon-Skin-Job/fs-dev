/**
 * @module officeTableHistory
 * @role Invertible ProseMirror bridge for renderer-owned table metadata.
 */
import { $prose } from '@milkdown/kit/utils';
import type { Node as ProseNode, Schema } from '@milkdown/kit/prose/model';
import { Plugin, PluginKey, type Transaction } from '@milkdown/kit/prose/state';
import { closeHistory } from '@milkdown/kit/prose/history';
import { Step, StepResult } from '@milkdown/kit/prose/transform';
import { cloneOfficeTableRawValue } from '../../lib/front-matter';
import type { DocumentSettings } from '../../lib/front-matter';
export type OfficeTableMetadataSnapshot = {
  /** Exact raw frontmatter collections, including malformed scalars and opaque array entries. */
  tables: unknown;
  tableColors: unknown;
  /** Present only when the source frontmatter contains metadata.tableStyles. */
  tableStyles?: unknown;
  /** Present in the Office runtime so page alignment can share this history unit. */
  pageAlignment?: DocumentSettings['alignment'];
};

export type OfficeTableMetadataOperationToken = number;

type OfficeTableMetadataTestEvent = 'quarantine-preflight' | 'step' | 'plugin-publish' | 'external-publish';

export function notifyOfficeTableMetadataTestHook(event: OfficeTableMetadataTestEvent): void {
  const hook = (globalThis as typeof globalThis & {
    __officeTableMetadataTestHook?: (event: OfficeTableMetadataTestEvent) => void;
  }).__officeTableMetadataTestHook;
  if (typeof hook === 'function') {
    try { hook(event); } catch { /* Test observation must not affect editor behavior. */ }
  }
}

type DeferredMarkdownPublicationState =
  | { token: OfficeTableMetadataOperationToken; phase: 'dispatch' }
  | { token: OfficeTableMetadataOperationToken; phase: 'settled'; document?: ProseNode };

/**
 * Handshake between a deferred metadata dispatch and Milkdown's Markdown
 * listener. A settled token is document-bound: delayed publications for that
 * dispatch remain suppressed, while the first unrelated document clears it.
 */
export function createOfficeDeferredMarkdownPublicationState() {
  let state: DeferredMarkdownPublicationState | null = null;
  let highestGeneration = 0;
  return {
    prepare(token: OfficeTableMetadataOperationToken) {
      if (!Number.isSafeInteger(token) || token <= highestGeneration) return false;
      highestGeneration = token;
      state = { token, phase: 'dispatch' };
      return true;
    },
    finalize(token: OfficeTableMetadataOperationToken, document?: ProseNode) {
      if (!Number.isSafeInteger(token) || token < highestGeneration
        || (token === highestGeneration && (!state || state.token !== token || state.phase === 'settled'))) {
        return false;
      }
      highestGeneration = token;
      state = { token, phase: 'settled', document };
      return true;
    },
    cancel(token: OfficeTableMetadataOperationToken, document?: ProseNode) {
      if (!Number.isSafeInteger(token) || token < highestGeneration
        || (token === highestGeneration && (!state || state.token !== token || state.phase === 'settled'))) {
        return false;
      }
      highestGeneration = token;
      state = { token, phase: 'settled', document };
      return true;
    },
    isCurrent(token: OfficeTableMetadataOperationToken): boolean {
      return state?.token === token;
    },
    suppressMarkdown(document: ProseNode): boolean {
      if (state?.phase === 'dispatch') return true;
      if (state?.phase === 'settled') {
        if (state.document?.eq(document)) return true;
        state = null;
      }
      return false;
    },
  };
}

type OfficeDeferredMarkdownPublication = ReturnType<typeof createOfficeDeferredMarkdownPublicationState>;

export function publishOfficeTableMetadataCombinedCallbacks({
  publication,
  snapshot,
  before,
  document,
  token,
  publishTables,
  publishTableColors,
  publishTableStyles,
  publishPageAlignment,
  markDirtyAndScheduleSave,
  report = (error: unknown) => console.error('[OfficeTable] metadata callback failed', error),
}: {
  publication: OfficeDeferredMarkdownPublication;
  snapshot: OfficeTableMetadataSnapshot;
  before: OfficeTableMetadataSnapshot;
  document?: ProseNode;
  token: OfficeTableMetadataOperationToken;
  publishTables: (tables: unknown) => void;
  publishTableColors: (colors: unknown) => void;
  publishTableStyles?: (styles: unknown) => void;
  publishPageAlignment?: (alignment: DocumentSettings['alignment']) => void;
  markDirtyAndScheduleSave: () => void;
  report?: (error: unknown) => void;
}): boolean {
  if (!publication.finalize(token, document)) return false;
  notifyOfficeTableMetadataTestHook('external-publish');
  const isCurrent = () => publication.isCurrent(token);
  const reportErrors = (errors: unknown[]) => errors.forEach((error) => {
    try {
      report(error);
    } catch {
      // Reporting must never escape back into ProseMirror plugin application.
    }
  });
  let attemptedTables = false;
  let attemptedTableColors = false;
  let attemptedTableStyles = false;
  let attemptedPageAlignment = false;
  const rollbackExternalDomains = () => {
    const rollbackErrors: unknown[] = [];
    if (attemptedPageAlignment && isCurrent() && before.pageAlignment) {
      try {
        publishPageAlignment?.(before.pageAlignment);
      } catch (error) {
        rollbackErrors.push(error);
      }
    }
    if (attemptedTableStyles && isCurrent() && Object.hasOwn(before, 'tableStyles')) {
      try {
        publishTableStyles?.(cloneValue(before.tableStyles));
      } catch (error) {
        rollbackErrors.push(error);
      }
    }
    if (attemptedTableColors && isCurrent()) {
      try {
        publishTableColors(cloneValue(before.tableColors));
      } catch (error) {
        rollbackErrors.push(error);
      }
    }
    if (attemptedTables && isCurrent()) {
      try {
        publishTables(cloneValue(before.tables));
      } catch (error) {
        rollbackErrors.push(error);
      }
    }
    reportErrors(rollbackErrors);
  };
  const callbackErrors: unknown[] = [];
  if (!isCurrent()) return false;
  if (Array.isArray(snapshot.tables)) {
    attemptedTables = true;
    try {
      publishTables(cloneValue(snapshot.tables));
    } catch (error) {
      callbackErrors.push(error);
    }
  }
  if (!isCurrent()) {
    reportErrors(callbackErrors);
    return false;
  }
  if (Array.isArray(snapshot.tableColors)) {
    attemptedTableColors = true;
    try {
      publishTableColors(cloneValue(snapshot.tableColors));
    } catch (error) {
      callbackErrors.push(error);
    }
  }
  if (!isCurrent()) {
    reportErrors(callbackErrors);
    return false;
  }
  if (Object.hasOwn(snapshot, 'tableStyles')) {
    attemptedTableStyles = true;
    try {
      if (!publishTableStyles) throw new Error('metadata.tableStyles publication binding is missing');
      publishTableStyles(cloneValue(snapshot.tableStyles));
    } catch (error) {
      callbackErrors.push(error);
    }
  }
  if (!isCurrent()) {
    reportErrors(callbackErrors);
    return false;
  }
  if (snapshot.pageAlignment && snapshot.pageAlignment !== before.pageAlignment) {
    attemptedPageAlignment = true;
    try {
      if (!publishPageAlignment) throw new Error('page-alignment publication binding is missing');
      publishPageAlignment(snapshot.pageAlignment);
    } catch (error) {
      callbackErrors.push(error);
    }
  }
  if (!isCurrent()) {
    reportErrors(callbackErrors);
    return false;
  }
  if (callbackErrors.length > 0) {
    reportErrors(callbackErrors);
    rollbackExternalDomains();
    return false;
  }
  try {
    markDirtyAndScheduleSave();
  } catch (error) {
    reportErrors([error]);
    if (isCurrent()) rollbackExternalDomains();
    return false;
  }
  return isCurrent();
}

type OfficeDirtySaveSchedulerOptions = {
  filePath: string;
  setIsDirty: (dirty: boolean) => void;
  setDirty: (panel: string, path: string, dirty: boolean) => void;
  getSessionStart: () => number | null;
  setSessionStart: (startedAt: number) => void;
  getTimer: () => ReturnType<typeof setTimeout> | null;
  setTimer: (timer: ReturnType<typeof setTimeout>) => void;
  checkpointDue: () => boolean;
  save: (reason: 'checkpoint' | 'autosave') => void;
  now?: () => number;
  schedule?: (callback: () => void, delay: number) => ReturnType<typeof setTimeout>;
  cancel?: (timer: ReturnType<typeof setTimeout>) => void;
};

/** The production dirty/autosave path shared by text and metadata publications. */
export function createOfficeDirtySaveScheduler({
  filePath,
  setIsDirty,
  setDirty,
  getSessionStart,
  setSessionStart,
  getTimer,
  setTimer,
  checkpointDue,
  save,
  now = Date.now,
  schedule = setTimeout,
  cancel = clearTimeout,
}: OfficeDirtySaveSchedulerOptions) {
  return () => {
    setIsDirty(true);
    setDirty('office-viewer', filePath, true);
    if (getSessionStart() === null) setSessionStart(now());
    const activeTimer = getTimer();
    if (activeTimer !== null) cancel(activeTimer);
    setTimer(schedule(() => save(checkpointDue() ? 'checkpoint' : 'autosave'), 500));
  };
}

type MetadataBindings = {
  readTables?: () => unknown;
  publishTables?: (tables: unknown) => void;
  renderTables?: () => void;
  readTableColors?: () => unknown;
  publishTableColors?: (colors: unknown) => void;
  renderTableColors?: () => void;
  readTableStyles?: () => unknown;
  publishTableStyles?: (styles: unknown) => void;
  renderTableStyles?: () => void;
  readPageAlignment?: () => DocumentSettings['alignment'];
  publishPageAlignment?: (alignment: DocumentSettings['alignment']) => void;
  publishSnapshot?: (
    snapshot: OfficeTableMetadataSnapshot,
    before: OfficeTableMetadataSnapshot,
    document: ProseNode | undefined,
    token: OfficeTableMetadataOperationToken,
  ) => boolean;
  prepareDeferredSnapshot?: (token: OfficeTableMetadataOperationToken, document?: ProseNode) => boolean;
  cancelDeferredSnapshot?: (token: OfficeTableMetadataOperationToken, document?: ProseNode) => boolean;
  isCurrentSnapshot?: (token: OfficeTableMetadataOperationToken) => boolean;
};

const bindingsByRoot = new WeakMap<HTMLElement, MetadataBindings>();
const metadataPluginKey = new PluginKey<OfficeTableMetadataSnapshot | null>('officeTableMetadata');
const historyBoundaryMeta = 'officeTableMetadataHistoryBoundary';
const deferExternalPublicationMeta = 'officeTableMetadataDeferExternalPublication';
const metadataOperationTokenMeta = 'officeTableMetadataOperationToken';
let metadataOperationGeneration = 0;

type MetadataPublicationRollback = {
  token: OfficeTableMetadataOperationToken;
  beforeTables: unknown;
  beforeTableColors: unknown;
  beforeTableStyles?: unknown;
  beforePageAlignment?: DocumentSettings['alignment'];
  attemptedTables: boolean;
  attemptedTableColors: boolean;
  attemptedTableStyles: boolean;
  attemptedPageAlignment: boolean;
};

const deferredRollbackByRoot = new WeakMap<HTMLElement, MetadataPublicationRollback>();

function getDeferredRollback(
  root: HTMLElement,
  token: OfficeTableMetadataOperationToken,
): MetadataPublicationRollback | undefined {
  const rollback = deferredRollbackByRoot.get(root);
  return rollback?.token === token ? rollback : undefined;
}

function deleteDeferredRollback(
  root: HTMLElement,
  token: OfficeTableMetadataOperationToken,
): boolean {
  if (!getDeferredRollback(root, token)) return false;
  return deferredRollbackByRoot.delete(root);
}

function allocateOfficeTableMetadataOperationToken(): OfficeTableMetadataOperationToken {
  metadataOperationGeneration += 1;
  return metadataOperationGeneration;
}

function reportPublicationError(label: string, error: unknown) {
  console.error(`[OfficeTable] ${label}`, error);
}

export class OfficeTableMetadataPublicationError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(`BLOCKED: ${message}`, options);
    this.name = 'OfficeTableMetadataPublicationError';
  }
}

function cloneValue<T>(value: T): T {
  return cloneOfficeTableRawValue(value);
}

type EncodedRawValue =
  | ['undefined']
  | ['null']
  | ['boolean', boolean]
  | ['string', string]
  | ['number', number | 'nan' | 'positive-infinity' | 'negative-infinity' | 'negative-zero']
  | ['date', EncodedRawValue]
  | ['bytes', 'buffer' | 'uint8array', number[]]
  | ['array', number, Array<[number, EncodedRawValue]>]
  | ['object', 'plain' | 'null', Array<[string, EncodedRawValue]>];

const metadataStepEncoding = 'office-table-metadata/raw-v1';

function codecError(message: string): TypeError {
  return new TypeError(`Unsupported office table metadata snapshot: ${message}`);
}

function bufferConstructor(): {
  isBuffer: (value: unknown) => boolean;
  from: (values: number[]) => Uint8Array;
} | undefined {
  return (globalThis as typeof globalThis & {
    Buffer?: {
      isBuffer: (value: unknown) => boolean;
      from: (values: number[]) => Uint8Array;
    };
  }).Buffer;
}

function encodeRawValue(value: unknown, active = new WeakSet<object>()): EncodedRawValue {
  if (value === undefined) return ['undefined'];
  if (value === null) return ['null'];
  if (typeof value === 'boolean') return ['boolean', value];
  if (typeof value === 'string') return ['string', value];
  if (typeof value === 'number') {
    if (Number.isNaN(value)) return ['number', 'nan'];
    if (value === Number.POSITIVE_INFINITY) return ['number', 'positive-infinity'];
    if (value === Number.NEGATIVE_INFINITY) return ['number', 'negative-infinity'];
    if (Object.is(value, -0)) return ['number', 'negative-zero'];
    return ['number', value];
  }
  if (typeof value !== 'object') throw codecError(`value of type ${typeof value}`);
  if (active.has(value)) throw codecError('cyclic value');
  active.add(value);
  try {
    if (value instanceof Date) {
      if (Reflect.ownKeys(value).length > 0) throw codecError('Date with custom properties');
      return ['date', encodeRawValue(value.getTime(), active)];
    }
    const Buffer = bufferConstructor();
    if (value instanceof Uint8Array) {
      for (const key of Reflect.ownKeys(value)) {
        if (typeof key !== 'string' || !Number.isSafeInteger(Number(key))
          || Number(key) < 0 || Number(key) >= value.length || String(Number(key)) !== key) {
          throw codecError('binary value with custom properties');
        }
      }
      return ['bytes', Buffer?.isBuffer(value) ? 'buffer' : 'uint8array', Array.from(value)];
    }
    if (Array.isArray(value)) {
      const entries: Array<[number, EncodedRawValue]> = [];
      const ownKeys = Reflect.ownKeys(value);
      for (const ownKey of ownKeys) {
        if (ownKey === 'length') continue;
        if (typeof ownKey !== 'string') throw codecError('symbol-keyed array property');
        const key = ownKey;
        const index = Number(key);
        if (!Number.isSafeInteger(index) || index < 0 || index >= value.length || String(index) !== key) {
          throw codecError(`non-index array property ${JSON.stringify(key)}`);
        }
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) {
          throw codecError(`non-enumerable or accessor array property ${JSON.stringify(key)}`);
        }
        entries.push([index, encodeRawValue(descriptor.value, active)]);
      }
      return ['array', value.length, entries];
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw codecError(`object with prototype ${prototype?.constructor?.name ?? 'null'}`);
    }
    const entries: Array<[string, EncodedRawValue]> = [];
    for (const ownKey of Reflect.ownKeys(value)) {
      if (typeof ownKey !== 'string') throw codecError('symbol-keyed object property');
      const key = ownKey;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) {
        throw codecError(`non-enumerable or accessor object property ${JSON.stringify(key)}`);
      }
      entries.push([key, encodeRawValue(descriptor.value, active)]);
    }
    return ['object', prototype === null ? 'null' : 'plain', entries];
  } finally {
    active.delete(value);
  }
}

function encodedTuple(value: unknown, tag: EncodedRawValue[0], length: number): unknown[] {
  if (!Array.isArray(value) || value.length !== length || value[0] !== tag) {
    throw codecError(`invalid encoded ${tag} value`);
  }
  return value;
}

function decodeRawValue(value: unknown): unknown {
  if (!Array.isArray(value) || typeof value[0] !== 'string') throw codecError('invalid encoded value');
  switch (value[0]) {
    case 'undefined':
      encodedTuple(value, 'undefined', 1);
      return undefined;
    case 'null':
      encodedTuple(value, 'null', 1);
      return null;
    case 'boolean': {
      const tuple = encodedTuple(value, 'boolean', 2);
      if (typeof tuple[1] !== 'boolean') throw codecError('invalid encoded boolean value');
      return tuple[1];
    }
    case 'string': {
      const tuple = encodedTuple(value, 'string', 2);
      if (typeof tuple[1] !== 'string') throw codecError('invalid encoded string value');
      return tuple[1];
    }
    case 'number': {
      const tuple = encodedTuple(value, 'number', 2);
      if (typeof tuple[1] === 'number') {
        if (!Number.isFinite(tuple[1]) || Object.is(tuple[1], -0)) throw codecError('invalid encoded finite number');
        return tuple[1];
      }
      if (tuple[1] === 'nan') return Number.NaN;
      if (tuple[1] === 'positive-infinity') return Number.POSITIVE_INFINITY;
      if (tuple[1] === 'negative-infinity') return Number.NEGATIVE_INFINITY;
      if (tuple[1] === 'negative-zero') return -0;
      throw codecError('invalid encoded special number');
    }
    case 'date': {
      const tuple = encodedTuple(value, 'date', 2);
      const timestamp = decodeRawValue(tuple[1]);
      if (typeof timestamp !== 'number') throw codecError('invalid encoded Date timestamp');
      return new Date(timestamp);
    }
    case 'bytes': {
      const tuple = encodedTuple(value, 'bytes', 3);
      if ((tuple[1] !== 'buffer' && tuple[1] !== 'uint8array') || !Array.isArray(tuple[2])
        || !tuple[2].every((byte) => Number.isInteger(byte) && byte >= 0 && byte <= 255)) {
        throw codecError('invalid encoded bytes');
      }
      const bytes = tuple[2] as number[];
      const Buffer = bufferConstructor();
      return tuple[1] === 'buffer' && Buffer ? Buffer.from(bytes) : new Uint8Array(bytes);
    }
    case 'array': {
      const tuple = encodedTuple(value, 'array', 3);
      const length = tuple[1];
      if (!Number.isSafeInteger(length) || (length as number) < 0 || !Array.isArray(tuple[2])) {
        throw codecError('invalid encoded array');
      }
      const result = new Array(length as number);
      const seen = new Set<number>();
      for (const entry of tuple[2]) {
        if (!Array.isArray(entry) || entry.length !== 2 || !Number.isSafeInteger(entry[0])
          || entry[0] < 0 || entry[0] >= result.length || seen.has(entry[0])) {
          throw codecError('invalid encoded array entry');
        }
        seen.add(entry[0]);
        result[entry[0]] = decodeRawValue(entry[1]);
      }
      return result;
    }
    case 'object': {
      const tuple = encodedTuple(value, 'object', 3);
      if ((tuple[1] !== 'plain' && tuple[1] !== 'null') || !Array.isArray(tuple[2])) {
        throw codecError('invalid encoded object');
      }
      const result = (tuple[1] === 'null' ? Object.create(null) : {}) as Record<string, unknown>;
      const seen = new Set<string>();
      for (const entry of tuple[2]) {
        if (!Array.isArray(entry) || entry.length !== 2 || typeof entry[0] !== 'string' || seen.has(entry[0])) {
          throw codecError('invalid encoded object entry');
        }
        seen.add(entry[0]);
        Object.defineProperty(result, entry[0], {
          value: decodeRawValue(entry[1]),
          enumerable: true,
          configurable: true,
          writable: true,
        });
      }
      return result;
    }
    default:
      throw codecError(`unknown encoded tag ${JSON.stringify(value[0])}`);
  }
}

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (!value || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  if (value instanceof Date || value instanceof Uint8Array) return value;
  Object.values(value as Record<string, unknown>).forEach((entry) => deepFreeze(entry, seen));
  Object.freeze(value);
  return value;
}

function immutableSnapshot(snapshot: OfficeTableMetadataSnapshot): OfficeTableMetadataSnapshot {
  encodeRawValue(snapshot);
  return deepFreeze(cloneValue(snapshot));
}

export function snapshotsEqual(
  left: OfficeTableMetadataSnapshot,
  right: OfficeTableMetadataSnapshot,
): boolean {
  return JSON.stringify(encodeRawValue(left)) === JSON.stringify(encodeRawValue(right));
}

export class OfficeTableMetadataStep extends Step {
  readonly #before: OfficeTableMetadataSnapshot;
  readonly #after: OfficeTableMetadataSnapshot;

  constructor(before: OfficeTableMetadataSnapshot, after: OfficeTableMetadataSnapshot) {
    super();
    this.#before = immutableSnapshot(before);
    this.#after = immutableSnapshot(after);
  }

  get before(): OfficeTableMetadataSnapshot {
    return cloneValue(this.#before);
  }

  get after(): OfficeTableMetadataSnapshot {
    return cloneValue(this.#after);
  }

  apply(doc: ProseNode): StepResult {
    notifyOfficeTableMetadataTestHook('step');
    return StepResult.ok(doc);
  }

  invert(): Step {
    return new OfficeTableMetadataStep(this.#after, this.#before);
  }

  map(): Step {
    return this;
  }

  toJSON() {
    return {
      stepType: 'officeTableMetadata',
      encoding: metadataStepEncoding,
      before: encodeRawValue(this.#before),
      after: encodeRawValue(this.#after),
    };
  }

  static fromJSON(_schema: Schema, json: Record<string, unknown>): OfficeTableMetadataStep {
    if (json.encoding !== metadataStepEncoding) throw codecError('unknown or missing Step encoding');
    const before = decodeRawValue(json.before);
    const after = decodeRawValue(json.after);
    if (!before || typeof before !== 'object' || Array.isArray(before)
      || !after || typeof after !== 'object' || Array.isArray(after)
      || !Object.hasOwn(before, 'tables') || !Object.hasOwn(before, 'tableColors')
      || !Object.hasOwn(after, 'tables') || !Object.hasOwn(after, 'tableColors')) {
      throw codecError('invalid metadata snapshot envelope');
    }
    return new OfficeTableMetadataStep(
      before as OfficeTableMetadataSnapshot,
      after as OfficeTableMetadataSnapshot,
    );
  }
}

Step.jsonID('officeTableMetadata', OfficeTableMetadataStep);

export function registerOfficeTableMetadataBindings(
  root: HTMLElement,
  bindings: MetadataBindings,
): () => void {
  const current = bindingsByRoot.get(root) ?? {};
  const combined = { ...current, ...bindings };
  bindingsByRoot.set(root, combined);
  return () => {
    const active = bindingsByRoot.get(root);
    if (!active) return;
    for (const [key, value] of Object.entries(bindings)) {
      if (active[key as keyof MetadataBindings] === value) delete active[key as keyof MetadataBindings];
    }
    if (Object.keys(active).length === 0) bindingsByRoot.delete(root);
  };
}

export function readOfficeTableMetadataSnapshot(root: HTMLElement): OfficeTableMetadataSnapshot | null {
  const bindings = bindingsByRoot.get(root);
  if (!bindings?.readTables || !bindings.readTableColors) return null;
  const snapshot: OfficeTableMetadataSnapshot = {
    tables: bindings.readTables(),
    tableColors: bindings.readTableColors(),
  };
  if (bindings.readTableStyles) snapshot.tableStyles = bindings.readTableStyles();
  if (bindings.readPageAlignment) snapshot.pageAlignment = bindings.readPageAlignment();
  return immutableSnapshot(snapshot);
}

function safeCancelPublication(
  bindings: MetadataBindings,
  token: OfficeTableMetadataOperationToken,
  document?: ProseNode,
): boolean {
  try {
    return bindings.cancelDeferredSnapshot?.(token, document) === true;
  } catch (error) {
    reportPublicationError('metadata publication cancel failed', error);
    return false;
  }
}

function rollbackMetadataPublication(
  bindings: MetadataBindings,
  rollback: MetadataPublicationRollback,
) {
  const errors: unknown[] = [];
  const isCurrent = () => bindings.isCurrentSnapshot?.(rollback.token) === true;
  if (rollback.attemptedPageAlignment && rollback.beforePageAlignment && isCurrent()) {
    try {
      bindings.publishPageAlignment?.(rollback.beforePageAlignment);
    } catch (error) {
      errors.push(error);
    }
  }
  if (rollback.attemptedTableStyles && isCurrent()) {
    try {
      bindings.publishTableStyles?.(cloneValue(rollback.beforeTableStyles));
    } catch (error) {
      errors.push(error);
    }
  }
  if (rollback.attemptedTableColors && isCurrent()) {
    try {
      bindings.publishTableColors?.(cloneValue(rollback.beforeTableColors));
    } catch (error) {
      errors.push(error);
    }
  }
  if (rollback.attemptedTables && isCurrent()) {
    try {
      bindings.publishTables?.(cloneValue(rollback.beforeTables));
    } catch (error) {
      errors.push(error);
    }
  }
  errors.forEach((error) => reportPublicationError('metadata publication rollback failed', error));
}

function metadataSnapshotFromRollback(
  rollback: MetadataPublicationRollback,
): OfficeTableMetadataSnapshot {
  return {
    tables: cloneValue(rollback.beforeTables),
    tableColors: cloneValue(rollback.beforeTableColors),
    ...(Object.hasOwn(rollback, 'beforeTableStyles')
      ? { tableStyles: cloneValue(rollback.beforeTableStyles) }
      : {}),
    ...(rollback.beforePageAlignment
      ? { pageAlignment: rollback.beforePageAlignment }
      : {}),
  };
}

function requirePublicationBindings(root: HTMLElement): Required<Pick<MetadataBindings,
  'readTables' | 'readTableColors' | 'publishTables' | 'publishTableColors'
  | 'prepareDeferredSnapshot' | 'cancelDeferredSnapshot' | 'isCurrentSnapshot'>> & MetadataBindings {
  const bindings = bindingsByRoot.get(root);
  if (!bindings?.readTables || !bindings.readTableColors
    || !bindings.publishTables || !bindings.publishTableColors
    || !bindings.prepareDeferredSnapshot || !bindings.cancelDeferredSnapshot
    || !bindings.isCurrentSnapshot) {
    throw new OfficeTableMetadataPublicationError('metadata publication bindings are incomplete');
  }
  return bindings as Required<Pick<MetadataBindings,
    'readTables' | 'readTableColors' | 'publishTables' | 'publishTableColors'
    | 'prepareDeferredSnapshot' | 'cancelDeferredSnapshot' | 'isCurrentSnapshot'>> & MetadataBindings;
}

export function publishOfficeTableMetadataSnapshot(
  root: HTMLElement,
  snapshot: OfficeTableMetadataSnapshot,
  document?: ProseNode,
  options: {
    deferExternal?: boolean;
    token?: OfficeTableMetadataOperationToken;
  } = {},
) {
  const bindings = requirePublicationBindings(root);
  const token = options.token ?? allocateOfficeTableMetadataOperationToken();
  let prepared: boolean;
  try {
    prepared = bindings.prepareDeferredSnapshot(token, document);
  } catch (error) {
    safeCancelPublication(bindings, token, document);
    throw new OfficeTableMetadataPublicationError('metadata publication prepare failed', { cause: error });
  }
  if (!prepared || !bindings.isCurrentSnapshot(token)) {
    throw new OfficeTableMetadataPublicationError('stale or duplicate metadata operation token');
  }
  let rollback: MetadataPublicationRollback;
  try {
    rollback = {
      token,
      beforeTables: cloneValue(bindings.readTables()),
      beforeTableColors: cloneValue(bindings.readTableColors()),
      ...(bindings.readTableStyles
        ? { beforeTableStyles: cloneValue(bindings.readTableStyles()) }
        : {}),
      ...(bindings.readPageAlignment
        ? { beforePageAlignment: bindings.readPageAlignment() }
        : {}),
      attemptedTables: false,
      attemptedTableColors: false,
      attemptedTableStyles: false,
      attemptedPageAlignment: false,
    };
  } catch (error) {
    if (bindings.isCurrentSnapshot(token)) safeCancelPublication(bindings, token, document);
    throw new OfficeTableMetadataPublicationError('metadata publication snapshot capture failed', { cause: error });
  }
  const assertCurrent = () => {
    if (!bindings.isCurrentSnapshot(token)) {
      throw new OfficeTableMetadataPublicationError('metadata operation lost publication authority');
    }
  };
  try {
    assertCurrent();
    rollback.attemptedTables = true;
    bindings.publishTables(cloneValue(snapshot.tables));
    assertCurrent();
    rollback.attemptedTableColors = true;
    bindings.publishTableColors(cloneValue(snapshot.tableColors));
    assertCurrent();
    if (Object.hasOwn(snapshot, 'tableStyles')) {
      if (!bindings.publishTableStyles) {
        throw new OfficeTableMetadataPublicationError(
          'metadata.tableStyles publication binding is incomplete',
        );
      }
      rollback.attemptedTableStyles = true;
      bindings.publishTableStyles(cloneValue(snapshot.tableStyles));
      assertCurrent();
    }
    if (snapshot.pageAlignment) {
      if (!bindings.publishPageAlignment) {
        throw new OfficeTableMetadataPublicationError(
          'page-alignment publication binding is incomplete',
        );
      }
      rollback.attemptedPageAlignment = true;
      bindings.publishPageAlignment(snapshot.pageAlignment);
      assertCurrent();
    }
    if (options.deferExternal) {
      deferredRollbackByRoot.set(root, rollback);
      return;
    }
    if (!bindings.publishSnapshot) {
      throw new OfficeTableMetadataPublicationError('metadata publication has no external settlement binding');
    }
    const settled = bindings.publishSnapshot(
      cloneValue(snapshot),
      metadataSnapshotFromRollback(rollback),
      document,
      token,
    );
    if (!settled || !bindings.isCurrentSnapshot(token)) {
      throw new OfficeTableMetadataPublicationError('external metadata settlement was rejected');
    }
  } catch (error) {
    if (bindings.isCurrentSnapshot(token)) {
      rollbackMetadataPublication(bindings, rollback);
      safeCancelPublication(bindings, token, document);
    }
    deleteDeferredRollback(root, token);
    if (error instanceof OfficeTableMetadataPublicationError) throw error;
    throw new OfficeTableMetadataPublicationError('metadata publication transaction failed', { cause: error });
  }
}

export function publishOfficeTableMetadataExternalSnapshot(
  root: HTMLElement,
  snapshot: OfficeTableMetadataSnapshot,
  document?: ProseNode,
  token: OfficeTableMetadataOperationToken = allocateOfficeTableMetadataOperationToken(),
) : boolean {
  const bindings = requirePublicationBindings(root);
  const rollback = getDeferredRollback(root, token);
  if (!rollback || !bindings.isCurrentSnapshot(token)) return false;
  if (!bindings.publishSnapshot) {
    rollbackMetadataPublication(bindings, rollback);
    safeCancelPublication(bindings, token, document);
    deleteDeferredRollback(root, token);
    return false;
  }
  try {
    const settled = bindings.publishSnapshot(
      cloneValue(snapshot),
      metadataSnapshotFromRollback(rollback),
      document,
      token,
    );
    if (!settled || !bindings.isCurrentSnapshot(token)) {
      if (bindings.isCurrentSnapshot(token)) {
        rollbackMetadataPublication(bindings, rollback);
        safeCancelPublication(bindings, token, document);
      }
      deleteDeferredRollback(root, token);
      return false;
    }
    deleteDeferredRollback(root, token);
    return true;
  } catch (error) {
    if (bindings.isCurrentSnapshot(token)) {
      rollbackMetadataPublication(bindings, rollback);
      safeCancelPublication(bindings, token, document);
    }
    deleteDeferredRollback(root, token);
    throw new OfficeTableMetadataPublicationError('external metadata settlement failed', { cause: error });
  }
}

export function cancelOfficeTableMetadataExternalSnapshot(
  root: HTMLElement,
  token: OfficeTableMetadataOperationToken,
  document?: ProseNode,
) : boolean {
  const bindings = bindingsByRoot.get(root);
  if (!bindings) return false;
  if (bindings.isCurrentSnapshot?.(token)) {
    const rollback = getDeferredRollback(root, token);
    if (rollback) rollbackMetadataPublication(bindings, rollback);
    deleteDeferredRollback(root, token);
  }
  return safeCancelPublication(bindings, token, document);
}

export function deferOfficeTableMetadataExternalPublication(
  transaction: Transaction,
): OfficeTableMetadataOperationToken {
  const token = allocateOfficeTableMetadataOperationToken();
  transaction.setMeta(deferExternalPublicationMeta, true);
  transaction.setMeta(metadataOperationTokenMeta, token);
  return token;
}

export type OfficeTableMetadataActionResult = {
  applied: boolean;
  reason: 'applied' | 'no-change' | 'metadata-unavailable' | 'live-verification-failed';
  before?: OfficeTableMetadataSnapshot;
  after?: OfficeTableMetadataSnapshot;
};

/**
 * Dispatch one document-unchanged renderer-metadata action through the same
 * invertible Step/plugin/publication bridge used by structural table commands.
 */
export function dispatchOfficeTableMetadataAction(
  root: HTMLElement,
  view: { state: { doc: ProseNode; tr: Transaction }; dispatch: (transaction: Transaction) => void },
  prepare: (before: OfficeTableMetadataSnapshot) => OfficeTableMetadataSnapshot | null,
): OfficeTableMetadataActionResult {
  const before = readOfficeTableMetadataSnapshot(root);
  if (!before) return { applied: false, reason: 'metadata-unavailable' };
  const prepared = prepare(before);
  const after = prepared && before.pageAlignment && !Object.hasOwn(prepared, 'pageAlignment')
    ? { ...prepared, pageAlignment: before.pageAlignment }
    : prepared;
  if (!after || snapshotsEqual(before, after)) {
    return { applied: false, reason: 'no-change', before };
  }

  const documentBefore = view.state.doc;
  const transaction = view.state.tr;
  transaction.step(new OfficeTableMetadataStep(before, after));
  const operationToken = deferOfficeTableMetadataExternalPublication(transaction);
  closeHistory(transaction);
  try {
    view.dispatch(transaction);
    const published = readOfficeTableMetadataSnapshot(root);
    if (!view.state.doc.eq(documentBefore) || !published || !snapshotsEqual(published, after)) {
      throw new OfficeTableMetadataPublicationError(
        'direct metadata action failed its synchronous live invariant',
      );
    }
  } catch (error) {
    cancelOfficeTableMetadataExternalSnapshot(root, operationToken, view.state.doc);
    throw error;
  }
  if (!publishOfficeTableMetadataExternalSnapshot(root, after, view.state.doc, operationToken)) {
    throw new OfficeTableMetadataPublicationError(
      'direct metadata action external settlement was rejected',
    );
  }
  return { applied: true, reason: 'applied', before, after };
}

function renderSnapshot(root: HTMLElement) {
  const bindings = bindingsByRoot.get(root);
  bindings?.renderTables?.();
  bindings?.renderTableColors?.();
  bindings?.renderTableStyles?.();
}

export function createOfficeTableMetadataProsePlugin(
  publish: (
    snapshot: OfficeTableMetadataSnapshot,
    document: ProseNode,
    deferExternal: boolean,
    token: OfficeTableMetadataOperationToken,
  ) => void,
  render: () => void = () => {},
) {
  return new Plugin<OfficeTableMetadataSnapshot | null>({
    key: metadataPluginKey,
    state: {
      init: () => null,
      apply: (transaction, previous) => {
        const metadataSteps = transaction.steps.filter(
          (step): step is OfficeTableMetadataStep => step instanceof OfficeTableMetadataStep,
        );
        if (metadataSteps.length === 0) return previous;
        const next = metadataSteps[metadataSteps.length - 1].after;
        const attachedToken = transaction.getMeta(metadataOperationTokenMeta);
        const token = Number.isSafeInteger(attachedToken) && attachedToken > 0
          ? attachedToken as OfficeTableMetadataOperationToken
          : allocateOfficeTableMetadataOperationToken();
        metadataOperationGeneration = Math.max(metadataOperationGeneration, token);
        notifyOfficeTableMetadataTestHook('plugin-publish');
        publish(next, transaction.doc, transaction.getMeta(deferExternalPublicationMeta) === true, token);
        return next;
      },
    },
    view: () => ({
      update: render,
    }),
    appendTransaction: (transactions, _oldState, newState) => {
      if (transactions.some((transaction) => transaction.getMeta(historyBoundaryMeta))) return null;
      const hasMetadataStep = transactions.some((transaction) => transaction.steps.some(
        (step) => step instanceof OfficeTableMetadataStep,
      ));
      if (!hasMetadataStep) return null;
      // closeHistory on the composite transaction isolates it from the prior
      // event. This appended, non-history boundary isolates the following event
      // while remaining part of the same EditorView dispatch cycle.
      const boundary = closeHistory(newState.tr);
      boundary.setMeta('addToHistory', false);
      boundary.setMeta(historyBoundaryMeta, true);
      return boundary;
    },
  });
}

export function createOfficeTableMetadataPlugin(root: HTMLElement) {
  return $prose(() => createOfficeTableMetadataProsePlugin(
    (snapshot, document, deferExternal, token) => publishOfficeTableMetadataSnapshot(
      root,
      snapshot,
      document,
      { deferExternal, token },
    ),
    () => renderSnapshot(root),
  ));
}
