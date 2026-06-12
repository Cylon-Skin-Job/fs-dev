/**
 * @module thread-handlers
 * @role Handle thread-related WebSocket messages (CRUD, history conversion).
 *
 * Extracted from ws-client.ts (spec 05b) so thread logic is isolated.
 * RCC-0095: single workspace chat — all routing is by threadId. The server
 * still stamps scope: 'project' on the wire; the client ignores it.
 */

import { usePanelStore } from '../../state/panelStore';
import { loadRootTree } from '../file-tree';
import { secondaryTracker } from '../secondary-tracker';
import { convertPartToSegment } from './assistant-parts';
import type { WebSocketMessage, ExchangeData, LiveTurnSnapshot } from '../../types';

/**
 * Handle thread-related WebSocket messages.
 * Returns true if the message was handled, false if not recognized.
 */
export function handleThreadMessage(msg: WebSocketMessage): boolean {
  const store = usePanelStore.getState();

  switch (msg.type) {
    case 'thread:list':
      console.log('[WS] thread:list received:', msg.threads?.length, 'threads');
      if (msg.threads) {
        store.setThreads(msg.threads);
        // Auto-open the MRU (top) thread when none is active. Fills the chat
        // on refresh even when the threads sidebar is hidden.
        const hasActive = store.currentThreadId;
        if (!hasActive && msg.threads.length > 0) {
          const mru = msg.threads[0];
          const ws = store.ws;
          if (ws && ws.readyState === WebSocket.OPEN && mru.threadId) {
            console.log('[WS] Auto-opening MRU thread:', mru.threadId.slice(0, 8));
            // Multiple panels request the same thread list during boot.
            // Mark the MRU as active before the server responds so only the
            // first list response sends thread:open.
            store.setCurrentThreadId(mru.threadId);
            ws.send(JSON.stringify({
              type: 'thread:open',
              threadId: mru.threadId,
            }));
          }
        }
      }
      return true;

    case 'thread:created':
      console.log('[WS] thread:created received:', msg.threadId);
      if (msg.thread && msg.threadId) {
        store.addThread({ threadId: msg.threadId, entry: msg.thread });
        store.setCurrentThreadId(msg.threadId);
        store.setChatActive(true);
        // PER_THREAD_CHAT_STATE: clear this thread's slot specifically.
        store.clearChat(msg.threadId);
        loadRootTree();
      } else {
        console.error('[WS] thread:created missing data:', msg);
      }
      return true;

    case 'thread:opened': {
      console.log('[WS] thread:opened:', msg.threadId?.slice(0, 8), 'exchanges:', msg.exchanges?.length, 'history:', msg.history?.length, 'contextUsage:', msg.contextUsage);
      if (msg.threadId && msg.thread) {
        // SECONDARY_CHAT_SPEC: if this thread:opened is for the secondary's
        // thread, hydrate its chat slot but do NOT touch primary state.
        // Check both the live secondary state AND the secondary tracker —
        // the tracker catches the race where the user clicks red before the
        // server's response arrives (secondary is already null, but the
        // response was originally intended for the secondary and must not
        // hijack the primary's current thread).
        const isForSecondary =
          store.secondary?.threadId === msg.threadId ||
          secondaryTracker.has(msg.threadId);

        if (isForSecondary) {
          secondaryTracker.unmark(msg.threadId);
          store.clearChat(msg.threadId);
          if (msg.exchanges && msg.exchanges.length > 0) {
            convertExchangesToMessages(msg.threadId, msg.exchanges);
          } else if (msg.history && msg.history.length > 0) {
            convertHistoryToMessages(msg.threadId, msg.history);
          }
          overlayLiveTurn(msg.threadId, msg.liveTurn, msg.exchanges);
          return true;
        }

        store.setCurrentThreadId(msg.threadId);
        store.setChatActive(true);
        // PER_THREAD_CHAT_STATE: clear then hydrate this thread's slot.
        store.clearChat(msg.threadId);

        if (msg.exchanges && msg.exchanges.length > 0) {
          console.log('[WS] Loading', msg.exchanges.length, 'exchanges (rich format)');
          convertExchangesToMessages(msg.threadId, msg.exchanges);
        } else if (msg.history && msg.history.length > 0) {
          console.log('[WS] Loading', msg.history.length, 'messages (legacy format)');
          convertHistoryToMessages(msg.threadId, msg.history);
        }
        overlayLiveTurn(msg.threadId, msg.liveTurn, msg.exchanges);

        // Restore context usage from last exchange if available
        if (msg.contextUsage !== undefined && msg.contextUsage !== null) {
          console.log('[WS] Restoring context usage:', msg.contextUsage);
          store.setContextUsage(msg.contextUsage);
        } else {
          console.log('[WS] No contextUsage to restore - msg.contextUsage:', msg.contextUsage);
        }
      }
      return true;
    }

    case 'wire_ready':
      store.setChatActive(true);
      store.setWireReady(true);
      return true;

    case 'thread:renamed':
      if (msg.threadId && msg.name) {
        store.updateThread(msg.threadId, { name: msg.name });
      }
      return true;

    case 'thread:deleted':
      if (msg.threadId) {
        store.removeThread(msg.threadId);
      }
      return true;

    case 'message:sent':
      console.log('[WS] Message accepted and saved to thread');
      if (msg.threadId && typeof msg.content === 'string') {
        store.addMessage(msg.threadId, {
          id: `user-${Date.now()}`,
          type: 'user',
          content: msg.content,
          timestamp: Date.now(),
        });
        window.dispatchEvent(new CustomEvent('fusion:prompt-accepted', {
          detail: { threadId: msg.threadId, content: msg.content },
        }));
      }
      return true;

    default:
      return false;
  }
}

// --- History conversion helpers (private to this module) ---

function convertExchangesToMessages(threadId: string, exchanges: ExchangeData[]) {
  const store = usePanelStore.getState();
  exchanges.forEach((exchange, idx) => {
    store.addMessage(threadId, {
      id: `ex-${idx}-user`,
      type: 'user',
      content: exchange.user,
      timestamp: exchange.ts,
    });

    const segments = exchange.assistant.parts.map((part) => convertPartToSegment(part));
    const assistantContent = exchange.assistant.parts
      .filter((p): p is { type: 'text'; content: string } => p.type === 'text')
      .map((p) => p.content)
      .join('');

    store.addMessage(threadId, {
      id: `ex-${idx}-assistant`,
      type: 'assistant',
      content: assistantContent,
      timestamp: exchange.ts,
      segments: segments.length > 0 ? segments : undefined,
    });
  });
}

function convertHistoryToMessages(
  threadId: string,
  history: { role: 'user' | 'assistant'; content: string; hasToolCalls?: boolean }[],
) {
  const store = usePanelStore.getState();
  history.forEach((h, idx) => {
    store.addMessage(threadId, {
      id: `hist-${idx}`,
      type: h.role,
      content: h.content,
      timestamp: Date.now() - (history.length - idx) * 1000,
    });
  });
}

function overlayLiveTurn(
  threadId: string,
  liveTurn: LiveTurnSnapshot | null | undefined,
  exchanges: ExchangeData[] | undefined,
) {
  if (!liveTurn || liveTurn.threadId !== threadId) return;
  if (isLiveTurnDurable(liveTurn, exchanges)) return;

  const store = usePanelStore.getState();
  const chatState = store.projectChats[threadId];
  const hasUserBubble = chatState?.messages.some(
    message => message.type === 'user' && message.content === liveTurn.userInput,
  );

  if (!hasUserBubble) {
    store.addMessage(threadId, {
      id: `live-${liveTurn.turnId}-user`,
      type: 'user',
      content: liveTurn.userInput,
      timestamp: liveTurn.updatedAt,
    });
  }

  store.resetSegments(threadId);
  const isTerminal = liveTurn.status !== 'in_flight';
  liveTurn.parts.map((part, index) => convertPartToSegment(part, {
    isTerminal,
    isLastPart: index === liveTurn.parts.length - 1,
  })).forEach(segment => {
    store.pushSegment(threadId, segment);
  });
  store.setCurrentTurn(threadId, {
    id: liveTurn.turnId,
    content: liveTurn.fullText,
    status: isTerminal ? 'complete' : 'streaming',
    hasThinking: liveTurn.parts.some(part => part.type === 'think'),
    thinkingContent: liveTurn.parts
      .filter((part): part is { type: 'think'; content: string } => part.type === 'think')
      .map(part => part.content)
      .join(''),
  });
  store.setPendingTurnEnd(threadId, isTerminal);
}

function isLiveTurnDurable(liveTurn: LiveTurnSnapshot, exchanges: ExchangeData[] | undefined): boolean {
  return Boolean(exchanges?.some(exchange => {
    const assistantText = exchange.assistant.parts
      .filter((part): part is { type: 'text'; content: string } => part.type === 'text')
      .map(part => part.content)
      .join('');
    return exchange.user === liveTurn.userInput && assistantText === liveTurn.fullText;
  }));
}
