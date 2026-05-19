/**
 * @module chatSlice
 * @role Chat, segment, and turn state actions for the panel store.
 *       All message streaming, finalization, and project/view chat routing lives here.
 */
import type { Scope, PanelState, Message, AssistantTurn, StreamSegment } from '../../types';
import type { AppState } from '../panelStoreTypes';

type Set = (partial: Partial<AppState> | ((state: AppState) => Partial<AppState>)) => void;
type Get = () => AppState;

// ── Helpers ──────────────────────────────────────────────────────────────────

export function createInitialPanelState(): PanelState {
  return {
    messages: [],
    currentTurn: null,
    pendingTurnEnd: false,
    pendingMessage: null,
    segments: [],
    lastReleasedSegmentCount: 0,
  };
}

/**
 * PER_THREAD_CHAT_STATE helper: resolve the chat state slot.
 *  - 'view'    → state.panels[currentPanel]
 *  - 'project' + threadId → projectChats[threadId] (auto-init if missing)
 *  - 'project' + null threadId → fallback to currentThreadIds.project
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
  next: PanelState,
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
 * for no-op-checking. Returns null if scope='project' and no thread is active.
 */
function resolveThreadId(state: AppState, scope: Scope, threadId: string | null): string | null {
  if (scope === 'view') return null;
  return threadId ?? state.currentThreadIds.project;
}

// ── Slice factory ─────────────────────────────────────────────────────────────

export function createChatSlice(set: Set, get: Get) {
  return {
    panels: {} as Record<string, PanelState>,
    projectChats: {} as Record<string, PanelState>,
    contextUsage: 0,
    setContextUsage: (usage: number) => set({ contextUsage: usage }),

    addMessage: (scope: Scope, threadId: string | null, message: Message) => set((state) => {
      const cs = getChatState(state, scope, threadId);
      return writeChatState(state, scope, threadId, { ...cs, messages: [...cs.messages, message] });
    }),

    setCurrentTurn: (scope: Scope, threadId: string | null, turn: AssistantTurn | null) => set((state) => {
      const cs = getChatState(state, scope, threadId);
      return writeChatState(state, scope, threadId, { ...cs, currentTurn: turn });
    }),

    updateTurnContent: (scope: Scope, threadId: string | null, content: string) => set((state) => {
      const cs = getChatState(state, scope, threadId);
      if (!cs.currentTurn) return state;
      return writeChatState(state, scope, threadId, {
        ...cs,
        currentTurn: { ...cs.currentTurn, content },
      });
    }),

    appendSegment: (scope: Scope, threadId: string | null, segType: StreamSegment['type'], text: string) => set((state) => {
      const cs = getChatState(state, scope, threadId);
      const segments = [...cs.segments];
      const last = segments[segments.length - 1];
      if (last && last.type === segType) {
        segments[segments.length - 1] = { ...last, content: last.content + text };
      } else {
        if (last && !last.complete) {
          segments[segments.length - 1] = { ...last, complete: true };
        }
        segments.push({ type: segType, content: text });
      }
      return writeChatState(state, scope, threadId, { ...cs, segments });
    }),

    pushSegment: (scope: Scope, threadId: string | null, segment: StreamSegment) => set((state) => {
      const cs = getChatState(state, scope, threadId);
      const segments = [...cs.segments];
      const last = segments[segments.length - 1];
      if (last && !last.complete) {
        segments[segments.length - 1] = { ...last, complete: true };
      }
      segments.push(segment);
      return writeChatState(state, scope, threadId, { ...cs, segments });
    }),

    updateLastSegment: (scope: Scope, threadId: string | null, updates: Partial<StreamSegment>) => set((state) => {
      const cs = getChatState(state, scope, threadId);
      const segments = [...cs.segments];
      const last = segments[segments.length - 1];
      if (last) {
        segments[segments.length - 1] = { ...last, ...updates };
      }
      return writeChatState(state, scope, threadId, { ...cs, segments });
    }),

    updateSegmentByToolCallId: (scope: Scope, threadId: string | null, toolCallId: string, updates: Partial<StreamSegment>) => set((state) => {
      const cs = getChatState(state, scope, threadId);
      const idx = cs.segments.findIndex((s) => s.toolCallId === toolCallId);
      if (idx < 0) return state;
      const segments = [...cs.segments];
      segments[idx] = { ...segments[idx], ...updates };
      return writeChatState(state, scope, threadId, { ...cs, segments });
    }),

    appendSegmentContentByIndex: (scope: Scope, threadId: string | null, index: number, text: string) => set((state) => {
      const cs = getChatState(state, scope, threadId);
      if (index < 0 || index >= cs.segments.length) return state;
      const segments = [...cs.segments];
      segments[index] = { ...segments[index], content: segments[index].content + text };
      return writeChatState(state, scope, threadId, { ...cs, segments });
    }),

    resetSegments: (scope: Scope, threadId: string | null) => set((state) => {
      const cs = getChatState(state, scope, threadId);
      return writeChatState(state, scope, threadId, { ...cs, segments: [] });
    }),

    setPendingTurnEnd: (scope: Scope, threadId: string | null, pending: boolean) => set((state) => {
      const cs = getChatState(state, scope, threadId);
      return writeChatState(state, scope, threadId, { ...cs, pendingTurnEnd: pending });
    }),

    setPendingMessage: (scope: Scope, threadId: string | null, message: Message | null) => set((state) => {
      const cs = getChatState(state, scope, threadId);
      return writeChatState(state, scope, threadId, { ...cs, pendingMessage: message });
    }),

    // TURN FINALIZATION — completes the full turn lifecycle in one atomic update.
    // Called exactly once per turn, by LiveSegmentRenderer's completion effect,
    // when BOTH conditions are met:
    //   1. All segments have been revealed (revealedCount >= segments.length)
    //   2. turn_end has arrived (pendingTurnEnd is true → onRevealComplete is defined)
    //
    // KNOWN PAST BUG (DO NOT REINTRODUCE):
    // The old finalizeTurn only set status='complete' but left the turn in
    // currentTurn, causing it to stay in limbo until the next turn_begin.
    finalizeTurn: (scope: Scope, threadId: string | null) => {
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

    clearChat: (scope: Scope, threadId: string | null) => set((state) =>
      writeChatState(state, scope, threadId, createInitialPanelState())
    ),

    sendMessage: (text: string, scope: Scope, threadIdOpt?: string | null) => {
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
      console.log(`[TIMING] SEND at ${now.toFixed(1)}ms scope=${scope} threadId=${threadId.slice(0, 8)}`);
      socket.send(JSON.stringify({
        type: 'prompt',
        scope,
        threadId,
        user_input: text,
      }));
    },
  };
}
