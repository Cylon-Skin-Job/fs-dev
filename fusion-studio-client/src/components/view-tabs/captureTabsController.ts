import { usePanelStore } from '../../state/panelStore';
import type { DocViewerTab, ViewUIState } from '../../types';
import {
  nextViewStateMutationId,
  settleViewStateMutation,
} from '../../lib/viewStateMutationTracker';
import {
  canonicalCapturePath,
  captureTabsEqual,
  classicGridProjectionFor,
  emptyCaptureTabUi,
  legacyProjectionFor,
  normalizeCaptureTabs,
  snapshotTab,
  tabProjection,
} from './captureTabDomain';

export const CAPTURE_PANEL = 'capture-viewer';
export const CAPTURE_TAB_LABEL = 'CAPTURE';

let sequence = 0;
type HandoffStatus = 'idle' | 'pending' | 'failed';

interface CaptureOperationContext {
  workspaceId: string | null;
  ws: WebSocket | null;
}

interface PendingScrollPersistence {
  context: CaptureOperationContext;
  tabs: DocViewerTab[];
  activeId: string | null;
  timer: number;
  unsubscribe: () => void;
}

interface CaptureHandoffOperation {
  context: CaptureOperationContext;
  promise: Promise<void>;
  abortController: AbortController;
  unsubscribe: () => void;
}

const pendingScrollByWorkspace = new Map<string, PendingScrollPersistence>();
const handoffByWorkspace = new Map<string, CaptureHandoffOperation>();
const handoffStatusByWorkspace = new Map<string, HandoffStatus>();
const handoffListeners = new Set<() => void>();

export function subscribeCaptureHandoff(listener: () => void): () => void {
  handoffListeners.add(listener);
  return () => handoffListeners.delete(listener);
}

function workspaceOperationKey(workspaceId: string | null): string {
  return workspaceId ?? '__capture-no-workspace__';
}

function currentOperationContext(): CaptureOperationContext {
  const state = usePanelStore.getState();
  return { workspaceId: state.activeWorkspaceId, ws: state.ws };
}

function isCurrentOperationContext(context: CaptureOperationContext): boolean {
  const state = usePanelStore.getState();
  return state.activeWorkspaceId === context.workspaceId && state.ws === context.ws;
}

function currentHandoffOperation(): CaptureHandoffOperation | undefined {
  return handoffByWorkspace.get(workspaceOperationKey(usePanelStore.getState().activeWorkspaceId));
}

export function getCaptureHandoffStatus(): HandoffStatus {
  const key = workspaceOperationKey(usePanelStore.getState().activeWorkspaceId);
  return handoffStatusByWorkspace.get(key) ?? 'idle';
}

function setCaptureHandoffStatus(context: CaptureOperationContext, status: HandoffStatus): void {
  const key = workspaceOperationKey(context.workspaceId);
  if ((handoffStatusByWorkspace.get(key) ?? 'idle') === status) return;
  if (status === 'idle') handoffStatusByWorkspace.delete(key);
  else handoffStatusByWorkspace.set(key, status);
  handoffListeners.forEach((listener) => listener());
}

function nextTabId(): string {
  const random = Math.random().toString(36).slice(2, 7);
  return `cvt-${Date.now().toString(36)}-${(sequence++).toString(36)}-${random}`;
}
function currentViewState(): Partial<ViewUIState> {
  return usePanelStore.getState().viewStates[CAPTURE_PANEL] ?? {};
}
function currentTabs() {
  const state = currentViewState();
  return normalizeCaptureTabs(state.docViewerTabs, state.docViewerActiveTabId);
}
function persistPatch(
  context: CaptureOperationContext,
  patch: Partial<ViewUIState>,
  suppliedMutationId?: number,
): boolean {
  if (!isCurrentOperationContext(context)) return false;
  const ws = context.ws;
  if (!ws || ws.readyState !== WebSocket.OPEN) return false;
  const clientMutationId = suppliedMutationId
    ?? nextViewStateMutationId(CAPTURE_PANEL, context.workspaceId);
  ws.send(JSON.stringify({
    type: 'state:set',
    view: CAPTURE_PANEL,
    state: patch,
    clientMutationId,
  }));
  return true;
}

function persistTabs(
  tabs: DocViewerTab[],
  activeId: string | null,
  context = currentOperationContext(),
): void {
  persistPatch(context, {
    docViewerTabs: tabs,
    docViewerActiveTabId: activeId,
  });
}

function cancelPendingScrollPersistence(context = currentOperationContext()): void {
  const key = workspaceOperationKey(context.workspaceId);
  const pending = pendingScrollByWorkspace.get(key);
  if (!pending) return;
  window.clearTimeout(pending.timer);
  pending.unsubscribe();
  pendingScrollByWorkspace.delete(key);
}

function commitTabs(tabs: DocViewerTab[], activeId: string | null): string | null {
  const context = currentOperationContext();
  cancelPendingScrollPersistence(context);
  if (getCaptureHandoffStatus() === 'failed') setCaptureHandoffStatus(context, 'idle');
  const normalized = normalizeCaptureTabs(tabs, activeId);
  const active = normalized.tabs.find((tab) => tab.id === normalized.activeId);
  usePanelStore.getState().setViewState(CAPTURE_PANEL, {
    docViewerTabs: normalized.tabs,
    docViewerActiveTabId: normalized.activeId,
    ...tabProjection(active),
  });
  persistTabs(normalized.tabs, normalized.activeId, context);
  return normalized.activeId;
}

function snapshotOutgoing(tabs: DocViewerTab[], activeId: string | null): DocViewerTab[] {
  const state = currentViewState();
  return tabs.map((tab) => tab.id === activeId ? snapshotTab(tab, state) : tab);
}

class CaptureWorkspaceChangedError extends Error {
  constructor() {
    super('Capture tab operation stopped because the active workspace changed');
  }
}

function persistedStateResult(
  context: CaptureOperationContext,
  patch: Partial<ViewUIState>,
  signal: AbortSignal,
): Promise<void> {
  const ws = context.ws;
  if (!isCurrentOperationContext(context)) {
    return Promise.reject(new CaptureWorkspaceChangedError());
  }
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    return Promise.reject(new Error('Capture tab state cannot persist while disconnected'));
  }
  const clientMutationId = nextViewStateMutationId(CAPTURE_PANEL, context.workspaceId);
  return new Promise((resolve, reject) => {
    let finished = false;
    const timeout = window.setTimeout(() => {
      finish(new Error('Capture tab state acknowledgement timed out'));
    }, 8_000);
    const finish = (error?: Error) => {
      if (finished) return;
      finished = true;
      window.clearTimeout(timeout);
      ws.removeEventListener('message', onMessage);
      ws.removeEventListener('close', onClose);
      signal.removeEventListener('abort', onAbort);
      settleViewStateMutation(clientMutationId);
      if (error) reject(error); else resolve();
    };
    const onAbort = () => finish(new CaptureWorkspaceChangedError());
    const onClose = () => finish(new Error('Capture tab state connection closed before acknowledgement'));
    const onMessage = (event: MessageEvent) => {
      try {
        const message = JSON.parse(String(event.data)) as Record<string, unknown>;
        if (message.view !== CAPTURE_PANEL || message.clientMutationId !== clientMutationId) return;
        if (message.type === 'state:result') finish();
        if (message.type === 'state:error') finish(new Error(String(message.message ?? 'Capture tab state write failed')));
      } catch {
        // Ignore unrelated non-JSON frames.
      }
    };
    ws.addEventListener('message', onMessage);
    ws.addEventListener('close', onClose, { once: true });
    signal.addEventListener('abort', onAbort, { once: true });
    try {
      if (!persistPatch(context, patch, clientMutationId)) {
        finish(new CaptureWorkspaceChangedError());
      }
    } catch (error) {
      finish(error instanceof Error ? error : new Error('Capture tab state write failed'));
    }
  });
}

async function handoffToClassic(
  survivor: DocViewerTab | null,
  options: {
    stageSurvivor?: boolean;
    legacyProjection?: Partial<ViewUIState>;
    clearCurrentSelection?: boolean;
  } = {},
): Promise<void> {
  const context = currentOperationContext();
  const key = workspaceOperationKey(context.workspaceId);
  const existing = handoffByWorkspace.get(key);
  if (existing) return existing.promise;
  cancelPendingScrollPersistence(context);
  const snapshot = survivor
    ? normalizeCaptureTabs([survivor], survivor.id).tabs[0] ?? null
    : null;
  if (survivor && !snapshot) return;
  const legacyProjection = options.legacyProjection
    ?? (snapshot
      ? (options.clearCurrentSelection
        ? classicGridProjectionFor(snapshot)
        : legacyProjectionFor(snapshot))
      : null);
  if (!legacyProjection) return;
  setCaptureHandoffStatus(context, 'pending');
  if (options.stageSurvivor && snapshot) {
    usePanelStore.getState().setViewState(CAPTURE_PANEL, {
      docViewerTabs: [snapshot],
      docViewerActiveTabId: snapshot.id,
      ...tabProjection(snapshot),
    });
  }
  const abortController = new AbortController();
  const unsubscribe = usePanelStore.subscribe(() => {
    if (!isCurrentOperationContext(context)) abortController.abort();
  });
  const operation: CaptureHandoffOperation = {
    context,
    abortController,
    unsubscribe,
    promise: Promise.resolve(),
  };
  operation.promise = (async () => {
    try {
      if (options.stageSurvivor && snapshot) {
        await persistedStateResult(
          context,
          { docViewerTabs: [snapshot], docViewerActiveTabId: snapshot.id },
          abortController.signal,
        );
      }
      await persistedStateResult(context, legacyProjection, abortController.signal);
      await persistedStateResult(
        context,
        { docViewerTabs: [], docViewerActiveTabId: null },
        abortController.signal,
      );
      if (!isCurrentOperationContext(context)) throw new CaptureWorkspaceChangedError();
      usePanelStore.getState().setViewState(CAPTURE_PANEL, {
        ...legacyProjection,
        docViewerFullPage: false,
        docViewerTabs: [],
        docViewerActiveTabId: null,
      });
      window.requestAnimationFrame(() => {
        if (!isCurrentOperationContext(context)) return;
        document.querySelector<HTMLElement>(
          `.rv-panel[data-panel="${CSS.escape(CAPTURE_PANEL)}"].active .rv-content-area`,
        )?.focus();
      });
      setCaptureHandoffStatus(context, 'idle');
    } catch (error) {
      // Keep the pre-transition durable record/UI authoritative on either-phase failure.
      setCaptureHandoffStatus(context, 'failed');
      if (!(error instanceof CaptureWorkspaceChangedError)) {
        console.error('[capture-tabs] classic ownership handoff failed', error);
      }
    } finally {
      unsubscribe();
      if (handoffByWorkspace.get(key) === operation) handoffByWorkspace.delete(key);
    }
  })();
  handoffByWorkspace.set(key, operation);
  return operation.promise;
}

export function isCaptureTabsLatched(tabs: unknown): boolean {
  return normalizeCaptureTabs(tabs, null).tabs.length >= 2;
}

export function normalizeHydratedCaptureTabs(): void {
  const state = currentViewState();
  const normalized = normalizeCaptureTabs(state.docViewerTabs, state.docViewerActiveTabId);
  const active = normalized.tabs.find((tab) => tab.id === normalized.activeId);
  const changed = !captureTabsEqual(state.docViewerTabs, state.docViewerActiveTabId, normalized);
  usePanelStore.getState().setViewState(CAPTURE_PANEL, {
    docViewerTabs: normalized.tabs,
    docViewerActiveTabId: normalized.activeId,
    ...(active ? tabProjection(active) : { docViewerFullPage: false }),
  });
  if (changed) persistTabs(normalized.tabs, normalized.activeId);
  if (normalized.tabs.length === 1 && normalized.tabs[0].kind === 'capture') {
    void handoffToClassic(normalized.tabs[0]);
  }
}

export function updateCaptureTabUi(
  patch: Partial<ViewUIState>,
  options: { throttled?: boolean } = {},
): boolean {
  if (currentHandoffOperation()) return true;
  const normalized = currentTabs();
  if (normalized.tabs.length === 0 || !normalized.activeId) return false;
  const prospective = { ...currentViewState(), ...patch };
  const tabs = normalized.tabs.map((tab) => (
    tab.id === normalized.activeId ? snapshotTab(tab, prospective) : tab
  ));
  const renormalized = normalizeCaptureTabs(tabs, normalized.activeId);
  usePanelStore.getState().setViewState(CAPTURE_PANEL, {
    ...patch,
    docViewerTabs: renormalized.tabs,
    docViewerActiveTabId: renormalized.activeId,
  });

  if (!options.throttled) {
    cancelPendingScrollPersistence();
    persistTabs(renormalized.tabs, renormalized.activeId);
    return true;
  }

  const context = currentOperationContext();
  const key = workspaceOperationKey(context.workspaceId);
  const existing = pendingScrollByWorkspace.get(key);
  if (existing) {
    existing.tabs = renormalized.tabs;
    existing.activeId = renormalized.activeId;
    return true;
  }
  const pending: PendingScrollPersistence = {
    context,
    tabs: renormalized.tabs,
    activeId: renormalized.activeId,
    timer: 0,
    unsubscribe: () => undefined,
  };
  pending.unsubscribe = usePanelStore.subscribe(() => {
    if (!isCurrentOperationContext(context)) cancelPendingScrollPersistence(context);
  });
  pending.timer = window.setTimeout(() => {
    if (pendingScrollByWorkspace.get(key) !== pending) return;
    pending.unsubscribe();
    pendingScrollByWorkspace.delete(key);
    if (isCurrentOperationContext(context)) {
      persistTabs(pending.tabs, pending.activeId, context);
    }
  }, 100);
  pendingScrollByWorkspace.set(key, pending);
  return true;
}

export function plusPressed(): string | null {
  if (currentHandoffOperation()) return null;
  const normalized = currentTabs();
  let tabs = snapshotOutgoing(normalized.tabs, normalized.activeId);
  const existingCapture = tabs.find((tab) => tab.kind === 'capture');
  if (existingCapture) {
    activateCaptureTab(existingCapture.id);
    return existingCapture.id;
  }

  if (tabs.length === 0) {
    const state = currentViewState();
    const mode = state.docViewerMode ?? 'active';
    const path = canonicalCapturePath(
      mode === 'archive' ? state.docViewerArchiveSelectedPath : state.docViewerActiveSelectedPath,
    );
    if (!path) return null;
    const name = path.slice(path.lastIndexOf('/') + 1);
    const documentTab = snapshotTab({
      id: nextTabId(),
      kind: 'doc',
      path,
      name,
      extension: name.includes('.') ? name.split('.').pop()!.toLowerCase() : '',
      ui: emptyCaptureTabUi(mode),
    }, state);
    tabs = [documentTab];
  }

  const captureTab: DocViewerTab = { id: nextTabId(), kind: 'capture', ui: emptyCaptureTabUi() };
  commitTabs([...tabs, captureTab], captureTab.id);
  return captureTab.id;
}

export function activateCaptureTab(id: string): string | null {
  if (currentHandoffOperation()) return null;
  const normalized = currentTabs();
  if (!normalized.tabs.some((tab) => tab.id === id)) return null;
  if (normalized.activeId === id) return id;
  const tabs = snapshotOutgoing(normalized.tabs, normalized.activeId);
  return commitTabs(tabs, id);
}

export function openDocumentInCaptureTabs(info: { folder: string; path?: string; name: string }): boolean {
  if (currentHandoffOperation()) return false;
  const normalized = currentTabs();
  const recoveryCapture = normalized.tabs.length === 1
    && normalized.tabs[0]?.kind === 'capture'
    && getCaptureHandoffStatus() === 'failed';
  if (normalized.tabs.length < 2 && !recoveryCapture) return false;
  const path = canonicalCapturePath(info.path ?? `${info.folder}/${info.name}`);
  if (!path) return false;
  let tabs = snapshotOutgoing(normalized.tabs, normalized.activeId);
  const existing = tabs.find((tab) => tab.kind === 'doc' && tab.path === path);
  if (existing) {
    commitTabs(tabs, existing.id);
    return true;
  }

  const name = path.slice(path.lastIndexOf('/') + 1);
  const state = currentViewState();
  const active = tabs.find((tab) => tab.id === normalized.activeId);
  const documentTab = snapshotTab({
    id: active?.kind === 'capture' ? active.id : nextTabId(),
    kind: 'doc',
    path,
    name,
    extension: name.includes('.') ? name.split('.').pop()!.toLowerCase() : '',
    ui: emptyCaptureTabUi(state.docViewerMode ?? 'active'),
  }, {
    ...state,
    docViewerLastOpenedPath: path,
    [state.docViewerMode === 'archive' ? 'docViewerArchiveSelectedPath' : 'docViewerActiveSelectedPath']: path,
  });
  tabs = active?.kind === 'capture'
    ? tabs.map((tab) => tab.id === active.id ? documentTab : tab)
    : [...tabs, documentTab];
  commitTabs(tabs, documentTab.id);
  return true;
}

export function backOutOfCaptureDocument(): void {
  if (currentHandoffOperation()) return;
  const normalized = currentTabs();
  if (normalized.tabs.length === 0 || !normalized.activeId) return;
  const tabs = snapshotOutgoing(normalized.tabs, normalized.activeId);
  const active = tabs.find((tab) => tab.id === normalized.activeId);
  if (!active || active.kind !== 'doc') return;
  if (tabs.length === 1) {
    void handoffToClassic(active, { clearCurrentSelection: true });
    return;
  }
  const capture: DocViewerTab = { id: active.id, kind: 'capture', ui: emptyCaptureTabUi() };
  const nextTabs = tabs
    .filter((tab) => tab.id === active.id || tab.kind !== 'capture')
    .map((tab) => tab.id === active.id ? capture : tab);
  if (nextTabs.length === 1) {
    void handoffToClassic(capture);
  } else {
    commitTabs(nextTabs, capture.id);
  }
}

export function closeCaptureTab(id: string): void {
  if (currentHandoffOperation()) return;
  const normalized = currentTabs();
  const index = normalized.tabs.findIndex((tab) => tab.id === id);
  if (index < 0) return;
  const tabs = snapshotOutgoing(normalized.tabs, normalized.activeId);
  const nextTabs = tabs.filter((tab) => tab.id !== id);
  if (nextTabs.length === 0) {
    const closed = tabs[index];
    if (closed.kind === 'capture') {
      void handoffToClassic(closed, { stageSurvivor: getCaptureHandoffStatus() === 'failed' });
      return;
    }
    usePanelStore.getState().setViewState(CAPTURE_PANEL, {
      docViewerTabs: [],
      docViewerActiveTabId: null,
      docViewerFullPage: false,
    });
    persistTabs([], null);
    return;
  }
  const nextActiveId = id === normalized.activeId
    ? (nextTabs[index - 1]?.id ?? nextTabs[index]?.id ?? nextTabs[0].id)
    : normalized.activeId;
  const survivor = nextTabs.length === 1 ? nextTabs[0] : null;
  if (survivor?.kind === 'capture') {
    void handoffToClassic(survivor);
    return;
  }
  commitTabs(nextTabs, nextActiveId);
}

/**
 * Apply file-identity changes to the durable Capture tab owner. The caller
 * supplies a pure transform; this controller owns normalization, active-id
 * remapping, survivor transitions, and the only persistence write.
 */
export function transitionCaptureTabPaths(
  transform: (tabs: DocViewerTab[]) => DocViewerTab[] | null,
): boolean {
  if (currentHandoffOperation()) return false;
  const normalized = currentTabs();
  if (normalized.tabs.length === 0) return false;
  const current = snapshotOutgoing(normalized.tabs, normalized.activeId);
  const transformed = transform(current);
  if (!transformed) return false;
  const next = normalizeCaptureTabs(transformed, normalized.activeId);
  if (next.tabs.length === 0) {
    const mode = currentViewState().docViewerMode ?? 'active';
    const cleanedLegacyProjection = legacyProjectionFor({
      id: 'record-free-grid',
      kind: 'capture',
      ui: emptyCaptureTabUi(mode),
    });
    void handoffToClassic(null, { legacyProjection: cleanedLegacyProjection });
    return true;
  }
  if (next.tabs.length === 1 && next.tabs[0].kind === 'capture') {
    void handoffToClassic(next.tabs[0], { stageSurvivor: true });
    return true;
  }
  commitTabs(next.tabs, next.activeId);
  return true;
}
