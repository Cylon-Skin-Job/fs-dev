'use strict';

const {
  TAB_POLICY_UNAVAILABLE_CODE,
  hasExactOwnEnumerableDataProperties,
  isValidPolicyDisplayString,
  isValidPolicyLauncherId,
  isValidPolicyList,
  normalizeTabPolicy,
  buildTabPolicyWireEntry,
} = require('../../lib/views/tab-policy');
const {
  TAB_LAUNCHER_CATALOG,
  TAB_LAUNCHER_CATALOG_VERSION,
  getCatalogLauncherIds,
  isCatalogLauncherIdForView,
} = require('../../lib/views/tab-launcher-catalog');

const LABEL_MAX_BYTES = 1024;
const LAUNCHER_ID_MAX_BYTES = 256;

function validTabs(overrides = {}) {
  return {
    schemaVersion: 1,
    initial: { kind: 'launcher', launcherId: 'capture.home' },
    plus: { enabled: true },
    empty: {
      tabLabel: 'New Capture Tab',
      locationLabel: 'New Capture Tab',
      launcherIds: ['capture.home'],
    },
    location: {
      omitTerminalNames: ['PAGE.md'],
      historyControls: 'presenter',
    },
    ...overrides,
  };
}

describe('tab launcher catalog (closed, code-owned)', () => {
  test('version-1 catalog maps exactly the two adopted views', () => {
    expect(TAB_LAUNCHER_CATALOG_VERSION).toBe(1);
    expect(getCatalogLauncherIds('capture-viewer')).toEqual(['capture.home']);
    expect(getCatalogLauncherIds('file-viewer')).toEqual(['file.open']);
    expect(getCatalogLauncherIds('side-chat-viewer')).toBeNull();
    expect(getCatalogLauncherIds('wiki-viewer')).toBeNull();
    expect(getCatalogLauncherIds('unknown-view')).toBeNull();
  });

  test('Side Chat does not exist anywhere in the catalog, not even disabled', () => {
    const serialized = JSON.stringify(TAB_LAUNCHER_CATALOG);
    expect(serialized).not.toContain('side');
    expect(serialized).not.toContain('chat');
    expect(Object.keys(TAB_LAUNCHER_CATALOG).sort()).toEqual(['capture-viewer', 'file-viewer']);
  });

  test('catalog membership is view-scoped and frozen', () => {
    expect(isCatalogLauncherIdForView('capture-viewer', 'capture.home')).toBe(true);
    expect(isCatalogLauncherIdForView('capture-viewer', 'file.open')).toBe(false);
    expect(isCatalogLauncherIdForView('file-viewer', 'file.open')).toBe(true);
    expect(isCatalogLauncherIdForView('file-viewer', 'capture.home')).toBe(false);
    expect(Object.isFrozen(TAB_LAUNCHER_CATALOG)).toBe(true);
    expect(Object.isFrozen(TAB_LAUNCHER_CATALOG['capture-viewer'])).toBe(true);
  });
});

describe('exact-shape guard', () => {
  test('accepts plain own enumerable data properties only', () => {
    expect(hasExactOwnEnumerableDataProperties({ a: 1 }, ['a'])).toBe(true);
    expect(hasExactOwnEnumerableDataProperties({ a: 1, b: 2 }, ['b', 'a'])).toBe(true);
    expect(hasExactOwnEnumerableDataProperties({}, [])).toBe(true);
  });

  test('rejects unknown keys, missing keys, arrays, null, and primitives', () => {
    expect(hasExactOwnEnumerableDataProperties({ a: 1, b: 2 }, ['a'])).toBe(false);
    expect(hasExactOwnEnumerableDataProperties({ a: 1 }, ['a', 'b'])).toBe(false);
    expect(hasExactOwnEnumerableDataProperties([1, 2], ['a'])).toBe(false);
    expect(hasExactOwnEnumerableDataProperties(null, [])).toBe(false);
    expect(hasExactOwnEnumerableDataProperties('x', [])).toBe(false);
    expect(hasExactOwnEnumerableDataProperties(42, [])).toBe(false);
  });

  test('rejects accessor properties', () => {
    const withAccessor = {};
    Object.defineProperty(withAccessor, 'kind', {
      enumerable: true,
      get() { return 'empty'; },
    });
    expect(hasExactOwnEnumerableDataProperties(withAccessor, ['kind'])).toBe(false);
  });

  test('rejects symbol-keyed properties', () => {
    const withSymbol = { kind: 'empty' };
    withSymbol[Symbol('extra')] = 'value';
    expect(hasExactOwnEnumerableDataProperties(withSymbol, ['kind'])).toBe(false);
  });

  test('rejects inherited enumerable properties and foreign prototypes', () => {
    const inherited = Object.create({ extra: 'inherited' });
    inherited.kind = 'empty';
    expect(hasExactOwnEnumerableDataProperties(inherited, ['kind'])).toBe(false);
    expect(hasExactOwnEnumerableDataProperties(Object.create(null), [])).toBe(false);
  });
});

describe('display-string rule', () => {
  test('accepts 1–1024 byte well-formed trimmed strings including surrogate pairs', () => {
    expect(isValidPolicyDisplayString('New Capture Tab', LABEL_MAX_BYTES)).toBe(true);
    expect(isValidPolicyDisplayString('𝌆 😀', LABEL_MAX_BYTES)).toBe(true);
    expect(isValidPolicyDisplayString('a'.repeat(1024), LABEL_MAX_BYTES)).toBe(true);
  });

  test('rejects non-strings and empty strings', () => {
    expect(isValidPolicyDisplayString(42, LABEL_MAX_BYTES)).toBe(false);
    expect(isValidPolicyDisplayString(null, LABEL_MAX_BYTES)).toBe(false);
    expect(isValidPolicyDisplayString('', LABEL_MAX_BYTES)).toBe(false);
  });

  test('rejects values whose original does not equal trim()', () => {
    expect(isValidPolicyDisplayString(' leading', LABEL_MAX_BYTES)).toBe(false);
    expect(isValidPolicyDisplayString('trailing ', LABEL_MAX_BYTES)).toBe(false);
    expect(isValidPolicyDisplayString('\ttabbed', LABEL_MAX_BYTES)).toBe(false);
    expect(isValidPolicyDisplayString('new\nline', LABEL_MAX_BYTES)).toBe(false);
    expect(isValidPolicyDisplayString('\u00a0nbsp', LABEL_MAX_BYTES)).toBe(false);
  });

  test('enforces the UTF-8 byte boundary', () => {
    expect(isValidPolicyDisplayString('é'.repeat(512), LABEL_MAX_BYTES)).toBe(true);
    expect(isValidPolicyDisplayString('é'.repeat(513), LABEL_MAX_BYTES)).toBe(false);
  });

  test('rejects lone high and low surrogates but accepts valid pairs', () => {
    expect(isValidPolicyDisplayString('lone\ud800high', LABEL_MAX_BYTES)).toBe(false);
    expect(isValidPolicyDisplayString('\ud800', LABEL_MAX_BYTES)).toBe(false);
    expect(isValidPolicyDisplayString('\udc00lone', LABEL_MAX_BYTES)).toBe(false);
    expect(isValidPolicyDisplayString('\udc00', LABEL_MAX_BYTES)).toBe(false);
    expect(isValidPolicyDisplayString('\ud83d\ude00paired', LABEL_MAX_BYTES)).toBe(true);
  });

  test('rejects C0 and C1 control code points', () => {
    expect(isValidPolicyDisplayString('a\u0000b', LABEL_MAX_BYTES)).toBe(false);
    expect(isValidPolicyDisplayString('a\u0001b', LABEL_MAX_BYTES)).toBe(false);
    expect(isValidPolicyDisplayString('a\u001fb', LABEL_MAX_BYTES)).toBe(false);
    expect(isValidPolicyDisplayString('a\u007fb', LABEL_MAX_BYTES)).toBe(false);
    expect(isValidPolicyDisplayString('a\u0080b', LABEL_MAX_BYTES)).toBe(false);
    expect(isValidPolicyDisplayString('a\u009fb', LABEL_MAX_BYTES)).toBe(false);
  });

  test('rejects U+2028 and U+2029 line separators', () => {
    expect(isValidPolicyDisplayString('a\u2028b', LABEL_MAX_BYTES)).toBe(false);
    expect(isValidPolicyDisplayString('a\u2029b', LABEL_MAX_BYTES)).toBe(false);
  });
});

describe('launcher-id rule', () => {
  test('accepts catalog-style opaque ids', () => {
    expect(isValidPolicyLauncherId('capture.home')).toBe(true);
    expect(isValidPolicyLauncherId('file.open')).toBe(true);
    expect(isValidPolicyLauncherId('a'.repeat(LAUNCHER_ID_MAX_BYTES))).toBe(true);
  });

  test('enforces byte bound and trim equality', () => {
    expect(isValidPolicyLauncherId('a'.repeat(LAUNCHER_ID_MAX_BYTES + 1))).toBe(false);
    expect(isValidPolicyLauncherId('é'.repeat(129))).toBe(false);
    expect(isValidPolicyLauncherId('é'.repeat(128))).toBe(true);
    expect(isValidPolicyLauncherId(' padded')).toBe(false);
    expect(isValidPolicyLauncherId('')).toBe(false);
    expect(isValidPolicyLauncherId(7)).toBe(false);
  });

  test('rejects control code points and line separators', () => {
    expect(isValidPolicyLauncherId('a\u0000b')).toBe(false);
    expect(isValidPolicyLauncherId('a\u001fb')).toBe(false);
    expect(isValidPolicyLauncherId('a\u007fb')).toBe(false);
    expect(isValidPolicyLauncherId('a\u009fb')).toBe(false);
    expect(isValidPolicyLauncherId('a\u2028b')).toBe(false);
    expect(isValidPolicyLauncherId('a\u2029b')).toBe(false);
  });
});

describe('normalizeTabPolicy', () => {
  test('normalizes a valid policy into the exact frozen shape (defaults when newTab absent)', () => {
    const policy = normalizeTabPolicy(validTabs(), 'capture-viewer');
    expect(policy).toEqual({
      schemaVersion: 1,
      initial: { kind: 'launcher', launcherId: 'capture.home' },
      plus: { enabled: true },
      empty: {
        tabLabel: 'New Capture Tab',
        locationLabel: 'New Capture Tab',
        launcherIds: ['capture.home'],
      },
      location: {
        omitTerminalNames: ['PAGE.md'],
        historyControls: 'presenter',
      },
      newTab: { blankKind: 'empty', autoOpenDrawer: false },
    });
    expect(Object.isFrozen(policy)).toBe(true);
    expect(Object.isFrozen(policy.empty)).toBe(true);
    expect(Object.isFrozen(policy.empty.launcherIds)).toBe(true);
    expect(Object.isFrozen(policy.location)).toBe(true);
    expect(Object.isFrozen(policy.location.omitTerminalNames)).toBe(true);
    expect(Object.isFrozen(policy.newTab)).toBe(true);
  });

  test('accepts kind "empty" without launcherId and plus disabled', () => {
    const policy = normalizeTabPolicy(validTabs({
      initial: { kind: 'empty' },
      plus: { enabled: false },
      empty: {
        tabLabel: 'New File Tab',
        locationLabel: 'New File Tab',
        launcherIds: ['file.open'],
      },
    }), 'file-viewer');
    expect(policy).toEqual({
      schemaVersion: 1,
      initial: { kind: 'empty' },
      plus: { enabled: false },
      empty: {
        tabLabel: 'New File Tab',
        locationLabel: 'New File Tab',
        launcherIds: ['file.open'],
      },
      location: { omitTerminalNames: ['PAGE.md'], historyControls: 'presenter' },
      newTab: { blankKind: 'empty', autoOpenDrawer: false },
    });
  });

  describe('VIEW-02 §7 newTab record', () => {
    test('accepts the extended shape with explicit newTab and carries it through', () => {
      for (const newTab of [
        { blankKind: 'home', autoOpenDrawer: false },
        { blankKind: 'home', autoOpenDrawer: true },
        { blankKind: 'empty', autoOpenDrawer: false },
        { blankKind: 'empty', autoOpenDrawer: true },
      ]) {
        const policy = normalizeTabPolicy(validTabs({ newTab }), 'capture-viewer');
        expect(policy).not.toBeNull();
        expect(policy.newTab).toEqual(newTab);
        expect(Object.isFrozen(policy.newTab)).toBe(true);
      }
    });

    test('applies the total defaults when newTab is absent (pre-§7 5-key shape)', () => {
      const policy = normalizeTabPolicy(validTabs(), 'capture-viewer');
      expect(policy.newTab).toEqual({ blankKind: 'empty', autoOpenDrawer: false });
    });

    test.each([
      () => validTabs({ newTab: { blankKind: 'blank', autoOpenDrawer: false } }),
      () => validTabs({ newTab: { blankKind: 'HOME', autoOpenDrawer: false } }),
      () => validTabs({ newTab: { blankKind: null, autoOpenDrawer: false } }),
      () => validTabs({ newTab: { blankKind: 1, autoOpenDrawer: false } }),
      () => validTabs({ newTab: { blankKind: undefined, autoOpenDrawer: false } }),
      () => validTabs({ newTab: { blankKind: 'home' } }),
      () => validTabs({ newTab: { autoOpenDrawer: false } }),
      () => validTabs({ newTab: { blankKind: 'home', autoOpenDrawer: 'yes' } }),
      () => validTabs({ newTab: { blankKind: 'home', autoOpenDrawer: 1 } }),
      () => validTabs({ newTab: { blankKind: 'home', autoOpenDrawer: null } }),
      () => validTabs({ newTab: { blankKind: 'home', autoOpenDrawer: false, extra: 1 } }),
      () => validTabs({ newTab: 'home' }),
      () => validTabs({ newTab: null }),
      () => validTabs({ newTab: [] }),
      () => validTabs({ newTab: 5 }),
      () => validTabs({ newTab: {} }),
    ])('rejects invalid newTab case %#', (makeTabs) => {
      expect(normalizeTabPolicy(makeTabs(), 'capture-viewer')).toBeNull();
    });

    test('rejects the extended shape with an additional unknown top-level key', () => {
      expect(normalizeTabPolicy(validTabs({
        newTab: { blankKind: 'home', autoOpenDrawer: false },
        unknownKey: true,
      }), 'capture-viewer')).toBeNull();
    });

    test('rejects accessor and symbol properties on newTab', () => {
      const accessorNewTab = {};
      Object.defineProperty(accessorNewTab, 'blankKind', {
        enumerable: true,
        get() { return 'home'; },
      });
      expect(normalizeTabPolicy(validTabs({ newTab: accessorNewTab }), 'capture-viewer')).toBeNull();

      const symbolNewTab = { blankKind: 'home', autoOpenDrawer: false };
      symbolNewTab[Symbol('extra')] = 1;
      expect(normalizeTabPolicy(validTabs({ newTab: symbolNewTab }), 'capture-viewer')).toBeNull();
    });
  });

  test('accepts empty launcherIds and omitTerminalNames arrays', () => {
    const policy = normalizeTabPolicy(validTabs({
      initial: { kind: 'empty' },
      empty: {
        tabLabel: 'New Capture Tab',
        locationLabel: 'New Capture Tab',
        launcherIds: [],
      },
      location: { omitTerminalNames: [], historyControls: 'none' },
    }), 'capture-viewer');
    expect(policy.empty.launcherIds).toEqual([]);
    expect(policy.location.omitTerminalNames).toEqual([]);
  });

  test('accepts the fixed maximum of 32 omitted names', () => {
    const policy = normalizeTabPolicy(validTabs({
      location: {
        omitTerminalNames: Array.from({ length: 32 }, (_, index) => `Name${index} Page.md`),
        historyControls: 'presenter',
      },
    }), 'capture-viewer');
    expect(policy.location.omitTerminalNames).toHaveLength(32);
  });

  test('the fixed maximum of 32 list items is enforced by the shared list validator', () => {
    expect(isValidPolicyList(Array.from({ length: 32 }, (_, index) => `id-${index}`), {
      itemValidator: (item) => typeof item === 'string',
      maxItems: 32,
    })).toBe(true);
    expect(isValidPolicyList(Array.from({ length: 33 }, (_, index) => `id-${index}`), {
      itemValidator: (item) => typeof item === 'string',
      maxItems: 32,
    })).toBe(false);
  });

  test('rejects more than 32 launcher ids or omitted names', () => {
    // The closed catalog admits only one launcher per view in version 1, so a
    // 33-entry launcherIds list is also necessarily duplicate-laden here.
    expect(normalizeTabPolicy(validTabs({
      empty: {
        tabLabel: 'New Capture Tab',
        locationLabel: 'New Capture Tab',
        launcherIds: Array.from({ length: 33 }, (_, index) => (
          index === 0 ? 'capture.home' : `capture.other-${index}`
        )),
      },
    }), 'capture-viewer')).toBeNull();
    expect(normalizeTabPolicy(validTabs({
      location: {
        omitTerminalNames: Array.from({ length: 33 }, (_, index) => `Name${index}.md`),
        historyControls: 'presenter',
      },
    }), 'capture-viewer')).toBeNull();
  });

  test('rejects duplicate launcher ids and duplicate omitted names', () => {
    expect(normalizeTabPolicy(validTabs({
      empty: {
        tabLabel: 'New Capture Tab',
        locationLabel: 'New Capture Tab',
        launcherIds: ['capture.home', 'capture.home'],
      },
    }), 'capture-viewer')).toBeNull();
    expect(normalizeTabPolicy(validTabs({
      location: {
        omitTerminalNames: ['PAGE.md', 'PAGE.md'],
        historyControls: 'presenter',
      },
    }), 'capture-viewer')).toBeNull();
  });

  test('rejects wrong-view and unknown launcher ids', () => {
    expect(normalizeTabPolicy(validTabs({
      initial: { kind: 'launcher', launcherId: 'file.open' },
    }), 'capture-viewer')).toBeNull();
    expect(normalizeTabPolicy(validTabs(), 'file-viewer')).toBeNull();
    expect(normalizeTabPolicy(validTabs({
      initial: { kind: 'launcher', launcherId: 'side.chat' },
    }), 'capture-viewer')).toBeNull();
    expect(normalizeTabPolicy(validTabs({
      empty: {
        tabLabel: 'New Capture Tab',
        locationLabel: 'New Capture Tab',
        launcherIds: ['capture.home', 'side.chat'],
      },
    }), 'capture-viewer')).toBeNull();
  });

  test('rejects wrong schemaVersion values', () => {
    expect(normalizeTabPolicy(validTabs({ schemaVersion: 2 }), 'capture-viewer')).toBeNull();
    expect(normalizeTabPolicy(validTabs({ schemaVersion: '1' }), 'capture-viewer')).toBeNull();
    expect(normalizeTabPolicy(validTabs({ schemaVersion: null }), 'capture-viewer')).toBeNull();
  });

  test.each([
    () => validTabs({ unknownKey: true }),
    () => { const tabs = validTabs(); delete tabs.initial; return tabs; },
    () => { const tabs = validTabs(); delete tabs.plus; return tabs; },
    () => { const tabs = validTabs(); delete tabs.empty; return tabs; },
    () => { const tabs = validTabs(); delete tabs.location; return tabs; },
    () => validTabs({ initial: { kind: 'bogus' } }),
    () => validTabs({ initial: { kind: 'launcher' } }),
    () => validTabs({ initial: { kind: 'launcher', launcherId: 'capture.home', extra: 1 } }),
    () => validTabs({ initial: { kind: 'empty', launcherId: 'capture.home' } }),
    () => validTabs({ initial: { kind: 'empty', extra: 1 } }),
    () => validTabs({ initial: 'empty' }),
    () => validTabs({ plus: { enabled: 'yes' } }),
    () => validTabs({ plus: { enabled: 1 } }),
    () => validTabs({ plus: { enabled: true, extra: 1 } }),
    () => validTabs({ plus: {} }),
    () => validTabs({ empty: { tabLabel: 'A', locationLabel: 'B' } }),
    () => validTabs({ empty: { tabLabel: 'A', locationLabel: 'B', launcherIds: [], extra: 1 } }),
    () => validTabs({ empty: { tabLabel: ' A', locationLabel: 'B', launcherIds: [] } }),
    () => validTabs({ empty: { tabLabel: 'A', locationLabel: 'B\u0000', launcherIds: [] } }),
    () => validTabs({ empty: { tabLabel: 'A', locationLabel: 'B', launcherIds: 'capture.home' } }),
    () => validTabs({ location: { omitTerminalNames: [], historyControls: 'auto' } }),
    () => validTabs({ location: { omitTerminalNames: [], historyControls: 'presenter ' } }),
    () => validTabs({ location: { omitTerminalNames: [], historyControls: null } }),
    () => validTabs({ location: { historyControls: 'presenter' } }),
    () => validTabs({ location: { omitTerminalNames: ['PAGE.md'], historyControls: 'presenter', extra: 1 } }),
    () => validTabs({ location: { omitTerminalNames: 'PAGE.md', historyControls: 'presenter' } }),
  ])('rejects invalid tabs case %#', (makeTabs) => {
    expect(normalizeTabPolicy(makeTabs(), 'capture-viewer')).toBeNull();
  });

  test('rejects non-object tabs values', () => {
    for (const value of [null, 'tabs', 5, [], true]) {
      expect(normalizeTabPolicy(value, 'capture-viewer')).toBeNull();
    }
  });

  test('rejects accessor, symbol, and inherited properties anywhere in the policy', () => {
    const accessorTabs = {};
    Object.defineProperties(accessorTabs, Object.fromEntries(
      Object.entries(validTabs()).map(([key, value]) => [key, {
        enumerable: true,
        get() { return value; },
      }]),
    ));
    expect(normalizeTabPolicy(accessorTabs, 'capture-viewer')).toBeNull();

    const symbolTabs = validTabs();
    symbolTabs[Symbol('extra')] = 1;
    expect(normalizeTabPolicy(symbolTabs, 'capture-viewer')).toBeNull();

    const inheritedInitial = Object.create({ extra: true });
    inheritedInitial.kind = 'empty';
    expect(normalizeTabPolicy(validTabs({ initial: inheritedInitial }), 'capture-viewer')).toBeNull();
  });

  test('rejects executable or authority-shaped data through the exact-key rule', () => {
    expect(normalizeTabPolicy(validTabs({
      url: 'https://example.invalid',
    }), 'capture-viewer')).toBeNull();
    expect(normalizeTabPolicy(validTabs({
      initial: { kind: 'empty', importPath: './payload.js' },
    }), 'capture-viewer')).toBeNull();
    expect(normalizeTabPolicy(validTabs({
      empty: {
        tabLabel: 'A',
        locationLabel: 'B',
        launcherIds: [],
        presenterId: 'presenter.home',
      },
    }), 'capture-viewer')).toBeNull();
  });
});

describe('buildTabPolicyWireEntry', () => {
  test('absent tabs produce no entry', () => {
    expect(buildTabPolicyWireEntry(undefined, 'capture-viewer')).toBeNull();
  });

  test('valid config produces the exact ready entry', () => {
    const entry = buildTabPolicyWireEntry(validTabs(), 'capture-viewer');
    expect(Object.keys(entry).sort()).toEqual(['policy', 'schemaVersion', 'status']);
    expect(entry).toEqual({
      schemaVersion: 1,
      status: 'ready',
      policy: normalizeTabPolicy(validTabs(), 'capture-viewer'),
    });
    expect(Object.isFrozen(entry)).toBe(true);
    expect(Object.isFrozen(entry.policy)).toBe(true);
  });

  test('present but invalid config produces the exact bounded unavailable entry', () => {
    for (const tabsValue of [null, 5, 'x', {}, validTabs({ plus: { enabled: 'no' } }), []]) {
      const entry = buildTabPolicyWireEntry(tabsValue, 'capture-viewer');
      expect(entry).toEqual({
        schemaVersion: 1,
        status: 'unavailable',
        code: TAB_POLICY_UNAVAILABLE_CODE,
      });
      expect(Object.isFrozen(entry)).toBe(true);
    }
    expect(TAB_POLICY_UNAVAILABLE_CODE).toBe('tab_configuration_unavailable');
  });
});
