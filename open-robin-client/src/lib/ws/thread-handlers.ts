/**
 * @module thread-handlers
 * @role Handle thread-related WebSocket messages (CRUD, history conversion).
 *
 * Extracted from ws-client.ts (spec 05b) so thread logic is isolated.
 * SPEC-26c: every thread:* response and wire_ready now carries a `scope`
 * field (added server-side in 26b). Handlers read msg.scope and route to
 * the scope-keyed store slots instead of the former single thread list.
 */

import { usePanelStore } from '../../state/panelStore';
import { toolNameToSegmentType, SEGMENT_ICONS } from '../instructions';
import { loadRootTree } from '../file-tree';
import { secondaryTracker } from '../secondary-tracker';
import type { WebSocketMessage, ExchangeData, AssistantPart, StreamSegment, Scope } from '../../types';

/**
 * Handle thread-related WebSocket messages.
 * Returns true if the message was handled, false if not recognized.
 */
export function handleThreadMessage(msg: WebSocketMessage): boolean {
  const store = usePanelStore.getState();
  // SECONDARY_CHAT_SPEC: view-scope narrowed to agents-viewer. Default 'project'
  // for any messages that slip through without scope.
  const scope: Scope = msg.scope === 'view' ? 'view' : 'project';

  switch (msg.type) {
    case 'thread:list':
      console.log('[WS] thread:list received:', msg.threads?.length, 'threads scope=', scope);
      if (msg.threads) {
        store.setThreads(scope, msg.threads);
        // Auto-open the MRU (top) thread when none is active. Fills the chat
        // on refresh even when the threads sidebar is hidden.
        const hasActive = store.currentThreadIds[scope];
        if (!hasActive && msg.threads.length > 0) {
          const mru = msg.threads[0];
          const ws = store.ws;
          if (ws && ws.readyState === WebSocket.OPEN && mru.threadId) {
            console.log('[WS] Auto-opening MRU thread:', mru.threadId.slice(0, 8), 'scope=', scope);
            ws.send(JSON.stringify({
              type: 'thread:open-assistant',
              scope,
              threadId: mru.threadId,
            }));
          }
        }
      }
      return true;

    case 'thread:created':
      console.log('[WS] thread:created received:', msg.threadId, 'scope=', scope);
      if (msg.thread && msg.threadId) {
        store.addThread(scope, { threadId: msg.threadId, entry: msg.thread });
        store.setCurrentThreadId(scope, msg.threadId);
        store.setCurrentScope(scope);
        // PER_THREAD_CHAT_STATE: clear this thread's slot specifically.
        store.clearChat(scope, msg.threadId);
        loadRootTree();
      } else {
        console.error('[WS] thread:created missing data:', msg);
      }
      return true;

    case 'thread:opened': {
      console.log('[WS] thread:opened:', msg.threadId?.slice(0, 8), 'scope=', scope, 'exchanges:', msg.exchanges?.length, 'history:', msg.history?.length, 'contextUsage:', msg.contextUsage);
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
          store.clearChat(scope, msg.threadId);
          if (msg.exchanges && msg.exchanges.length > 0) {
            convertExchangesToMessages(scope, msg.threadId, msg.exchanges);
          } else if (msg.history && msg.history.length > 0) {
            convertHistoryToMessages(scope, msg.threadId, msg.history);
          }
          return true;
        }

        store.setCurrentThreadId(scope, msg.threadId);
        store.setCurrentScope(scope);
        // PER_THREAD_CHAT_STATE: clear then hydrate this thread's slot.
        store.clearChat(scope, msg.threadId);

        if (msg.exchanges && msg.exchanges.length > 0) {
          console.log('[WS] Loading', msg.exchanges.length, 'exchanges (rich format)');
          convertExchangesToMessages(scope, msg.threadId, msg.exchanges);
        } else if (msg.history && msg.history.length > 0) {
          console.log('[WS] Loading', msg.history.length, 'messages (legacy format)');
          convertHistoryToMessages(scope, msg.threadId, msg.history);
        }

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
      // SPEC-26c: server is the source of truth for which scope has the wire.
      store.setCurrentScope(scope);
      store.setWireReady(true);
      return true;

    case 'thread:renamed':
      if (msg.threadId && msg.name) {
        store.updateThread(scope, msg.threadId, { name: msg.name });
      }
      return true;

    case 'thread:deleted':
      if (msg.threadId) {
        store.removeThread(scope, msg.threadId);
      }
      return true;

    case 'message:sent':
      console.log('[WS] Message saved to thread');
      return true;

    default:
      return false;
  }
}

// --- History conversion helpers (private to this module) ---

function convertExchangesToMessages(scope: Scope, threadId: string, exchanges: ExchangeData[]) {
  const store = usePanelStore.getState();
  exchanges.forEach((exchange, idx) => {
    store.addMessage(scope, threadId, {
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

    store.addMessage(scope, threadId, {
      id: `ex-${idx}-assistant`,
      type: 'assistant',
      content: assistantContent,
      timestamp: exchange.ts,
      segments: segments.length > 0 ? segments : undefined,
    });
  });
}

function convertPartToSegment(part: AssistantPart): StreamSegment {
  if (part.type === 'text') {
    return { type: 'text', content: part.content };
  } else if (part.type === 'think') {
    return { type: 'think', content: part.content };
  } else {
    const segType = toolNameToSegmentType(part.name);
    const info = SEGMENT_ICONS[segType];
    return {
      type: segType,
      content: part.result.output || '',
      toolCallId: part.toolCallId,
      icon: info?.icon,
      toolArgs: part.arguments,
      toolDisplay: part.result.display,
      isError: !!part.result.error,
    };
  }
}

function convertHistoryToMessages(
  scope: Scope,
  threadId: string,
  history: { role: 'user' | 'assistant'; content: string; hasToolCalls?: boolean }[],
) {
  const store = usePanelStore.getState();
  history.forEach((h, idx) => {
    store.addMessage(scope, threadId, {
      id: `hist-${idx}`,
      type: h.role,
      content: h.content,
      timestamp: Date.now() - (history.length - idx) * 1000,
    });
  });
}
