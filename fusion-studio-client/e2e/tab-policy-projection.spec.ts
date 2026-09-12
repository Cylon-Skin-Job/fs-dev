import { expect, test } from '@playwright/test';

import {
  parseTabPolicyProjection,
  type TabPolicyProjection,
} from '../src/lib/tab-policy-projection';
import {
  projectTabLocationDisplaySegments,
} from '../src/components/view-tabs/componentTabLocationPolicy';
import {
  COMPONENT_TAB_LAUNCHER_CATALOG,
  findComponentTabLauncherCatalogEntry,
  componentTabLauncherCatalogIdsForView,
} from '../src/components/view-tabs/componentTabLauncherCatalog';

function captureTabsPolicy() {
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
    // VIEW-02 §7: the server's normalized ready policy always carries a total
    // newTab record (pinned Capture values), so the client parser requires it.
    newTab: {
      blankKind: 'home',
      autoOpenDrawer: false,
    },
  } as const;
}

function validWireMap(): Record<string, unknown> {
  return {
    'capture-viewer': {
      schemaVersion: 1,
      status: 'ready',
      policy: captureTabsPolicy(),
    },
    'file-viewer': {
      schemaVersion: 1,
      status: 'unavailable',
      code: 'tab_configuration_unavailable',
    },
  };
}

function segment(label: string): { label: string } {
  return { label };
}

async function settle(): Promise<void> {
  for (let index = 0; index < 12; index += 1) await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

test('parses the exact ready/unavailable wire envelope and freezes the result', () => {
  const source = validWireMap();
  const parsed = parseTabPolicyProjection(source);
  expect(parsed).toEqual(source);
  expect(Object.isFrozen(parsed)).toBe(true);
  const ready = parsed?.['capture-viewer'];
  expect(ready?.status).toBe('ready');
  if (ready?.status === 'ready') expect(Object.isFrozen(ready.policy)).toBe(true);
  const unavailable = parsed?.['file-viewer'];
  expect(unavailable).toEqual({
    schemaVersion: 1,
    status: 'unavailable',
    code: 'tab_configuration_unavailable',
  });
  expect(Object.isFrozen(unavailable)).toBe(true);

  // Mutating the source must not affect the parsed projection.
  (source['capture-viewer'] as { policy: unknown }).policy = 'forged';
  if (ready?.status === 'ready') {
    expect((ready.policy as { empty: { tabLabel: string } }).empty.tabLabel).toBe('New Capture Tab');
  }
});

test('absent or non-object tabPolicies fail closed to legacy (null)', () => {
  expect(parseTabPolicyProjection(undefined)).toBeNull();
  expect(parseTabPolicyProjection(null)).toBeNull();
  expect(parseTabPolicyProjection('tabPolicies')).toBeNull();
  expect(parseTabPolicyProjection(42)).toBeNull();
  expect(parseTabPolicyProjection([])).toBeNull();
});

test('malformed envelopes fail closed without throwing', () => {
  const cases: unknown[] = [
    { 'capture-viewer': null },
    { 'capture-viewer': 'ready' },
    { 'capture-viewer': {} },
    { 'capture-viewer': { schemaVersion: 1, status: 'ready' } },
    { 'capture-viewer': { schemaVersion: 1, status: 'ready', policy: captureTabsPolicy(), extra: 1 } },
    { 'capture-viewer': { schemaVersion: 2, status: 'ready', policy: captureTabsPolicy() } },
    { 'capture-viewer': { schemaVersion: 1, status: 'unavailable', code: 'other_code' } },
    { 'capture-viewer': { schemaVersion: 1, status: 'unavailable', code: 'tab_configuration_unavailable', extra: 1 } },
    { 'INVALID_VIEW': { schemaVersion: 1, status: 'unavailable', code: 'tab_configuration_unavailable' } },
    { 'side.chat': { schemaVersion: 1, status: 'unavailable', code: 'tab_configuration_unavailable' } },
  ];
  for (const value of cases) expect(parseTabPolicyProjection(value)).toBeNull();
});

test('an empty map is a valid projection (all views legacy)', () => {
  expect(parseTabPolicyProjection({})).toEqual({});
});

test('malformed ready policies fail closed without throwing', () => {
  const base = captureTabsPolicy();
  const cases: unknown[] = [
    { ...base, schemaVersion: 2 },
    { ...base, unknownKey: true },
    { ...base, initial: { kind: 'bogus' } },
    { ...base, initial: { kind: 'launcher' } },
    { ...base, plus: { enabled: 'yes' } },
    { ...base, empty: { tabLabel: ' A', locationLabel: base.empty.locationLabel, launcherIds: ['capture.home'] } },
    {
      ...base,
      empty: {
        tabLabel: 'A',
        locationLabel: 'B',
        launcherIds: ['capture.home', 'capture.home'],
      },
    },
    { ...base, location: { omitTerminalNames: [], historyControls: 'auto' } },
    { ...base, location: { omitTerminalNames: ['PAGE.md', 'PAGE.md'], historyControls: 'presenter' } },
    // VIEW-02 §7: a ready policy without newTab, or with a malformed one,
    // fails closed (the server always emits the normalized record).
    (() => { const { newTab: _omitted, ...rest } = base; return rest; })(),
    { ...base, newTab: { ...base.newTab, blankKind: 'bogus' } },
    { ...base, newTab: { blankKind: 'home' } },
    { ...base, newTab: { autoOpenDrawer: true } },
    { ...base, newTab: { ...base.newTab, autoOpenDrawer: 'yes' } },
    { ...base, newTab: { ...base.newTab, extra: 1 } },
    { ...base, newTab: 'home' },
  ];
  // Note: launcher-id catalog membership (e.g. 'side.chat') is server-owned;
  // the client wire parser validates the envelope shape. Unknown ids fail
  // closed later at launcher binding time through the closed client catalog
  // (proven by the launcher catalog test below).
  for (const policy of cases) {
    expect(parseTabPolicyProjection({
      'capture-viewer': { schemaVersion: 1, status: 'ready', policy },
    })).toBeNull();
  }
});

test('policy string rules mirror the server: bounds, controls, surrogates, separators', () => {
  const labelCases: Array<[string, boolean]> = [
    ['ok', true],
    ['\ud83d\ude00pair', true],
    ['\ud800lone', false],
    ['lone\udfff', false],
    ['a\u0000b', false],
    ['a\u001fb', false],
    ['a\u007fb', false],
    ['a\u009fb', false],
    ['a\u2028b', false],
    ['a\u2029b', false],
    [' leading', false],
    ['', false],
    ['é'.repeat(512), true],
    ['é'.repeat(513), false],
  ];
  for (const [label, ok] of labelCases) {
    const parsed = parseTabPolicyProjection({
      'capture-viewer': {
        schemaVersion: 1,
        status: 'ready',
        policy: { ...captureTabsPolicy(), empty: {
          tabLabel: label,
          locationLabel: 'New Capture Tab',
          launcherIds: ['capture.home'],
        } },
      },
    });
    expect(parsed !== null).toBe(ok);
  }

  const launcherCases: Array<[string[], boolean]> = [
    [['capture.home'], true],
    [['a'.repeat(256)], true],
    [['a'.repeat(257)], false],
    [[' padded'], false],
    [['a\u2028b'], false],
    [Array.from({ length: 33 }, (_, index) => `id-${index}`), false],
  ];
  for (const [launcherIds, ok] of launcherCases) {
    const parsed = parseTabPolicyProjection({
      'capture-viewer': {
        schemaVersion: 1,
        status: 'ready',
        policy: { ...captureTabsPolicy(), empty: {
          tabLabel: 'New Capture Tab',
          locationLabel: 'New Capture Tab',
          launcherIds,
        } },
      },
    });
    expect(parsed !== null).toBe(ok);
  }
});

test('accessor, symbol-keyed, and inherited properties fail closed', () => {
  const accessorEntry: Record<string, unknown> = {};
  Object.defineProperty(accessorEntry, 'schemaVersion', {
    enumerable: true,
    get() { return 1; },
  });
  accessorEntry.status = 'unavailable';
  accessorEntry.code = 'tab_configuration_unavailable';
  expect(parseTabPolicyProjection({ 'capture-viewer': accessorEntry })).toBeNull();

  const symbolEntry: Record<string, unknown> = {
    schemaVersion: 1,
    status: 'unavailable',
    code: 'tab_configuration_unavailable',
  };
  (symbolEntry as Record<symbol, unknown>)[Symbol('extra')] = 1;
  expect(parseTabPolicyProjection({ 'capture-viewer': symbolEntry })).toBeNull();

  const inheritedInitial = Object.create({ extra: true }) as Record<string, unknown>;
  inheritedInitial.kind = 'empty';
  expect(parseTabPolicyProjection({
    'capture-viewer': {
      schemaVersion: 1,
      status: 'ready',
      policy: { ...captureTabsPolicy(), initial: inheritedInitial },
    },
  })).toBeNull();
});

test('panelStore stores the projection and clears/restores it with workspace state', async () => {
  const previousWindow = (globalThis as unknown as { window?: unknown }).window;
  const previousDocument = (globalThis as unknown as { document?: unknown }).document;
  const previousWebSocket = (globalThis as unknown as { WebSocket?: unknown }).WebSocket;
  Object.assign(globalThis, {
    window: { electronAPI: {} },
    document: {
      getElementById: () => null,
      createElement: () => ({}),
      head: { appendChild: () => undefined },
    },
    WebSocket: { OPEN: 1 },
  });

  try {
    const { usePanelStore } = await import('../src/state/panelStore');
    usePanelStore.setState({ activeWorkspaceId: null, workspaceState: {}, tabPolicies: null, ws: null });

    const projection = parseTabPolicyProjection(validWireMap()) as TabPolicyProjection;
    expect(projection).not.toBeNull();

    usePanelStore.getState().activateWorkspace('workspace-policy-a');
    usePanelStore.getState().setTabPolicies(projection);
    expect(usePanelStore.getState().tabPolicies).toBe(projection);

    // Switching to a workspace without cached state clears the projection.
    usePanelStore.getState().activateWorkspace('workspace-policy-b');
    expect(usePanelStore.getState().tabPolicies).toBeNull();

    // Switching back restores the cached projection for workspace-a.
    usePanelStore.getState().activateWorkspace('workspace-policy-a');
    expect(usePanelStore.getState().tabPolicies).toBe(projection);

    // Eviction resets it.
    usePanelStore.getState().evictWorkspaceRuntimeState('workspace-policy-a');
    expect(usePanelStore.getState().tabPolicies).toBeNull();

    // Explicit null reset (legacy frame).
    usePanelStore.getState().setTabPolicies(projection);
    usePanelStore.getState().setTabPolicies(null);
    expect(usePanelStore.getState().tabPolicies).toBeNull();
  } finally {
    Object.assign(globalThis, {
      window: previousWindow,
      document: previousDocument,
      WebSocket: previousWebSocket,
    });
  }
});

test('panel_config frames store the projection; malformed input fails closed to legacy', async () => {
  const previousWindow = (globalThis as unknown as { window?: unknown }).window;
  const previousDocument = (globalThis as unknown as { document?: unknown }).document;
  const previousWebSocket = (globalThis as unknown as { WebSocket?: unknown }).WebSocket;
  Object.assign(globalThis, {
    window: {
      electronAPI: {
        setWorkspaceBinding: async () => true,
        replaceViewCapsuleProjection: async () => true,
      },
    },
    document: {
      getElementById: () => null,
      createElement: () => ({}),
      head: { appendChild: () => undefined },
    },
    WebSocket: { OPEN: 1 },
  });

  try {
    const handlers = await import('../src/lib/ws/workspace-handlers');
    const { useWorkspaceStore } = await import('../src/state/workspaceStore');
    const { usePanelStore } = await import('../src/state/panelStore');
    const context = { runtimeGeneration: 'generation-policy', isStillCurrent: () => true };
    handlers.retirePendingWorkspaceExposure();
    useWorkspaceStore.setState({
      activeWorkspaceId: 'workspace-policy-old', workspaceEpoch: 'epoch-old', hasReceivedInit: true,
    });
    usePanelStore.setState({
      activeWorkspaceId: 'workspace-policy-old', panelRoots: {}, tabPolicies: null, ws: null,
    });

    handlers.handleWorkspaceMessage({
      type: 'workspace:switched', bindingRevision: 1, to: 'workspace-policy-a',
      repoPath: '/workspace-policy-a', workspaceEpoch: 'epoch-a', styles: {},
    }, context);
    handlers.handleWorkspaceMessage({
      type: 'panel_config', workspaceId: 'workspace-policy-a', workspaceEpoch: 'epoch-a',
      projectRoot: '/workspace-policy-a',
      panelRoots: { 'capture-viewer': '/workspace-policy-a/captures' },
      viewCapsules: {
        version: 1,
        workspaceId: 'workspace-policy-a',
        machineIdentity: 'Policy-Machine',
        entries: [],
      },
      tabPolicies: validWireMap(),
    }, context);
    await settle();

    expect(usePanelStore.getState().tabPolicies).toEqual(parseTabPolicyProjection(validWireMap()));
    expect(usePanelStore.getState().panelRoots).toEqual({
      'capture-viewer': '/workspace-policy-a/captures',
    });

    // A malformed present tabPolicies value stores null (legacy) and leaves
    // the rest of the frame intact.
    handlers.handleWorkspaceMessage({
      type: 'workspace:switched', bindingRevision: 2, to: 'workspace-policy-a',
      repoPath: '/workspace-policy-a', workspaceEpoch: 'epoch-a2', styles: {},
    }, context);
    handlers.handleWorkspaceMessage({
      type: 'panel_config', workspaceId: 'workspace-policy-a', workspaceEpoch: 'epoch-a2',
      projectRoot: '/workspace-policy-a',
      panelRoots: { 'capture-viewer': '/workspace-policy-a/captures' },
      viewCapsules: {
        version: 1,
        workspaceId: 'workspace-policy-a',
        machineIdentity: 'Policy-Machine',
        entries: [],
      },
      tabPolicies: { 'capture-viewer': { schemaVersion: 1 } },
    }, context);
    await settle();

    expect(usePanelStore.getState().tabPolicies).toBeNull();
    expect(usePanelStore.getState().panelRoots).toEqual({
      'capture-viewer': '/workspace-policy-a/captures',
    });

    // An absent tabPolicies field is also legacy.
    handlers.handleWorkspaceMessage({
      type: 'workspace:switched', bindingRevision: 3, to: 'workspace-policy-a',
      repoPath: '/workspace-policy-a', workspaceEpoch: 'epoch-a3', styles: {},
    }, context);
    handlers.handleWorkspaceMessage({
      type: 'panel_config', workspaceId: 'workspace-policy-a', workspaceEpoch: 'epoch-a3',
      projectRoot: '/workspace-policy-a',
      panelRoots: { 'capture-viewer': '/workspace-policy-a/captures' },
      viewCapsules: {
        version: 1,
        workspaceId: 'workspace-policy-a',
        machineIdentity: 'Policy-Machine',
        entries: [],
      },
    }, context);
    await settle();
    expect(usePanelStore.getState().tabPolicies).toBeNull();
  } finally {
    const handlers = await import('../src/lib/ws/workspace-handlers');
    handlers.retirePendingWorkspaceExposure();
    Object.assign(globalThis, {
      window: previousWindow,
      document: previousDocument,
      WebSocket: previousWebSocket,
    });
  }
});

test('location policy omits only the exact terminal name with segments remaining', () => {
  // PAGE.md omitted when terminal with remaining segments.
  expect(projectTabLocationDisplaySegments(
    [segment('Capture'), segment('Collection'), segment('PAGE.md')],
    ['PAGE.md'],
  )).toEqual([segment('Capture'), segment('Collection')]);

  // Similarly named files NOT omitted (exact case-sensitive match).
  expect(projectTabLocationDisplaySegments(
    [segment('Notes'), segment('PAGE.md.bak')],
    ['PAGE.md'],
  )).toEqual([segment('Notes'), segment('PAGE.md.bak')]);
  expect(projectTabLocationDisplaySegments(
    [segment('Notes'), segment('page.md')],
    ['PAGE.md'],
  )).toEqual([segment('Notes'), segment('page.md')]);
  expect(projectTabLocationDisplaySegments(
    [segment('Notes'), segment('Page.MD')],
    ['PAGE.md'],
  )).toEqual([segment('Notes'), segment('Page.MD')]);

  // One-segment path never omits.
  expect(projectTabLocationDisplaySegments([segment('PAGE.md')], ['PAGE.md']))
    .toEqual([segment('PAGE.md')]);

  // Duplicate-label segments lose only the last occurrence.
  expect(projectTabLocationDisplaySegments(
    [segment('PAGE.md'), segment('PAGE.md')],
    ['PAGE.md'],
  )).toEqual([segment('PAGE.md')]);
  expect(projectTabLocationDisplaySegments(
    [segment('a'), segment('PAGE.md'), segment('PAGE.md')],
    ['PAGE.md'],
  )).toEqual([segment('a'), segment('PAGE.md')]);

  // Non-matching terminal name is kept.
  expect(projectTabLocationDisplaySegments(
    [segment('Capture'), segment('note.md')],
    ['PAGE.md'],
  )).toEqual([segment('Capture'), segment('note.md')]);

  // Empty omit list is a no-op; segments never become empty.
  expect(projectTabLocationDisplaySegments(
    [segment('Capture'), segment('PAGE.md')],
    [],
  )).toEqual([segment('Capture'), segment('PAGE.md')]);
});

test('location policy is display-only and never mutates its inputs', () => {
  const segments = [segment('Capture'), segment('PAGE.md')];
  const omit = ['PAGE.md'];
  const snapshot = [...segments];
  const projected = projectTabLocationDisplaySegments(segments, omit);
  expect(segments).toEqual(snapshot);
  expect(projected).not.toBe(segments);
  expect(omit).toEqual(['PAGE.md']);
});

test('launcher catalog metadata is closed, view-scoped, and Side-Chat-free', () => {
  expect(COMPONENT_TAB_LAUNCHER_CATALOG.map((entry) => entry.launcherId).sort())
    .toEqual(['capture.home', 'file.open']);
  expect(findComponentTabLauncherCatalogEntry('capture.home', 'capture-viewer'))
    .toMatchObject({ kind: 'component', label: 'Capture Home' });
  expect(findComponentTabLauncherCatalogEntry('capture.home', 'file-viewer')).toBeNull();
  expect(findComponentTabLauncherCatalogEntry('file.open', 'file-viewer'))
    .toMatchObject({ kind: 'picker', label: 'Open File' });
  expect(findComponentTabLauncherCatalogEntry('file.open', 'capture-viewer')).toBeNull();
  expect(findComponentTabLauncherCatalogEntry('side.chat', 'capture-viewer')).toBeNull();
  expect(componentTabLauncherCatalogIdsForView('capture-viewer')).toEqual(['capture.home']);
  expect(componentTabLauncherCatalogIdsForView('file-viewer')).toEqual(['file.open']);
  expect(componentTabLauncherCatalogIdsForView('side-chat-viewer')).toEqual([]);
  const serialized = JSON.stringify(COMPONENT_TAB_LAUNCHER_CATALOG).toLowerCase();
  expect(serialized).not.toContain('side');
  expect(serialized).not.toContain('chat');
});
