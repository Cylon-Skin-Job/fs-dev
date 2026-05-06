import { create } from 'zustand';
import type {
  PanelState,
  Message,
  AssistantTurn,
  StreamSegment,
  Thread,
  Scope,
  ViewUIState,
  Pane,
  CollapsablePane,
  SecondaryState
} from '../types';
import type { PanelConfig } from '../lib/panels';
import { secondaryTracker } from '../lib/secondary-tracker';
import type { HarnessStatus, ResolvedCliEntry, CliEntryOverride, ThemeEntry } from '../types';

// Initial panel state factory
function createInitialPanelState(): PanelState {
  return {
    messages: [],
    currentTurn: null,
    pendingTurnEnd: false,
    pendingMessage: null,
    segments: [],
    lastReleasedSegmentCount: 0
  };
}

// STATE_OVERRIDE_SPEC §5: per-view UI state defaults (full shape).
const DEFAULT_VIEW_UI_STATE: ViewUIState = {
  collapsed: { leftSidebar: false, leftChat: false },
  widths:    { leftSidebar: 220,   leftChat: 320   },
  popup: {
    open: false,
    x: -1,
    y: -1,
    width: 420,
    height: 520,
    threadId: null,
  },
  currentThreadId: null,
  secondaryThreadId: null,
  // TINTS_SPEC §8a: surface tint toggles, all neutral by default.
  tints: {
    leftPanel:     false,
    rightPanel:    false,
    cards:         false,
    borders: { threads: false, chat: false },
  },
};

export function clampPaneWidth(pane: Pane, n: number): number {
  let min = 120;
  const max = 600;
  if (pane === 'leftChat') {
    min = 300;
  } else if (pane === 'rightSecondary') {
    min = 300;
  } else if (pane === 'rightCol') {
    // View's right column (e.g. file tree). Allow narrower than the chat
    // so the tree can be compact when no sticky chat is docked.
    min = 160;
  }
  return Math.max(min, Math.min(max, n));
}

// SECONDARY_CHAT_SPEC §7a: default floating popup size.
const DEFAULT_SECONDARY_FLOAT = { x: -1, y: -1, width: 380, height: 520 };

// TINTS_SPEC §8b: leaf paths the setTint action accepts.
type TintPath = 'leftPanel' | 'rightPanel' | 'cards' | 'borders.threads' | 'borders.chat';

interface AppState {
  // Panel configs (dynamically discovered)
  panelConfigs: PanelConfig[];
  setPanelConfigs: (configs: PanelConfig[]) => void;
  getPanelConfig: (id: string) => PanelConfig | undefined;

  // Monotonic counter — bumped on workspace switch so style hooks refetch
  // even when the WebSocket reference is stable.
  sharedStylesGeneration: number;
  bumpSharedStylesGeneration: () => void;

  // Current panel
  currentPanel: string;
  setCurrentPanel: (id: string) => void;

  // Per-panel states (dynamically initialized).
  // SPEC-26c: these hold VIEW-scoped chat state. The current panel's view
  // chat lives at panels[state.currentPanel].
  panels: Record<string, PanelState>;

  // PER_THREAD_CHAT_STATE: project chat state is now keyed by threadId so
  // primary and secondary can display different threads simultaneously.
  // (Replaces the singleton projectChat.)
  projectChats: Record<string, PanelState>;

  // Chat state actions — every action takes a scope and a threadId:
  //  - 'project' + threadId routes to projectChats[threadId]
  //  - 'view'    routes to panels[state.currentPanel] (threadId ignored)
  //  - threadId=null on project → fallback to currentThreadIds.project; if
  //    that's also null, the action is a no-op.
  addMessage: (scope: Scope, threadId: string | null, message: Message) => void;
  setCurrentTurn: (scope: Scope, threadId: string | null, turn: AssistantTurn | null) => void;
  updateTurnContent: (scope: Scope, threadId: string | null, content: string) => void;
  appendSegment: (scope: Scope, threadId: string | null, segType: StreamSegment['type'], text: string) => void;
  pushSegment: (scope: Scope, threadId: string | null, segment: StreamSegment) => void;
  updateLastSegment: (scope: Scope, threadId: string | null, updates: Partial<StreamSegment>) => void;
  updateSegmentByToolCallId: (scope: Scope, threadId: string | null, toolCallId: string, updates: Partial<StreamSegment>) => void;
  appendSegmentContentByIndex: (scope: Scope, threadId: string | null, index: number, text: string) => void;
  resetSegments: (scope: Scope, threadId: string | null) => void;
  setPendingTurnEnd: (scope: Scope, threadId: string | null, pending: boolean) => void;
  setPendingMessage: (scope: Scope, threadId: string | null, message: Message | null) => void;
  finalizeTurn: (scope: Scope, threadId: string | null) => void;
  clearChat: (scope: Scope, threadId: string | null) => void;

  // WebSocket
  ws: WebSocket | null;
  setWs: (ws: WebSocket | null) => void;
  sendMessage: (text: string, scope: Scope, threadId?: string | null) => void;

  // Project root (absolute path from server)
  projectRoot: string | null;
  setProjectRoot: (root: string) => void;

  // Context usage
  contextUsage: number;
  setContextUsage: (usage: number) => void;

  // Thread management — SPEC-26c: dual-scope
  threads: { project: Thread[]; view: Thread[] };
  currentThreadIds: { project: string | null; view: string | null };
  currentScope: Scope | null;  // which scope has the live wire
  wireReady: boolean;

  setThreads: (scope: Scope, threads: Thread[]) => void;
  setCurrentThreadId: (scope: Scope, threadId: string | null) => void;
  setCurrentScope: (scope: Scope | null) => void;
  setWireReady: (ready: boolean) => void;
  addThread: (scope: Scope, thread: Thread) => void;
  updateThread: (scope: Scope, threadId: string, updates: Partial<Thread['entry']>) => void;
  removeThread: (scope: Scope, threadId: string) => void;

  // SPEC-26c-2: per-view UI state (collapse/expand + left-column widths)
  viewStates: Record<string, ViewUIState>;
  loadViewState: (view: string) => void;
  setViewState: (view: string, state: ViewUIState) => void;
  // STATE_OVERRIDE_SPEC: send a minimal state:set patch for `view`.
  _persistViewPatch: (view: string, patch: Partial<ViewUIState>) => void;
  toggleCollapsed: (view: string, pane: CollapsablePane) => void;
  setPaneWidth: (view: string, pane: Pane, width: number) => void;
  commitPaneWidths: (view: string) => void;
  // TINTS_SPEC §8b: flip a tint leaf locally and persist via _persistViewPatch.
  setTint: (view: string, path: TintPath, value: boolean) => void;

  // Chat-header dropdown UI state (transient, not persisted).
  // Keyed by panel id; per-panel independence.
  cliPickerOpen: Record<string, boolean>;
  threadDropdownOpen: Record<string, boolean>;
  toggleCliPicker: (panel: string) => void;
  closeCliPicker: (panel: string) => void;
  toggleThreadDropdown: (panel: string) => void;
  closeThreadDropdown: (panel: string) => void;
  closeAllChatHeaderDropdowns: (panel: string) => void;

  // HARNESS_STATUS_CACHE_SPEC: install status per harness id, seeded from
  // /api/harnesses on first mount and patched reactively by the server's
  // `harness:status_changed` WebSocket event.
  harnessStatuses: Record<string, HarnessStatus>;
  setHarnessStatuses: (map: Record<string, HarnessStatus>) => void;
  setHarnessStatus: (id: string, status: HarnessStatus) => void;

  // THEME_PICKER_SPEC §6a: theme catalog + active id
  themes: ThemeEntry[];
  activeThemeId: string | null;
  hydrateThemes: (themes: ThemeEntry[], activeId: string | null) => void;
  activateTheme: (id: string) => void;
  saveTheme: (entry: Partial<ThemeEntry> & { id: string }) => void;
  deleteTheme: (id: string) => void;

  // CLI_CONFIG_SPEC §8a: resolved CLI catalog (workspace-level) + per-view deltas.
  cliConfig: Record<string, ResolvedCliEntry>;
  cliConfigViewDelta: Record<string, Record<string, CliEntryOverride>>;
  hydrateCliConfig: (cfg: Record<string, ResolvedCliEntry>) => void;
  setCliConfigViewDelta: (viewId: string, delta: Record<string, CliEntryOverride>) => void;

  // Harness currently being connected after the user picked it in the
  // CLI picker. Drives the ConnectingOverlay in ChatArea. Cleared on
  // wire_ready (stream-handlers) or on an explicit setConnectingHarnessId(null).
  connectingHarnessId: string | null;
  setConnectingHarnessId: (id: string | null) => void;
  /** Picked a harness: clears the current thread for the scope, marks the
   *  connecting state, and fires thread:open-assistant. Unified entry point
   *  for both the sidebar's New Thread button and the chat-header's CLI
   *  picker so the visual behavior (blank chat + connecting overlay) is
   *  identical regardless of which trigger opened the picker. */
  selectHarness: (harnessId: string, scope: Scope) => void;

  // SECONDARY_CHAT_SPEC: singleton secondary chat (replaces SPEC-26d popup).
  secondary: SecondaryState | null;
  openSecondary: (threadId: string) => void;
  closeSecondary: () => void;
  minimizeSecondary: () => void;
  restoreSecondary: () => void;
  clearJustRestored: () => void;
  dockSecondary: () => void;
  undockSecondary: () => void;
  setSecondaryFloat: (x: number, y: number, width: number, height: number) => void;
  setSecondaryStickyWidth: (width: number) => void;
}

/**
 * PER_THREAD_CHAT_STATE helper: resolve the chat state slot.
 *  - 'view'    → state.panels[currentPanel]
 *  - 'project' + threadId → projectChats[threadId] (auto-init if missing)
 *  - 'project' + null threadId → fallback to currentThreadIds.project;
 *    if still null, returns an empty state (actions become no-ops).
 */
function getChatState(state: AppState, scope: Scope, threadId: string | null): PanelState {
  if (scope === 'view') {
    return state.panels[state.currentPanel] || createInitialPanelState();
  }
  const tid = threadId ?? state.currentThreadIds.project;
  if (!tid) return createInitialPanelState();
  return state.projectChats[tid] || createInitialPanelState();
}

/**
 * PER_THREAD_CHAT_STATE helper: build the partial state update to write a
 * new chat-state slot back to the store, correctly keyed by scope + threadId.
 * Returns {} (no-op) when scope is 'project' and no threadId can be resolved.
 */
function writeChatState(
  state: AppState,
  scope: Scope,
  threadId: string | null,
  next: PanelState
): Partial<AppState> {
  if (scope === 'view') {
    return { panels: { ...state.panels, [state.currentPanel]: next } };
  }
  const tid = threadId ?? state.currentThreadIds.project;
  if (!tid) return {};
  return { projectChats: { ...state.projectChats, [tid]: next } };
}

/**
 * Resolve a threadId from its optional form to the concrete project thread
 * for no-op-checking inside action implementations. Returns null if
 * scope='project' and no thread is active.
 */
function resolveThreadId(state: AppState, scope: Scope, threadId: string | null): string | null {
  if (scope === 'view') return null;
  return threadId ?? state.currentThreadIds.project;
}

export const usePanelStore = create<AppState>((set, get) => ({
  // Panel configs — empty until discovery populates them
  panelConfigs: [],
  setPanelConfigs: (configs) => {
    const existing = get().panels;
    const panels: Record<string, PanelState> = { ...existing };
    for (const config of configs) {
      if (!panels[config.id]) {
        panels[config.id] = createInitialPanelState();
      }
    }
    set({ panelConfigs: configs, panels });
  },
  getPanelConfig: (id) => get().panelConfigs.find((c) => c.id === id),

  // Shared-styles reload signal (see useSharedWorkspaceStyles)
  sharedStylesGeneration: 0,
  bumpSharedStylesGeneration: () =>
    set((s) => ({ sharedStylesGeneration: s.sharedStylesGeneration + 1 })),

  // Initial state — empty until discovery populates
  currentPanel: 'file-viewer',
  panels: {},
  projectChats: {},  // PER_THREAD_CHAT_STATE: keyed by threadId
  ws: null,
  projectRoot: null,
  contextUsage: 0,
  threads: { project: [], view: [] },
  currentThreadIds: { project: null, view: null },
  currentScope: null,
  wireReady: false,
  viewStates: {},
  cliPickerOpen: {},
  threadDropdownOpen: {},
  secondary: null,
  harnessStatuses: {},
  setHarnessStatuses: (map) => set({ harnessStatuses: map }),
  setHarnessStatus: (id, status) => set((s) => ({
    harnessStatuses: { ...s.harnessStatuses, [id]: status },
  })),

  // THEME_PICKER_SPEC §6a
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

  // CLI_CONFIG_SPEC §8a
  cliConfig: {},
  cliConfigViewDelta: {},
  hydrateCliConfig: (cfg) => set({ cliConfig: cfg }),
  setCliConfigViewDelta: (viewId, delta) => set((s) => ({
    cliConfigViewDelta: { ...s.cliConfigViewDelta, [viewId]: delta },
  })),

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

  // Actions
  setCurrentPanel: (id) => {
    // Auto-initialize panel state if not yet created
    const state = get();
    const base: Partial<AppState> = {
      currentPanel: id,
      // SPEC-26c: view thread resets on panel switch (server kills the wire
      // when panel changes); project thread persists across panels.
      currentThreadIds: { ...state.currentThreadIds, view: null },
      // Preserve 'project' scope across panel switches since the project-scope
      // wire persists. Null only if the previous scope was 'view', which the
      // server kills on panel change. Null-ing unconditionally here made the
      // primary chat render as inactive (opacity 0.55) after panel changes.
      currentScope: state.currentScope === 'view' ? null : state.currentScope,
      // Close any open chat-header dropdowns for the panel we're leaving.
      cliPickerOpen: { ...state.cliPickerOpen, [state.currentPanel]: false },
      threadDropdownOpen: { ...state.threadDropdownOpen, [state.currentPanel]: false },
    };
    if (!state.panels[id]) {
      set({
        ...base,
        panels: { ...state.panels, [id]: createInitialPanelState() },
      });
    } else {
      set(base);
    }
    // Tell the server so ThreadManager scopes to this panel's threads
    const ws = state.ws;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'set_panel', panel: id }));
    }
    // SPEC-26c-2: load view state if not yet cached
    if (!get().viewStates[id]) {
      get().loadViewState(id);
    }
  },

  addMessage: (scope, threadId, message) => set((state) => {
    const cs = getChatState(state, scope, threadId);
    return writeChatState(state, scope, threadId, { ...cs, messages: [...cs.messages, message] });
  }),

  setCurrentTurn: (scope, threadId, turn) => set((state) => {
    const cs = getChatState(state, scope, threadId);
    return writeChatState(state, scope, threadId, { ...cs, currentTurn: turn });
  }),

  updateTurnContent: (scope, threadId, content) => set((state) => {
    const cs = getChatState(state, scope, threadId);
    if (!cs.currentTurn) return state;
    return writeChatState(state, scope, threadId, {
      ...cs,
      currentTurn: { ...cs.currentTurn, content }
    });
  }),

  appendSegment: (scope, threadId, segType, text) => set((state) => {
    const cs = getChatState(state, scope, threadId);
    const segments = [...cs.segments];
    const last = segments[segments.length - 1];
    if (last && last.type === segType) {
      // Same type — append content
      segments[segments.length - 1] = { ...last, content: last.content + text };
    } else {
      // New type — mark prior segment complete (closing tag), push new one
      if (last && !last.complete) {
        segments[segments.length - 1] = { ...last, complete: true };
      }
      segments.push({ type: segType, content: text });
    }
    return writeChatState(state, scope, threadId, { ...cs, segments });
  }),

  pushSegment: (scope, threadId, segment) => set((state) => {
    const cs = getChatState(state, scope, threadId);
    const segments = [...cs.segments];
    // Mark prior segment complete before pushing new one
    const last = segments[segments.length - 1];
    if (last && !last.complete) {
      segments[segments.length - 1] = { ...last, complete: true };
    }
    segments.push(segment);
    return writeChatState(state, scope, threadId, { ...cs, segments });
  }),

  updateLastSegment: (scope, threadId, updates) => set((state) => {
    const cs = getChatState(state, scope, threadId);
    const segments = [...cs.segments];
    const last = segments[segments.length - 1];
    if (last) {
      segments[segments.length - 1] = { ...last, ...updates };
    }
    return writeChatState(state, scope, threadId, { ...cs, segments });
  }),

  updateSegmentByToolCallId: (scope, threadId, toolCallId, updates) => set((state) => {
    const cs = getChatState(state, scope, threadId);
    const idx = cs.segments.findIndex((s) => s.toolCallId === toolCallId);
    if (idx < 0) return state;
    const segments = [...cs.segments];
    segments[idx] = { ...segments[idx], ...updates };
    return writeChatState(state, scope, threadId, { ...cs, segments });
  }),

  appendSegmentContentByIndex: (scope, threadId, index, text) => set((state) => {
    const cs = getChatState(state, scope, threadId);
    if (index < 0 || index >= cs.segments.length) return state;
    const segments = [...cs.segments];
    segments[index] = { ...segments[index], content: segments[index].content + text };
    return writeChatState(state, scope, threadId, { ...cs, segments });
  }),

  resetSegments: (scope, threadId) => set((state) => {
    const cs = getChatState(state, scope, threadId);
    return writeChatState(state, scope, threadId, { ...cs, segments: [] });
  }),

  setPendingTurnEnd: (scope, threadId, pending) => set((state) => {
    const cs = getChatState(state, scope, threadId);
    return writeChatState(state, scope, threadId, { ...cs, pendingTurnEnd: pending });
  }),

  setPendingMessage: (scope, threadId, message) => set((state) => {
    const cs = getChatState(state, scope, threadId);
    return writeChatState(state, scope, threadId, { ...cs, pendingMessage: message });
  }),

  // TURN FINALIZATION — completes the full turn lifecycle in one atomic update.
  // Called exactly once per turn, by LiveSegmentRenderer's completion effect,
  // when BOTH conditions are met:
  //   1. All segments have been revealed (revealedCount >= segments.length)
  //   2. turn_end has arrived (pendingTurnEnd is true → onRevealComplete is defined)
  //
  // This does THREE things atomically:
  //   1. Snapshots the turn into messages[] (moves from live to history)
  //   2. Clears currentTurn (LiveSegmentRenderer unmounts)
  //   3. Clears segments and pendingTurnEnd
  //
  // After this fires, the turn renders via InstantSegmentRenderer (history).
  // There is NO limbo state. The turn goes directly from live → history.
  //
  // KNOWN PAST BUG (DO NOT REINTRODUCE):
  // The old finalizeTurn only set status='complete' but left the turn in
  // currentTurn. The turn stayed in limbo — still rendered by LiveSegment-
  // Renderer — until the next turn_begin snapshotted it. This caused:
  //   - User bubble appearing above the live response on mid-stream send
  //   - Turn never moving to history if no follow-up message was sent
  //   - Stale LiveSegmentRenderer state persisting after animation completed
  finalizeTurn: (scope, threadId) => {
    const state = get();
    const cs = getChatState(state, scope, threadId);
    const turn = cs.currentTurn;
    if (turn) {
      const segments = cs.segments;
      const newMessages = [
        ...cs.messages,
        {
          id: turn.id || `turn-${Date.now()}`,
          type: 'assistant' as const,
          content: turn.content,
          timestamp: Date.now(),
          segments: segments.length > 0 ? [...segments] : undefined,
        },
      ];
      set((s) => writeChatState(s, scope, threadId, {
        ...getChatState(s, scope, threadId),
        messages: newMessages,
        currentTurn: null,
        segments: [],
        pendingTurnEnd: false,
        pendingMessage: null,
        lastReleasedSegmentCount: 0,
      }));
    }
  },

  clearChat: (scope, threadId) => set((state) =>
    writeChatState(state, scope, threadId, createInitialPanelState())
  ),

  setWs: (ws) => set({ ws }),
  sendMessage: (text, scope, threadIdOpt) => {
    const state = get();
    const socket = state.ws;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    const threadId = resolveThreadId(state, scope, threadIdOpt ?? null);
    if (!threadId) {
      console.error(`[Store] sendMessage: no active thread in scope=${scope}`);
      return;
    }
    const now = performance.now();
    (window as any).__TIMING = { sendAt: now, firstTokenAt: 0, firstTokenType: '' };
    console.log(`[TIMING] SEND at ${now.toFixed(1)}ms scope=${scope} threadId=${threadId.slice(0,8)}`);
    socket.send(JSON.stringify({
      type: 'prompt',
      scope,
      threadId,
      user_input: text,
    }));
  },
  setProjectRoot: (root) => set({ projectRoot: root }),
  setContextUsage: (usage) => set({ contextUsage: usage }),

  // Thread actions — SPEC-26c: scope-aware
  setThreads: (scope, threads) => set((state) => ({
    threads: { ...state.threads, [scope]: threads },
  })),
  setCurrentThreadId: (scope, threadId) => {
    const state = get();
    // STATE_OVERRIDE_SPEC: persist project-scope thread on the current view
    // so it carries across view switches (or pins per-view if override file
    // already has the key).
    if (scope === 'project' && state.currentThreadIds.project !== threadId) {
      get()._persistViewPatch(state.currentPanel, { currentThreadId: threadId });
    }
    set((s) => {
      // SECONDARY_CHAT_SPEC §3c: if the primary is being switched to the
      // secondary's thread, the secondary auto-closes (switch wins).
      const base: Partial<AppState> = {
        currentThreadIds: { ...s.currentThreadIds, [scope]: threadId },
      };
      if (
        s.secondary &&
        scope === 'project' &&
        threadId === s.secondary.threadId
      ) {
        base.secondary = null;
      }
      return base;
    });
  },
  setCurrentScope: (scope) => set({ currentScope: scope }),
  setWireReady: (ready) => set({ wireReady: ready }),
  addThread: (scope, thread) => set((state) => ({
    threads: {
      ...state.threads,
      [scope]: [thread, ...state.threads[scope]],
    },
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
        [scope]: state.currentThreadIds[scope] === threadId ? null : state.currentThreadIds[scope],
      },
      projectChats: nextProjectChats,
      ...(dropSecondary ? { secondary: null } : {}),
    };
  }),

  // SPEC-26c-2: per-view UI state actions
  loadViewState: (view) => {
    const ws = get().ws;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: 'state:get', view }));
  },

  // STATE_OVERRIDE_SPEC: send a minimal state:set patch for the given view.
  // Server decides per-key whether the write lands in the workspace default
  // or the per-view override file.
  _persistViewPatch: (view: string, patch: Partial<ViewUIState>) => {
    const ws = get().ws;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: 'state:set', view, state: patch }));
  },

  setViewState: (view, state) => set((s) => ({
    viewStates: { ...s.viewStates, [view]: { ...s.viewStates[view], ...state } },
  })),

  toggleCollapsed: (view, pane) => {
    set((s) => {
      const current = s.viewStates[view] ?? DEFAULT_VIEW_UI_STATE;
      const wasCollapsed = current.collapsed[pane];
      const nextCollapsed = {
        ...current.collapsed,
        [pane]: !wasCollapsed,
      };
      const nextState: ViewUIState = { ...current, collapsed: nextCollapsed };

      // Persist immediately — collapse is a discrete event, not a drag.
      const ws = get().ws;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'state:set',
          view,
          state: { collapsed: nextCollapsed },
        }));
      }

      // When the sidebar is being expanded (was collapsed, now not), close
      // any open chat-header dropdowns for that panel.
      const closeDropdowns = pane === 'leftSidebar' && wasCollapsed;
      return {
        viewStates: { ...s.viewStates, [view]: nextState },
        ...(closeDropdowns && {
          cliPickerOpen: { ...s.cliPickerOpen, [view]: false },
          threadDropdownOpen: { ...s.threadDropdownOpen, [view]: false },
        }),
      };
    });
  },

  // Chat-header dropdown actions (mutex: opening one closes the other).
  toggleCliPicker: (panel) => set((s) => {
    const next = !s.cliPickerOpen[panel];
    return {
      cliPickerOpen: { ...s.cliPickerOpen, [panel]: next },
      threadDropdownOpen: { ...s.threadDropdownOpen, [panel]: false },
    };
  }),
  closeCliPicker: (panel) => set((s) => ({
    cliPickerOpen: { ...s.cliPickerOpen, [panel]: false },
  })),
  toggleThreadDropdown: (panel) => set((s) => {
    const next = !s.threadDropdownOpen[panel];
    return {
      threadDropdownOpen: { ...s.threadDropdownOpen, [panel]: next },
      cliPickerOpen: { ...s.cliPickerOpen, [panel]: false },
    };
  }),
  closeThreadDropdown: (panel) => set((s) => ({
    threadDropdownOpen: { ...s.threadDropdownOpen, [panel]: false },
  })),
  closeAllChatHeaderDropdowns: (panel) => set((s) => ({
    cliPickerOpen: { ...s.cliPickerOpen, [panel]: false },
    threadDropdownOpen: { ...s.threadDropdownOpen, [panel]: false },
  })),

  setPaneWidth: (view, pane, width) => set((s) => {
    const current = s.viewStates[view] ?? DEFAULT_VIEW_UI_STATE;
    const clamped = clampPaneWidth(pane, width);
    const nextWidths = { ...current.widths, [pane]: clamped };
    return {
      viewStates: {
        ...s.viewStates,
        [view]: { ...current, widths: nextWidths },
      },
    };
  }),

  commitPaneWidths: (view) => {
    const state = get().viewStates[view];
    if (!state) return;
    const ws = get().ws;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({
      type: 'state:set',
      view,
      state: { widths: state.widths },
    }));
  },

  // TINTS_SPEC §8b: flip a single tint leaf for `view`. Updates the local
  // viewStates slot AND fires a minimal state:set patch. The server's
  // per-leaf writer routes the write to the per-view override file when the
  // leaf is already pinned there, otherwise to the workspace default.
  setTint: (view, path, value) => {
    const s = get();
    const current = s.viewStates[view] ?? DEFAULT_VIEW_UI_STATE;
    const nextTints = {
      ...current.tints,
      borders: { ...current.tints.borders },
    };
    const patch: Partial<ViewUIState> = {};
    if (path === 'borders.threads') {
      nextTints.borders.threads = value;
      patch.tints = { ...current.tints, borders: { ...current.tints.borders, threads: value } };
    } else if (path === 'borders.chat') {
      nextTints.borders.chat = value;
      patch.tints = { ...current.tints, borders: { ...current.tints.borders, chat: value } };
    } else {
      nextTints[path] = value;
      patch.tints = { ...current.tints, [path]: value };
    }
    set({
      viewStates: {
        ...s.viewStates,
        [view]: { ...current, tints: nextTints },
      },
    });
    get()._persistViewPatch(view, patch);
  },

  // SECONDARY_CHAT_SPEC: secondary chat actions.
  // Guards live in openSecondary: (a) already open → noop; (b) threadId is
  // primary's current project thread → noop (§3c: no co-primary).
  openSecondary: (threadId) => {
    const state = get();
    if (state.secondary) return;
    if (state.currentThreadIds.project === threadId) return;
    // Claim this threadId in the secondary tracker BEFORE sending the WS
    // message, so a late thread:opened response still routes to secondary
    // logic (preventing primary hijack if the user clicks red before the
    // server responds).
    secondaryTracker.mark(threadId);
    set({
      secondary: {
        threadId,
        mode: 'floating',
        previousMode: 'floating',
        float: { ...DEFAULT_SECONDARY_FLOAT },
      },
    });
    // Activate the thread on the server so it gets its own wire.
    const ws = state.ws;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'thread:open-assistant', scope: 'project', threadId }));
    }
    // STATE_OVERRIDE_SPEC: persist popup open + thread id.
    get()._persistViewPatch(state.currentPanel, {
      secondaryThreadId: threadId,
      popup: {
        ...DEFAULT_VIEW_UI_STATE.popup,
        ...(state.viewStates[state.currentPanel]?.popup ?? {}),
        open: true,
        threadId,
      },
    });
  },

  closeSecondary: () => {
    const s = get();
    if (s.secondary?.threadId) {
      // Keep the tracker claim alive so any pending thread:opened from the
      // server still routes to the secondary branch (which is a no-op now)
      // instead of hijacking the primary.
      secondaryTracker.markForClose(s.secondary.threadId);
    }
    set({ secondary: null });
    // STATE_OVERRIDE_SPEC: persist popup closed.
    get()._persistViewPatch(s.currentPanel, {
      secondaryThreadId: null,
      popup: {
        ...DEFAULT_VIEW_UI_STATE.popup,
        ...(s.viewStates[s.currentPanel]?.popup ?? {}),
        open: false,
        threadId: null,
      },
    });
    // Bump the primary's MRU on the server so the thread list re-sorts
    // with primary on top — opening the secondary had bumped *its* updated_at,
    // so without this the formerly-secondary thread sorts above the primary
    // once the display override is removed.
    const ws = s.ws;
    const primaryId = s.currentThreadIds.project;
    if (primaryId && ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'thread:touch', scope: 'project', threadId: primaryId }));
    }
  },

  minimizeSecondary: () => set((s) => {
    if (!s.secondary || s.secondary.mode === 'minimized') return s;
    return {
      secondary: {
        ...s.secondary,
        previousMode: s.secondary.mode as 'floating' | 'sticky-right',
        mode: 'minimized',
      },
    };
  }),

  restoreSecondary: () => set((s) => {
    if (!s.secondary || s.secondary.mode !== 'minimized') return s;
    // justRestored=true triggers the reverse genie animation in whichever
    // component mounts next (floating or sticky). The component clears the
    // flag after the animation completes.
    return {
      secondary: { ...s.secondary, mode: s.secondary.previousMode, justRestored: true },
    };
  }),

  clearJustRestored: () => set((s) => {
    if (!s.secondary?.justRestored) return s;
    return { secondary: { ...s.secondary, justRestored: false } };
  }),

  dockSecondary: () => set((s) => {
    if (!s.secondary || s.secondary.mode === 'sticky-right') return s;
    return { secondary: { ...s.secondary, mode: 'sticky-right' } };
  }),

  undockSecondary: () => set((s) => {
    if (!s.secondary || s.secondary.mode !== 'sticky-right') return s;
    return { secondary: { ...s.secondary, mode: 'floating' } };
  }),

  setSecondaryFloat: (x, y, width, height) => {
    const s = get();
    if (!s.secondary) return;
    set({ secondary: { ...s.secondary, float: { x, y, width, height } } });
    // STATE_OVERRIDE_SPEC: persist popup geometry.
    get()._persistViewPatch(s.currentPanel, {
      popup: {
        ...DEFAULT_VIEW_UI_STATE.popup,
        ...(s.viewStates[s.currentPanel]?.popup ?? {}),
        x, y, width, height,
      },
    });
  },

  setSecondaryStickyWidth: (width) => set((s) => {
    const panel = s.currentPanel;
    const current = s.viewStates[panel] ?? DEFAULT_VIEW_UI_STATE;
    const clamped = clampPaneWidth('rightSecondary', width);
    return {
      viewStates: {
        ...s.viewStates,
        [panel]: {
          ...current,
          widths: { ...current.widths, rightSecondary: clamped },
        },
      },
    };
  }),

}));
