/**
 * @module panelStore
 * @role Root Zustand store. Composes chat, view, and secondary slices, then
 *       adds workspace isolation, thread management, WebSocket, harness,
 *       theme, and CLI config state inline.
 */
import { create } from 'zustand';
import type { Thread } from '../types';
import type { AppState, WorkspacePanelState, ConnectorId, ConnectorState } from './panelStoreTypes';
import { createChatSlice } from './slices/chatSlice';
import { createViewSlice, clampPaneWidth } from './slices/viewSlice';
import { createSecondarySlice } from './slices/secondarySlice';

// Re-export for consumers that import clampPaneWidth from this module (e.g. ResizeHandle.tsx).
export { clampPaneWidth };
export type { AppState };

function createEmptyWorkspaceState(): WorkspacePanelState {
  return {
    projectRoot: null,
    currentPanel: 'file-viewer',
    projectChats: {},
    threads: [],
    currentThreadId: null,
    chatActive: false,
    wireReady: false,
    contextUsage: 0,
    panelConfigs: [],
    panelRoots: {},
    viewStates: {},
  };
}

export const usePanelStore = create<AppState>((set, get) => ({
  // ── Slice composition ─────────────────────────────────────────────────────
  ...createChatSlice(set, get),
  ...createViewSlice(set, get),
  ...createSecondarySlice(set, get),

  // ── Workspace isolation (WORKSPACE_ISOLATION_SPEC) ────────────────────────
  activeWorkspaceId: null,
  workspaceState: {},
  _prefetchAbort: null,
  setPrefetchAbort: (controller) => set({ _prefetchAbort: controller }),

  activateWorkspace: (workspaceId) => {
    const state = get();
    const oldId = state.activeWorkspaceId;

    if (state._prefetchAbort) {
      state._prefetchAbort.abort();
    }

    // Save only lightweight, safe-to-cache state (panelConfigs + viewStates).
    // projectRoot/currentPanel are NOT cached — they come from panel_config
    // on every switch to avoid path-rotation bugs.
    const nextWorkspaceState = { ...state.workspaceState };
    if (oldId) {
      const oldState: WorkspacePanelState = {
        projectRoot: null,
        currentPanel: state.currentPanel,
        projectChats: {},
        threads: [],
        currentThreadId: null,
        chatActive: false,
        wireReady: false,
        contextUsage: 0,
        panelConfigs: state.panelConfigs,
        panelRoots: state.panelRoots,
        viewStates: state.viewStates,
      };
      nextWorkspaceState[oldId] = oldState;

      if (state.ws && state.ws.readyState === WebSocket.OPEN) {
        state.ws.send(JSON.stringify({
          type: 'workspace:cache_push',
          workspaceId: oldId,
          state: oldState,
        }));
      }
    }

    const cached = workspaceId ? nextWorkspaceState[workspaceId] : null;
    const loaded = cached ? { ...cached } : createEmptyWorkspaceState();

    // Validate currentPanel against cached panelConfigs; reset to first or default if stale.
    const validPanel = loaded.panelConfigs.find((c) => c.id === loaded.currentPanel)
      ? loaded.currentPanel
      : (loaded.panelConfigs[0]?.id ?? 'file-viewer');

    set({
      activeWorkspaceId: workspaceId,
      workspaceState: nextWorkspaceState,
      projectRoot: null,
      currentPanel: validPanel,
      projectChats: {},
      threads: [],
      currentThreadId: null,
      chatActive: false,
      wireReady: false,
      contextUsage: 0,
      panelConfigs: loaded.panelConfigs,
      panelRoots: loaded.panelRoots,
      viewStates: loaded.viewStates,
      _prefetchAbort: null,
    });
  },

  // Seed workspace state from server cache (on workspace:init) without activating.
  seedWorkspaceState: (workspaceId, partial) => {
    set((s) => {
      if (s.workspaceState[workspaceId]) return s;
      const seeded: WorkspacePanelState = {
        ...createEmptyWorkspaceState(),
        ...partial,
      };
      return { workspaceState: { ...s.workspaceState, [workspaceId]: seeded } };
    });
  },

  evictWorkspaceRuntimeState: (workspaceId) => {
    const state = get();
    if (!state.workspaceState[workspaceId] && state.activeWorkspaceId !== workspaceId) {
      return;
    }

    const nextWorkspaceState = { ...state.workspaceState };
    delete nextWorkspaceState[workspaceId];

    if (state.activeWorkspaceId === workspaceId) {
      const emptyState = createEmptyWorkspaceState();
      set({
        workspaceState: nextWorkspaceState,
        projectRoot: emptyState.projectRoot,
        currentPanel: emptyState.currentPanel,
        projectChats: {},
        threads: emptyState.threads,
        currentThreadId: emptyState.currentThreadId,
        chatActive: emptyState.chatActive,
        wireReady: emptyState.wireReady,
        contextUsage: emptyState.contextUsage,
        panelConfigs: emptyState.panelConfigs,
        panelRoots: emptyState.panelRoots,
        viewStates: emptyState.viewStates,
        secondary: null,
        cliPickerOpen: {},
        threadDropdownOpen: {},
      });
    } else {
      set({ workspaceState: nextWorkspaceState });
    }
  },

  // ── Panel configs ─────────────────────────────────────────────────────────
  panelConfigs: [],
  setPanelConfigs: (configs) => set({ panelConfigs: configs }),
  getPanelConfig: (id) => get().panelConfigs.find((c) => c.id === id),
  viewRegistryUpdateError: null,
  hiddenViews: [],
  availableViewTemplates: [],
  setViewOptions: (hiddenViews, availableTemplates) => set({
    hiddenViews,
    availableViewTemplates: availableTemplates,
  }),
  setViewRegistryUpdateError: (message) => set({ viewRegistryUpdateError: message }),
  requestViewOptions: () => {
    const ws = get().ws;
    set({ viewRegistryUpdateError: null });
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'workspace:view_options_requested' }));
    } else {
      set({ viewRegistryUpdateError: 'Workspace connection is not open.' });
    }
  },
  restoreView: (viewId) => {
    const ws = get().ws;
    set({ viewRegistryUpdateError: null });
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'workspace:view_restore_requested', viewId }));
    } else {
      set({ viewRegistryUpdateError: 'Workspace connection is not open.' });
    }
  },
  addView: (templateId) => {
    const ws = get().ws;
    set({ viewRegistryUpdateError: null });
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'workspace:view_add_requested', templateId }));
    } else {
      set({ viewRegistryUpdateError: 'Workspace connection is not open.' });
    }
  },
  requestViewUpdate: (viewId, patch, move) => {
    const ws = get().ws;
    set({ viewRegistryUpdateError: null });
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'workspace:view_update_requested',
        viewId,
        ...(patch ? { patch } : {}),
        ...(move ? { move } : {}),
      }));
    } else {
      set({ viewRegistryUpdateError: 'Workspace connection is not open.' });
    }
  },

  // Monotonic counter — bumped on workspace switch so style hooks refetch.
  sharedStylesGeneration: 0,
  bumpSharedStylesGeneration: () =>
    set((s) => ({ sharedStylesGeneration: s.sharedStylesGeneration + 1 })),

  // ── Current panel ─────────────────────────────────────────────────────────
  currentPanel: 'file-viewer',
  setCurrentPanel: (id) => {
    const state = get();
    // RCC-0095: the workspace chat thread persists across panel switches.
    set({
      currentPanel: id,
      cliPickerOpen: { ...state.cliPickerOpen, [state.currentPanel]: false },
      threadDropdownOpen: { ...state.threadDropdownOpen, [state.currentPanel]: false },
    });
    const ws = state.ws;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'set_panel', panel: id }));
    }
    // SPEC-26c-2: load view state if not yet cached.
    if (!get().viewStates[id]) {
      get().loadViewState(id);
    }
  },

  // ── WebSocket ─────────────────────────────────────────────────────────────
  ws: null,
  setWs: (ws) => set({ ws }),

  // ── Project root ──────────────────────────────────────────────────────────
  projectRoot: null,
  setProjectRoot: (root) => set({ projectRoot: root }),

  panelRoots: {},
  setPanelRoots: (roots) => set({ panelRoots: roots }),

  // ── Thread management (RCC-0095: single workspace chat) ───────────────────
  threads: [],
  currentThreadId: null,
  chatActive: false,
  wireReady: false,

  setThreads: (threads) => set({ threads }),

  setCurrentThreadId: (threadId) => {
    const state = get();
    // STATE_OVERRIDE_SPEC: persist the workspace thread on the current view.
    if (state.currentThreadId !== threadId) {
      get()._persistViewPatch(state.currentPanel, { currentThreadId: threadId });
    }
    set((s) => {
      const base: Partial<AppState> = { currentThreadId: threadId };
      // SECONDARY_CHAT_SPEC §3c: if primary is being switched to secondary's
      // thread, secondary auto-closes (switch wins).
      if (s.secondary && threadId === s.secondary.threadId) {
        base.secondary = null;
      }
      return base;
    });
  },

  setChatActive: (active) => set({ chatActive: active }),
  setWireReady: (ready) => set({ wireReady: ready }),

  addThread: (thread) => set((state) => ({
    threads: [thread, ...state.threads],
  })),

  updateThread: (threadId, updates) => set((state) => ({
    threads: state.threads.map(t =>
      t.threadId === threadId ? { ...t, entry: { ...t.entry, ...updates } } : t
    ),
  })),

  removeThread: (threadId) => set((state) => {
    // SECONDARY_CHAT_SPEC §7d: auto-close secondary if its thread is deleted.
    const dropSecondary = state.secondary?.threadId === threadId;
    // PER_THREAD_CHAT_STATE: evict the deleted thread's cached chat state.
    const nextProjectChats = { ...state.projectChats };
    delete nextProjectChats[threadId];
    return {
      threads: state.threads.filter(t => t.threadId !== threadId),
      currentThreadId: state.currentThreadId === threadId ? null : state.currentThreadId,
      projectChats: nextProjectChats,
      ...(dropSecondary ? { secondary: null } : {}),
    };
  }),

  // ── Harness status cache (HARNESS_STATUS_CACHE_SPEC) ──────────────────────
  harnessStatuses: {},
  setHarnessStatuses: (map) => set({ harnessStatuses: map }),
  setHarnessStatus: (id, status) => set((s) => ({
    harnessStatuses: { ...s.harnessStatuses, [id]: status },
  })),

  // ── Modal open state ──────────────────────────────────────────────────────
  isThemePickerOpen: false,
  setThemePickerOpen: (open) => set({ isThemePickerOpen: open }),
  isSecretsManagerOpen: false,
  setSecretsManagerOpen: (open) => set({ isSecretsManagerOpen: open }),

  // ── Connectors dropdown (Chunk F) ──
  isConnectorsDropdownOpen: false,
  setConnectorsDropdownOpen: (open) => set({ isConnectorsDropdownOpen: open }),

  connectorStatuses: {
    mail:      { enabled: false, status: 'gray', lastSync: null },
    calendar:  { enabled: false, status: 'gray', lastSync: null },
    notes:     { enabled: false, status: 'gray', lastSync: null },
    reminders: { enabled: false, status: 'gray', lastSync: null },
  } as Record<ConnectorId, ConnectorState>,

  toggleConnector: (id: ConnectorId) => set((s) => {
    const current = s.connectorStatuses[id];
    if (!current) return s;
    const next: ConnectorState = {
      ...current,
      enabled: !current.enabled,
      status: current.enabled ? 'gray' : 'yellow',
    };
    return { connectorStatuses: { ...s.connectorStatuses, [id]: next } };
  }),

  setConnectorStatus: (id: ConnectorId, patch: Partial<ConnectorState>) => set((s) => {
    const current = s.connectorStatuses[id];
    if (!current) return s;
    return { connectorStatuses: { ...s.connectorStatuses, [id]: { ...current, ...patch } } };
  }),

  // ── Theme catalog (THEME_PICKER_SPEC §6a) ─────────────────────────────────
  themes: [],
  activeThemeId: null,
  hydrateThemes: (themes, activeId) => set({ themes, activeThemeId: activeId }),
  activateTheme: (id) => {
    set({ activeThemeId: id });
    const ws = get().ws;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'theme:activate', id }));
    }
  },
  saveTheme: (entry) => {
    const ws = get().ws;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'theme:save', theme: entry }));
    }
  },
  deleteTheme: (id) => {
    const ws = get().ws;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'theme:delete', id }));
    }
  },

  // ── CLI config (CLI_CONFIG_SPEC §8a) ──────────────────────────────────────
  cliConfig: {},
  cliConfigViewDelta: {},
  hydrateCliConfig: (cfg) => set({ cliConfig: cfg }),
  setCliConfigViewDelta: (viewId, delta) => set((s) => ({
    cliConfigViewDelta: { ...s.cliConfigViewDelta, [viewId]: delta },
  })),

  // ── Harness connection state ───────────────────────────────────────────────
  connectingHarnessId: null,
  setConnectingHarnessId: (id) => set({ connectingHarnessId: id }),
  selectHarness: (harnessId) => {
    const s = get();
    set({
      connectingHarnessId: harnessId,
      wireReady: false,
      currentThreadId: null,
    });
    const ws = s.ws;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'thread:open-assistant', harnessId }));
    }
  },
  createDefaultAssistantThread: () => {
    const s = get();
    set({
      connectingHarnessId: null,
      wireReady: false,
      currentThreadId: null,
    });
    const ws = s.ws;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'thread:open-assistant' }));
    }
  },
}));

// ── Workspace-keyed convenience selectors (WORKSPACE_ISOLATION_SPEC) ─────────

export function getCurrentWorkspaceState(state: AppState): WorkspacePanelState | null {
  const id = state.activeWorkspaceId;
  if (!id) return null;
  return state.workspaceState[id] ?? null;
}

export function getCurrentProjectRoot(state: AppState): string | null {
  return state.projectRoot;
}

export function getCurrentPanel(state: AppState): string {
  return state.currentPanel;
}

export function getCurrentThreads(state: AppState): Thread[] {
  return state.threads ?? [];
}
