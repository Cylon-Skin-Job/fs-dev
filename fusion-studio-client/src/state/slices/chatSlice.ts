/**
 * @module chatSlice
 * @role Chat, segment, and turn state actions for the panel store.
 *       All message streaming, finalization, and chat routing lives here.
 *       RCC-0095: single workspace chat — chat state is keyed by threadId
 *       in projectChats (the legacy per-view chat slots were removed).
 */
import type {
  PanelState,
  Message,
  AssistantTurn,
  StreamSegment,
  TodoDrawerState,
  MessageExchangeSavedPayload,
} from '../../types';
import type { AppState } from '../panelStoreTypes';
import type { ChatLinkAttachment } from '../../lib/chat-file-links/file-link-types';

type Set = (partial: Partial<AppState> | ((state: AppState) => Partial<AppState>)) => void;
type Get = () => AppState;

interface TimingProbeWindow extends Window {
  __TIMING?: {
    sendAt: number;
    firstTokenAt: number;
    firstTokenType: string;
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

export function createInitialPanelState(): PanelState {
  return {
    messages: [],
    currentTurn: null,
    pendingTurnEnd: false,
    pendingMessage: null,
    segments: [],
    lastReleasedSegmentCount: 0,
    todoDrawer: undefined,
    pendingSavedExchanges: {},
    pendingExchangeSaveTurnId: null,
  };
}

/**
 * PER_THREAD_CHAT_STATE helper: resolve the chat state slot for a thread.
 * Falls back to the current workspace thread when threadId is null.
 */
function getChatState(state: AppState, threadId: string | null): PanelState {
  const tid = threadId ?? state.currentThreadId;
  if (!tid) return createInitialPanelState();
  return state.projectChats[tid] || createInitialPanelState();
}

/**
 * PER_THREAD_CHAT_STATE helper: build the partial state update to write a
 * chat-state slot back to the store, keyed by threadId.
 * Returns {} (no-op) when no threadId can be resolved.
 */
function writeChatState(
  state: AppState,
  threadId: string | null,
  next: PanelState,
): Partial<AppState> {
  const tid = threadId ?? state.currentThreadId;
  if (!tid) return {};
  return { projectChats: { ...state.projectChats, [tid]: next } };
}

/**
 * Resolve a threadId from its optional form to the concrete active thread.
 * Returns null when no thread is active.
 */
function resolveThreadId(state: AppState, threadId: string | null): string | null {
  return threadId ?? state.currentThreadId;
}

function applySavedExchangePayload(
  message: Message,
  payload: MessageExchangeSavedPayload | undefined,
): Message {
  if (!payload) return message;
  return {
    ...message,
    ...(payload.exchangeId !== undefined ? { exchangeId: payload.exchangeId } : {}),
    ...(payload.seq !== undefined ? { exchangeSeq: payload.seq } : {}),
    ...(payload.ts !== undefined ? { timestamp: payload.ts } : {}),
    ...(payload.metadata !== undefined ? { metadata: payload.metadata } : {}),
  };
}

// ── Slice factory ─────────────────────────────────────────────────────────────

export function createChatSlice(set: Set, get: Get) {
  return {
    projectChats: {} as Record<string, PanelState>,
    contextUsage: 0,
    setContextUsage: (usage: number) => set({ contextUsage: usage }),
    tokenUsage: null,
    setTokenUsage: (usage: AppState['tokenUsage']) => set({ tokenUsage: usage }),

    addMessage: (threadId: string | null, message: Message) => set((state) => {
      const cs = getChatState(state, threadId);
      return writeChatState(state, threadId, { ...cs, messages: [...cs.messages, message] });
    }),

    setCurrentTurn: (threadId: string | null, turn: AssistantTurn | null) => set((state) => {
      const cs = getChatState(state, threadId);
      return writeChatState(state, threadId, { ...cs, currentTurn: turn });
    }),

    updateTurnContent: (threadId: string | null, content: string) => set((state) => {
      const cs = getChatState(state, threadId);
      if (!cs.currentTurn) return state;
      return writeChatState(state, threadId, {
        ...cs,
        currentTurn: { ...cs.currentTurn, content },
      });
    }),

    appendSegment: (threadId: string | null, segType: StreamSegment['type'], text: string) => set((state) => {
      const cs = getChatState(state, threadId);
      const segments = [...cs.segments];
      const last = segments[segments.length - 1];
      if (last && last.type === segType) {
        segments[segments.length - 1] = { ...last, content: last.content + text };
      } else {
        if (last && !last.complete && !last.toolCallId) {
          segments[segments.length - 1] = { ...last, complete: true };
        }
        segments.push({ type: segType, content: text });
      }
      return writeChatState(state, threadId, { ...cs, segments });
    }),

    pushSegment: (threadId: string | null, segment: StreamSegment) => set((state) => {
      const cs = getChatState(state, threadId);
      const segments = [...cs.segments];
      const last = segments[segments.length - 1];
      if (last && !last.complete && !last.toolCallId) {
        segments[segments.length - 1] = { ...last, complete: true };
      }
      segments.push(segment);
      return writeChatState(state, threadId, { ...cs, segments });
    }),

    updateLastSegment: (threadId: string | null, updates: Partial<StreamSegment>) => set((state) => {
      const cs = getChatState(state, threadId);
      const segments = [...cs.segments];
      const last = segments[segments.length - 1];
      if (last) {
        segments[segments.length - 1] = { ...last, ...updates };
      }
      return writeChatState(state, threadId, { ...cs, segments });
    }),

    updateSegmentByIndex: (threadId: string | null, index: number, updates: Partial<StreamSegment>) => set((state) => {
      const cs = getChatState(state, threadId);
      if (index < 0 || index >= cs.segments.length) return state;
      const segments = [...cs.segments];
      segments[index] = { ...segments[index], ...updates };
      return writeChatState(state, threadId, { ...cs, segments });
    }),

    updateSegmentByToolCallId: (threadId: string | null, toolCallId: string, updates: Partial<StreamSegment>) => set((state) => {
      const cs = getChatState(state, threadId);
      const idx = cs.segments.findIndex((s) => s.toolCallId === toolCallId);
      if (idx < 0) return state;
      const segments = [...cs.segments];
      segments[idx] = { ...segments[idx], ...updates };
      return writeChatState(state, threadId, { ...cs, segments });
    }),

    appendSegmentContentByIndex: (threadId: string | null, index: number, text: string) => set((state) => {
      const cs = getChatState(state, threadId);
      if (index < 0 || index >= cs.segments.length) return state;
      const segments = [...cs.segments];
      segments[index] = { ...segments[index], content: segments[index].content + text };
      return writeChatState(state, threadId, { ...cs, segments });
    }),

    resetSegments: (threadId: string | null) => set((state) => {
      const cs = getChatState(state, threadId);
      return writeChatState(state, threadId, { ...cs, segments: [] });
    }),

    setPendingTurnEnd: (threadId: string | null, pending: boolean) => set((state) => {
      const cs = getChatState(state, threadId);
      return writeChatState(state, threadId, { ...cs, pendingTurnEnd: pending });
    }),

    setPendingExchangeSave: (threadId: string | null, turnId: string | null) => set((state) => {
      const cs = getChatState(state, threadId);
      return writeChatState(state, threadId, { ...cs, pendingExchangeSaveTurnId: turnId });
    }),

    setPendingMessage: (threadId: string | null, message: Message | null) => set((state) => {
      const cs = getChatState(state, threadId);
      return writeChatState(state, threadId, { ...cs, pendingMessage: message });
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
    finalizeTurn: (threadId: string | null) => {
      const state = get();
      const cs = getChatState(state, threadId);
      const turn = cs.currentTurn;
      if (turn) {
        const segments = cs.segments;
        const savedPayload = cs.pendingSavedExchanges?.[turn.id];
        const pendingSavedExchanges = { ...(cs.pendingSavedExchanges || {}) };
        delete pendingSavedExchanges[turn.id];
        const assistantMessage = applySavedExchangePayload({
          id: turn.id || `turn-${Date.now()}`,
          type: 'assistant' as const,
          content: turn.content,
          timestamp: Date.now(),
          segments: segments.length > 0 ? [...segments] : undefined,
        }, savedPayload);
        const newMessages = [
          ...cs.messages,
          assistantMessage,
        ];
        set((s) => writeChatState(s, threadId, {
          ...getChatState(s, threadId),
          messages: newMessages,
          currentTurn: null,
          segments: [],
          pendingTurnEnd: false,
          pendingMessage: null,
          lastReleasedSegmentCount: 0,
          pendingSavedExchanges,
        }));
      }
    },

    setTodoDrawer: (threadId: string | null, drawer: TodoDrawerState | undefined) => set((state) => {
      const cs = getChatState(state, threadId);
      return writeChatState(state, threadId, { ...cs, todoDrawer: drawer });
    }),

    setMessageExchangeSaved: (threadId: string, turnId: string, payload: MessageExchangeSavedPayload) => set((state) => {
      const cs = state.projectChats[threadId] || createInitialPanelState();
      const messageIndex = cs.messages.findIndex((message) =>
        message.type === 'assistant' && message.id === turnId
      );
      if (messageIndex < 0) {
        if (cs.currentTurn?.id !== turnId) return state;
        const pendingExchangeSaveTurnId = cs.pendingExchangeSaveTurnId === turnId
          ? null
          : cs.pendingExchangeSaveTurnId;
        return writeChatState(state, threadId, {
          ...cs,
          pendingSavedExchanges: {
            ...(cs.pendingSavedExchanges || {}),
            [turnId]: payload,
          },
          pendingExchangeSaveTurnId,
        });
      }

      const messages = [...cs.messages];
      messages[messageIndex] = applySavedExchangePayload(messages[messageIndex], payload);
      const pendingSavedExchanges = { ...(cs.pendingSavedExchanges || {}) };
      delete pendingSavedExchanges[turnId];
      const pendingExchangeSaveTurnId = cs.pendingExchangeSaveTurnId === turnId
        ? null
        : cs.pendingExchangeSaveTurnId;

      return writeChatState(state, threadId, {
        ...cs,
        messages,
        pendingSavedExchanges,
        pendingExchangeSaveTurnId,
      });
    }),

    updateMessageMetadata: (
      threadId: string,
      exchangeId: number,
      metadata: Record<string, unknown>,
    ) => set((state) => {
      const cs = state.projectChats[threadId];
      if (!cs) return state;

      const messageIndex = cs.messages.findIndex((message) =>
        message.type === 'assistant' && message.exchangeId === exchangeId
      );
      if (messageIndex < 0) return state;

      const messages = [...cs.messages];
      messages[messageIndex] = {
        ...messages[messageIndex],
        metadata,
      };

      return writeChatState(state, threadId, {
        ...cs,
        messages,
      });
    }),

    clearChat: (threadId: string | null) => set((state) =>
      writeChatState(state, threadId, createInitialPanelState())
    ),

    sendMessage: (text: string, threadIdOpt?: string | null, attachments?: ChatLinkAttachment[]) => {
      const state = get();
      const socket = state.ws;
      if (!socket || socket.readyState !== WebSocket.OPEN) return;
      const threadId = resolveThreadId(state, threadIdOpt ?? null);
      if (!threadId) {
        console.error('[Store] sendMessage: no active thread');
        return;
      }
      const now = performance.now();
      (window as TimingProbeWindow).__TIMING = { sendAt: now, firstTokenAt: 0, firstTokenType: '' };
      console.log(`[TIMING] SEND at ${now.toFixed(1)}ms threadId=${threadId.slice(0, 8)}`);
      const composerModelConfig = state.composerModelConfig?.[state.currentPanel];
      const harnessConfig = composerModelConfig
        ? {
            ...(composerModelConfig.modelId ? { model: composerModelConfig.modelId } : {}),
            ...(composerModelConfig.effort ? { variant: composerModelConfig.effort } : {}),
          }
        : undefined;
      socket.send(JSON.stringify({
        type: 'prompt',
        threadId,
        user_input: text,
        ...(attachments?.length ? { attachments } : {}),
        ...(harnessConfig && Object.keys(harnessConfig).length ? { harnessConfig } : {}),
      }));
    },

    warmThread: (threadIdOpt?: string | null) => {
      const state = get();
      const socket = state.ws;
      if (!socket || socket.readyState !== WebSocket.OPEN) return;
      if (!state.chatActive) return;
      const threadId = resolveThreadId(state, threadIdOpt ?? null);
      if (!threadId) return;
      socket.send(JSON.stringify({
        type: 'thread:warm',
        threadId,
      }));
    },
  };
}
