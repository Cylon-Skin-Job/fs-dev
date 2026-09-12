/**
 * @module tab-policy-projection
 * @role Strict client-side wire parser for the `tabPolicies` value carried by
 *       the workspace-correlated panel_config frame (SPEC-02 §4).
 *
 * Sibling to view-capsule-projection.ts. The renderer never reparses the disk
 * content.json — it stores this projection exactly as received, after strict
 * envelope validation. On any shape mismatch the parser returns null
 * (fail-closed to legacy behavior); it never throws into the frame handler.
 *
 * Each view value is exactly either:
 *   {schemaVersion: 1, status: 'ready', policy}
 *   {schemaVersion: 1, status: 'unavailable', code: 'tab_configuration_unavailable'}
 *
 * VIEW-02 §7: the server's normalized ready policy always carries a total
 * `newTab` record (`blankKind: 'home' | 'empty'`, `autoOpenDrawer: boolean`),
 * so this parser REQUIRES it — a ready policy without `newTab` is a shape
 * mismatch and fails closed.
 */

export interface TabPolicyInitialEmpty {
  readonly kind: 'empty';
}

export interface TabPolicyInitialLauncher {
  readonly kind: 'launcher';
  readonly launcherId: string;
}

export type TabPolicyInitial = TabPolicyInitialEmpty | TabPolicyInitialLauncher;

export interface TabPolicyNewTab {
  readonly blankKind: 'home' | 'empty';
  readonly autoOpenDrawer: boolean;
}

export interface TabPolicy {
  readonly schemaVersion: 1;
  readonly initial: TabPolicyInitial;
  readonly plus: Readonly<{ enabled: boolean }>;
  readonly empty: Readonly<{
    tabLabel: string;
    locationLabel: string;
    launcherIds: readonly string[];
  }>;
  readonly location: Readonly<{
    omitTerminalNames: readonly string[];
    historyControls: 'presenter' | 'none';
  }>;
  readonly newTab: TabPolicyNewTab;
}

export type TabPolicyProjectionEntry =
  | Readonly<{ schemaVersion: 1; status: 'ready'; policy: TabPolicy }>
  | Readonly<{
    schemaVersion: 1;
    status: 'unavailable';
    code: 'tab_configuration_unavailable';
  }>;

export type TabPolicyProjection = Readonly<Record<string, TabPolicyProjectionEntry>>;

const TAB_POLICY_SCHEMA_VERSION = 1;
const TAB_POLICY_UNAVAILABLE_CODE = 'tab_configuration_unavailable' as const;
const TAB_POLICY_LABEL_MAX_BYTES = 1024;
const TAB_POLICY_LAUNCHER_ID_MAX_BYTES = 256;
const TAB_POLICY_MAX_LAUNCHER_IDS = 32;
const TAB_POLICY_MAX_OMIT_TERMINAL_NAMES = 32;
const MAX_TAB_POLICY_PROJECTION_ENTRIES = 256;
const HISTORY_CONTROLS = new Set(['presenter', 'none']);
const VIEW_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const encoder = new TextEncoder();

function plainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function exactOwnEnumerableDataProperties(value: object, expected: string[]): boolean {
  if (Object.getPrototypeOf(value) !== Object.prototype) return false;
  const ownKeys = Object.getOwnPropertyNames(value);
  if (ownKeys.length !== expected.length) return false;
  for (const key of ownKeys) {
    if (!expected.includes(key)) return false;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || descriptor.enumerable !== true) return false;
    if (descriptor.get !== undefined || descriptor.set !== undefined) return false;
  }
  return Object.getOwnPropertySymbols(value).length === 0;
}

function byteLength(value: string): number {
  return encoder.encode(value).length;
}

function isForbiddenCodePoint(code: number): boolean {
  return code <= 0x001f || (code >= 0x007f && code <= 0x009f) || code === 0x2028 || code === 0x2029;
}

/** Well-formed Unicode with no lone surrogate plus the forbidden code points. */
function isWellFormedDisplayString(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
      continue;
    }
    if (code >= 0xdc00 && code <= 0xdfff) {
      const previous = index > 0 ? value.charCodeAt(index - 1) : Number.NaN;
      if (!(previous >= 0xd800 && previous <= 0xdbff)) return false;
      continue;
    }
    if (isForbiddenCodePoint(code)) return false;
  }
  return true;
}

function isValidDisplayString(value: unknown, maxBytes: number): value is string {
  if (typeof value !== 'string') return false;
  if (value.trim() !== value) return false;
  const bytes = byteLength(value);
  if (bytes < 1 || bytes > maxBytes) return false;
  return isWellFormedDisplayString(value);
}

function isValidLauncherId(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  if (value.trim() !== value) return false;
  const bytes = byteLength(value);
  if (bytes < 1 || bytes > TAB_POLICY_LAUNCHER_ID_MAX_BYTES) return false;
  for (let index = 0; index < value.length; index += 1) {
    if (isForbiddenCodePoint(value.charCodeAt(index))) return false;
  }
  return true;
}

function isValidDuplicateFreeList(
  value: unknown,
  itemValidator: (item: unknown) => boolean,
  maxItems: number,
): value is string[] {
  if (!Array.isArray(value) || value.length > maxItems) return false;
  const seen = new Set<string>();
  for (const item of value) {
    if (!itemValidator(item)) return false;
    if (seen.has(item)) return false;
    seen.add(item);
  }
  return true;
}

function parseInitial(value: unknown): TabPolicyInitial | null {
  if (plainRecord(value) && exactOwnEnumerableDataProperties(value, ['kind'])) {
    return value.kind === 'empty' ? { kind: 'empty' } : null;
  }
  if (plainRecord(value) && exactOwnEnumerableDataProperties(value, ['kind', 'launcherId'])) {
    if (value.kind !== 'launcher') return null;
    if (!isValidLauncherId(value.launcherId)) return null;
    return { kind: 'launcher', launcherId: value.launcherId };
  }
  return null;
}

function parsePlus(value: unknown): Readonly<{ enabled: boolean }> | null {
  if (!plainRecord(value) || !exactOwnEnumerableDataProperties(value, ['enabled'])) return null;
  if (typeof value.enabled !== 'boolean') return null;
  return { enabled: value.enabled };
}

function parseEmpty(value: unknown): TabPolicy['empty'] | null {
  if (!plainRecord(value) || !exactOwnEnumerableDataProperties(value, ['tabLabel', 'locationLabel', 'launcherIds'])) {
    return null;
  }
  if (!isValidDisplayString(value.tabLabel, TAB_POLICY_LABEL_MAX_BYTES)) return null;
  if (!isValidDisplayString(value.locationLabel, TAB_POLICY_LABEL_MAX_BYTES)) return null;
  if (!isValidDuplicateFreeList(value.launcherIds, isValidLauncherId, TAB_POLICY_MAX_LAUNCHER_IDS)) return null;
  return Object.freeze({
    tabLabel: value.tabLabel,
    locationLabel: value.locationLabel,
    launcherIds: Object.freeze([...value.launcherIds]),
  });
}

function parseLocation(value: unknown): TabPolicy['location'] | null {
  if (!plainRecord(value) || !exactOwnEnumerableDataProperties(value, ['omitTerminalNames', 'historyControls'])) {
    return null;
  }
  if (!isValidDuplicateFreeList(
    value.omitTerminalNames,
    (item) => isValidDisplayString(item, TAB_POLICY_LABEL_MAX_BYTES),
    TAB_POLICY_MAX_OMIT_TERMINAL_NAMES,
  )) return null;
  if (typeof value.historyControls !== 'string' || !HISTORY_CONTROLS.has(value.historyControls)) return null;
  return Object.freeze({
    omitTerminalNames: Object.freeze([...value.omitTerminalNames]),
    historyControls: value.historyControls as TabPolicy['location']['historyControls'],
  });
}

const NEW_TAB_BLANK_KINDS = new Set(['home', 'empty']);

/** VIEW-02 §7: exact-shape, bounded-scalar new-tab policy record. */
function parseNewTab(value: unknown): TabPolicyNewTab | null {
  if (!plainRecord(value) || !exactOwnEnumerableDataProperties(value, ['blankKind', 'autoOpenDrawer'])) {
    return null;
  }
  if (typeof value.autoOpenDrawer !== 'boolean') return null;
  if (typeof value.blankKind !== 'string' || !NEW_TAB_BLANK_KINDS.has(value.blankKind)) return null;
  return Object.freeze({
    blankKind: value.blankKind as TabPolicyNewTab['blankKind'],
    autoOpenDrawer: value.autoOpenDrawer,
  });
}

function parsePolicy(value: unknown): TabPolicy | null {
  if (!plainRecord(value) || !exactOwnEnumerableDataProperties(
    value,
    ['schemaVersion', 'initial', 'plus', 'empty', 'location', 'newTab'],
  )) return null;
  if (value.schemaVersion !== TAB_POLICY_SCHEMA_VERSION) return null;
  const initial = parseInitial(value.initial);
  if (!initial) return null;
  const plus = parsePlus(value.plus);
  if (!plus) return null;
  const empty = parseEmpty(value.empty);
  if (!empty) return null;
  const location = parseLocation(value.location);
  if (!location) return null;
  const newTab = parseNewTab(value.newTab);
  if (!newTab) return null;
  return Object.freeze({ schemaVersion: 1, initial, plus, empty, location, newTab });
}

function parseEntry(value: unknown): TabPolicyProjectionEntry | null {
  if (!plainRecord(value)) return null;
  if (exactOwnEnumerableDataProperties(value, ['schemaVersion', 'status', 'policy'])) {
    if (value.schemaVersion !== TAB_POLICY_SCHEMA_VERSION || value.status !== 'ready') return null;
    const policy = parsePolicy(value.policy);
    if (!policy) return null;
    return Object.freeze({ schemaVersion: 1, status: 'ready', policy });
  }
  if (exactOwnEnumerableDataProperties(value, ['schemaVersion', 'status', 'code'])) {
    if (value.schemaVersion !== TAB_POLICY_SCHEMA_VERSION || value.status !== 'unavailable') return null;
    if (value.code !== TAB_POLICY_UNAVAILABLE_CODE) return null;
    return Object.freeze({
      schemaVersion: 1,
      status: 'unavailable',
      code: TAB_POLICY_UNAVAILABLE_CODE,
    });
  }
  return null;
}

/**
 * Strictly parse the wire `tabPolicies` map. Returns null (legacy) on any
 * shape mismatch, including an absent value.
 */
export function parseTabPolicyProjection(value: unknown): TabPolicyProjection | null {
  if (!plainRecord(value)) return null;
  if (Object.getOwnPropertySymbols(value).length !== 0) return null;
  const keys = Object.keys(value);
  if (keys.length > MAX_TAB_POLICY_PROJECTION_ENTRIES) return null;
  const entries: Record<string, TabPolicyProjectionEntry> = {};
  for (const viewId of keys) {
    if (viewId.length === 0 || viewId.length > 128 || !VIEW_ID_PATTERN.test(viewId)) return null;
    const entry = parseEntry(value[viewId]);
    if (!entry) return null;
    entries[viewId] = entry;
  }
  return Object.freeze(entries);
}
