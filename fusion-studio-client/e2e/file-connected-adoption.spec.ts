import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

import { parseTabPolicyProjection } from '../src/lib/tab-policy-projection';
import { readyTabPolicyFor } from '../src/components/view-tabs/componentTabConnectedAdapter';
import {
  createFileConnectedOwnerPorts,
  createFileOpenLauncherBinding,
  describeFileComponent,
  fileDocumentPresenterInput,
  protectFileModelForPendingClose,
  resolveFilePlacementTarget,
} from '../src/components/view-tabs/fileConnectedOwnerPorts';
import {
  FILE_DOCUMENT_PRESENTER_ID,
  FILE_VIEWER_PANEL_ID,
  FILE_VIEWER_TARGET_KEY_PREFIX,
  canonicalFilePath,
  fileDocumentTargetKey,
} from '../src/components/view-tabs/fileConnectedPresenterTargets';
import {
  isFileConnectedActive,
  openFileDocument,
  setActiveFileConnectedRuntime,
} from '../src/components/view-tabs/fileConnectedTabs';
import { bindCatalogLaunchers, createConnectedTabOwner } from '../src/components/view-tabs/componentTabConnectedOwner';
import { createConnectedTabDescriber } from '../src/components/view-tabs/componentTabConnectedAdapter';
import { useFileStore } from '../src/state/fileStore';
import { useChatFileLinkStore } from '../src/state/chatFileLinkStore';
import { usePanelStore } from '../src/state/panelStore';
import type { FileInfo, FileEditorTab } from '../src/types/file-explorer';
import type { ViewTabAdapterModel } from '../src/components/view-tabs/viewTabAdapters';

// Node-side stubs for the runtime touchpoints (reveal focus).
// Mirrors the established view-tab-contract.spec.ts controller harness.
const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
const documentDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'document');
const cssDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'CSS');
Object.defineProperty(globalThis, 'window', {
  configurable: true,
  writable: true,
  value: {
    location: { host: '127.0.0.1:3312' },
    setTimeout: globalThis.setTimeout,
    clearTimeout: globalThis.clearTimeout,
    requestAnimationFrame: (callback: (time: number) => void) => {
      callback(0);
      return 1;
    },
  },
});
Object.defineProperty(globalThis, 'document', {
  configurable: true,
  writable: true,
  value: { querySelector: () => null },
});
Object.defineProperty(globalThis, 'CSS', {
  configurable: true,
  writable: true,
  value: { escape: (value: string) => value },
});

const require = createRequire(path.join(process.cwd(), 'package.json'));
const tabPolicyServer = require('../fusion-studio-server/lib/views/tab-policy.js');

const SHIPPED_TABS = {
  schemaVersion: 1,
  initial: { kind: 'empty' },
  plus: { enabled: true },
  empty: {
    tabLabel: 'New File Tab',
    locationLabel: 'New File Tab',
    launcherIds: ['file.open'],
  },
  location: { omitTerminalNames: [], historyControls: 'none' },
  // VIEW-02 §7 pinned File new-tab policy (server-normalized passthrough).
  newTab: { blankKind: 'empty', autoOpenDrawer: true },
};

function repoFile(relative: string): string {
  return path.resolve(process.cwd(), '..', relative);
}

function fileInfo(partial: { path: string; name?: string; extension?: string; isSymlink?: true; symlinkTarget?: string }): FileInfo {
  const name = partial.name ?? partial.path.slice(partial.path.lastIndexOf('/') + 1);
  return {
    name,
    path: partial.path,
    type: 'file',
    extension: partial.extension ?? (name.includes('.') ? name.split('.').pop()!.toLowerCase() : ''),
    ...(partial.isSymlink ? { isSymlink: true } : {}),
    ...(partial.symlinkTarget ? { symlinkTarget: partial.symlinkTarget } : {}),
  };
}

function resetStores() {
  useFileStore.setState({
    viewMode: 'tree',
    tabs: [],
    activeTabId: null,
    activeTabPath: null,
    expandedFolders: new Set(),
    showHiddenFolders: false,
  });
  usePanelStore.setState({ viewStates: {}, activeWorkspaceId: null, ws: null });
  useChatFileLinkStore.setState({ autocompleteCandidates: [] });
}

// ---------------------------------------------------------------------------
// Shipped configuration proof (SPEC-02 §4/§10)
// ---------------------------------------------------------------------------

test.describe('VIEW-02 Slice 4 — shipped File tab policy', () => {
  test('live and template content.json ship the identical, exact tabs object', () => {
    const livePath = repoFile('ai/RC-MacAir-15/System/Views/002-file-viewer/content.json');
    const templatePath = repoFile(
      'System_Manager/ai-template/templates/view-templates/010-file-viewer/content.json',
    );
    const liveBytes = fs.readFileSync(livePath);
    const templateBytes = fs.readFileSync(templatePath);
    expect(liveBytes.equals(templateBytes)).toBe(true);

    const live = JSON.parse(liveBytes.toString('utf8'));
    expect(live.tabs).toEqual(SHIPPED_TABS);
    expect(live.version).toBe(1);
  });

  test('the Slice-1 server parser projects exactly this config to a ready policy', () => {
    const wireEntry = tabPolicyServer.buildTabPolicyWireEntry(SHIPPED_TABS, 'file-viewer');
    expect(wireEntry).toEqual({
      schemaVersion: 1,
      status: 'ready',
      policy: SHIPPED_TABS,
    });

    // The client wire parser + activation gate accept the same projection.
    const projection = parseTabPolicyProjection({ 'file-viewer': wireEntry });
    expect(projection).not.toBeNull();
    const policy = readyTabPolicyFor(projection, 'file-viewer');
    expect(policy).not.toBeNull();
    expect(policy?.initial).toEqual({ kind: 'empty' });
    expect(policy?.empty).toEqual(SHIPPED_TABS.empty);
  });
});

// ---------------------------------------------------------------------------
// Connected owner ports + runtime integration (fileStore-bound, fake socket)
// ---------------------------------------------------------------------------

class FakeAckSocket extends EventTarget {
  readyState = 1; // OPEN
  readonly sent: Array<Record<string, unknown>> = [];
  send(payload: string) {
    this.sent.push(JSON.parse(payload) as Record<string, unknown>);
  }
}

function seedWorkspace(ws: FakeAckSocket) {
  usePanelStore.setState({
    activeWorkspaceId: 'ws-slice4',
    ws: ws as unknown as WebSocket,
    tabPolicies: parseTabPolicyProjection({
      'file-viewer': { schemaVersion: 1, status: 'ready', policy: SHIPPED_TABS },
    }),
    panelConfigs: [{ id: 'file-viewer', name: 'Files', icon: 'folder' }],
  });
}

function mountRuntime() {
  const ports = createFileConnectedOwnerPorts({ workspaceId: 'ws-slice4' });
  const policy = parseTabPolicyProjection({
    'file-viewer': { schemaVersion: 1, status: 'ready', policy: SHIPPED_TABS },
  });
  const readyPolicy = readyTabPolicyFor(policy, 'file-viewer')!;
  const describer = createConnectedTabDescriber({
    policy: readyPolicy,
    viewIcon: 'folder',
    describeComponent: describeFileComponent,
  });
  const owner = createConnectedTabOwner({
    ...ports,
    describeTab: describer,
    launcherFor: (launcherId) => bindCatalogLaunchers([
      { launcherId: 'file.open', binding: createFileOpenLauncherBinding() },
    ])(launcherId, 'file-viewer'),
  });
  setActiveFileConnectedRuntime(owner, 'ws-slice4');
  return { owner, ports };
}

function fileState() {
  return useFileStore.getState();
}

function activity() {
  return usePanelStore.getState().viewStates['file-viewer']?.activity ?? null;
}

/** Lets the serialized intent lane drain before assertions. */
async function drainLane() {
  await new Promise((resolve) => setTimeout(resolve, 30));
}

test.describe('VIEW-02 Slice 4 — File connected owner integration through the acknowledged owner', () => {
  let ws: FakeAckSocket;

  test.beforeEach(() => {
    resetStores();
    ws = new FakeAckSocket();
    seedWorkspace(ws);
    usePanelStore.getState().setViewState('file-viewer', { activity: {
      recents: [],
      navigation: { stack: [], index: -1 },
      tabs: [],
      activeTabId: null,
    } });
  });

  test.afterEach(() => {
    setActiveFileConnectedRuntime(null, null);
  });

  test('initial Empty policy creates ONE waiting Empty tab in the presentation owner; commits ride the activity path', async () => {
    const { owner } = mountRuntime();
    await owner.ensureInitial({ kind: 'empty' });
    await drainLane();

    const state = fileState();
    expect(state.tabs).toHaveLength(1);
    expect(state.tabs[0]?.kind).toBe('empty');
    expect(state.activeTabId).toBe(state.tabs[0]?.id);
    expect(state.viewMode).toBe('viewer');

    // The acknowledged owner path: the activity persistence rode state:set.
    const setStateFrames = ws.sent.filter((frame) => frame.type === 'state:set');
    expect(setStateFrames.length).toBeGreaterThanOrEqual(1);
    for (const frame of setStateFrames) {
      expect(frame.view).toBe('file-viewer');
      expect(typeof frame.clientMutationId).toBe('number');
      expect(frame.state).toHaveProperty('activity');
    }

    // The generic snapshot mirrors the presentation owner.
    const collection = owner.readCollection();
    expect(collection.tabs).toHaveLength(1);
    expect(collection.tabs[0].content.kind).toBe('empty');
    expect(collection.activeTabId).toBe(state.activeTabId);
  });

  test('translation: hydrated file tabs normalize into addressed component records with the canonical resource path preserved', () => {
    useFileStore.getState().hydrateTabsFromActivity({
      recents: [],
      navigation: { stack: [], index: -1 },
      tabs: [
        { id: 'file-viewer:docs/first.md', panel: 'file-viewer', path: 'docs/first.md', title: 'first.md', kind: 'file', extension: 'md', openedAt: 1 },
      ],
      activeTabId: 'file-viewer:docs/first.md',
    });

    const { owner } = mountRuntime();
    const collection = owner.readCollection();
    expect(collection.tabs).toHaveLength(1);
    const content = collection.tabs[0].content;
    expect(content.kind).toBe('component');
    if (content.kind !== 'component') throw new Error('expected component');
    expect(content.component.componentTypeId).toBe('file.document');
    expect(content.component.targetKey).toBe('file:doc:docs/first.md');
    expect(content.component.input).toMatchObject({
      title: 'first.md',
      path: 'docs/first.md',
      name: 'first.md',
      extension: 'md',
    });
    // The canonical resource path used for fetching/saving is unchanged.
    expect(fileDocumentPresenterInput(content.component.input)?.path).toBe('docs/first.md');
    expect(collection.activeTabId).toBe(useFileStore.getState().activeTabId);

    // Code-owned TABS-03 target resolution for the same path round-trips.
    const resolved = resolveFilePlacementTarget({
      presenterId: FILE_DOCUMENT_PRESENTER_ID,
      targetKey: fileDocumentTargetKey('docs/first.md'),
    }, 'Files');
    expect(resolved).not.toBeNull();
    expect(resolved?.input).toEqual(content.component.input);
  });

  test('placement through TABS-03: current fills the active Empty tab; populated selection appends; exact re-open activates; new appends', async () => {
    const { owner } = mountRuntime();
    await owner.ensureInitial({ kind: 'empty' });
    await drainLane();
    const emptyTabId = fileState().activeTabId!;

    // Current fills THAT exact Empty tab (same presentation tab identity).
    expect(isFileConnectedActive()).toBe(true);
    expect(openFileDocument({ file: fileInfo({ path: 'docs/first.md' }), disposition: 'current' })).toBe(true);
    await drainLane();
    let state = fileState();
    expect(state.tabs).toHaveLength(1);
    expect(state.tabs[0]?.id).toBe(emptyTabId);
    expect(state.tabs[0]?.kind).toBe('file');
    expect((state.tabs[0] as FileEditorTab).file.path).toBe('docs/first.md');
    expect(state.activeTabId).toBe(emptyTabId);
    let collection = owner.readCollection();
    expect(collection.tabs[0].content.kind).toBe('component');
    if (collection.tabs[0].content.kind !== 'component') throw new Error('expected component');
    expect(collection.tabs[0].content.component.targetKey).toBe('file:doc:docs/first.md');

    // Populated-tab selection appends (never overwrites).
    expect(openFileDocument({ file: fileInfo({ path: 'src/second.ts' }), disposition: 'current' })).toBe(true);
    await drainLane();
    state = fileState();
    expect(state.tabs).toHaveLength(2);
    expect(state.tabs.map((tab) => (tab.kind === 'file' ? tab.file.path : null)))
      .toEqual(['docs/first.md', 'src/second.ts']);
    expect(state.activeTabId).toBe(state.tabs[1]?.id);

    // Exact re-open of an open file centers it (no duplicate).
    expect(openFileDocument({ file: fileInfo({ path: 'docs/first.md' }), disposition: 'current' })).toBe(true);
    await drainLane();
    state = fileState();
    expect(state.tabs).toHaveLength(2);
    expect(state.activeTabId).toBe(state.tabs[0]?.id);

    // Explicit Open in New Tab (`new`) appends for a non-open file.
    expect(openFileDocument({ file: fileInfo({ path: 'notes/third.md' }), disposition: 'new' })).toBe(true);
    await drainLane();
    state = fileState();
    expect(state.tabs).toHaveLength(3);
    expect(state.tabs[2]?.kind).toBe('file');

    // The established activity persisted every tab, in order, with the
    // active selection.
    const persisted = activity();
    expect(persisted?.tabs.map((tab) => tab.path)).toEqual([
      'docs/first.md',
      'src/second.ts',
      'notes/third.md',
    ]);
    expect(persisted?.activeTabId).toBe(`file-viewer:notes/third.md`);

    // Autocomplete effects intact: open-tab candidates registered for
    // autocomplete-eligible paths (markdown paths are excluded by the
    // established file-link filter, legacy behavior unchanged).
    const candidates = useChatFileLinkStore.getState().autocompleteCandidates;
    expect(candidates.some((candidate) => candidate.path === 'src/second.ts' && candidate.source === 'open-tab')).toBe(true);
    expect(candidates.some((candidate) => candidate.path === 'docs/first.md')).toBe(false);
    expect(candidates.some((candidate) => candidate.path === 'notes/third.md')).toBe(false);
  });

  test('picker flow (VRT-011A): file.open reserves the exact tab, reveal expands the drawer, selection prepares + places in one lane turn', async () => {
    const { owner } = mountRuntime();
    await owner.ensureInitial({ kind: 'empty' });
    await drainLane();
    const tabId = fileState().activeTabId!;

    // The reveal effect expands the existing file-tree drawer.
    usePanelStore.getState().setViewState('file-viewer', { collapsed: { leftSidebar: false, leftChat: false, rightCol: true, contentArea: false } });
    await owner.launchInTab(tabId, 'file.open');
    await drainLane();

    let collection = owner.readCollection();
    expect(collection.reservations).toHaveLength(1);
    expect(collection.reservations[0].tabId).toBe(tabId);
    expect(collection.reservations[0].launcherId).toBe('file.open');
    expect(collection.reservations[0].status).toBe('pending');
    const picker = owner.pickerCurrent();
    expect(picker?.tabId).toBe(tabId);
    expect(usePanelStore.getState().viewStates['file-viewer']?.collapsed.rightCol).toBe(false);

    // Selecting a file carries the reservation identity through preparation
    // (release + activate THAT exact tab) and TABS-03 current in one turn.
    expect(openFileDocument({ file: fileInfo({ path: 'docs/first.md' }), disposition: 'current' })).toBe(true);
    await drainLane();

    const state = fileState();
    expect(state.tabs).toHaveLength(1);
    expect(state.tabs[0]?.id).toBe(tabId);
    expect((state.tabs[0] as FileEditorTab).file.path).toBe('docs/first.md');
    collection = owner.readCollection();
    expect(collection.reservations).toEqual([]);
    expect(owner.pickerCurrent()).toBeNull();
    expect(collection.activeTabId).toBe(tabId);
  });

  test('picker singleton: a second file.open in another Empty tab cancels the prior reservation and binds the new one', async () => {
    const { owner } = mountRuntime();
    await owner.ensureInitial({ kind: 'empty' });
    await drainLane();
    const firstTabId = fileState().activeTabId!;
    await owner.launchInTab(firstTabId, 'file.open');
    await drainLane();
    expect(owner.pickerCurrent()?.tabId).toBe(firstTabId);

    // Plus creates/activates exactly one more Empty tab; launching there
    // atomically cancels the prior reservation.
    const secondTabId = owner.createEmptyTab();
    expect(secondTabId).toBeTruthy();
    await drainLane();
    await owner.launchInTab(secondTabId!, 'file.open');
    await drainLane();

    let collection = owner.readCollection();
    expect(collection.tabs).toHaveLength(2);
    expect(collection.reservations).toHaveLength(1);
    expect(collection.reservations[0].tabId).toBe(secondTabId);
    expect(owner.pickerCurrent()?.tabId).toBe(secondTabId);

    // Drawer close retires the exact context and reservation (SPEC-02 §5).
    owner.clearPickerContext();
    await drainLane();
    collection = owner.readCollection();
    expect(collection.reservations).toEqual([]);
    expect(owner.pickerCurrent()).toBeNull();
    // Ordinary focus changes never clear a fresh context.
    await owner.launchInTab(secondTabId!, 'file.open');
    await drainLane();
    await owner.activateTab(firstTabId);
    await drainLane();
    expect(owner.pickerCurrent()?.tabId).toBe(secondTabId);
  });

  test('stale picker preparation is a bounded no-op (stale_completion, no state change)', async () => {
    const { owner } = mountRuntime();
    await owner.ensureInitial({ kind: 'empty' });
    await drainLane();
    const tabId = fileState().activeTabId!;
    await owner.launchInTab(tabId, 'file.open');
    await drainLane();
    const identity = owner.pickerCurrent()!;
    expect(identity).not.toBeNull();

    // Cancel through the owner: the identity is no longer preparable.
    await owner.cancelTab(tabId);
    await drainLane();
    const before = owner.readCollection();
    expect(await owner.preparePickerSelection(identity)).toBe('stale_completion');
    const after = owner.readCollection();
    expect(after).toEqual(before);
    expect(after.tabs[0].content.kind).toBe('empty');
  });

  test('plus creates and activates exactly one Empty tab; never a file, folder, or launcher invocation', async () => {
    const { owner } = mountRuntime();
    await owner.ensureInitial({ kind: 'empty' });
    await drainLane();
    await owner.createEmptyTab();
    await drainLane();
    const state = fileState();
    expect(state.tabs).toHaveLength(2);
    expect(state.tabs.every((tab) => tab.kind === 'empty')).toBe(true);
    const collection = owner.readCollection();
    expect(collection.reservations).toEqual([]);
    expect(collection.activeTabId).toBe(state.activeTabId);
    expect(state.activeTabId).toBe(state.tabs[1]?.id);
  });

  test('post-close: the established empty collection reinitializes only through the owner lifecycle (no render loop, no re-arm)', async () => {
    const { owner } = mountRuntime();
    await owner.ensureInitial({ kind: 'empty' });
    await drainLane();
    const tabId = fileState().activeTabId!;
    await owner.runIntent((turn) => { turn.closeTab(tabId); });
    await drainLane();

    expect(fileState().tabs).toHaveLength(0);
    expect(fileState().viewMode).toBe('tree');
    const persisted = activity();
    expect(persisted?.tabs).toEqual([]);
    expect(persisted?.activeTabId).toBeNull();

    // The one-shot initial policy does not re-arm on the mounted runtime.
    await owner.ensureInitial({ kind: 'empty' });
    await drainLane();
    expect(fileState().tabs).toHaveLength(0);

    // Re-entry happens through the owner's explicit established lifecycle:
    // the public file-open lane appends via TABS-03 (no empty tab recreated).
    expect(openFileDocument({ file: fileInfo({ path: 'docs/first.md' }), disposition: 'current' })).toBe(true);
    await drainLane();
    expect(fileState().tabs).toHaveLength(1);
    expect(fileState().tabs[0]?.kind).toBe('file');
  });

  test('workspace-switch stale work cannot land: placement refuses when the owner is no longer current', async () => {
    const { owner } = mountRuntime();
    await owner.ensureInitial({ kind: 'empty' });
    await drainLane();
    const before = owner.readCollection();

    usePanelStore.setState({ activeWorkspaceId: 'ws-other' });
    expect(isFileConnectedActive()).toBe(false);
    expect(openFileDocument({ file: fileInfo({ path: 'docs/first.md' }), disposition: 'new' })).toBe(false);
    usePanelStore.setState({ activeWorkspaceId: 'ws-slice4' });

    expect(owner.readCollection()).toEqual(before);
  });

  test('retired competition: the public file-open action routes through TABS-03, not the legacy local match/fill/append', async () => {
    const { owner } = mountRuntime();
    await owner.ensureInitial({ kind: 'empty' });
    await drainLane();
    // Populate the active tab so the legacy path would REORDER the existing
    // tab to the front; TABS-03 appends instead.
    expect(openFileDocument({ file: fileInfo({ path: 'docs/first.md' }), disposition: 'current' })).toBe(true);
    await drainLane();
    expect(openFileDocument({ file: fileInfo({ path: 'src/second.ts' }), disposition: 'current' })).toBe(true);
    await drainLane();
    let state = fileState();
    expect(state.tabs.map((tab) => (tab.kind === 'file' ? tab.file.path : null)))
      .toEqual(['docs/first.md', 'src/second.ts']);

    // Re-selecting the first file through the public path centers it without
    // reordering and without a duplicate (TABS-03 exact-match activation).
    const { loadFileContent } = await import('../src/lib/file-tree');
    loadFileContent(fileInfo({ path: 'docs/first.md' }));
    await drainLane();
    state = fileState();
    expect(state.tabs).toHaveLength(2);
    expect(state.tabs.map((tab) => (tab.kind === 'file' ? tab.file.path : null)))
      .toEqual(['docs/first.md', 'src/second.ts']);
    expect(state.activeTabId).toBe(state.tabs[0]?.id);
    expect(owner.readCollection().activeTabId).toBe(state.activeTabId);
  });

  test('pending-file close protection preserves the legacy behavior at the model seam', () => {
    const collection = {
      tabs: [
        { tabId: 'tab-1', content: {
          kind: 'component' as const,
          revision: 1,
          component: {
            schemaVersion: 1 as const,
            componentTypeId: FILE_DOCUMENT_PRESENTER_ID,
            componentInstanceId: 'instance-1',
            input: {
              title: 'first.md',
              locationLabels: ['Files', 'docs', 'first.md'],
              icon: 'description',
              path: 'docs/first.md',
              name: 'first.md',
              extension: 'md',
            },
            targetKey: fileDocumentTargetKey('docs/first.md'),
          },
        } },
      ],
      activeTabId: 'tab-1',
      reservations: [],
    };
    const model = {
      panelId: FILE_VIEWER_PANEL_ID,
      label: 'Open files',
      tabs: [
        { id: 'tab-1', label: 'first.md', icon: 'description', closeLabel: 'Close first.md', closable: true },
      ],
      activeId: 'tab-1',
      tabPanelTabIndex: -1 as const,
      onActivate: () => undefined,
      onClose: () => undefined,
    } as unknown as ViewTabAdapterModel;

    // No in-flight request: the model passes through untouched.
    const untouched = protectFileModelForPendingClose(model, collection, new Map());
    expect(untouched).toBe(model);

    // In-flight request: the close affordance is disabled and close refuses.
    const pending = new Map([['file-viewer:docs/first.md', {}]]);
    let closed = false;
    const closableModel = { ...model, onClose: () => { closed = true; } };
    const wrapped = protectFileModelForPendingClose(closableModel, collection, pending);
    expect(wrapped).not.toBe(closableModel);
    expect(wrapped.tabs[0].closeDisabled).toBe(true);
    wrapped.onClose('tab-1');
    expect(closed).toBe(false);

    // Once the request settles, close delegates to the owner again.
    const settled = protectFileModelForPendingClose(closableModel, collection, new Map());
    expect(settled).toBe(closableModel);
    settled.onClose('tab-1');
    expect(closed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Canonical path + target-key helpers (bounded, fail-closed)
// ---------------------------------------------------------------------------

test.describe('VIEW-02 Slice 4 — canonical path discipline', () => {
  test('canonical file paths never change a valid resource path but reject unsafe shapes', () => {
    expect(canonicalFilePath('docs/first.md')).toBe('docs/first.md');
    expect(canonicalFilePath('docs//nested/../first.md')).toBeNull();
    expect(canonicalFilePath('/absolute.md')).toBeNull();
    expect(canonicalFilePath('')).toBeNull();
    expect(canonicalFilePath(null)).toBeNull();
    expect(fileDocumentTargetKey('docs/first.md')).toBe('file:doc:docs/first.md');
    expect(FILE_VIEWER_TARGET_KEY_PREFIX).toBe('file:doc:');
  });
});
