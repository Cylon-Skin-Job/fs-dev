import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

import { parseTabPolicyProjection } from '../src/lib/tab-policy-projection';
import { readyTabPolicyFor } from '../src/components/view-tabs/componentTabConnectedAdapter';
import {
  parseCaptureTabRecordsDocument,
  captureTabRecordsDocument,
  createCaptureConnectedOwnerPorts,
  createCaptureHomeLauncherBinding,
  describeCaptureComponent,
  CAPTURE_TAB_RECORDS_FIELD,
} from '../src/components/view-tabs/captureConnectedOwnerPorts';
import {
  classicProjectionFromViewState,
  planCaptureClassicConversion,
} from '../src/components/view-tabs/captureClassicConversion';
import {
  applyCaptureClassicConversionOnce,
  isCaptureConnectedActive,
  openCaptureDocument,
  persistCaptureDocumentScroll,
  removeCaptureConnectedPathReferences,
  rewriteCaptureConnectedPathReferences,
  capturePostCloseEstablished,
  setActiveCaptureConnectedRuntime,
} from '../src/components/view-tabs/captureConnectedTabs';
import { bindCatalogLaunchers, createConnectedTabOwner } from '../src/components/view-tabs/componentTabConnectedOwner';
import { createConnectedTabDescriber } from '../src/components/view-tabs/componentTabConnectedAdapter';
import { usePanelStore } from '../src/state/panelStore';
import type { ViewUIState } from '../src/types/view-state';
import type { ComponentTabCollectionState } from '../src/components/view-tabs/componentTabTypes';

// Node-side stubs for the runtime touchpoints (scroll timers, reveal focus).
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
  initial: { kind: 'launcher', launcherId: 'capture.home' },
  plus: { enabled: true },
  empty: {
    tabLabel: 'New Capture Tab',
    locationLabel: 'New Capture Tab',
    launcherIds: ['capture.home'],
  },
  location: { omitTerminalNames: [], historyControls: 'none' },
  // VIEW-02 §7 pinned Capture new-tab policy (server-normalized passthrough).
  newTab: { blankKind: 'home', autoOpenDrawer: false },
};

function repoFile(relative: string): string {
  return path.resolve(process.cwd(), '..', relative);
}

function emptyClassic(): Record<string, unknown> {
  return {
    docViewerTabs: [],
    docViewerActiveTabId: null,
  };
}

function minters() {
  let tabSequence = 0;
  let instanceSequence = 0;
  return {
    mintTabId: () => `tab-${tabSequence++}`,
    mintComponentInstanceId: () => `instance-${instanceSequence++}`,
  };
}

// ---------------------------------------------------------------------------
// Shipped configuration proof (SPEC-02 §4/§9)
// ---------------------------------------------------------------------------

test.describe('VIEW-02 Slice 3 — shipped Capture tab policy', () => {
  test('live and template content.json ship the identical, exact tabs object', () => {
    const livePath = repoFile('ai/RC-MacAir-15/System/Views/001-capture-viewer/content.json');
    const templatePath = repoFile(
      'System_Manager/ai-template/templates/view-templates/002-capture-viewer/content.json',
    );
    const liveBytes = fs.readFileSync(livePath);
    const templateBytes = fs.readFileSync(templatePath);
    expect(liveBytes.equals(templateBytes)).toBe(true);

    const live = JSON.parse(liveBytes.toString('utf8'));
    expect(live.tabs).toEqual(SHIPPED_TABS);
    expect(live.version).toBe(1);
  });

  test('the Slice-1 server parser projects exactly this config to a ready policy', () => {
    const wireEntry = tabPolicyServer.buildTabPolicyWireEntry(SHIPPED_TABS, 'capture-viewer');
    expect(wireEntry).toEqual({
      schemaVersion: 1,
      status: 'ready',
      policy: SHIPPED_TABS,
    });

    // The client wire parser + activation gate accept the same projection.
    const projection = parseTabPolicyProjection({ 'capture-viewer': wireEntry });
    expect(projection).not.toBeNull();
    const policy = readyTabPolicyFor(projection, 'capture-viewer');
    expect(policy).not.toBeNull();
    expect(policy?.initial).toEqual({ kind: 'launcher', launcherId: 'capture.home' });
    expect(policy?.empty).toEqual(SHIPPED_TABS.empty);
  });
});

// ---------------------------------------------------------------------------
// One-time classic-state conversion (SPEC-02 §6)
// ---------------------------------------------------------------------------

test.describe('VIEW-02 Slice 3 — classic-state conversion matrix', () => {
  const { mintTabId, mintComponentInstanceId } = minters();

  test('valid full-page state converts to ONE addressed document tab preserving path, mode, and scroll', () => {
    const classic = {
      ...emptyClassic(),
      docViewerFullPage: true,
      docViewerMode: 'archive' as const,
      docViewerArchiveSelectedPath: '999-Archive/note.md',
      docViewerArchiveDocScroll: 421,
      docViewerLastOpenedPath: '999-Archive/note.md',
    };
    const plan = planCaptureClassicConversion({
      records: null,
      classic: classicProjectionFromViewState(classic as Partial<ViewUIState>),
      mintTabId,
      mintComponentInstanceId,
    });
    expect(plan.kind).toBe('convert');
    if (plan.kind !== 'convert') return;
    expect(plan.collection.tabs).toHaveLength(1);
    const content = plan.collection.tabs[0].content;
    expect(content.kind).toBe('component');
    if (content.kind !== 'component') return;
    expect(content.component.componentTypeId).toBe('capture.document');
    expect(content.component.targetKey).toBe('capture:doc:999-Archive/note.md');
    expect(content.component.input).toMatchObject({
      title: 'note.md',
      path: '999-Archive/note.md',
      mode: 'archive',
      docScroll: 421,
      lastOpenedPath: '999-Archive/note.md',
    });
    expect(plan.collection.activeTabId).toBe(plan.collection.tabs[0].tabId);
    // The full-page mode is now expressed by the connected tab, not classic.
    expect(plan.classicReset).toMatchObject({
      docViewerTabs: [],
      docViewerActiveTabId: null,
      docViewerFullPage: false,
    });
  });

  test('landing/preview state with any meaningful classic field converts to ONE capture.home tab preserving the projection', () => {
    const classic = {
      ...emptyClassic(),
      docViewerMode: 'recent' as const,
      docViewerActiveSelectedPath: '001-Captures/note.md',
      docViewerActiveGridScroll: 88,
    };
    const plan = planCaptureClassicConversion({
      records: null,
      classic: classicProjectionFromViewState(classic as Partial<ViewUIState>),
      mintTabId,
      mintComponentInstanceId,
    });
    expect(plan.kind).toBe('convert');
    if (plan.kind !== 'convert') return;
    const content = plan.collection.tabs[0].content;
    expect(content.kind).toBe('component');
    if (content.kind !== 'component') return;
    expect(content.component.componentTypeId).toBe('capture.landing');
    expect(content.component.targetKey).toBe('capture:home');
    expect(content.component.input).toMatchObject({
      title: 'CAPTURE',
      classic: { mode: 'recent', selectedPath: '001-Captures/note.md', gridScroll: 88 },
    });
    expect(plan.classicReset).toEqual({ docViewerTabs: [], docViewerActiveTabId: null });
  });

  test('a nonzero scroll alone is meaningful and converts; the default shape uses the initial policy', () => {
    const scrolled = planCaptureClassicConversion({
      records: null,
      classic: classicProjectionFromViewState({
        ...emptyClassic(),
        docViewerArchiveGridScroll: 240,
      } as Partial<ViewUIState>),
      mintTabId,
      mintComponentInstanceId,
    });
    expect(scrolled.kind).toBe('convert');

    const fresh = planCaptureClassicConversion({
      records: null,
      classic: classicProjectionFromViewState(emptyClassic() as Partial<ViewUIState>),
      mintTabId,
      mintComponentInstanceId,
    });
    expect(fresh.kind).toBe('default');
  });

  test('asserted full-page state WITHOUT a valid selected document is bounded unavailable', () => {
    const plan = planCaptureClassicConversion({
      records: null,
      classic: classicProjectionFromViewState({
        ...emptyClassic(),
        docViewerFullPage: true,
      } as Partial<ViewUIState>),
      mintTabId,
      mintComponentInstanceId,
    });
    expect(plan.kind).toBe('unavailable');
  });

  test('hydrated valid generic records win over classic conversion', () => {
    const records = parseCaptureTabRecordsDocument({
      schemaVersion: 1,
      tabs: [{ tabId: 'kept', content: { kind: 'empty', revision: 0 } }],
      activeTabId: 'kept',
      reservations: [],
    });
    const plan = planCaptureClassicConversion({
      records,
      classic: classicProjectionFromViewState({
        ...emptyClassic(),
        docViewerFullPage: true,
        docViewerActiveSelectedPath: '001-Captures/note.md',
      } as Partial<ViewUIState>),
      mintTabId,
      mintComponentInstanceId,
    });
    expect(plan.kind).toBe('hydrated');
  });

  test('legacy hydrated Capture tabs normalize ONCE with identity, selection, and scroll preserved', () => {
    const classic = {
      docViewerTabs: [
        {
          id: 'legacy-doc',
          kind: 'doc',
          path: '001-Captures/alpha.md',
          name: 'alpha.md',
          extension: 'md',
          ui: {
            mode: 'active',
            lastOpenedPath: '001-Captures/alpha.md',
            byMode: {
              active: { selectedPath: '001-Captures/alpha.md', gridScroll: 12, docScroll: 65 },
              archive: { selectedPath: null, gridScroll: 0, docScroll: 0 },
            },
          },
        },
        {
          id: 'legacy-home',
          kind: 'capture',
          ui: {
            mode: 'active',
            lastOpenedPath: null,
            byMode: {
              active: { selectedPath: null, gridScroll: 0, docScroll: 0 },
              archive: { selectedPath: null, gridScroll: 0, docScroll: 0 },
            },
          },
        },
      ],
      docViewerActiveTabId: 'legacy-home',
      docViewerFullPage: false,
    };
    const plan = planCaptureClassicConversion({
      records: null,
      classic: classicProjectionFromViewState(classic as unknown as Partial<ViewUIState>),
      mintTabId,
      mintComponentInstanceId,
    });
    expect(plan.kind).toBe('convert');
    if (plan.kind !== 'convert') return;
    expect(plan.collection.tabs).toHaveLength(2);
    const [doc, home] = plan.collection.tabs;
    expect(home.content.kind).toBe('component');
    if (home.content.kind !== 'component') throw new Error('expected home component');
    expect(home.content.component.targetKey).toBe('capture:home');
    expect(doc.content.kind).toBe('component');
    if (doc.content.kind !== 'component') throw new Error('expected doc component');
    expect(doc.content.component.targetKey).toBe('capture:doc:001-Captures/alpha.md');
    expect(doc.content.component.input).toMatchObject({ docScroll: 65 });
    // The active legacy tab was the home tab: the connected collection keeps it active.
    expect(plan.collection.activeTabId).toBe(home.tabId);
    expect(plan.classicReset).toMatchObject({
      docViewerTabs: [],
      docViewerActiveTabId: null,
      docViewerFullPage: false,
    });
  });
});

// ---------------------------------------------------------------------------
// Durable document parse/serialize (versioned field in the SAME state doc)
// ---------------------------------------------------------------------------

test.describe('VIEW-02 Slice 3 — captureTabRecords document contract', () => {
  test('parses a valid document into runtime records and serializes back', () => {
    const document = {
      schemaVersion: 1,
      tabs: [
        { tabId: 'a', content: { kind: 'empty', revision: 2 } },
      ],
      activeTabId: 'a',
      reservations: [],
    };
    const parsed = parseCaptureTabRecordsDocument(document);
    expect(parsed).toEqual({
      tabs: [{ tabId: 'a', content: { kind: 'empty', revision: 2 } }],
      activeTabId: 'a',
      reservations: [],
    });
    expect(captureTabRecordsDocument(parsed!)).toEqual(document);
  });

  test('fail-closed on malformed documents: wrong schema, bad records, dangling active id, bad reservations', () => {
    expect(parseCaptureTabRecordsDocument(null)).toBeNull();
    expect(parseCaptureTabRecordsDocument(undefined)).toBeNull();
    expect(parseCaptureTabRecordsDocument('nope')).toBeNull();
    expect(parseCaptureTabRecordsDocument({ schemaVersion: 2, tabs: [], activeTabId: null, reservations: [] })).toBeNull();
    expect(parseCaptureTabRecordsDocument({
      schemaVersion: 1,
      tabs: [{ tabId: 'a', content: { kind: 'banana' } }],
      activeTabId: null,
      reservations: [],
    })).toBeNull();
    expect(parseCaptureTabRecordsDocument({
      schemaVersion: 1,
      tabs: [{ tabId: 'a', content: { kind: 'empty', revision: 0 } }],
      activeTabId: 'ghost',
      reservations: [],
    })).toBeNull();
    expect(parseCaptureTabRecordsDocument({
      schemaVersion: 1,
      tabs: [{ tabId: 'a', content: { kind: 'empty', revision: 0 } }],
      activeTabId: 'a',
      reservations: [{ tabId: 'a', operationId: 'op', expectedRevision: 0, launcherId: 'capture.home', status: 'failed' }],
    })).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Connected owner ports + runtime integration (panelStore-bound, fake socket)
// ---------------------------------------------------------------------------

class FakeAckSocket extends EventTarget {
  readyState = 1; // OPEN
  readonly sent: Array<Record<string, unknown>> = [];
  send(payload: string) {
    this.sent.push(JSON.parse(payload) as Record<string, unknown>);
  }
}

test.describe('VIEW-02 Slice 3 — connected owner integration through the acknowledged owner', () => {
  let ws: FakeAckSocket;
  let runtime: ReturnType<typeof createConnectedTabOwner> | null = null;

  function seedViewState(patch: Partial<ViewUIState>) {
    usePanelStore.getState().setViewState('capture-viewer', patch);
  }

  function currentRecords(): ReturnType<typeof parseCaptureTabRecordsDocument> {
    const value = usePanelStore.getState()
      .viewStates['capture-viewer']?.[CAPTURE_TAB_RECORDS_FIELD as keyof ViewUIState];
    return parseCaptureTabRecordsDocument(value);
  }

  function mountRuntime() {
    const ports = createCaptureConnectedOwnerPorts({ workspaceId: 'ws-slice3' });
    const policy = parseTabPolicyProjection({
      'capture-viewer': { schemaVersion: 1, status: 'ready', policy: SHIPPED_TABS },
    });
    const readyPolicy = readyTabPolicyFor(policy, 'capture-viewer')!;
    const describer = createConnectedTabDescriber({
      policy: readyPolicy,
      viewIcon: 'note_stack',
      describeComponent: describeCaptureComponent,
    });
    const owner = createConnectedTabOwner({
      ...ports,
      describeTab: describer,
      launcherFor: (launcherId) => bindCatalogLaunchers([
        {
          launcherId: 'capture.home',
          binding: createCaptureHomeLauncherBinding(ports.mintComponentInstanceId),
        },
      ])(launcherId, 'capture-viewer'),
    });
    setActiveCaptureConnectedRuntime(owner, 'ws-slice3');
    return { owner, ports };
  }

  test.beforeEach(() => {
    ws = new FakeAckSocket();
    usePanelStore.setState({
      activeWorkspaceId: 'ws-slice3',
      ws: ws as unknown as WebSocket,
    });
    seedViewState({
      docViewerTabs: [],
      docViewerActiveTabId: null,
      docViewerFullPage: false,
      docViewerMode: 'active',
      docViewerActiveSelectedPath: null,
      docViewerArchiveSelectedPath: null,
      docViewerLastOpenedPath: null,
      captureTabRecords: null,
    } as Partial<ViewUIState>);
  });

  test.afterEach(() => {
    setActiveCaptureConnectedRuntime(null, null);
    runtime = null;
    usePanelStore.setState({
      viewStates: {
        ...usePanelStore.getState().viewStates,
        'capture-viewer': {} as ViewUIState,
      },
    });
  });

  /** Lets the serialized launch/fill lane drain before assertions. */
  async function drainLane() {
    await new Promise((resolve) => setTimeout(resolve, 30));
  }

  test('default shape initializes through the shipped launcher policy; commits ride the acknowledged owner', async () => {
    const mounted = mountRuntime();
    runtime = mounted.owner;
    // The default shape leaves conversion to the initial policy path.
    applyCaptureClassicConversionOnce(mounted.ports);
    await runtime.ensureInitial({ kind: 'launcher', launcherId: 'capture.home' });
    await drainLane();

    const records = currentRecords();
    expect(records?.tabs).toHaveLength(1);
    const content = records?.tabs[0].content;
    expect(content?.kind).toBe('component');
    if (content?.kind !== 'component') throw new Error('expected component');
    expect(content.component.componentTypeId).toBe('capture.landing');
    expect(content.component.targetKey).toBe('capture:home');
    expect(records?.activeTabId).toBe(records?.tabs[0].tabId);

    // Every owner write went through the acknowledged state:set path with a
    // clientMutationId and the whole versioned records document.
    const setStateFrames = ws.sent.filter((frame) => frame.type === 'state:set');
    expect(setStateFrames.length).toBeGreaterThanOrEqual(1);
    for (const frame of setStateFrames) {
      expect(frame.view).toBe('capture-viewer');
      expect(typeof frame.clientMutationId).toBe('number');
      expect(frame.state).toHaveProperty(CAPTURE_TAB_RECORDS_FIELD);
    }
  });

  test('placement through TABS-03: current appends when the active tab is populated; exact re-open activates; new appends; no overwrite', async () => {
    const mounted = mountRuntime();
    runtime = mounted.owner;
    await runtime.ensureInitial({ kind: 'launcher', launcherId: 'capture.home' });
    expect(isCaptureConnectedActive()).toBe(true);

    // Preview-style open (current): the active home tab is populated → append.
    expect(openCaptureDocument({ path: '001-Captures/alpha.md', name: 'alpha.md', disposition: 'current' })).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 30));
    let records = currentRecords();
    expect(records?.tabs).toHaveLength(2);
    expect(records?.activeTabId).toBe(records?.tabs[1].tabId);
    if (!records || records.tabs[1].content.kind !== 'component') throw new Error('expected doc tab');
    expect(records.tabs[1].content.component.targetKey).toBe('capture:doc:001-Captures/alpha.md');
    const docTabId = records.tabs[1].tabId;

    // Exact re-open of the open document: activate/reveal, never duplicate.
    expect(openCaptureDocument({ path: '001-Captures/alpha.md', name: 'alpha.md', disposition: 'new' })).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 30));
    records = currentRecords();
    expect(records?.tabs).toHaveLength(2);
    expect(records?.activeTabId).toBe(docTabId);

    // A different document through `new` appends a third tab.
    expect(openCaptureDocument({ path: '001-Captures/beta.md', name: 'beta.md', disposition: 'new' })).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 30));
    records = currentRecords();
    expect(records?.tabs).toHaveLength(3);
    expect(records?.tabs.map((tab) => (
      tab.content.kind === 'component' ? tab.content.component.targetKey : null
    ))).toEqual([
      'capture:home',
      'capture:doc:001-Captures/alpha.md',
      'capture:doc:001-Captures/beta.md',
    ]);
    // Populated tabs were never overwritten (the home tab content is intact).
    expect(records?.tabs[0].content.kind).toBe('component');
  });

  test('document scroll persistence rewrites the committed descriptor through the atomic acknowledged commit', async () => {
    const mounted = mountRuntime();
    runtime = mounted.owner;
    await runtime.ensureInitial({ kind: 'launcher', launcherId: 'capture.home' });
    openCaptureDocument({ path: '001-Captures/alpha.md', name: 'alpha.md', disposition: 'current' });
    await new Promise((resolve) => setTimeout(resolve, 30));
    const targetKey = 'capture:doc:001-Captures/alpha.md';

    persistCaptureDocumentScroll(targetKey, 333);
    await new Promise((resolve) => setTimeout(resolve, 160));

    const records = currentRecords();
    const doc = records?.tabs.find((tab) => (
      tab.content.kind === 'component'
      && tab.content.component.targetKey === targetKey
    ));
    expect(doc?.content.kind).toBe('component');
    if (doc?.content.kind !== 'component') throw new Error('expected component');
    expect(doc.content.component.input).toMatchObject({ docScroll: 333 });
  });

  test('file-identity rewrites update connected document tabs; deletes remove them with active remap', async () => {
    const mounted = mountRuntime();
    runtime = mounted.owner;
    await runtime.ensureInitial({ kind: 'launcher', launcherId: 'capture.home' });
    openCaptureDocument({ path: '001-Captures/alpha.md', name: 'alpha.md', disposition: 'current' });
    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(rewriteCaptureConnectedPathReferences({
      sourcePath: '001-Captures/alpha.md',
      targetPath: '001-Captures/alpha-renamed.md',
      includeDescendants: false,
    })).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 30));
    let records = currentRecords();
    expect(records?.tabs.map((tab) => (
      tab.content.kind === 'component' ? tab.content.component.targetKey : null
    ))).toEqual(['capture:home', 'capture:doc:001-Captures/alpha-renamed.md']);
    const renamed = records?.tabs[1];
    if (renamed?.content.kind !== 'component') throw new Error('expected component');
    expect(renamed.content.component.input).toMatchObject({ title: 'alpha-renamed.md' });

    expect(removeCaptureConnectedPathReferences({
      sourcePath: '001-Captures/alpha-renamed.md',
      includeDescendants: false,
    })).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 30));
    records = currentRecords();
    // The removed document was active: the home tab becomes active again.
    expect(records?.tabs).toHaveLength(1);
    expect(records?.activeTabId).toBe(records?.tabs[0].tabId);
  });

  test('workspace-switch stale work cannot land: placement refuses when the owner is no longer current', async () => {
    const mounted = mountRuntime();
    runtime = mounted.owner;
    await runtime.ensureInitial({ kind: 'launcher', launcherId: 'capture.home' });
    const before: ComponentTabCollectionState | null = currentRecords();

    usePanelStore.setState({ activeWorkspaceId: 'ws-other' });
    expect(isCaptureConnectedActive()).toBe(false);
    expect(openCaptureDocument({ path: '001-Captures/alpha.md', name: 'alpha.md', disposition: 'new' })).toBe(false);
    usePanelStore.setState({ activeWorkspaceId: 'ws-slice3' });

    // The prior state stayed intact and no cross-workspace tab landed.
    expect(currentRecords()).toEqual(before);
  });

  test('post-close guard: a closed-out collection does not reinitialize on restart (SPEC-02 §6)', async () => {
    const mounted = mountRuntime();
    runtime = mounted.owner;
    await runtime.ensureInitial({ kind: 'launcher', launcherId: 'capture.home' });
    const homeTabId = currentRecords()?.tabs[0].tabId;
    expect(homeTabId).toBeTruthy();

    // The user closes the last tab: the records document persists EMPTY.
    await runtime.runIntent((turn) => { turn.closeTab(homeTabId!); });
    const closed = currentRecords();
    expect(closed?.tabs).toHaveLength(0);
    expect(closed).not.toBeNull();

    // The adapter gate: the established post-close collection disables the
    // connected surface (and with it the initial-policy reinit).
    const viewState = usePanelStore.getState().viewStates['capture-viewer'];
    expect(capturePostCloseEstablished(viewState)).toBe(true);

    // Restart: conversion is a no-op and the adapter (gated above) never
    // calls ensureInitial — no tab is recreated.
    const restarted = mountRuntime();
    runtime = restarted.owner;
    applyCaptureClassicConversionOnce(restarted.ports);
    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(currentRecords()?.tabs).toHaveLength(0);
    // The empty document is still present (ownership established, not reset).
    expect(usePanelStore.getState().viewStates['capture-viewer']
      ?.[CAPTURE_TAB_RECORDS_FIELD as keyof ViewUIState]).not.toBeNull();
  });

  test('post-close predicate: hydrated tabs, absent field, or legacy tabs are not post-close', () => {
    expect(capturePostCloseEstablished({ captureTabRecords: null })).toBe(false);
    expect(capturePostCloseEstablished(undefined)).toBe(false);
    expect(capturePostCloseEstablished({
      captureTabRecords: {
        schemaVersion: 1,
        tabs: [{ tabId: 'a', content: { kind: 'empty', revision: 0 } }],
        activeTabId: 'a',
        reservations: [],
      },
    })).toBe(false);
    expect(capturePostCloseEstablished({
      captureTabRecords: { schemaVersion: 1, tabs: [], activeTabId: null, reservations: [] },
      docViewerTabs: [{ id: 'legacy', kind: 'capture', ui: { mode: 'active', lastOpenedPath: null, byMode: { active: { selectedPath: null, gridScroll: 0, docScroll: 0 }, archive: { selectedPath: null, gridScroll: 0, docScroll: 0 } } } }],
    })).toBe(false);
    expect(capturePostCloseEstablished({
      captureTabRecords: { schemaVersion: 1, tabs: [], activeTabId: null, reservations: [] },
    })).toBe(true);
  });

  test('post-close legacy lifecycle: classic tabs created after a close normalize once on restart', async () => {
    const mounted = mountRuntime();
    runtime = mounted.owner;
    await runtime.ensureInitial({ kind: 'launcher', launcherId: 'capture.home' });
    const homeTabId = currentRecords()?.tabs[0].tabId;
    await runtime.runIntent((turn) => { turn.closeTab(homeTabId!); });
    expect(currentRecords()?.tabs).toHaveLength(0);

    // The established classic lifecycle creates legacy tabs afterwards.
    seedViewState({
      docViewerTabs: [{
        id: 'post-close-doc',
        kind: 'doc',
        path: '001-Captures/late.md',
        name: 'late.md',
        extension: 'md',
        ui: {
          mode: 'active',
          lastOpenedPath: '001-Captures/late.md',
          byMode: {
            active: { selectedPath: '001-Captures/late.md', gridScroll: 0, docScroll: 42 },
            archive: { selectedPath: null, gridScroll: 0, docScroll: 0 },
          },
        },
      }],
      docViewerActiveTabId: 'post-close-doc',
    } as Partial<ViewUIState>);

    // Restart: the explicit legacy lifecycle normalizes ONCE into the records.
    const restarted = mountRuntime();
    runtime = restarted.owner;
    applyCaptureClassicConversionOnce(restarted.ports);
    const records = currentRecords();
    expect(records?.tabs).toHaveLength(1);
    expect(records?.tabs[0].content.kind).toBe('component');
    if (records?.tabs[0].content.kind !== 'component') throw new Error('expected component');
    expect(records.tabs[0].content.component.targetKey).toBe('capture:doc:001-Captures/late.md');
    expect(records.tabs[0].content.component.input).toMatchObject({ docScroll: 42 });
    expect(records.activeTabId).toBe(records.tabs[0].tabId);
    // The legacy shell fields cleared with the normalization.
    expect(usePanelStore.getState().viewStates['capture-viewer']?.docViewerTabs).toEqual([]);
  });

  test('VIEW-02 §9 hydration reconciliation: persisted classic tabs convert over the pre-hydration session blank; real records and lone sentinels still win', async () => {
    const mounted = mountRuntime();
    runtime = mounted.owner;
    const legacyTabs = [{
      id: 'legacy-doc',
      kind: 'doc',
      path: '001-Captures/late.md',
      name: 'late.md',
      extension: 'md',
      ui: {
        mode: 'active',
        lastOpenedPath: '001-Captures/late.md',
        byMode: {
          active: { selectedPath: '001-Captures/late.md', gridScroll: 0, docScroll: 42 },
          archive: { selectedPath: null, gridScroll: 0, docScroll: 0 },
        },
      },
    }];

    // The defect (handoff §2.3/§4): the initial policy created the session
    // blank BEFORE the persisted view state landed, and the one-time
    // conversion early-returned on it — the persisted classic tabs were
    // silently stranded (live state reset). The conversion must now treat the
    // blank-only records as the pre-hydration artifact and convert the
    // classic tabs over it. (seedViewState merges: the session blank records
    // survive while the persisted classic tabs land.)
    await runtime.ensureInitial({ kind: 'launcher', launcherId: 'capture.home' });
    expect(currentRecords()?.tabs).toHaveLength(1);
    seedViewState({
      docViewerTabs: legacyTabs,
      docViewerActiveTabId: 'legacy-doc',
    } as Partial<ViewUIState>);
    applyCaptureClassicConversionOnce(mounted.ports);
    const converted = currentRecords();
    expect(converted?.tabs).toHaveLength(1);
    if (converted?.tabs[0].content.kind !== 'component') throw new Error('expected component');
    expect(converted.tabs[0].content.component.targetKey).toBe('capture:doc:001-Captures/late.md');
    expect(converted.tabs[0].content.component.input).toMatchObject({ docScroll: 42 });
    // The artifact did not survive next to the converted tabs.
    expect(currentRecords()?.tabs.map((tab) => tab.content.kind)).toEqual(['component']);
    // The classic shell fields cleared with the conversion.
    expect(usePanelStore.getState().viewStates['capture-viewer']?.docViewerTabs).toEqual([]);

    // Hydrated REAL records still win: a document record is never replaced by
    // the classic conversion.
    seedViewState({
      docViewerTabs: legacyTabs,
      docViewerActiveTabId: 'legacy-doc',
      captureTabRecords: {
        schemaVersion: 1,
        tabs: [{
          tabId: 'real-doc',
          content: {
            kind: 'component',
            revision: 0,
            component: {
              schemaVersion: 1,
              componentTypeId: 'capture.document',
              componentInstanceId: 'instance-real',
              input: { title: 'real.md', locationLabels: ['Capture', 'Captures', 'real.md'] },
              targetKey: 'capture:doc:001-Captures/real.md',
            },
          },
        }],
        activeTabId: 'real-doc',
        reservations: [],
      },
    } as unknown as Partial<ViewUIState>);
    applyCaptureClassicConversionOnce(mounted.ports);
    const realRecords = currentRecords();
    expect(realRecords?.tabs.map((tab) => (
      tab.content.kind === 'component' ? tab.content.component.targetKey : null
    ))).toEqual(['capture:doc:001-Captures/real.md']);

    // A persisted lone blank sentinel with NO persisted classic tabs is never
    // eaten by the conversion.
    seedViewState({
      docViewerTabs: [],
      docViewerActiveTabId: null,
      captureTabRecords: {
        schemaVersion: 1,
        tabs: [{ tabId: 'sentinel', content: { kind: 'empty', revision: 0 } }],
        activeTabId: 'sentinel',
        reservations: [],
      },
    } as Partial<ViewUIState>);
    applyCaptureClassicConversionOnce(mounted.ports);
    expect(currentRecords()?.tabs.map((tab) => tab.content.kind)).toEqual(['empty']);
  });
});
