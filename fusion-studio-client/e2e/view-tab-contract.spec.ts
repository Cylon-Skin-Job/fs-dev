import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import {
  emptyCaptureTabUi,
  classicGridProjectionFor,
  legacyProjectionFor,
  normalizeCaptureTabs,
  snapshotTab,
  tabProjection,
} from '../src/components/view-tabs/captureTabDomain';
import {
  activateCaptureTab,
  backOutOfCaptureDocument,
  closeCaptureTab,
  getCaptureHandoffStatus,
  normalizeHydratedCaptureTabs,
  openDocumentInCaptureTabs,
  updateCaptureTabUi,
} from '../src/components/view-tabs/captureTabsController';
import { usePanelStore } from '../src/state/panelStore';
import { useFileStore } from '../src/state/fileStore';
import { DEFAULT_VIEW_UI_STATE } from '../src/state/slices/viewSlice';
import type { DocViewerTab, WebSocketMessage } from '../src/types';
import { nextWorkspaceRequestId } from '../src/lib/workspaceResponseTracker';
import { hasPendingViewStateMutation } from '../src/lib/viewStateMutationTracker';

function read(relativePath: string) {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

class ControlledAckSocket extends EventTarget {
  readonly readyState = WebSocket.OPEN;
  readonly sent: Array<{
    type: string;
    view: string;
    state: Record<string, unknown>;
    clientMutationId: number;
  }> = [];

  send(payload: string) {
    this.sent.push(JSON.parse(payload) as ControlledAckSocket['sent'][number]);
  }

  respond(index: number, type: 'state:result' | 'state:error') {
    const request = this.sent[index];
    if (!request) throw new Error(`No request at index ${index}`);
    this.dispatchEvent(new MessageEvent('message', {
      data: JSON.stringify({
        type,
        view: request.view,
        clientMutationId: request.clientMutationId,
        ...(type === 'state:error' ? { message: 'injected failure' } : {}),
      }),
    }));
  }
}

class ThrowOnceSocket extends ControlledAckSocket {
  private shouldThrow = true;
  readonly listenerBalance: Record<string, number> = {};

  override addEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject | null,
    options?: AddEventListenerOptions | boolean,
  ) {
    this.listenerBalance[type] = (this.listenerBalance[type] ?? 0) + 1;
    super.addEventListener(type, callback, options);
  }

  override removeEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject | null,
    options?: EventListenerOptions | boolean,
  ) {
    this.listenerBalance[type] = Math.max(0, (this.listenerBalance[type] ?? 0) - 1);
    super.removeEventListener(type, callback, options);
  }

  override send(payload: string) {
    if (this.shouldThrow) {
      this.shouldThrow = false;
      throw new Error('injected synchronous send failure');
    }
    super.send(payload);
  }
}

const handoffDocument: DocViewerTab = {
  id: 'doc-a',
  kind: 'doc',
  path: '001-Captures/note.md',
  name: 'note.md',
  extension: 'md',
  ui: emptyCaptureTabUi(),
};
const handoffCapture: DocViewerTab = {
  id: 'capture-a',
  kind: 'capture',
  ui: emptyCaptureTabUi('recent'),
};

function installControllerBrowserGlobals() {
  const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const documentDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const cssDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'CSS');
  let fallbackFocusCount = 0;
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      location: { host: '127.0.0.1:3001' },
      setTimeout: globalThis.setTimeout,
      clearTimeout: globalThis.clearTimeout,
      requestAnimationFrame: (callback: FrameRequestCallback) => {
        callback(0);
        return 1;
      },
    },
  });
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      querySelector: () => ({ focus: () => { fallbackFocusCount += 1; } }),
    },
  });
  Object.defineProperty(globalThis, 'CSS', {
    configurable: true,
    value: { escape: (value: string) => value },
  });
  return {
    fallbackFocusCount: () => fallbackFocusCount,
    restore: () => {
      if (windowDescriptor) Object.defineProperty(globalThis, 'window', windowDescriptor);
      else Reflect.deleteProperty(globalThis, 'window');
      if (documentDescriptor) Object.defineProperty(globalThis, 'document', documentDescriptor);
      else Reflect.deleteProperty(globalThis, 'document');
      if (cssDescriptor) Object.defineProperty(globalThis, 'CSS', cssDescriptor);
      else Reflect.deleteProperty(globalThis, 'CSS');
    },
  };
}

test('Capture normalization validates, migrates, deduplicates, and remaps active identity', () => {
  const normalized = normalizeCaptureTabs([
    null,
    { id: '', kind: 'doc', path: '001-Captures/no.md' },
    { id: 'unsafe', kind: 'doc', path: '../outside.md' },
    {
      id: 'doc-a',
      kind: 'doc',
      path: '001-Captures/note.md',
      ui: { mode: 'archive', gridScroll: 27, docScroll: Number.POSITIVE_INFINITY },
    },
    { id: 'doc-duplicate', kind: 'doc', path: '001-Captures//note.md' },
    { id: 'capture-a', kind: 'capture', ui: { mode: 'recent' } },
    { id: 'capture-duplicate', kind: 'capture' },
    { id: 'unknown', kind: 'view', panelId: 'wiki-viewer' },
  ], 'doc-duplicate');

  expect(normalized.tabs.map((tab) => tab.id)).toEqual(['doc-a', 'capture-a']);
  expect(normalized.activeId).toBe('doc-a');
  const documentTab = normalized.tabs[0];
  expect(documentTab.kind).toBe('doc');
  if (documentTab.kind !== 'doc') throw new Error('expected document survivor');
  expect(documentTab.ui.mode).toBe('archive');
  expect(documentTab.ui.byMode.archive).toMatchObject({
    selectedPath: '001-Captures/note.md',
    gridScroll: 27,
    docScroll: 0,
  });
  expect(normalizeCaptureTabs('corrupt', 'missing')).toEqual({ tabs: [], activeId: null });
});

test('Capture tab snapshots preserve both mode buckets and keep fullscreen RAM-only', () => {
  const tab = snapshotTab({
    id: 'doc-a',
    kind: 'doc',
    path: '001-Captures/note.md',
    name: 'stale-name',
    extension: 'txt',
    ui: emptyCaptureTabUi(),
  }, {
    docViewerMode: 'archive',
    docViewerLastOpenedPath: '001-Captures/note.md',
    docViewerActiveSelectedPath: '001-Captures/active.md',
    docViewerArchiveSelectedPath: '999-Archive/note.md',
    docViewerActiveGridScroll: 12,
    docViewerActiveDocScroll: 34,
    docViewerArchiveGridScroll: 56,
    docViewerArchiveDocScroll: 78,
  });

  expect(tab.kind).toBe('doc');
  if (tab.kind !== 'doc') throw new Error('expected document tab');
  expect(tab.path).toBe('999-Archive/note.md');
  expect(tab.name).toBe('note.md');
  expect(tab.ui.byMode.active).toEqual({
    selectedPath: '001-Captures/active.md',
    gridScroll: 12,
    docScroll: 34,
  });
  expect(tab.ui.byMode.archive).toEqual({
    selectedPath: '999-Archive/note.md',
    gridScroll: 56,
    docScroll: 78,
  });
  expect(tabProjection(tab)).toMatchObject({
    docViewerMode: 'archive',
    docViewerFullPage: true,
    docViewerArchiveDocScroll: 78,
  });
  expect(legacyProjectionFor(tab)).not.toHaveProperty('docViewerFullPage');
  expect(classicGridProjectionFor(tab)).toMatchObject({
    docViewerActiveSelectedPath: '001-Captures/active.md',
    docViewerArchiveSelectedPath: null,
    docViewerLastOpenedPath: '001-Captures/note.md',
  });
});

test('shared tab DOM implements the complete manual-activation keyboard and focus contract', () => {
  const strip = read('src/components/view-tabs/ViewTabStrip.tsx');
  const host = read('src/components/view-tabs/ViewTabBar.tsx');
  const content = read('src/components/ContentArea.tsx');

  for (const key of ['ArrowLeft', 'ArrowRight', 'Home', 'End', 'Enter', "' '", 'Delete']) {
    expect(strip).toContain(key);
  }
  expect(strip).toContain("aria-keyshortcuts={tab.closable ? 'Delete' : undefined}");
  expect(strip).toContain('aria-orientation="horizontal"');
  expect(strip).toMatch(/<div className="rv-view-tab-list" role="tablist"[^>]*>[\s\S]*<\/div>\s*\{add \? \(/);
  expect(strip).toContain('aria-selected={selected}');
  expect(strip).toContain('aria-controls={viewTabPanelDomId(panelId)}');
  expect(strip).toContain('role="presentation"');
  expect(strip).toMatch(/<\/button>\s*\{tab\.closable \? \(\s*<button/s);
  expect(strip).toContain('tabIndex={roving ? 0 : -1}');
  expect(strip).toContain('onFocus={() => setRovingId(tab.id)}');
  expect(strip).toContain('const [railFocused, setRailFocused] = useState(false)');
  expect(strip).toContain('CSS.escape(panelId)');
  expect(strip).toContain('.active .rv-content-area');
  expect(host).toContain('role="tabpanel"');
  expect(host).toContain("mode === 'single'");
  expect(host).toContain('viewTabSingleIdentityDomId(adapter.panelId, adapter.activeId)');
  expect(host).toContain('viewTabDomId(adapter.panelId, adapter.activeId)');
  expect(host).toContain('aria-labelledby={activeDescriptor ? panelLabelId : undefined}');
  expect(host).toContain("aria-label={activeDescriptor ? undefined : 'Content unavailable'}");
  expect(host).toContain('tabIndex={adapter.tabPanelTabIndex}');
  expect(content).toContain('tabIndex={-1}');
  expect(content.match(/<ViewTabBar\s+panel=/g)).toHaveLength(1);
});

test('Capture persistence has one tab-key chokepoint and ordered acknowledged handoff', () => {
  const controller = read('src/components/view-tabs/captureTabsController.ts');
  const hook = read('src/hooks/useDocViewerState.ts');
  const tiles = read('src/components/capture/CaptureTiles.tsx');
  expect(controller.match(/type: 'state:set'/g)).toHaveLength(1);
  expect(controller).toContain('if (!isCurrentOperationContext(context)) return false');
  expect(controller).toContain('const pendingScrollByWorkspace = new Map');
  expect(controller).toContain('const handoffByWorkspace = new Map');
  expect(controller).toContain("active ? tabProjection(active) : { docViewerFullPage: false }");
  const legacyPhase = controller.indexOf('await persistedStateResult(context, legacyProjection,');
  const clearPhase = controller.indexOf('{ docViewerTabs: [], docViewerActiveTabId: null }', legacyPhase);
  expect(legacyPhase).toBeGreaterThan(-1);
  expect(clearPhase).toBeGreaterThan(legacyPhase);
  expect(controller).toContain('window.setTimeout(() =>');
  expect(controller).toContain('}, 100);');
  expect(controller).toContain('cancelPendingScrollPersistence();');
  expect(controller).not.toContain('commitTabs([survivor], survivor.id)');
  expect(tiles).toContain("captureHandoffStatus !== 'failed'");
  expect(tiles).toContain('aria-busy="true"');
  const adapters = read('src/components/view-tabs/viewTabAdapters.ts');
  expect(adapters).toContain("handoffStatus === 'failed'");
  expect(adapters).toContain('recoveryVisible ? undefined');
  expect(hook).toContain("if (updateCaptureTabUi(patch, { throttled: true })) return;");
  expect(hook).toContain('persistClassicScrollPatch(patch);');
});

test('Capture deferred persistence is isolated to its originating workspace', async () => {
  const originalState = usePanelStore.getState();
  const browserGlobals = installControllerBrowserGlobals();
  const socket = new ControlledAckSocket();
  const workspaceBDocument: DocViewerTab = {
    ...handoffDocument,
    id: 'workspace-b-doc',
    path: '001-Captures/workspace-b.md',
    name: 'workspace-b.md',
  };
  const workspaceAState = {
    ...DEFAULT_VIEW_UI_STATE,
    docViewerTabs: [handoffDocument, handoffCapture],
    docViewerActiveTabId: handoffDocument.id,
    docViewerActiveSelectedPath: handoffDocument.path,
    docViewerLastOpenedPath: handoffDocument.path,
    docViewerFullPage: true,
  };
  const workspaceBState = {
    ...DEFAULT_VIEW_UI_STATE,
    docViewerTabs: [workspaceBDocument],
    docViewerActiveTabId: workspaceBDocument.id,
    docViewerActiveSelectedPath: workspaceBDocument.path,
    docViewerLastOpenedPath: workspaceBDocument.path,
    docViewerFullPage: true,
  };
  const stateSets = () => socket.sent.filter((request) => request.type === 'state:set');
  const { handleMessage } = await import('../src/lib/ws-client');

  try {
    usePanelStore.setState({
      activeWorkspaceId: 'workspace-a',
      workspaceState: {},
      ws: socket as unknown as WebSocket,
      currentPanel: 'capture-viewer',
      panelConfigs: [],
      panelRoots: {},
      viewStates: { 'capture-viewer': workspaceAState },
    });
    usePanelStore.getState().seedWorkspaceState('workspace-b', {
      currentPanel: 'capture-viewer',
      viewStates: {},
    });

    closeCaptureTab(handoffDocument.id);
    expect(getCaptureHandoffStatus()).toBe('pending');
    expect(stateSets()).toHaveLength(1);
    const staleStateLoadRequestId = nextWorkspaceRequestId('state:get', 'workspace-a');
    const stalePartialStateRequestId = nextWorkspaceRequestId('state:get', 'workspace-a');
    const staleFileRequestId = nextWorkspaceRequestId('file:delete', 'workspace-a');

    usePanelStore.getState().activateWorkspace('workspace-b');
    expect(getCaptureHandoffStatus()).toBe('idle');
    await new Promise((resolve) => globalThis.setTimeout(resolve, 0));
    expect(hasPendingViewStateMutation('capture-viewer', 'workspace-a')).toBe(false);
    expect(usePanelStore.getState().viewStates['capture-viewer']).toBeUndefined();

    handleMessage({
      type: 'state:result',
      view: 'capture-viewer',
      requestId: staleStateLoadRequestId,
      workspaceId: 'workspace-a',
      state: workspaceAState,
    } as unknown as WebSocketMessage);
    handleMessage({
      type: 'file:deleted',
      requestId: staleFileRequestId,
      workspaceId: 'workspace-a',
      sourcePanel: 'capture-viewer',
      sourcePath: handoffDocument.path,
      sourceIsDirectory: false,
    } as unknown as WebSocketMessage);
    handleMessage({
      type: 'state:result',
      view: 'capture-viewer',
      requestId: stalePartialStateRequestId,
      state: workspaceAState,
    } as unknown as WebSocketMessage);
    handleMessage({
      type: 'file:deleted',
      workspaceId: 'workspace-a',
      sourcePanel: 'capture-viewer',
      sourcePath: handoffDocument.path,
      sourceIsDirectory: false,
    } as unknown as WebSocketMessage);
    expect(usePanelStore.getState().viewStates['capture-viewer']).toBeUndefined();
    expect(stateSets()).toHaveLength(1);

    const staleRequest = stateSets()[0];
    socket.respond(socket.sent.indexOf(staleRequest), 'state:result');
    handleMessage({
      type: 'state:result',
      view: 'capture-viewer',
      clientMutationId: staleRequest.clientMutationId,
      state: {
        ...workspaceAState,
        docViewerTabs: [handoffCapture],
        docViewerActiveTabId: handoffCapture.id,
      },
    } as unknown as WebSocketMessage);
    await new Promise((resolve) => globalThis.setTimeout(resolve, 0));
    expect(stateSets()).toHaveLength(1);
    expect(usePanelStore.getState().viewStates['capture-viewer']).toBeUndefined();

    usePanelStore.getState().activateWorkspace('workspace-a');
    expect(getCaptureHandoffStatus()).toBe('failed');
    expect(usePanelStore.getState().viewStates['capture-viewer']).toMatchObject({
      docViewerTabs: [handoffDocument, handoffCapture],
      docViewerActiveTabId: handoffDocument.id,
    });
    await expect.poll(() => activateCaptureTab(handoffCapture.id)).toBe(handoffCapture.id);
    const recoveryRequest = stateSets().at(-1)!;
    handleMessage({
      type: 'state:result',
      view: 'capture-viewer',
      clientMutationId: recoveryRequest.clientMutationId,
      state: usePanelStore.getState().viewStates['capture-viewer'],
    } as unknown as WebSocketMessage);

    socket.sent.length = 0;
    usePanelStore.setState({
      activeWorkspaceId: 'workspace-a',
      workspaceState: {},
      currentPanel: 'capture-viewer',
      panelConfigs: [],
      panelRoots: {},
      viewStates: { 'capture-viewer': {
        ...workspaceAState,
        docViewerTabs: [handoffDocument, {
          ...handoffDocument,
          id: 'workspace-a-second',
          path: '001-Captures/workspace-a-second.md',
          name: 'workspace-a-second.md',
        }],
      } },
    });
    usePanelStore.getState().seedWorkspaceState('workspace-b', {
      currentPanel: 'capture-viewer',
      viewStates: { 'capture-viewer': workspaceBState },
    });

    expect(updateCaptureTabUi({ docViewerActiveDocScroll: 777 }, { throttled: true })).toBe(true);
    usePanelStore.getState().activateWorkspace('workspace-b');
    await new Promise((resolve) => globalThis.setTimeout(resolve, 150));
    expect(stateSets()).toHaveLength(0);
    expect(usePanelStore.getState().viewStates['capture-viewer']).toEqual(workspaceBState);
    const cachedWorkspaceA = usePanelStore.getState().workspaceState['workspace-a'];
    expect(cachedWorkspaceA.viewStates['capture-viewer']).toMatchObject({
      docViewerActiveDocScroll: 777,
    });
    expect(cachedWorkspaceA.viewStates['capture-viewer'].docViewerTabs?.[0].ui.byMode.active.docScroll).toBe(777);
  } finally {
    usePanelStore.setState(originalState, true);
    browserGlobals.restore();
  }
});

test('lost Capture acknowledgement is abandoned before reconnect hydration', async () => {
  const originalState = usePanelStore.getState();
  const browserGlobals = installControllerBrowserGlobals();
  const firstSocket = new ControlledAckSocket();
  const replacementSocket = new ControlledAckSocket();
  const { abandonWsResponseTracking, handleMessage } = await import('../src/lib/ws-client');
  const hydratedState = {
    ...DEFAULT_VIEW_UI_STATE,
    docViewerMode: 'archive' as const,
    docViewerTabs: [handoffDocument],
    docViewerActiveTabId: handoffDocument.id,
    docViewerArchiveSelectedPath: handoffDocument.path,
  };

  try {
    usePanelStore.setState({
      activeWorkspaceId: 'workspace-a',
      workspaceState: {},
      ws: firstSocket as unknown as WebSocket,
      currentPanel: 'capture-viewer',
      panelConfigs: [],
      panelRoots: {},
      viewStates: { 'capture-viewer': {
        ...DEFAULT_VIEW_UI_STATE,
        docViewerTabs: [handoffDocument, handoffCapture],
        docViewerActiveTabId: handoffDocument.id,
        docViewerActiveSelectedPath: handoffDocument.path,
        docViewerFullPage: true,
      } },
    });
    usePanelStore.getState().loadViewState('capture-viewer');
    const abandonedLoad = firstSocket.sent[0] as unknown as { requestId: string };

    closeCaptureTab(handoffDocument.id);
    const abandonedMutation = firstSocket.sent[1];
    expect(getCaptureHandoffStatus()).toBe('pending');
    expect(hasPendingViewStateMutation('capture-viewer', 'workspace-a')).toBe(true);

    firstSocket.dispatchEvent(new Event('close'));
    abandonWsResponseTracking();
    await expect.poll(() => getCaptureHandoffStatus()).toBe('failed');
    expect(hasPendingViewStateMutation('capture-viewer', 'workspace-a')).toBe(false);

    usePanelStore.setState({ ws: replacementSocket as unknown as WebSocket });
    usePanelStore.getState().loadViewState('capture-viewer');
    const reconnectLoad = replacementSocket.sent[0] as unknown as { requestId: string };
    handleMessage({
      type: 'state:result',
      view: 'capture-viewer',
      requestId: reconnectLoad.requestId,
      workspaceId: 'workspace-a',
      state: hydratedState,
    } as unknown as WebSocketMessage);
    expect(usePanelStore.getState().viewStates['capture-viewer']).toMatchObject({
      docViewerMode: 'archive',
      docViewerTabs: [handoffDocument],
      docViewerActiveTabId: handoffDocument.id,
    });

    handleMessage({
      type: 'state:result',
      view: 'capture-viewer',
      requestId: abandonedLoad.requestId,
      workspaceId: 'workspace-a',
      state: { ...DEFAULT_VIEW_UI_STATE, docViewerMode: 'active' },
    } as unknown as WebSocketMessage);
    handleMessage({
      type: 'state:result',
      view: 'capture-viewer',
      clientMutationId: abandonedMutation.clientMutationId,
      state: { ...DEFAULT_VIEW_UI_STATE, docViewerTabs: [] },
    } as unknown as WebSocketMessage);
    expect(usePanelStore.getState().viewStates['capture-viewer']).toMatchObject({
      docViewerMode: 'archive',
      docViewerTabs: [handoffDocument],
      docViewerActiveTabId: handoffDocument.id,
    });
  } finally {
    abandonWsResponseTracking();
    usePanelStore.setState(originalState, true);
    browserGlobals.restore();
  }
});

test('synchronous Capture send failure cleans tracking before authoritative reload', async () => {
  const originalState = usePanelStore.getState();
  const browserGlobals = installControllerBrowserGlobals();
  const socket = new ThrowOnceSocket();
  const { abandonWsResponseTracking, handleMessage } = await import('../src/lib/ws-client');

  try {
    usePanelStore.setState({
      activeWorkspaceId: 'workspace-a',
      workspaceState: {},
      ws: socket as unknown as WebSocket,
      currentPanel: 'capture-viewer',
      panelConfigs: [],
      panelRoots: {},
      viewStates: { 'capture-viewer': {
        ...DEFAULT_VIEW_UI_STATE,
        docViewerTabs: [handoffDocument, handoffCapture],
        docViewerActiveTabId: handoffDocument.id,
        docViewerActiveSelectedPath: handoffDocument.path,
        docViewerFullPage: true,
      } },
    });

    closeCaptureTab(handoffDocument.id);
    await expect.poll(() => getCaptureHandoffStatus()).toBe('failed');
    expect(hasPendingViewStateMutation('capture-viewer', 'workspace-a')).toBe(false);
    expect(socket.listenerBalance.message).toBe(0);
    expect(socket.listenerBalance.close).toBe(0);

    usePanelStore.getState().loadViewState('capture-viewer');
    const reload = socket.sent[0] as unknown as { requestId: string };
    handleMessage({
      type: 'state:result',
      view: 'capture-viewer',
      requestId: reload.requestId,
      workspaceId: 'workspace-a',
      state: { ...DEFAULT_VIEW_UI_STATE, docViewerMode: 'archive' },
    } as unknown as WebSocketMessage);
    expect(usePanelStore.getState().viewStates['capture-viewer'].docViewerMode).toBe('archive');
  } finally {
    abandonWsResponseTracking();
    usePanelStore.setState(originalState, true);
    browserGlobals.restore();
  }
});

test('File home drawer persistence cannot project an A acknowledgement into B', async () => {
  const originalPanelState = usePanelStore.getState();
  const originalFileState = useFileStore.getState();
  const browserGlobals = installControllerBrowserGlobals();
  const socket = new ControlledAckSocket();
  const fileTab = {
    kind: 'file' as const,
    file: { path: 'docs/a.md', name: 'a.md', extension: 'md', isDirectory: false },
    content: '# A',
    size: 3,
    loading: false,
  };
  const { handleMessage } = await import('../src/lib/ws-client');

  try {
    usePanelStore.setState({
      activeWorkspaceId: 'workspace-a',
      workspaceState: {},
      ws: socket as unknown as WebSocket,
      currentPanel: 'file-viewer',
      panelConfigs: [],
      panelRoots: {},
      viewStates: { 'file-viewer': {
        ...DEFAULT_VIEW_UI_STATE,
        collapsed: { ...DEFAULT_VIEW_UI_STATE.collapsed, rightCol: true },
      } },
    });
    usePanelStore.getState().seedWorkspaceState('workspace-b', {
      currentPanel: 'file-viewer',
      viewStates: {},
    });
    useFileStore.setState({
      tabs: [fileTab],
      activeTabPath: fileTab.file.path,
      viewMode: 'viewer',
    });

    const homeId = useFileStore.getState().openViewHomeTab();
    expect(homeId).toBe('file-view-home');
    if (usePanelStore.getState().viewStates['file-viewer'].collapsed.rightCol) {
      usePanelStore.getState().toggleCollapsed('file-viewer', 'rightCol');
    }
    expect(socket.sent).toHaveLength(1);
    expect(socket.sent[0]).toMatchObject({
      type: 'state:set',
      view: 'file-viewer',
      state: { collapsed: { rightCol: false } },
      clientMutationId: expect.any(Number),
    });

    const pending = socket.sent[0];
    usePanelStore.getState().activateWorkspace('workspace-b');
    expect(usePanelStore.getState().viewStates['file-viewer']).toBeUndefined();
    handleMessage({
      type: 'state:result',
      view: 'file-viewer',
      clientMutationId: pending.clientMutationId,
      state: {
        ...DEFAULT_VIEW_UI_STATE,
        collapsed: { ...DEFAULT_VIEW_UI_STATE.collapsed, rightCol: false },
      },
    } as unknown as WebSocketMessage);
    expect(usePanelStore.getState().viewStates['file-viewer']).toBeUndefined();
  } finally {
    useFileStore.setState(originalFileState, true);
    usePanelStore.setState(originalPanelState, true);
    browserGlobals.restore();
  }
});

test('a delayed state load cannot overwrite a newer acknowledged mutation', async () => {
  const originalPanelState = usePanelStore.getState();
  const browserGlobals = installControllerBrowserGlobals();
  const socket = new ControlledAckSocket();
  const { handleMessage } = await import('../src/lib/ws-client');
  const originalViewState = {
    ...DEFAULT_VIEW_UI_STATE,
    collapsed: { ...DEFAULT_VIEW_UI_STATE.collapsed, rightCol: true },
  };
  const newerViewState = {
    ...originalViewState,
    collapsed: { ...originalViewState.collapsed, rightCol: false },
  };

  try {
    usePanelStore.setState({
      activeWorkspaceId: 'workspace-a',
      workspaceState: {},
      ws: socket as unknown as WebSocket,
      currentPanel: 'file-viewer',
      panelConfigs: [],
      panelRoots: {},
      viewStates: { 'file-viewer': originalViewState },
    });
    usePanelStore.getState().loadViewState('file-viewer');
    const loadRequest = socket.sent[0] as unknown as { requestId: string };
    usePanelStore.getState().setViewState('file-viewer', newerViewState);
    usePanelStore.getState()._persistViewPatch('file-viewer', {
      collapsed: newerViewState.collapsed,
    });
    const mutationRequest = socket.sent[1];

    handleMessage({
      type: 'state:result',
      view: 'file-viewer',
      clientMutationId: mutationRequest.clientMutationId,
      state: newerViewState,
    } as unknown as WebSocketMessage);
    expect(usePanelStore.getState().viewStates['file-viewer'].collapsed.rightCol).toBe(false);

    handleMessage({
      type: 'state:result',
      view: 'file-viewer',
      requestId: loadRequest.requestId,
      workspaceId: 'workspace-a',
      state: originalViewState,
    } as unknown as WebSocketMessage);
    expect(usePanelStore.getState().viewStates['file-viewer'].collapsed.rightCol).toBe(false);
  } finally {
    usePanelStore.setState(originalPanelState, true);
    browserGlobals.restore();
  }
});

test('fully uncorrelated legacy state frames remain current-workspace compatible', async () => {
  const originalPanelState = usePanelStore.getState();
  const browserGlobals = installControllerBrowserGlobals();
  const { handleMessage } = await import('../src/lib/ws-client');

  try {
    usePanelStore.setState({
      activeWorkspaceId: 'workspace-a',
      workspaceState: {},
      currentPanel: 'file-viewer',
      panelConfigs: [],
      panelRoots: {},
      viewStates: { 'file-viewer': DEFAULT_VIEW_UI_STATE },
    });
    handleMessage({
      type: 'state:result',
      view: 'file-viewer',
      state: {
        ...DEFAULT_VIEW_UI_STATE,
        collapsed: { ...DEFAULT_VIEW_UI_STATE.collapsed, rightCol: true },
      },
    } as unknown as WebSocketMessage);
    expect(usePanelStore.getState().viewStates['file-viewer'].collapsed.rightCol).toBe(true);

  } finally {
    usePanelStore.setState(originalPanelState, true);
    browserGlobals.restore();
  }
});

test('classic Back clears the open preview before record-free ownership', async () => {
  const originalState = usePanelStore.getState();
  const browserGlobals = installControllerBrowserGlobals();
  const socket = new ControlledAckSocket();
  usePanelStore.setState((state) => ({
    ws: socket as unknown as WebSocket,
    viewStates: {
      ...state.viewStates,
      'capture-viewer': {
        ...DEFAULT_VIEW_UI_STATE,
        docViewerTabs: [handoffDocument],
        docViewerActiveTabId: handoffDocument.id,
        docViewerActiveSelectedPath: handoffDocument.path,
        docViewerLastOpenedPath: handoffDocument.path,
        docViewerFullPage: true,
      },
    },
  }));

  try {
    backOutOfCaptureDocument();
    expect(getCaptureHandoffStatus()).toBe('pending');
    expect(socket.sent[0].state).toMatchObject({
      docViewerActiveSelectedPath: null,
      docViewerLastOpenedPath: handoffDocument.path,
    });
    expect(usePanelStore.getState().viewStates['capture-viewer'].docViewerTabs).toEqual([handoffDocument]);

    socket.respond(0, 'state:result');
    await expect.poll(() => socket.sent.length).toBe(2);
    expect(socket.sent[1].state).toEqual({ docViewerTabs: [], docViewerActiveTabId: null });
    socket.respond(1, 'state:result');
    await expect.poll(() => getCaptureHandoffStatus()).toBe('idle');
    expect(usePanelStore.getState().viewStates['capture-viewer']).toMatchObject({
      docViewerTabs: [],
      docViewerActiveTabId: null,
      docViewerActiveSelectedPath: null,
      docViewerLastOpenedPath: handoffDocument.path,
      docViewerFullPage: false,
    });
  } finally {
    usePanelStore.setState(originalState, true);
    browserGlobals.restore();
  }
});

test('Capture handoff keeps the tab owner until both acknowledgements and survives failure', async () => {
  const originalWs = usePanelStore.getState().ws;
  const originalViewStates = usePanelStore.getState().viewStates;
  const originalConsoleError = console.error;
  const browserGlobals = installControllerBrowserGlobals();
  const setHandoffState = (socket: ControlledAckSocket) => {
    usePanelStore.setState((state) => ({
      ws: socket as unknown as WebSocket,
      viewStates: {
        ...state.viewStates,
        'capture-viewer': {
          ...DEFAULT_VIEW_UI_STATE,
          docViewerTabs: [handoffDocument, handoffCapture],
          docViewerActiveTabId: handoffDocument.id,
          docViewerActiveSelectedPath: handoffDocument.path,
          docViewerLastOpenedPath: handoffDocument.path,
          docViewerFullPage: true,
        },
      },
    }));
  };

  try {
    const successSocket = new ControlledAckSocket();
    setHandoffState(successSocket);
    closeCaptureTab(handoffDocument.id);
    expect(getCaptureHandoffStatus()).toBe('pending');
    expect(successSocket.sent).toHaveLength(1);
    expect(successSocket.sent[0].state).toMatchObject({ docViewerMode: 'recent' });
    expect(successSocket.sent[0].state.docViewerActiveSelectedPath).toBeNull();
    expect(usePanelStore.getState().viewStates['capture-viewer'].docViewerTabs).toHaveLength(2);

    successSocket.respond(0, 'state:result');
    await expect.poll(() => successSocket.sent.length).toBe(2);
    expect(successSocket.sent[1].state).toEqual({
      docViewerTabs: [],
      docViewerActiveTabId: null,
    });
    expect(usePanelStore.getState().viewStates['capture-viewer'].docViewerTabs).toHaveLength(2);

    successSocket.respond(1, 'state:result');
    await expect.poll(() => getCaptureHandoffStatus()).toBe('idle');
    expect(usePanelStore.getState().viewStates['capture-viewer'].docViewerTabs).toEqual([]);
    expect(browserGlobals.fallbackFocusCount()).toBe(1);

    const hydrationSocket = new ControlledAckSocket();
    usePanelStore.setState((state) => ({
      ws: hydrationSocket as unknown as WebSocket,
      viewStates: {
        ...state.viewStates,
        'capture-viewer': {
          ...DEFAULT_VIEW_UI_STATE,
          docViewerTabs: [handoffCapture],
          docViewerActiveTabId: handoffCapture.id,
        },
      },
    }));
    normalizeHydratedCaptureTabs();
    expect(getCaptureHandoffStatus()).toBe('pending');
    expect(usePanelStore.getState().viewStates['capture-viewer'].docViewerTabs).toHaveLength(1);
    hydrationSocket.respond(0, 'state:result');
    await expect.poll(() => hydrationSocket.sent.length).toBe(2);
    expect(usePanelStore.getState().viewStates['capture-viewer'].docViewerTabs).toHaveLength(1);
    hydrationSocket.respond(1, 'state:result');
    await expect.poll(() => getCaptureHandoffStatus()).toBe('idle');
    expect(usePanelStore.getState().viewStates['capture-viewer'].docViewerTabs).toEqual([]);
    expect(browserGlobals.fallbackFocusCount()).toBe(2);

    console.error = () => undefined;

    const clearFailureSocket = new ControlledAckSocket();
    setHandoffState(clearFailureSocket);
    closeCaptureTab(handoffDocument.id);
    clearFailureSocket.respond(0, 'state:result');
    await expect.poll(() => clearFailureSocket.sent.length).toBe(2);
    clearFailureSocket.respond(1, 'state:error');
    await expect.poll(() => getCaptureHandoffStatus()).toBe('failed');
    expect(clearFailureSocket.sent).toHaveLength(2);
    expect(usePanelStore.getState().viewStates['capture-viewer'].docViewerTabs).toHaveLength(2);
    expect(usePanelStore.getState().viewStates['capture-viewer'].docViewerActiveTabId).toBe(handoffDocument.id);
    expect(browserGlobals.fallbackFocusCount()).toBe(2);

    const projectionFailureSocket = new ControlledAckSocket();
    setHandoffState(projectionFailureSocket);
    closeCaptureTab(handoffDocument.id);
    projectionFailureSocket.respond(0, 'state:error');
    await expect.poll(() => getCaptureHandoffStatus()).toBe('failed');
    expect(projectionFailureSocket.sent).toHaveLength(1);
    expect(usePanelStore.getState().viewStates['capture-viewer'].docViewerTabs).toHaveLength(2);
    expect(usePanelStore.getState().viewStates['capture-viewer'].docViewerActiveTabId).toBe(handoffDocument.id);
    expect(browserGlobals.fallbackFocusCount()).toBe(2);

    const hydrationFailureSocket = new ControlledAckSocket();
    usePanelStore.setState((state) => ({
      ws: hydrationFailureSocket as unknown as WebSocket,
      viewStates: {
        ...state.viewStates,
        'capture-viewer': {
          ...DEFAULT_VIEW_UI_STATE,
          docViewerTabs: [handoffCapture],
          docViewerActiveTabId: handoffCapture.id,
        },
      },
    }));
    normalizeHydratedCaptureTabs();
    hydrationFailureSocket.respond(0, 'state:error');
    await expect.poll(() => getCaptureHandoffStatus()).toBe('failed');
    expect(usePanelStore.getState().viewStates['capture-viewer'].docViewerTabs).toEqual([handoffCapture]);

    expect(openDocumentInCaptureTabs({
      folder: '001-Captures',
      path: '001-Captures/recovered.md',
      name: 'recovered.md',
    })).toBe(true);
    expect(getCaptureHandoffStatus()).toBe('idle');
    expect(usePanelStore.getState().viewStates['capture-viewer']).toMatchObject({
      docViewerActiveTabId: handoffCapture.id,
      docViewerFullPage: true,
      docViewerTabs: [{ id: handoffCapture.id, kind: 'doc', path: '001-Captures/recovered.md' }],
    });

    const recoverySocket = new ControlledAckSocket();
    usePanelStore.setState((state) => ({
      ws: recoverySocket as unknown as WebSocket,
      viewStates: {
        ...state.viewStates,
        'capture-viewer': {
          ...DEFAULT_VIEW_UI_STATE,
          docViewerTabs: [handoffCapture],
          docViewerActiveTabId: handoffCapture.id,
        },
      },
    }));
    normalizeHydratedCaptureTabs();
    recoverySocket.respond(0, 'state:error');
    await expect.poll(() => getCaptureHandoffStatus()).toBe('failed');
    const requestsBeforeRetry = recoverySocket.sent.length;
    closeCaptureTab(handoffCapture.id);
    expect(getCaptureHandoffStatus()).toBe('pending');
    expect(usePanelStore.getState().viewStates['capture-viewer'].docViewerTabs).toEqual([handoffCapture]);
    expect(recoverySocket.sent[requestsBeforeRetry].state).toEqual({
      docViewerTabs: [handoffCapture],
      docViewerActiveTabId: handoffCapture.id,
    });
    recoverySocket.respond(requestsBeforeRetry, 'state:result');
    await expect.poll(() => recoverySocket.sent.length).toBe(requestsBeforeRetry + 2);
    recoverySocket.respond(requestsBeforeRetry + 1, 'state:result');
    await expect.poll(() => recoverySocket.sent.length).toBe(requestsBeforeRetry + 3);
    recoverySocket.respond(requestsBeforeRetry + 2, 'state:result');
    await expect.poll(() => getCaptureHandoffStatus()).toBe('idle');
    expect(usePanelStore.getState().viewStates['capture-viewer'].docViewerTabs).toEqual([]);
    expect(browserGlobals.fallbackFocusCount()).toBe(3);
  } finally {
    console.error = originalConsoleError;
    usePanelStore.setState({ ws: originalWs, viewStates: originalViewStates });
    browserGlobals.restore();
  }
});

test('Capture controller round-trips independent mode buckets across tab switches', () => {
  const originalWs = usePanelStore.getState().ws;
  const originalViewStates = usePanelStore.getState().viewStates;
  const socket = new ControlledAckSocket();
  const secondDocument: DocViewerTab = {
    ...handoffDocument,
    id: 'doc-b',
    path: '001-Captures/second.md',
    name: 'second.md',
  };
  usePanelStore.setState((state) => ({
    ws: socket as unknown as WebSocket,
    viewStates: {
      ...state.viewStates,
      'capture-viewer': {
        ...DEFAULT_VIEW_UI_STATE,
        docViewerTabs: [handoffDocument, secondDocument],
        docViewerActiveTabId: handoffDocument.id,
        docViewerMode: 'active',
        docViewerActiveSelectedPath: handoffDocument.path,
        docViewerActiveGridScroll: 11,
        docViewerActiveDocScroll: 22,
      },
    },
  }));

  try {
    expect(updateCaptureTabUi({
      docViewerActiveGridScroll: 111,
      docViewerActiveDocScroll: 222,
    })).toBe(true);
    expect(activateCaptureTab(secondDocument.id)).toBe(secondDocument.id);
    expect(updateCaptureTabUi({
      docViewerMode: 'archive',
      docViewerArchiveSelectedPath: '999-Archive/second.md',
      docViewerArchiveGridScroll: 333,
      docViewerArchiveDocScroll: 444,
    })).toBe(true);
    expect(activateCaptureTab(handoffDocument.id)).toBe(handoffDocument.id);

    const persisted = socket.sent.at(-1)?.state.docViewerTabs;
    const roundTrip = normalizeCaptureTabs(JSON.parse(JSON.stringify(persisted)), handoffDocument.id);
    const first = roundTrip.tabs.find((tab) => tab.id === handoffDocument.id);
    const second = roundTrip.tabs.find((tab) => tab.id === secondDocument.id);
    expect(first?.ui.byMode.active).toMatchObject({ gridScroll: 111, docScroll: 222 });
    expect(second?.ui).toMatchObject({
      mode: 'archive',
      byMode: { archive: { selectedPath: '999-Archive/second.md', gridScroll: 333, docScroll: 444 } },
    });
    expect(usePanelStore.getState().viewStates['capture-viewer']).toMatchObject({
      docViewerMode: 'active',
      docViewerActiveGridScroll: 111,
      docViewerActiveDocScroll: 222,
    });
  } finally {
    usePanelStore.setState({ ws: originalWs, viewStates: originalViewStates });
  }
});

test('shared rail owns interaction tokens and no consumer owns tab selectors', () => {
  const css = read('src/components/view-tabs/ViewTabBar.css');
  const variables = read('src/styles/variables.css');
  expect(css).not.toMatch(/--view-tab-rail-bg\s*:/);
  expect(css).toContain('--interactive-surface-bg: var(--view-tab-rail-bg');
  expect(variables).toContain('--view-tab-rail-bg: var(--panel-chrome-bg)');
  expect(css).toContain('var(--workspace-foreground-color');
  expect(css).toContain('92%, var(--interactive-contrast-foreground');
  expect(css).toContain('88%, var(--interactive-contrast-foreground');
  expect(css).toContain('84%, var(--interactive-contrast-foreground');
  expect(css).toContain('var(--interactive-focus-ring');
  expect(css.match(/\.rv-view-tab-(?:close|add):active[\s\S]*?color: var\(--interactive-contrast-foreground/g)).toHaveLength(2);
  expect(css).not.toContain('accent-color');

  const consumerCss = [
    '../ai/RC-MacAir-15/System/styles/file-viewer.css',
    '../ai/RC-MacAir-15/Views/002-file-viewer/styles/layout.css',
    'src/styles/document.css',
    'src/components/capture/CaptureTiles.css',
  ].map(read).join('\n');
  expect(consumerCss).not.toMatch(/rv-(?:file|capture)-viewer-tab|rv-file-viewer-tabs|rv-capture-tab-strip/);
});

test('page-level path actions use one floating pair while item actions remain local', () => {
  const edgePanel = read('src/components/wiki/EdgePanel.tsx');
  const migrated = [
    'src/components/capture/FilePageView.tsx',
    'src/components/office/OfficeDocumentTopbar.tsx',
    'src/components/email/EmailDocumentTopbar.tsx',
    'src/components/office/OfficeGrid.tsx',
    'src/components/email/EmailGrid.tsx',
    'src/components/agents/AgentTiles.tsx',
    'src/components/wiki/EdgePanel.tsx',
  ].map(read).join('\n');
  expect(migrated).not.toContain("from '../CopyPathButton'");
  expect(migrated).not.toContain("from '../SendToChatButton'");
  expect(migrated.match(/<FloatingPathActions/g)?.length).toBeGreaterThanOrEqual(7);
  expect(edgePanel).toContain('const viewedPagePath = useWikiStore((s) => s.viewedPagePath)');
  expect(edgePanel).toMatch(/\{viewedPagePath \? \([\s\S]*?relativePath=\{viewedPagePath\}/);
  expect(edgePanel).not.toContain('relativePath={viewedPath}');

  for (const itemSurface of [
    'src/components/file-explorer/FolderNode.tsx',
    'src/components/file-explorer/FileNode.tsx',
    'src/components/wiki/TopicList.tsx',
  ]) {
    const source = read(itemSurface);
    expect(source).toContain('CopyPathButton');
    expect(source).toContain('SendToChatButton');
  }
  expect(read('../ai/RC-MacAir-15/System/styles/views.css')).not.toContain('.rv-file-page-actions');
  expect(read('src/components/office/OfficeGrid.css')).not.toContain('.rv-office-folder-actions');
  expect(read('src/components/email/EmailGrid.css')).not.toContain('.rv-email-folder-actions');
});
