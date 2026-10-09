/**
 * @module tab-policy
 * @role Strict server-side tab-policy parser/normalizer (SPEC-02 §4, VRT-010).
 *
 * Parses the optional `tabs` object of a view's version-1 `content.json` and
 * projects it into the `tabPolicies` map carried by the existing panel_config
 * frame. Everything is fail-closed:
 *
 *   - a view whose content.json has NO `tabs` key produces no entry at all
 *     (absence = legacy renderer path);
 *   - a PRESENT but malformed/unsupported `tabs` object produces exactly one
 *     bounded `unavailable` entry for that view. It must never fail view
 *     discovery, the panel_config frame, or Chat — only that view's tab
 *     policy becomes unavailable.
 *
 * Whole-file content.json parse failures are NOT handled here; they keep the
 * existing `viewRegistryUnavailable` degradation owned by view discovery.
 *
 * The parser accepts plain own enumerable data properties only. No URLs,
 * import paths, component IDs, presenter IDs, resource targets, permissions,
 * callbacks, or executable data can appear anywhere: every record has an
 * exact key set and every value is a bounded validated scalar or an array of
 * catalog-checked launcher IDs / display strings.
 *
 * VIEW-02 §7 extends the version-1 shape with an OPTIONAL `newTab` record
 * (`blankKind: 'home' | 'empty'`, `autoOpenDrawer: boolean`). Both the
 * pre-§7 5-key shape and the extended shape are accepted; the normalized
 * policy always carries a total `newTab` record (defaults when absent).
 */

const { isCatalogLauncherIdForView } = require('./tab-launcher-catalog');

const TAB_POLICY_SCHEMA_VERSION = 1;
const TAB_POLICY_LABEL_MAX_BYTES = 1024;
const TAB_POLICY_LAUNCHER_ID_MAX_BYTES = 256;
const TAB_POLICY_MAX_LAUNCHER_IDS = 32;
const TAB_POLICY_MAX_OMIT_TERMINAL_NAMES = 32;
const TAB_POLICY_HISTORY_CONTROLS = new Set(['presenter', 'none']);
const TAB_POLICY_UNAVAILABLE_CODE = 'tab_configuration_unavailable';
const MAX_TAB_POLICY_PROJECTION_ENTRIES = 256;

const TAB_POLICY_KEYS = Object.freeze(['schemaVersion', 'initial', 'plus', 'empty', 'location']);
// VIEW-02 §7: `newTab` is an OPTIONAL additive key of the `tabs` object. The
// pre-§7 5-key shape remains valid; when `newTab` is absent the normalized
// policy carries the total defaults record below, so downstream code always
// reads exactly one shape.
const TAB_POLICY_KEYS_WITH_NEW_TAB = Object.freeze([...TAB_POLICY_KEYS, 'newTab']);
const EMPTY_RECORD_KEYS = Object.freeze(['tabLabel', 'locationLabel', 'launcherIds']);
const LOCATION_RECORD_KEYS = Object.freeze(['omitTerminalNames', 'historyControls']);
const NEW_TAB_RECORD_KEYS = Object.freeze(['blankKind', 'autoOpenDrawer']);
const TAB_POLICY_NEW_TAB_BLANK_KINDS = new Set(['home', 'empty']);
const TAB_POLICY_NEW_TAB_DEFAULTS = Object.freeze({ blankKind: 'empty', autoOpenDrawer: false });

function isPlainObjectValue(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Exact-shape guard: a plain object whose own string-keyed properties are
 * exactly the expected enumerable data properties, with no accessor
 * properties, no symbol-keyed properties, and no inherited enumerable
 * properties (prototype must be Object.prototype).
 */
function hasExactOwnEnumerableDataProperties(value, expectedKeys) {
  if (!isPlainObjectValue(value)) return false;
  if (Object.getPrototypeOf(value) !== Object.prototype) return false;
  const ownKeys = Object.getOwnPropertyNames(value);
  if (ownKeys.length !== expectedKeys.length) return false;
  for (const key of ownKeys) {
    if (!expectedKeys.includes(key)) return false;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor) return false;
    if (descriptor.enumerable !== true) return false;
    if (descriptor.get !== undefined || descriptor.set !== undefined) return false;
  }
  return Object.getOwnPropertySymbols(value).length === 0;
}

/**
 * Well-formed Unicode with no lone high/low surrogate, no code point in
 * U+0000–U+001F or U+007F–U+009F, and no U+2028/U+2029.
 */
function isWellFormedWithoutForbiddenCodePoints(value) {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
      continue;
    }
    if (code >= 0xdc00 && code <= 0xdfff) {
      const previous = index > 0 ? value.charCodeAt(index - 1) : NaN;
      if (!(previous >= 0xd800 && previous <= 0xdbff)) return false;
      continue;
    }
    if (code <= 0x001f) return false;
    if (code >= 0x007f && code <= 0x009f) return false;
    if (code === 0x2028 || code === 0x2029) return false;
  }
  return true;
}

/**
 * Display-string rule for `tabLabel`, `locationLabel`, and every
 * `omitTerminalNames` entry: string whose original value equals trim(); UTF-8
 * encoding 1–maxBytes bytes; well-formed Unicode; no forbidden code points.
 */
function isValidPolicyDisplayString(value, maxBytes) {
  if (typeof value !== 'string') return false;
  if (value.trim() !== value) return false;
  const byteLength = Buffer.byteLength(value, 'utf8');
  if (byteLength < 1 || byteLength > maxBytes) return false;
  return isWellFormedWithoutForbiddenCodePoints(value);
}

/**
 * Launcher-ID rule (accepted opaque-ID rule): string; original equals trim();
 * 1–256 UTF-8 bytes; same forbidden control ranges and U+2028/U+2029.
 */
function isValidPolicyLauncherId(value) {
  if (typeof value !== 'string') return false;
  if (value.trim() !== value) return false;
  const byteLength = Buffer.byteLength(value, 'utf8');
  if (byteLength < 1 || byteLength > TAB_POLICY_LAUNCHER_ID_MAX_BYTES) return false;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 0x001f) return false;
    if (code >= 0x007f && code <= 0x009f) return false;
    if (code === 0x2028 || code === 0x2029) return false;
  }
  return true;
}

/**
 * Ordered, duplicate-free array (exact equality) with a fixed maximum size.
 */
function isValidPolicyList(value, { itemValidator, maxItems }) {
  if (!Array.isArray(value) || value.length > maxItems) return false;
  const seen = new Set();
  for (const item of value) {
    if (!itemValidator(item)) return false;
    if (seen.has(item)) return false;
    seen.add(item);
  }
  return true;
}

function normalizeInitialRecord(value, viewId) {
  if (hasExactOwnEnumerableDataProperties(value, ['kind'])) {
    if (value.kind === 'empty') return Object.freeze({ kind: 'empty' });
    return null;
  }
  if (hasExactOwnEnumerableDataProperties(value, ['kind', 'launcherId'])) {
    if (value.kind !== 'launcher') return null;
    if (!isValidPolicyLauncherId(value.launcherId)) return null;
    if (!isCatalogLauncherIdForView(viewId, value.launcherId)) return null;
    return Object.freeze({ kind: 'launcher', launcherId: value.launcherId });
  }
  return null;
}

function normalizePlusRecord(value) {
  if (!hasExactOwnEnumerableDataProperties(value, ['enabled'])) return null;
  if (typeof value.enabled !== 'boolean') return null;
  return Object.freeze({ enabled: value.enabled });
}

function normalizeEmptyRecord(value, viewId) {
  if (!hasExactOwnEnumerableDataProperties(value, EMPTY_RECORD_KEYS)) return null;
  if (!isValidPolicyDisplayString(value.tabLabel, TAB_POLICY_LABEL_MAX_BYTES)) return null;
  if (!isValidPolicyDisplayString(value.locationLabel, TAB_POLICY_LABEL_MAX_BYTES)) return null;
  if (!isValidPolicyList(value.launcherIds, {
    itemValidator: (launcherId) => (
      isValidPolicyLauncherId(launcherId) && isCatalogLauncherIdForView(viewId, launcherId)
    ),
    maxItems: TAB_POLICY_MAX_LAUNCHER_IDS,
  })) return null;
  return Object.freeze({
    tabLabel: value.tabLabel,
    locationLabel: value.locationLabel,
    launcherIds: Object.freeze([...value.launcherIds]),
  });
}

function normalizeLocationRecord(value) {
  if (!hasExactOwnEnumerableDataProperties(value, LOCATION_RECORD_KEYS)) return null;
  if (!isValidPolicyList(value.omitTerminalNames, {
    itemValidator: (name) => isValidPolicyDisplayString(name, TAB_POLICY_LABEL_MAX_BYTES),
    maxItems: TAB_POLICY_MAX_OMIT_TERMINAL_NAMES,
  })) return null;
  if (typeof value.historyControls !== 'string') return null;
  if (!TAB_POLICY_HISTORY_CONTROLS.has(value.historyControls)) return null;
  return Object.freeze({
    omitTerminalNames: Object.freeze([...value.omitTerminalNames]),
    historyControls: value.historyControls,
  });
}

/**
 * VIEW-02 §7 new-tab policy record: what + creates for this view (`blankKind`)
 * and whether a new Empty tab opens its drawer automatically
 * (`autoOpenDrawer`). Exact key set, bounded scalar values only.
 */
function normalizeNewTabRecord(value) {
  if (!hasExactOwnEnumerableDataProperties(value, NEW_TAB_RECORD_KEYS)) return null;
  if (typeof value.autoOpenDrawer !== 'boolean') return null;
  if (!TAB_POLICY_NEW_TAB_BLANK_KINDS.has(value.blankKind)) return null;
  return Object.freeze({
    blankKind: value.blankKind,
    autoOpenDrawer: value.autoOpenDrawer,
  });
}

/**
 * Normalize a present `tabs` value into the version-1 policy record, or null
 * when any rule is violated (fail-closed).
 *
 * Accepts both the pre-§7 5-key shape and the extended shape with an optional
 * `newTab` record. The normalized policy ALWAYS carries a total `newTab`
 * record: the defaults (`blankKind: 'empty'`, `autoOpenDrawer: false`) apply
 * when the key is absent.
 *
 * @param {unknown} tabsValue - the raw `tabs` value from content.json
 * @param {string} viewId - canonical view id (drives the closed catalog check)
 * @returns {object|null} frozen normalized policy, or null when invalid
 */
function normalizeTabPolicy(tabsValue, viewId) {
  let newTabRaw;
  if (hasExactOwnEnumerableDataProperties(tabsValue, TAB_POLICY_KEYS_WITH_NEW_TAB)) {
    newTabRaw = tabsValue.newTab;
  } else if (hasExactOwnEnumerableDataProperties(tabsValue, TAB_POLICY_KEYS)) {
    // Pre-§7 5-key shape: `newTab` defaults apply.
    newTabRaw = undefined;
  } else {
    return null;
  }
  if (tabsValue.schemaVersion !== TAB_POLICY_SCHEMA_VERSION) return null;
  const initial = normalizeInitialRecord(tabsValue.initial, viewId);
  if (!initial) return null;
  const plus = normalizePlusRecord(tabsValue.plus);
  if (!plus) return null;
  const empty = normalizeEmptyRecord(tabsValue.empty, viewId);
  if (!empty) return null;
  const location = normalizeLocationRecord(tabsValue.location);
  if (!location) return null;
  const newTab = newTabRaw === undefined
    ? TAB_POLICY_NEW_TAB_DEFAULTS
    : normalizeNewTabRecord(newTabRaw);
  if (!newTab) return null;
  return Object.freeze({ schemaVersion: TAB_POLICY_SCHEMA_VERSION, initial, plus, empty, location, newTab });
}

/**
 * Build the wire entry for one view's `tabs` value.
 *
 * @returns {object|null} exactly
 *   `{schemaVersion: 1, status: "ready", policy}` or
 *   `{schemaVersion: 1, status: "unavailable", code: "tab_configuration_unavailable"}`,
 *   or null when the view has no `tabs` config (absent = legacy, no entry).
 */
function buildTabPolicyWireEntry(tabsValue, viewId) {
  if (tabsValue === undefined) return null;
  const policy = normalizeTabPolicy(tabsValue, viewId);
  if (!policy) {
    return Object.freeze({
      schemaVersion: TAB_POLICY_SCHEMA_VERSION,
      status: 'unavailable',
      code: TAB_POLICY_UNAVAILABLE_CODE,
    });
  }
  return Object.freeze({
    schemaVersion: TAB_POLICY_SCHEMA_VERSION,
    status: 'ready',
    policy,
  });
}

module.exports = {
  TAB_POLICY_SCHEMA_VERSION,
  TAB_POLICY_LABEL_MAX_BYTES,
  TAB_POLICY_LAUNCHER_ID_MAX_BYTES,
  TAB_POLICY_MAX_LAUNCHER_IDS,
  TAB_POLICY_MAX_OMIT_TERMINAL_NAMES,
  TAB_POLICY_UNAVAILABLE_CODE,
  MAX_TAB_POLICY_PROJECTION_ENTRIES,
  hasExactOwnEnumerableDataProperties,
  isValidPolicyDisplayString,
  isValidPolicyLauncherId,
  isValidPolicyList,
  normalizeTabPolicy,
  buildTabPolicyWireEntry,
};
