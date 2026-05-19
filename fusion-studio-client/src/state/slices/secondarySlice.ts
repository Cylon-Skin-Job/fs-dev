/**
 * @module secondarySlice
 * @role Secondary chat window state and lifecycle actions (SECONDARY_CHAT_SPEC).
 *       Handles floating, sticky-right, minimized, and genie-restore modes.
 */
import { secondaryTracker } from '../../lib/secondary-tracker';
import type { AppState } from '../panelStoreTypes';
import { DEFAULT_VIEW_UI_STATE } from './viewSlice';

type Set = (partial: Partial<AppState> | ((state: AppState) => Partial<AppState>)) => void;
type Get = () => AppState;

// SECONDARY_CHAT_SPEC §7a: default floating popup size.
const DEFAULT_SECONDARY_FLOAT = { x: -1, y: -1, width: 380, height: 520 };

// ── Slice factory ─────────────────────────────────────────────────────────────

export function createSecondarySlice(set: Set, get: Get) {
  return {
    secondary: null as AppState['secondary'],

    // Guards: (a) already open → noop; (b) threadId is primary's current
    // project thread → noop (§3c: no co-primary).
    openSecondary: (threadId: string) => {
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
      // with primary on top — opening the secondary had bumped *its* updated_at.
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

    setSecondaryFloat: (x: number, y: number, width: number, height: number) => {
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

    setSecondaryStickyWidth: (width: number) => set((s) => {
      const panel = s.currentPanel;
      const current = s.viewStates[panel] ?? DEFAULT_VIEW_UI_STATE;
      // Import clampPaneWidth inline to avoid a circular dep with viewSlice.
      const min = 300;
      const max = 600;
      const clamped = Math.max(min, Math.min(max, width));
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
  };
}
