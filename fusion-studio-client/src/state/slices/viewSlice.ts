/**
 * @module viewSlice
 * @role Per-view UI state (sidebar collapse, pane widths, surface tints) and
 *       chat-header dropdown (multi-harness picker, thread jump) transient state.
 */
import type { ViewUIState, Pane, CollapsablePane } from '../../types';
import type { AppState, TintPath } from '../panelStoreTypes';

type Set = (partial: Partial<AppState> | ((state: AppState) => Partial<AppState>)) => void;
type Get = () => AppState;

// STATE_OVERRIDE_SPEC §5: per-view UI state defaults (full shape).
export const DEFAULT_VIEW_UI_STATE: ViewUIState = {
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
  docViewerMode: 'active',
  docViewerActiveSelectedPath: null,
  docViewerArchiveSelectedPath: null,
  docViewerActiveGridScroll: 0,
  docViewerArchiveGridScroll: 0,
  docViewerActiveDocScroll: 0,
  docViewerArchiveDocScroll: 0,
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

// ── Slice factory ─────────────────────────────────────────────────────────────

export function createViewSlice(set: Set, get: Get) {
  return {
    viewStates: {} as Record<string, ViewUIState>,
    cliPickerOpen: {} as Record<string, boolean>,
    threadDropdownOpen: {} as Record<string, boolean>,

    loadViewState: (view: string) => {
      const ws = get().ws;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      ws.send(JSON.stringify({ type: 'state:get', view }));
    },

    // STATE_OVERRIDE_SPEC: send a minimal state:set patch for the given view.
    _persistViewPatch: (view: string, patch: Partial<ViewUIState>) => {
      const ws = get().ws;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      ws.send(JSON.stringify({ type: 'state:set', view, state: patch }));
    },

    setViewState: (view: string, state: Partial<ViewUIState>) => set((s) => ({
      viewStates: { ...s.viewStates, [view]: { ...s.viewStates[view], ...state } },
    })),

    toggleCollapsed: (view: string, pane: CollapsablePane) => {
      set((s) => {
        const current = s.viewStates[view] ?? DEFAULT_VIEW_UI_STATE;
        const wasCollapsed = current.collapsed[pane];
        const nextCollapsed = { ...current.collapsed, [pane]: !wasCollapsed };
        const nextState: ViewUIState = { ...current, collapsed: nextCollapsed };

        const ws = get().ws;
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'state:set', view, state: { collapsed: nextCollapsed } }));
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

    setPaneWidth: (view: string, pane: Pane, width: number) => set((s) => {
      const current = s.viewStates[view] ?? DEFAULT_VIEW_UI_STATE;
      const clamped = clampPaneWidth(pane, width);
      const nextWidths = { ...current.widths, [pane]: clamped };
      return {
        viewStates: { ...s.viewStates, [view]: { ...current, widths: nextWidths } },
      };
    }),

    commitPaneWidths: (view: string) => {
      const state = get().viewStates[view];
      if (!state) return;
      const ws = get().ws;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      ws.send(JSON.stringify({ type: 'state:set', view, state: { widths: state.widths } }));
    },

    // TINTS_SPEC §8b: flip a single tint leaf for `view`. Updates local
    // viewStates slot AND fires a minimal state:set patch.
    setTint: (view: string, path: TintPath, value: boolean) => {
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
        viewStates: { ...s.viewStates, [view]: { ...current, tints: nextTints } },
      });
      get()._persistViewPatch(view, patch);
    },

    // Chat-header dropdown actions (mutex: opening one closes the other).
    toggleCliPicker: (panel: string) => set((s) => {
      const next = !s.cliPickerOpen[panel];
      return {
        cliPickerOpen: { ...s.cliPickerOpen, [panel]: next },
        threadDropdownOpen: { ...s.threadDropdownOpen, [panel]: false },
      };
    }),

    closeCliPicker: (panel: string) => set((s) => ({
      cliPickerOpen: { ...s.cliPickerOpen, [panel]: false },
    })),

    toggleThreadDropdown: (panel: string) => set((s) => {
      const next = !s.threadDropdownOpen[panel];
      return {
        threadDropdownOpen: { ...s.threadDropdownOpen, [panel]: next },
        cliPickerOpen: { ...s.cliPickerOpen, [panel]: false },
      };
    }),

    closeThreadDropdown: (panel: string) => set((s) => ({
      threadDropdownOpen: { ...s.threadDropdownOpen, [panel]: false },
    })),

    closeAllChatHeaderDropdowns: (panel: string) => set((s) => ({
      cliPickerOpen: { ...s.cliPickerOpen, [panel]: false },
      threadDropdownOpen: { ...s.threadDropdownOpen, [panel]: false },
    })),
  };
}
