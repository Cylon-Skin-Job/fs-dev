/**
 * @module panelStore
 * @role Root Zustand store. Composes chat, view, and secondary slices, then
 *       adds workspace isolation, thread management, WebSocket, harness,
 *       theme, and CLI config state inline.
 */
import { create } from 'zustand';
import type { Thread, Scope } from '../types';
import type { AppState, WorkspacePanelState, ConnectorId, ConnectorState } from './panelStoreTypes';
import { createChatSlice, createInitialPanelState } from './slices/chatSlice';
import { createViewSlice, clampPaneWidth } from './slices/viewSlice';
import { createSecondarySlice } from './slices/secondarySlice';

// Re-export for consumers that import clampPaneWidth from this module (e.g. ResizeHandle.tsx).
export { clampPaneWidth };
export type { AppState };

function createEmptyWorkspaceState(): WorkspacePanelState {
  return {
    projectRoot: null,
    currentPanel: 'file-viewer',
    panels: {},
    projectChats: {},
    threads: { project: [], view: [] },
    currentThreadIds: { project: null, view: null },
    currentScope: null,
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
        panels: {},
        projectChats: {},
        threads: { project: [], view: [] },
        currentThreadIds: { project: null, view: null },
        currentScope: null,
        wireReady: false,
        contextUsage: 0,
        panelConfigs: state.panelConfigs,
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
      panels: {},
      projectChats: {},
      threads: { project: [], view: [] },
      currentThreadIds: { project: null, view: null },
      currentScope: null,
      wireReady: false,
      contextUsage: 0,
      panelConfigs: loaded.panelConfigs,
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

  // ── Panel configs ─────────────────────────────────────────────────────────
  panelConfigs: [],
  setPanelConfigs: (configs) => {
    const existing = get().panels;
    const panels: AppState['panels'] = { ...existing };
    for (const config of configs) {
      if (!panels[config.id]) {
        panels[config.id] = createInitialPanelState();
      }
    }
    set({ panelConfigs: configs, panels });
  },
  getPanelConfig: (id) => get().panelConfigs.find((c) => c.id === id),

  // Monotonic counter — bumped on workspace switch so style hooks refetch.
  sharedStylesGeneration: 0,
  bumpSharedStylesGeneration: () =>
    set((s) => ({ sharedStylesGeneration: s.sharedStylesGeneration + 1 })),

  // ── Current panel ─────────────────────────────────────────────────────────
  currentPanel: 'file-viewer',
  setCurrentPanel: (id) => {
    const state = get();
    const base: Partial<AppState> = {
      currentPanel: id,
      // SPEC-26c: view thread resets on panel switch (server kills the wire
      // when panel changes); project thread persists across panels.
      currentThreadIds: { ...state.currentThreadIds, view: null },
      // Preserve 'project' scope across panel switches. Null only if the
      // previous scope was 'view', which the server kills on panel change.
      currentScope: state.currentScope === 'view' ? null : state.currentScope,
      cliPickerOpen: { ...state.cliPickerOpen, [state.currentPanel]: false },
      threadDropdownOpen: { ...state.threadDropdownOpen, [state.currentPanel]: false },
    };
    if (!state.panels[id]) {
      set({ ...base, panels: { ...state.panels, [id]: createInitialPanelState() } });
    } else {
      set(base);
    }
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

  // ── Thread management (SPEC-26c: dual-scope) ──────────────────────────────
  threads: { project: [], view: [] },
  currentThreadIds: { project: null, view: null },
  currentScope: null,
  wireReady: false,

  setThreads: (scope, threads) => set((state) => ({
    threads: { ...state.threads, [scope]: threads },
  })),

  setCurrentThreadId: (scope, threadId) => {
    const state = get();
    // STATE_OVERRIDE_SPEC: persist project-scope thread on the current view.
    if (scope === 'project' && state.currentThreadIds.project !== threadId) {
      get()._persistViewPatch(state.currentPanel, { currentThreadId: threadId });
    }
    set((s) => {
      const base: Partial<AppState> = {
        currentThreadIds: { ...s.currentThreadIds, [scope]: threadId },
      };
      // SECONDARY_CHAT_SPEC §3c: if primary is being switched to secondary's
      // thread, secondary auto-closes (switch wins).
      if (s.secondary && scope === 'project' && threadId === s.secondary.threadId) {
        base.secondary = null;
      }
      return base;
    });
  },

  setCurrentScope: (scope) => set({ currentScope: scope }),
  setWireReady: (ready) => set({ wireReady: ready }),

  addThread: (scope, thread) => set((state) => ({
    threads: { ...state.threads, [scope]: [thread, ...state.threads[scope]] },
  })),

  updateThread: (scope, threadId, updates) => set((state) => ({
    threads: {
      ...state.threads,
      [scope]: state.threads[scope].map(t =>
        t.threadId === threadId ? { ...t, entry: { ...t.entry, ...updates } } : t
      ),
    },
  })),

  removeThread: (scope, threadId) => set((state) => {
    // SECONDARY_CHAT_SPEC §7d: auto-close secondary if its thread is deleted.
    const dropSecondary = state.secondary?.threadId === threadId;
    // PER_THREAD_CHAT_STATE: evict the deleted thread's cached chat state.
    const nextProjectChats = { ...state.projectChats };
    delete nextProjectChats[threadId];
    return {
      threads: {
        ...state.threads,
        [scope]: state.threads[scope].filter(t => t.threadId !== threadId),
      },
      currentThreadIds: {
        ...state.currentThreadIds,
        [scope]: state.currentThreadIds[scope] === threadId
          ? null
          : state.currentThreadIds[scope],
      },
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
  selectHarness: (harnessId, scope) => {
    const s = get();
    set({
      connectingHarnessId: harnessId,
      wireReady: false,
      currentThreadIds: { ...s.currentThreadIds, [scope]: null },
    });
    const ws = s.ws;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'thread:open-assistant', scope, harnessId }));
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

export function getCurrentThreads(state: AppState, scope: Scope): Thread[] {
  return state.threads[scope] ?? [];
}
